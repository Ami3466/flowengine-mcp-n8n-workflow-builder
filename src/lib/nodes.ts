/**
 * Node Registry - Complete n8n Node Knowledge Base
 *
 * Dynamically loads ALL nodes from n8n packages (1000+ nodes)
 * Falls back to static registry in bundled environments
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { STATIC_NODE_REGISTRY, STATIC_CATEGORIES } from './staticNodeRegistry.js';
import { MINIMAL_NODE_REGISTRY, MINIMAL_CATEGORIES } from './minimal-registry.js';

// Support both ESM and CommonJS
// In ESM, we need to create require. In CommonJS/bundled, it's already global.
let nodeRequire: any;

// Get the current file URL/path for createRequire
const getModuleURL = (): string => {
  // Try CommonJS first (bundled environments like Smithery)
  if (typeof __filename !== 'undefined') {
    return __filename;
  }

  // ESM - use import.meta.url directly (TypeScript will handle this)
  // @ts-ignore - import.meta is available in ESM
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    // @ts-ignore
    return import.meta.url;
  }

  // Last resort fallback
  return process.cwd();
};

try {
  // Try to use global require first (CommonJS/bundled environment)
  if (typeof require !== 'undefined') {
    nodeRequire = require;
  } else {
    // ESM - create require from import.meta.url
    const moduleURL = getModuleURL();
    nodeRequire = createRequire(moduleURL);
  }
} catch (e) {
  console.error('Failed to initialize require:', e);
  // Fallback: try to use global require anyway
  nodeRequire = typeof require !== 'undefined' ? require : null;
  if (!nodeRequire) {
    console.error('Cannot create require function - node loading will be limited');
    // Don't throw, just set to null and handle gracefully
    nodeRequire = null;
  }
}

export interface NodeTemplate {
  type: string;
  displayName: string;
  typeVersion: number;
  description: string;
  category: string;
  categories: string[];
  alias: string[];
  subcategories: Record<string, string[]>;
  defaultParameters: Record<string, any>;
  requiresCredentials: boolean;
  credentialType?: string;
  inputs: string[];
  outputs: string[];
  isTrigger: boolean;
  documentation: string | null;
  icon?: string;
  properties?: Array<{
    name: string;
    type: string;
    default?: any;
    required?: boolean;
    description?: string;
  }>;
}

// Pre-load minimal registry to ensure it's bundled
const BUNDLED_FALLBACK = MINIMAL_NODE_REGISTRY;

let nodeRegistry: Record<string, NodeTemplate> | null = null;
let allCategories: string[] | null = null;

/**
 * Load all nodes from n8n packages
 * This dynamically loads 600+ nodes from n8n-nodes-base and LangChain
 * Falls back to static registry in bundled environments
 */
