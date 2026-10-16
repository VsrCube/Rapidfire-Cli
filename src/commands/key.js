const { saveUserConfig, getUserConfig } = require('../utils/configPath');
const { getApiKey, getActiveAiConfig, detectProvider } = require('../ai/provider');

function handleKey(args) {
  const sub = args[0]?.trim();

  if (!sub) {
    console.log('\n\x1b[36m╔════════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[36m║             RAPIDFIRE AI KEY CONFIGURATION         ║\x1b[0m');
    console.log('\x1b[36m╚════════════════════════════════════════════════════╝\x1b[0m\n');
    console.log('Usage:');
    console.log('  \x1b[32mkey <api-key>\x1b[0m            Save any AI key (auto-detects Groq, OpenAI, Gemini)');
    console.log('  \x1b[33mkey model <model-name>\x1b[0m   (Optional) Override default model');
    console.log('  \x1b[36mkey status\x1b[0m               Check active provider, model, and source');
    console.log('  \x1b[31mkey clear\x1b[0m                Remove saved key from ~/.rapidfire/config.json');
    console.log('\nSupports any provider: Groq (free), OpenAI, Gemini (free), or local models.\n');
    return;
  }

  if (sub.toLowerCase() === 'status') {
    const activeKey = getApiKey();
    if (activeKey) {
      const config = getActiveAiConfig();
      const masked = activeKey.length > 8
        ? `${activeKey.slice(0, 5)}...${activeKey.slice(-4)}`
        : '***';
      let source = '~/.rapidfire/config.json';
      if (process.env.AI_API_KEY) source = 'process.env.AI_API_KEY';
      else if (process.env.GROQ_API_KEY) source = 'process.env.GROQ_API_KEY';
      else if (process.env.OPENAI_API_KEY) source = 'process.env.OPENAI_API_KEY';
      else if (process.env.GEMINI_API_KEY) source = 'process.env.GEMINI_API_KEY';
      else if (process.env.RAPIDFIRE_API_KEY) source = 'process.env.RAPIDFIRE_API_KEY';
      else if (getUserConfig()?.apiKey || getUserConfig()?.geminiApiKey) source = '~/.rapidfire/config.json';
      else source = '.env file';

      console.log(`\n\x1b[32m[OK] AI API Key is configured!\x1b[0m`);
      console.log(`  Provider: \x1b[36m${config.name || config.provider}\x1b[0m`);
      console.log(`  Model:    \x1b[33m${config.model}\x1b[0m`);
      console.log(`  Key:      \x1b[36m${masked}\x1b[0m`);
      console.log(`  Source:   \x1b[35m${source}\x1b[0m\n`);
    } else {
      console.log(`\n\x1b[33m[WARN] No AI API key configured.\x1b[0m`);
      console.log(`  Supports any API key: Groq (free), OpenAI, Gemini (free), etc.`);
      console.log(`  Run: \x1b[32mkey <your_key>\x1b[0m\n`);
    }
    return;
  }

  if (sub.toLowerCase() === 'clear') {
    saveUserConfig({
      apiKey: null,
      geminiApiKey: null,
      provider: null,
      model: null
    });
    console.log(`\n\x1b[32m[OK] Cleared AI API key from ~/.rapidfire/config.json.\x1b[0m\n`);
    return;
  }

  if (sub.toLowerCase() === 'model') {
    const modelName = args[1]?.trim();
    if (!modelName) {
      const current = getActiveAiConfig().model;
      console.log(`\nCurrent AI model: \x1b[36m${current}\x1b[0m`);
      console.log(`To change: \x1b[32mkey model <model-name>\x1b[0m\n`);
      return;
    }
    saveUserConfig({ model: modelName });
    console.log(`\n\x1b[32m[OK] AI model updated to:\x1b[0m \x1b[36m${modelName}\x1b[0m\n`);
    return;
  }

  const newKey = sub;
  if (newKey.length < 8) {
    console.log(`\x1b[31m[rapidfire] Error: API key appears too short or invalid.\x1b[0m`);
    return;
  }

  const detected = detectProvider(newKey);
  saveUserConfig({
    apiKey: newKey,
    geminiApiKey: newKey,
    provider: detected.provider,
    model: detected.model
  });

  const masked = `${newKey.slice(0, 5)}...${newKey.slice(-4)}`;
  console.log(`\n\x1b[32m[OK] AI API key saved successfully!\x1b[0m`);
  console.log(`  Provider: \x1b[36m${detected.name} (auto-detected)\x1b[0m`);
  console.log(`  Model:    \x1b[33m${detected.model} (default)\x1b[0m`);
  console.log(`  Stored in: ~/.rapidfire/config.json`);
  console.log(`  Active:    \x1b[36m${masked}\x1b[0m\n`);
}

async function ensureOrPromptApiKey(context = {}) {
  const activeKey = getApiKey();
  if (activeKey) return true;

  console.log('\n\x1b[33m[INFO] [Recommended] Set an AI API key (Groq, Gemini, OpenAI) to unlock full live AI reasoning & code generation:\x1b[0m');
  console.log('   Run: \x1b[32mkey <your_key>\x1b[0m\n');

  if (context && (context.rl || typeof context.ask === 'function')) {
    let entered = '';
    const promptText = '\x1b[1m\x1b[33mEnter your AI API key now (or press Enter to skip):\x1b[0m ';
    if (typeof context.ask === 'function') {
      entered = await context.ask(promptText);
    } else if (context.rl) {
      entered = await new Promise((resolve) => {
        context.rl.question(promptText, (ans) => resolve(ans ? ans.trim() : ''));
      });
    }

    if (entered && entered.trim().length >= 8) {
      const cleanKey = entered.trim();
      const detected = detectProvider(cleanKey);
      saveUserConfig({
        apiKey: cleanKey,
        geminiApiKey: cleanKey,
        provider: detected.provider,
        model: detected.model
      });
      const masked = `${cleanKey.slice(0, 5)}...${cleanKey.slice(-4)}`;
      console.log(`\x1b[32m[OK] AI API key saved permanently to ~/.rapidfire/config.json!\x1b[0m`);
      console.log(`  Provider: \x1b[36m${detected.name}\x1b[0m | Model: \x1b[33m${detected.model}\x1b[0m`);
      console.log(`  Active:   \x1b[36m${masked}\x1b[0m\n`);
      return true;
    }
  }

  return false;
}

module.exports = {
  handleKey,
  ensureOrPromptApiKey
};
