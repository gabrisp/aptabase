import { Button } from "@components/Button";
import { ErrorState } from "@components/ErrorState";
import { LoadingState } from "@components/LoadingState";
import { TextInput } from "@components/TextInput";
import { formatDate, formatTime } from "@fns/format-date";
import { IconClick } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppUserEvent, listAppUserEvents } from "./query";

const EVENTS_PAGE_SIZE = 50;

type Props = {
  appId: string;
  buildMode: "release" | "debug";
  userId: string;
};

function formatProps(event: AppUserEvent): string {
  try {
    const props = { ...JSON.parse(event.stringProps || "{}"), ...JSON.parse(event.numericProps || "{}") };
    const entries = Object.entries(props).filter(([key]) => key !== "user_id");
    if (entries.length === 0) return "";
    return entries.map(([key, value]) => `${key}: ${value}`).join(" · ");
  } catch {
    return "";
  }
}

export function AppUserEventsList(props: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["app-user-events", props.appId, props.buildMode, props.userId, startDate, endDate],
    queryFn: ({ pageParam }) =>
      listAppUserEvents({
        appId: props.appId,
        buildMode: props.buildMode,
        userId: props.userId,
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
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <IconClick className="text-muted-foreground h-5 w-5" />
          Events
        </h2>
        <div className="flex items-center gap-2">
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
      </div>

      {isLoading ? (
        <div className="h-40">
          <LoadingState />
        </div>
      ) : isError ? (
        <div className="h-40">
          <ErrorState refetch={refetch} />
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No events found for this period.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {events.map((event, index) => {
              const eventProps = formatProps(event);
              return (
                <li key={`${event.timestamp}-${index}`} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{event.eventName}</p>
                    {eventProps && <p className="text-xs text-muted-foreground truncate">{eventProps}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm whitespace-nowrap">{`${formatDate(event.timestamp)} ${formatTime(
                      event.timestamp
                    )}`}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {event.osName} {event.osVersion}
                      {event.appVersion && ` · v${event.appVersion}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasNextPage && (
            <div className="flex justify-center mt-4">
              <Button variant="ghost" type="button" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