function loadNodesFromPackage(): Record<string, NodeTemplate> {
  if (nodeRegistry) {
    return nodeRegistry;
  }

  const nodes: Record<string, NodeTemplate> = {};
  const categories = new Set<string>();

  // Check if nodeRequire is available
  if (!nodeRequire) {
    console.warn('Node require not available - trying to load static registry from JSON file');

    // Try multiple paths for the static registry JSON file
    const possibleJsonPaths = [
      join(__dirname, 'staticNodeRegistry.json'),
      join(process.cwd(), 'staticNodeRegistry.json'),
      './staticNodeRegistry.json',
      '/opt/render/project/src/render-deploy/staticNodeRegistry.json'
    ];

    for (const jsonPath of possibleJsonPaths) {
      try {
        console.log(`Trying to load static registry from: ${jsonPath}`);
        const jsonContent = readFileSync(jsonPath, 'utf8');
        const registryData = JSON.parse(jsonContent);
        nodeRegistry = registryData.nodes as Record<string, NodeTemplate>;
        allCategories = registryData.categories;
        console.log(`✅ Loaded ${Object.keys(nodeRegistry).length} nodes from JSON registry: ${jsonPath}`);
        return nodeRegistry;
      } catch (fileError) {
        console.warn(`Failed to load from ${jsonPath}:`, (fileError as Error).message);
      }
    }

    // Try imported static registry (from .ts file)
    try {
      console.warn('All JSON paths failed, trying imported static registry (543 nodes)');
      nodeRegistry = STATIC_NODE_REGISTRY as Record<string, NodeTemplate>;
      allCategories = STATIC_CATEGORIES;
      console.log(`✅ Loaded ${Object.keys(nodeRegistry).length} nodes from imported static registry`);
      return nodeRegistry;
    } catch (importError) {
      console.error('Failed to load static registry from import:', importError);
    }

    // Use minimal inline registry as absolute last resort
    console.warn('Using minimal inline registry (25 core nodes)');
    nodeRegistry = BUNDLED_FALLBACK; // Use pre-loaded fallback to ensure bundling
    allCategories = MINIMAL_CATEGORIES;
    console.log(`✅ Loaded ${Object.keys(nodeRegistry).length} nodes from minimal inline registry`);
    return nodeRegistry;
  }

  try {
    // Load from n8n-nodes-base package
    const nodesBasePkgPath = nodeRequire.resolve('n8n-nodes-base/package.json');
    const nodesBasePkg = JSON.parse(readFileSync(nodesBasePkgPath, 'utf8'));

    if (nodesBasePkg.n8n && nodesBasePkg.n8n.nodes) {
      nodesBasePkg.n8n.nodes.forEach((nodePath: string) => {
        try {
          // Extract node type from path
          const nodeFileName = nodePath.split('/').pop()?.replace('.node.js', '') || '';
          const nodeType = `n8n-nodes-base.${nodeFileName.charAt(0).toLowerCase() + nodeFileName.slice(1)}`;

          // Try to load the .node.json file for metadata
          const jsonPath = nodePath.replace('.node.js', '.node.json');
          let nodeMetadata: any = {};

          try {
            const fullJsonPath = join(dirname(nodesBasePkgPath), jsonPath);
            nodeMetadata = JSON.parse(readFileSync(fullJsonPath, 'utf8'));
          } catch {
            // If no .node.json, use defaults
          }

          const category = nodeMetadata.categories?.[0] || 'Other';
          categories.add(category);

          // Create display name from file name
          const displayName = nodeFileName
            .replace(/Trigger$/, ' Trigger')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/\s+/g, ' ');

          nodes[nodeType] = {
            type: nodeType,
            displayName: displayName,
            typeVersion: nodeMetadata.nodeVersion || 1,
            description: `${displayName} node for workflow automation`,
            category: category.toLowerCase(),
            categories: nodeMetadata.categories || [category],
            alias: nodeMetadata.alias || [],
            subcategories: nodeMetadata.subcategories || {},
            defaultParameters: {},
            requiresCredentials: !!nodeMetadata.resources?.credentialDocumentation,
            credentialType: nodeFileName.toLowerCase(),
            inputs: ['main'],
            outputs: ['main'],
            isTrigger: nodeFileName.includes('Trigger') || nodePath.includes('Trigger'),
            documentation: nodeMetadata.resources?.primaryDocumentation?.[0]?.url || null,
          };
        } catch (error) {
          // Skip nodes that fail to load
          console.error(`Failed to load node from ${nodePath}:`, error);
        }
      });
    }

    // Try to load LangChain nodes if available
    try {
      const langchainPkgPath = nodeRequire.resolve('@n8n/n8n-nodes-langchain/package.json');
      const langchainPkg = JSON.parse(readFileSync(langchainPkgPath, 'utf8'));

      if (langchainPkg.n8n && langchainPkg.n8n.nodes) {
        langchainPkg.n8n.nodes.forEach((nodePath: string) => {
          try {
            const nodeFileName = nodePath.split('/').pop()?.replace('.node.js', '') || '';
            const nodeType = `@n8n/n8n-nodes-langchain.${nodeFileName.charAt(0).toLowerCase() + nodeFileName.slice(1)}`;

            const displayName = nodeFileName
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .replace(/\s+/g, ' ');

            nodes[nodeType] = {
              type: nodeType,
              displayName: displayName,
              typeVersion: 1,
              description: `${displayName} LangChain node`,
              category: 'ai',
              categories: ['AI', 'LangChain'],
              alias: [],
              subcategories: {},
              defaultParameters: {},
              requiresCredentials: false,
              inputs: ['main'],
              outputs: ['main'],
              isTrigger: false,
              documentation: null,
            };

            categories.add('AI');
            categories.add('LangChain');
          } catch (error) {
            console.error(`Failed to load LangChain node from ${nodePath}:`, error);
          }
        });
      }
    } catch {
      // LangChain package not available, skip
    }

    nodeRegistry = nodes;
    allCategories = Array.from(categories).sort();

    console.log(`Loaded ${Object.keys(nodes).length} nodes from n8n packages`);

  } catch (error) {
    console.error('Failed to load nodes from package:', error);
    console.warn('Falling back to static node registry');
    // Return static registry on error
    nodeRegistry = STATIC_NODE_REGISTRY as Record<string, NodeTemplate>;
    allCategories = STATIC_CATEGORIES;
    return nodeRegistry;
  }

  return nodes;
}

