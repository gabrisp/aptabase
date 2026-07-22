import { EmptyState } from "@components/EmptyState";
import { ErrorState } from "@components/ErrorState";
import { LoadingState } from "@components/LoadingState";
import { TextInput } from "@components/TextInput";
import { formatDate, formatTime } from "@fns/format-date";
import { IconCalendar, IconClick, IconClock, IconIdBadge2, IconUser } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAppUsers } from "./query";

type Props = {
  appId: string;
  buildMode: "release" | "debug";
};

export function AppUsersList(props: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["app-users", props.appId, props.buildMode, search],
    queryFn: () => listAppUsers({ appId: props.appId, buildMode: props.buildMode, search }),
    placeholderData: keepPreviousData,
  });

  const users = data ?? [];

  return (
    <div className="flex flex-col space-y-4">
      <div className="max-w-xs">
        <TextInput
          placeholder="Search by user id or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="h-64">
          <LoadingState />
        </div>
      ) : isError ? (
        <div className="h-64">
          <ErrorState refetch={refetch} />
        </div>
      ) : users.length === 0 ? (
        <div className="h-64">
          <EmptyState />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-full relative">
              <table className={`min-w-full divide-y divide-border ${isPlaceholderData ? "opacity-50" : ""}`}>
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6 lg:pl-8">
                      <div className="flex items-center gap-2">
                        <IconIdBadge2 className="text-muted-foreground h-5 w-5" />
                        User ID
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <IconUser className="text-muted-foreground h-5 w-5" />
                        Name
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <IconClick className="text-muted-foreground h-5 w-5" />
                        Last Event
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <IconClock className="text-muted-foreground h-5 w-5" />
                        Last Seen
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <IconCalendar className="text-muted-foreground h-5 w-5" />
                        First Seen
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr
                      key={user.userId}
                      onClick={() => navigate(`/${props.appId}/users/${encodeURIComponent(user.userId)}`)}
                      className="hover:bg-accent cursor-pointer"
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-6 lg:pl-8">
                        {user.userId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {user.name || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">{user.lastEventName}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {`${formatDate(user.lastSeen)} ${formatTime(user.lastSeen)}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {`${formatDate(user.firstSeen)} ${formatTime(user.firstSeen)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
