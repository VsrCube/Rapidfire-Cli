const path = require('path');

function getVersion() {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '0.1.32';
  } catch {
    return '0.1.32';
  }
}

function showHelp(args = []) {
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const magenta = '\x1b[35m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  const tokens = Array.isArray(args) ? args : String(args || '').trim().split(/\s+/).filter(Boolean);
  const rawTopic = tokens[0] ? tokens[0].replace(/[<>]/g, '').trim().toLowerCase() : '';
  const version = getVersion();

  // Focused topic-level help
  if (rawTopic) {
    if (rawTopic === 'setup' || rawTopic === 'recipe' || rawTopic === 'recipes' || rawTopic === 'scaffold') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE SETUP & SCAFFOLDING MANUAL                 ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Scaffold production-grade architectures in under 3 seconds with pinned LTS runtimes,
  pre-configured CORS headers, virtualenv setup, and Git initialization.

${bold}CONNECTED FULL-STACK RECIPES (Frontend + Backend):${reset}
  ${green}setup react+fastapi <folder>${reset}    React (Vite) + FastAPI (Async Python)
  ${green}setup react+django <folder>${reset}     React (Vite) + Django REST backend with SQLite
  ${green}setup react+node <folder>${reset}       React (Vite) + Express Node.js backend
  ${green}setup react+flask <folder>${reset}      React (Vite) + Flask Python backend
  ${green}setup vue+fastapi <folder>${reset}      Vue 3 (Vite) + FastAPI (Async Python)
  ${green}setup vue+node <folder>${reset}         Vue 3 (Vite) + Express Node.js backend
  ${green}setup vue+django <folder>${reset}       Vue 3 (Vite) + Django REST backend
  ${green}setup svelte+node <folder>${reset}      Svelte (Vite) + Express Node.js backend

${bold}STANDALONE FRONTENDS & BACKENDS:${reset}
  ${green}setup react <folder>${reset}           Standalone React (Vite) SPA
  ${green}setup vue <folder>${reset}             Standalone Vue 3 (Vite) SPA
  ${green}setup svelte <folder>${reset}          Standalone Svelte (Vite) SPA
  ${green}setup fastapi <folder>${reset}          Standalone high-performance FastAPI backend
  ${green}setup django <folder>${reset}           Standalone Django backend with SQLite

${bold}DYNAMIC & COMPOSED COMPOSITION:${reset}
  ${green}setup <fe>+<be> <folder>${reset}        Arbitrary stack pairings (e.g. svelte+fastapi, vue+flask)
  ${green}setup <unknown> <folder>${reset}        Dynamically scaffold any framework via AI/heuristic fallback
                                 (e.g. "setup astro myapp", "setup solid app", "setup nextjs web")

${bold}INTERACTIVE WIZARD:${reset}
  ${green}init [rapidfire]${reset}               Interactive scaffolding wizard with step-by-step prompts

${bold}EXAMPLES:${reset}
  ${dim}$ setup react+fastapi my-dashboard${reset}
  ${dim}$ setup svelte+fastapi my-ai-app${reset}
  ${dim}$ setup react my-portfolio${reset}
`);
      return;
    }

    if (rawTopic === 'push' || rawTopic === 'git' || rawTopic === 'github') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE UNIFIED GIT & GITHUB AUTOMATION            ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Stage files, execute pre-push GitLeaks secret auditing, commit, and push in a single
  unified command. Automatically recovers diverged remotes via rebase sync and creates
  missing GitHub repositories via GitHub CLI ('gh') with 1-click confirmation.

${bold}COMMAND SYNTAX:${reset}
  ${green}git add <files> push [-b <branch>|-m] -commit "<message>"${reset}
  ${green}add <files> push [-b <branch>|-m] -commit "<message>"${reset}
  ${green}push [-b <branch>|-m] -commit "<message>"${reset}

${bold}FLAGS & OPTIONS:${reset}
  ${cyan}-m / -main${reset}             Target the primary 'main' branch
  ${cyan}-b <branch> / -branch${reset}  Target a specific feature or release branch
  ${cyan}-commit "<msg>"${reset}        Specify the commit message (also accepts -message "<msg>")
  ${cyan}<files>${reset}                Specific file list or '.' for entire working tree

${bold}AUTOMATED GUARDRAILS & FEATURES:${reset}
  • ${bold}GitLeaks Pre-Push Audit:${reset} Scans staged diffs for private keys, AWS tokens, and secrets
  • ${bold}Automated Remote Link:${reset} If no remote exists, offers interactive 1-click 'gh repo create'
  • ${bold}Divergence Rebase Sync:${reset} Automatically fetches and rebases if remote is ahead of local branch

${bold}EXAMPLES:${reset}
  ${dim}$ git add . push -m -commit "Add server and auth routes"${reset}
  ${dim}$ add . push -m "Initial release v1.0.0"${reset}
  ${dim}$ push -b staging -commit "Fix hydration issue"${reset}
  ${dim}$ git add README.md push -m "Update docs"${reset}
`);
      return;
    }

    if (rawTopic === 'overview') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║              RAPIDFIRE REPOSITORY ARCHITECTURE OVERVIEW          ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Inspects the active repository or target directory to produce a living, publication-ready
  architectural report. Operates deterministically offline or with deep semantic AI reasoning.

