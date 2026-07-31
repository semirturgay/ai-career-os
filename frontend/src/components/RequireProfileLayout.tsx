import { createContext, useContext, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { PageLoader } from "./AiLoadingState";
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
  const { profile, setProfile, loading, requireProfile } = useActiveProfile();

  useEffect(() => {
    if (!loading && !profile) {
      requireProfile();
    }
  }, [loading, profile, requireProfile]);

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
