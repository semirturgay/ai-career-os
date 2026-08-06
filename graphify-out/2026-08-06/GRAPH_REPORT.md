# Graph Report - .  (2026-08-06)

## Corpus Check
- Large corpus: 380 files · ~563,078 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2007 nodes · 4866 edges · 129 communities (97 shown, 32 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 286 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Jobs API
- LLM Prompts
- Company Schema
- Document Schema
- Frontend
- Profiles API
- Resume Schema
- Collapsiblesection UI
- Extensionemptypipeline UI
- Cover Schema
- Feedback Schema
- LLM Prompts 2
- Match API
- Frontend 2
- Frontend 3
- Llm Service
- Settings API
- Documentation
- Frontend 4
- Frontend 5
- Jobdetailtabs UI
- Scripts
- Capturesuctionoverlay UI
- App
- Job Service
- App 2
- Frontend 6
- Match Schema
- App 3
- Rag Schema
- Extension
- Ailoadingstate UI
- Deps API
- Match Schema 2
- Globaltaskindicator UI
- Frontend 7
- Monkeypatch
- Exception API
- Resume Schema 2
- Llm Service 2
- Match Service
- Matchfeedbackcontrols UI
- Rag Service
- Simplenamespace
- Rag Schema 2
- Screening Schema
- Rag Service 2
- Documentation 2
- Match Service 2
- Llm Service 3
- Rag Service 3
- Tests
- App 4
- Documentation 3
- Extension 2
- Profilepanel UI
- Llm API
- LLM Prompts 3
- Documentation 4
- Documentation 5
- Tests 2
- Tests 3
- Feedback API
- Extension 3
- Extension 4
- Scripts 2
- LLM Prompts 4
- Documentation 6
- Documentation 7
- Alembic
- Documentation 8
- Extension 5
- Documentation 9
- Documentation 10
- Extension 6
- Documentation 11
- Documentation 12
- Documentation 13
- Tests 4
- Rag Service 4
- Docker
- Documentation 14
- Documentation 15
- Extension 7
- Tests 5
- Tests 6
- Llm Service 4
- Documentation 16
- Frontend 8
- Frontend 9
- Tests 7
- Documentation 17
- Scripts 3
- Tests 8
- LLM Prompts 5
- Docker 2
- Documentation 18
- Documentation 19
- Documentation 20
- Documentation 21
- Documentation 22
- Documentation 23
- Documentation 24
- Documentation 25
- Documentation 26
- Documentation 27
- Documentation 28
- Documentation 29
- Documentation 30
- Documentation 31
- Documentation 32
- Documentation 33
- Documentation 34
- Documentation 35
- Documentation 36
- Documentation 37
- Pkg

## God Nodes (most connected - your core abstractions)
1. `ResumeExtraction` - 42 edges
2. `load_json()` - 36 edges
3. `Job` - 33 edges
4. `JobExtraction` - 30 edges
5. `Profile` - 29 edges
6. `CompanyBrief` - 28 edges
7. `ScoredChunk` - 28 edges
8. `analyze_match()` - 26 edges
9. `Job` - 26 edges
10. `ApplicationOutcomeStatus` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Gap-driven resume optimization` --conceptually_related_to--> `MatchAnalysis JSON schema prompt`  [INFERRED]
  README.md → app/prompts/match_analysis.txt
- `ResumeOptimizationResult schema` --processed_by--> `generate_structured LLM path`  [INFERRED]
  app/prompts/resume_optimization.txt → docs/ai-engineering.md
- `M4 Resume optimization` --implements--> `ResumeOptimizationResult schema`  [INFERRED]
  docs/milestones/README.md → app/prompts/resume_optimization.txt
- `test_run_match_analysis_marks_completed()` --calls--> `Profile`  [EXTRACTED]
  tests/test_matcher.py → app/models/__init__.py
- `_fixture_profile()` --calls--> `Profile`  [EXTRACTED]
  tests/test_rag_indexing.py → app/models/__init__.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Extension job capture pipeline** — docs_extension_dom_only_capture, docs_ai_engineering_document_classifier, docs_milestones_m2_job_intake_parse_text_api, docs_architecture_match_at_intake [INFERRED 0.93]
- **Resume to match analysis flow** — app_prompts_resume_extraction_resume_extraction_schema, docs_architecture_profile_entity, docs_milestones_m1_explain_the_match_match_result_schema, docs_architecture_match_analysis_entity [INFERRED 0.94]
- **Match gaps to resume optimization** — docs_milestones_m1_explain_the_match_match_result_schema, docs_milestones_m4_resume_optimization_gap_driven_optimization, app_prompts_resume_optimization_resume_optimization_result, docs_milestones_m4_resume_optimization_apply_suggestions_api [INFERRED 0.95]
- **Intake policy enforcement layers** — docs_intake_policy_dom_paste_only, docs_extension_no_third_party_fetch, docs_milestones_m2_job_intake_no_url_scraping, docs_intake_policy_company_research_separate [INFERRED 0.96]
- **M6 company research agent flow** — docs_milestones_m6_company_research_bounded_agent_loop, docs_milestones_m6_company_research_research_agent_step, docs_milestones_m6_company_research_search_result, docs_milestones_m6_company_research_company_brief_content, docs_milestones_m6_company_research_company_brief [EXTRACTED 1.00]
- **M8 three-phase feedback and memory rollout** — docs_milestones_m8_memory_feedback_phase_1, docs_milestones_m8_memory_feedback_phase_2, docs_milestones_m8_memory_feedback_phase_3 [EXTRACTED 1.00]
- **Extension classify → parse → review → save → match** — extension_readme_dom_capture, extension_readme_classify_capture_endpoint, extension_readme_parse_text_endpoint, extension_readme_classify_parse_pipeline [EXTRACTED 1.00]
- **Job capture classification eval fixtures** — tests_evals_fixtures_job_capture_classification_job_detail, tests_evals_fixtures_job_capture_classification_job_detail_tab_title_company, tests_evals_fixtures_job_capture_classification_job_list, tests_evals_fixtures_job_capture_classification_other_page [INFERRED 0.85]
- **FinTech Labs Senior Backend Engineer across eval fixtures** — tests_evals_fixtures_job_capture_classification_job_detail_fintech_labs, tests_evals_fixtures_job_extraction_greenhouse_backend_fintech_labs, tests_fixtures_extension_greenhouse_fintech_labs_page [INFERRED 0.80]
- **Extension onboarding flow** — docs_assets_demo_extension_welcome, docs_assets_demo_extension_welcome_how_it_works, docs_assets_demo_extension_welcome_setup_profile_cta, docs_assets_demo_extension_ai_setup, docs_assets_demo_extension_ai_setup_stepper, docs_assets_demo_extension_pipeline [INFERRED]
- **Extension install and demo** — docs_assets_demo_chrome_load_extension, docs_assets_demo_chrome_load_extension_developer_mode, docs_assets_demo_chrome_load_extension_load_unpacked, docs_assets_demo_demo, docs_assets_demo_demo_side_panel, docs_assets_demo_demo_extension_toolbar_icon [INFERRED]
- **Job pipeline feature** — docs_assets_demo_extension_pipeline, docs_assets_demo_extension_pipeline_capture_header, docs_assets_demo_extension_pipeline_opportunity_card, docs_assets_demo_extension_pipeline_match_analysis, docs_assets_demo_extension_pipeline_progress_stages, docs_assets_demo_demo_dom_capture_context, docs_assets_demo_api_docs_jobs_section [INFERRED]
- **AI provider configuration** — docs_assets_demo_extension_ai_setup, docs_assets_demo_extension_ai_setup_local_provider, docs_assets_demo_extension_ai_setup_cloud_providers, docs_assets_demo_api_docs_parse_resume, docs_assets_demo_extension_pipeline_match_analysis [INFERRED]
- **Brand and build assets** — frontend_public_logo, frontend_public_logo_brand_color, frontend_public_logo_icon_motif, vite, frontend_public_vite_lightning_bolt [INFERRED]

## Communities (129 total, 32 thin omitted)

### Community 0 - "Jobs API"
Cohesion: 0.07
Nodes (86): classify_captured_job_text(), create_company_research(), create_job(), create_job_intake_handoff(), delete_job(), _find_job_by_url(), get_job(), get_job_by_url() (+78 more)

### Community 1 - "LLM Prompts"
Cohesion: 0.05
Nodes (64): load_prompt(), PromptNotFoundError, Load a prompt template from app/prompts/{name}.txt., JobExtractionFields, JobExtractionLLM, BaseModel, LLM structured output — description is a short teaser only., Shared job extraction fields — field order is intentional for JSON-schema… (+56 more)

### Community 2 - "Company Schema"
Cohesion: 0.07
Nodes (61): CompanyBriefContent, BaseModel, model_validator, One step in the bounded company research agent loop., LLM-synthesized brief — sources and timestamp are attached in code., ResearchAgentStep, SearchResult, build_research_agent_user_message() (+53 more)

### Community 3 - "Document Schema"
Cohesion: 0.08
Nodes (48): DocumentClassification, DocumentLabel, BaseModel, StrEnum, JobCaptureClassification, BaseModel, Document-classifier assessment of browser-captured visible text., chunk_text_for_classification() (+40 more)

### Community 4 - "Frontend"
Cohesion: 0.08
Nodes (49): duplicateJobFromError(), request(), CompanyResearchPanel(), CompanyResearchPanelProps, CoverLetterPanel(), CoverLetterPanelProps, JobBoardProps, JobOpportunityCardProps (+41 more)

### Community 5 - "Profiles API"
Cohesion: 0.07
Nodes (46): apply_resume_suggestions(), create_profile(), delete_profile(), export_profile_resume_pdf(), get_profile(), list_profiles(), parse_resume(), AsyncSession (+38 more)

### Community 6 - "Resume Schema"
Cohesion: 0.11
Nodes (39): EducationEntry, ExperienceEntry, ProjectEntry, BaseModel, SkillEntry, _as_list(), _as_str(), _merge_skills() (+31 more)

### Community 7 - "Collapsiblesection UI"
Cohesion: 0.10
Nodes (32): CollapsibleSection(), CollapsibleSectionProps, EmbeddedNav(), items, JobDetailTab, Layout(), LayoutProps, PageBackNav() (+24 more)

### Community 8 - "Extensionemptypipeline UI"
Cohesion: 0.11
Nodes (35): ExtensionEmptyPipeline(), JobApplicationStatusControl(), JobApplicationStatusControlProps, JobBoard(), JobOpportunityCard(), scoreAccentClass(), useJobFeedback(), PipelineStatusFilters() (+27 more)

### Community 9 - "Cover Schema"
Cohesion: 0.12
Nodes (38): CoverLetterCritique, CoverLetterDraft, CoverLetterResult, BaseModel, build_cover_letter_user_message(), format_company_brief_section(), generate_cover_letter(), _parse_company_brief() (+30 more)

### Community 10 - "Feedback Schema"
Cohesion: 0.10
Nodes (36): ApplicationOutcomePayload, FeedbackEventCreate, FeedbackEventRead, FeedbackEventType, GapDisputePayload, MatchHelpfulPayload, PreferencePayload, Any (+28 more)

### Community 11 - "LLM Prompts 2"
Cohesion: 0.07
Nodes (41): Company research agent (search vs synthesize), Company research brief synthesis, 400 character body limit for cover letters, Cover letter critique pass, Cover letter draft pass, Cover letter revise pass, JobExtractionLLM structured extraction prompt, work_mode and location field extraction rules (+33 more)

### Community 12 - "Match API"
Cohesion: 0.11
Nodes (36): create_cover_letter(), create_match_analysis(), create_resume_optimization(), get_match_analysis(), list_match_analyses(), AsyncSession, BackgroundTasks, get (+28 more)

### Community 13 - "Frontend 2"
Cohesion: 0.05
Nodes (38): dependencies, react, react-dom, react-router-dom, devDependencies, openapi-typescript, tailwindcss, @tailwindcss/vite (+30 more)

### Community 14 - "Frontend 3"
Cohesion: 0.10
Nodes (30): api, ProviderForm(), ProviderFormProps, BadgeProps, ButtonProps, Card(), CardProps, Field() (+22 more)

### Community 15 - "Llm Service"
Cohesion: 0.14
Nodes (27): Message, _apply_provider_payload_options(), build_openai_compatible_config(), is_nvidia_host(), is_reasoning_model(), normalize_message_content(), OpenAICompatibleClient, OpenAICompatibleConfig (+19 more)

### Community 16 - "Settings API"
Cohesion: 0.12
Nodes (29): AsyncSession, get, SettingsUpdate, read_settings(), update_settings(), ValueError, Invalid LLM provider settings (missing API key, base URL, etc.)., SettingsValidationError (+21 more)

### Community 17 - "Documentation"
Cohesion: 0.07
Nodes (28): Apply Resume Suggestions endpoint, jobs API section, Parse Resume endpoint, profiles API section, Swagger UI, Developer mode toggle, Extension folder picker, Load unpacked button (+20 more)

### Community 18 - "Frontend 4"
Cohesion: 0.09
Nodes (20): App(), PageLoader(), ExtensionBootstrap(), ExtensionBootstrapProps, ExtensionRouteSync(), ExtensionHowItWorks(), STEPS, FloatingCaptureDock() (+12 more)

### Community 19 - "Frontend 5"
Cohesion: 0.12
Nodes (22): ApiError, DuplicateJobBanner(), DuplicateJobBannerProps, DuplicateJobInfo, OnboardingSteps(), OnboardingStepsProps, STEPS, ResumePasteZone() (+14 more)

### Community 20 - "Jobdetailtabs UI"
Cohesion: 0.14
Nodes (27): JobDetailTabs(), TAB_COPY, tabEnabled(), tabUnlocked(), dotClass(), dotLabel(), JobProgressBar(), JobProgressBarProps (+19 more)

### Community 21 - "Scripts"
Cohesion: 0.11
Nodes (30): apiHealthy(), appDir, contentType(), createCaptureHandoff(), delay(), demoCaptureState, demoDir, gifOut (+22 more)

### Community 22 - "Capturesuctionoverlay UI"
Cohesion: 0.11
Nodes (19): CaptureSuctionOverlay(), useCaptureFromActiveTab(), ActiveBrowserTab, formatTabLabel(), getSidePanelWindowId(), isCapturableUrl(), queryActiveBrowserTab(), subscribeActiveBrowserTab() (+11 more)

### Community 23 - "App"
Cohesion: 0.17
Nodes (20): CareerMemory, Profile-level memory snippets synthesized from user feedback., build_match_system_prompt(), build_match_system_prompt_from_memories(), format_career_memory_for_prompt(), load_active_memories(), AsyncSession, FeedbackEvent (+12 more)

### Community 24 - "Job Service"
Cohesion: 0.14
Nodes (17): _collapse_whitespace(), html_to_text(), JobPasteParseError, _looks_like_html(), _PasteHTMLParser, prepare_job_post_text(), ValueError, Normalize user-pasted job content (plain text or copied HTML). No network… (+9 more)

### Community 25 - "App 2"
Cohesion: 0.18
Nodes (21): AppSettings, Base, Job, Profile, Singleton row for local app configuration (LLM provider, API keys). Single-user…, A user's career profile — the source of truth for matching., A job opportunity — manually added or discovered later., Cached resume chunk vectors for pgvector similarity search. (+13 more)

### Community 26 - "Frontend 6"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+16 more)

### Community 27 - "Match Schema"
Cohesion: 0.17
Nodes (22): MatchGap, ResumeSuggestion, build_resume_optimization_user_message(), optimize_resume_for_match(), AsyncSession, Job, MatchResult, Profile (+14 more)

### Community 28 - "App 3"
Cohesion: 0.12
Nodes (18): Attach a request ID to each request and response for log correlation., RequestIdMiddleware, RequestLoggingMiddleware, setup_logging(), health(), lifespan(), FastAPI, get (+10 more)

### Community 29 - "Rag Schema"
Cohesion: 0.14
Nodes (18): BaseModel, Schemas for retrieval-augmented match analysis., One citeable unit of resume content for embedding and retrieval., ResumeChunk, _chunk_plain_resume(), _chunk_structured_resume(), Split structured resumes into retrieval-friendly chunks., _bag_of_words() (+10 more)

### Community 30 - "Extension"
Cohesion: 0.09
Nodes (21): action, default_title, background, service_worker, description, host_permissions, manifest_version, name (+13 more)

### Community 31 - "Ailoadingstate UI"
Cohesion: 0.13
Nodes (16): AiLoadingState(), AiLoadingStateProps, useRotatingMessage(), JobIntakeSteps(), JobIntakeStepsProps, STEPS, JobPasteZone(), JobPasteZoneProps (+8 more)

### Community 32 - "Deps API"
Cohesion: 0.22
Nodes (14): get_job_or_404(), get_match_analysis_or_404(), get_profile_or_404(), AsyncSession, Job, MatchAnalysis, Profile, UUID (+6 more)

### Community 33 - "Match Schema 2"
Cohesion: 0.19
Nodes (19): BatchScreeningResult, MatchResult, MatchStrength, BaseModel, ScreeningJobMatchResult, analyze_match(), AsyncSession, Job (+11 more)

### Community 34 - "Globaltaskindicator UI"
Cohesion: 0.14
Nodes (17): GlobalTaskIndicator(), useBackgroundWorkCount(), useOptionalPipelineSync(), AsyncTask, AsyncTaskKind, AsyncTaskStatus, emit(), emitSettled() (+9 more)

### Community 35 - "Frontend 7"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 36 - "Monkeypatch"
Cohesion: 0.14
Nodes (20): MonkeyPatch, api_client(), deterministic_embedding_provider(), disable_document_classifier_in_tests(), mock_db_session(), mock_db_session_empty_lists(), mock_llm_client(), noop_profile_indexing() (+12 more)

### Community 37 - "Exception API"
Cohesion: 0.18
Nodes (16): _detail(), Exception, FastAPI, register_exception_handlers(), ModelListError, Exception, Domain errors raised by services — mapped to HTTP responses in…, Failed to list models from a provider. (+8 more)

### Community 38 - "Resume Schema 2"
Cohesion: 0.19
Nodes (16): ApplyResumeSuggestionsRequest, BaseModel, ResumeOptimizationResult, _as_str(), normalize_resume_optimization_payload(), Any, evaluate_resume_optimization(), Any (+8 more)

### Community 39 - "Llm Service 2"
Cohesion: 0.22
Nodes (16): LLMClient, LLMConfigurationError, LLMError, Exception, Protocol, Raised when an LLM request fails (network, provider, or invalid response)., Raised when the app has no usable AI provider configured., create_llm_client() (+8 more)

### Community 40 - "Match Service"
Cohesion: 0.22
Nodes (16): build_match_user_message(), candidate_location(), format_job(), format_job_for_match(), format_profile(), AsyncSession, Job, Profile (+8 more)

### Community 41 - "Matchfeedbackcontrols UI"
Cohesion: 0.15
Nodes (16): analysisFeedback(), GapDisputeControl(), GapDisputeFeedback(), MatchFeedbackContext, MatchFeedbackPanel(), MatchHelpfulPrompt(), analyzeLabel(), MatchResultPanel() (+8 more)

### Community 42 - "Rag Service"
Cohesion: 0.23
Nodes (15): chunk_resume(), Turn profile resume content into atomic, citeable chunks. Structured profiles…, DeterministicEmbeddingProvider, Bag-of-words vectors for unit tests — fast, offline, no model download. Not…, Rank resume chunks by cosine similarity to the query embedding., retrieve_chunks(), test_chunk_plain_resume_splits_paragraphs(), test_chunk_resume_empty_profile() (+7 more)

### Community 43 - "Simplenamespace"
Cohesion: 0.21
Nodes (16): SimpleNamespace, evaluate_match_result(), Any, MatchResult, _iter_match_eval_cases(), asyncio, live_llm, parametrize (+8 more)

### Community 44 - "Rag Schema 2"
Cohesion: 0.23
Nodes (14): A resume chunk ranked by retrieval relevance., ScoredChunk, full_result_payload(), format_rag_resume_section(), _format_resume_summary(), _merge_scored_chunks(), AsyncSession, Job (+6 more)

### Community 45 - "Screening Schema"
Cohesion: 0.22
Nodes (13): BaseModel, Compressed job representation for Tier 1 LLM screening., ScreeningCard, attach_screening_card_to_metadata(), build_screening_card(), _fallback_summary(), Job, Build a Tier-1 screening card from a saved job. (+5 more)

### Community 46 - "Rag Service 2"
Cohesion: 0.23
Nodes (14): chunk_content_hash(), count_profile_chunks(), delete_profile_chunks(), embedding_model_name(), ensure_profile_indexed(), index_profile_chunks(), AsyncSession, Profile (+6 more)

### Community 47 - "Documentation 2"
Cohesion: 0.13
Nodes (11): Browser side panel demo frame, Demo capture overlay, Demo job posting page, DOM-only capture policy, Chrome side panel UI, Source-agnostic capture design, Company research is separate from intake, DOM and paste intake only (+3 more)

### Community 48 - "Match Service 2"
Cohesion: 0.31
Nodes (13): _as_float(), _normalize_gap(), normalize_match_payload(), _normalize_recommendation(), _normalize_score(), _normalize_severity(), _normalize_strength(), Any (+5 more)

### Community 49 - "Llm Service 3"
Cohesion: 0.25
Nodes (12): _docker_host_gateway(), normalize_openai_base_url(), Normalize OpenAI-compatible base URLs and end with /v1., When the API runs in Docker, local LLMs (LM Studio/Ollama) live on the host., _rewrite_docker_gateway_to_localhost(), _rewrite_local_host(), test_custom_gateway_env(), test_docker_rewrites_localhost_to_host_gateway() (+4 more)

### Community 50 - "Rag Service 3"
Cohesion: 0.21
Nodes (11): job_retrieval_queries(), Job, Build retrieval queries from job data., Prefer structured requirements; fall back to the full formatted job., _fixture_job(), _fixture_profile(), asyncio, Profile (+3 more)

### Community 51 - "Tests"
Cohesion: 0.34
Nodes (13): AsyncClient, asyncio, API wiring smoke tests — verify routes respond without a live database., test_get_job_not_found(), test_get_match_analysis_not_found(), test_get_profile_not_found(), test_get_settings(), test_list_feedback_empty() (+5 more)

### Community 52 - "App 4"
Cohesion: 0.29
Nodes (9): FeedbackEvent, User feedback captured for career memory and downstream prompt context., AsyncSession, FeedbackEvent, Job, sync_job_application_status_from_feedback(), asyncio, test_sync_job_application_status_skips_non_outcome_event() (+1 more)

### Community 53 - "Documentation 3"
Cohesion: 0.17
Nodes (10): M7 Chrome extension polish (next priority), API base URL setting, apiInput, saveBtn, savedEl, Chrome Extension README (M7), M7 Chrome Extension, Side panel (bundled React app) (+2 more)

### Community 54 - "Extension 2"
Cohesion: 0.29
Nodes (11): CAPTURE_SCRIPT_FILES, captureActiveTab(), captureFromTab(), delay(), getActiveBrowserTab(), injectCaptureScripts(), injectOverlayScript(), isCapturableUrl() (+3 more)

### Community 55 - "Profilepanel UI"
Cohesion: 0.26
Nodes (8): ProfilePanelProps, ProfileRouteContext, ProfileRouteContextValue, RequireProfileLayout(), useActiveProfile(), getActiveProfileId(), setActiveProfileId(), Profile

### Community 56 - "Llm API"
Cohesion: 0.25
Nodes (8): list_models(), AsyncSession, post, ListModelsRequest, ModelListRead, BaseModel, field_validator, ListModelsRequest

### Community 57 - "LLM Prompts 3"
Cohesion: 0.20
Nodes (9): Location field for match analysis, Never invent or infer missing information, ResumeExtraction schema, Exact array keys: experience, education, projects, Bounded agent loop, generate_structured LLM path, Golden eval harness, LLM output normalizers (+1 more)

### Community 58 - "Documentation 4"
Cohesion: 0.24
Nodes (10): Job capture document classifier, FastAPI async API, Job entity, JSONB for evolving LLM schemas, MatchAnalysis entity, MatchAnalysis as auditable eval dataset, Match at job insert, Profile entity (+2 more)

### Community 59 - "Documentation 5"
Cohesion: 0.18
Nodes (11): Source-agnostic DOM capture (never fetch job URLs), Eval harness (8 suites), Extension-first product direction, Vision, Eval-driven guiding principle, Human-in-the-loop guiding principle, No third-party fetch for intake (DOM or paste only), Source-agnostic DOM capture (+3 more)

### Community 60 - "Tests 2"
Cohesion: 0.18
Nodes (11): Acme Corp experience, Globex Inc experience, Jane Doe — Senior Backend Engineer, Skills: Python, FastAPI, PostgreSQL, Docker, greenhouse_backend job extraction fixture, FinTech Labs Senior Backend Engineer job post, Requirements: Python, FastAPI, PostgreSQL, Docker, pasted_backend_engineer HTML resume fixture (+3 more)

### Community 61 - "Tests 3"
Cohesion: 0.31
Nodes (9): evaluate_rag_retrieval(), Any, _iter_rag_eval_cases(), _load_case(), asyncio, parametrize, Path, test_job_retrieval_queries_use_requirements() (+1 more)

### Community 62 - "Feedback API"
Cohesion: 0.29
Nodes (10): create_feedback(), list_feedback_for_job(), list_feedback_for_profile(), AsyncSession, get, Job, post, Profile (+2 more)

### Community 63 - "Extension 3"
Cohesion: 0.38
Nodes (9): buildChips(), buildStreams(), clearStatusTimer(), harvestSnippets(), hideCaptureOverlay(), injectStyles(), lockPageScroll(), showCaptureOverlay() (+1 more)

### Community 64 - "Extension 4"
Cohesion: 0.20
Nodes (10): POST /api/v1/jobs/classify-capture, classify → parse → review → save → match pipeline, POST /api/v1/jobs/parse-text, job_detail capture classification fixture, Expect capturable job_detail page, FinTech Labs Senior Backend Engineer job detail, job_detail_tab_title_company capture fixture, Capturable job detail without company in body text (+2 more)

### Community 65 - "Scripts 2"
Cohesion: 0.31
Nodes (9): apiHealthy(), appDir, installChromeMock(), main(), outDir, root, seedDemoData(), startStaticServer() (+1 more)

### Community 66 - "LLM Prompts 4"
Cohesion: 0.28
Nodes (7): Career memory prompt injection, No fabrication of employers, titles, dates, or technologies, ResumeOptimizationResult schema, Suggestion action types, Review before save for resume, job, suggestions, Gap-driven resume optimization, Never auto-apply suggestions; user selects

### Community 67 - "Documentation 6"
Cohesion: 0.22
Nodes (7): Cover letter reflection chain, Progressive match pipeline, FastAPI BackgroundTasks, Save and analyze match flow, Screening card at extraction, Cover letter 3-pass reflection, Two-tier progressive match

### Community 68 - "Documentation 7"
Cohesion: 0.22
Nodes (9): application_outcome event type, CareerMemory entity, FeedbackEvent entity, gap_dispute event type, memory/synthesizer.py service, Phase 1 — Capture feedback events, Phase 2 — Profile memory + prompt injection, POST /api/v1/feedback (+1 more)

### Community 69 - "Alembic"
Cohesion: 0.32
Nodes (5): do_run_migrations(), run_async_migrations(), run_migrations_online(), Settings, BaseSettings

### Community 70 - "Documentation 8"
Cohesion: 0.25
Nodes (8): Bounded agent loop (max 5 steps, max 5 searches), CompanyBriefContent schema, DuckDuckGo default search provider, ResearchAgentStep schema, SearchResult schema, Source-grounded synthesis (no LLM-generated URLs), Phase 1 — Dead code removal, ResearchPlan orphan removed (Phase 1)

### Community 71 - "Extension 5"
Cohesion: 0.46
Nodes (7): collapseWhitespace(), extractJobPage(), extractVisiblePageText(), findContentRoot(), prependPageTitle(), STRIP_SELECTORS, visibleTextLength()

### Community 72 - "Documentation 9"
Cohesion: 0.33
Nodes (7): Milestone 8: Memory + feedback loop, Milestone 8 — Memory + feedback loop, M8 complete — current milestone, Autonomous AI Career Agent, Explainable evidence-based career decisions, Learn from feedback, Remember previous applications

### Community 73 - "Documentation 10"
Cohesion: 0.29
Nodes (7): Project Status, Home job pipeline ranked by score, pgvector RAG, Progressive match (screen → full), Refactor Plan, Behavior-preserving refactors only, Phase 0 — Baseline

### Community 74 - "Extension 6"
Cohesion: 0.48
Nodes (5): apiRequest(), classifyJobCapture(), createIntakeHandoff(), findJobByUrl(), parseJobText()

### Community 75 - "Documentation 11"
Cohesion: 0.33
Nodes (5): Never fetch external career-site URLs, Forbidden: fetch/httpx/hidden tabs for third-party job URLs, Job extraction pipeline, URL fetch/scrape pipeline cancelled by policy, POST /jobs/parse-text

### Community 76 - "Documentation 12"
Cohesion: 0.33
Nodes (6): Milestone 6: Company research, CompanyResearchPanel UI, M7 — Job discovery (next milestone), Milestone 6 — Company research, User-triggered research (not on job save), Research companies capability

### Community 77 - "Documentation 13"
Cohesion: 0.60
Nodes (5): M1 Explain the match, M2 Job structuring from paste, M3 Match on job insert, M4 Resume optimization, M5 Progressive match + cover letter

### Community 80 - "Docker"
Cohesion: 0.67
Nodes (3): FastAPI API container, LLM host gateway routing, PostgreSQL pgvector database

### Community 81 - "Documentation 14"
Cohesion: 0.50
Nodes (3): Explainable matching is atomic product unit, MatchResult output schema, Single LLM call approach

### Community 82 - "Documentation 15"
Cohesion: 0.50
Nodes (3): Comparative batch matching, Pivoted because users add jobs one at a time, M3 batch matching archived

### Community 84 - "Tests 5"
Cohesion: 0.67
Nodes (3): asyncio, test_client_request_id_is_echoed(), test_response_includes_request_id_header()

### Community 85 - "Tests 6"
Cohesion: 0.50
Nodes (3): AsyncClient, asyncio, test_update_settings_without_api_key_returns_400()

### Community 93 - "Documentation 16"
Cohesion: 0.67
Nodes (3): CompanyBrief API response, jobs.company_brief JSONB column, POST /api/v1/jobs/{job_id}/company-research

### Community 96 - "Tests 7"
Cohesion: 0.67
Nodes (3): qwen_shape resume eval fixture, Alex Chen — Platform Engineer (Go, Kubernetes, AWS), Alternate resume layout for model shape testing

## Knowledge Gaps
- **265 isolated node(s):** `LocalPresetMeta`, `ProviderMeta`, `CAPTURE_SCRIPT_FILES`, `lastActiveTabByWindow`, `manifest_version` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ResumeExtraction` connect `Jobs API` to `Resume Schema`, `Rag Service`, `Rag Schema 2`, `Llm Service`, `Rag Schema`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `Job` connect `App 2` to `Deps API`, `Jobs API`, `Company Schema`, `Match Schema 2`, `Match Service`, `Cover Schema`, `Rag Schema 2`, `Screening Schema`, `Rag Service 3`, `App 4`, `App`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `get_logger()` connect `Deps API` to `Jobs API`, `LLM Prompts`, `Company Schema`, `Document Schema`, `Exception API`, `Cover Schema`, `Rag Service 2`, `Llm Service`, `App 4`, `App`, `App 3`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `ResumeExtraction` (e.g. with `JobByUrlRead` and `JobCaptureClassifyRequest`) actually correct?**
  _`ResumeExtraction` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `SimpleNamespace` (e.g. with `test_research_company_pipeline_with_mocked_llm_and_search()` and `test_generate_cover_letter_injects_career_memory_fixture()`) actually correct?**
  _`SimpleNamespace` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `JobExtraction` (e.g. with `JobByUrlRead` and `JobCaptureClassifyRequest`) actually correct?**
  _`JobExtraction` has 18 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LocalPresetMeta`, `ProviderMeta`, `CAPTURE_SCRIPT_FILES` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._