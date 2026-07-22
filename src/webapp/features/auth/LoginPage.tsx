import { Button } from "@components/Button";
import { Page } from "@components/Page";
import { getAuthConfig, passwordSignIn } from "@features/auth";
import { isOAuthEnabled } from "@features/env";
import { TextInput } from "@components/TextInput";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataResidency } from "./DataResidency";
import { LegalNotice } from "./LegalNotice";
import { Logo } from "./Logo";
import { RegionSwitch } from "./RegionSwitch";
import { SignInWithGitHub } from "./SignInWithGitHub";
import { SignInWithGoogle } from "./SignInWithGoogle";

Component.displayName = "LoginPage";
export function Component() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canSignUp, setCanSignUp] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then((config) => setCanSignUp(config.canSignUp))
      .catch(() => setCanSignUp(false));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const errorMessage = await passwordSignIn(email, password);
    if (errorMessage) {
      setError(errorMessage);
      setLoading(false);
      return;
    }

    location.href = "/";
  };

  return (
    <Page title="Login">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Logo className="mx-auto h-12 w-auto text-primary" />
        <h2 className="text-center text-3xl text-foreground font-bold">Sign in to your account</h2>
        <DataResidency />
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="py-8 px-4 sm:rounded-lg sm:px-10">
          {isOAuthEnabled && (
            <>
              <div className="space-y-2">
                <SignInWithGitHub />
                <SignInWithGoogle />
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-muted">OR</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <TextInput
              label="Email address"
              name="email"
              type="email"
              placeholder="peter.parker@corp.com"
              autoComplete="email"
              value={email}
              required={true}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              required={true}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button loading={loading}>Sign in</Button>
            <p className="text-center text-sm h-10 text-muted-foreground">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : canSignUp ? (
                <span className="block">
                  Don't have an account?{" "}
                  <Link className="font-semibold text-foreground" to="/auth/register">
                    Sign up
                  </Link>
                  .
                </span>
              ) : null}
            </p>
          </form>
        </div>
        <LegalNotice operation="signin" />
        <RegionSwitch />
      </div>
    </Page>
  );
}
