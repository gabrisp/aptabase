using System.Collections.Concurrent;
using System.Text.Json;
using Aptabase.Data;
using Aptabase.Features.Ingestion;
using Dapper;

namespace Aptabase.Features.AppUsers;

public record AppUser
{
    public string UserId { get; set; } = "";
    public string? Name { get; set; }
    public string Props { get; set; } = "{}";
    public DateTime FirstSeen { get; set; }
    public DateTime LastSeen { get; set; }
    public string LastEventName { get; set; } = "";
}

public interface IAppUserService
{
    string[] AttributeEvents(TrackingEvent[] events);
    Task UpsertFromEventsAsync(TrackingEvent[] events, string[] appUserIds);
    Task<IEnumerable<AppUser>> ListAsync(string appId, string? search, CancellationToken cancellationToken);
    Task<AppUser?> GetAsync(string appId, string userId, CancellationToken cancellationToken);
}

public class AppUserService : IAppUserService
{
    // Once a session is identified, later events of the same session without a user_id
    // are attributed to that user. In-memory only: a restart loses the mapping until
    // the next identified event arrives.
    private record SessionUser(string UserId, DateTime SeenAt);
    private static readonly TimeSpan SessionUserTTL = TimeSpan.FromHours(12);
    private readonly ConcurrentDictionary<(string AppId, string SessionId), SessionUser> _sessionUsers = new();

    private readonly IDbContext _db;

