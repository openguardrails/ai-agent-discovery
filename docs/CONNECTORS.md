# Connector Development Guide

This guide explains how to develop new EDR connectors for AI Agent Discovery.

## Connector Architecture

Connectors are plugins that fetch security events from various data sources (EDR platforms, SIEM systems, log files, etc.).

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Base Connector │────▶│  Your Connector │────▶│  Data Source    │
│    (abstract)   │     │ (implementation)│     │  (EDR/SIEM)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Connector Interface

All connectors must implement the `Connector` interface:

```typescript
interface Connector {
  // Unique identifier
  readonly type: string;

  // Display name
  readonly name: string;

  // Initialize the connector
  initialize(): Promise<void>;

  // Test the connection
  testConnection(): Promise<boolean>;

  // Fetch events
  fetchEvents(options: QueryOptions): Promise<RawEvent[]>;

  // Cleanup
  close(): Promise<void>;
}
```

## Creating a New Connector

### 1. Create Connector Directory

```
src/connectors/your-edr/
├── index.ts      # Main connector class
├── client.ts     # API client
└── types.ts      # Type definitions (optional)
```

### 2. Implement the Connector

`src/connectors/your-edr/index.ts`:

```typescript
import { BaseConnector } from '../base-connector.js';
import { YourEdrClient } from './client.js';
import type { QueryOptions } from '../types.js';
import type { RawEvent } from '../../detectors/types.js';
import type { YourEdrConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';

export class YourEdrConnector extends BaseConnector {
  readonly type = 'your-edr';
  readonly name = 'Your EDR Platform';

  private config: YourEdrConfig;
  private client: YourEdrClient | null = null;

  constructor(config: YourEdrConfig) {
    super();
    this.config = config;
  }

  protected async doInitialize(): Promise<void> {
    this.client = new YourEdrClient(this.config);
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Your EDR');
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      this.client = new YourEdrClient(this.config);
    }
    return this.client.testConnection();
  }

  async fetchEvents(options: QueryOptions): Promise<RawEvent[]> {
    this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Build query from patterns
    const query = this.buildQuery(options.patterns || [], options.lookbackDays);

    // Execute query
    const response = await this.client.executeQuery(query);

    // Normalize events
    return response.events.map(event => this.normalizeEvent(event));
  }

  private buildQuery(patterns: string[], lookbackDays?: number): string {
    // Implement your EDR's query language
    return `...`;
  }

  private normalizeEvent(event: YourEdrEvent): RawEvent {
    return {
      timestamp: event.your_timestamp_field,
      endpoint: event.your_hostname_field,
      username: event.your_username_field,
      os_type: event.your_os_field,
      file_path: event.your_filepath_field,
      image_name: event.your_processname_field,
      command_line: event.your_cmdline_field,
      parent_process: event.your_parent_field,
    };
  }

  protected async doClose(): Promise<void> {
    this.client = null;
  }
}

export function createYourEdrConnector(config: YourEdrConfig): YourEdrConnector {
  return new YourEdrConnector(config);
}
```

### 3. Implement the API Client

`src/connectors/your-edr/client.ts`:

```typescript
import axios, { type AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';
import type { YourEdrConfig } from '../../config/schema.js';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

interface QueryResponse {
  events: YourEdrEvent[];
}

export interface YourEdrEvent {
  // Define your EDR's event structure
  your_timestamp_field: string;
  your_hostname_field: string;
  your_username_field: string;
  // ...
}

export class YourEdrClient {
  private config: YourEdrConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: YourEdrConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.base_url || 'https://api.your-edr.com',
      timeout: 60000,
    });
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Fetch new token
    const response = await this.client.post<TokenResponse>('/auth/token', {
      client_id: this.config.client_id,
      client_secret: this.config.client_secret,
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

    return this.accessToken;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Connection test failed');
      return false;
    }
  }

  async executeQuery(query: string): Promise<QueryResponse> {
    const token = await this.getAccessToken();

    const response = await this.client.post('/query', { query }, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  }
}
```

### 4. Add Configuration Schema

Update `src/config/schema.ts`:

```typescript
export const yourEdrConfigSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  base_url: z.string().url().optional(),
  // Add other config options
});

export type YourEdrConfig = z.infer<typeof yourEdrConfigSchema>;

// Update connectorConfigSchema
export const connectorConfigSchema = z.object({
  type: z.enum(['crowdstrike', 'defender', 'file', 'your-edr']),
  // ...
  your_edr: yourEdrConfigSchema.optional(),
});
```

