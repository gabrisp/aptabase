import { api } from "@fns/api";

export type AppUser = {
  userId: string;
  name: string | null;
  props: string;
  firstSeen: string;
  lastSeen: string;
  lastEventName: string;
};

export type AppUsersQueryParams = {
  appId: string;
  buildMode: "release" | "debug";
  search?: string;
  userId?: string;
};

export function listAppUsers(params: AppUsersQueryParams): Promise<AppUser[]> {
  return api.get<AppUser[]>(`/_app-users`, params);
}

export function getAppUser(params: AppUsersQueryParams): Promise<AppUser> {
  return api.get<AppUser>(`/_app-users/single`, params);
}

export function parseUserProps(props: string): Record<string, string> {
  try {
    const parsed = JSON.parse(props || "{}");
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
  } catch {
    return {};
  }
}
