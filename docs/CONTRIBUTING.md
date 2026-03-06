# Contributing to AI Agent Discovery

Thank you for your interest in contributing to AI Agent Discovery! This document provides guidelines for contributing.

## Types of Contributions

### 1. Adding New Agent Species

The most common contribution is adding detection signatures for new AI agents.

#### Steps:

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/OpenGuardrails/ai-agent-discovery
   cd ai-agent-discovery
   ```

2. **Create a signature file**
   Create `registry/signatures/your-agent.yaml`:
   ```yaml
   id: your-agent
   name: Your Agent Signatures
   version: "1.0.0"
   author: your-github-username
   description: Detection patterns for Your Agent

   patterns:
     process:
       - pattern: "your-agent"
         type: substring
         case_sensitive: false
         fields: [file_path, image_name, command_line]

     file_path:
       - pattern: ".your-agent"
         type: substring
         description: Configuration directory

     network:
       - pattern: "your-agent.com"
         type: domain

   exclusions:
     processes:
       - chrome
       - firefox
     paths:
       - /tmp/
   ```

3. **Add to taxonomy**
   Create or update `registry/taxonomy/<kingdom>/your-family.yaml`:
   ```yaml
   family:
     id: your-family
     name: Your Family
     description: Description of your agent family
     kingdom: autonomous  # or: assistant, workflow

   species:
     - id: your-agent
       name: Your Agent
       description: Description of the specific agent
       website: https://your-agent.com
       signatures:
         - ref: your-agent
   ```

4. **Validate your changes**
   ```bash
   npm run build
   npx aad validate
   ```

5. **Test with sample data**
   ```bash
   npx aad test-signature registry/signatures/your-agent.yaml
   ```

6. **Submit a pull request**

### 2. Improving Detection Patterns

If you find false positives or missed detections:

1. Open an issue describing the problem
2. Include sample data (anonymized) if possible
3. Submit a PR with improved patterns

### 3. Adding EDR Connectors

To add support for a new EDR platform:

1. Create `src/connectors/your-edr/` directory
2. Implement the `Connector` interface
3. Add connector configuration schema
4. Create `registry/connectors/your-edr.yaml`
5. Add documentation

### 4. Bug Fixes and Features

1. Open an issue first to discuss the change
2. Reference the issue in your PR
3. Include tests for new functionality

## Code Style

- Use TypeScript
- Follow existing code patterns
- Use meaningful variable names
- Add JSDoc comments for public APIs

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/taxonomy.test.ts

# Validate registry files
npx aad validate
```

## Pull Request Guidelines

1. **Title**: Use a clear, descriptive title
2. **Description**: Explain what and why
3. **Testing**: Describe how you tested
4. **Breaking changes**: Note any breaking changes

## Taxonomy Guidelines

### Kingdom Selection

- **Autonomous**: Agents that act independently (AutoGPT, Devin, OpenClaw)
- **Assistant**: Chat-based agents requiring human interaction (Claude, ChatGPT, Cursor)
- **Workflow**: Automation orchestrators (Dify, N8N, Flowise)

### Naming Conventions

- Use lowercase with hyphens for IDs: `my-agent`
- Use proper casing for names: `My Agent`
- Keep descriptions concise but informative

## Signature Guidelines

### Pattern Types

- `substring`: Simple string matching (most common)
- `regex`: Regular expression matching (for complex patterns)
- `domain`: Domain name matching for network patterns

### Best Practices

1. Start with broad patterns, refine if needed
2. Include multiple indicators (process, file path, network)
3. Add exclusions to reduce false positives
4. Test against real-world data

## Community

- Be respectful and constructive
- Help others in issues and discussions
- Share your use cases and feedback

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
