## 1. Overview & Primary Role
`FEATURE_CHECKLIST.md` serves as the master tracking and engineering specification document for RapidFire CLI. It outlines existing capabilities, core architecture pipelines, language adapter requirements, security rules, and feature decommissioning priorities to guide systematic, incremental development.

---

## 2. Key Components & Functions
- **Current State Audit (§1):** Documents baseline features carried over from the legacy README that require active verification against the current codebase.
- **Language-Neutral Pipeline (§2):** Establishes functional requirements for file scanning, Tree-sitter WASM parsing, graph generation, role assignment, and entry-point detection.
- **Language Adapter Matrix (§3):** Defines a strict implementation standard across 13 programming languages (requiring grammar, golden fixtures, import resolution, and unseen repo testing).
- **AI & Command Layers (§4–§5):** Specifies integration parameters for prompt generation, local `.rapidfire/` caching, strict context citation verification (`[path:start-end]`), and core commands (`explain`, `ask`, `profile`).
- **Profiles & Security (§6–§7):** Defines behavioral modifiers (`learner` vs. `developer` modes) alongside strict data privacy protocols (automatic secret redaction and exclusion of sensitive files like `.env` or SSH keys).
- **Quality Assurance & Scope Management (§8–§14):** Establishes testing criteria, performance budgets (≤60s cold run, ≤5s cached run), pilot evaluation metrics, explicitly deferred features, and a deterministic feature-cutting order for time crunches.

---

## 3. Dependencies & Connections
- **Documentation Ecosystem:** Acts as the direct execution companion to `PROJECT_CONTEXT.md` (architectural "why/what") and `PROJECT_DETAILS.md` (implementation "how").
- **Contracts:** Enforces the structural specifications defined in `types.md` (governing graph schemas and module signatures).
- **External Tooling Dependencies:** References `web-tree-sitter` (WASM-based parsing), Gitleaks (secret scanning), and external AI model providers.

---

## 4. Notable Architecture / Logic
- **Incremental Adapter Adoption:** Enforces a strict rule where language adapters are only marked complete when all test phases—from grammar compilation to real-world repository validation—pass.
- **Offline Degradation Design:** Mandates robust fallback behaviors; if AI services fail or `--offline` flags are passed, the system gracefully degrades to graph-only outputs or local regex processing.
- **Defensive Prompt Engineering:** Implements strict data safety logic, treating local repository contents as untrusted input data to mitigate prompt-injection vulnerabilities and accidental secret exfiltration.