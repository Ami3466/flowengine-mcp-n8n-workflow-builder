/**
 * Dynamic Node Loader
 *
 * Loads actual n8n node descriptions and properties from node modules
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface NodeProperty {
  displayName: string;
  name: string;
  type: string;
  default?: any;
  required?: boolean;
  options?: Array<{ name: string; value: any }>;
  typeOptions?: any;
  description?: string;
}

export interface NodeDescription {
  displayName: string;
  name: string;
  version: number;
  description: string;
  defaults: {
    name: string;
  };
  inputs: string[];
  outputs: string[];
  properties: NodeProperty[];
}

const nodeDescriptionCache = new Map<string, NodeDescription>();

/**
 * Load node description from n8n package
 */
export async function loadNodeDescription(nodeType: string): Promise<NodeDescription | null> {
  if (nodeDescriptionCache.has(nodeType)) {
    return nodeDescriptionCache.get(nodeType)!;
  }

  try {
    // Extract package and node name
    const [packageName, ...nodeNameParts] = nodeType.split('.');
    const nodeName = nodeNameParts.join('.');

    // Map package names to npm packages
    const packageMap: Record<string, string> = {
      'n8n-nodes-base': 'n8n-nodes-base',
      '@n8n/n8n-nodes-langchain': '@n8n/n8n-nodes-langchain',
    };

    const npmPackage = packageMap[packageName];
    if (!npmPackage) {
      console.error(`Unknown package: ${packageName}`);
      return null;
    }

    // Load package.json to find node path
    const pkgPath = require.resolve(`${npmPackage}/package.json`);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    // Find the node file
    if (!pkg.n8n || !pkg.n8n.nodes) {
      return null;
    }

    // Try to find the node by matching the name
    const nodeFile = pkg.n8n.nodes.find((n: string) => {
      const fileName = n.split('/').pop()?.replace('.node.js', '') || '';
      const fileNodeName = fileName.charAt(0).toLowerCase() + fileName.slice(1);
      return fileNodeName === nodeName || fileName.toLowerCase() === nodeName.toLowerCase();
    });

    if (!nodeFile) {
      console.error(`Node file not found for ${nodeType}`);
      return null;
    }

    // Load the node class
    const nodeModulePath = join(dirname(pkgPath), nodeFile);
    const nodeModule = await import(nodeModulePath);

    // Get the default export (the node class)
    const NodeClass = nodeModule.default || nodeModule;

    if (!NodeClass || !NodeClass.description) {
      console.error(`No description found for ${nodeType}`);
      return null;
    }

    const description: NodeDescription = NodeClass.description;
    nodeDescriptionCache.set(nodeType, description);

    return description;
  } catch (error) {
    console.error(`Failed to load node description for ${nodeType}:`, error);
    return null;
  }
}

/**
 * Generate default parameters from node description
 */
export function generateDefaultParameters(description: NodeDescription): Record<string, any> {
  const params: Record<string, any> = {};

  if (!description.properties) {
    return params;
  }

  for (const prop of description.properties) {
    // Skip if has displayOptions that would hide it
    if (prop.default !== undefined) {
      params[prop.name] = prop.default;
    } else if (prop.type === 'string') {
      params[prop.name] = '';
    } else if (prop.type === 'number') {
      params[prop.name] = 0;
    } else if (prop.type === 'boolean') {
      params[prop.name] = false;
    } else if (prop.type === 'options' && prop.options && prop.options.length > 0) {
      params[prop.name] = prop.options[0].value;
    }
  }

  return params;
}

/**
 * Get parameter schema for a node type
 */
export async function getNodeParameterSchema(nodeType: string): Promise<NodeProperty[] | null> {
  const description = await loadNodeDescription(nodeType);
  return description?.properties || null;
}
