

using System.Diagnostics;
using Aptabase.Features.AppUsers;
using Aptabase.Features.Privacy;

namespace Aptabase.Features.Ingestion.Buffer;

public class EventBackgroundWritter : BackgroundService
{
    private readonly IEventBuffer _buffer;
    private readonly IIngestionClient _client;
    private readonly ILogger _logger;
    private readonly IUserHasher _hasher;
    private readonly IAppUserService _appUsers;
    private readonly Stopwatch _watch = new();

    public EventBackgroundWritter(IEventBuffer buffer, IUserHasher hasher, IIngestionClient client, IAppUserService appUsers, ILogger<EventBackgroundWritter> logger)
    {
        _hasher = hasher ?? throw new ArgumentNullException(nameof(hasher));
        _buffer = buffer ?? throw new ArgumentNullException(nameof(buffer));
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _appUsers = appUsers ?? throw new ArgumentNullException(nameof(appUsers));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("EventBackgroundWritter is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await FlushEvents();
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
            catch { }
        }

        // We need to wait a few seconds when cancellation is requested
        // because some events may be added to the buffer after the cancellation
        // After flushing we can safely exit
        _logger.LogInformation("EventBackgroundWritter is stopping.");
        await Task.Delay(TimeSpan.FromSeconds(2));
        await FlushEvents();
        _logger.LogInformation("EventBackgroundWritter stopped.");
    }

    public int Count() => _buffer.TakeAll().Length;
    
    public async Task FlushEvents()
    {
        var events = _buffer.TakeAll();
        if (events.Length == 0) return;

        // Resolve app user ids up front so both the analytics store and
        // the app_users table see session-attributed events
        var appUserIds = _appUsers.AttributeEvents(events);

        try
        {
            _watch.Restart();

            var rows = await Task.WhenAll(events.Select((e, i) => ToEventRow(e, appUserIds[i])));

            await _client.BulkSendEventAsync(rows);
            _watch.Stop();
            _logger.LogInformation("Flushed {Count} events in {TimeMs}ms.", events.Length, _watch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send events. {Count} events were discarded.", events.Length);
        }

        try
        {
            await _appUsers.UpsertFromEventsAsync(events, appUserIds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upsert app users.");
        }
    }

    private async Task<EventRow> ToEventRow(TrackingEvent e, string appUserId)
    {
        var userId = await _hasher.CalculateHash(e.Timestamp, e.AppId, e.SessionId, e.ClientIpAddress, e.UserAgent);
        return new EventRow(ref e, userId, appUserId);
    }
}