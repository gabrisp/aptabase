using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

namespace Aptabase.Features.Authentication;

public class SignInBodyRequest
{
    [EmailAddress]
    public string Email { get; set; } = "";
}

public class RegisterBodyRequest
{
    [StringLength(40, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [EmailAddress]
    public string Email { get; set; } = "";
}

public class PasswordSignInBodyRequest
{
    [EmailAddress]
    public string Email { get; set; } = "";

    [Required]
    public string Password { get; set; } = "";
}

public class PasswordRegisterBodyRequest
{
    [StringLength(40, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [EmailAddress]
    public string Email { get; set; } = "";

    [StringLength(100, MinimumLength = 8)]
    public string Password { get; set; } = "";
}

[ApiController]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AuthController : Controller
{
    private readonly ILogger _logger;
    private readonly EnvSettings _env;
    private readonly IAuthService _authService;
    private readonly IAuthTokenManager _tokenManager;

    public AuthController(
        ILogger<AuthController> logger,
        EnvSettings env,
        IAuthService authService,
        IAuthTokenManager tokenManager)
    {
        _env = env ?? throw new ArgumentNullException(nameof(env));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _authService = authService ?? throw new ArgumentNullException(nameof(authService));
        _tokenManager = tokenManager ?? throw new ArgumentNullException(nameof(tokenManager));
    }

    [HttpPost("/api/_auth/signin")]
    public async Task<IActionResult> SignIn([FromBody] SignInBodyRequest body, CancellationToken cancellationToken)
    {
        if (_env.DisableMagicLinks)
            return StatusCode(403, "Magic link authentication is disabled.");

        var found = await _authService.SendSignInEmailAsync(body.Email.Trim(), cancellationToken);

        if (!found)
            return NotFound(new { });

        return Ok(new { });
    }

    [HttpPost("/api/_auth/register")]
    [EnableRateLimiting("SignUp")]
    public async Task<IActionResult> Register([FromBody] RegisterBodyRequest body, CancellationToken cancellationToken)
    {
        if (_env.DisableMagicLinks)
            return StatusCode(403, "Magic link authentication is disabled.");

        if (await IsSignUpClosed(cancellationToken))
            return StatusCode(403, "Sign up is disabled on this instance.");

        await _authService.SendRegisterEmailAsync(body.Name.Trim(), body.Email.Trim(), cancellationToken);
        return Ok(new { });
    }

    [HttpPost("/api/_auth/password/signin")]
    [EnableRateLimiting("PasswordAuth")]
    public async Task<IActionResult> PasswordSignIn([FromBody] PasswordSignInBodyRequest body, CancellationToken cancellationToken)
    {
        var email = body.Email.Trim();
        var passwordHash = await _authService.GetPasswordHashByEmailAsync(email, cancellationToken);

        if (!PasswordHasher.Verify(body.Password, passwordHash))
        {
            _logger.LogWarning("Failed password sign in attempt for {Email}", email);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var user = await _authService.FindUserByEmailAsync(email, cancellationToken);
        if (user is null)
            return Unauthorized(new { message = "Invalid email or password." });

        await _authService.SignInAsync(user);
        return Ok(new { });
    }

    [HttpPost("/api/_auth/password/register")]
    [EnableRateLimiting("SignUp")]
    public async Task<IActionResult> PasswordRegister([FromBody] PasswordRegisterBodyRequest body, CancellationToken cancellationToken)
    {
        if (await IsSignUpClosed(cancellationToken))
            return StatusCode(403, "Sign up is disabled on this instance.");

        var email = body.Email.Trim();
        var existing = await _authService.FindUserByEmailAsync(email, cancellationToken);
        if (existing is not null)
            return Conflict(new { message = "An account with this email already exists." });

        var user = await _authService.CreateAccountWithPasswordAsync(body.Name.Trim(), email, PasswordHasher.Hash(body.Password), cancellationToken);
        await _authService.SignInAsync(user);
        return Ok(new { });
    }

    // Sign up can be disabled, but the very first account is always allowed
    // so the instance owner can create theirs
    private async Task<bool> IsSignUpClosed(CancellationToken cancellationToken)
    {
        if (!_env.DisableSignUp)
            return false;

        return await _authService.CountUsersAsync(cancellationToken) > 0;
    }

    [HttpGet("/api/_auth/github")]
    public IActionResult GitHub()
    {
        return Challenge(new AuthenticationProperties { RedirectUri = $"{_env.SelfBaseUrl}/" }, "github");
    }

    [HttpGet("/api/_auth/google")]
    public IActionResult Google()
    {
        return Challenge(new AuthenticationProperties { RedirectUri = $"{_env.SelfBaseUrl}/" }, "google");
    }

    [HttpGet("/api/_auth/me")]
    [IsAuthenticated]
    [EnableCors("AllowAptabaseCom")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var identity = this.GetCurrentUserIdentity();
        var user = await _authService.FindUserByIdAsync(identity.Id, cancellationToken);
        if (user is null)
            return NotFound();

        return Ok(user);
    }

    [HttpPost("/api/_auth/account/delete")]
    [IsAuthenticated]
    [EnableCors("AllowAptabaseCom")]
    public async Task<IActionResult> DeleteAccount(CancellationToken cancellationToken)
    {
        var identity = this.GetCurrentUserIdentity();
        var user = await _authService.FindUserByIdAsync(identity.Id, cancellationToken);
        if (user is null)
            return NotFound();

        await _authService.DeleteUserByIdAsync(identity.Id, cancellationToken);

        return Ok(user);
    }

    [HttpPost("/api/_auth/signout")]
    public async Task<IActionResult> ForceSignOut()
    {
        await _authService.SignOutAsync();
        return Redirect($"{_env.SelfBaseUrl}/auth");
    }

    [HttpGet("/api/_auth/continue")]
    public async Task<IActionResult> HandleMagicLink([FromQuery] string token, CancellationToken cancellationToken)
    {
        try
        {
            var result = _tokenManager.ParseAuthToken(token);
            var user = await _authService.FindUserByEmailAsync(result.Email, cancellationToken);

            if (result.Type == AuthTokenType.Register && user == null)
                user = await _authService.CreateAccountAsync(result.Name, result.Email, cancellationToken);

            if (user != null)
                await _authService.SignInAsync(user);
            else
                _logger.LogError("Tried to authenticate user with email {email}, but account was not found", result.Email);
        }
        catch (SecurityTokenExpiredException)
        {
            return Redirect($"{_env.SelfBaseUrl}/auth?error=expired");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unable to validate auth token");
            return Redirect($"{_env.SelfBaseUrl}/auth?error=invalid");
        }

        return Redirect($"{_env.SelfBaseUrl}/");
    }
}