/**
 * Get all nodes (lazy loaded)
 */
export function getAllNodes(): NodeTemplate[] {
  const registry = loadNodesFromPackage();
  return Object.values(registry);
}

/**
 * Get node by type
 */
export function getNode(type: string): NodeTemplate | null {
  const registry = loadNodesFromPackage();
  return registry[type] || null;
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: string): NodeTemplate[] {
  return getAllNodes().filter(node =>
    node.categories.some(cat => cat.toLowerCase() === category.toLowerCase())
  );
}

/**
 * Search nodes by keyword
 */
export function searchNodes(query: string): NodeTemplate[] {
  const lowerQuery = query.toLowerCase();
  return getAllNodes().filter(node =>
    node.displayName.toLowerCase().includes(lowerQuery) ||
    node.type.toLowerCase().includes(lowerQuery) ||
    node.description.toLowerCase().includes(lowerQuery) ||
    node.alias.some(a => a.toLowerCase().includes(lowerQuery)) ||
    node.categories.some(c => c.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all available categories
 */
export function getCategories(): string[] {
  if (!allCategories) {
    loadNodesFromPackage();
  }
  return allCategories || [];
}

/**
 * Get trigger nodes only
 */
export function getTriggerNodes(): NodeTemplate[] {
  return getAllNodes().filter(node => node.isTrigger);
}

/**
 * Get action nodes only
 */
export function getActionNodes(): NodeTemplate[] {
  return getAllNodes().filter(node => !node.isTrigger);
}

/**
 * Get nodes that require credentials
 */
export function getNodesRequiringCredentials(): NodeTemplate[] {
  return getAllNodes().filter(node => node.requiresCredentials);
}

/**
 * Get recommended nodes for a task description
 */
export function getRecommendedNodes(taskDescription: string): NodeTemplate[] {
  const keywords = taskDescription.toLowerCase().split(/\s+/);
  const scored = getAllNodes().map(node => {
    let score = 0;

    keywords.forEach(keyword => {
      if (node.displayName.toLowerCase().includes(keyword)) score += 10;
      if (node.type.toLowerCase().includes(keyword)) score += 8;
      if (node.description.toLowerCase().includes(keyword)) score += 5;
      if (node.alias.some(a => a.toLowerCase().includes(keyword))) score += 7;
      if (node.categories.some(c => c.toLowerCase().includes(keyword))) score += 6;
    });

    return { node, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => s.node);
}

/**
 * Get node count
 */
export function getNodeCount(): number {
  return getAllNodes().length;
}

/**
 * Check if a node type exists
 */
export function nodeExists(type: string): boolean {
  const registry = loadNodesFromPackage();
  return type in registry;
}
