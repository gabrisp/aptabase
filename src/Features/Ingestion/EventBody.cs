using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Aptabase.Features.Ingestion;

public class SystemProperties
{
    public bool IsDebug { get; set; }

    [StringLength(30)]
    public string? OSName { get; set; }

    [StringLength(100)]
    public string? OSVersion { get; set; }

    [StringLength(10)]
    public string? Locale { get; set; }

    [StringLength(50)]
    public string? AppVersion { get; set; }

    [StringLength(20)]
    public string? AppBuildNumber { get; set; }

    [StringLength(30)]
    public string? EngineName { get; set; }

    [StringLength(30)]
    public string? EngineVersion { get; set; }

    [Required, StringLength(40)]
    public string SdkVersion { get; set; } = "";

    [StringLength(100)]
    public string? DeviceModel { get; set; }
}

public class EventBody
{
    [Required, StringLength(60)]
    public string EventName { get; set; } = "";

    private DateTime _ts;
    public DateTime Timestamp
    {
        get => _ts;
        set => _ts = value > DateTime.UtcNow ? DateTime.UtcNow : value;
    }

    [Required]
    public string SessionId { get; set; } = "";

    // Optional application-provided user identifier (e.g. your own user id or email)
    [StringLength(100)]
    public string? UserId { get; set; }

    // Optional user attributes (e.g. name), only used when UserId is present
    public JsonDocument? UserProps { get; set; }

    public SystemProperties SystemProps { get; set; } = new();
    public JsonDocument? Props { get; set; }

    // Resolves the application-provided user identity for this event.
    // Preferred source is the top-level UserId/UserProps fields, but official SDKs
    // can't send those, so we also accept reserved event props:
    //   user_id   -> the user identifier
    //   user_name -> stored as the "name" attribute
    //   user_*    -> stored as an attribute without the "user_" prefix
    public (string UserId, string UserPropsJson) ExtractUserIdentity(JsonObject stringProps, JsonObject numericProps)
    {
        if (!string.IsNullOrWhiteSpace(UserId))
            return (UserId.Trim(), GetUserPropsJson());

        var userId = stringProps["user_id"]?.GetValue<string>()?.Trim();
        if (string.IsNullOrEmpty(userId) && numericProps["user_id"] is JsonNode numericUserId)
            userId = numericUserId.GetValue<decimal>().ToString();

        // user_* attributes are collected even without a user_id:
        // the event may still be attributed to a user by its session
        var props = new JsonObject();
        CollectUserProps(stringProps, props);
        CollectUserProps(numericProps, props);

        return (userId?.Truncate(100, "") ?? "", props.ToJsonString());
    }

    private static void CollectUserProps(JsonObject source, JsonObject target)
    {
        foreach (var kv in source)
        {
            if (kv.Key == "user_id" || !kv.Key.StartsWith("user_", StringComparison.OrdinalIgnoreCase))
                continue;

            var name = kv.Key.Equals("user_name", StringComparison.OrdinalIgnoreCase) ? "name" : kv.Key["user_".Length..];
            if (name.Length > 0)
                target[name] = kv.Value?.DeepClone();
        }
    }

    public string GetUserPropsJson()
    {
        if (string.IsNullOrWhiteSpace(UserId) || UserProps is null || UserProps.RootElement.ValueKind != JsonValueKind.Object)
            return "{}";

        var values = new JsonObject();
        foreach (var property in UserProps.RootElement.EnumerateObject().OrderBy(x => x.Name))
        {
            switch (property.Value.ValueKind)
            {
                case JsonValueKind.String:
                    values[property.Name] = (property.Value.GetString() ?? "").Truncate(180, "...");
                    break;
                case JsonValueKind.Number:
                    values[property.Name] = property.Value.GetDecimal();
                    break;
                case JsonValueKind.True:
                    values[property.Name] = "true";
                    break;
                case JsonValueKind.False:
                    values[property.Name] = "false";
                    break;
            }
        }

        return values.ToJsonString();
    }

    public (JsonObject, JsonObject) SplitProps()
    {
        var stringValues = new JsonObject();
        var numericValues = new JsonObject();

        if (Props != null && Props.RootElement.ValueKind != JsonValueKind.Null)
        {
            // Sort by key to ensure consistent order might be useful in future!
            foreach (var property in Props.RootElement.EnumerateObject().OrderBy(x => x.Name))
            {
                if (property.Value.ValueKind == JsonValueKind.Number)
                    numericValues.Add(property.Name, property.Value.GetDecimal());
                else if (property.Value.ValueKind == JsonValueKind.String)
                {
                    var propertyValue = property.Value.GetString() ?? "";
                    stringValues.Add(property.Name, propertyValue.Truncate(180, "..."));
                }
                else if (property.Value.ValueKind == JsonValueKind.True)
                    stringValues.Add(property.Name, "true");
                else if (property.Value.ValueKind == JsonValueKind.False)
                    stringValues.Add(property.Name, "false");
                else if (property.Value.ValueKind == JsonValueKind.Array)
                    stringValues.Add(property.Name, "[Array]");
                else if (property.Value.ValueKind == JsonValueKind.Object)
                    stringValues.Add(property.Name, "{Object}");
                else if (property.Value.ValueKind == JsonValueKind.Null)
                    stringValues.Add(property.Name, "");
                else if (property.Value.ValueKind == JsonValueKind.Undefined)
                    stringValues.Add(property.Name, "");
            }
        }

        return (stringValues, numericValues);
    }

