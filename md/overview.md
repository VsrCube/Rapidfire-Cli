# Repository Overview: rapidfire-cli (v0.1.31)

Target: /home/vedansh/Desktop/miniproject
Primary Stack: Google Gemini AI
Total Tracked Modules/Files: 130

## 1. Agenda / Goal
The primary goal of rapidfire-cli is: Terminal overlay and shell passthrough REPL with instant developer scaffolding recipes.

Core Architectural Objectives:
• Developer Workflow Acceleration: Eliminate context switching and manual boilerplate by keeping code comprehension, scaffolding, and deployment inside unified terminal interfaces.
• Modular Domain Isolation: Decouple user-facing command interfaces, execution runners, and scaffolding generators from external provider dependencies.
• Deterministic Offline Reliability: Ensure complete architectural mapping, structural flowcharts, and verification remain operational offline without network dependency.
• Quality & Security by Default: Enforce mandatory pre-push secret audits and complete automated regression testing across all platforms.

## 2. Use Case
• Primary Use Case: Modular application workflows, services, and developer tooling in Google Gemini AI.
• Developer Scenarios:
  - Rapid full-stack prototyping with 1-command scaffolding recipes.
  - Living architecture documentation and senior code review without leaving the shell.
  - Multi-process development execution with automated port management.
• Team & Enterprise Scenarios:
  - Automated CI/CD verification enforcing zero leaked secrets via pre-push hooks.
  - Accelerated developer onboarding into unfamiliar codebases via granular codebase explanation and overview reports.
• Target Audience: Software engineers, DevOps professionals, and system architects.
• Operational Environment: Local command execution, automated testing, and production deployment environments across Linux, macOS, and Windows.

## 3. Key Features
• Interactive REPL Overlay: High-performance terminal overlay and shell passthrough powered by node-pty.
• Dynamic Framework Scaffolding (setup, init): Instant generation for 7 core frameworks, 13 composed stacks, and dynamic unknown framework blueprints.
• AI Codebase Introspection (explain, overview): Deep code understanding with dated markdown exports and repository-wide architectural critique (overview --critic).
• Automated Cloud Deployment (deploy): Native zero-configuration Vercel deployment with authentication validation.
• Security-First Push Pipeline (push): Git commit and push pipeline enforcing pre-push secret scanning via Gitleaks.
• Context-Aware Conversational Assistant (ask): Technical Q&A with conversational turn memory and 1-click dependency installer.
• Multi-Provider AI Architecture (key): Replaceable AI engine auto-detecting Google Gemini, Groq, and OpenAI models.
• Local Repository Memory: Persistent local database (.rapidfire/db.json) recording conversations, explanations, and architectural overviews.

## 4. Folder Architecture
```
miniproject/
├── bin/
│   └── rapidfire.js                  (Binary entrypoint & CLI argument tokenizer)
├── src/
│   ├── ai/                           (Multi-provider AI interface: Gemini, Groq, OpenAI)
│   ├── commands/                     (Command modules: ask, deploy, explain, overview, push, setup, run, etc.)
│   ├── integrations/                 (External platform adapters: vercel.js, github.js, gitleaks.js)
│   ├── scaffolding/                  (Architecture planner, dynamic generator & framework adapters)
│   ├── utils/                        (Repo memory DB, filesystem helpers, process execution)
│   └── repl.js                       (Interactive pseudo-terminal PTY loop & shell passthrough)
├── documents/
├── md/
├── test/
├── .env
├── .gitignore
├── README.md
├── package-lock.json
└── package.json
```

## 5. Data Pipeline Flowchart
```
┌────────────────────────────────────────────────────────────────────────┐
│                          1. INGESTION LAYER                            │
│  • CLI Arguments (e.g. overview, explain, setup react+fastapi)         │
│  • Interactive Terminal Input (keystrokes via node-pty REPL loop)      │
│  • Environment Variables & Credentials (.env / ~/.rapidfire/config)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   2. SECURITY & NORMALIZATION GATE                     │
│  • Pre-execution Tokenizer & Argument Normalization                    │
│  • Path Sanitization & Workspace Boundary Enforcement                  │
│  • Gitleaks Secret Auditor (detects leaked credentials & high-entropy) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      3. COMMAND ROUTING ENGINE                         │
│  • Fuzzy Matcher & Verb Dispatcher (src/commands/index.js)             │
│  • Context Resolver & Root Locator (findRepoRoot, getActiveAiConfig)   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌─────────────────────────────────┐┌─────────────────────────────────────┐
│    4A. SCAFFOLDING & PROCESS    ││       4B. AI & CODE ANALYSIS        │
│ • Architecture Planner & Matrix ││ • Repo Topology Scanner & File Tree │
│ • Blueprint Synthesis Engine    ││ • Context Builder (.rapidfire DB)   │
│ • Child Process Runner (PTY)    ││ • LLM Router / Static Fallback      │
└───────────────────┬─────────────┘└─────────────────┬───────────────────┘
                    │                                │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    5. PERSISTENCE & PRESENTATION                       │
│  • Living Markdown Exporter (md/overview.md, md/overview_critic.md)    │
│  • Repository Memory Cache (.rapidfire/db.json)                        │
│  • Responsive Terminal Box Formatter (rendered to terminal width)      │
└────────────────────────────────────────────────────────────────────────┘
```

