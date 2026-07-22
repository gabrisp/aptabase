import { Button } from "@components/Button";
import { EmptyState } from "@components/EmptyState";
import { ErrorState } from "@components/ErrorState";
import { LoadingState } from "@components/LoadingState";
import { TextInput } from "@components/TextInput";
import { CountryFlag, CountryName } from "@features/geo";
import { formatDate, formatTime } from "@fns/format-date";
import { IconChevronDown, IconChevronRight, IconClick, IconClock, IconDeviceDesktop, IconDevices, IconUser } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { EventNameFilterDropdown } from "../sessions/filters/EventNameFilterDropdown";
import { EventFeedRow, eventsFeed } from "../query";

const EVENTS_PAGE_SIZE = 50;

type Props = {
  appId: string;
  buildMode: "release" | "debug";
};

function propEntries(event: EventFeedRow): [string, unknown][] {
  try {
    const props = { ...JSON.parse(event.stringProps || "{}"), ...JSON.parse(event.numericProps || "{}") };
    return Object.entries(props);
  } catch {
    return [];
  }
}

export function EventsFeedList(props: Props) {
  const [eventName, setEventName] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["events-feed", props.appId, props.buildMode, eventName, startDate, endDate],
    queryFn: ({ pageParam }) =>
      eventsFeed({
        appId: props.appId,
        buildMode: props.buildMode,
        eventName,
        startDate: startDate ? `${startDate}T00:00:00` : undefined,
        endDate: endDate ? `${endDate}T23:59:59` : undefined,
        before: pageParam,
        limit: EVENTS_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === EVENTS_PAGE_SIZE ? lastPage[lastPage.length - 1].timestamp : undefined,
  });

  const events = data?.pages.flat() ?? [];

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <EventNameFilterDropdown
          appId={props.appId}
          localPersistence={true}
          onValueChange={(value) => setEventName(value)}
        />
        <TextInput label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <TextInput label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="h-64">
          <LoadingState />
        </div>
      ) : isError ? (
        <div className="h-64">
          <ErrorState refetch={refetch} />
        </div>
      ) : events.length === 0 ? (
        <div className="h-64">
          <EmptyState />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="w-8 py-3.5 pl-4 pr-0" />
                  <th scope="col" className="py-3.5 pl-2 pr-3 text-left text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <IconClock className="text-muted-foreground h-5 w-5" />
                      Timestamp
                    </div>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <IconClick className="text-muted-foreground h-5 w-5" />
                      Event
                    </div>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <IconUser className="text-muted-foreground h-5 w-5" />
                      User
                    </div>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <IconDeviceDesktop className="text-muted-foreground h-5 w-5" />
                      OS
                    </div>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <IconDevices className="text-muted-foreground h-5 w-5" />
                      Version
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event, index) => {
                  const isExpanded = expandedRow === index;
                  const entries = propEntries(event);
                  return (
                    <Fragment key={`${event.timestamp}-${index}`}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : index)}
                        className="hover:bg-accent cursor-pointer"
                      >
                        <td className="py-4 pl-4 pr-0 text-muted-foreground">
                          {isExpanded ? (
                            <IconChevronDown className="h-4 w-4" />
                          ) : (
                            <IconChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-2 pr-3 text-sm">
                          {`${formatDate(event.timestamp)} ${formatTime(event.timestamp)}`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">{event.eventName}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {event.appUserId ? (
                            <Link
                              to={`/${props.appId}/users/${encodeURIComponent(event.appUserId)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-foreground font-medium hover:underline"
                            >
                              {event.appUserId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {event.osName} {event.osVersion}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">{event.appVersion}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-muted/30">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs mb-1">Location</p>
                                <div className="flex items-center gap-2">
                                  <CountryFlag countryCode={event.countryCode} />
                                  <span>
                                    {event.regionName && `${event.regionName} · `}
                                    <CountryName countryCode={event.countryCode} />
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs mb-1">Session</p>
                                <p className="truncate">{event.sessionId}</p>
                              </div>
                              {event.appUserId && (
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">User</p>
                                  <Link
                                    to={`/${props.appId}/users/${encodeURIComponent(event.appUserId)}`}
                                    className="text-foreground font-medium hover:underline"
                                  >
                                    {event.appUserId} →
                                  </Link>
                                </div>
                              )}
                              <div className="sm:col-span-2 lg:col-span-3">
                                <p className="text-muted-foreground text-xs mb-1">Props</p>
                                {entries.length === 0 ? (
                                  <p className="text-muted-foreground">No props</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {entries.map(([key, value]) => (
                                      <span key={key} className="rounded-md border bg-background px-2 py-1 text-xs">
                                        <span className="text-muted-foreground">{key}:</span> {String(value)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasNextPage && (
            <div className="flex justify-center py-3 border-t border-border">
              <Button variant="ghost" type="button" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