${bold}COMMAND SYNTAX:${reset}
  ${magenta}overview [--critic] [folder]${reset}

${bold}MODES & OUTPUTS:${reset}
  ${magenta}overview [folder]${reset}             Generates standard architecture documentation
                                Exports to: ${bold}md/overview.md${reset}
                                Sections: Agenda, Use Cases, Key Features, Folder Architecture,
                                Pipeline Flowcharts, Module Details, Tech Stack, Conclusion.

  ${magenta}overview --critic [folder]${reset}    Executes comprehensive architectural critique & audit
                                Exports to: ${bold}md/overview_critic.md${reset}
                                Additional Sections: Security Audit, Things to Work On,
                                Pros & Cons Analysis, Critical Flaw Detection.

${bold}EXAMPLES:${reset}
  ${dim}$ overview${reset}
  ${dim}$ overview --critic${reset}
  ${dim}$ overview --critic ../backend-service${reset}
`);
      return;
    }

    if (rawTopic === 'explain') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE CODEBASE & MODULE EXPLAINER                ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Deeply inspects a single source file or entire directory architecture, explaining
  its architectural role, exported interfaces, dependencies, and execution flow.

${bold}COMMAND SYNTAX:${reset}
  ${magenta}explain [file|folder]${reset}

${bold}BEHAVIOR & EXPORTS:${reset}
  • ${bold}Source File Target:${reset} Explains functions, classes, imports, and purpose
  • ${bold}Directory / Root Target:${reset} Explains directory hierarchy, architecture, and module interactions
  • ${bold}Markdown Export:${reset} Automatically saves formatted report to ${bold}md/explanation.md${reset}
  • ${bold}Repository Memory:${reset} Logs analysis into .rapidfire/db.json for contextual history

${bold}EXAMPLES:${reset}
  ${dim}$ explain .${reset}
  ${dim}$ explain src/repl.js${reset}
  ${dim}$ explain "components/Navbar.jsx"${reset}
`);
      return;
    }

    if (rawTopic === 'key') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║            RAPIDFIRE AI PROVIDER & KEY MANAGEMENT                ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Configure and manage AI API keys. Automatically detects provider from token prefix
  and persists credentials securely in ~/.rapidfire/config.json.

${bold}COMMAND SYNTAX:${reset}
  ${magenta}key <api-key>${reset}                 Save or update API key (auto-detects provider)
  ${magenta}key model <model-name>${reset}        Override active model (e.g. "gpt-4o-mini", "gemini-1.5-flash")
  ${magenta}key status${reset}                    Show active provider, active model, masked key, and source
  ${magenta}key clear${reset}                     Securely remove stored API key credentials