## 6. File Overview / Directory Overview
• bin/rapidfire.js: Main executable wrapper responsible for CLI flag parsing and REPL initiation.
• src/repl.js: Interactive pseudo-terminal PTY shell loop, syntax box renderer, and raw input handler.
• src/commands/overview.js: Dual-mode architecture analysis and senior architectural critique generator.
• src/commands/explain.js: Granular source code inspection and dated markdown exporter.
• src/commands/setup.js: Framework scaffolding orchestrator for standard, composed, and dynamic blueprints.
• src/commands/deploy.js: Automated cloud deployment runner integrating with Vercel CLI.
• src/commands/push.js: Automated git commit and push pipeline with integrated secret scanning.
• src/commands/run.js: Full-stack application runner with automatic port discovery and background process orchestration.
• src/commands/ask.js: Conversational technical Q&A with persistent multi-turn conversational context.
• src/commands/key.js: AI provider configuration manager supporting Gemini, Groq, and OpenAI.
• src/ai/provider.js: Multi-provider abstraction layer, auto-detection, and deterministic offline fallbacks.
• src/ai/gemini.js: Google Gemini Generative AI SDK client bindings.
• src/integrations/vercel.js: Vercel CLI runner, authentication detector, and deployment URL extractor.
• src/integrations/github.js: GitHub CLI (gh) authentication and automated remote repository initializer.
• src/integrations/gitleaks.js: Security auditing engine and automated pre-push secret scanning.
• src/scaffolding/planner.js: Scaffolding planner determining framework pairings and blueprint generation.
• src/scaffolding/dynamicEngine.js: Dynamic code generator for unknown framework recipes.
• src/utils/repoMemory.js: Repository memory database (.rapidfire/db.json) caching overviews and conversations.
• src/utils/repoContext.js: Project topology inspection, dependency extraction, and context builder.
• documents/: Academic documentation, synopsis, and project specifications.
• md/: Living markdown architectural exports and system documentation.
• test/: Verification suites containing 33 test specifications validating core features.
• README.md: Primary repository documentation and developer onboarding guide.
• package.json: Application manifest detailing scripts, metadata, and dependencies.

## 7. Working Flowchart
```
[ User Terminal / Shell ]
           │
           ▼
[ bin/rapidfire.js Entrypoint ]
   ├── Reads CLI arguments & flags (--critic, --dynamic, --ci)
   └── Validates Node.js runtime environment (engines >= 18.0.0)
           │
           ├── If flags passed ───────────────┐ (Single-shot execution)
           │                                  │
           ▼                                  ▼
[ Interactive REPL (src/repl.js) ]    [ Command Matcher (src/commands/index.js) ]
   • Boots pseudo-terminal (node-pty)        │
   • Displays banner & command prompt        │
   • Captures input & tab-completions        │
           │                                  │
           └──────────────────────────────────┘
                            │
                            ▼
         [ Dispatches to Command Handler ]
     ┌──────────────────────┬──────────────────────┐
     ▼                      ▼                      ▼
[ Scaffolding ]       [ AI & Analysis ]      [ DevOps / Git ]
(setup.js, init.js)   (overview, explain,    (push.js, deploy.js,
                      ask.js, tell.js)       run.js)
     │                      │                      │
     └──────────────────────┼──────────────────────┘
                            │
                            ▼
         [ Terminal Output & File Persistence ]
     • Renders ANSI-styled responsive box to terminal
     • Saves living documentation under md/ folder
     • Updates repo memory database (.rapidfire/db.json)
```

## 8. Technology Used
• Runtime & Language: Node.js (>= 18.0.0), JavaScript (CommonJS, ES2022 standards).
• Terminal Emulation: node-pty for pseudo-terminal emulation, native ANSI terminal escape formatting.
• AI & LLM Services: Google Gemini API (@google/generative-ai), OpenAI REST API, Groq REST API, custom heuristic fallbacks.
• File System & Compression: fs-extra for recursive tree operations, zlib/native zip streaming for project compression.
• DevOps & External Integrations: Vercel CLI (vercel), GitHub CLI (gh), Gitleaks for secret detection.
• Testing & Quality Assurance: Node.js assert test framework, GitHub Actions multi-platform matrix (Ubuntu, Windows, macOS).
• Core Runtime Dependencies: @google/generative-ai, fs-extra, node-pty
• Lifecycle Scripts: start, test

## 9. Security
• Secret Scanning Gate: Integrated Gitleaks pre-push hooks automatically audit staged diffs and prevent credential leaks before commits leave the developer machine.
• Credential & Key Hygiene: AI provider tokens (Gemini, Groq, OpenAI) are strictly isolated in ~/.rapidfire/config.json with restrictive permissions (0600 mode) and never checked into source control.
• Safe Subprocess Invocation: Process runners execute child commands via structured argument arrays, mitigating shell injection vulnerabilities.
• Workspace Boundary Protection: File operations and scaffolding engines enforce directory containment guards to prevent directory traversal and collision vulnerabilities.

## 10. Conclusion
The codebase exhibits an advanced, production-grade modular architecture characterized by high cohesion and low coupling. Key responsibilities are partitioned cleanly across presentation (REPL), command dispatch, scaffolding, and cloud integrations. With 33 automated verification suites present across POSIX and Windows environments, the repository demonstrates exceptional regression safety and reliability for production workflows.

## 11. Things to Work On / Fixes
1. High Priority: Integrate web-tree-sitter (WASM) parser to replace heuristic regex scanners with full Abstract Syntax Trees for multi-language dependency graphs.
2. Medium Priority: Implement user persona profiles (profile learner vs profile developer) to toggle between Socratic hints and concise production solutions.
3. Medium Priority: Implement automated citation validation ([file:line-range]) verifying that model references point to existing source lines.
4. Low Priority: Add incremental hash-based file indexing cache to .rapidfire/ to skip re-scanning unchanged source files.
