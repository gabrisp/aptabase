import { trackEvent } from "@aptabase/web";
import { Button } from "@components/Button";
import { ErrorState } from "@components/ErrorState";
import { LoadingState } from "@components/LoadingState";
import { Page, PageHeading } from "@components/Page";
import { useApps, useCurrentApp } from "@features/apps";
import { formatDate, formatTime } from "@fns/format-date";
import { IconArrowLeft, IconCalendar, IconClick, IconClock, IconExternalLink, IconUser } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { DebugModeBanner } from "./mode/DebugModeBanner";
import { AppUserEventsList } from "./users/AppUserEventsList";
import { getAppUser, parseUserProps } from "./users/query";

Component.displayName = "UserDetailsPage";
export function Component() {
  const app = useCurrentApp();
  const { buildMode } = useApps();
  const { userId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    trackEvent("user_details_viewed");
  }, []);

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["app-user", app?.id, buildMode, userId],
    queryFn: () => getAppUser({ appId: app?.id ?? "", buildMode, userId: userId ?? "" }),
    enabled: !!app && !!userId,
  });

  // Hooks must all run before any conditional return
  if (!app) return <Navigate to="/" />;
  if (!userId) return <Navigate to={`/${app.id}/users`} />;

  const props = user ? parseUserProps(user.props) : {};
  const attributes = Object.entries(props).filter(([key]) => key !== "name");

  return (
    <Page title={user?.name || userId}>
      {buildMode === "debug" && <DebugModeBanner />}
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate(`/${app.id}/users`)}>
          <IconArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeading title={user?.name || userId} subtitle={user?.name ? userId : undefined} />
      </div>

      {isLoading ? (
        <div className="h-64">
          <LoadingState />
        </div>
      ) : isError || !user ? (
        <div className="h-64">
          <ErrorState refetch={refetch} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <IconClock className="text-muted-foreground h-5 w-5" />
              Activity
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  <IconClock className="h-4 w-4" />
                  Last Seen
                </dt>
                <dd className="text-sm mt-1">{`${formatDate(user.lastSeen)} ${formatTime(user.lastSeen)}`}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  <IconClick className="h-4 w-4" />
                  Last Event
                </dt>
                <dd className="text-sm mt-1">{user.lastEventName || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  First Seen
                </dt>
                <dd className="text-sm mt-1">{`${formatDate(user.firstSeen)} ${formatTime(user.firstSeen)}`}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <IconUser className="text-muted-foreground h-5 w-5" />
                Attributes
              </h2>
              {app.revenueCatProjectId && (
                <a
                  href={`https://app.revenuecat.com/projects/${app.revenueCatProjectId}/customers/${encodeURIComponent(
                    userId
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <IconExternalLink className="h-3.5 w-3.5" />
                  Open in RevenueCat
                </a>
              )}
            </div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-muted-foreground">User ID</dt>
                <dd className="text-sm mt-1 font-medium">{user.userId}</dd>
              </div>
              {user.name && (
                <div>
                  <dt className="text-sm text-muted-foreground">Name</dt>
                  <dd className="text-sm mt-1">{user.name}</dd>
                </div>
              )}
              {attributes.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">{key}</dt>
                  <dd className="text-sm mt-1">{value}</dd>
                </div>
              ))}
              {attributes.length === 0 && !user.name && (
                <p className="text-sm text-muted-foreground">No attributes reported for this user.</p>
              )}
            </dl>
          </div>

          <div className="lg:col-span-2">
            <AppUserEventsList appId={app.id} buildMode={buildMode} userId={userId} />
          </div>
        </div>
      )}
    </Page>
  );
}
