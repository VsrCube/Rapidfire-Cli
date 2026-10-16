const provider = require('./provider');

module.exports = {
  SUPPORTED_STACKS: provider.SUPPORTED_STACKS,
  hasApiKey: provider.hasApiKey,
  getApiKey: provider.getApiKey,
  getActiveAiConfig: provider.getActiveAiConfig,
  detectProvider: provider.detectProvider,
  askGemini: provider.askAI,
  askAI: provider.askAI,
  suggestStack: provider.suggestStack,
  instructGemini: provider.instructAI,
  instructAI: provider.instructAI,
  fallbackInstructGenerator: provider.fallbackInstructGenerator,
  explainFile: provider.explainFile,
  explainDirectory: provider.explainDirectory,
  fallbackExplainFile: provider.fallbackExplainFile,
  fallbackExplainDirectory: provider.fallbackExplainDirectory,
  generateRepoOverview: provider.generateRepoOverview,
  fallbackRepoOverview: provider.fallbackRepoOverview,
  clearAskHistory: provider.clearAskHistory,
  getAskHistory: provider.getAskHistory
};
