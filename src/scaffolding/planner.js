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

const COMPOSED_FRONTENDS = ['react', 'vue', 'svelte'];
const COMPOSED_BACKENDS = ['fastapi', 'django', 'flask', 'express', 'node'];

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
    const parts = normalized.split('+');
    if (parts.length === 2) {
      let [fe, be] = parts;
      if (COMPOSED_BACKENDS.includes(fe) && COMPOSED_FRONTENDS.includes(be)) {
        const tmp = fe;
        fe = be;
        be = tmp;
      }
      const feKnown = COMPOSED_FRONTENDS.includes(fe);
      const beKnown = COMPOSED_BACKENDS.includes(be);

      if (feKnown && beKnown) {
        return {
          tier: 'COMPOSED',
          stack: `${fe}+${be}`,
          frontend: fe,
          backend: be
        };
      }

      return {
        tier: 'DYNAMIC',
        stack: normalized,
        isFullstackPairing: true,
        frontend: fe,
        backend: be,
        knownFrontend: feKnown,
        knownBackend: beKnown
      };
    }
  }

  if (COMPOSED_FRONTENDS.includes(normalized)) {
    return {
      tier: 'PREDEFINED',
      stack: normalized,
      isFullstack: false,
      type: 'standalone_frontend'
    };
  }

  if (COMPOSED_BACKENDS.includes(normalized)) {
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

