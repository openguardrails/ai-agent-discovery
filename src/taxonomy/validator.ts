/**
 * Taxonomy Validator
 *
 * Validates taxonomy YAML files using Zod schemas
 */

import { z } from 'zod';

/**
 * Schema for signature reference
 */
export const signatureRefSchema = z.object({
  ref: z.string().min(1),
});

/**
 * Schema for species definition
 */
export const speciesSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Species ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  description: z.string().min(1),
  website: z.string().url().optional(),
  signatures: z.array(signatureRefSchema).min(1),
});

/**
 * Schema for family definition in YAML file
 */
export const familyYamlSchema = z.object({
  family: z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Family ID must be lowercase alphanumeric with hyphens'),
    name: z.string().min(1),
    description: z.string().min(1),
    kingdom: z.enum(['autonomous', 'assistant', 'workflow']),
    website: z.string().url().optional(),
  }),
  species: z.array(speciesSchema).min(1),
});

/**
 * Schema for kingdom definition
 */
export const kingdomSchema = z.object({
  id: z.enum(['autonomous', 'assistant', 'workflow']),
  name: z.string().min(1),
  description: z.string().min(1),
});

/**
 * Schema for kingdoms YAML file
 */
export const kingdomsYamlSchema = z.object({
  kingdoms: z.array(kingdomSchema).min(1),
});

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  file: string;
  path: string;
  message: string;
}

/**
 * Validate a kingdoms YAML file
 */
export function validateKingdomsYaml(data: unknown, filename: string): ValidationResult {
  const result = kingdomsYamlSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      file: filename,
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Validate a family YAML file
 */
export function validateFamilyYaml(data: unknown, filename: string): ValidationResult {
  const result = familyYamlSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      file: filename,
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Validate all taxonomy references
 */
export function validateTaxonomyReferences(
  kingdoms: string[],
  families: Map<string, string>, // family id -> kingdom id
  signatureRefs: string[],
  availableSignatures: string[]
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate family kingdom references
  for (const [familyId, kingdomId] of families) {
    if (!kingdoms.includes(kingdomId)) {
      errors.push({
        file: `registry/taxonomy/*/${familyId}.yaml`,
        path: 'family.kingdom',
        message: `Unknown kingdom reference: ${kingdomId}`,
      });
    }
  }

  // Validate signature references
  for (const sigRef of signatureRefs) {
    if (!availableSignatures.includes(sigRef)) {
      errors.push({
        file: 'registry/taxonomy',
        path: 'species.signatures',
        message: `Missing signature file: ${sigRef}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
