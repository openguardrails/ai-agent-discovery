/**
 * Pattern Matcher
 *
 * Compiles and matches detection patterns against events
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger.js';
import type {
  Signature,
  Pattern,
  CompiledSignature,
  CompiledPattern,
  RawEvent,
  PatternMatch,
  MatchField,
} from './types.js';
import type { Taxonomy, Species } from '../taxonomy/types.js';

/**
 * Default signature path
 */
const DEFAULT_SIGNATURES_PATH = path.join(process.cwd(), 'registry', 'signatures');

/**
 * Load a signature from YAML file
 */
export function loadSignature(filePath: string): Signature {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content) as Signature;
}

/**
 * Load all signatures from directory
 */
export function loadSignatures(signaturesPath: string = DEFAULT_SIGNATURES_PATH): Map<string, Signature> {
  const signatures = new Map<string, Signature>();

  if (!fs.existsSync(signaturesPath)) {
    logger.warn({ path: signaturesPath }, 'Signatures directory not found');
    return signatures;
  }

  const files = fs.readdirSync(signaturesPath).filter((f) => f.endsWith('.yaml'));

  for (const file of files) {
    try {
      const signature = loadSignature(path.join(signaturesPath, file));
      signatures.set(signature.id, signature);
    } catch (e) {
      logger.error({ file, error: (e as Error).message }, 'Failed to load signature');
    }
  }

  logger.info({ count: signatures.size }, 'Signatures loaded');
  return signatures;
}

/**
 * Compile a pattern to regex
 */
function compilePattern(pattern: Pattern, category: 'process' | 'file_path' | 'network'): CompiledPattern {
  let regexPattern: string;

  switch (pattern.type) {
    case 'substring':
      // Escape regex special chars and create substring match
      regexPattern = pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      break;
    case 'regex':
      regexPattern = pattern.pattern;
      break;
    case 'domain':
      // Match domain in URLs or strings
      regexPattern = pattern.pattern.replace(/\./g, '\\.');
      break;
    default:
      regexPattern = pattern.pattern;
  }

  const flags = pattern.case_sensitive ? 'g' : 'gi';
  const defaultFields: MatchField[] =
    category === 'process'
      ? ['file_path', 'image_name', 'command_line']
      : category === 'file_path'
        ? ['file_path']
        : ['command_line'];

  return {
    regex: new RegExp(regexPattern, flags),
    fields: pattern.fields || defaultFields,
    sourcePattern: pattern.pattern,
    category,
  };
}

/**
 * Compile a signature for runtime matching
 */
export function compileSignature(signature: Signature, speciesId: string): CompiledSignature {
  const patterns: CompiledPattern[] = [];

  // Compile process patterns
  if (signature.patterns.process) {
    for (const p of signature.patterns.process) {
      patterns.push(compilePattern(p, 'process'));
    }
  }

  // Compile file path patterns
  if (signature.patterns.file_path) {
    for (const p of signature.patterns.file_path) {
      patterns.push(compilePattern(p, 'file_path'));
    }
  }

  // Compile network patterns
  if (signature.patterns.network) {
    for (const p of signature.patterns.network) {
      patterns.push(compilePattern(p, 'network'));
    }
  }

  // Compile exclusions
  const processExclusions = (signature.exclusions?.processes || []).map(
    (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  );
  const pathExclusions = (signature.exclusions?.paths || []).map(
    (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  );

  return {
    id: signature.id,
    speciesId,
    patterns,
    exclusions: {
      processes: processExclusions,
      paths: pathExclusions,
    },
  };
}

/**
 * Build compiled signatures from taxonomy and signature files
 */
export function buildCompiledSignatures(
  taxonomy: Taxonomy,
  signaturesPath: string = DEFAULT_SIGNATURES_PATH
): Map<string, CompiledSignature[]> {
  const signatures = loadSignatures(signaturesPath);
  const compiled = new Map<string, CompiledSignature[]>();

  for (const species of taxonomy.species.values()) {
    const speciesSignatures: CompiledSignature[] = [];

    for (const sigRef of species.signatures) {
      const signature = signatures.get(sigRef.ref);
      if (signature) {
        speciesSignatures.push(compileSignature(signature, species.id));
      } else {
        logger.warn({ species: species.id, signature: sigRef.ref }, 'Signature not found');
      }
    }

    if (speciesSignatures.length > 0) {
      compiled.set(species.id, speciesSignatures);
    }
  }

  return compiled;
}

/**
 * Check if event should be excluded
 */
function isExcluded(event: RawEvent, signature: CompiledSignature): boolean {
  // Check process exclusions
  const processName = event.image_name || '';
  for (const exclusion of signature.exclusions.processes) {
    if (exclusion.test(processName)) {
      return true;
    }
  }

  // Check path exclusions
  const filePath = event.file_path || '';
  for (const exclusion of signature.exclusions.paths) {
    if (exclusion.test(filePath)) {
      return true;
    }
  }

  return false;
}

/**
 * Match an event against a compiled signature
 */
export function matchEvent(event: RawEvent, signature: CompiledSignature): PatternMatch[] {
  // Check exclusions first
  if (isExcluded(event, signature)) {
    return [];
  }

  const matches: PatternMatch[] = [];

  for (const pattern of signature.patterns) {
    for (const field of pattern.fields) {
      const value = event[field];
      if (typeof value === 'string' && pattern.regex.test(value)) {
        matches.push({
          pattern: pattern.sourcePattern,
          field,
          value,
        });
      }
    }
  }

  return matches;
}

/**
 * Match an event against all species signatures
 */
export function matchEventToSpecies(
  event: RawEvent,
  compiledSignatures: Map<string, CompiledSignature[]>,
  taxonomy: Taxonomy
): Array<{ species: Species; matches: PatternMatch[] }> {
  const results: Array<{ species: Species; matches: PatternMatch[] }> = [];

  for (const [speciesId, signatures] of compiledSignatures) {
    const species = taxonomy.species.get(speciesId);
    if (!species) continue;

    for (const signature of signatures) {
      const matches = matchEvent(event, signature);
      if (matches.length > 0) {
        results.push({ species, matches });
        break; // One match per species is enough
      }
    }
  }

  return results;
}

/**
 * Calculate confidence score based on matches
 */
export function calculateConfidence(matches: PatternMatch[]): number {
  if (matches.length === 0) return 0;
  if (matches.length === 1) return 0.6;
  if (matches.length === 2) return 0.8;
  return Math.min(0.95, 0.8 + matches.length * 0.05);
}