${bold}SUPPORTED PROVIDERS:${reset}
  • ${bold}Google Gemini:${reset} Tokens starting with 'AIzaSy...'
  • ${bold}Groq Cloud:${reset}    Tokens starting with 'gsk_...'
  • ${bold}OpenAI:${reset}        Tokens starting with 'sk-...'

${bold}EXAMPLES:${reset}
  ${dim}$ key AIzaSyD...${reset}
  ${dim}$ key model gemini-1.5-flash${reset}
  ${dim}$ key status${reset}
  ${dim}$ key clear${reset}
`);
      return;
    }

    if (rawTopic === 'preset' || rawTopic === 'presets') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE WORKSPACE PRESETS & PORTABILITY            ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Serialize custom project structures, boilerplates, and configuration files into
  reusable, portable JSON presets stored in ~/.rapidfire/presets/.

${bold}COMMAND SYNTAX:${reset}
  ${yellow}save preset <name> [folder]${reset}    Serialize project tree and manifest into preset
  ${yellow}load preset <name> <folder>${reset}    Reconstruct workspace structure and files in 1 second
  ${yellow}presets${reset} / ${yellow}list presets${reset}          List all saved presets with file count & timestamps

${bold}EXAMPLES:${reset}
  ${dim}$ save preset my-base-api ./backend${reset}
  ${dim}$ presets${reset}
  ${dim}$ load preset my-base-api ./new-service${reset}
`);
      return;
    }

    if (rawTopic === 'run' || rawTopic === 'start' || rawTopic === 'serve') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE APPLICATION EXECUTION RUNNER               ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Launch dev servers for connected full-stack microservices or standalone apps.
  Automatically resolves backend (:8000/:5000) and frontend (:3000) ports and
  activates local Python virtual environments (.venv).

${bold}COMMAND SYNTAX:${reset}
  ${green}run [folder]${reset}                   Launch dev servers (aliases: 'start', 'serve')

${bold}EXAMPLES:${reset}
  ${dim}$ run${reset}
  ${dim}$ run ./my-app${reset}
  ${dim}$ start${reset}
`);
      return;
    }

    if (rawTopic === 'ask' || rawTopic === 'tell' || rawTopic === 'suggest') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE INTERACTIVE AI ASSISTANCE                  ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}COMMANDS:${reset}
  ${magenta}ask <question>${reset}                Technical Q&A with conversational memory & 1-click installer
  ${magenta}ask clear${reset}                     Reset multi-turn conversational context memory
  ${magenta}suggest <description>${reset}         Recommends architectural stack with (Y/N) scaffolding prompt
  ${magenta}tell <instruction>${reset}            Generates files & code with structure preview & (Y/N) approval

${bold}EXAMPLES:${reset}
  ${dim}$ ask "How do I setup JWT auth in FastAPI?"${reset}
  ${dim}$ suggest "real-time chat with websockets"${reset}
  ${dim}$ tell "create a utility function to validate email addresses"${reset}
  ${dim}$ ask clear${reset}
`);
      return;
    }

    if (rawTopic === 'deploy') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║             RAPIDFIRE PRODUCTION DEPLOYMENT                      ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}DESCRIPTION:${reset}
  Deploy your frontend application to Vercel production with clean working tree verification
  and pre-flight deployment checks.

${bold}COMMAND SYNTAX:${reset}
  ${cyan}deploy vercel [folder]${reset}         Deploy frontend to Vercel production

${bold}EXAMPLES:${reset}
  ${dim}$ deploy vercel${reset}
  ${dim}$ deploy vercel ./frontend${reset}
