# Signature Authoring Guide

This guide explains how to create detection signatures for AI agents.

## Signature Structure

```yaml
# Required fields
id: agent-name           # Unique identifier (lowercase, hyphens)
name: Agent Name         # Display name
version: "1.0.0"         # Semantic version
author: github-username  # Your GitHub username
description: Description of what this detects

# Detection patterns
patterns:
  process:     # Process-related patterns
    - pattern: "agent-name"
      type: substring
      case_sensitive: false
      fields: [file_path, image_name, command_line]

  file_path:   # File path patterns
    - pattern: ".agent-config"
      type: substring
      description: Configuration directory

  network:     # Network patterns (future use)
    - pattern: "agent.example.com"
      type: domain

# Optional exclusions
exclusions:
  processes:
    - chrome
    - firefox
  paths:
    - /tmp/
    - /cache/
```

## Pattern Types

### Substring

Simple string matching. Most efficient and should be your default choice.

```yaml
- pattern: "my-agent"
  type: substring
  case_sensitive: false  # Default: false
```

### Regex

Regular expression matching. Use when substring isn't flexible enough.

```yaml
- pattern: "MyAgent\\.app"
  type: regex
  case_sensitive: true
```

Common regex patterns:
- `\\.` - Literal dot
- `.*` - Any characters
- `[0-9]+` - One or more digits
- `(v1|v2)` - Alternatives

### Domain

Match domain names in network-related fields.

```yaml
- pattern: "api.myagent.com"
  type: domain
```

## Match Fields

Specify which fields to match against:

| Field | Description |
|-------|-------------|
| `file_path` | Full path to the file |
| `image_name` | Process/executable name |
| `command_line` | Full command line |
| `process_name` | Process name (alias for image_name) |

Default fields by category:
- `process`: `[file_path, image_name, command_line]`
- `file_path`: `[file_path]`
- `network`: `[command_line]`

## Writing Effective Patterns

### 1. Start Broad

Begin with obvious patterns:

```yaml
patterns:
  process:
    - pattern: "myagent"
      type: substring
      case_sensitive: false
```

### 2. Add Specificity

Refine based on testing:

```yaml
patterns:
  process:
    - pattern: "myagent"
      type: substring
      case_sensitive: false
      fields: [file_path, image_name, command_line]

    - pattern: "MyAgent\\.app"
      type: regex
      case_sensitive: true
      fields: [file_path]

  file_path:
    - pattern: ".myagent"
      type: substring
      description: Hidden config directory
```

### 3. Add Exclusions

Reduce false positives:

```yaml
exclusions:
  processes:
    - chrome
    - firefox
    - msedge
    - safari
  paths:
    - /tmp/
    - /var/cache/
    - node_modules/
```

## Platform Considerations

### macOS

- Apps are bundles: `MyAgent.app/Contents/MacOS/MyAgent`
- Config in: `~/Library/Application Support/MyAgent/`
- Hidden config: `~/.myagent/`

```yaml
patterns:
  file_path:
    - pattern: "MyAgent.app"
      type: substring

    - pattern: "Application Support/MyAgent"
      type: substring
```

### Windows

- Executables: `MyAgent.exe`
- Program Files: `C:\Program Files\MyAgent\`
- AppData: `%APPDATA%\MyAgent\`

```yaml
patterns:
  file_path:
    - pattern: "MyAgent.exe"
      type: substring

    - pattern: "Program Files\\MyAgent"
      type: substring

    - pattern: "AppData\\Roaming\\MyAgent"
      type: substring
```

### Linux

- Binaries: `/usr/bin/myagent`
- Config: `~/.config/myagent/` or `~/.myagent/`

```yaml
patterns:
  file_path:
    - pattern: "/bin/myagent"
      type: substring

    - pattern: "/.myagent"
      type: substring
```

## Testing Your Signature

### 1. Validate YAML

```bash
npx aad validate
```

### 2. Test Against Sample Data

Create `test-data.json`:
```json
[
  {
    "timestamp": "2024-01-15T10:00:00Z",
    "endpoint": "WORKSTATION-01",
    "username": "jsmith",
    "file_path": "/Applications/MyAgent.app/Contents/MacOS/MyAgent",
    "image_name": "MyAgent",
    "command_line": "/Applications/MyAgent.app/Contents/MacOS/MyAgent --start"
  }
]
```

Run test:
```bash
npx aad test-signature registry/signatures/myagent.yaml -d test-data.json
```

### 3. Test Full Pipeline

```bash
# Configure file connector
npx aad config set connector.type file
npx aad config set connector.file.path ./test-data.json

# Run scan
npx aad scan
```

## Common Mistakes

### 1. Too Broad Patterns

Bad:
```yaml
- pattern: "agent"  # Matches too many things!
  type: substring
```

Good:
```yaml
- pattern: "myagent"  # Specific to this agent
  type: substring
```

### 2. Case Sensitivity Issues

Bad:
```yaml
- pattern: "MYAGENT"
  type: substring
  case_sensitive: true  # Will miss "myagent"
```

Good:
```yaml
- pattern: "myagent"
  type: substring
  case_sensitive: false  # Matches any case
```

### 3. Missing Exclusions

Bad:
```yaml
patterns:
  process:
    - pattern: "ai"  # No exclusions = many false positives
```

Good:
```yaml
patterns:
  process:
    - pattern: "ai-assistant"
exclusions:
  processes:
    - chrome
    - vscode
```

## Advanced Patterns

### Multiple Variations

```yaml
patterns:
  process:
    - pattern: "myagent"
      type: substring

    - pattern: "my-agent"
      type: substring

    - pattern: "MyAgent"
      type: substring
      case_sensitive: true
```

### Version Detection

```yaml
patterns:
  file_path:
    - pattern: "myagent-v[0-9]+"
      type: regex
      description: Detect any version
```

### Container Detection

```yaml
patterns:
  process:
    - pattern: "docker.*myagent"
      type: regex
      fields: [command_line]
      description: Detect containerized deployment
```

## Submitting Your Signature

1. Fork the repository
2. Add your signature file to `registry/signatures/`
3. Add taxonomy entry to `registry/taxonomy/`
4. Run `npx aad validate`
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.
