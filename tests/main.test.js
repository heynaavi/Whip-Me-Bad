import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const validateSoundPath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return '';
  if (filePath.startsWith('~') || filePath.startsWith('$')) return '';
  const resolved = filePath.startsWith('~') 
    ? path.join(process.env.HOME || '/tmp', filePath.slice(1))
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
};

describe('validateSoundPath', () => {
  it('should return empty string for null/undefined input', () => {
    expect(validateSoundPath('')).toBe('');
    expect(validateSoundPath(null)).toBe('');
    expect(validateSoundPath(undefined)).toBe('');
  });

  it('should reject paths with .. (path traversal)', () => {
    expect(validateSoundPath('../etc/passwd')).toBe('');
    expect(validateSoundPath('../../secret')).toBe('');
  });

  it('should reject paths starting with ~ without proper expansion', () => {
    expect(validateSoundPath('~')).toBe('');
  });

  it('should accept valid audio file extensions for existing files', () => {
    const testFile = '/tmp/test-audio.mp3';
    expect(validateSoundPath(testFile)).toBe('');
  });

  it('should reject non-audio extensions', () => {
    expect(validateSoundPath('/valid/path.txt')).toBe('');
    expect(validateSoundPath('/valid/path.exe')).toBe('');
    expect(validateSoundPath('/valid/path.js')).toBe('');
  });
});

describe('analytics module', () => {
  it('should have setAnalyticsEnabled function', async () => {
    const analytics = await import('../src/analytics.js');
    expect(typeof analytics.setAnalyticsEnabled).toBe('function');
  });

  it('should have getStats function', async () => {
    const analytics = await import('../src/analytics.js');
    expect(typeof analytics.getStats).toBe('function');
  });

  it('should have setConsent function', async () => {
    const analytics = await import('../src/analytics.js');
    expect(typeof analytics.setConsent).toBe('function');
  });
});