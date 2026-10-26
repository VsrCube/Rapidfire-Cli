const readline = require('readline');
const { handleSetup } = require('./setup');

const STACK_PRESETS = [
  { id: '1', key: 'react+fastapi', label: 'React (Vite) + FastAPI (Python)' },
  { id: '2', key: 'react+node', label: 'React (Vite) + Node (Express)' },
  { id: '3', key: 'react+django', label: 'React (Vite) + Django (Python)' },
  { id: '4', key: 'vue+fastapi', label: 'Vue 3 (Vite) + FastAPI (Python)' },
  { id: '5', key: 'vue+node', label: 'Vue 3 (Vite) + Node (Express)' },
  { id: '6', key: 'react', label: 'Standalone React (Vite)' },
  { id: '7', key: 'vue', label: 'Standalone Vue 3 (Vite)' },
  { id: '8', label: 'Standalone Svelte (Vite)', key: 'svelte' },
  { id: '9', key: 'fastapi', label: 'Standalone FastAPI (Python)' },
  { id: '10', key: 'django', label: 'Standalone Django (Python)' }
];

async function askQuestion(context, question, defaultAnswer = '') {
  if (process.env.RAPIDFIRE_NON_INTERACTIVE === '1') {
    return defaultAnswer;
  }

  let answer = '';
  if (context && typeof context.ask === 'function') {
    answer = await context.ask(question);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(question, (ans) => resolve(ans));
    });
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    answer = await new Promise((resolve) => {
      rl.question(question, (ans) => {
        rl.close();
        resolve(ans);
      });
    });
  }

  const trimmed = answer ? answer.trim() : '';
  return trimmed || defaultAnswer;
}

async function runInitWizard(context = {}, args = []) {
  const bold = '\x1b[1m';
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const reset = '\x1b[0m';

  console.log(`\n${bold}${cyan}╔════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${cyan}║           RAPIDFIRE INTERACTIVE SCAFFOLDING WIZARD             ║${reset}`);
  console.log(`${bold}${cyan}╚════════════════════════════════════════════════════════════════╝${reset}\n`);

  console.log(`${bold}Choose an architecture or framework recipe:${reset}`);
  for (const item of STACK_PRESETS) {
    console.log(`  ${green}${item.id.padStart(2)})${reset} ${item.label.padEnd(36)} ${cyan}(setup ${item.key})${reset}`);
  }
  console.log(`  ${green}11)${reset} Custom / Dynamic Pairing            ${cyan}(e.g. next, astro, svelte+node)${reset}\n`);

  const choiceInput = await askQuestion(context, `${bold}Select option [1-11] (default: 1): ${reset}`, '1');

  let selectedStack = 'react+fastapi';
  const matched = STACK_PRESETS.find((p) => p.id === choiceInput || p.key === choiceInput.toLowerCase());
  if (matched) {
    selectedStack = matched.key;
  } else if (choiceInput === '11' || choiceInput.toLowerCase() === 'custom') {
    const customStack = await askQuestion(context, `${bold}Enter framework name or pairing (e.g. next, solid, svelte+node): ${reset}`, 'next');
    selectedStack = customStack.toLowerCase();
  } else if (choiceInput) {
    selectedStack = choiceInput.toLowerCase();
  }

  const defaultFolder = `rapidfire-${selectedStack.replace(/\+/g, '-')}`;
  let folderName = args[0] || '';
  if (!folderName) {
    folderName = await askQuestion(context, `${bold}Enter project folder name (default: ${defaultFolder}): ${reset}`, defaultFolder);
  }

  const initGitAns = await askQuestion(context, `${bold}Initialize Git repository & GitLeaks security hook? (Y/n): ${reset}`, 'y');
  const shouldInitGit = initGitAns.toLowerCase().startsWith('y');
  if (shouldInitGit) {
    process.env.RAPIDFIRE_AUTO_GIT = '1';
  } else {
    process.env.RAPIDFIRE_AUTO_GIT = '0';
  }

  const isPython = selectedStack.includes('fastapi') || selectedStack.includes('django') || selectedStack.includes('flask');
  if (isPython) {
    const venvAns = await askQuestion(context, `${bold}Create Python virtual environment (.venv)? (Y/n): ${reset}`, 'y');
    if (venvAns.toLowerCase().startsWith('y')) {
      process.env.RAPIDFIRE_AUTO_VENV = '1';
    } else {
      process.env.RAPIDFIRE_AUTO_VENV = '0';
    }
  }

  console.log(`\n${bold}${green}[rapidfire-wizard] Launching scaffolding engine:${reset} setup ${selectedStack} ${folderName}\n`);
  return await handleSetup([selectedStack, folderName], context);
}

module.exports = {
  STACK_PRESETS,
  askQuestion,
  runInitWizard
};