### 5. Register the Connector

Update `src/connectors/index.ts`:

```typescript
import { YourEdrConnector, createYourEdrConnector } from './your-edr/index.js';

export function getConnector(config: ConnectorConfig): Connector {
  switch (config.type) {
    // ...
    case 'your-edr':
      if (!config.your_edr) {
        throw new Error('Your EDR configuration required');
      }
      return createYourEdrConnector(config.your_edr);
  }
}
```

### 6. Create Registry Configuration

`registry/connectors/your-edr.yaml`:

```yaml
id: your-edr
name: Your EDR Platform
type: edr
version: "1.0.0"

api:
  base_url: https://api.your-edr.com
  auth_type: oauth2
  auth_url: /auth/token

field_mappings:
  timestamp: "your_timestamp_field"
  endpoint: "your_hostname_field"
  username: "your_username_field"
  os_type: "your_os_field"
  file_path: "your_filepath_field"
  image_name: "your_processname_field"
  command_line: "your_cmdline_field"
  parent_process: "your_parent_field"

query_template: |
  // Your EDR's query language template
  events
  | where timestamp > ago({{lookback_days}}d)
  | where {{#patterns}}filepath contains '{{pattern}}'{{/patterns}}
  | limit 10000

limits:
  max_events_per_query: 10000
  window_days: 7
  request_delay_ms: 1000
```

## Field Normalization

All connectors must normalize events to the standard `RawEvent` format:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp |
| `endpoint` | string | Hostname/device name |
| `username` | string | User who ran the process |
| `os_type` | string | Operating system (Windows/macOS/Linux) |
| `file_path` | string | Full path to executable |
| `image_name` | string | Process/executable name |
| `command_line` | string | Full command line |
| `parent_process` | string | Parent process name |

## Testing Your Connector

### Unit Tests

Create `tests/unit/connectors/your-edr.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { YourEdrConnector } from '../../../src/connectors/your-edr/index.js';

describe('YourEdrConnector', () => {
  it('should initialize correctly', async () => {
    const connector = new YourEdrConnector({
      client_id: 'test',
      client_secret: 'test',
    });

    // Mock API calls
    vi.spyOn(connector, 'testConnection').mockResolvedValue(true);

    await connector.initialize();
    expect(connector.type).toBe('your-edr');
  });

  it('should normalize events', async () => {
    // Test event normalization
  });
});
```

### Integration Tests

Create `tests/integration/your-edr.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { YourEdrConnector } from '../../src/connectors/your-edr/index.js';

describe('YourEdrConnector Integration', () => {
  it('should connect to real API', async () => {
    // Only run if credentials are available
    if (!process.env.YOUR_EDR_CLIENT_ID) {
      return;
    }

    const connector = new YourEdrConnector({
      client_id: process.env.YOUR_EDR_CLIENT_ID!,
      client_secret: process.env.YOUR_EDR_CLIENT_SECRET!,
    });

    const connected = await connector.testConnection();
    expect(connected).toBe(true);
  });
});
```

## Best Practices

### 1. Handle Rate Limits

```typescript
private async executeWithRetry(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        await this.delay(5000 * (i + 1));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 2. Paginate Large Results

```typescript
async fetchAllEvents(query: string): Promise<YourEdrEvent[]> {
  const allEvents: YourEdrEvent[] = [];
  let cursor: string | null = null;

  do {
    const response = await this.client.executeQuery(query, { cursor });
    allEvents.push(...response.events);
    cursor = response.next_cursor;
  } while (cursor);

  return allEvents;
}
```

### 3. Cache Authentication Tokens

```typescript
private async getAccessToken(): Promise<string> {
  if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
    return this.accessToken;
  }
  // Refresh token...
}
```

### 4. Log Operations

```typescript
async fetchEvents(options: QueryOptions): Promise<RawEvent[]> {
  logger.info({ lookbackDays: options.lookbackDays }, 'Fetching events');

  const events = await this.doFetchEvents(options);

  logger.info({ count: events.length }, 'Events fetched');
  return events;
}
```

## Submitting Your Connector

1. Follow the coding standards in the project
2. Add comprehensive tests
3. Create documentation
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.