    public (bool, string) IsValid(ILogger logger)
    {
        var (valid, msg) = ValidateSessionId(logger);
        if (!valid)
            return (false, msg);

        if (Timestamp > DateTime.UtcNow.AddMinutes(10))
            return (false, "Future events are not allowed.");

        if (Timestamp < DateTime.UtcNow.AddDays(-1))
        {
            logger.LogWarning("Event timestamp {EventTimestamp} is too old.", Timestamp);
            return (false, "Event is too old.");
        }

        var locale = LocaleFormatter.FormatLocale(SystemProps.Locale);
        if (locale is null)
            logger.LogWarning("Invalid locale {Locale} received from {OS} using {SdkVersion}", locale, SystemProps.OSName, SystemProps.SdkVersion);

        SystemProps.Locale = locale;

        (valid, msg) = ValidateProps();
        if (!valid)
            return (false, msg);

        (valid, msg) = ValidateUserProps();
        if (!valid)
            return (false, msg);

        return (true, string.Empty);
    }

    private (bool, string) ValidateUserProps()
    {
        if (UserProps is null || UserProps.RootElement.ValueKind == JsonValueKind.Null)
            return (true, string.Empty);

        if (UserProps.RootElement.ValueKind != JsonValueKind.Object)
            return (false, $"UserProps must be an object, was: {UserProps.RootElement.GetRawText()}");

        foreach (var prop in UserProps.RootElement.EnumerateObject())
        {
            if (string.IsNullOrWhiteSpace(prop.Name))
                return (false, "UserProps key must not be empty.");

            if (prop.Name.Length > 40)
                return (false, $"UserProps key '{prop.Name}' must be less than or equal to 40 characters.");
        }

        return (true, string.Empty);
    }

    private (bool, string) ValidateSessionId(ILogger logger)
    {
        if (ulong.TryParse(SessionId, out var numericSessionId))
            return ValidateNumericSessionId(numericSessionId, logger);
        
        if (SessionId.Length > 36)
            return (false, $"SessionId must be less than or equal to 36 characters, was: {SessionId}");

        return (true, string.Empty);
    }

    private (bool, string) ValidateNumericSessionId(ulong id, ILogger logger)
    {
        var secondsSinceEpoch = id / 100_000_000;
        var sessionStartedAt = DateTimeOffset.FromUnixTimeSeconds((long)secondsSinceEpoch).UtcDateTime;

        if (sessionStartedAt > DateTime.UtcNow.AddMinutes(10))
        {
            logger.LogWarning("Session {SessionId} timestamp {StartedAt} is in future, received from {SdkVersion}.", id, sessionStartedAt, SystemProps.SdkVersion);
            return (false, "Future sessions are not allowed.");
        }

        if (sessionStartedAt < DateTime.UtcNow.AddDays(-7))
        {
            logger.LogWarning("Session {SessionId} timestamp {StartedAt} is too old, received from {SdkVersion}.", id, sessionStartedAt, SystemProps.SdkVersion);
            return (false, "Session is too old.");
        }

        return (true, string.Empty);
    }

    private (bool, string) ValidateProps()
    {
        if (Props is not null)
        {
            if (Props.RootElement.ValueKind == JsonValueKind.Null)
                return (true, string.Empty); // null is allowed

            if (Props.RootElement.ValueKind == JsonValueKind.String)
            {
                var valueAsString = Props.RootElement.GetString() ?? "";
                if (TryParseDocument(valueAsString, out var doc) && doc is not null)
                    Props = doc;
                else 
                    return (false, $"Props must be an object or a valid stringified JSON, was: {Props.RootElement.GetRawText()}");
            }

            if (Props.RootElement.ValueKind != JsonValueKind.Object)
                return (false, $"Props must be an object or a valid stringified JSON, was: {Props.RootElement.GetRawText()}");

            foreach (var prop in Props.RootElement.EnumerateObject())
            {
                if (string.IsNullOrWhiteSpace(prop.Name))
                    return (false, "Property key must not be empty.");

                if (prop.Name.Length > 40)
                    return (false, $"Property key '{prop.Name}' must be less than or equal to 40 characters. Props was: {Props.RootElement.GetRawText()}");
            }
        }

        return (true, string.Empty);
    }

    private static bool TryParseDocument(string json, out JsonDocument? doc)
    {
        try
        {
            doc = JsonDocument.Parse(json);
            return true;
        }
        catch
        {
            doc = null;
            return false;
        }
    }
}