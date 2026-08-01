export interface ExperienceEntry {
  title: string;
  company: string;
  duration?: string | null;
  highlights: string[];
}

export interface EducationEntry {
  degree: string;
  school: string;
  duration?: string | null;
  highlights: string[];
}

export interface ProjectEntry {
  name: string;
  description?: string | null;
  highlights: string[];
}

export interface ResumeStructuredData {
  name: string;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
}

export interface ResumeParseResult {
  name: string | null;
  headline: string | null;
  resume_text: string;
  structured_data: ResumeStructuredData | null;
}

export interface Profile {
  id: string;
  name: string;
  headline: string | null;
  resume_text: string;
  structured_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  url: string | null;
  source: string | null;
  raw_metadata: Record<string, unknown> | null;
  company_brief?: CompanyBrief | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface CompanyBrief {
  company: string;
  summary: string;
  culture_signals: string[];
  recent_news: string[];
  interview_signals: string[];
  red_flags: string[];
  sources: SearchResult[];
  researched_at: string;
}

export interface MatchAnalysis {
  id: string;
  profile_id: string;
  job_id: string;
  status: "pending" | "completed" | "failed";
  result: MatchResult | null;
  error: string | null;
  created_at: string;
}

export interface MatchStrength {
  point: number;
  evidence: string;
}

export interface MatchGap {
  point: number;
  severity: "low" | "medium" | "high";
  evidence: string;
}

export interface MatchResult {
  depth?: "screen" | "full";
  score: number;
  recommendation: "apply" | "maybe apply" | "do not apply";
  reason?: string;
  strengths: MatchStrength[];
  gaps: MatchGap[];
  summary: string;
  retrieved_chunks?: RetrievedChunk[];
}

export interface RetrievedChunk {
  id: string;
  score: number;
  text: string;
  section: string;
}

export interface ResumeSuggestion {
  gap_evidence: string;
  section: "headline" | "skills" | "experience" | "projects";
  action: "rewrite" | "add" | "emphasize";
  target_label: string;
  current_text: string | null;
  suggested_text: string;
  rationale: string;
}

export interface ResumeOptimizationResult {
  summary: string;
  suggestions: ResumeSuggestion[];
}

export interface CoverLetterResult {
  body: string;
  tone: "professional" | "warm" | "concise";
  highlights_used: string[];
  critique_summary: string;
}

export type FeedbackEventType =
  | "match_helpful"
  | "gap_dispute"
  | "strength_confirm"
  | "preference"
  | "application_outcome";

export interface FeedbackEvent {
  id: string;
  profile_id: string;
  job_id: string | null;
  match_analysis_id: string | null;
  event_type: FeedbackEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface FeedbackEventCreate {
  profile_id: string;
  event_type: FeedbackEventType;
  job_id?: string;
  match_analysis_id?: string;
  payload: Record<string, unknown>;
}

export interface ProfileCreate {
  name: string;
  headline?: string;
  resume_text: string;
  structured_data?: ResumeStructuredData | null;
}

export interface JobCreate {
  title: string;
  company: string;
  description: string;
  location?: string;
  url?: string;
  source?: string;
  raw_metadata?: Record<string, unknown> | null;
  profile_id?: string;
}

export interface JobCreateResponse extends Job {
  match_analysis_id?: string | null;
}

export interface JobExtraction {
  title: string;
  company: string;
  description: string;
  match_summary: string;
  work_mode?: "remote" | "hybrid" | "on-site" | "flexible" | null;
  location?: string | null;
  employment_type?: string | null;
  salary_range?: string | null;
  requirements: string[];
}

export interface JobParseResult {
  job_text: string;
  structured_data: JobExtraction;
}

export interface JobIntakeHandoff {
  id: string;
  job_text: string;
  structured_data: JobExtraction;
  url: string | null;
  source: string | null;
}
