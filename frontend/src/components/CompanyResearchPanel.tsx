import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { CompanyBrief, Job } from "../types";
import { taskKey, trackAsyncTask, useAsyncTask } from "../lib/asyncTasks";
import { AiLoadingState } from "./AiLoadingState";
import { Button, Card, ErrorBanner } from "./ui";

interface CompanyResearchPanelProps {
  job: Job;
  onUpdated: (brief: CompanyBrief) => void;
  flat?: boolean;
  onComplete?: () => void;
}

function BulletList({ items, emptyLabel }: { items: string[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return emptyLabel ? <p className="text-sm text-text-muted">{emptyLabel}</p> : null;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-text">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function CompanyResearchPanel({
  job,
  onUpdated,
  flat = false,
  onComplete,
}: CompanyResearchPanelProps) {
  const researchTaskKey = taskKey("research", job.id);
  const researchTask = useAsyncTask(researchTaskKey);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<CompanyBrief | null>(job.company_brief ?? null);
  const loading = researchTask?.status === "running";

  useEffect(() => {
    if (job.company_brief) {
      setBrief(job.company_brief);
    }
  }, [job.id, job.updated_at]);

  async function handleResearch() {
    setError(null);
    try {
      const result = await trackAsyncTask(
        {
          key: researchTaskKey,
          kind: "research",
          jobId: job.id,
          label: `Researching ${job.company}`,
        },
        () => api.jobs.researchCompany(job.id),
      );
      setBrief(result);
      onUpdated(result);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to research company");
    }
  }

  const content = (
    <>
      {error && (
        <div className={flat ? "mb-3" : "mb-4"}>
          <ErrorBanner message={error} />
        </div>
      )}

      {!brief && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Search the web for culture, recent news, and interview signals about {job.company}.
            Results are grounded in search snippets with source links.
          </p>
          <Button onClick={handleResearch}>Research company</Button>
        </div>
      )}

      {loading && <AiLoadingState variant="company-research" size="md" />}

      {brief && !loading && (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-text">{brief.summary}</p>

          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              Culture
            </h4>
            <BulletList items={brief.culture_signals} emptyLabel="No culture signals found." />
          </section>

          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              Recent news
            </h4>
            <BulletList items={brief.recent_news} emptyLabel="No recent news found." />
          </section>

          <section>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              Interview prep
            </h4>
            <BulletList items={brief.interview_signals} emptyLabel="No interview signals found." />
          </section>

          {brief.red_flags.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-warning">
                Red flags
              </h4>
              <BulletList items={brief.red_flags} />
            </section>
          )}

          {brief.sources.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                Sources
              </h4>
              <ul className="space-y-2 text-sm">
                {brief.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      {source.title}
                    </a>
                    <p className="text-text-muted">{source.snippet}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleResearch} loading={loading}>
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (flat) {
    return <div>{content}</div>;
  }

  return (
    <Card
      title="Company research"
      description="Agent-guided web search → synthesize brief with sources"
    >
      {content}
    </Card>
  );
}
