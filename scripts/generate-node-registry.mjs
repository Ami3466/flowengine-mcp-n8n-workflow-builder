#!/usr/bin/env node
/**
 * Generate Static Node Registry
 *
 * This script extracts all node metadata from n8n packages and creates
 * a static registry file that can be bundled into the MCP server.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function generateNodeRegistry() {
  const nodes = {};
  const categories = new Set();

  try {
    // Load from n8n-nodes-base package
    const nodesBasePkgPath = require.resolve('n8n-nodes-base/package.json');
    const nodesBasePkg = JSON.parse(readFileSync(nodesBasePkgPath, 'utf8'));

    console.log(`Loading nodes from n8n-nodes-base...`);

    if (nodesBasePkg.n8n && nodesBasePkg.n8n.nodes) {
      nodesBasePkg.n8n.nodes.forEach((nodePath) => {
        try {
          const nodeFileName = nodePath.split('/').pop()?.replace('.node.js', '') || '';
          const nodeType = `n8n-nodes-base.${nodeFileName.charAt(0).toLowerCase() + nodeFileName.slice(1)}`;

          // Try to load the .node.json file for metadata
          const jsonPath = nodePath.replace('.node.js', '.node.json');
          let nodeMetadata = {};

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

          // Ensure subcategories is always an object
          let subcategories = {};
          if (nodeMetadata.subcategories && typeof nodeMetadata.subcategories === 'object' && !Array.isArray(nodeMetadata.subcategories)) {
            subcategories = nodeMetadata.subcategories;
          }

          nodes[nodeType] = {
            type: nodeType,
            displayName: displayName,
            typeVersion: nodeMetadata.version || 1,
            description: nodeMetadata.description || `${displayName} node for workflow automation`,
            category: category.toLowerCase(),
            categories: nodeMetadata.categories || [category],
            alias: nodeMetadata.alias || [],
            subcategories: subcategories,
            defaultParameters: {},
            requiresCredentials: !!nodeMetadata.credentials?.length,
            credentialType: nodeFileName.toLowerCase(),
            inputs: nodeMetadata.inputs || ['main'],
            outputs: nodeMetadata.outputs || ['main'],
            isTrigger: nodeFileName.includes('Trigger') || nodePath.includes('Trigger'),
            documentation: nodeMetadata.documentationUrl || null,
          };
        } catch (error) {
          console.error(`Failed to load node from ${nodePath}:`, error.message);
        }
      });
    }

    console.log(`Loaded ${Object.keys(nodes).length} nodes from n8n-nodes-base`);

    // Try to load LangChain nodes if available
    try {
      const langchainPkgPath = require.resolve('@n8n/n8n-nodes-langchain/package.json');
      const langchainPkg = JSON.parse(readFileSync(langchainPkgPath, 'utf8'));

      console.log(`Loading nodes from @n8n/n8n-nodes-langchain...`);

      if (langchainPkg.n8n && langchainPkg.n8n.nodes) {
        langchainPkg.n8n.nodes.forEach((nodePath) => {
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
            console.error(`Failed to load LangChain node from ${nodePath}:`, error.message);
          }
        });
      }

      console.log(`Total nodes loaded: ${Object.keys(nodes).length}`);
    } catch {
      console.log('LangChain package not available, skipping');
    }

    // Write the static registry as TypeScript
    const registryContent = `/**
 * Static Node Registry
 *
 * Auto-generated by scripts/generate-node-registry.mjs
 * Contains metadata for ${Object.keys(nodes).length} n8n nodes
 *
 * DO NOT EDIT MANUALLY - Regenerate with: npm run generate-registry
 */

export const STATIC_NODE_REGISTRY = ${JSON.stringify(nodes, null, 2)};

export const STATIC_CATEGORIES = ${JSON.stringify(Array.from(categories).sort(), null, 2)};
`;

    writeFileSync(
      join(process.cwd(), 'src/lib/staticNodeRegistry.ts'),
      registryContent,
      'utf8'
    );

    // Also write as JSON for runtime loading
    const jsonContent = {
      nodes,
      categories: Array.from(categories).sort()
    };

    writeFileSync(
      join(process.cwd(), 'src/lib/staticNodeRegistry.json'),
      JSON.stringify(jsonContent, null, 2),
      'utf8'
    );

    // Also write to render-deploy for deployment
    writeFileSync(
      join(process.cwd(), 'render-deploy/staticNodeRegistry.json'),
      JSON.stringify(jsonContent, null, 2),
      'utf8'
    );

    console.log('\n✅ Static node registry generated successfully!');
    console.log(`   Location: src/lib/staticNodeRegistry.ts`);
    console.log(`   JSON: src/lib/staticNodeRegistry.json`);
    console.log(`   Deploy: render-deploy/staticNodeRegistry.json`);
    console.log(`   Nodes: ${Object.keys(nodes).length}`);
    console.log(`   Categories: ${categories.size}`);

  } catch (error) {
    console.error('Failed to generate node registry:', error);
    process.exit(1);
  }
}

generateNodeRegistry();
