#!/usr/bin/env node

/**
 * n8n Workflow Builder by FlowEngine v2.0
 *
 * Complete workflow generation engine with 600+ nodes, AI intelligence,
 * security scanning, performance analysis, and template library.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Existing imports
import { validateWorkflow } from './lib/validator.js';
import { extractWorkflowJSON } from './lib/processor.js';

// New imports
import { generateWorkflow, WorkflowGenerator } from './lib/generator.js';
import { searchNodes, getNodesByCategory, getCategories as getNodeCategories, getNode } from './lib/nodes.js';
import { suggestArchitecture, suggestNodes, analyzeWorkflow, suggestImprovements, explainWorkflow } from './lib/intelligence.js';
import { parseWorkflowJSON, extractJSON } from './lib/parser.js';
import { testWorkflow, validateExecutionPath } from './lib/tester.js';
import { scanSecurity, detectSensitiveData } from './lib/security.js';
import { analyzePerformance, estimateResourceUsage } from './lib/analyzer.js';
import { getAllTemplates, getTemplate, searchTemplates, getTemplatesByCategory, getCategories as getTemplateCategories } from './lib/templates.js';

// Support both ESM and CommonJS builds
// In CommonJS (Smithery build), use global __filename
// In ESM (local build), create from import.meta.url
const getFilename = (): string => {
  // Try CommonJS first (bundled environments like Smithery)
  if (typeof __filename !== 'undefined') {
    return __filename;
  }

  // ESM - use Function to hide import.meta from esbuild
  try {
    const getImportMetaUrl = new Function('return import.meta.url');
    return fileURLToPath(getImportMetaUrl());
  } catch (e) {
    // Fallback
    return process.cwd();
  }
};

const getDirname = (): string => {
  const filename = getFilename();
  return filename ? dirname(filename) : process.cwd();
};

const __filename: string = getFilename();
const __dirname: string = getDirname();

const server = new Server(
  {
    name: '@flowengine/n8n-workflow-builder',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
);

// Pre-load node registry at startup to verify it works
console.log('🚀 FlowEngine MCP Server starting...');
try {
  const testNode = getNode('n8n-nodes-base.webhook');
  if (testNode) {
    console.log(`✅ Node registry loaded successfully (test: ${testNode.displayName})`);
  } else {
    console.error('❌ Node registry loaded but test node not found');
  }
} catch (error) {
  console.error('❌ Failed to load node registry:', error);
}

// Load expert prompt - use lazy loading to avoid issues in bundled environments
let expertPrompt: string | null = null;
function getExpertPrompt(): string {
  if (expertPrompt === null) {
    try {
      const promptPath = join(__dirname, '..', 'prompts', 'workflow-assistant.md');
      expertPrompt = readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load expert prompt file:', error);
      // Fallback: provide a minimal prompt
      expertPrompt = 'You are an expert n8n workflow builder. Generate complete, valid n8n workflow JSON based on the task description.';
    }
  }
  return expertPrompt;
}

/**
 * List available prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'n8n-workflow-expert',
        description: 'Expert system prompt for generating n8n workflows with 600+ nodes, AI agents, and best practices',
        arguments: [
          {
            name: 'task',
            description: 'The workflow task or description',
            required: true,
          },
        ],
      },
    ],
  };
});

/**
 * Get prompt content
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === 'n8n-workflow-expert') {
    const task = request.params.arguments?.task || 'Create an n8n workflow';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${getExpertPrompt()}\n\n---\n\nTask: ${task}\n\nGenerate a complete n8n workflow following ALL the rules and patterns above. Return ONLY valid JSON.`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${request.params.name}`);
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'workflow://examples/email-slack',
        name: 'Email to Slack Workflow Example',
        description: 'Example workflow that monitors Gmail and sends Slack notifications',
        mimeType: 'application/json',
      },
      {
        uri: 'workflow://examples/ai-agent',
        name: 'AI Agent Workflow Example',
        description: 'Example AI agent workflow with memory and tool use',
        mimeType: 'application/json',
      },
      {
        uri: 'workflow://templates',
        name: 'Workflow Templates Library',
        description: 'Browse all available n8n workflow templates',
        mimeType: 'application/json',
      },
    ],
  };
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === 'workflow://examples/email-slack') {
    const exampleWorkflow = {
      name: 'Gmail to Slack Notifications',
      nodes: [
        {
          type: 'n8n-nodes-base.gmailTrigger',
          typeVersion: 1,
          position: [250, 300],
          name: 'Gmail Trigger',
          parameters: {
            filters: {
              labelIds: ['INBOX'],
              q: 'is:unread subject:urgent',
            },
          },
        },
        {
          type: 'n8n-nodes-base.slack',
          typeVersion: 1,
          position: [450, 300],
          name: 'Send to Slack',
          parameters: {
            channel: '#alerts',
            text: 'New urgent email: {{$json["subject"]}}',
          },
        },
      ],
      connections: {
        'Gmail Trigger': {
          main: [[{ node: 'Send to Slack', type: 'main', index: 0 }]],
        },
      },
    };

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(exampleWorkflow, null, 2),
        },
      ],
    };
  }

  if (uri === 'workflow://examples/ai-agent') {
    const exampleWorkflow = {
      name: 'AI Agent with Memory',
      nodes: [
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
          typeVersion: 1,
          position: [250, 300],
          name: 'Chat Trigger',
          parameters: {},
        },
        {
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 1,
          position: [450, 300],
          name: 'AI Agent',
          parameters: {
            promptType: 'define',
            text: 'You are a helpful assistant with access to tools and memory.',
          },
        },
      ],
      connections: {
        'Chat Trigger': {
          main: [[{ node: 'AI Agent', type: 'main', index: 0 }]],
        },
      },
    };

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(exampleWorkflow, null, 2),
        },
      ],
    };
  }

  if (uri === 'workflow://templates') {
    const templates = await getAllTemplates();
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ templates }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ========== WORKFLOW GENERATION ==========
      {
        name: 'build_workflow',
        description: 'Generate n8n workflow from natural language description using FlowEngine\'s generation engine',
        annotations: {
          title: 'Build Workflow',
        },
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Natural language description of the workflow',
            },
            pattern: {
              type: 'string',
              enum: ['linear', 'conditional', 'parallel', 'ai-agent', 'event-driven'],
              description: 'Architecture pattern (auto-detected if not specified)',
            },
            name: {
              type: 'string',
              description: 'Workflow name (optional)',
            },
          },
          required: ['description'],
        },
      },

      // ========== WORKFLOW EDITING ==========
      {
        name: 'add_node',
        description: 'Add a node to an existing workflow',
        annotations: {
          title: 'Add Node',
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'The workflow to modify',
            },
            nodeType: {
              type: 'string',
              description: 'Type of node to add (e.g. "n8n-nodes-base.slack")',
            },
            parameters: {
              type: 'object',
              description: 'Node parameters',
              default: {},
            },
            position: {
              type: 'array',
              description: 'Node position [x, y]',
              items: { type: 'number' },
            },
            name: {
              type: 'string',
              description: 'Custom node name (optional)',
            },
          },
          required: ['workflow', 'nodeType'],
        },
      },

      {
        name: 'edit_node',
        description: 'Edit parameters of an existing node in a workflow',
        annotations: {
          title: 'Edit Node',
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'The workflow containing the node',
            },
            nodeName: {
              type: 'string',
              description: 'Name of the node to edit',
            },
            parameters: {
              type: 'object',
              description: 'New parameters to merge with existing ones',
            },
          },
          required: ['workflow', 'nodeName', 'parameters'],
        },
      },

      {
        name: 'delete_node',
        description: 'Delete a node from a workflow',
        annotations: {
          title: 'Delete Node',
          destructiveHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'The workflow to modify',
            },
            nodeName: {
              type: 'string',
              description: 'Name of the node to delete',
            },
          },
          required: ['workflow', 'nodeName'],
        },
      },

      {
        name: 'add_connection',
        description: 'Add a connection between two nodes in a workflow',
        annotations: {
          title: 'Add Connection',
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'The workflow to modify',
            },
            sourceNode: {
              type: 'string',
              description: 'Name of the source node',
            },
            targetNode: {
              type: 'string',
              description: 'Name of the target node',
            },
            sourceOutput: {
              type: 'number',
              description: 'Source output index (default: 0)',
              default: 0,
            },
            targetInput: {
              type: 'number',
              description: 'Target input index (default: 0)',
              default: 0,
            },
          },
          required: ['workflow', 'sourceNode', 'targetNode'],
        },
      },

      {
        name: 'get_workflow_details',
        description: 'Get detailed information about a workflow structure',
        annotations: {
          title: 'Get Workflow Details',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'The workflow to analyze',
            },
          },
          required: ['workflow'],
        },
      },

      // ========== VALIDATION (EXISTING) ==========
      {
        name: 'validate_workflow',
        description: 'Validate and auto-fix n8n workflow JSON with 13 comprehensive auto-fixing features',
        annotations: {
          title: 'Validate Workflow',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'The n8n workflow JSON to validate',
            },
            autofix: {
              type: 'boolean',
              description: 'Apply auto-fixes (default: true)',
              default: true,
            },
          },
          required: ['workflow'],
        },
      },

      {
        name: 'extract_workflow_json',
        description: 'Extract n8n workflow JSON from text/markdown (useful when AI wraps JSON in explanation)',
        annotations: {
          title: 'Extract Workflow JSON',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text containing workflow JSON',
            },
          },
          required: ['text'],
        },
      },

      // ========== INTELLIGENT SUGGESTIONS ==========
      {
        name: 'suggest_architecture',
        description: 'Recommend the best workflow architecture pattern for a task',
        annotations: {
          title: 'Suggest Architecture',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Task description',
            },
          },
          required: ['description'],
        },
      },

      {
        name: 'suggest_nodes',
        description: 'Recommend nodes for a specific task',
        annotations: {
          title: 'Suggest Nodes',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Task description',
            },
          },
          required: ['task'],
        },
      },

      {
        name: 'analyze_workflow',
        description: 'Analyze workflow and provide insights and suggestions',
        annotations: {
          title: 'Analyze Workflow',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'n8n workflow JSON',
            },
          },
          required: ['workflow'],
        },
      },

      {
        name: 'suggest_improvements',
        description: 'Get optimization suggestions for a workflow',
        annotations: {
          title: 'Suggest Improvements',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'n8n workflow JSON',
            },
          },
          required: ['workflow'],
        },
      },

      {
        name: 'explain_workflow',
        description: 'Generate natural language explanation of what a workflow does',
        annotations: {
          title: 'Explain Workflow',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'n8n workflow JSON',
            },
          },
          required: ['workflow'],
        },
      },

      // ========== NODE LIBRARY ==========
      {
        name: 'search_nodes',
        description: 'Search the node library (600+ nodes) by keyword',
        annotations: {
          title: 'Search Nodes',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
          },
          required: ['query'],
        },
      },

      {
        name: 'list_nodes_by_category',
        description: 'List all nodes in a specific category',
        annotations: {
          title: 'List Nodes by Category',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category name (trigger, communication, data, ai, core)',
            },
          },
          required: ['category'],
        },
      },

      {
        name: 'get_node_details',
        description: 'Get detailed information about a specific node',
        annotations: {
          title: 'Get Node Details',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            nodeType: {
              type: 'string',
              description: 'Node type (e.g., n8n-nodes-base.slack)',
            },
          },
          required: ['nodeType'],
        },
      },

      // ========== TESTING & QUALITY ==========
      {
        name: 'test_workflow',
        description: 'Dry-run test workflow without executing (simulates execution path)',
        annotations: {
          title: 'Test Workflow',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'n8n workflow JSON',
            },
          },
          required: ['workflow'],
        },
      },

      {
        name: 'scan_security',
        description: 'Scan workflow for security vulnerabilities (credential leaks, unsafe code, etc.)',
        annotations: {
          title: 'Scan Security',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'n8n workflow JSON',
            },
          },
          required: ['workflow'],
        },
      },

      {
        name: 'analyze_performance',
        description: 'Analyze workflow performance and detect bottlenecks',
        annotations: {
          title: 'Analyze Performance',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              description: 'n8n workflow JSON',
            },
          },
          required: ['workflow'],
        },
      },

      // ========== TEMPLATES ==========
      {
        name: 'list_templates',
        description: 'List all available workflow templates',
        annotations: {
          title: 'List Templates',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category (optional)',
            },
          },
        },
      },

      {
        name: 'get_template',
        description: 'Get a specific workflow template by ID',
        annotations: {
          title: 'Get Template',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'string',
              description: 'Template ID',
            },
          },
          required: ['templateId'],
        },
      },

      {
        name: 'search_templates',
        description: 'Search workflow templates',
        annotations: {
          title: 'Search Templates',
          readOnlyHint: true,
        },
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
          },
          required: ['query'],
        },
      },

      // ========== JSON UTILITIES ==========
      {
        name: 'fix_json',
        description: 'Attempt to repair truncated or malformed workflow JSON',
        annotations: {
          title: 'Fix JSON',
        },
        inputSchema: {
          type: 'object',
          properties: {
            json: {
              type: 'string',
              description: 'Potentially broken JSON string',
            },
          },
          required: ['json'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ========== WORKFLOW GENERATION ==========
    if (name === 'build_workflow') {
      if (!args) throw new Error('Missing arguments');

      const workflow = await generateWorkflow(args.description as string, {
        name: args.name as string,
        pattern: args.pattern as any,
      });

      return {
        content: [
          {
            type: 'text',
            text: `# Generated Workflow\n\n\`\`\`json\n${JSON.stringify(workflow, null, 2)}\n\`\`\``,
          },
        ],
      };
    }

    // ========== WORKFLOW EDITING ==========
    if (name === 'add_node') {
      if (!args) throw new Error('Missing arguments');
      const workflow = args.workflow as any;
      const nodeType = args.nodeType as string;
      const parameters = (args.parameters as Record<string, any>) || {};
      const position = args.position as [number, number] | undefined;
      const customName = args.name as string | undefined;

      // Create a generator with the existing workflow
      const generator = new WorkflowGenerator(workflow.name);
      // Manually set workflow properties
      workflow.nodes.forEach((node: any) => generator.getWorkflow().nodes.push(node));
      Object.assign(generator.getWorkflow().connections, workflow.connections);

      const nodeName = await generator.addNode(nodeType, parameters, {
        position,
        name: customName
      });

      return {
        content: [{
          type: 'text',
          text: `# Node Added\n\nAdded node "${nodeName}" of type \`${nodeType}\`\n\n\`\`\`json\n${JSON.stringify(generator.getWorkflow(), null, 2)}\n\`\`\``
        }]
      };
    }

    if (name === 'edit_node') {
      if (!args) throw new Error('Missing arguments');
      const workflow = args.workflow as any;
      const nodeName = args.nodeName as string;
      const parameters = args.parameters as Record<string, any>;

      const node = workflow.nodes.find((n: any) => n.name === nodeName);
      if (!node) {
        throw new Error(`Node "${nodeName}" not found in workflow`);
      }

      node.parameters = { ...node.parameters, ...parameters };

      return {
        content: [{
          type: 'text',
          text: `# Node Updated\n\nUpdated parameters for node "${nodeName}"\n\n\`\`\`json\n${JSON.stringify(workflow, null, 2)}\n\`\`\``
        }]
      };
    }

    if (name === 'delete_node') {
      if (!args) throw new Error('Missing arguments');
      const workflow = args.workflow as any;
      const nodeName = args.nodeName as string;

      const nodeIndex = workflow.nodes.findIndex((n: any) => n.name === nodeName);
      if (nodeIndex === -1) {
        throw new Error(`Node "${nodeName}" not found in workflow`);
      }

      workflow.nodes.splice(nodeIndex, 1);

      // Remove connections involving this node
      delete workflow.connections[nodeName];
      Object.keys(workflow.connections).forEach(source => {
        if (workflow.connections[source].main) {
          workflow.connections[source].main = workflow.connections[source].main.map((conns: any[]) =>
            conns.filter((conn: any) => conn.node !== nodeName)
          );
        }
      });

      return {
        content: [{
          type: 'text',
          text: `# Node Deleted\n\nDeleted node "${nodeName}"\n\n\`\`\`json\n${JSON.stringify(workflow, null, 2)}\n\`\`\``
        }]
      };
    }

    if (name === 'add_connection') {
      if (!args) throw new Error('Missing arguments');
      const workflow = args.workflow as any;
      const sourceNode = args.sourceNode as string;
      const targetNode = args.targetNode as string;
      const sourceOutput = (args.sourceOutput as number) || 0;
      const targetInput = (args.targetInput as number) || 0;

      // Ensure nodes exist
      if (!workflow.nodes.find((n: any) => n.name === sourceNode)) {
        throw new Error(`Source node "${sourceNode}" not found`);
      }
      if (!workflow.nodes.find((n: any) => n.name === targetNode)) {
        throw new Error(`Target node "${targetNode}" not found`);
      }

      // Initialize connections if needed
      if (!workflow.connections[sourceNode]) {
        workflow.connections[sourceNode] = { main: [[]] };
      }
      if (!workflow.connections[sourceNode].main) {
        workflow.connections[sourceNode].main = [];
      }
      while (workflow.connections[sourceNode].main.length <= sourceOutput) {
        workflow.connections[sourceNode].main.push([]);
      }

      // Add connection
      workflow.connections[sourceNode].main[sourceOutput].push({
        node: targetNode,
        type: 'main',
        index: targetInput
      });

      return {
        content: [{
          type: 'text',
          text: `# Connection Added\n\nConnected "${sourceNode}" → "${targetNode}"\n\n\`\`\`json\n${JSON.stringify(workflow, null, 2)}\n\`\`\``
        }]
      };
    }

    if (name === 'get_workflow_details') {
      if (!args) throw new Error('Missing arguments');
      const workflow = args.workflow as any;

      const nodeCount = workflow.nodes.length;
      const nodeTypes = [...new Set(workflow.nodes.map((n: any) => n.type))];
      const connectionCount = Object.values(workflow.connections).reduce((total: number, conns: any) => {
        return total + (conns.main?.reduce((sum: number, arr: any[]) => sum + arr.length, 0) || 0);
      }, 0);

      const triggers = workflow.nodes.filter((n: any) =>
        n.type.includes('Trigger') || n.type.includes('trigger')
      );

      let response = `# Workflow Details\n\n`;
      response += `**Name:** ${workflow.name}\n`;
      response += `**Nodes:** ${nodeCount}\n`;
      response += `**Connections:** ${connectionCount}\n`;
      response += `**Triggers:** ${triggers.length}\n\n`;

      response += `## Nodes\n\n`;
      workflow.nodes.forEach((node: any) => {
        response += `- **${node.name}** (\`${node.type}\`) at [${node.position.join(', ')}]\n`;
      });

      response += `\n## Node Types Used\n\n`;
      nodeTypes.forEach((type: any) => {
        const count = workflow.nodes.filter((n: any) => n.type === type).length;
        response += `- ${type} (${count})\n`;
      });

      return {
        content: [{ type: 'text', text: response }]
      };
    }

    // ========== VALIDATION (EXISTING) ==========
    if (name === 'validate_workflow') {
      if (!args) throw new Error('Missing arguments');
      const workflow = args.workflow as any;
      const autofix = args.autofix !== false;

      const validation = validateWorkflow(workflow, autofix);

      let response = `# Validation Results\n\n`;
      if (validation.valid) {
        response += `✅ **Workflow is valid!**\n\n`;
      } else {
        response += `❌ **Validation failed**\n\n`;
      }

      if (validation.autofixed) {
        response += `## Auto-Fixes Applied (${validation.fixes.length})\n\n`;
        validation.fixes.forEach(fix => {
          response += `- ${fix}\n`;
        });
        response += `\n`;
      }

      if (validation.errors.length > 0) {
        response += `## Errors (${validation.errors.length})\n\n`;
        validation.errors.forEach(error => {
          response += `- ${error}\n`;
        });
        response += `\n`;
      }

      if (validation.warnings.length > 0) {
        response += `## Warnings (${validation.warnings.length})\n\n`;
        validation.warnings.forEach(warning => {
          response += `- ${warning}\n`;
        });
        response += `\n`;
      }

      if (validation.normalized && validation.autofixed) {
        response += `## Auto-Fixed Workflow\n\n\`\`\`json\n${JSON.stringify(validation.normalized, null, 2)}\n\`\`\`\n`;
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'extract_workflow_json') {
      if (!args) throw new Error('Missing arguments');
      const text = args.text as string;
      const extraction = extractWorkflowJSON(text);

      if (!extraction.hasWorkflow) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ No workflow JSON found in the provided text.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Workflow JSON extracted successfully!\n\n\`\`\`json\n${JSON.stringify(extraction.workflowJSON, null, 2)}\n\`\`\``,
          },
        ],
      };
    }

    // ========== INTELLIGENT SUGGESTIONS ==========
    if (name === 'suggest_architecture') {
      if (!args) throw new Error('Missing arguments');
      const result = suggestArchitecture(args.description as string);

      let response = `# Architecture Recommendation\n\n`;
      response += `**Recommended:** ${result.recommended.name}\n`;
      response += `**Confidence:** ${(result.confidence * 100).toFixed(0)}%\n\n`;
      response += `${result.recommended.description}\n\n`;
      response += `**Use Cases:**\n${result.recommended.useCases.map(u => `- ${u}`).join('\n')}\n\n`;
      response += `**Complexity:** ${result.recommended.complexity}\n\n`;

      if (result.alternatives.length > 0) {
        response += `## Alternatives\n\n`;
        result.alternatives.forEach(alt => {
          response += `- **${alt.name}:** ${alt.description}\n`;
        });
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'suggest_nodes') {
      if (!args) throw new Error('Missing arguments');
      const suggestions = suggestNodes(args.task as string);

      let response = `# Node Suggestions\n\n`;
      suggestions.slice(0, 10).forEach((sug, i) => {
        response += `${i + 1}. **${sug.node}**\n`;
        response += `   ${sug.reason}\n`;
        response += `   Confidence: ${(sug.confidence * 100).toFixed(0)}%\n\n`;
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'analyze_workflow') {
      if (!args) throw new Error('Missing arguments');
      const insights = analyzeWorkflow(args.workflow as any);

      let response = `# Workflow Analysis\n\n`;

      const byType = insights.reduce((acc, insight) => {
        if (!acc[insight.type]) acc[insight.type] = [];
        acc[insight.type].push(insight);
        return acc;
      }, {} as any);

      Object.entries(byType).forEach(([type, items]: [string, any]) => {
        response += `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`;
        items.forEach((insight: any) => {
          response += `- **${insight.message}**\n`;
          if (insight.suggestedFix) {
            response += `  Fix: ${insight.suggestedFix}\n`;
          }
          response += `\n`;
        });
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'suggest_improvements') {
      if (!args) throw new Error('Missing arguments');
      const improvements = suggestImprovements(args.workflow as any);

      let response = `# Improvement Suggestions\n\n`;

      const byPriority = improvements.reduce((acc, imp) => {
        if (!acc[imp.priority]) acc[imp.priority] = [];
        acc[imp.priority].push(imp);
        return acc;
      }, {} as any);

      ['high', 'medium', 'low'].forEach(priority => {
        if (byPriority[priority]) {
          response += `## ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`;
          byPriority[priority].forEach((imp: any) => {
            response += `- [${imp.category}] ${imp.suggestion}\n`;
          });
          response += `\n`;
        }
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'explain_workflow') {
      if (!args) throw new Error('Missing arguments');
      const explanation = explainWorkflow(args.workflow as any);

      return {
        content: [{ type: 'text', text: explanation }],
      };
    }

    // ========== NODE LIBRARY ==========
    if (name === 'search_nodes') {
      if (!args) throw new Error('Missing arguments');
      const nodes = searchNodes(args.query as string);

      let response = `# Node Search Results (${nodes.length})\n\n`;
      nodes.slice(0, 20).forEach(node => {
        response += `## ${node.displayName}\n`;
        response += `**Type:** \`${node.type}\`\n`;
        response += `**Category:** ${node.category}\n`;
        response += `${node.description}\n\n`;
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'list_nodes_by_category') {
      if (!args) throw new Error('Missing arguments');
      const nodes = getNodesByCategory(args.category as string);

      let response = `# ${args.category} Nodes (${nodes.length})\n\n`;
      nodes.forEach((node: any) => {
        response += `- **${node.displayName}** (\`${node.type}\`)\n`;
        response += `  ${node.description}\n\n`;
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'get_node_details') {
      if (!args) throw new Error('Missing arguments');
      const node = getNode(args.nodeType as string);

      if (!node) {
        throw new Error(`Node type not found: ${args.nodeType}`);
      }

      let response = `# ${node.displayName}\n\n`;
      response += `**Type:** \`${node.type}\`\n`;
      response += `**Version:** ${node.typeVersion}\n`;
      response += `**Category:** ${node.category}\n\n`;
      response += `${node.description}\n\n`;

      if (node.requiresCredentials) {
        response += `**Requires Credentials:** ${node.credentialType}\n\n`;
      }

      response += `**Inputs:** ${node.inputs.join(', ')}\n`;
      response += `**Outputs:** ${node.outputs.join(', ')}\n`;

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    // ========== TESTING & QUALITY ==========
    if (name === 'test_workflow') {
      if (!args) throw new Error('Missing arguments');
      const result = testWorkflow(args.workflow as any);

      let response = `# Test Results\n\n`;
      response += result.success ? '✅ Test Passed\n\n' : '❌ Test Failed\n\n';

      if (result.errors.length > 0) {
        response += `## Errors\n\n${result.errors.map(e => `- ${e}`).join('\n')}\n\n`;
      }

      if (result.warnings.length > 0) {
        response += `## Warnings\n\n${result.warnings.map(w => `- ${w}`).join('\n')}\n\n`;
      }

      response += `## Execution Path\n\n${result.executionPath.join(' → ')}\n\n`;
      response += `**Estimated Duration:** ${result.estimatedDuration}ms\n`;

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'scan_security') {
      if (!args) throw new Error('Missing arguments');
      const issues = scanSecurity(args.workflow as any);

      let response = `# Security Scan Results\n\n`;

      if (issues.length === 0) {
        response += '✅ No security issues detected!\n';
      } else {
        response += `⚠️ Found ${issues.length} security issue(s)\n\n`;

        const bySeverity = issues.reduce((acc, issue) => {
          if (!acc[issue.severity]) acc[issue.severity] = [];
          acc[issue.severity].push(issue);
          return acc;
        }, {} as any);

        ['critical', 'high', 'medium', 'low'].forEach(severity => {
          if (bySeverity[severity]) {
            response += `## ${severity.toUpperCase()} (${bySeverity[severity].length})\n\n`;
            bySeverity[severity].forEach((issue: any) => {
              response += `- **${issue.message}**\n`;
              if (issue.node) response += `  Node: ${issue.node}\n`;
              response += `  Recommendation: ${issue.recommendation}\n\n`;
            });
          }
        });
      }

      const sensitiveData = detectSensitiveData(args.workflow as any);
      if (sensitiveData.length > 0) {
        response += `\n## Sensitive Data Detected\n\n`;
        response += sensitiveData.map(d => `- ${d}`).join('\n');
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'analyze_performance') {
      if (!args) throw new Error('Missing arguments');
      const metrics = analyzePerformance(args.workflow as any);
      const resources = estimateResourceUsage(args.workflow as any);

      let response = `# Performance Analysis\n\n`;
      response += `**Complexity:** ${metrics.complexity}\n`;
      response += `**Est. Execution Time:** ${metrics.estimatedExecutionTime}ms\n`;
      response += `**Nodes:** ${metrics.nodeCount}\n`;
      response += `**Connections:** ${metrics.connectionCount}\n`;
      response += `**Max Depth:** ${metrics.depth}\n`;
      response += `**Parallel Paths:** ${metrics.parallelPaths}\n\n`;

      response += `## Resource Usage\n\n`;
      response += `- **Memory:** ${resources.memory}\n`;
      response += `- **CPU:** ${resources.cpu}\n`;
      response += `- **Network:** ${resources.network}\n\n`;

      if (metrics.bottlenecks.length > 0) {
        response += `## Bottlenecks (${metrics.bottlenecks.length})\n\n`;
        metrics.bottlenecks.forEach(b => {
          response += `- **${b.description}** (${b.impact} impact)\n`;
          response += `  Location: ${b.location}\n\n`;
        });
      }

      if (metrics.recommendations.length > 0) {
        response += `## Recommendations\n\n`;
        metrics.recommendations.forEach(r => {
          response += `- ${r}\n`;
        });
      }

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    // ========== TEMPLATES ==========
    if (name === 'list_templates') {
      const templates = args?.category
        ? await getTemplatesByCategory(args.category as string)
        : await getAllTemplates();

      let response = `# Workflow Templates (${templates.length})\n\n`;
      templates.forEach(t => {
        response += `## ${t.name}\n`;
        response += `**ID:** \`${t.id}\`\n`;
        response += `**Category:** ${t.category}\n`;
        response += `**Difficulty:** ${t.difficulty}\n`;
        response += `${t.description}\n\n`;
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'get_template') {
      if (!args) throw new Error('Missing arguments');
      const template = await getTemplate(args.templateId as string);

      if (!template) {
        return {
          content: [{ type: 'text', text: '❌ Template not found' }],
        };
      }

      let response = `# ${template.name}\n\n`;
      response += `${template.description}\n\n`;
      response += `**Category:** ${template.category}\n`;
      response += `**Difficulty:** ${template.difficulty}\n`;
      response += `**Tags:** ${template.tags.join(', ')}\n\n`;
      response += `## Workflow\n\n\`\`\`json\n${JSON.stringify(template.workflow, null, 2)}\n\`\`\``;

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    if (name === 'search_templates') {
      if (!args) throw new Error('Missing arguments');
      const templates = await searchTemplates(args.query as string);

      let response = `# Template Search Results (${templates.length})\n\n`;
      templates.forEach(t => {
        response += `- **${t.name}** (\`${t.id}\`)\n`;
        response += `  ${t.description}\n\n`;
      });

      return {
        content: [{ type: 'text', text: response }],
      };
    }

    // ========== JSON UTILITIES ==========
    if (name === 'fix_json') {
      if (!args) throw new Error('Missing arguments');
      const result = parseWorkflowJSON(args.json as string);

      if (result.success) {
        let response = result.recovered
          ? '✅ JSON successfully recovered!\n\n'
          : '✅ JSON is valid!\n\n';
        response += `\`\`\`json\n${JSON.stringify(result.workflow, null, 2)}\n\`\`\``;

        return {
          content: [{ type: 'text', text: response }],
        };
      } else {
        let response = `❌ Could not recover JSON\n\n`;
        response += `Error: ${result.error}\n\n`;

        if (result.completionSuggestions && result.completionSuggestions.length > 0) {
          response += `## Suggestions\n\n`;
          result.completionSuggestions.forEach(s => {
            response += `- ${s}\n`;
          });
        }

        return {
          content: [{ type: 'text', text: response }],
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Create server function for Smithery compatibility
 * @param {Object} options - Configuration options (currently unused)
 * @returns {Server} The configured MCP server instance (not connected to transport)
 */
export default function createServer(options?: { config?: any }) {
  return server;
}

/**
 * Start server with stdio transport (for local/CLI usage)
 * Only runs when executed directly (not when imported by Smithery)
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FlowEngine n8n Workflow Builder v2.0 - MCP Server running');
  console.error('🚀 Now with: Workflow Generation, 60+ Nodes, AI Intelligence, Security, Performance Analysis, Templates');
}

// Only run main() when executed directly (not when imported by Smithery)
// Check if we're being run as a CLI tool (not imported)
function isDirectExecution(): boolean {
  // In CommonJS bundles (Smithery), there's no import.meta
  // In that case, we don't want to auto-start
  try {
    const getImportMetaUrl = new Function('return import.meta.url');
    const importMetaUrl = getImportMetaUrl();
    return importMetaUrl === `file://${process.argv[1]}` ||
           process.argv[1]?.endsWith('index.js') ||
           process.argv[1]?.endsWith('index.ts');
  } catch (e) {
    // No import.meta available (CommonJS bundle) - don't auto-start
    return false;
  }
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
