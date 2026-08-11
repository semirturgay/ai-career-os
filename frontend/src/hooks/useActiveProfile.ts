import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type { Profile } from "../types";
import { getActiveProfileId, setActiveProfileId } from "../lib/profile";

export function useActiveProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // A dead backend and a brand-new install both leave `profile` null. Tracking this
  // separately is what stops us walking someone into onboarding that cannot succeed.
  const [unreachable, setUnreachable] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const profiles = await api.profiles.list();
        if (cancelled) return;
        setUnreachable(false);
        if (profiles.length === 0) {
          setProfile(null);
          return;
        }
        const activeId = getActiveProfileId();
        const active = profiles.find((p) => p.id === activeId) ?? profiles[0];
        setActiveProfileId(active.id);
        setProfile(active);
      } catch (err) {
        if (cancelled) return;
        // ApiError carries an HTTP status; its absence means the request never landed,
        // i.e. the backend is not running or the API URL is wrong.
        setUnreachable(!(err instanceof ApiError) || err.status === 0);
        setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const retry = () => setReloadToken((n) => n + 1);

  function requireProfile() {
    if (!loading && !profile) {
      navigate("/welcome", { replace: true });
      return false;
    }
    return true;
  }

  return { profile, setProfile, loading, unreachable, retry, requireProfile };
}