`);
      return;
    }

    if (rawTopic === 'help') {
      console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║                  RAPIDFIRE HELP COMMAND MANUAL                   ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}USAGE:${reset}
  ${cyan}help${reset}                           Display the comprehensive RapidFire CLI manual
  ${cyan}help <command>${reset}                 Display detailed documentation and examples for a command

${bold}AVAILABLE TOPICS:${reset}
  ${green}help setup${reset}                     Full-stack & standalone framework scaffolding recipes
  ${green}help push${reset}                      Unified Git staging, commit, GitLeaks scan, and push
  ${magenta}help overview${reset}                  Living repo architecture & --critic audits (md/overview.md)
  ${magenta}help explain${reset}                   Source file and directory tree architectural analysis
  ${magenta}help key${reset}                       AI provider & API key credentials management
  ${yellow}help presets${reset}                   Workspace structure serialization and restoration
  ${green}help run${reset}                       Microservice dev server runner (aliases: start, serve)
  ${magenta}help ask / tell / suggest${reset}      Interactive AI generation, code preview, and Q&A
  ${cyan}help deploy${reset}                    Production Vercel deployment guardrails
`);
      return;
    }
  }

  // Master, comprehensive manual
  console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║                     RAPIDFIRE CLI MANUAL                         ║
║         Persistent Shell Passthrough + Scaffolding REPL          ║
║                          Version ${version}                          ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}PROJECT SCAFFOLDING RECIPES (7 FRAMEWORKS / 13 OPTIONS):${reset}
  ${cyan}Connected Full-Stack Recipes:${reset}
    ${green}setup react+fastapi <folder>${reset}   React (Vite) + FastAPI (Async Python)
    ${green}setup react+django <folder>${reset}    React (Vite) + Django REST backend with SQLite
    ${green}setup react+node <folder>${reset}      React (Vite) + Express Node.js backend
    ${green}setup react+flask <folder>${reset}     React (Vite) + Flask Python backend
    ${green}setup vue+fastapi <folder>${reset}     Vue 3 (Vite) + FastAPI (Async Python)
    ${green}setup vue+node <folder>${reset}        Vue 3 (Vite) + Express Node.js backend
    ${green}setup vue+django <folder>${reset}      Vue 3 (Vite) + Django REST backend
    ${green}setup svelte+node <folder>${reset}     Svelte (Vite) + Express Node.js backend

  ${cyan}Standalone Frontends:${reset}
    ${green}setup react <folder>${reset}          Standalone React (Vite) project
    ${green}setup vue <folder>${reset}            Standalone Vue 3 (Vite) project
    ${green}setup svelte <folder>${reset}         Standalone Svelte (Vite) project

  ${cyan}Standalone Backends:${reset}
    ${green}setup fastapi <folder>${reset}         Standalone high-performance FastAPI backend
    ${green}setup django <folder>${reset}          Standalone Django backend with SQLite

  ${cyan}Dynamic & Composed Framework Scaffolding:${reset}
    ${green}setup <fe>+<be> <folder>${reset}       Arbitrary stack combinations (e.g. svelte+fastapi, vue+flask)
    ${green}setup <unknown> <folder>${reset}       Dynamically scaffold any framework via AI/heuristic fallback
                                  (e.g. astro, solid, nextjs, nestjs, hono, express)

  ${cyan}Initialization:${reset}
    ${green}init [rapidfire]${reset}              Interactive scaffolding guide & prompt wizard

${bold}AI CODE GENERATION & ARCHITECTURE:${reset}
  ${magenta}overview [--critic] [dir]${reset}     Living repo architecture overview (exports md/overview.md)
                                (--critic audits pros/cons, flaws, & security to md/overview_critic.md)
  ${magenta}explain [file|folder]${reset}         Analyze codebase architecture, folder tree, or source file role
                                (exports formatted report to md/explanation.md)
  ${magenta}tell <instruction>${reset}            Generate files & code with structure preview & (Y/N) safety approval
                                (e.g. "tell create 2 cpp files named m1 m2")
  ${magenta}suggest <description>${reset}         Recommend architecture stack with interactive (Y/N) scaffolding prompt
  ${magenta}ask <question>${reset}                Technical Q&A with conversational context & 1-click dependency installer
  ${magenta}ask clear${reset}                     Reset multi-turn conversational context memory

