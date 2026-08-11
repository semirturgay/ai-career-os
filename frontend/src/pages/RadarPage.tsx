import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageLoader } from "../components/AiLoadingState";
import { AddCompanyForm } from "../components/AddCompanyForm";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { Layout } from "../components/Layout";
import { PostingFeed } from "../components/PostingFeed";
import { RadarTargetBar } from "../components/RadarTargetBar";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { WatchedCompanyList } from "../components/WatchedCompanyList";
import { ErrorBanner } from "../components/ui";
import { api } from "../api/client";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { useRadar } from "../hooks/useRadar";
import type { ResolvedBoard, WatchedCompany } from "../types/radar";

export function RadarPage() {
  const navigate = useNavigate();
  const { profile, setProfile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const {
    companies,
    postings,
    loading,
    error,
    refresh,
    resolve,
    addCompany,
    updateCompany,
    removeCompany,
    pollCompany,
    promotePosting,
    dismissPosting,
    pollingCompanyId,
  } = useRadar(profile.id);

  const [actionError, setActionError] = useState<string | null>(null);

  const handleConfirm = useCallback(
    async (board: ResolvedBoard) => {
      await addCompany({
        name: board.name,
        ats_provider: board.ats_provider,
        ats_token: board.ats_token,
        board_url: board.board_url,
      });
    },
    [addCompany],
  );

  const handlePoll = useCallback(
    async (companyId: string) => {
      setActionError(null);
      try {
        const result = await pollCompany(companyId);
        if (result.error) setActionError(result.error);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Check failed");
      }
    },
    [pollCompany],
  );

  const handleTogglePaused = useCallback(
    async (company: WatchedCompany) => {
      await updateCompany(company.id, {
        status: company.status === "paused" ? "active" : "paused",
      });
    },
    [updateCompany],
  );

  const handleRemove = useCallback(
    async (company: WatchedCompany) => {
      await removeCompany(company.id);
    },
    [removeCompany],
  );

  const handleSaveTarget = useCallback(
    async (target: string) => {
      setActionError(null);
      const result = await api.radar.setTarget(profile.id, target);
      setProfile({ ...profile, radar_target: result.radar_target });
      // The backend clears un-promoted postings and re-polls, so the feed briefly
      // empties before the fresh, on-target results land.
      await refresh();
    },
    [profile, setProfile, refresh],
  );

  const handlePromote = useCallback(
    async (postingId: string) => {
      setActionError(null);
      try {
        const jobId = await promotePosting(postingId);
        navigate(`/jobs/${jobId}`);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not add that role");
      }
    },
    [navigate, promotePosting],
  );

  const subtitle = useMemo(() => {
    if (companies.length === 0) return "Watch companies you'd want to work at";
    const plural = companies.length === 1 ? "company" : "companies";
    return postings.length > 0
      ? `${postings.length} to review · ${companies.length} ${plural}`
      : `${companies.length} ${plural} on your radar`;
  }, [companies.length, postings.length]);

  const heading = embedded ? "text-base" : "text-lg";

  if (loading) {
    return (
      <Layout title="Radar" subtitle="Watch companies you'd want to work at">
        <PageLoader variant="page" />
      </Layout>
    );
  }

  return (
    <Layout title="Radar" subtitle={subtitle}>
      <div className="space-y-6">
        {error && <ErrorBanner message={error} />}
        {actionError && <ErrorBanner message={actionError} />}

        <RadarTargetBar
          target={profile.radar_target}
          headline={profile.headline}
          compact={embedded}
          onSave={handleSaveTarget}
        />

        {companies.length === 0 ? (
          <section className="min-w-0 space-y-3">
            <div>
              <h3 className={`font-semibold ${heading}`}>Put a company on your radar</h3>
              <p className="text-xs text-text-muted sm:text-sm">
                We'll watch its careers page and tell you when it posts a role that fits you.
              </p>
            </div>
            <AddCompanyForm onResolve={resolve} onConfirm={handleConfirm} />
          </section>
        ) : (
          <>
            {postings.length > 0 && (
              <section className="min-w-0 space-y-3">
                <div>
                  <h3 className={`font-semibold ${heading}`}>New postings</h3>
                  <p className="text-xs text-text-muted sm:text-sm">
                    Screened against your profile — add one for a full match analysis
                  </p>
                </div>
                <PostingFeed
                  postings={postings}
                  compact={embedded}
                  onPromote={handlePromote}
                  onDismiss={dismissPosting}
                />
              </section>
            )}

            <section className="min-w-0 space-y-3">
              <h3 className={`font-semibold ${heading}`}>Watching</h3>
              <WatchedCompanyList
                companies={companies}
                compact={embedded}
                pollingCompanyId={pollingCompanyId}
                onPoll={handlePoll}
                onTogglePaused={handleTogglePaused}
                onRemove={handleRemove}
              />
            </section>

            <CollapsibleSection title="Add another company">
              <AddCompanyForm onResolve={resolve} onConfirm={handleConfirm} />
            </CollapsibleSection>
          </>
        )}
      </div>
    </Layout>
  );
}
