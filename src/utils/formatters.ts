/**
 * Formatter Utilities
 *
 * Output formatting utilities
 */

import type { DetectionResult } from '../detectors/types.js';

/**
 * Format detection results as CSV
 */
export function formatResultsAsCsv(results: DetectionResult[]): string {
  const headers = [
    'id',
    'hostname',
    'os',
    'username',
    'domain',
    'kingdom',
    'family',
    'species',
    'confidence',
    'matched_patterns',
    'command_line',
    'file_path',
    'process_name',
    'first_seen',
    'last_seen',
    'connector',
    'event_count',
  ];

  const rows = results.map((r) => [
    r.id,
    escapeCsvValue(r.endpoint.hostname),
    r.endpoint.os,
    escapeCsvValue(r.user.username),
    escapeCsvValue(r.user.domain || ''),
    r.agent.kingdom,
    r.agent.family,
    r.agent.species,
    r.agent.confidence.toFixed(2),
    escapeCsvValue(r.evidence.matchedPatterns.join('; ')),
    escapeCsvValue(r.evidence.commandLine || ''),
    escapeCsvValue(r.evidence.filePath || ''),
    escapeCsvValue(r.evidence.processName || ''),
    r.timestamps.firstSeen.toISOString(),
    r.timestamps.lastSeen.toISOString(),
    r.source.connector,
    r.source.rawEventCount.toString(),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Escape CSV value
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format detection results as HTML report
 */
export function formatResultsAsHtml(results: DetectionResult[]): string {
  const timestamp = new Date().toISOString();

  const byKingdom: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  const endpoints = new Set<string>();
  const users = new Set<string>();

  for (const r of results) {
    byKingdom[r.agent.kingdom] = (byKingdom[r.agent.kingdom] || 0) + 1;
    byFamily[r.agent.family] = (byFamily[r.agent.family] || 0) + 1;
    endpoints.add(r.endpoint.hostname);
    users.add(r.user.username);
  }

  const tableRows = results
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.endpoint.hostname)}</td>
        <td>${r.endpoint.os}</td>
        <td>${escapeHtml(r.user.username)}</td>
        <td>${r.agent.kingdom}</td>
        <td>${r.agent.family}</td>
        <td>${r.agent.species}</td>
        <td>${(r.agent.confidence * 100).toFixed(0)}%</td>
        <td>${formatDate(r.timestamps.lastSeen)}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Agent Discovery Report - ${timestamp}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1e293b; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .stat { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .stat-label { color: #64748b; font-size: 0.875rem; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:hover { background: #f8fafc; }
    .footer { margin-top: 2rem; color: #64748b; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI Agent Discovery Report</h1>
    <p>Generated: ${timestamp}</p>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Total Agents</div>
      </div>
      <div class="stat">
        <div class="stat-value">${endpoints.size}</div>
        <div class="stat-label">Endpoints</div>
      </div>
      <div class="stat">
        <div class="stat-value">${users.size}</div>
        <div class="stat-label">Users</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Object.keys(byFamily).length}</div>
        <div class="stat-label">Agent Families</div>
      </div>
    </div>

    <h2>Detected Agents</h2>
    <table>
      <thead>
        <tr>
          <th>Hostname</th>
          <th>OS</th>
          <th>User</th>
          <th>Kingdom</th>
          <th>Family</th>
          <th>Species</th>
          <th>Confidence</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="footer">
      <p>AI Agent Discovery v1.0.0</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format date
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
