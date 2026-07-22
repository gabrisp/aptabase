using Aptabase.Features.Authentication;
using Aptabase.Features.Stats;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Aptabase.Features.AppUsers;

public class AppUsersQueryParams
{
    public string BuildMode { get; set; } = "";
    public string AppId { get; set; } = "";
    public string? UserId { get; set; }
    public string? Search { get; set; }

    public string ParseAppId()
    {
        return BuildMode.ToLower() switch
        {
            "debug" => $"{AppId}_DEBUG",
            _ => AppId,
        };
    }
}

[ApiController, IsAuthenticated, HasReadAccessToApp]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[EnableRateLimiting("Stats")]
public class AppUsersController : Controller
{
    private readonly IAppUserService _appUsers;

    public AppUsersController(IAppUserService appUsers)
    {
        _appUsers = appUsers ?? throw new ArgumentNullException(nameof(appUsers));
    }

    [HttpGet("/api/_app-users")]
    public async Task<IActionResult> List([FromQuery] AppUsersQueryParams query, CancellationToken cancellationToken)
    {
        var users = await _appUsers.ListAsync(query.ParseAppId(), query.Search, cancellationToken);
        return Ok(users);
    }

    [HttpGet("/api/_app-users/single")]
    public async Task<IActionResult> Single([FromQuery] AppUsersQueryParams query, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query.UserId))
            return BadRequest("UserId is required.");

        var user = await _appUsers.GetAsync(query.ParseAppId(), query.UserId, cancellationToken);
        if (user is null)
            return NotFound($"User not found: {query.UserId}");

        return Ok(user);
    }
}
