# AI Agent Discovery

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://badge.fury.io/js/ai-agent-discovery.svg)](https://www.npmjs.com/package/ai-agent-discovery)
[![GitHub stars](https://img.shields.io/github/stars/OpenGuardrails/ai-agent-discovery)](https://github.com/OpenGuardrails/ai-agent-discovery/stargazers)

**An open-source enterprise tool by [OpenGuardrails](https://openguardrails.io) for discovering AI agents running within your organization.**

As AI agent adoption explodes across enterprises, security teams face a critical visibility gap. AI Agent Discovery integrates with your existing EDR infrastructure to identify and inventory all AI agents—from autonomous coding assistants to workflow automation platforms.


## Why AI Agent Discovery?

- **Shadow AI Visibility**: Discover AI tools employees are using without IT knowledge
- **Security Posture**: Understand your AI attack surface
- **Compliance**: Track AI usage for regulatory requirements
- **Cost Control**: Identify redundant AI tool subscriptions

## Features

| Feature | Description |
|---------|-------------|
| **Agent Taxonomy** | 3-level classification: Kingdom → Family → Species |
| **Multi-EDR Support** | CrowdStrike Falcon, Microsoft Defender, or file import |
| **Pattern Detection** | Community-maintained YAML signatures |
| **Web Dashboard** | Real-time visualization and reporting |
| **Easy Deployment** | Single command to get started |

## Quick Start

```bash
# Run directly with npx
npx ai-agent-discovery

# Or install globally
npm install -g ai-agent-discovery

# Initialize configuration
aad init

# Run a scan
aad scan

# Start the dashboard
aad dashboard
```

## Supported AI Agents

### Autonomous Agents
| Agent | Variants |
|-------|----------|
| OpenClaw | openclaw, nanoclaw, moltbot, clawdbot |
| AutoGPT | autogpt, agentgpt, babyagi |
| Devin | devin, opendevin, swe-agent |

### Assistant Agents
| Agent | Variants |
|-------|----------|
| Claude | claude-desktop, claude-code, cline |
| ChatGPT | chatgpt-desktop, chatgpt-app |
| Cursor | cursor |
| Copilot | copilot, copilot-chat |

### Workflow Agents
| Agent | Variants |
|-------|----------|
| Dify | dify, dify-sandbox |
| N8N | n8n |
| Flowise | flowise, langflow |

## CLI Commands

```bash
# Core commands
aad init                    # Initialize configuration
aad scan                    # Run detection scan
aad dashboard               # Start web dashboard

# Scan options
aad scan --connector file   # Use file connector
aad scan --lookback 30      # Look back 30 days
aad scan --output csv       # Output as CSV

# Taxonomy browsing
aad taxonomy list           # List all known agents
aad taxonomy list --kingdom autonomous
aad taxonomy show claude    # Show agent details
aad taxonomy tree           # Show full taxonomy tree

# Configuration
aad config get connector.type
aad config set connector.type crowdstrike

# Validation
aad validate                # Validate all registry files
aad test-signature ./my-sig.yaml  # Test a signature
```

## Configuration

Create `config/config.yaml`:

```yaml
# EDR Connector
connector:
  type: crowdstrike  # Options: crowdstrike, defender, file

  crowdstrike:
    client_id: ${CROWDSTRIKE_CLIENT_ID}
    client_secret: ${CROWDSTRIKE_CLIENT_SECRET}

  defender:
    tenant_id: ${AZURE_TENANT_ID}
    client_id: ${AZURE_CLIENT_ID}
    client_secret: ${AZURE_CLIENT_SECRET}

  file:
    path: ./data/events.json
    format: json  # csv, json, ndjson

# Scan settings
scan:
  lookback_days: 14
  max_events: 10000

# Dashboard
dashboard:
  port: 3000
  host: 0.0.0.0
```

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   EDR Platform  │────▶│   Detection     │────▶│   Dashboard     │
│  (CrowdStrike,  │     │   Engine        │     │   & Reports     │
│   Defender)     │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   Community     │
                        │   Signatures    │
                        │   (YAML)        │
                        └─────────────────┘
```

1. **Connect** to your EDR platform with API credentials
2. **Query** process execution events using detection patterns
3. **Match** events against community-maintained signatures
4. **Aggregate** results by endpoint, user, and agent type
5. **Visualize** in the dashboard or export reports

## Contributing

We welcome contributions! The easiest way to contribute is by adding detection signatures for new AI agents.

### Adding a New Agent

1. Fork & clone the repository
2. Create signature file: `registry/signatures/my-agent.yaml`
3. Add to taxonomy: `registry/taxonomy/<kingdom>/my-agent.yaml`
4. Validate: `aad validate`
5. Test: `aad test-signature registry/signatures/my-agent.yaml`
6. Submit a pull request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed instructions.

### Signature Format

```yaml
id: my-agent
name: My Agent Signatures
version: "1.0.0"
author: your-github-username
description: Detection patterns for My Agent

patterns:
  process:
    - pattern: "myagent"
      type: substring
      case_sensitive: false
      fields: [file_path, image_name, command_line]

  file_path:
    - pattern: ".myagent"
      type: substring

exclusions:
  processes: [chrome, firefox]
  paths: [/tmp/]
```

## Project Structure

```
ai-agent-discovery/
├── bin/aad.js              # CLI entry point
├── src/
│   ├── cli.ts              # CLI commands (Commander.js)
│   ├── taxonomy/           # Agent classification system
│   ├── detectors/          # Pattern matching engine
│   ├── connectors/         # EDR connectors
│   ├── dashboard/          # Express.js web UI
│   ├── config/             # Configuration (Zod)
│   └── utils/              # Logging, filters
├── registry/               # Community-contributed
│   ├── taxonomy/           # Agent taxonomy (YAML)
│   ├── signatures/         # Detection patterns (YAML)
│   └── connectors/         # EDR configs (YAML)
├── docs/                   # Documentation
└── tests/                  # Test fixtures
```

## Roadmap

- [ ] SentinelOne connector
- [ ] Carbon Black connector
- [ ] Elastic Security connector
- [ ] Risk scoring and alerting
- [ ] SIEM integration (Splunk, Sentinel)
- [ ] Agent behavior analysis
- [ ] Policy enforcement

## Community

- **GitHub Issues**: [Report bugs or request features](https://github.com/OpenGuardrails/ai-agent-discovery/issues)
- **Discussions**: [Join the conversation](https://github.com/OpenGuardrails/ai-agent-discovery/discussions)
- **Discord**: [OpenGuardrails Community](https://discord.gg/openguardrails)
- **Twitter/X**: [@OpenGuardrails](https://twitter.com/OpenGuardrails)

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://openguardrails.io">OpenGuardrails</a></strong>
  <br>
  <em>Open-source security tools for the AI era</em>
</p>