    public AppUserService(IDbContext db)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
    }

    // Resolves the app user id of every event: events without a user_id inherit
    // the user of their session, if it was previously identified. Returns an array
    // parallel to the input, so the resolved ids also reach the analytics store.
    public string[] AttributeEvents(TrackingEvent[] events)
    {
        var now = DateTime.UtcNow;
        var result = new string[events.Length];

        // Process in timestamp order so an identified event maps its session
        // before later anonymous events of the same batch
        var indices = Enumerable.Range(0, events.Length).OrderBy(i => events[i].Timestamp);
        foreach (var i in indices)
        {
            var e = events[i];
            var appId = e.IsDebug ? $"{e.AppId}_DEBUG" : e.AppId;
            var userId = e.AppUserId ?? "";

            if (!string.IsNullOrWhiteSpace(userId))
            {
                if (!string.IsNullOrEmpty(e.SessionId))
                    _sessionUsers[(appId, e.SessionId)] = new SessionUser(userId, now);
            }
            else if (!string.IsNullOrEmpty(e.SessionId) &&
                     _sessionUsers.TryGetValue((appId, e.SessionId), out var mapped) &&
                     now - mapped.SeenAt < SessionUserTTL)
            {
                userId = mapped.UserId;
                _sessionUsers[(appId, e.SessionId)] = mapped with { SeenAt = now };
            }

            result[i] = userId?.Trim() ?? "";
        }

        PruneSessionUsers(now);
        return result;
    }

    public async Task UpsertFromEventsAsync(TrackingEvent[] events, string[] appUserIds)
    {
        // Keep only the latest event per (app, user), merging user props along the way
        var byUser = new Dictionary<(string, string), (TrackingEvent Event, string PropsJson)>();
        foreach (var i in Enumerable.Range(0, events.Length).OrderBy(i => events[i].Timestamp))
        {
            var e = events[i];
            var userId = appUserIds[i];
            if (string.IsNullOrWhiteSpace(userId))
                continue;

            var appId = e.IsDebug ? $"{e.AppId}_DEBUG" : e.AppId;
            var key = (appId, userId);
            if (byUser.TryGetValue(key, out var existing))
            {
                var propsJson = MergeProps(existing.PropsJson, e.UserPropsJson);
                byUser[key] = e.Timestamp >= existing.Event.Timestamp ? (e, propsJson) : (existing.Event, propsJson);
            }
            else
            {
                byUser[key] = (e, string.IsNullOrEmpty(e.UserPropsJson) ? "{}" : e.UserPropsJson);
            }
        }

        if (byUser.Count == 0)
            return;

        var rows = byUser.Select(kv => new
        {
            AppId = kv.Key.Item1,
            UserId = kv.Key.Item2,
            Name = ExtractName(kv.Value.PropsJson),
            ClearName = HasEmptyName(kv.Value.PropsJson),
            Props = kv.Value.PropsJson,
            Timestamp = kv.Value.Event.Timestamp,
            EventName = kv.Value.Event.EventName,
        }).ToArray();

        // An attribute sent as an empty string ("") means "delete this attribute",
        // so props are merged and then empty values are stripped out
        using var conn = _db.Connection;
        await conn.ExecuteAsync(
            @"INSERT INTO app_users (app_id, user_id, name, props, first_seen, last_seen, last_event_name)
              VALUES (@AppId, @UserId, @Name,
                      (SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
                         FROM jsonb_each(@Props::jsonb) WHERE value <> '""""'::jsonb),
                      @Timestamp, @Timestamp, @EventName)
              ON CONFLICT (app_id, user_id) DO UPDATE SET
                name = CASE WHEN @ClearName THEN NULL ELSE COALESCE(@Name, app_users.name) END,
                props = (SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
                           FROM jsonb_each(app_users.props || @Props::jsonb) WHERE value <> '""""'::jsonb),
                first_seen = LEAST(app_users.first_seen, EXCLUDED.first_seen),
                last_seen = GREATEST(app_users.last_seen, EXCLUDED.last_seen),
                last_event_name = CASE
                    WHEN EXCLUDED.last_seen >= app_users.last_seen THEN EXCLUDED.last_event_name
                    ELSE app_users.last_event_name
                END",
            rows);
    }

    public async Task<IEnumerable<AppUser>> ListAsync(string appId, string? search, CancellationToken cancellationToken)
    {
        using var conn = _db.Connection;
        return await conn.QueryAsync<AppUser>(new CommandDefinition(
            @"SELECT user_id, name, props::text as props, first_seen, last_seen, last_event_name
              FROM app_users
              WHERE app_id = @appId
                AND (@search = '' OR user_id ILIKE @searchPattern OR name ILIKE @searchPattern)
              ORDER BY last_seen DESC
              LIMIT 200",
            new { appId, search = search ?? "", searchPattern = $"%{search}%" },
            cancellationToken: cancellationToken));
    }

    public async Task<AppUser?> GetAsync(string appId, string userId, CancellationToken cancellationToken)
    {
        using var conn = _db.Connection;
        return await conn.QueryFirstOrDefaultAsync<AppUser>(new CommandDefinition(
            @"SELECT user_id, name, props::text as props, first_seen, last_seen, last_event_name
              FROM app_users
              WHERE app_id = @appId AND user_id = @userId",
            new { appId, userId },
            cancellationToken: cancellationToken));
    }

    private void PruneSessionUsers(DateTime now)
    {
        // Cheap safety valve to keep the map bounded; entries are otherwise refreshed on use
        if (_sessionUsers.Count < 50_000)
            return;

        foreach (var kv in _sessionUsers)
        {
            if (now - kv.Value.SeenAt >= SessionUserTTL)
                _sessionUsers.TryRemove(kv.Key, out _);
        }
    }

    private static string MergeProps(string leftJson, string rightJson)
    {
        if (string.IsNullOrEmpty(rightJson) || rightJson == "{}")
            return leftJson;

        if (string.IsNullOrEmpty(leftJson) || leftJson == "{}")
            return rightJson;

        try
        {
            var merged = new Dictionary<string, JsonElement>();
            using var left = JsonDocument.Parse(leftJson);
            foreach (var prop in left.RootElement.EnumerateObject())
                merged[prop.Name] = prop.Value.Clone();
            using var right = JsonDocument.Parse(rightJson);
            foreach (var prop in right.RootElement.EnumerateObject())
                merged[prop.Name] = prop.Value.Clone();
            return JsonSerializer.Serialize(merged);
        }
        catch
        {
            return rightJson;
        }
    }

    // "name" sent as an empty string means the user wants the name removed
    private static bool HasEmptyName(string propsJson)
    {
        if (string.IsNullOrEmpty(propsJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(propsJson);
            return doc.RootElement.TryGetProperty("name", out var name)
                && name.ValueKind == JsonValueKind.String
                && string.IsNullOrWhiteSpace(name.GetString());
        }
        catch
        {
            return false;
        }
    }

    private static string? ExtractName(string propsJson)
    {
        if (string.IsNullOrEmpty(propsJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(propsJson);
            if (doc.RootElement.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
            {
                var value = name.GetString();
                return string.IsNullOrWhiteSpace(value) ? null : value;
            }
        }
        catch { }

        return null;
    }
}
