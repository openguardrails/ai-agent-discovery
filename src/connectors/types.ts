/**
 * Connector Types
 */

import type { RawEvent } from '../detectors/types.js';

/**
 * Connector configuration from registry
 */
export interface ConnectorConfig {
  id: string;
  name: string;
  type: string;
  version: string;
  api?: {
    base_url: string;
    auth_type: string;
    auth_url?: string;
    repository?: string;
  };
  field_mappings: Record<string, string>;
  os_mappings?: Record<string, string>;
  query_template?: string;
  limits?: {
    max_events_per_query?: number;
    window_days?: number;
    request_delay_ms?: number;
  };
}

/**
 * Query options for fetching events
 */
export interface QueryOptions {
  lookbackDays?: number;
  maxEvents?: number;
  patterns?: string[];
}

/**
 * Connector interface
 */
export interface Connector {
  /**
   * Connector type identifier
   */
  readonly type: string;

  /**
   * Connector name
   */
  readonly name: string;

  /**
   * Initialize the connector
   */
  initialize(): Promise<void>;

  /**
   * Test the connection
   */
  testConnection(): Promise<boolean>;

  /**
   * Fetch events from the data source
   */
  fetchEvents(options: QueryOptions): Promise<RawEvent[]>;

  /**
   * Close the connection
   */
  close(): Promise<void>;
}

/**
 * Connector factory function type
 */
export type ConnectorFactory = (config: unknown) => Connector;

/**
 * Raw response from CrowdStrike API
 */
export interface CrowdStrikeEvent {
  '@timestamp': string;
  ComputerName: string;
  UserName: string;
  event_platform: string;
  FilePath?: string;
  ImageFileName?: string;
  CommandLine?: string;
  ParentBaseFileName?: string;
  [key: string]: unknown;
}

/**
 * Raw response from Defender API
 */
export interface DefenderEvent {
  Timestamp: string;
  DeviceName: string;
  AccountName: string;
  OSPlatform: string;
  FolderPath?: string;
  FileName?: string;
  ProcessCommandLine?: string;
  InitiatingProcessFileName?: string;
  [key: string]: unknown;
}

/**
 * CSV/JSON file event format
 */
export interface FileEvent {
  timestamp?: string;
  Timestamp?: string;
  '@timestamp'?: string;
  endpoint?: string;
  hostname?: string;
  ComputerName?: string;
  DeviceName?: string;
  username?: string;
  UserName?: string;
  AccountName?: string;
  os_type?: string;
  os?: string;
  event_platform?: string;
  OSPlatform?: string;
  file_path?: string;
  FilePath?: string;
  FolderPath?: string;
  image_name?: string;
  ImageFileName?: string;
  FileName?: string;
  command_line?: string;
  CommandLine?: string;
  ProcessCommandLine?: string;
  parent_process?: string;
  ParentBaseFileName?: string;
  InitiatingProcessFileName?: string;
  [key: string]: unknown;
}
