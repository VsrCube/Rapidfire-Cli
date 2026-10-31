const { exec } = require('child_process');

function openBrowser(url) {
  if (process.env.CI || process.env.NODE_ENV === 'test' || process.env.RAPIDFIRE_SKIP_BROWSER === '1') {
    return;
  }
  const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${startCmd} ${url}`, () => {});
}

function createStreamHandler(tag, colorCode) {
  const reset = '\x1b[0m';
  const prefix = `${colorCode}[${tag}]${reset} `;
  let buffer = '';

  return (chunk) => {
    const text = chunk.toString();
    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();

    for (const line of lines) {
      if (line.trim().length > 0) {
        let cleanLine = line.replace(/\x1b\[\?(9001|1004)[hl]/g, '');
        const tagPattern = new RegExp(`^\\s*\\[${tag}\\]\\s*`, 'i');
        cleanLine = cleanLine.replace(tagPattern, '');
        console.log(`${prefix}${cleanLine}`);
      }
    }
  };
}

function renderBanner(info) {
  const bold = '\x1b[1m';
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(`\n${bold}${green}[OK] Application is live!${reset}`);
  if (info.frontendUrl) {
    console.log(`  Frontend: ${cyan}${info.frontendUrl}${reset}`);
  }
  if (info.backendUrl) {
    const docs = info.backendDocs ? ` (Docs: ${yellow}${info.backendDocs}${reset})` : '';
    console.log(`  Backend:  ${cyan}${info.backendUrl}${reset}${docs}`);
  }
  if (info.primaryUrl) {
    console.log(`\n${dim}Opening in browser:${reset} ${bold}${cyan}${info.primaryUrl}${reset}\n`);
  }
}

module.exports = {
  openBrowser,
  createStreamHandler,
  renderBanner
};
