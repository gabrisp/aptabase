import { trackEvent } from "@aptabase/web";
import { Page, PageHeading } from "@components/Page";
import { useApps, useCurrentApp } from "@features/apps";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { EventsFeedList } from "./events/EventsFeedList";
import { BuildModeSelector } from "./mode/BuildModeSelector";
import { DebugModeBanner } from "./mode/DebugModeBanner";

Component.displayName = "EventsPage";
export function Component() {
  const app = useCurrentApp();
  const { buildMode } = useApps();

  useEffect(() => {
    trackEvent("events_viewed");
  }, []);

  if (!app) return <Navigate to="/" />;

  return (
    <Page title="Events">
      {buildMode === "debug" && <DebugModeBanner />}
      <div className="flex justify-between items-center">
        <PageHeading title="Events" subtitle="Raw feed of incoming events" />
        <div className="flex items-center">
          <BuildModeSelector />
        </div>
      </div>

      <div className="mt-4">
        <EventsFeedList appId={app.id} buildMode={buildMode} />
      </div>
    </Page>
  );
}
