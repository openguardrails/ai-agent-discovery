/**
 * Filter Utilities
 *
 * Noise filtering and pattern extraction utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { Signature } from '../detectors/types.js';

/**
 * Default noise processes to filter out
 */
export const NOISE_PROCESSES = [
  'chrome',
  'firefox',
  'msedge',
  'safari',
  'opera',
  'brave',
  'vscode',
  'code',
  'notepad',
  'explorer',
  'finder',
  'terminal',
  'cmd',
  'powershell',
  'bash',
  'zsh',
  'sh',
];

/**
 * Default noise paths to filter out
 */
export const NOISE_PATHS = [
  '/tmp/',
  '/var/tmp/',
  '/var/cache/',
  'node_modules/',
  '.git/',
  '__pycache__/',
  '.cache/',
];

/**
 * Check if a process name is noise
 */
export function isNoiseProcess(processName: string): boolean {
  const lower = processName.toLowerCase();
  return NOISE_PROCESSES.some((noise) => lower.includes(noise));
}

/**
 * Check if a path is noise
 */
export function isNoisePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return NOISE_PATHS.some((noise) => lower.includes(noise));
}

/**
 * Get all patterns from all signature files
 */
export function getAllPatterns(signaturesPath?: string): string[] {
  const defaultPath = path.join(process.cwd(), 'registry', 'signatures');
  const searchPath = signaturesPath || defaultPath;
  const patterns: Set<string> = new Set();

  if (!fs.existsSync(searchPath)) {
    return [];
  }

  const files = fs.readdirSync(searchPath).filter((f) => f.endsWith('.yaml'));

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(searchPath, file), 'utf8');
      const signature = yaml.load(content) as Signature;

      if (signature.patterns) {
        // Extract patterns from each category
        for (const category of ['process', 'file_path', 'network'] as const) {
          const categoryPatterns = signature.patterns[category];
          if (categoryPatterns) {
            for (const p of categoryPatterns) {
              // For regex patterns, extract the core pattern
              let pattern = p.pattern;
              if (p.type === 'regex') {
                // Remove regex special chars for query building
                pattern = pattern.replace(/[\\^$*+?.()|[\]{}]/g, '');
              }
              if (pattern.length >= 3) {
                patterns.add(pattern);
              }
            }
          }
        }
      }
    } catch {
      // Skip invalid files
    }
  }

  return Array.from(patterns);
}

/**
 * Filter events by exclusion rules
 */
export function filterEvents<T extends { image_name?: string; file_path?: string }>(
  events: T[],
  excludeProcesses: string[] = NOISE_PROCESSES,
  excludePaths: string[] = NOISE_PATHS
): T[] {
  return events.filter((event) => {
    // Check process name
    if (event.image_name) {
      const lower = event.image_name.toLowerCase();
      if (excludeProcesses.some((p) => lower.includes(p))) {
        return false;
      }
    }

    // Check file path
    if (event.file_path) {
      const lower = event.file_path.toLowerCase();
      if (excludePaths.some((p) => lower.includes(p))) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Deduplicate events by key
 */
export function deduplicateEvents<T>(
  events: T[],
  keyFn: (event: T) => string
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const event of events) {
    const key = keyFn(event);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(event);
    }
  }

  return result;
}
