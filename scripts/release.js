#!/usr/bin/env node

/**
 * release.js — One-command release for Whip Me Bad
 *
 * Usage:
 *   node scripts/release.js patch     → 1.2.2 → 1.2.3
 *   node scripts/release.js minor     → 1.2.2 → 1.3.0
 *   node scripts/release.js major     → 1.2.2 → 2.0.0
 *   node scripts/release.js 1.5.0     → sets exact version
 *
 * What it does:
 *   1. Bumps version in package.json + package-lock.json
 *   2. Commits with a descriptive message + tags
 *   3. Pushes to GitHub
 *   4. Builds mac (zip) + win (portable exe) — skip with --skip-build
 *   5. Creates GitHub Release + uploads assets with release notes
 *   6. Publishes to npm (strips main.js from tarball, uses --ignore-scripts)
 *
 * Flags:
 *   --skip-build     skip electron-builder, just tag + release + publish
 *   --skip-npm       skip npm publish
 *   --allow-dirty    allow uncommitted changes
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Colors ──────────────────────────────────────────────────────────
const PINK = '\x1b[38;5;205m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

function log(msg)     { console.log(`  ${PINK}▸${RESET} ${msg}`); }
function done(msg)    { console.log(`  ${GREEN}✔${RESET} ${msg}`); }
function warn(msg)    { console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function fail(msg)    { console.log(`  ${RED}✖${RESET} ${msg}`); }
function info(msg)    { console.log(`    ${DIM}${msg}${RESET}`); }

function run(cmd, opts = {}) {
  try {
    const stdio = opts.silent ? 'pipe' : 'inherit';
    const result = execSync(cmd, { encoding: 'utf8', stdio, cwd: ROOT });
    return typeof result === 'string' ? result.trim() : '';
  } catch (err) {
    if (opts.safe) return '';
    fail(`command failed: ${DIM}${cmd}${RESET}`);
    if (err.stderr) info(err.stderr.toString().trim());
    process.exit(1);
  }
}

// ── Version bump ────────────────────────────────────────────────────
function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (bump) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default:
      if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
      return null;
  }
}

// ── Preflight checks ────────────────────────────────────────────────
function preflight() {
  const allowDirty = process.argv.includes('--allow-dirty');

  // Git clean?
  const status = run('git status --porcelain', { silent: true, safe: true });
  if (status && !allowDirty) {
    warn('working tree has uncommitted changes');
    info('commit them first, or use --allow-dirty');
    process.exit(1);
  }

  // On main branch?
  const branch = run('git branch --show-current', { silent: true, safe: true });
  if (branch && branch !== 'main' && branch !== 'master') {
    warn(`on branch ${BOLD}${branch}${RESET} — expected main`);
    process.exit(1);
  }

  // gh CLI?
  try { execSync('gh --version', { stdio: 'pipe' }); }
  catch (_) { fail('GitHub CLI (gh) not found — brew install gh'); process.exit(1); }

  // electron-builder?
  if (!process.argv.includes('--skip-build')) {
    try { execSync('npx electron-builder --version', { stdio: 'pipe', cwd: ROOT }); }
    catch (_) { fail('electron-builder not found — npm install'); process.exit(1); }
  }
}

// ── Generate commit message ─────────────────────────────────────────
function generateCommitMessage(version, changes) {
  if (changes.length === 0) return `release: v${version}`;
  const bullets = changes.map(c => `- ${c}`).join('\n');
  return `release: v${version}\n\n${bullets}`;
}

// ── Get changes since last tag ──────────────────────────────────────
function getChangesSinceLastTag() {
  const lastTag = run('git describe --tags --abbrev=0 2>/dev/null', { silent: true, safe: true });
  if (!lastTag) return [];

  const log = run(`git log ${lastTag}..HEAD --oneline --no-merges`, { silent: true, safe: true });
  if (!log) return [];

  return log.split('\n')
    .map(line => line.replace(/^[a-f0-9]+ /, '').trim())
    .filter(line => !line.startsWith('release:'));
}

// ── Generate release notes ──────────────────────────────────────────
function generateReleaseNotes(version, changes) {
  let notes = `## 🍑 v${version}\n\n`;
  notes += '### Install\n```\nnpm install -g whip-me-bad\n```\n\n';

  if (changes.length > 0) {
    notes += '### Changes\n';
    for (const c of changes) {
      notes += `- ${c}\n`;
    }
  }

  notes += '\n### Run\n```\nwhip-me-bad\n```';
  return notes;
}

// ── Find build assets for upload ────────────────────────────────────
function findAssets(version) {
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) return [];

  const files = fs.readdirSync(distDir);
  const assets = [];

  for (const f of files) {
    // Only include files for this version
    if (!f.includes(version)) continue;
    // Only zip (mac), exe (win) — skip blockmaps, setup exes, yml
    if (f.endsWith('.blockmap')) continue;
    if (f.toLowerCase().includes('setup')) continue;
    if (f.endsWith('.zip') || f.endsWith('.exe')) {
      assets.push(path.join(distDir, f));
    }
  }

  return assets;
}

// ── npm publish ─────────────────────────────────────────────────────
function npmPublish() {
  log('publishing to npm...');

  // Backup package.json
  const pkgPath = path.join(ROOT, 'package.json');
  const original = fs.readFileSync(pkgPath, 'utf8');

  try {
    // Strip "main" field so main.js doesn't get included in the tarball
    const pkg = JSON.parse(original);
    delete pkg.main;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    run('npm publish --ignore-scripts');
    done('published to npm');
  } finally {
    // Always restore original package.json
    fs.writeFileSync(pkgPath, original);
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const bump = process.argv[2];
  const skipBuild = process.argv.includes('--skip-build');
  const skipNpm = process.argv.includes('--skip-npm');

  console.log('');
  console.log(`  ${PINK}${BOLD}🍑 Whip Me Bad — Release${RESET}`);
  console.log(`  ${DIM}─────────────────────────────────────${RESET}`);
  console.log('');

  if (!bump || bump.startsWith('--')) {
    info('usage: node scripts/release.js <patch|minor|major|x.y.z>');
    info('');
    info('flags:');
    info('  --skip-build     skip electron-builder');
    info('  --skip-npm       skip npm publish');
    info('  --allow-dirty    allow uncommitted changes');
    console.log('');
    process.exit(0);
  }

  // Read current version
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bump);

  if (!newVersion) {
    fail(`invalid version bump: ${bump}`);
    info('use: patch, minor, major, or an exact version like 1.2.3');
    process.exit(1);
  }

  log(`version ${DIM}${oldVersion}${RESET} → ${GREEN}${BOLD}${newVersion}${RESET}`);
  console.log('');

  // Preflight
  preflight();

  // Get changes for commit message and release notes
  const changes = getChangesSinceLastTag();
  if (changes.length > 0) {
    log(`${changes.length} change(s) since last release:`);
    for (const c of changes) info(c);
    console.log('');
  }

  // 1. Bump version
  log('bumping version...');
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // Also bump package-lock.json
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      lock.version = newVersion;
      if (lock.packages && lock.packages['']) lock.packages[''].version = newVersion;
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } catch (_) {}
  }
  done(`package.json → v${newVersion}`);

  // 2. Commit + tag
  const commitMsg = generateCommitMessage(newVersion, changes);
  run('git add -A', { silent: true });
  run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { silent: true, safe: true });
  done('committed');

  run(`git tag v${newVersion}`, { silent: true });
  done(`tagged v${newVersion}`);

  // 3. Push
  log('pushing to github...');
  run('git push origin main --tags', { silent: true });
  done('pushed');

  // 4. Build
  if (!skipBuild) {
    console.log('');
    log('building app (this takes a minute)...');
    console.log('');
    run('npx electron-builder --mac zip');
    console.log('');
    run('npx electron-builder --win portable');
    console.log('');
    done('build complete');
  }

  // 5. GitHub Release
  console.log('');
  log('creating github release...');

  const assets = findAssets(newVersion);
  const assetArgs = assets.map(a => {
    // GitHub converts spaces to dots in asset names
    const displayName = path.basename(a).replace(/ /g, '.');
    return `"${a}#${displayName}"`;
  }).join(' ');

  if (assets.length > 0) {
    info(`${assets.length} asset(s):`);
    for (const a of assets) info(`  ${path.basename(a)}`);
  }

  const releaseNotes = generateReleaseNotes(newVersion, changes);
  const notesFile = path.join(ROOT, '.release-notes-tmp.md');
  fs.writeFileSync(notesFile, releaseNotes);

  try {
    run(`gh release create v${newVersion} ${assetArgs} --title "v${newVersion}" --notes-file "${notesFile}" --latest`);
    done('github release created');
  } finally {
    try { fs.unlinkSync(notesFile); } catch (_) {}
  }

  // 6. npm publish
  if (!skipNpm) {
    console.log('');
    npmPublish();
  }

  // Done!
  const repoUrl = pkg.repository && pkg.repository.url
    ? pkg.repository.url.match(/github\.com\/(.+?)\.git/)?.[1] || 'heynaavi/Whip-Me-Bad'
    : 'heynaavi/Whip-Me-Bad';

  console.log('');
  console.log(`  ${GREEN}${BOLD}🎉 Released v${newVersion}${RESET}`);
  console.log('');
  info(`github → https://github.com/${repoUrl}/releases/tag/v${newVersion}`);
  info(`npm    → https://www.npmjs.com/package/whip-me-bad`);
  console.log('');
}

main().catch((err) => {
  fail(`release failed: ${err.message}`);
  process.exit(1);
});
