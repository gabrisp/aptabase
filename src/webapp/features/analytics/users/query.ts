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

export type AppUserEvent = {
  timestamp: string;
  eventName: string;
  sessionId: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  countryCode: string;
  regionName: string;
  stringProps: string;
  numericProps: string;
};

export type AppUserEventsParams = AppUsersQueryParams & {
  startDate?: string;
  endDate?: string;
  eventName?: string;
  before?: string;
  limit?: number;
};

export function listAppUserEvents(params: AppUserEventsParams): Promise<AppUserEvent[]> {
  const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ""));
  return api.get<AppUserEvent[]>(`/_app-users/events`, cleanParams);
}

export function parseUserProps(props: string): Record<string, string> {
  try {
    const parsed = JSON.parse(props || "{}");
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
  } catch {
    return {};
  }
}
