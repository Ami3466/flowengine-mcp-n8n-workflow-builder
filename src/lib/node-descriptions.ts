/**
 * Node Description Loader
 *
 * Loads real INodeTypeDescription from n8n node classes by instantiating them.
 * This is how FlowEngine and @n8n/ai-workflow-builder get accurate parameter schemas.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import type { INodeTypeDescription } from 'n8n-workflow';

// Support both ESM and CommonJS
// In ESM, we need to create require. In CommonJS/bundled, it's already global.
let nodeRequire: any;

try {
  // Try to use global require first (CommonJS/bundled environment)
  if (typeof require !== 'undefined') {
    nodeRequire = require;
  } else {
    // ESM - need to create require from import.meta.url
    // Use eval to prevent esbuild from seeing import.meta at build time
    const getImportMetaUrl = new Function('return import.meta.url');
    nodeRequire = createRequire(getImportMetaUrl());
  }
} catch (e) {
  console.error('Failed to initialize require:', e);
  // Fallback: try to use global require anyway
  nodeRequire = typeof require !== 'undefined' ? require : null;
  if (!nodeRequire) {
    throw new Error('Cannot create require function - no require or import.meta available');
  }
}

const descriptionCache = new Map<string, INodeTypeDescription>();

/**
 * Load node description by instantiating the node class
 */
export async function getNodeDescription(nodeType: string): Promise<INodeTypeDescription | null> {
  if (descriptionCache.has(nodeType)) {
    return descriptionCache.get(nodeType)!;
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
      return null;
    }

    // Load package.json to find node files
    const pkgPath = nodeRequire.resolve(`${npmPackage}/package.json`);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    if (!pkg.n8n || !pkg.n8n.nodes) {
      return null;
    }

    // Find the node file
    const nodeFile = pkg.n8n.nodes.find((n: string) => {
      const fileName = n.split('/').pop()?.replace('.node.js', '') || '';
      const fileNodeName = fileName.charAt(0).toLowerCase() + fileName.slice(1);
      return fileNodeName === nodeName || fileName.toLowerCase() === nodeName.toLowerCase();
    });

    if (!nodeFile) {
      return null;
    }

    // Load the node module
    const nodeModulePath = join(dirname(pkgPath), nodeFile);
    const nodeModule = await import(nodeModulePath);

    // Get the node class - find the class constructor export
    let NodeClass = null;
    for (const key of Object.keys(nodeModule)) {
      if (key !== 'default' && key !== '__esModule' && key !== 'module.exports') {
        const exported = nodeModule[key];
        // Check if it's a class/constructor function
        if (typeof exported === 'function' && exported.prototype) {
          NodeClass = exported;
          break;
        }
      }
    }

    // Fallback to default export
    if (!NodeClass && nodeModule.default) {
      NodeClass = nodeModule.default;
    }

    if (!NodeClass || typeof NodeClass !== 'function') {
      return null;
    }

    // Instantiate the node to get its description
    const instance = new NodeClass();
    const description = instance.description as INodeTypeDescription;

    if (!description) {
      return null;
    }

    descriptionCache.set(nodeType, description);
    return description;

  } catch (error) {
    console.error(`Failed to load node description for ${nodeType}:`, error);
    return null;
  }
}

/**
 * Get all node descriptions (loads all nodes)
 */
export async function getAllNodeDescriptions(): Promise<Map<string, INodeTypeDescription>> {
  const descriptions = new Map<string, INodeTypeDescription>();

  try {
    // Load from n8n-nodes-base
    const nodesBasePkgPath = nodeRequire.resolve('n8n-nodes-base/package.json');
    const nodesBasePkg = JSON.parse(readFileSync(nodesBasePkgPath, 'utf8'));

    if (nodesBasePkg.n8n && nodesBasePkg.n8n.nodes) {
      for (const nodePath of nodesBasePkg.n8n.nodes) {
        try {
          const fileName = nodePath.split('/').pop()?.replace('.node.js', '') || '';
          const nodeType = `n8n-nodes-base.${fileName.charAt(0).toLowerCase() + fileName.slice(1)}`;

          const desc = await getNodeDescription(nodeType);
          if (desc) {
            descriptions.set(nodeType, desc);
          }
        } catch (error) {
          // Skip nodes that fail to load
        }
      }
    }

    // Load from @n8n/n8n-nodes-langchain if available
    try {
      const langchainPkgPath = nodeRequire.resolve('@n8n/n8n-nodes-langchain/package.json');
      const langchainPkg = JSON.parse(readFileSync(langchainPkgPath, 'utf8'));

      if (langchainPkg.n8n && langchainPkg.n8n.nodes) {
        for (const nodePath of langchainPkg.n8n.nodes) {
          try {
            const fileName = nodePath.split('/').pop()?.replace('.node.js', '') || '';
            const nodeType = `@n8n/n8n-nodes-langchain.${fileName.charAt(0).toLowerCase() + fileName.slice(1)}`;

            const desc = await getNodeDescription(nodeType);
            if (desc) {
              descriptions.set(nodeType, desc);
            }
          } catch (error) {
            // Skip nodes that fail to load
          }
        }
      }
    } catch {
      // LangChain package not available
    }

    console.log(`Loaded ${descriptions.size} node descriptions with full parameter schemas`);

  } catch (error) {
    console.error('Failed to load node descriptions:', error);
  }

  return descriptions;
}

/**
 * Get default parameters from node description
 */
export function getDefaultParameters(description: INodeTypeDescription): Record<string, any> {
  const params: Record<string, any> = {};

  if (!description.properties) {
    return params;
  }

  for (const prop of description.properties) {
    if (prop.default !== undefined) {
      params[prop.name] = prop.default;
    }
  }

  return params;
}
