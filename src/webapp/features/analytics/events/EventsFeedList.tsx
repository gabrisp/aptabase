import { Button } from "@components/Button";
import { EmptyState } from "@components/EmptyState";
import { ErrorState } from "@components/ErrorState";
import { LoadingState } from "@components/LoadingState";
import { TextInput } from "@components/TextInput";
import { formatDate, formatTime } from "@fns/format-date";
import { IconClick, IconClock, IconDeviceDesktop, IconDevices, IconUser } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EventNameFilterDropdown } from "../sessions/filters/EventNameFilterDropdown";
import { EventFeedRow, eventsFeed } from "../query";

const EVENTS_PAGE_SIZE = 50;

type Props = {
  appId: string;
  buildMode: "release" | "debug";
};

function formatProps(event: EventFeedRow): string {
  try {
    const props = { ...JSON.parse(event.stringProps || "{}"), ...JSON.parse(event.numericProps || "{}") };
    const entries = Object.entries(props);
    if (entries.length === 0) return "";
    return entries.map(([key, value]) => `${key}: ${value}`).join(" · ");
  } catch {
    return "";
  }
}

export function EventsFeedList(props: Props) {
  const [eventName, setEventName] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
        <div className="flow-root">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full py-2 align-middle">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6 lg:pl-8">
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
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Props</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {events.map((event, index) => (
                    <tr key={`${event.timestamp}-${index}`}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6 lg:pl-8">
                        {`${formatDate(event.timestamp)} ${formatTime(event.timestamp)}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">{event.eventName}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {event.appUserId ? (
                          <Link
                            to={`/${props.appId}/users/${encodeURIComponent(event.appUserId)}`}
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
                      <td className="px-3 py-4 text-sm text-muted-foreground max-w-xs truncate">
                        {formatProps(event)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasNextPage && (
                <div className="flex justify-center mt-4">
                  <Button variant="ghost" type="button" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