${bold}AI PROVIDER & API KEY CONFIGURATION:${reset}
  ${magenta}key <api-key>${reset}                 Save or update API key (auto-detects Groq, OpenAI, or Gemini)
  ${magenta}key model <model-name>${reset}        Override active model (e.g. "key model gpt-4o-mini", "gemini-1.5-flash")
  ${magenta}key status${reset}                    Show active provider, model, masked key, and config source
  ${magenta}key clear${reset}                     Remove saved credentials from ~/.rapidfire/config.json

${bold}PROJECT PRESETS & REPRODUCIBILITY:${reset}
  ${yellow}save preset <name> [folder]${reset}    Serialize project tree, files, and manifest into ~/.rapidfire/presets/
  ${yellow}load preset <name> <folder>${reset}    Restore project structure and files from saved JSON preset
  ${yellow}presets${reset} / ${yellow}list presets${reset}          List all saved project presets with timestamps & file counts

${bold}GIT & GITHUB AUTOMATION:${reset}
  ${green}git add <files> push [-b <branch>|-m] -commit "msg"${reset}
  ${green}add <files> push [-b <branch>|-m] -commit "msg"${reset}
  ${green}push [-b <branch>|-m] -commit "msg"${reset}
                                Stage files (or .), GitLeaks scan, commit, and push in one command
                                • Push to main: "git add . push -m -commit 'Add server module'"
                                • Current branch: "push -m 'Update user dashboard'"
                                • Specific branch: "push -b feature1 -commit 'new feature'"
                                • Shorthand: "git add . push -main -commit 'msg'"
                                • Single file: "git add README.md push -m 'updated docs'"
                                • Automated GitLeaks scan prevents accidental credential leaks
                                • Automatically recovers and syncs via rebase if remote is ahead
                                • Automatically links remote repository via GitHub CLI (gh) if needed

${bold}PRODUCTION DEPLOYMENT:${reset}
  ${cyan}deploy vercel [folder]${reset}         Deploy frontend to Vercel production with clean working tree verification

${bold}APPLICATION EXECUTION & RUNNER:${reset}
  ${green}run [folder]${reset}                    Launch microservice dev servers (FastAPI / Express + React / Vue / Svelte)
                                Aliases: ${green}start${reset}, ${green}serve${reset}. Resolves ports (:8000/:5000 and :3000)
  ${green}build [folder]${reset}                  Execute production build for frontend or full-stack application

${bold}SESSION & UTILITY COMMANDS:${reset}
  ${cyan}help [command]${reset}                 Display this command reference or focused help (e.g. "help push")
  ${cyan}clear${reset} / ${cyan}cls${reset}                     Clear terminal screen buffer instantly
  ${cyan}version${reset} / ${cyan}-v${reset} / ${cyan}--version${reset}        Display active RapidFire CLI version (${version})
  ${cyan}rapidfire${reset} / ${cyan}rapidfire-cli${reset}      Re-display session banner and status within active REPL
  ${cyan}exit${reset} / ${cyan}quit${reset}                    Exit Rapidfire cleanly

${bold}SHELL PASSTHROUGH:${reset}
  ${dim}Any other command (e.g. ls, git, pwd, cd, docker, npm, python, pip, gh, curl) executes
  directly inside the persistent background pseudo-terminal. Working directory,
  environment variables, and shell state are fully preserved.${reset}

${dim}Tip: Run "help <command>" (e.g. "help setup", "help push", "help key") for in-depth examples.${reset}
`);
}

module.exports = {
  showHelp
};
