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
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? EventName { get; set; }
    public DateTime? Before { get; set; }
    public int? Limit { get; set; }

    public string ParseAppId()
    {
        return BuildMode.ToLower() switch
        {
            "debug" => $"{AppId}_DEBUG",
            _ => AppId,
        };
    }
}

public record AppUserEventRow
{
    public DateTime Timestamp { get; set; }
    public string EventName { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string OsName { get; set; } = "";
    public string OsVersion { get; set; } = "";
    public string AppVersion { get; set; } = "";
    public string CountryCode { get; set; } = "";
    public string RegionName { get; set; } = "";
    public string StringProps { get; set; } = "{}";
    public string NumericProps { get; set; } = "{}";
}

[ApiController, IsAuthenticated, HasReadAccessToApp]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[EnableRateLimiting("Stats")]
public class AppUsersController : Controller
{
    private readonly IAppUserService _appUsers;
    private readonly IQueryClient _queryClient;

    public AppUsersController(IAppUserService appUsers, IQueryClient queryClient)
    {
        _appUsers = appUsers ?? throw new ArgumentNullException(nameof(appUsers));
        _queryClient = queryClient ?? throw new ArgumentNullException(nameof(queryClient));
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

    [HttpGet("/api/_app-users/events")]
    public async Task<IActionResult> Events([FromQuery] AppUsersQueryParams query, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query.UserId))
            return BadRequest("UserId is required.");

        var limit = Math.Clamp(query.Limit ?? 50, 1, 200);
        var rows = await _queryClient.NamedQueryAsync<AppUserEventRow>("app_user_events__v1", new
        {
            app_id = query.ParseAppId(),
            app_user_id = Sanitize(query.UserId),
            event_name = Sanitize(query.EventName),
            date_from = query.StartDate,
            date_to = query.EndDate,
            before = query.Before,
            limit,
        }, cancellationToken);

        return Ok(rows);
    }

    // Values are interpolated into the SQL template, so strip quoting characters
    private static string? Sanitize(string? value)
    {
        return value?.Replace("\\", "").Replace("'", "");
    }
}
