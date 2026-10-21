const { hasFrontendAdapter } = require('./adapters/frontend');
const { hasBackendAdapter } = require('./adapters/backend');

const PREDEFINED_RECIPES = [
  'react',
  'vue',
  'svelte',
  'fastapi',
  'django',
  'react+fastapi',
  'react+django',
  'react+node',
  'vue+fastapi',
  'vue+node',
  'vue+django',
  'react+flask',
  'svelte+node'
];

function planStack(stackInput) {
  if (!stackInput || typeof stackInput !== 'string') {
    return { tier: 'INVALID', error: 'Empty stack name' };
  }

  const normalized = stackInput.toLowerCase().trim();

  if (PREDEFINED_RECIPES.includes(normalized)) {
    return {
      tier: 'PREDEFINED',
      stack: normalized,
      isFullstack: normalized.includes('+')
    };
  }

  if (normalized.includes('+')) {
    const parts = normalized.split('+').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const [fe, be] = parts;
      const feKnown = hasFrontendAdapter(fe);
      const beKnown = hasBackendAdapter(be);

      if (parts.length === 2 && feKnown && beKnown) {
        return {
          tier: 'COMPOSED',
          stack: `${fe}+${be}`,
          frontend: fe,
          backend: be
        };
      }

      return {
        tier: 'DYNAMIC',
        stack: `${fe}+${be}`,
        isFullstackPairing: true,
        frontend: fe,
        backend: be,
        knownFrontend: feKnown,
        knownBackend: beKnown
      };
    }
  }

  if (hasFrontendAdapter(normalized)) {
    return {
      tier: 'PREDEFINED',
      stack: normalized,
      isFullstack: false,
      type: 'standalone_frontend'
    };
  }

  if (hasBackendAdapter(normalized)) {
    return {
      tier: 'PREDEFINED',
      stack: normalized,
      isFullstack: false,
      type: 'standalone_backend'
    };
  }

  return {
    tier: 'DYNAMIC',
    stack: normalized,
    isFullstackPairing: false
  };
}

module.exports = {
  PREDEFINED_RECIPES,
  planStack
};
