import { createContext, useContext, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { PageLoader } from "./AiLoadingState";
import { BackendUnreachable } from "./BackendUnreachable";
import { PipelineSyncProvider } from "../hooks/PipelineSyncContext";
import { useActiveProfile } from "../hooks/useActiveProfile";
import type { Profile } from "../types";

interface ProfileRouteContextValue {
  profile: Profile;
  setProfile: (profile: Profile) => void;
}

const ProfileRouteContext = createContext<ProfileRouteContextValue | null>(null);

function ProfileRouteShell({
  profile,
  setProfile,
}: ProfileRouteContextValue) {
  const value = useMemo(() => ({ profile, setProfile }), [profile, setProfile]);

  return (
    <ProfileRouteContext.Provider value={value}>
      <PipelineSyncProvider profileId={profile.id}>
        <Outlet />
      </PipelineSyncProvider>
    </ProfileRouteContext.Provider>
  );
}

/** Redirects to welcome when no profile; provides profile to nested routes. */
export function RequireProfileLayout() {
  const { profile, setProfile, loading, unreachable, unauthorized, retry, requireProfile } =
    useActiveProfile();
  const blocked = unreachable || unauthorized;

  useEffect(() => {
    // Only send someone to onboarding when the backend actually answered, and answered
    // us. Otherwise onboarding cannot succeed and the redirect hides the real problem.
    if (!loading && !profile && !blocked) {
      requireProfile();
    }
  }, [loading, profile, blocked, requireProfile]);

  if (!loading && blocked) {
    return (
      <BackendUnreachable
        onRetry={retry}
        reason={unauthorized ? "unauthorized" : "unreachable"}
      />
    );
  }

  if (loading || !profile) {
    return <PageLoader variant="page" />;
  }

  return <ProfileRouteShell profile={profile} setProfile={setProfile} />;
}

export function useProfileRoute(): ProfileRouteContextValue {
  const context = useContext(ProfileRouteContext);
  if (!context) {
    throw new Error("useProfileRoute must be used within RequireProfileLayout");
  }
  return context;
}
