# RAPIDFIRE CLI: Comprehensive Project Master Reference Manual

> **Official Project Documentation & Technical Architecture Guide**  
> **Project Name:** RapidFire CLI  
> **Repository:** [https://github.com/VsrCube/Rapidfire-Cli](https://github.com/VsrCube/Rapidfire-Cli)  
> **Version:** v0.1.25 (Cross-Platform Windows ConPTY Architecture, Dynamic Scaffolding, Multi-Provider AI)  
> **Authors:**  
> • **Vedansh Shrivastava** (Roll No: 321)  
> • **Vaishnavi Sahu** (Roll No: 319)  
> • **Tanwi Gupta** (Roll No: 311)  
> • **Tanmay Mittal** (Roll No: 309)  
> **Project Guide / Supervisor:** **Ms. Ruchika**, Assistant Professor, Department of Computer Science & Engineering  
> **Institution:** Greater Noida Institute of Technology (GNIOT), Greater Noida  
> **Affiliation:** Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow  
> **Academic Session:** B.Tech Computer Science & Engineering (Batch: 2025–2029, 2nd Year / 3rd Semester)  

---

## Table of Contents
1. [Project Overview and Core Philosophy](#1-project-overview-and-core-philosophy)
2. [Problem Statement and Industry Context](#2-problem-statement-and-industry-context)
3. [System Architecture and Low-Level Engine Design](#3-system-architecture-and-low-level-engine-design)
4. [Cross-Platform Terminal Subsystem and Windows ConPTY Handling](#4-cross-platform-terminal-subsystem-and-windows-conpty-handling)
5. [The Three-Tier Dynamic Scaffolding Engine](#5-the-three-tier-dynamic-scaffolding-engine)
6. [DevSecOps Security Engine and In-Flight Secret Guardrail](#6-devsecops-security-engine-and-in-flight-secret-guardrail)
7. [Unified Git and GitHub Automation Subsystem](#7-unified-git-and-github-automation-subsystem)
8. [Multi-Provider AI Intelligence Layer](#8-multi-provider-ai-intelligence-layer)
9. [Workspace Presets and Deterministic Snapshot Engine](#9-workspace-presets-and-deterministic-snapshot-engine)
10. [Bidirectional Shell History and Live Syntax Highlighting](#10-bidirectional-shell-history-and-live-syntax-highlighting)
11. [Complete CLI Command Reference](#11-complete-cli-command-reference)
12. [File-by-File Codebase Directory Architecture](#12-file-by-file-codebase-directory-architecture)
13. [Verification and Master Test Suite Architecture (26 Test Suites)](#13-verification-and-master-test-suite-architecture-26-test-suites)
14. [Academic Defense, Viva Voce and Technical Evaluation (25 Q&As)](#14-academic-defense-viva-voce-and-technical-evaluation-25-qas)

---

## 1. Project Overview and Core Philosophy

RapidFire CLI is a lightweight **terminal overlay, shell passthrough REPL, and unified developer console** built on Node.js and native pseudo-terminal bindings (`node-pty`). It addresses the chronic fragmentation of the modern software development lifecycle by collapsing project scaffolding, local environment wiring, credential leak interception, and contextual AI into a single, high-performance terminal session.

```
+----------------------------------------------------------------------------------------------------+
|                                    RAPIDFIRE UNIFIED TERMINAL REPL                                 |
|                                                                                                    |
|   +--------------------------------------------------------------------------------------------+   |
|   |                       Persistent Interactive Pseudo-Terminal (node-pty)                   |   |
|   |         Bash (Linux)  |  Zsh (macOS)  |  PowerShell (Windows)  |  Native Environment       |   |
|   +--------------------------------------------------------------------------------------------+   |
|                                                  |                                                 |
|          +---------------------------------------+---------------------------------------+         |
|          |                                       |                                       |         |
|          v                                       v                                       v         |
|   +----------------------+               +----------------------+               +---------------+  |
|   | 3-Tier Scaffolding   |               | DevSecOps Guardrail  |               | Multi-Provider|  |
|   | - 13 Offline Stacks  |               | - In-flight GitLeaks |               | AI Engine     |  |
|   | - Composed Pairings  |               | - Secret Push Block  |               | - Gemini      |  |
|   | - Dynamic Synthesis  |               | - Monorepo Guard     |               | - Groq/OpenAI |  |
|   +----------------------+               +----------------------+               +---------------+  |
+----------------------------------------------------------------------------------------------------+
```

### Core Design Principles
1. **Zero Context Switching**: Eliminates the developer tax of jumping between multiple terminal emulators, browser documentation tabs, cloud dashboards, and external secret scanners.
2. **Local-First Architecture**: Operates directly on the host machine using native operating system processes. Scaffolding recipes and templates run fully offline without cloud dependencies.
3. **Shift-Left Security by Default**: Security is enforced locally prior to network transmission. High-entropy secrets and API tokens are intercepted in-flight before Git commits are pushed to remote servers.
4. **Non-Invasive Shell Passthrough**: Unlike heavy integrated development environments that obscure shell state, RapidFire acts as a transparent overlay. Standard commands (`git`, `ls`, `cd`, `npm`, `python`, `docker`) execute directly in the persistent host shell without state loss.

---

## 2. Problem Statement and Industry Context

### 2.1 The Toolchain Fragmentation Crisis
Modern web and backend software development requires integrating multiple independent tools before writing a single line of business logic:
- Selecting and initializing frontend bundlers (Vite, Next.js, SvelteKit).
- Selecting and setting up backend APIs (FastAPI, Django, Express, Flask).
- Creating and isolating language runtimes (Python `venv`, Node `node_modules`).
- Resolving Cross-Origin Resource Sharing (CORS) header mismatches between port 3000 and port 8000.
- Configuring version control (`git init`, branch naming, remote origin mapping via `gh`).

Industry research demonstrates that developers spend 30% to 40% of their initial project phase configuring boilerplate rather than building domain functionality.

### 2.2 The In-Flight Credential Exposure Vulnerability
The average enterprise codebase incurs multiple credential leaks per year. Cloud-based secret scanning (such as GitHub Actions or hosted CI) operates asynchronously *after* commits are pushed to public or team repositories.

According to empirical research (Meli et al., NDSS 2019), public GitHub commits are scraped by automated bot networks within **sub-60-second windows**. Post-push alerts are inherently late: once a private key, database URI, or cloud access secret reaches a remote repository, it is compromised. RapidFire shifts this security gate to the host machine, intercepting the commit transaction prior to packet serialization.

---

## 3. System Architecture and Low-Level Engine Design

RapidFire CLI operates through an asynchronous, event-driven architecture powered by the `libuv` event loop and native pseudo-terminal bindings.

### Architectural Subsystems
1. **Interactive REPL Controller (`src/repl.js`)**: Manages the Readline interface, ANSI color syntax highlighting, prompt restoration across asynchronous streams, and signal dispatching (`SIGINT`, `SIGTERM`, `SIGWINCH`).
2. **Persistent Shell Adapter (`src/shell.js`)**: Spawns and manages a persistent child pseudo-terminal using `node-pty` (or a high-performance fallback adapter). Preserves working directory (`cwd`), exported environment variables, and shell history across commands.
3. **Command Router (`src/commands/index.js`)**: High-speed prefix matcher that parses developer input and routes recognized verbs (`setup`, `push`, `ask`, `tell`, `explain`, `preset`, `deploy`, `key`, `help`, `version`, `clear`) to native JavaScript modules, while delegating unrecognized inputs to the active shell.
4. **Dynamic Scaffolding Subsystem (`src/scaffolding/`)**: Coordinates project generation across static templates, composed multi-framework pairings, and dynamic runtime blueprints.

---

## 4. Cross-Platform Terminal Subsystem and Windows ConPTY Handling

Operating systems implement pseudo-terminals differently. Unix-like systems (Linux, macOS) utilize POSIX master/slave `/dev/pts` file descriptors, while modern Windows versions (Windows 10/11) implement the **ConPTY (Pseudoconsole)** infrastructure.

### 4.1 Strict Windows Shell Resolution
On Windows environments, the standard `process.env.COMSPEC` variable typically points to `C:\Windows\System32\cmd.exe`. However, passing PowerShell arguments (`-NoLogo`, `-NoProfile`, `-Command`, `-`) to `cmd.exe` results in command execution failures.

RapidFire enforces explicit platform resolution inside `src/shell.js`:
- **Windows (`win32`)**: Spawns `powershell.exe` with arguments `['-NoLogo', '-NoProfile', '-Command', '-']`, providing native Windows PowerShell semantics, tab completion, and environment variable continuity.
- **macOS (`darwin`)**: Spawns `/bin/zsh` with the interactive login flag `['-l']`.
- **Linux (`linux`)**: Spawns `/bin/bash` with the login flag `['--login']`.

### 4.2 ConPTY Escape Sequence Sanitization
When running inside Windows Terminal or standard ConPTY consoles, the underlying pseudo-terminal emits win32-input-mode sequences (`\x1b[?9001h`, `\x1b[?9001l`) and xterm focus reporting escape sequences (`\x1b[?1004h`, `\x1b[?1004l`). In raw stream passthrough, these binary control sequences bleed into user input lines, corrupting the prompt buffer.

RapidFire resolves this via a dual-action guard in `src/repl.js`:
1. **Initialization & Teardown Reset**:
   ```javascript
   process.stdout.write('\x1b[?9001l\x1b[?1004l');
   ```
2. **In-Flight Stream Filtering**:
   ```javascript
   this.shell.onData((data) => {
     let chunk = data;
     if (chunk) chunk = chunk.replace(/\x1b\[\?(9001|1004)[hl]/g, '');
     // Proceed to prompt collision sanitization and stdout dispatch
   });
   ```
This strips Windows ConPTY control codes in real time while preserving ANSI terminal colors, cursor controls, and streaming command output.

---

## 5. The Three-Tier Dynamic Scaffolding Engine

RapidFire organizes project creation into **three progressive tiers**, balancing zero-dependency offline reliability with open-ended flexibility:

| Tier | Category | Mechanism | Example Commands | Offline Capability |
|---|---|---|---|---|
| **Tier 1** | Predefined Built-in | Zero-dependency local template emitters | `setup react+fastapi myapp`<br/>`setup django myapp` | 100% Offline |
| **Tier 2** | Composed Pairing | Cross-tier dynamic assembly with CORS injection | `setup svelte+fastapi myapp`<br/>`setup vue+django myapp` | 100% Offline |
| **Tier 3** | AI Dynamic Synthesis | Schema-validated AI blueprint synthesis | `setup astro myapp`<br/>`setup solid myapp` | Cloud AI / Local Ollama |

```
                                      [User Input: setup <recipe> <folder>]
                                                        |
                                                        v
                                          +----------------------------+
                                          |   StackPlanner (Tier Check)|
                                          +----------------------------+
                                                        |
                         +------------------------------+------------------------------+
                         |                                                             |
                         v                                                             v
             [Tier 1: Predefined Stacks]                                   [Non-Predefined Syntax]
           (13 Core Fullstack Recipes)                                                 |
                         |                                                             v
                         |                                            [Contains '+' Separator?]
                         |                                            /                       \
                         |                                           v                         v
                         |                                [Tier 2: Composed]          [Tier 3: Dynamic]
                         |                                (Frontend + Backend)       (Unknown Framework)
                         |                                           |                         |
                         |                                           v                         v
                         |                             [Validate FE & BE Adapters]    [LLM Blueprint Engine]
                         |                                           |                         |
                         |                                           v                         v
                         +------------------------------------------>+<------------------------+
                                                                     |
                                                                     v
                                                    +----------------------------------+
                                                    |  DynamicEngine Project Pipeline  |
                                                    |  1. Path Traversal Guard         |
                                                    |  2. Atomic File Generation       |
                                                    |  3. CORS Middleware Injection    |
                                                    |  4. .rapidfire.json Manifest     |
                                                    |  5. Monorepo-Aware Git Setup     |
                                                    |  6. Pre-Push Security Guardrail  |
                                                    +----------------------------------+
```

### 5.1 The 13 Core Built-in Recipes (Tier 1)
1. `react+fastapi`: React 18 (Vite) frontend on port 5173 + FastAPI backend on port 8000 with Python virtual environment.
2. `react+django`: React 18 (Vite) frontend + Django REST framework backend on port 8000.
3. `react+node`: React 18 (Vite) frontend + Express.js REST API on port 5000.
4. `react+flask`: React 18 (Vite) frontend + Flask Python backend on port 5000.
5. `vue+fastapi`: Vue 3 (Vite) frontend on port 5173 + FastAPI backend on port 8000.
6. `vue+node`: Vue 3 (Vite) frontend + Express.js backend on port 5000.
7. `vue+django`: Vue 3 (Vite) frontend + Django REST backend on port 8000.
8. `svelte+node`: Svelte (Vite) frontend on port 5173 + Express.js backend on port 5000.
9. `react`: Standalone React 18 (Vite) single-page application.
10. `vue`: Standalone Vue 3 (Vite) single-page application.
11. `svelte`: Standalone Svelte (Vite) single-page application.
12. `fastapi`: Standalone FastAPI asynchronous microservice with Swagger documentation (`/docs`).
13. `django`: Standalone Django web project with default SQLite configuration.

### 5.2 Dynamic Composed Scaffolding (Tier 2)
When developers request pairings not explicitly enumerated in the static registry (e.g., `setup svelte+fastapi myapp`), the `StackPlanner` splits the token on `+`, matches the respective frontend adapter (`src/scaffolding/adapters/frontend.js`) and backend adapter (`src/scaffolding/adapters/backend.js`), generates both environments into `/frontend` and `/backend` directories, and injects cross-origin configuration.

### 5.3 AI-Synthesized Dynamic Scaffolding (Tier 3)
When developers specify an unknown framework (e.g., `setup astro myapp` or `setup solid myapp`), the engine invokes `dynamicEngine.js`:
1. Queries the configured AI provider using a structured system prompt.
2. Generates an atomic JSON blueprint defining project structure, configuration files, package dependencies, and starter code.
3. Validates the output through a strict schema sanitizer that rejects root breakouts (`..`) and absolute path traversals.
4. Interactively displays the proposed directory tree and file count, requesting user approval (`[Y/N]`) before disk operations.

### 5.4 The `.rapidfire.json` Project Manifest
Every scaffolded project includes a root metadata manifest `.rapidfire.json`:
```json
{
  "name": "myapp",
  "frontend": "react",
  "backend": "fastapi",
  "generationMode": "predefined",
  "createdAt": "2026-10-12T19:30:00.000Z",
  "rapidfireVersion": "0.1.25"
}
```
This enables downstream commands (`preset`, `deploy`, `push`) to identify project structure and dependencies deterministically.

---

## 6. DevSecOps Security Engine and In-Flight Secret Guardrail

```
[Developer triggers: git add . push -m -commit "Add auth service"]
                               |
                               v
               +-------------------------------+
               | Git Push Transaction Captured |
               +-------------------------------+
                               |
                               v
               +-------------------------------+
               |  Gitleaks In-Flight Scanner   |
               | (160+ Token & Entropy Rules)  |
               +-------------------------------+
                               |
                +--------------+--------------+
                |                             |
                v                             v
       [Secret Detected]              [Clean Codebase]
                |                             |
                v                             v
   +-------------------------+   +-------------------------+
   |   BLOCK PUSH IN-FLIGHT  |   | Stage files (git add .) |
   | - Red-flag diagnostics  |   | Create Git Commit       |
   | - Print file & line num |   | Push to Remote Origin   |
   | - Abort Git transaction |   +-------------------------+
   | - Zero packets to remote|                |
   +-------------------------+                v
                                 [Remote Repository Updated]
```

### 6.1 Shift-Left In-Flight Interception
Traditional continuous integration scanners operate after code reaches GitHub. RapidFire intercepts git transactions locally on the developer machine:
- Detects whether Gitleaks is installed on the host system.
- Installs an automated pre-push hook (`.git/hooks/pre-push`) upon project scaffolding.
- Evaluates staged diffs against 160+ token rules (AWS Access Keys, GitHub Personal Access Tokens, OpenAI keys, private SSH keys, Slack webhooks, database connection strings).
- If a high-entropy secret is identified, RapidFire halts the push immediately, outputs file and line diagnostics, and prevents network transmission.

### 6.2 Pre-Flight LTS & System Prerequisite Checker
RapidFire verifies that runtime requirements are satisfied before project scaffolding begins:
- Validates Node.js runtime version against Long-Term Support (LTS) minimums.
- Verifies system package managers (`npm`, `pip`, `python3`).
- Detects developer tooling (`git`, `gh`, `vercel`) and informs developers with actionable installation instructions.

---

## 7. Unified Git and GitHub Automation Subsystem

```
                         [Developer runs: setup <recipe> <folder>]
                                             |
                                             v
                             +-------------------------------+
                             |    Monorepo Detection Check   |
                             |      (getParentGitRepo)       |
                             +-------------------------------+
                                             |
                              +--------------+--------------+
                              |                             |
                              v                             v
                   [Inside Parent Git Repo]      [Clean Standalone Folder]
                              |                             |
                              v                             v
                 +--------------------------+  +--------------------------+
                 | Skip Nested .git Creation|  | Prompt: Initialize Git?  |
                 | (Prevents Broken Subtree)|  | (y/n confirmation gate)  |
                 +--------------------------+  +--------------------------+
                                                            |
                                              +-------------+-------------+
                                              |                           |
                                              v                           v
                                        [User: 'y']                 [User: 'n']
                                              |                           |
                                              v                           v
                                 +--------------------------+  +----------------------+
                                 | git init -b main         |  | Clean workspace      |
                                 | Install Gitleaks Hook    |  | Zero .git created    |
                                 | Prompt: Remote GitHub?   |  +----------------------+
                                 +--------------------------+
                                              |
                               +--------------+--------------+
                               |                             |
                               v                             v
                         [User: 'y']                   [User: 'n']
                               |                             |
                               v                             v
                  +--------------------------+  +--------------------------+
                  | gh repo create --push    |  | Skip remote repository   |
                  | (Auto-links origin/main) |  | Local Git tracking only  |
                  +--------------------------+  +--------------------------+
```

### 7.1 Monorepo Guardrail and Nested Git Prevention
When scaffolding projects inside existing repositories (monorepos, multi-package repositories, or university assignment trees), standard scaffolding tools blindly execute `git init`, creating nested `.git` folders that turn subdirectories into broken submodules.

RapidFire implements `getParentGitRepo()` in `src/utils/gitContext.js`:
- Traverses the directory hierarchy upwards looking for a `.git` marker.
- If a parent Git repository is detected, RapidFire skips local `git init` and informs the user, keeping the monorepo structure intact.
- If no parent repository is detected, RapidFire presents an explicit confirmation prompt (`y/N`) before initializing version control.

### 7.2 Automatic GitHub CLI Integration
When the developer approves Git initialization in an authenticated environment (`gh auth status`), RapidFire automates the five-step setup:
1. `git init -b main`
2. Installs the `.git/hooks/pre-push` Gitleaks security hook.
3. Automatically triggers `gh repo create <project-name> --source=. --remote=origin --push`.
4. Establishes upstream tracking (`main -> origin/main`).

### 7.3 Unified Push Command
RapidFire replaces multi-step staging and pushing with a single command syntax:
```bash
git add . push -m -commit "Initial project scaffold"
```
Supports custom branch branching on the fly:
```bash
git add . push -b feature1 -commit "Implement auth middleware"
```
If executed in a folder without version control, RapidFire asks the user whether to initialize Git on demand before proceeding.

---

## 8. Multi-Provider AI Intelligence Layer

RapidFire features a pluggable AI architecture supporting major cloud LLM providers as well as fully offline local inference engines:

```
+----------------------------------------------------------------------------------------------------+
|                                  MULTI-PROVIDER AI SUBSYSTEM                                       |
|                                                                                                    |
|    +----------------------+     +-----------------------+     +-------------------------------+    |
|    |    Google Gemini     |     |      Groq Cloud       |     |        OpenAI / Local         |    |
|    | - Gemini 2.0 Flash   |     | - Llama 3.3 70B       |     | - GPT-4o                      |    |
|    | - Gemini 1.5 Flash   |     | - Llama 3.1 8B        |     | - Ollama (Local Offline)      |    |
|    +----------------------+     +-----------------------+     +-------------------------------+    |
|               |                             |                                 |                    |
|               +-----------------------------+---------------------------------+                    |
|                                             |                                                      |
|                                             v                                                      |
|                             +-------------------------------+                                      |
|                             |   Unified AI Provider Router  |                                      |
|                             |      (src/ai/provider.js)     |                                      |
|                             +-------------------------------+                                      |
|                                             |                                                      |
|                     +-----------------------+-----------------------+                              |
|                     |                                               |                              |
|                     v                                               v                              |
|       +----------------------------+                 +----------------------------+                |
|       | Conversation Memory Buffer |                 | Dangerous Command Sanitizer|                |
|       | - Multi-turn context       |                 | - Regex injection filter   |                |
|       | - Terminal error tracking  |                 | - Blocks rm -rf, sudo, dd  |                |
|       | - Project manifest binding |                 | - Interactive [Y/N] gate   |                |
|       +----------------------------+                 +----------------------------+                |
+----------------------------------------------------------------------------------------------------+
```

### 8.1 Supported Providers
1. **Google Gemini**: Gemini 2.0 Flash / Gemini 1.5 Flash (default for speed, token capacity, and reasoning).
2. **Groq Cloud**: Ultra-low-latency inference using Llama 3.3 70B Versatile and Llama 3.1 8B.
3. **OpenAI**: GPT-4o / GPT-4o-mini for general development tasks.
4. **Local Ollama**: 100% offline local inference (e.g. `llama3`, `mistral`, `codellama`), ensuring zero data leaves the host.

### 8.2 Automatic Key Detection
API keys are configured using the unified `key <api-key>` command. RapidFire detects the provider automatically by key structure:
- `AIza...` -> Google Gemini
- `gsk_...` -> Groq Cloud
- `sk-...` -> OpenAI
Credentials are saved locally in `~/.rapidfire/config.json`.

### 8.3 Contextual Memory Buffer and Terminal Error Binding
The AI subsystem maintains an active conversation memory buffer (`src/ai/provider.js`). When developers encounter build or runtime errors in their persistent shell session, running `ask "how do I fix this error?"` automatically extracts the last 50 lines of terminal stdout/stderr, binds the active `.rapidfire.json` manifest, and constructs a grounded prompt without requiring manual copy-pasting.

### 8.4 Command Sanitizer and Interactive Execution Guard
When AI suggests a shell command (via `tell` or `suggest`), RapidFire passes the string through a strict regex sanitizer (`src/utils/sanitizer.js`) that automatically flags dangerous commands:
- Recursive file deletion (`rm -rf /`, `rm -rf *`)
- Disk formatting and raw writes (`mkfs`, `dd`)
- Privilege escalation (`sudo`)
- Fork bombs (`:(){ :|:& };:`)
All executable AI recommendations require explicit interactive user confirmation (`[Y/N]`) before execution.

---

## 9. Workspace Presets and Deterministic Snapshot Engine

RapidFire provides a deterministic snapshot system allowing developers to serialize, save, and recreate project environments without checking bulky dependencies into version control.

### 9.1 Saving Workspace Presets
```bash
save preset mytemplate [folder]
```
The preset engine (`src/commands/preset.js`):
1. Resolves the target directory (supporting smart relative path resolution from subfolders).
2. Reads project structure, framework configuration, source files, and the `.rapidfire.json` manifest.
3. Automatically ignores generated and transient directories (`node_modules`, `venv`, `.git`, `dist`, `build`, cache files).
4. Serializes the snapshot into a portable JSON schema stored at `~/.rapidfire/presets/<name>.json`.

### 9.2 Loading Workspace Presets
```bash
load preset mytemplate ./new_project
```
Reads the JSON schema, recreates the directory tree, writes all files, restores the manifest, and configures the environment deterministically across developer workstations.

---

## 10. Bidirectional Shell History and Live Syntax Highlighting

### 10.1 Shell History Synchronization
Upon booting the REPL, RapidFire inspects host shell history files:
- Linux / macOS: `~/.bash_history`, `~/.zsh_history`
- Windows: PowerShell `ConsoleHost_history.txt`
It populates the Readline history buffer, allowing developers to use Up/Down arrow keys seamlessly to access previously executed commands from their standard terminal.

### 10.2 Live Real-Time Syntax Highlighting
RapidFire hooks into Readline's internal output stream (`rl._writeToOutput`), parsing command tokens in real time:
- Built-in commands (`setup`, `push`, `ask`, `deploy`): Highlighted in cyan.
- Known shell binaries (`git`, `npm`, `python`, `docker`, `ls`, `cd`): Highlighted in green.
- Flags and arguments (`-m`, `--version`, `-b`): Highlighted in yellow.
- Quoted strings (`"message"`): Highlighted in magenta.

---

## 11. Complete CLI Command Reference

### General & Session Commands
| Command | Usage | Description |
|---|---|---|
| `help` | `help` | Displays the interactive RapidFire manual and recipe catalog |
| `rapidfire` | `rapidfire` | Re-displays session banner, version status, and environment details |
| `clear` / `cls` | `clear` | Clears terminal screen buffer instantly and restores prompt |
| `version` / `-v` | `version` or `rapidfire -v` | Displays active RapidFire CLI version (`0.1.25`) |
| `exit` / `quit` | `exit` | Saves session history and exits the persistent shell cleanly |

### Scaffolding & Project Setup
| Command | Usage | Description |
|---|---|---|
| `setup <recipe> <folder>` | `setup react+fastapi myapp` | Scaffolds any of the 13 built-in full-stack stacks |
| `setup <fe>+<be> <folder>` | `setup svelte+fastapi myapp` | Composes unlisted framework pairings with CORS wiring |
| `setup <unknown> <folder>` | `setup astro myapp` | Dynamically synthesizes blueprints for unknown frameworks |
| `suggest` | `suggest` | Interactive framework recommendation wizard |

### Security & Git Automation
| Command | Usage | Description |
|---|---|---|
| `git add . push` | `git add . push -m -commit "msg"` | Single-step stage, commit, in-flight Gitleaks scan, and push |
| `git add . push -b` | `git add . push -b feat -commit "msg"` | Creates or switches to branch and pushes upstream |

### AI Assistance & Configuration
| Command | Usage | Description |
|---|---|---|
| `key <api-key>` | `key AIzaSy...` | Configures and auto-detects Gemini, Groq, or OpenAI API key |
| `key status` | `key status` | Displays active AI provider, model, and masked key status |
| `key clear` | `key clear` | Removes stored API credentials from local config |
| `ask <query>` | `ask "why is port 8000 busy?"` | Queries AI with active terminal context and error logs |
| `tell <instruction>` | `tell "create python script"` | Generates terminal commands with approval gate |
| `explain [file]` | `explain src/repl.js` | Explains project architecture or specific code files |

### Workspace Presets & Deployment
| Command | Usage | Description |
|---|---|---|
| `save preset <name>` | `save preset fullstack_starter` | Serializes current workspace structure to reusable JSON |
| `load preset <name>` | `load preset fullstack_starter ./app` | Deterministically restores workspace into target folder |
| `deploy vercel` | `deploy vercel [folder]` | Verifies clean working tree and deploys frontend via Vercel |

---

## 12. File-by-File Codebase Directory Architecture

```
rapidfire-cli/
├── bin/
│   └── rapidfire.js                  # CLI entrypoint; flag parser (-v, -h) and REPL launcher
├── src/
│   ├── ai/
│   │   ├── gemini.js                 # Google Gemini API connector
│   │   └── provider.js               # Multi-provider router, context memory buffer, key detector
│   ├── commands/
│   │   ├── ask.js                    # Terminal error context extraction and AI query dispatch
│   │   ├── deploy.js                 # Vercel deployment pipeline and working tree validator
│   │   ├── explain.js                # Codebase structure and file explanation command
│   │   ├── help.js                   # Formatted interactive manual and recipe matrix
│   │   ├── index.js                  # High-speed command matcher and routing controller
│   │   ├── key.js                    # API key validation, provider detection, and storage
│   │   ├── preset.js                 # Workspace preset serialization and deterministic loader
│   │   ├── push.js                   # Unified Git workflow, branch management, and Gitleaks gate
│   │   ├── setup.js                  # Scaffolding dispatcher for predefined recipes
│   │   ├── suggest.js                # Interactive framework suggestion wizard
│   │   └── tell.js                   # Natural language command translation and approval gate
│   ├── integrations/
│   │   ├── gh.js                     # GitHub CLI authentication and repo auto-creation
│   │   ├── gitleaks.js               # Gitleaks binary detection and pre-push hook installer
│   │   └── vercel.js                 # Vercel CLI runner and production build validator
│   ├── scaffolding/
│   │   ├── adapters/
│   │   │   ├── backend.js            # FastAPI, Express, Django, Flask backend emitters
│   │   │   └── frontend.js           # React, Vue, Svelte Vite frontend emitters
│   │   ├── dynamicEngine.js          # Dynamic AI blueprint synthesizer and path guardrail
│   │   └── planner.js                # 3-tier stack classifier (Predefined, Composed, Dynamic)
│   ├── utils/
│   │   ├── depInstaller.js           # Package installer with interactive security prompts
│   │   ├── fsHelpers.js              # Recursive directory copy, ignore lists, path utilities
│   │   ├── gitContext.js             # Monorepo detector (getParentGitRepo) and Git helpers
│   │   ├── highlighter.js            # Real-time ANSI syntax highlighting tokenizer
│   │   ├── history.js                # Bash, Zsh, and PowerShell history importer/exporter
│   │   ├── manifest.js               # .rapidfire.json manifest lifecycle and version reader
│   │   ├── prereqs.js                # Node LTS validator and toolchain dependency checker
│   │   ├── proc.js                   # Cross-platform process and Python executable resolver
│   │   └── sanitizer.js              # Malicious command regex filter and security validator
│   ├── repl.js                       # Interactive REPL, Readline interface, ConPTY filter
│   └── shell.js                      # Persistent PTY adapter, Windows PowerShell resolution
├── test/                             # 26 automated verification test suites
├── package.json                      # Version 0.1.25, CLI binary mapping, dependencies
└── README.md                         # Project documentation and usage guide
```

---

## 13. Verification and Master Test Suite Architecture (26 Test Suites)

RapidFire includes **26 comprehensive automated test suites** executed via `npm test` (`node test/test_all.js`), verifying all functional subsystems without manual testing:

```
======================================================
       RAPIDFIRE CLI MASTER VERIFICATION SUITE       
======================================================
▶ Running: test/test_helpers.js                  ✔ Passed
▶ Running: test/test_manifest.js                 ✔ Passed
▶ Running: test/test_integrations.js             ✔ Passed
▶ Running: test/test_ai.js                       ✔ Passed
▶ Running: test/test_ai_context.js               ✔ Passed
▶ Running: test/test_dep_security.js             ✔ Passed
▶ Running: test/test_presets.js                  ✔ Passed
▶ Running: test/test_smart_preset.js             ✔ Passed
▶ Running: test/test_deploy.js                   ✔ Passed
▶ Running: test/test_recipes.js                  ✔ Passed
▶ Running: test/test_new_recipes.js              ✔ Passed
▶ Running: test/test_standalone_frontends.js     ✔ Passed
▶ Running: test/test_interactive_suggest.js      ✔ Passed
▶ Running: test/test_pty_passthrough.js          ✔ Passed
▶ Running: test/test_cross_platform.js           ✔ Passed
▶ Running: test/test_tell.js                     ✔ Passed
▶ Running: test/test_venv_prompt.js              ✔ Passed
▶ Running: test/test_key_command.js              ✔ Passed
▶ Running: test/test_prereqs_and_lts.js          ✔ Passed
▶ Running: test/test_explain.js                  ✔ Passed
▶ Running: test/test_highlighter.js              ✔ Passed
▶ Running: test/test_history.js                  ✔ Passed
▶ Running: test/test_push_command.js             ✔ Passed
▶ Running: test/test_repl_prompt.js              ✔ Passed
▶ Running: test/test_dynamic_scaffolding.js      ✔ Passed
▶ Running: test/test_nested_git.js               ✔ Passed
======================================================
Summary: 26 passed, 0 failed (26 total)
ALL 26 TEST SUITES PASSED FLAWLESSLY!
======================================================
```

---

## 14. Academic Defense, Viva Voce and Technical Evaluation (25 Q&As)

#### Q1: What is the primary novelty of RapidFire CLI compared to existing tools like Yeoman or Create-React-App?
> **Answer**: Existing tools operate as one-shot file generators: they emit starter code and terminate, leaving environment isolation, CORS resolution, Git setup, and secret scanning to the user. RapidFire is a persistent **terminal overlay and unified developer environment**. It remains active as a shell REPL, keeping shell state intact while providing in-flight secret interception, multi-framework composition, and contextual AI directly inside the developer's everyday workflow.

#### Q2: How does RapidFire manage background processes without blocking terminal input?
> **Answer**: RapidFire is built on Node.js and `node-pty`, utilizing the asynchronous, non-blocking `libuv` event loop. The master pseudo-terminal file descriptor multiplexes user input (`stdin`) and process output (`stdout`/`stderr`) on separate event streams. When a background shell command runs, output events stream asynchronously while the Readline interface preserves cursor position and prompt readiness.

#### Q3: Why is local in-flight secret scanning superior to GitHub Actions secret scanning?
> **Answer**: GitHub Actions runs *after* code has been pushed to remote servers. Academic research (Meli et al., NDSS 2019) confirms that public GitHub commits are scraped by automated bot networks in under 60 seconds. Post-push alerts arrive after credentials are compromised. RapidFire shifts security completely left: it intercepts commits locally via Gitleaks pre-push hooks *before network packets leave the machine*, halting the push if high-entropy secrets are detected.

#### Q4: What happens if a secret is detected during `git add . push`?
> **Answer**: The push transaction is halted immediately. RapidFire prints a diagnostic report detailing the offending file path, line number, and matched token rule (e.g. `AWS Access Key ID Detected`). The remote repository remains untouched.

#### Q5: What is "CORS Hell", and how does RapidFire solve it automatically?
> **Answer**: Cross-Origin Resource Sharing (CORS) is a browser security mechanism that blocks web clients from fetching resources from a different origin (domain or port). In full-stack development, frontends run on port 5173 or 3000 while backends run on port 8000 or 5000. RapidFire automatically injects pre-configured CORS middleware (e.g. FastAPI `CORSMiddleware`, Django `django-cors-headers`, Express `cors()`) with matching origin ports upon scaffolding.

#### Q6: Can RapidFire function completely offline without internet connectivity?
> **Answer**: Yes. For all 13 core recipes (Tier 1) and composed pairings (Tier 2), RapidFire contains embedded, zero-dependency local templates. It scaffolds project directories, sets up CORS, creates Python virtual environments, and installs Gitleaks hooks without network requests. Offline AI inference is supported via local Ollama.

#### Q7: How does RapidFire protect developers from dangerous or hallucinated AI commands?
> **Answer**: RapidFire routes all AI-suggested commands through a regex security sanitizer (`src/utils/sanitizer.js`). It automatically blocks destructive patterns such as recursive deletion (`rm -rf`), disk formatting (`mkfs`, `dd`), privilege escalation (`sudo`), and fork bombs. Furthermore, RapidFire never auto-executes AI commands silently; it mandates explicit interactive user approval (`[Y/N]`).

#### Q8: How does RapidFire resolve shell execution across Windows, macOS, and Linux?
> **Answer**: RapidFire detects `process.platform`. On Linux, it spawns `/bin/bash --login`; on macOS, it spawns `/bin/zsh -l`. On Windows, it explicitly spawns `powershell.exe -NoLogo -NoProfile -Command -` instead of `cmd.exe`, providing PowerShell semantics and avoiding invalid flag errors.

#### Q9: What are ConPTY escape sequences and why must they be sanitized on Windows?
> **Answer**: ConPTY (Windows Pseudoconsole) emits win32-input-mode sequences (`\x1b[?9001h/l`) and focus reporting codes (`\x1b[?1004h/l`). In raw terminal streams, these sequences bleed into user input lines as visible characters. RapidFire emits control codes to disable these modes and applies a real-time regex filter to strip lingering sequences before rendering.

#### Q10: How does RapidFire prevent broken submodules in existing repositories (monorepos)?
> **Answer**: RapidFire inspects the directory hierarchy using `getParentGitRepo()`. If a parent `.git` folder is discovered, it skips local `git init` to prevent broken nested submodules. If no parent repository exists, it asks the user for explicit confirmation before initializing version control.

#### Q11: How does the 3-tier scaffolding engine classify incoming setup requests?
> **Answer**: `StackPlanner` evaluates the recipe string:
> - **Tier 1 (Predefined)**: Matches exact registered stacks (e.g. `react+fastapi`).
> - **Tier 2 (Composed)**: Splits on `+` and assembles registered frontend and backend adapters.
> - **Tier 3 (Dynamic)**: For unknown frameworks (e.g. `astro`, `solid`), queries AI for an atomic JSON blueprint, validates paths, and prompts for user confirmation.

#### Q12: How does RapidFire prevent path traversal attacks in AI-generated blueprints?
> **Answer**: `dynamicEngine.js` verifies every target file path using `path.resolve` and `path.relative`. Any path containing parent directory traversal (`..`), null bytes, or absolute filesystem roots outside the target folder is rejected immediately.

#### Q13: What is the `.rapidfire.json` manifest file?
> **Answer**: A standardized metadata file generated in the project root. It records project name, frontend framework, backend framework, generation tier, creation timestamp, and RapidFire version, enabling preset serialization and intelligent project upgrades.

#### Q14: How are workspace presets saved and restored?
> **Answer**: Running `save preset <name> [folder]` reads the directory, filters out ignored directories (`node_modules`, `venv`, `.git`), and serializes code and manifest into `~/.rapidfire/presets/<name>.json`. Running `load preset <name> <folder>` deserializes the JSON schema and deterministically reconstructs the project.

#### Q15: How does RapidFire integrate with the GitHub CLI (`gh`)?
> **Answer**: When Git initialization is approved, RapidFire checks `gh auth status`. If authenticated, it runs `gh repo create <project-name> --source=. --remote=origin --push`, eliminating manual browser repository creation.

#### Q16: How does RapidFire achieve real-time syntax highlighting in a terminal?
> **Answer**: It hooks into Readline's internal `_writeToOutput` stream. The tokenizer parses commands in real time, coloring recognized RapidFire commands in cyan, shell binaries in green, flags in yellow, and strings in magenta.

#### Q17: How is shell history synchronized across sessions?
> **Answer**: At startup, `src/utils/history.js` reads host history files (`~/.bash_history`, `~/.zsh_history`, or PowerShell `ConsoleHost_history.txt`) and pre-populates Readline's history buffer, allowing standard Up/Down arrow navigation.

#### Q18: What multi-provider AI options does RapidFire support?
> **Answer**: Google Gemini (Gemini 2.0 Flash / 1.5 Flash), Groq Cloud (Llama 3.3 70B / Llama 3.1 8B), OpenAI (GPT-4o), and local Ollama. API keys are auto-detected by prefix (`AIza`, `gsk_`, `sk-`).

#### Q19: How does the AI context memory buffer work during terminal errors?
> **Answer**: RapidFire captures recent terminal stdout and stderr. When `ask` is invoked, it binds the last 50 lines of terminal error output along with project metadata from `.rapidfire.json`, constructing a grounded prompt without manual copy-pasting.

#### Q20: How does RapidFire handle Python virtual environments across operating systems?
> **Answer**: It detects the platform and Python binary (`python3` or `python`). On Linux/macOS, it resolves `venv/bin/python`; on Windows, `venv\Scripts\python.exe`. It configures virtual environments during scaffolding and verifies path resolution before running pip commands.

#### Q21: What is the intellectual property and licensing status of RapidFire?
> **Answer**: RapidFire is released under the **MIT License**. Under Section 3(k) of the Indian Patents Act, 1970, and 35 U.S.C. § 101, pure software algorithms and command interfaces face high patent barriers. RapidFire establishes open-source prior art, protecting the codebase under Copyright Law and the brand under Trademark Law.

#### Q22: Why was Node.js selected instead of Python or Go for the CLI implementation?
> **Answer**: Node.js provides the asynchronous, non-blocking `libuv` event loop, ideal for multiplexing concurrent terminal streams (`stdin`, `stdout`, `stderr`, PTY streams) without thread locking. Furthermore, npm is the primary package ecosystem for modern full-stack web developers, enabling zero-friction global distribution via `npm install -g rapidfire-cli`. Native C++ bindings via `node-pty` deliver raw kernel-level terminal performance.

#### Q23: How many automated test suites validate RapidFire, and what do they cover?
> **Answer**: RapidFire is validated by **26 automated test suites** in the `/test` directory. They cover config helpers, manifest lifecycles, Gitleaks secret interception, multi-provider AI queries, dependency security validation, preset serialization, 13 core scaffolding recipes, dynamic 3-tier scaffolding, monorepo nested Git prevention, cross-platform terminal resolution, and Windows ConPTY escape sequence filtering.

#### Q24: What is the purpose of the non-interactive CLI flags `-v` and `--help`?
> **Answer**: Non-interactive flags allow external scripts, CI pipelines, and developers to query version (`rapidfire -v`) or read documentation (`rapidfire -h`) without launching the interactive REPL session.

#### Q25: What is the future development roadmap for RapidFire?
> **Answer**:
> 1. Automated Docker and Docker Compose containerization recipe generators.
> 2. Native package distribution via Homebrew (`brew install rapidfire`) and Arch Linux AUR.
> 3. Collaborative remote terminal pairing over encrypted WebSockets for peer debugging.
> 4. Dynamic Node runtime version switching (`rapidfire runtime use node --lts`).

---

*Authored by the RapidFire CLI Engineering Team*  
*Greater Noida Institute of Technology (GNIOT) | AKTU Lucknow*
