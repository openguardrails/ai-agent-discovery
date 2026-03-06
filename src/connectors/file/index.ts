/**
 * File Connector
 *
 * Reads events from local CSV, JSON, or NDJSON files
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseConnector } from '../base-connector.js';
import type { QueryOptions, FileEvent } from '../types.js';
import type { RawEvent } from '../../detectors/types.js';
import type { FileConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';

/**
 * File connector for local file import
 */
export class FileConnector extends BaseConnector {
  readonly type = 'file';
  readonly name = 'File Connector';

  private config: FileConfig;
  private data: FileEvent[] = [];

  constructor(config: FileConfig) {
    super();
    this.config = config;
  }

  protected async doInitialize(): Promise<void> {
    const filePath = path.resolve(process.cwd(), this.config.path);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');

    switch (this.config.format) {
      case 'json':
        this.data = this.parseJson(content);
        break;
      case 'ndjson':
        this.data = this.parseNdjson(content);
        break;
      case 'csv':
      default:
        this.data = this.parseCsv(content);
        break;
    }

    logger.info({ records: this.data.length, format: this.config.format }, 'File loaded');
  }

  private parseJson(content: string): FileEvent[] {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  private parseNdjson(content: string): FileEvent[] {
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  private parseCsv(content: string): FileEvent[] {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const records: FileEvent[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const record: FileEvent = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j] || '';
      }

      records.push(record);
    }

    return records;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  async testConnection(): Promise<boolean> {
    const filePath = path.resolve(process.cwd(), this.config.path);
    return fs.existsSync(filePath);
  }

  async fetchEvents(options: QueryOptions): Promise<RawEvent[]> {
    this.ensureInitialized();

    let events = this.data;

    // Filter by lookback days if specified
    if (options.lookbackDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - options.lookbackDays);

      events = events.filter((event) => {
        const timestamp = this.extractTimestamp(event);
        return timestamp && new Date(timestamp) >= cutoff;
      });
    }

    // Limit results
    const maxEvents = options.maxEvents || 10000;
    events = events.slice(0, maxEvents);

    // Normalize to RawEvent format
    return events.map((event) => this.normalizeEvent(event));
  }

  private extractTimestamp(event: FileEvent): string | undefined {
    return (
      event.timestamp ||
      event.Timestamp ||
      event['@timestamp'] ||
      undefined
    );
  }

  private normalizeEvent(event: FileEvent): RawEvent {
    return {
      timestamp:
        event.timestamp ||
        event.Timestamp ||
        event['@timestamp'] ||
        new Date().toISOString(),
      endpoint:
        event.endpoint ||
        event.hostname ||
        event.ComputerName ||
        event.DeviceName ||
        'unknown',
      username:
        event.username ||
        event.UserName ||
        event.AccountName ||
        'unknown',
      os_type:
        event.os_type ||
        event.os ||
        event.event_platform ||
        event.OSPlatform,
      file_path:
        event.file_path ||
        event.FilePath ||
        event.FolderPath,
      image_name:
        event.image_name ||
        event.ImageFileName ||
        event.FileName,
      command_line:
        event.command_line ||
        event.CommandLine ||
        event.ProcessCommandLine,
      parent_process:
        event.parent_process ||
        event.ParentBaseFileName ||
        event.InitiatingProcessFileName,
    };
  }
}

/**
 * Create a file connector
 */
export function createFileConnector(config: FileConfig): FileConnector {
  return new FileConnector(config);
}
