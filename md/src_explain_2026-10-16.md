# RapidFire CLI: Codebase Architecture Breakdown

## 1. Architecture Overview & Tech Stack
RapidFire CLI is a modern, modular Command Line Interface (CLI) tool designed to streamline developer workflows, integrate AI capabilities, handle project scaffolding, and automate deployment tasks. 

*   **Architecture Pattern:** Modular Command-Pattern architecture combined with a centralized service/utility layer. Commands are decoupled into discrete handlers, relying on shared engines for AI interactions, external tool integrations, and file system scaffolding.
*   **Core Capabilities:**
    *   **AI-Powered Assistance:** Natural language command execution, code explanation, suggestion, and context-aware chatting via Gemini.
    *   **Smart Scaffolding:** Dynamic generation and planning of backend and frontend code bases using a dedicated adapter pattern.
    *   **DevOps & Tooling Integration:** Native interfacing with GitHub (`gh`), Vercel (`vercel`), and security auditing via Gitleaks.
    *   **Interactive Shell (REPL):** Built-in Read-Eval-Print Loop for continuous execution.

---

## 2. Directory & Module Map

```
src/
├── ai/                 # AI provider abstractions and Gemini API integrations
├── commands/           # Individual CLI command implementations (ask, deploy, run, etc.)
├── integrations/       # Wrappers for external CLIs and platforms (GitHub, Vercel, Gitleaks)
├── scaffolding/        # Project generation engine, planners, and tech-stack adapters
├── utils/              # Cross-cutting concerns (filesystem, git, config, process management)
└── repl.js             # Interactive command-line REPL loop
```

### Module Breakdown:
*   **`ai/`**: Manages communication with Large Language Models. `provider.js` establishes a uniform interface, while `gemini.js` implements specific Google Gemini bindings.
*   **`commands/`**: The core action layer. Each file corresponds to a specific CLI verb/operation (e.g., `ask.js`, `deploy.js`, `suggest.js`). `index.js` acts as the command router/registry.
*   **`integrations/`**: Encapsulates external command-line tools and SaaS APIs. Isolates third-party logic (GitHub CLI, Vercel, Gitleaks) from core business rules.
*   **`scaffolding/`**: Handles automated project creation. 
    *   `planner.js`: Determines the architecture strategy based on user input.
    *   `dynamicEngine.js`: Executes the scaffolding plan.
    *   `adapters/`: Specific generators for frontend and backend technologies.
*   **`utils/`**: Utility belt containing primitives for path management (`configPath.js`), dependency resolution (`depInstaller.js`), file system helpers (`fsHelpers.js`), git context gathering (`gitContext.js`), and terminal syntax highlighting (`highlighter.js`).

---

## 3. Entry Points & Workflow

1.  **CLI Entry & Command Routing:**
    *   Execution starts at the global binary entry point (typically mapping to `commands/index.js`).
    *   Arguments are parsed, and control is handed off to the appropriate module inside `commands/`.
2.  **Execution Lifecycle:**
    *   **Context Gathering:** Commands like `explain.js`, `push.js`, or `run.js` utilize `utils/gitContext.js` and `utils/repoContext.js` to inspect the current working directory.
    *   **AI Augmentation:** If the command requires intelligence (e.g., `ask.js`, `tell.js`, `suggest.js`), it queries `ai/gemini.js` enriched with the repository's memory (`utils/repoMemory.js`).
    *   **Action Execution:** The command invokes integrations (`integrations/vercel.js`) or local subprocesses (`utils/proc.js`) to complete the user's intent.
3.  **Alternative Entry (REPL):**
    *   `repl.js` provides an interactive prompt session, bypassing single-shot command execution for continuous user interaction.

---

## 4. Key Developer Takeaways

*   **Adding a New Command:** Create a new file in `commands/` (e.g., `audit.js`), implement the command handler logic, and register it in `commands/index.js`.
*   **Integrating a New External Tool:** Add a wrapper file inside `integrations/` using `utils/proc.js` to safely spawn child processes and handle output streams.
*   **Extending Scaffolding:** To support a new tech stack, modify or add adapters inside `scaffolding/adapters/` (e.g., database or specific framework adapters) and update `scaffolding/planner.js` to recognize the new target.
*   **Context Awareness:** Always leverage `utils/repoContext.js` and `utils/gitContext.js` when building commands that need to understand the user's current project state.