/**
 * Taxonomy Loader
 *
 * Loads and manages the 3-level agent taxonomy from YAML files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger.js';
import {
  type Taxonomy,
  type Kingdom,
  type Family,
  type Species,
  type KingdomsYaml,
  type FamilyYaml,
  type TaxonomySearchResult,
} from './types.js';
import {
  validateKingdomsYaml,
  validateFamilyYaml,
  type ValidationResult,
} from './validator.js';

export * from './types.js';
export * from './validator.js';

/**
 * Default registry path
 */
const DEFAULT_REGISTRY_PATH = path.join(process.cwd(), 'registry', 'taxonomy');

/**
 * Load the complete taxonomy from YAML files
 */
export function loadTaxonomy(registryPath: string = DEFAULT_REGISTRY_PATH): Taxonomy {
  const taxonomy: Taxonomy = {
    kingdoms: new Map(),
    families: new Map(),
    species: new Map(),
  };

  // Load kingdoms
  const kingdomsFile = path.join(registryPath, 'kingdoms.yaml');
  if (fs.existsSync(kingdomsFile)) {
    const kingdomsData = yaml.load(fs.readFileSync(kingdomsFile, 'utf8')) as KingdomsYaml;
    const validation = validateKingdomsYaml(kingdomsData, 'kingdoms.yaml');

    if (!validation.valid) {
      for (const error of validation.errors) {
        logger.error({ error }, 'Taxonomy validation error');
      }
      throw new Error('Invalid kingdoms.yaml');
    }

    for (const k of kingdomsData.kingdoms) {
      taxonomy.kingdoms.set(k.id, {
        id: k.id,
        name: k.name,
        description: k.description,
        families: [],
      });
    }
  }

  // Load families from each kingdom directory
  for (const [kingdomId, kingdom] of taxonomy.kingdoms) {
    const kingdomDir = path.join(registryPath, kingdomId);
    if (!fs.existsSync(kingdomDir)) {
      continue;
    }

    const familyFiles = fs.readdirSync(kingdomDir).filter((f) => f.endsWith('.yaml'));

    for (const familyFile of familyFiles) {
      const familyPath = path.join(kingdomDir, familyFile);
      const familyData = yaml.load(fs.readFileSync(familyPath, 'utf8')) as FamilyYaml;
      const validation = validateFamilyYaml(familyData, familyFile);

      if (!validation.valid) {
        for (const error of validation.errors) {
          logger.error({ error }, 'Taxonomy validation error');
        }
        continue;
      }

      // Verify kingdom reference
      if (familyData.family.kingdom !== kingdomId) {
        logger.warn(
          { file: familyFile, expected: kingdomId, actual: familyData.family.kingdom },
          'Family kingdom mismatch'
        );
      }

      const family: Family = {
        id: familyData.family.id,
        name: familyData.family.name,
        description: familyData.family.description,
        kingdom: kingdomId,
        website: familyData.family.website,
        species: [],
      };

      // Load species
      for (const s of familyData.species) {
        const species: Species = {
          id: s.id,
          name: s.name,
          description: s.description,
          family: family.id,
          kingdom: kingdomId,
          website: s.website,
          signatures: s.signatures,
        };

        family.species.push(species);
        taxonomy.species.set(species.id, species);
      }

      kingdom.families.push(family);
      taxonomy.families.set(family.id, family);
    }
  }

  logger.info(
    {
      kingdoms: taxonomy.kingdoms.size,
      families: taxonomy.families.size,
      species: taxonomy.species.size,
    },
    'Taxonomy loaded'
  );

  return taxonomy;
}

/**
 * Get all species IDs
 */
export function getAllSpeciesIds(taxonomy: Taxonomy): string[] {
  return Array.from(taxonomy.species.keys());
}

/**
 * Get species by ID
 */
export function getSpecies(taxonomy: Taxonomy, id: string): Species | undefined {
  return taxonomy.species.get(id);
}

/**
 * Get family by ID
 */
export function getFamily(taxonomy: Taxonomy, id: string): Family | undefined {
  return taxonomy.families.get(id);
}

/**
 * Get kingdom by ID
 */
export function getKingdom(taxonomy: Taxonomy, id: string): Kingdom | undefined {
  return taxonomy.kingdoms.get(id);
}

/**
 * Search taxonomy by name or ID
 */
export function searchTaxonomy(taxonomy: Taxonomy, query: string): TaxonomySearchResult[] {
  const results: TaxonomySearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Search kingdoms
  for (const kingdom of taxonomy.kingdoms.values()) {
    if (kingdom.id.includes(lowerQuery) || kingdom.name.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'kingdom',
        id: kingdom.id,
        name: kingdom.name,
        path: [kingdom.id],
      });
    }
  }

  // Search families
  for (const family of taxonomy.families.values()) {
    if (family.id.includes(lowerQuery) || family.name.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'family',
        id: family.id,
        name: family.name,
        path: [family.kingdom, family.id],
      });
    }
  }

  // Search species
  for (const species of taxonomy.species.values()) {
    if (species.id.includes(lowerQuery) || species.name.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'species',
        id: species.id,
        name: species.name,
        path: [species.kingdom, species.family, species.id],
      });
    }
  }

  return results;
}

/**
 * Get taxonomy tree for display
 */
export function getTaxonomyTree(taxonomy: Taxonomy): object {
  const tree: Record<string, Record<string, string[]>> = {};

  for (const kingdom of taxonomy.kingdoms.values()) {
    tree[kingdom.id] = {};
    for (const family of kingdom.families) {
      tree[kingdom.id][family.id] = family.species.map((s) => s.id);
    }
  }

  return tree;
}

/**
 * Validate all taxonomy files in the registry
 */
export function validateTaxonomy(registryPath: string = DEFAULT_REGISTRY_PATH): ValidationResult {
  const errors: Array<{ file: string; path: string; message: string }> = [];

  // Check kingdoms.yaml exists
  const kingdomsFile = path.join(registryPath, 'kingdoms.yaml');
  if (!fs.existsSync(kingdomsFile)) {
    errors.push({
      file: 'kingdoms.yaml',
      path: '',
      message: 'kingdoms.yaml not found',
    });
    return { valid: false, errors };
  }

  try {
    // Validate kingdoms
    const kingdomsData = yaml.load(fs.readFileSync(kingdomsFile, 'utf8'));
    const kingdomsValidation = validateKingdomsYaml(kingdomsData, 'kingdoms.yaml');
    errors.push(...kingdomsValidation.errors);

    // Validate each family file
    const kingdomIds = ['autonomous', 'assistant', 'workflow'];
    for (const kingdomId of kingdomIds) {
      const kingdomDir = path.join(registryPath, kingdomId);
      if (!fs.existsSync(kingdomDir)) {
        continue;
      }

      const familyFiles = fs.readdirSync(kingdomDir).filter((f) => f.endsWith('.yaml'));
      for (const familyFile of familyFiles) {
        const familyPath = path.join(kingdomDir, familyFile);
        try {
          const familyData = yaml.load(fs.readFileSync(familyPath, 'utf8'));
          const familyValidation = validateFamilyYaml(familyData, familyFile);
          errors.push(...familyValidation.errors);
        } catch (e) {
          errors.push({
            file: familyFile,
            path: '',
            message: `YAML parse error: ${(e as Error).message}`,
          });
        }
      }
    }
  } catch (e) {
    errors.push({
      file: 'kingdoms.yaml',
      path: '',
      message: `YAML parse error: ${(e as Error).message}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
