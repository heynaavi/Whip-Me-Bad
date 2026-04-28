const path = require('path');
const fs = require('fs');

function validateSoundPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  if (filePath.startsWith('~') || filePath.startsWith('$')) return '';
  const resolved = filePath.startsWith('~') 
    ? path.join(require('os').homedir(), filePath.slice(1))
    : filePath;
  if (filePath.includes('..')) return '';
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        return resolved;
      }
    }
  } catch (_) {}
  return '';
}

module.exports = { validateSoundPath };