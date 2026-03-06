/**
 * Detection Engine Types
 */

/**
 * Pattern type for matching
 */
export type PatternType = 'substring' | 'regex' | 'domain';

/**
 * Fields that can be matched against
 */
export type MatchField = 'file_path' | 'image_name' | 'command_line' | 'process_name';

/**
 * A single detection pattern
 */
export interface Pattern {
  pattern: string;
  type: PatternType;
  case_sensitive?: boolean;
  fields?: MatchField[];
  description?: string;
}

/**
 * Pattern category in signature file
 */
export interface PatternCategory {
  process?: Pattern[];
  file_path?: Pattern[];
  network?: Pattern[];
}

/**
 * Exclusion rules for noise filtering
 */
export interface Exclusions {
  processes?: string[];
  paths?: string[];
}

/**
 * Signature definition (from YAML)
 */
export interface Signature {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  patterns: PatternCategory;
  exclusions?: Exclusions;
}

/**
 * Compiled pattern for runtime matching
 */
export interface CompiledPattern {
  regex: RegExp;
  fields: MatchField[];
  sourcePattern: string;
  category: 'process' | 'file_path' | 'network';
}

/**
 * Compiled signature for runtime matching
 */
export interface CompiledSignature {
  id: string;
  speciesId: string;
  patterns: CompiledPattern[];
  exclusions: {
    processes: RegExp[];
    paths: RegExp[];
  };
}

/**
 * Raw event from EDR connector
 */
export interface RawEvent {
  timestamp: string;
  endpoint: string;
  username: string;
  os_type?: string;
  file_path?: string;
  image_name?: string;
  command_line?: string;
  parent_process?: string;
  [key: string]: unknown;
}

/**
 * Match result from pattern matching
 */
export interface PatternMatch {
  pattern: string;
  field: string;
  value: string;
}

/**
 * Detection result
 */
export interface DetectionResult {
  id: string;
  endpoint: {
    hostname: string;
    os: 'Windows' | 'macOS' | 'Linux' | 'Unknown';
  };
  user: {
    username: string;
    domain?: string;
  };
  agent: {
    kingdom: string;
    family: string;
    species: string;
    confidence: number;
  };
  evidence: {
    matchedPatterns: string[];
    commandLine?: string;
    filePath?: string;
    processName?: string;
  };
  timestamps: {
    firstSeen: Date;
    lastSeen: Date;
  };
  source: {
    connector: string;
    rawEventCount: number;
  };
}

/**
 * Aggregation key for deduplication
 */
export interface AggregationKey {
  endpoint: string;
  username: string;
  species: string;
}

/**
 * Aggregated detection
 */
export interface AggregatedDetection {
  key: AggregationKey;
  events: RawEvent[];
  patterns: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
}
