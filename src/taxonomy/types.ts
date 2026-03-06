/**
 * Taxonomy Type Definitions
 *
 * 3-level hierarchy: Kingdom -> Family -> Species
 */

/**
 * Top-level category (very stable, rarely changes)
 */
export interface Kingdom {
  id: string;
  name: string;
  description: string;
  families: Family[];
}

/**
 * Product line (moderately stable)
 */
export interface Family {
  id: string;
  name: string;
  description: string;
  kingdom: string;
  website?: string;
  species: Species[];
}

/**
 * Specific product (frequently updated by community)
 */
export interface Species {
  id: string;
  name: string;
  description: string;
  family: string;
  kingdom: string;
  website?: string;
  signatures: SignatureRef[];
}

/**
 * Reference to a signature file
 */
export interface SignatureRef {
  ref: string;
}

/**
 * Raw YAML structure for kingdoms file
 */
export interface KingdomsYaml {
  kingdoms: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

/**
 * Raw YAML structure for family files
 */
export interface FamilyYaml {
  family: {
    id: string;
    name: string;
    description: string;
    kingdom: string;
    website?: string;
  };
  species: Array<{
    id: string;
    name: string;
    description: string;
    website?: string;
    signatures: SignatureRef[];
  }>;
}

/**
 * Complete taxonomy tree
 */
export interface Taxonomy {
  kingdoms: Map<string, Kingdom>;
  families: Map<string, Family>;
  species: Map<string, Species>;
}

/**
 * Taxonomy search result
 */
export interface TaxonomySearchResult {
  type: 'kingdom' | 'family' | 'species';
  id: string;
  name: string;
  path: string[];
}
