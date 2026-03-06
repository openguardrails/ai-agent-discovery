/**
 * Event Aggregator
 *
 * Aggregates and deduplicates detection events
 */

import type {
  RawEvent,
  DetectionResult,
  AggregationKey,
  AggregatedDetection,
  PatternMatch,
} from './types.js';
import type { Species } from '../taxonomy/types.js';
import { calculateConfidence } from './pattern-matcher.js';
import * as crypto from 'crypto';

/**
 * Create aggregation key
 */
function createAggregationKey(event: RawEvent, speciesId: string): string {
  return `${event.endpoint}|${event.username}|${speciesId}`;
}

/**
 * Parse aggregation key
 */
function parseAggregationKey(key: string): AggregationKey {
  const [endpoint, username, species] = key.split('|');
  return { endpoint, username, species };
}

/**
 * Normalize OS type string
 */
function normalizeOsType(osType?: string): 'Windows' | 'macOS' | 'Linux' | 'Unknown' {
  if (!osType) return 'Unknown';

  const lower = osType.toLowerCase();
  if (lower.includes('win') || lower === 'windows') return 'Windows';
  if (lower.includes('mac') || lower === 'darwin' || lower === 'macos') return 'macOS';
  if (lower.includes('lin') || lower === 'linux') return 'Linux';

  return 'Unknown';
}

/**
 * Parse username into user and domain
 */
function parseUsername(username: string): { username: string; domain?: string } {
  // Handle DOMAIN\user format
  if (username.includes('\\')) {
    const [domain, user] = username.split('\\');
    return { username: user, domain };
  }

  // Handle user@domain format
  if (username.includes('@')) {
    const [user, domain] = username.split('@');
    return { username: user, domain };
  }

  return { username };
}

/**
 * Event aggregator class
 */
export class EventAggregator {
  private aggregations: Map<string, AggregatedDetection> = new Map();
  private speciesInfo: Map<string, Species> = new Map();

  /**
   * Add an event with its matches to the aggregator
   */
  addEvent(event: RawEvent, species: Species, matches: PatternMatch[]): void {
    const key = createAggregationKey(event, species.id);
    this.speciesInfo.set(species.id, species);

    const existing = this.aggregations.get(key);
    const eventTime = new Date(event.timestamp);

    if (existing) {
      existing.events.push(event);
      for (const match of matches) {
        existing.patterns.add(match.pattern);
      }
      if (eventTime < existing.firstSeen) {
        existing.firstSeen = eventTime;
      }
      if (eventTime > existing.lastSeen) {
        existing.lastSeen = eventTime;
      }
    } else {
      this.aggregations.set(key, {
        key: parseAggregationKey(key),
        events: [event],
        patterns: new Set(matches.map((m) => m.pattern)),
        firstSeen: eventTime,
        lastSeen: eventTime,
      });
    }
  }

  /**
   * Get aggregated detections
   */
  getAggregatedDetections(): AggregatedDetection[] {
    return Array.from(this.aggregations.values());
  }

  /**
   * Convert aggregations to detection results
   */
  getDetectionResults(connectorType: string): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (const aggregation of this.aggregations.values()) {
      const species = this.speciesInfo.get(aggregation.key.species);
      if (!species) continue;

      // Get representative event (most recent)
      const events = aggregation.events;
      const latestEvent = events.reduce((latest, event) =>
        new Date(event.timestamp) > new Date(latest.timestamp) ? event : latest
      );

      const { username, domain } = parseUsername(aggregation.key.username);
      const patterns = Array.from(aggregation.patterns);

      results.push({
        id: generateId(),
        endpoint: {
          hostname: aggregation.key.endpoint,
          os: normalizeOsType(latestEvent.os_type),
        },
        user: {
          username,
          domain,
        },
        agent: {
          kingdom: species.kingdom,
          family: species.family,
          species: species.id,
          confidence: calculateConfidence(
            patterns.map((p) => ({ pattern: p, field: '', value: '' }))
          ),
        },
        evidence: {
          matchedPatterns: patterns,
          commandLine: latestEvent.command_line,
          filePath: latestEvent.file_path,
          processName: latestEvent.image_name,
        },
        timestamps: {
          firstSeen: aggregation.firstSeen,
          lastSeen: aggregation.lastSeen,
        },
        source: {
          connector: connectorType,
          rawEventCount: events.length,
        },
      });
    }

    return results;
  }

  /**
   * Clear all aggregations
   */
  clear(): void {
    this.aggregations.clear();
    this.speciesInfo.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAggregations: number;
    totalEvents: number;
    uniqueEndpoints: number;
    uniqueUsers: number;
    uniqueSpecies: number;
  } {
    const endpoints = new Set<string>();
    const users = new Set<string>();
    const speciesIds = new Set<string>();
    let totalEvents = 0;

    for (const agg of this.aggregations.values()) {
      endpoints.add(agg.key.endpoint);
      users.add(agg.key.username);
      speciesIds.add(agg.key.species);
      totalEvents += agg.events.length;
    }

    return {
      totalAggregations: this.aggregations.size,
      totalEvents,
      uniqueEndpoints: endpoints.size,
      uniqueUsers: users.size,
      uniqueSpecies: speciesIds.size,
    };
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID();
}
