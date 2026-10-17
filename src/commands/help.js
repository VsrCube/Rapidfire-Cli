function showHelp() {
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const magenta = '\x1b[35m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(`
${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗
║                     RAPIDFIRE CLI MANUAL                         ║
║         Persistent Shell Passthrough + Scaffolding REPL          ║
╚══════════════════════════════════════════════════════════════════╝${reset}

${bold}PROJECT SCAFFOLDING RECIPES (7 FRAMEWORKS / 13 OPTIONS):${reset}
  ${cyan}Connected Full-Stack Recipes:${reset}
    ${green}setup react+fastapi <folder>${reset}   React (Vite) + FastAPI (Async Python)
    ${green}setup react+django <folder>${reset}    React (Vite) + Django REST backend
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
    ${green}setup <unknown> <folder>${reset}       Dynamically scaffold any framework (e.g. astro, solid, nextjs, nestjs)
    ${green}setup <fe>+<be> <folder>${reset}       Arbitrary stack combinations (e.g. svelte+fastapi, vue+flask)

  ${cyan}Initialization:${reset}
    ${green}init [rapidfire]${reset}              Interactive scaffolding guide & prompt

${bold}AI CODE GENERATION & ASSISTANCE:${reset}
  ${magenta}overview [--critic]${reset}          Comprehensive repo architecture overview (exports md/overview.md)
                                (--critic audits pros/cons/flaws to md/overview_critic.md)
  ${magenta}explain [file|folder]${reset}         Analyze codebase architecture, folder tree, or source file role
                                (e.g. "explain src/repl.js" or "explain .")
  ${magenta}tell <instruction>${reset}            Generate files & code with structure preview & (Y/N) safety approval
                                (e.g. "tell create 2 cpp files named m1 m2")
  ${magenta}suggest <description>${reset}         Recommend architecture stack with interactive (Y/N) scaffolding prompt
  ${magenta}ask <question>${reset}                Technical Q&A with conversational context & 1-click dependency installer
  ${magenta}ask clear${reset}                     Reset multi-turn conversational context memory

${bold}AI PROVIDER & API KEY CONFIGURATION:${reset}
  ${magenta}key <api-key>${reset}                 Save or update API key (auto-detects Groq, OpenAI, or Gemini)
  ${magenta}key model <model-name>${reset}        Override active model (e.g. "key model gpt-4o-mini")
  ${magenta}key status${reset}                    Show active provider, model, masked key, and config source
  ${magenta}key clear${reset}                     Remove saved credentials from ~/.rapidfire/config.json

${bold}PROJECT PRESETS & REPRODUCIBILITY:${reset}
  ${yellow}save preset <name> [folder]${reset}    Serialize project tree, files, and manifest into ~/.rapidfire/presets/
  ${yellow}load preset <name> <folder>${reset}    Restore project structure and files from saved JSON preset
  ${yellow}presets${reset} / ${yellow}list presets${reset}          List all saved project presets

${bold}GIT & GITHUB AUTOMATION:${reset}
  ${green}git add <files> push [-b <branch>|-m] -commit "msg"${reset}
                                Stage files (or .), commit, and push in one unified command
                                • Push to main: "git add . push -m -commit 'Add server module'"
                                • Current branch: "git add . push -m 'Add server module'"
                                • Specific branch: "git add . push -b feature1 -commit 'new feature'"
                                • Shorthand: "git add . push -main -commit 'msg'"
                                • Single file: "git add README.md push -m 'updated docs'"
                                • Automatically recovers and syncs via rebase if remote is ahead
                                • Automatically links remote repository via GitHub CLI (gh) if needed

${bold}PRODUCTION DEPLOYMENT:${reset}
  ${cyan}deploy vercel [folder]${reset}         Deploy frontend to Vercel production with clean working tree verification

${bold}APPLICATION EXECUTION & RUNNER:${reset}
  ${green}run [folder]${reset}                    Launch microservice dev servers (FastAPI / Express + React / Vue / Svelte)
                                Automatically resolves backend port (:8000/:5000) and frontend port (:3000)

${bold}SESSION COMMANDS:${reset}
  ${cyan}help${reset}                           Display this command reference
  ${cyan}exit${reset} / ${cyan}quit${reset}                    Exit Rapidfire cleanly

${bold}SHELL PASSTHROUGH:${reset}
  ${dim}Any other command (e.g. ls, git, pwd, cd, docker, npm, python, pip, gh) executes
  directly inside the persistent background pseudo-terminal. Working directory,
  environment variables, and shell state are fully preserved.${reset}
`);
}

module.exports = {
  showHelp
};
