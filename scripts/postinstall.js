#!/usr/bin/env node
'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── Config ──────────────────────────────────────────────────────────
const REPO_OWNER = 'heynaavi';
const REPO_NAME = 'Whip-Me-Bad';
const INSTALL_DIR = path.join(os.homedir(), '.whip-me-bad');
const VERSION = require('../package.json').version;

// ── Pretty logging (all via stderr — npm swallows stdout) ───────────
const PINK = '\x1b[38;5;205m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

function out(msg) { process.stderr.write(msg + '\n'); }

function banner() {
  out('');
  out(`${PINK}${BOLD}  🍑 Whip Me Bad — Postinstall${RESET}`);
  out(`${DIM}  ─────────────────────────────────────${RESET}`);
  out('');
}

function log(msg)     { out(`  ${PINK}▸${RESET} ${msg}`); }
function success(msg) { out(`  ${GREEN}✔${RESET} ${msg}`); }
function warn(msg)    { out(`  ${YELLOW}⚠${RESET} ${msg}`); }
function fail(msg)    { out(`  ${RED}✖${RESET} ${msg}`); }

function progressBar(percent, width = 30) {
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${PINK}${bar}${RESET} ${Math.round(percent * 100)}%`;
}

// ── Platform detection ──────────────────────────────────────────────
function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    return {
      os: 'mac',
      assetName: `Whip.Me.Bad-${VERSION}-arm64.dmg`,
      extension: 'dmg',
      appName: 'Whip Me Bad.app',
      binaryPath: path.join(INSTALL_DIR, 'Whip Me Bad.app', 'Contents', 'MacOS', 'Whip Me Bad'),
    };
  } else if (platform === 'win32') {
    return {
      os: 'win',
      assetName: `Whip.Me.Bad.${VERSION}.exe`,
      extension: 'exe',
      appName: 'Whip Me Bad.exe',
      binaryPath: path.join(INSTALL_DIR, 'Whip Me Bad.exe'),
    };
  } else {
    return null;
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────
function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'whip-me-bad-installer' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

function download(url, dest, totalSize) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'whip-me-bad-installer' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest, totalSize).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const size = totalSize || parseInt(res.headers['content-length'], 10) || 0;
      const file = fs.createWriteStream(dest);
      let downloaded = 0;
      let lastPercent = -1;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (size > 0) {
          const percent = Math.round((downloaded / size) * 100);
          if (percent !== lastPercent && percent % 5 === 0) {
            lastPercent = percent;
            process.stderr.write(`\r  ${PINK}▸${RESET} Downloading... ${progressBar(downloaded / size)}`);
          }
        }
      });

      res.on('end', () => {
        file.end();
        process.stderr.write('\n');
        resolve();
      });

      res.on('error', (err) => {
        file.close();
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on('error', reject);
  });
}

// ── GitHub Release asset URL ────────────────────────────────────────
async function getDownloadUrl(assetName) {
  const directUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${VERSION}/${assetName}`;
  log(`Looking for release asset: ${BOLD}${assetName}${RESET}`);

  try {
    await new Promise((resolve, reject) => {
      https.get(directUrl, { method: 'HEAD', headers: { 'User-Agent': 'whip-me-bad-installer' } }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          resolve();
        } else {
          reject(new Error(`Asset not found (HTTP ${res.statusCode})`));
        }
      }).on('error', reject);
    });
    return directUrl;
  } catch (_) {
    log('Direct URL failed, querying GitHub Releases API...');
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/v${VERSION}`;
    const res = await fetch(apiUrl);
    const body = await new Promise((resolve, reject) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });

    const release = JSON.parse(body);
    const asset = release.assets && release.assets.find(a => a.name === assetName);
    if (!asset) {
      throw new Error(`Asset "${assetName}" not found in release v${VERSION}`);
    }
    return asset.browser_download_url;
  }
}

// ── macOS: mount DMG and copy .app ──────────────────────────────────
async function installMac(dmgPath, info) {
  log('Mounting DMG...');

  const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -quiet -mountrandom /tmp`, {
    encoding: 'utf8',
  });

  const mountLine = mountOutput.trim().split('\n').pop();
  const mountPoint = mountLine.split('\t').pop().trim();

  if (!mountPoint || !fs.existsSync(mountPoint)) {
    throw new Error('Failed to mount DMG — could not find mount point');
  }

  log(`Mounted at ${DIM}${mountPoint}${RESET}`);

  try {
    const contents = fs.readdirSync(mountPoint);
    const appDir = contents.find(f => f.endsWith('.app'));
    if (!appDir) {
      throw new Error('No .app found inside DMG');
    }

    const source = path.join(mountPoint, appDir);
    const dest = path.join(INSTALL_DIR, appDir);

    if (fs.existsSync(dest)) {
      log('Removing previous version...');
      execSync(`rm -rf "${dest}"`);
    }

    log(`Copying ${BOLD}${appDir}${RESET} to ${DIM}${INSTALL_DIR}${RESET}`);
    execSync(`cp -R "${source}" "${dest}"`);

    try {
      execSync(`xattr -rd com.apple.quarantine "${dest}" 2>/dev/null`);
    } catch (_) {}

    success(`Installed to ${DIM}${dest}${RESET}`);
  } finally {
    try {
      execSync(`hdiutil detach "${mountPoint}" -quiet`);
    } catch (_) {}
  }

  try { fs.unlinkSync(dmgPath); } catch (_) {}
}

