import { api } from "@fns/api";
import { trackEvent } from "@aptabase/web";

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export async function requestSignInLink(email: string): Promise<boolean> {
  const [status, response] = await api.fetch("POST", "/_auth/signin", {
    email,
  });

  if (status === 404) return false;
  if (status === 200) return true;

  await api.handleError(status, response);
  return false;
}

export async function requestRegisterLink(name: string, email: string): Promise<void> {
  await api.post("/_auth/register", { name, email });
  trackEvent("register");
}

export type AuthConfig = {
  canSignUp: boolean;
  magicLinksEnabled: boolean;
};

export async function getAuthConfig(): Promise<AuthConfig> {
  return api.get<AuthConfig>("/_auth/config");
}

export async function passwordSignIn(email: string, password: string): Promise<string | null> {
  const [status, response] = await api.fetch("POST", "/_auth/password/signin", { email, password });

  if (status === 200) return null;
  if (status === 401) return "Invalid email or password.";
  if (status === 429) return "Too many attempts. Try again in a few minutes.";

  await api.handleError(status, response);
  return "Something went wrong. Please try again.";
}

export async function passwordRegister(name: string, email: string, password: string): Promise<string | null> {
  const [status, response] = await api.fetch("POST", "/_auth/password/register", { name, email, password });

  if (status === 200) {
    trackEvent("register");
    return null;
  }
  if (status === 403) return "Sign up is disabled on this instance.";
  if (status === 409) return "An account with this email already exists.";
  if (status === 429) return "Too many attempts. Try again in a few minutes.";

  await api.handleError(status, response);
  return "Something went wrong. Please try again.";
}

export async function me(): Promise<UserAccount | null> {
  const [status, account] = await api.fetch("GET", "/_auth/me");

  if (status === 401) return null;

  return account.json() as Promise<UserAccount | null>;
}

export async function signOut(): Promise<void> {
  await api.fetch("POST", "/_auth/signout");
  location.href = "/auth";
}
