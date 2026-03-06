/**
 * Detection Engine
 *
 * Main orchestrator for pattern matching and event aggregation
 */

import { logger } from '../utils/logger.js';
import type { Taxonomy } from '../taxonomy/types.js';
import type { RawEvent, DetectionResult, CompiledSignature } from './types.js';
import { buildCompiledSignatures, matchEventToSpecies } from './pattern-matcher.js';
import { EventAggregator } from './aggregator.js';

export * from './types.js';
export { loadSignature, loadSignatures, compileSignature } from './pattern-matcher.js';
export { EventAggregator } from './aggregator.js';

/**
 * Detection engine options
 */
export interface DetectionEngineOptions {
  registryPath?: string;
  signaturesPath?: string;
}

/**
 * Detection Engine
 *
 * Orchestrates pattern matching and event aggregation
 */
export class DetectionEngine {
  private taxonomy: Taxonomy;
  private compiledSignatures: Map<string, CompiledSignature[]>;
  private aggregator: EventAggregator;
  private connectorType: string = 'unknown';

  constructor(taxonomy: Taxonomy, options: DetectionEngineOptions = {}) {
    this.taxonomy = taxonomy;
    this.compiledSignatures = buildCompiledSignatures(
      taxonomy,
      options.signaturesPath
    );
    this.aggregator = new EventAggregator();

    logger.info(
      { speciesWithSignatures: this.compiledSignatures.size },
      'Detection engine initialized'
    );
  }

  /**
   * Set the connector type for result attribution
   */
  setConnectorType(type: string): void {
    this.connectorType = type;
  }

  /**
   * Process a single event
   */
  processEvent(event: RawEvent): void {
    const matches = matchEventToSpecies(event, this.compiledSignatures, this.taxonomy);

    for (const { species, matches: patternMatches } of matches) {
      this.aggregator.addEvent(event, species, patternMatches);
    }
  }

  /**
   * Process multiple events
   */
  processEvents(events: RawEvent[]): void {
    logger.info({ count: events.length }, 'Processing events');

    for (const event of events) {
      this.processEvent(event);
    }

    const stats = this.aggregator.getStats();
    logger.info(stats, 'Events processed');
  }

  /**
   * Get detection results
   */
  getResults(): DetectionResult[] {
    return this.aggregator.getDetectionResults(this.connectorType);
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    totalAggregations: number;
    totalEvents: number;
    uniqueEndpoints: number;
    uniqueUsers: number;
    uniqueSpecies: number;
  } {
    return this.aggregator.getStats();
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.aggregator.clear();
  }

  /**
   * Get compiled signatures for debugging
   */
  getCompiledSignatures(): Map<string, CompiledSignature[]> {
    return this.compiledSignatures;
  }

  /**
   * Check if a species has signatures loaded
   */
  hasSignaturesForSpecies(speciesId: string): boolean {
    return this.compiledSignatures.has(speciesId);
  }

  /**
   * Get list of species with loaded signatures
   */
  getLoadedSpecies(): string[] {
    return Array.from(this.compiledSignatures.keys());
  }
}

/**
 * Create a detection engine instance
 */
export function createDetectionEngine(
  taxonomy: Taxonomy,
  options?: DetectionEngineOptions
): DetectionEngine {
  return new DetectionEngine(taxonomy, options);
}

/**
 * Quick scan function for simple use cases
 */
export async function quickScan(
  events: RawEvent[],
  taxonomy: Taxonomy,
  connectorType: string = 'unknown'
): Promise<DetectionResult[]> {
  const engine = new DetectionEngine(taxonomy);
  engine.setConnectorType(connectorType);
  engine.processEvents(events);
  return engine.getResults();
}
