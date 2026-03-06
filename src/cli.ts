#!/usr/bin/env node
/**
 * AI Agent Discovery CLI
 *
 * Command-line interface for discovering AI agents
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, createDefaultConfig, findConfigFile, getConfigValue, updateConfigFile } from './config/index.js';
import { loadTaxonomy, validateTaxonomy, searchTaxonomy, getTaxonomyTree, getSpecies, getFamily } from './taxonomy/index.js';
import { DetectionEngine } from './detectors/index.js';
import { getConnector, validateConnectorConfig } from './connectors/index.js';
import { startDashboard } from './dashboard/server.js';
import { logger } from './utils/logger.js';
import { getAllPatterns } from './utils/filters.js';

const program = new Command();

program
  .name('aad')
  .description('AI Agent Discovery - Discover AI agents in your organization')
  .version('1.0.0');

/**
 * Init command - Initialize configuration
 */
program
  .command('init')
  .description('Initialize configuration file')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    const configPath = './config/config.yaml';

    if (fs.existsSync(configPath) && !options.force) {
      console.log('Configuration file already exists. Use --force to overwrite.');
      return;
    }

    createDefaultConfig(configPath);
    console.log(`Configuration created at ${configPath}`);
    console.log('Edit this file to configure your EDR connector.');
  });

/**
 * Scan command - Run detection scan
 */
program
  .command('scan')
  .description('Run AI agent detection scan')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--connector <type>', 'Override connector type (file, crowdstrike, defender)')
  .option('--lookback <days>', 'Number of days to look back', '14')
  .option('-o, --output <format>', 'Output format (json, csv, html)', 'json')
  .action(async (options) => {
    try {
      // Load configuration
      const config = loadConfig(options.config);

      // Override connector type if specified
      if (options.connector) {
        config.connector.type = options.connector as 'file' | 'crowdstrike' | 'defender';
      }

      // Validate connector config
      const validation = validateConnectorConfig(config.connector);
      if (!validation.valid) {
        console.error('Invalid connector configuration:');
        validation.errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }

      // Load taxonomy
      console.log('Loading taxonomy...');
      const taxonomy = loadTaxonomy();
      console.log(`Loaded ${taxonomy.species.size} agent species`);

      // Initialize detection engine
      console.log('Initializing detection engine...');
      const engine = new DetectionEngine(taxonomy);
      engine.setConnectorType(config.connector.type);

      // Get connector
      console.log(`Connecting to ${config.connector.type}...`);
      const connector = getConnector(config.connector);
      await connector.initialize();

      // Test connection
      const connected = await connector.testConnection();
      if (!connected) {
        console.error('Failed to connect to data source');
        process.exit(1);
      }

      // Get patterns for query
      const patterns = getAllPatterns();
      console.log(`Using ${patterns.length} detection patterns`);

      // Fetch events
      console.log('Fetching events...');
      const events = await connector.fetchEvents({
        lookbackDays: parseInt(options.lookback, 10),
        maxEvents: config.scan.max_events,
        patterns,
      });
      console.log(`Fetched ${events.length} events`);

      // Process events
      console.log('Processing events...');
      engine.processEvents(events);

      // Get results
      const results = engine.getResults();
      const stats = engine.getStats();

      console.log('\n=== Scan Results ===');
      console.log(`Detections: ${results.length}`);
      console.log(`Unique endpoints: ${stats.uniqueEndpoints}`);
      console.log(`Unique users: ${stats.uniqueUsers}`);
      console.log(`Agent species found: ${stats.uniqueSpecies}`);

      // Output results
      if (options.output === 'json') {
        console.log('\nResults:');
        console.log(JSON.stringify(results, null, 2));
      } else if (options.output === 'csv') {
        console.log('\nResults (CSV):');
        console.log('hostname,username,kingdom,family,species,confidence,first_seen,last_seen');
        for (const r of results) {
          console.log(
            `${r.endpoint.hostname},${r.user.username},${r.agent.kingdom},${r.agent.family},${r.agent.species},${r.agent.confidence},${r.timestamps.firstSeen.toISOString()},${r.timestamps.lastSeen.toISOString()}`
          );
        }
      } else {
        // Table format for console
        console.log('\nDetected Agents:');
        console.log('─'.repeat(80));
        for (const r of results) {
          console.log(`${r.endpoint.hostname} | ${r.user.username} | ${r.agent.species} (${r.agent.kingdom})`);
        }
      }

      // Cleanup
      await connector.close();
    } catch (error) {
      console.error('Scan failed:', (error as Error).message);
      logger.error({ error }, 'Scan failed');
      process.exit(1);
    }
  });

