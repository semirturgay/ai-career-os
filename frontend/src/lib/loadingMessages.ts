export type AiLoadingVariant =
  | "match-full"
  | "resume-extract"
  | "job-extract"
  | "company-research"
  | "job-discovery"
  | "cover-letter"
  | "resume-optimize"
  | "page"
  | "generic";

export interface LoadingStep {
  label: string;
}

export interface LoadingConfig {
  title: string;
  messages: string[];
  steps?: LoadingStep[];
}

export const LOADING_CONFIG: Record<AiLoadingVariant, LoadingConfig> = {
  "match-full": {
    title: "Deep match analysis",
    messages: [
      "Comparing experience to each requirement…",
      "Collecting evidence for strengths…",
      "Identifying honest gaps — no fluff…",
      "Calibrating recommendation and score…",
    ],
    steps: [{ label: "Parse JD" }, { label: "Evidence" }, { label: "Verdict" }],
  },
  "resume-extract": {
    title: "Reading your resume",
    messages: [
      "Parsing PDF structure…",
      "Extracting roles, skills, and education…",
      "Normalizing dates and bullet points…",
      "Preparing structured profile for review…",
    ],
    steps: [{ label: "PDF" }, { label: "Extract" }, { label: "Structure" }],
  },
  "job-extract": {
    title: "Structuring job description",
    messages: [
      "Stripping HTML and noise from paste…",
      "Extracting title, company, requirements…",
      "Building screening card for faster matching…",
    ],
    steps: [{ label: "Clean" }, { label: "Extract" }, { label: "Summarize" }],
  },
  "company-research": {
    title: "Researching company",
    messages: [
      "Deciding what to search next…",
      "Scanning culture and engineering signals…",
      "Checking recent news and hiring context…",
      "Synthesizing brief — sources only, no guesses…",
    ],
    steps: [{ label: "Search" }, { label: "Refine" }, { label: "Brief" }],
  },
  "job-discovery": {
    title: "Searching for jobs",
    messages: [
      "Building search queries from your criteria…",
      "Scanning job boards and career pages…",
      "Filtering listing pages from blog posts…",
      "Ranking candidates by profile fit…",
    ],
    steps: [{ label: "Query" }, { label: "Search" }, { label: "Rank" }],
  },
  "cover-letter": {
    title: "Writing cover note",
    messages: [
      "Drafting a tight opening from match strengths…",
      "Self-critique: unsupported claims check…",
      "Revising to stay under 400 characters…",
    ],
    steps: [{ label: "Draft" }, { label: "Critique" }, { label: "Revise" }],
  },
  "resume-optimize": {
    title: "Optimizing resume",
    messages: [
      "Reviewing match gaps against your bullets…",
      "Suggesting honest rewrites — no fabrication…",
      "Targeting keywords already implied in experience…",
    ],
    steps: [{ label: "Gaps" }, { label: "Suggest" }],
  },
  page: {
    title: "Loading",
    messages: ["Fetching your workspace…", "Almost ready…"],
  },
  generic: {
    title: "Working",
    messages: ["Processing with AI…", "This usually takes a few seconds…"],
  },
};
