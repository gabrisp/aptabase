import { trackEvent } from "@aptabase/web";
import { Page, PageHeading } from "@components/Page";
import { AppUsersList } from "@features/analytics/users/AppUsersList";
import { useApps, useCurrentApp } from "@features/apps";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { BuildModeSelector } from "./mode/BuildModeSelector";
import { DebugModeBanner } from "./mode/DebugModeBanner";

Component.displayName = "UsersPage";
export function Component() {
  const app = useCurrentApp();
  const { buildMode } = useApps();

  if (!app) return <Navigate to="/" />;

  useEffect(() => {
    trackEvent("users_viewed");
  }, []);

  return (
    <Page title="Users">
      {buildMode === "debug" && <DebugModeBanner />}
      <div className="flex justify-between items-center">
        <PageHeading title="Users" subtitle="Identified users of your application" />
        <div className="flex items-center">
          <BuildModeSelector />
        </div>
      </div>

      <div className="mt-4">
        <AppUsersList appId={app.id} buildMode={buildMode} />
      </div>
    </Page>
  );
}