// ── Windows: copy portable exe ──────────────────────────────────────
async function installWindows(exePath, info) {
  const dest = path.join(INSTALL_DIR, info.appName);

  if (fs.existsSync(dest)) {
    log('Removing previous version...');
    try { fs.unlinkSync(dest); } catch (_) {}
  }

  log(`Copying to ${DIM}${dest}${RESET}`);
  fs.copyFileSync(exePath, dest);
  success(`Installed to ${DIM}${dest}${RESET}`);

  try { fs.unlinkSync(exePath); } catch (_) {}
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  banner();

  // Skip in CI environments
  if (process.env.CI) {
    log('CI detected — skipping binary download.');
    return;
  }

  const info = getPlatformInfo();
  if (!info) {
    warn(`Unsupported platform: ${process.platform}/${process.arch}`);
    warn('Whip Me Bad currently supports macOS and Windows.');
    warn('You can download the app manually from:');
    out(`  ${DIM}https://github.com/${REPO_OWNER}/${REPO_NAME}/releases${RESET}`);
    out('');
    return;
  }

  log(`Platform: ${BOLD}${info.os}${RESET} (${process.arch})`);
  log(`Version:  ${BOLD}${VERSION}${RESET}`);

  // Check if already installed at this version
  const versionFile = path.join(INSTALL_DIR, '.version');
  if (fs.existsSync(versionFile)) {
    const installed = fs.readFileSync(versionFile, 'utf8').trim();
    if (installed === VERSION && fs.existsSync(info.binaryPath)) {
      success(`v${VERSION} already installed — nothing to do.`);
      out('');
      return;
    }
  }

  // Create install directory
  fs.mkdirSync(INSTALL_DIR, { recursive: true });

  // Get download URL
  let downloadUrl;
  try {
    downloadUrl = await getDownloadUrl(info.assetName);
  } catch (err) {
    fail(`Could not find release binary: ${err.message}`);
    warn('You can download the app manually from:');
    out(`  ${DIM}https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${VERSION}${RESET}`);
    out('');
    return;
  }

  // Download
  const tmpFile = path.join(os.tmpdir(), `whip-me-bad-${VERSION}.${info.extension}`);
  log('Downloading from GitHub Releases...');

  try {
    await download(downloadUrl, tmpFile);
    success('Download complete.');
  } catch (err) {
    fail(`Download failed: ${err.message}`);
    warn('You can download the app manually from:');
    out(`  ${DIM}https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${VERSION}${RESET}`);
    out('');
    return;
  }

  // Install
  try {
    if (info.os === 'mac') {
      await installMac(tmpFile, info);
    } else {
      await installWindows(tmpFile, info);
    }
  } catch (err) {
    fail(`Installation failed: ${err.message}`);
    warn('You can download the app manually from:');
    out(`  ${DIM}https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${VERSION}${RESET}`);
    out('');
    return;
  }

  // Write version marker
  fs.writeFileSync(versionFile, VERSION);

  // Done!
  out('');
  out(`${PINK}${BOLD}  🎉 Whip Me Bad is ready!${RESET}`);
  out(`${DIM}  Run it with: ${RESET}${BOLD}whip-me-bad${RESET}`);
  out('');

  if (info.os === 'mac') {
    out(`${DIM}  If macOS blocks the app, go to:${RESET}`);
    out(`${DIM}  System Settings → Privacy & Security → "Open Anyway"${RESET}`);
    out('');
  }
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
  out('');
  // Never fail the npm install — graceful degradation
  process.exit(0);
});
