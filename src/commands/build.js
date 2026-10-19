const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function handleBuild(args = []) {
  let target = args[0] ? path.resolve(process.cwd(), args[0]) : process.cwd();

  if (!fs.existsSync(target)) {
    console.error(`\x1b[31m[rapidfire] Error: Directory '${args[0]}' not found.\x1b[0m`);
    return { success: false, error: 'Directory not found' };
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const dirsToBuild = [];

  const fePkg = path.join(target, 'frontend', 'package.json');
  if (fs.existsSync(fePkg)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fePkg, 'utf8'));
      if (parsed.scripts && parsed.scripts.build) {
        dirsToBuild.push(path.join(target, 'frontend'));
      }
    } catch {}
  }

  const rootPkg = path.join(target, 'package.json');
  if (fs.existsSync(rootPkg)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
      if (parsed.scripts && parsed.scripts.build && !dirsToBuild.includes(target)) {
        dirsToBuild.push(target);
      }
    } catch {}
  }

  if (dirsToBuild.length === 0) {
    const entries = fs.readdirSync(target, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        const subFe = path.join(target, entry.name, 'frontend', 'package.json');
        const subPkg = path.join(target, entry.name, 'package.json');
        if (fs.existsSync(subFe)) {
          dirsToBuild.push(path.join(target, entry.name, 'frontend'));
          break;
        } else if (fs.existsSync(subPkg)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(subPkg, 'utf8'));
            if (parsed.scripts && parsed.scripts.build) {
              dirsToBuild.push(path.join(target, entry.name));
              break;
            }
          } catch {}
        }
      }
    }
  }

  if (dirsToBuild.length === 0) {
    console.error(`\x1b[31m[rapidfire] Error: No project with a 'build' script found in '${target}'.\x1b[0m`);
    return { success: false, error: 'No build script found' };
  }

  for (const dir of dirsToBuild) {
    console.log(`\x1b[36m[rapidfire] Building project in ${dir}...\x1b[0m`);
    try {
      execSync(`${npmCmd} run build`, { cwd: dir, stdio: 'inherit' });
      console.log(`\x1b[32m[OK] Build completed successfully in ${dir}.\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m[rapidfire] Build failed in ${dir}:\x1b[0m`, err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

module.exports = {
  handleBuild
};