/**
 * Dashboard command - Start web dashboard
 */
program
  .command('dashboard')
  .description('Start the web dashboard')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --port <port>', 'Dashboard port', '3000')
  .option('-h, --host <host>', 'Dashboard host', '0.0.0.0')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);

      const port = parseInt(options.port, 10) || config.dashboard.port;
      const host = options.host || config.dashboard.host;

      console.log(`Starting dashboard on http://${host}:${port}`);
      await startDashboard({ port, host, config });
    } catch (error) {
      console.error('Failed to start dashboard:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * Taxonomy command - Browse taxonomy
 */
const taxonomyCmd = program
  .command('taxonomy')
  .description('Browse agent taxonomy');

taxonomyCmd
  .command('list')
  .description('List all agent species')
  .option('--kingdom <kingdom>', 'Filter by kingdom (autonomous, assistant, workflow)')
  .option('--family <family>', 'Filter by family')
  .action((options) => {
    const taxonomy = loadTaxonomy();

    console.log('\n=== AI Agent Taxonomy ===\n');

    for (const kingdom of taxonomy.kingdoms.values()) {
      if (options.kingdom && kingdom.id !== options.kingdom) {
        continue;
      }

      console.log(`${kingdom.name.toUpperCase()} (${kingdom.id})`);
      console.log(`  ${kingdom.description}`);

      for (const family of kingdom.families) {
        if (options.family && family.id !== options.family) {
          continue;
        }

        console.log(`  └─ ${family.name} (${family.id})`);

        for (const species of family.species) {
          console.log(`      └─ ${species.name} (${species.id})`);
        }
      }
      console.log();
    }
  });

taxonomyCmd
  .command('show <id>')
  .description('Show details for an agent')
  .action((id) => {
    const taxonomy = loadTaxonomy();

    // Search for the ID
    const results = searchTaxonomy(taxonomy, id);
    const exact = results.find((r) => r.id === id);

    if (!exact) {
      console.log(`Agent "${id}" not found.`);
      if (results.length > 0) {
        console.log('Did you mean:');
        results.slice(0, 5).forEach((r) => console.log(`  - ${r.id} (${r.type})`));
      }
      return;
    }

    if (exact.type === 'species') {
      const species = getSpecies(taxonomy, id);
      if (species) {
        console.log(`\n=== ${species.name} ===`);
        console.log(`Type: Species`);
        console.log(`ID: ${species.id}`);
        console.log(`Kingdom: ${species.kingdom}`);
        console.log(`Family: ${species.family}`);
        console.log(`Description: ${species.description}`);
        if (species.website) {
          console.log(`Website: ${species.website}`);
        }
        console.log(`Signatures: ${species.signatures.map((s) => s.ref).join(', ')}`);
      }
    } else if (exact.type === 'family') {
      const family = getFamily(taxonomy, id);
      if (family) {
        console.log(`\n=== ${family.name} ===`);
        console.log(`Type: Family`);
        console.log(`ID: ${family.id}`);
        console.log(`Kingdom: ${family.kingdom}`);
        console.log(`Description: ${family.description}`);
        if (family.website) {
          console.log(`Website: ${family.website}`);
        }
        console.log(`Species:`);
        family.species.forEach((s) => console.log(`  - ${s.name} (${s.id})`));
      }
    }
  });

taxonomyCmd
  .command('tree')
  .description('Show taxonomy tree')
  .action(() => {
    const taxonomy = loadTaxonomy();
    const tree = getTaxonomyTree(taxonomy);
    console.log(JSON.stringify(tree, null, 2));
  });

/**
 * Config command - Manage configuration
 */
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .option('-c, --config <path>', 'Path to configuration file')
  .action((key, options) => {
    const config = loadConfig(options.config);
    const value = getConfigValue(config, key);
    if (value === undefined) {
      console.log(`Key "${key}" not found`);
    } else {
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .option('-c, --config <path>', 'Path to configuration file')
  .action((key, value, options) => {
    const configPath = findConfigFile(options.config);
    if (!configPath) {
      console.error('No configuration file found. Run "aad init" first.');
      process.exit(1);
    }

    // Parse value (handle numbers, booleans, etc.)
    let parsedValue: unknown = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value))) parsedValue = Number(value);

    updateConfigFile(configPath, key, parsedValue);
    console.log(`Set ${key} = ${value}`);
  });

configCmd
  .command('path')
  .description('Show configuration file path')
  .option('-c, --config <path>', 'Path to configuration file')
  .action((options) => {
    const configPath = findConfigFile(options.config);
    if (configPath) {
      console.log(configPath);
    } else {
      console.log('No configuration file found');
    }
  });

/**
 * Validate command - Validate registry files
 */
program
  .command('validate')
  .description('Validate registry files (taxonomy and signatures)')
  .option('--taxonomy-only', 'Only validate taxonomy')
  .option('--signatures-only', 'Only validate signatures')
  .action((options) => {
    let hasErrors = false;

    if (!options.signaturesOnly) {
      console.log('Validating taxonomy...');
      const taxonomyResult = validateTaxonomy();
      if (taxonomyResult.valid) {
        console.log('  ✓ Taxonomy is valid');
      } else {
        console.log('  ✗ Taxonomy has errors:');
        taxonomyResult.errors.forEach((e) => {
          console.log(`    - ${e.file}: ${e.message}`);
        });
        hasErrors = true;
      }
    }

    if (!options.taxonomyOnly) {
      console.log('Validating signatures...');
      const signaturesPath = path.join(process.cwd(), 'registry', 'signatures');
      if (fs.existsSync(signaturesPath)) {
        const files = fs.readdirSync(signaturesPath).filter((f) => f.endsWith('.yaml'));
        let validCount = 0;
        for (const file of files) {
          try {
            // Basic YAML parse validation
            const yaml = require('js-yaml');
            const content = fs.readFileSync(path.join(signaturesPath, file), 'utf8');
            const data = yaml.load(content);
            if (data.id && data.patterns) {
              validCount++;
            } else {
              console.log(`  ✗ ${file}: Missing required fields (id, patterns)`);
              hasErrors = true;
            }
          } catch (e) {
            console.log(`  ✗ ${file}: ${(e as Error).message}`);
            hasErrors = true;
          }
        }
        console.log(`  ✓ ${validCount}/${files.length} signatures valid`);
      } else {
        console.log('  No signatures directory found');
      }
    }

    if (hasErrors) {
      process.exit(1);
    }
    console.log('\nAll validations passed!');
  });

/**
 * Test-signature command - Test a signature file
 */
program
  .command('test-signature <file>')
  .description('Test a signature file against sample data')
  .option('-d, --data <path>', 'Path to sample data file (JSON)')
  .action(async (file, options) => {
    try {
      const yaml = await import('js-yaml');
      const content = fs.readFileSync(file, 'utf8');
      const signature = yaml.load(content) as Record<string, unknown>;

      console.log(`\n=== Testing Signature: ${signature.id} ===\n`);
      console.log(`Name: ${signature.name}`);
      console.log(`Version: ${signature.version}`);

      const patterns = signature.patterns as Record<string, unknown[]>;
      let patternCount = 0;
      for (const category of Object.keys(patterns)) {
        patternCount += (patterns[category] || []).length;
      }
      console.log(`Patterns: ${patternCount}`);

      if (options.data) {
        const dataContent = fs.readFileSync(options.data, 'utf8');
        const events = JSON.parse(dataContent);

        // Load full taxonomy and test
        const taxonomy = loadTaxonomy();
        const engine = new DetectionEngine(taxonomy);
        engine.processEvents(Array.isArray(events) ? events : [events]);

        const results = engine.getResults();
        console.log(`\nMatches found: ${results.length}`);
        results.forEach((r) => {
          console.log(`  - ${r.endpoint.hostname}: ${r.agent.species}`);
        });
      }

      console.log('\nSignature file is valid!');
    } catch (error) {
      console.error('Signature test failed:', (error as Error).message);
      process.exit(1);
    }
  });

// Parse arguments and run
program.parse();
