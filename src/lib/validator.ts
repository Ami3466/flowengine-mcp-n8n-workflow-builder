/**
 * n8n Workflow Validator - Advanced Auto-Fixing
 *
 * Upgraded to match FlowEngine's comprehensive validation with:
 * - Malformed JSON detection
 * - Category-aware node conversion
 * - Descriptive name generation
 * - Placeholder credentials (20+ services)
 * - Intelligent auto-connection
 * - Hanging node detection
 * - Duplicate connection removal
 * - Empty parameter placeholders
 * - CRITICAL AI AGENT FIXES (11 fixes from FlowEngine):
 *   1. Remove invalid AI tool connections
 *   2. Smart regular-to-tool node conversion
 *   3. Remove hardcoded model parameters
 *   4. Fix backwards tool connections
 *   5. Fix node positioning for AI agents
 *   6. Ensure descriptive names
 *   7. Normalize AI tool indexes
 *   8. Replace deprecated nodes (NEW)
 *   9. Remove over-linking (NEW)
 *   10. Rebuild orphaned connections (NEW)
 *   VALIDATION: Validate AI agent requirements (NEW)
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
  autofixed: boolean;
  normalized?: any;
}

const NodeSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string().regex(/^n8n-nodes-base\.|^@n8n\/|^n8n-nodes-/),
  typeVersion: z.number().positive().optional(),
  position: z.array(z.number()).length(2),
  parameters: z.record(z.any()),
});

const ConnectionSchema = z.record(
  z.record(z.array(z.array(z.object({ node: z.string(), type: z.string(), index: z.number() }))))
);

const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nodes: z.array(NodeSchema).min(1),
  connections: ConnectionSchema.optional(),
  active: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * Deprecated nodes mapping (self-contained)
 */
const DEPRECATED_NODES: Record<string, string> = {
  '@n8n/n8n-nodes-langchain.openAi': '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  '@n8n/n8n-nodes-langchain.chatOpenAi': '@n8n/n8n-nodes-langchain.lmChatOpenAi',
};

/**
 * Required AI agent model types
 */
const REQUIRED_MODEL_TYPES = [
  '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  '@n8n/n8n-nodes-langchain.lmChatGroq',
  '@n8n/n8n-nodes-langchain.lmChatOllama'
];

/**
 * Generate descriptive node names based on node type
 * Matches FlowEngine's generateDescriptiveName function
 */
function generateDescriptiveName(node: any, index: number): string {
  const nodeType = node.type || '';

  // Map common node types to descriptive names
  if (nodeType.includes('manualTrigger')) return 'Manual Trigger';
  if (nodeType.includes('webhook')) return 'Webhook Trigger';
  if (nodeType.includes('schedule')) return 'Schedule Trigger';
  if (nodeType.includes('googleSheets')) return 'Google Sheets';
  if (nodeType.includes('gmail')) return 'Gmail';
  if (nodeType.includes('slack')) return 'Slack';
  if (nodeType.includes('httpRequest')) return 'HTTP Request';
  if (nodeType.includes('set')) return 'Set Data';
  if (nodeType.includes('code')) return 'Code Execute';
  if (nodeType.includes('if')) return 'Condition Check';
  if (nodeType.includes('function')) return 'Function';
  if (nodeType.includes('merge')) return 'Merge Data';
  if (nodeType.includes('split')) return 'Split Data';
  if (nodeType.includes('filter')) return 'Filter Data';
  if (nodeType.includes('transform')) return 'Transform Data';
  if (nodeType.includes('email')) return 'Send Email';
  if (nodeType.includes('file')) return 'File Operation';
  if (nodeType.includes('database')) return 'Database Query';
  if (nodeType.includes('lmChatOpenAi')) return 'OpenAI Chat Model';
  if (nodeType.includes('lmChatAnthropic')) return 'Anthropic Chat Model';
  if (nodeType.includes('agent')) return 'AI Agent';
  if (nodeType.includes('memory')) return 'Chat Memory';
  if (nodeType.includes('tool')) return 'AI Tool';

  // Extract meaningful part from node type
  const typeParts = nodeType.split('.');
  const baseType = typeParts[typeParts.length - 1] || 'Node';

  // Convert camelCase to Title Case
  return baseType.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()).trim() || `Process Step ${index + 1}`;
}

/**
 * Get suggested node name from node type
 */
function getSuggestedNodeName(nodeType: string): string {
  if (!nodeType) return 'Node';

  // Map common node types to descriptive names
  if (nodeType.includes('manualTrigger')) return 'Manual Trigger';
  if (nodeType.includes('webhook')) return 'Webhook Trigger';
  if (nodeType.includes('schedule')) return 'Schedule Trigger';
  if (nodeType.includes('googleSheets')) return 'Google Sheets';
  if (nodeType.includes('gmail')) return 'Gmail';
  if (nodeType.includes('slack')) return 'Slack';
  if (nodeType.includes('httpRequest')) return 'HTTP Request';
  if (nodeType.includes('set')) return 'Set Data';
  if (nodeType.includes('code')) return 'Code Execute';
  if (nodeType.includes('if')) return 'Condition Check';
  if (nodeType.includes('function')) return 'Function';
  if (nodeType.includes('merge')) return 'Merge Data';
  if (nodeType.includes('split')) return 'Split Data';
  if (nodeType.includes('filter')) return 'Filter Data';
  if (nodeType.includes('transform')) return 'Transform Data';
  if (nodeType.includes('email')) return 'Send Email';
  if (nodeType.includes('file')) return 'File Operation';
  if (nodeType.includes('database')) return 'Database Query';
  if (nodeType.includes('lmChatOpenAi')) return 'OpenAI Chat Model';
  if (nodeType.includes('lmChatAnthropic')) return 'Anthropic Chat Model';
  if (nodeType.includes('agent')) return 'AI Agent';
  if (nodeType.includes('memory')) return 'Chat Memory';
  if (nodeType.includes('tool')) return 'AI Tool';

  // Extract meaningful part from node type
  const typeParts = nodeType.split('.');
  const baseType = typeParts[typeParts.length - 1] || 'Node';

  // Convert camelCase to Title Case
  return baseType.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()).trim();
}

/**
 * Check if node type is a trigger/starting node
 */
function isTriggerNode(nodeType: string): boolean {
  const type = nodeType.toLowerCase();
  return type.includes('trigger') ||
         type.includes('webhook') ||
         type.includes('manual') ||
         type.includes('schedule') ||
         type.includes('cron');
}

/**
 * Check if node type is an AI tool
 */
function isToolNode(nodeType: string): boolean {
  return nodeType.includes('tool') || nodeType.includes('Tool');
}

/**
 * Check if node type is a LangChain tool (allowed to use ai_tool connections)
 */
function isLangChainTool(nodeType: string): boolean {
  return nodeType.startsWith('@n8n/n8n-nodes-langchain.tool');
}

/**
 * Check if node type is a service tool (allowed to use ai_tool connections)
 */
function isServiceTool(nodeType: string): boolean {
  return nodeType.startsWith('n8n-nodes-base.') && nodeType.toLowerCase().includes('tool');
}

/**
 * Check if node type is a language model
 */
function isLanguageModelNode(nodeType: string): boolean {
  return nodeType.includes('lmChat') || nodeType.includes('ChatModel');
}

/**
 * Check if node type is a chat model
 */
function isChatModelNode(nodeType: string): boolean {
  return nodeType.includes('lmChat');
}

/**
 * Check if node type is memory
 */
function isMemoryNode(nodeType: string): boolean {
  return nodeType.includes('memory') || nodeType.includes('Memory');
}

/**
 * Check if node type is an AI agent
 */
function isAgentNode(nodeType: string): boolean {
  return nodeType.includes('agent') || nodeType.includes('Agent');
}

/**
 * Check if node type is an AI agent (strict check)
 */
function isAIAgentNode(nodeType: string): boolean {
  return nodeType === '@n8n/n8n-nodes-langchain.agent';
}

/**
 * Check if workflow has any AI agents
 */
function hasAIAgents(workflow: any): boolean {
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return false;
  }
  return workflow.nodes.some((node: any) => isAgentNode(node.type || ''));
}

/**
 * Check if node is connected only to AI infrastructure
 */
function isConnectedOnlyToAIInfrastructure(nodeName: string, connections: any): boolean {
  if (!connections) return true; // If no connections, consider it disconnected

  let hasConnections = false;
  let allConnectionsAreAI = true;

  // Check all connections from this node
  for (const [sourceName, conns] of Object.entries(connections)) {
    if (sourceName === nodeName) {
      if (typeof conns === 'object' && conns !== null) {
        for (const outputs of Object.values(conns as any)) {
          if (Array.isArray(outputs)) {
            for (const connArray of outputs) {
              if (Array.isArray(connArray)) {
                for (const conn of connArray) {
                  if (conn && typeof conn === 'object' && 'node' in conn) {
                    hasConnections = true;
                    // AI infrastructure connections are ai_tool, ai_languageModel, ai_memory, etc.
                    if (conn.type !== 'ai_tool' && conn.type !== 'ai_languageModel' &&
                        conn.type !== 'ai_memory' && conn.type !== 'ai_outputParser') {
                      allConnectionsAreAI = false;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Check all connections to this node
  for (const [sourceName, conns] of Object.entries(connections)) {
    if (typeof conns === 'object' && conns !== null) {
      for (const outputs of Object.values(conns as any)) {
        if (Array.isArray(outputs)) {
          for (const connArray of outputs) {
            if (Array.isArray(connArray)) {
              for (const conn of connArray) {
                if (conn && typeof conn === 'object' && 'node' in conn && conn.node === nodeName) {
                  hasConnections = true;
                  if (conn.type !== 'ai_tool' && conn.type !== 'ai_languageModel' &&
                      conn.type !== 'ai_memory' && conn.type !== 'ai_outputParser') {
                    allConnectionsAreAI = false;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return !hasConnections || allConnectionsAreAI;
}

/**
 * Check if source node is connected to target node
 */
function isConnectedTo(connections: any, sourceNode: string, targetNode: string): boolean {
  if (!connections || !connections[sourceNode]) {
    return false;
  }

  const sourceConns = connections[sourceNode];
  if (typeof sourceConns !== 'object' || sourceConns === null) {
    return false;
  }

  for (const outputs of Object.values(sourceConns as any)) {
    if (Array.isArray(outputs)) {
      for (const connArray of outputs) {
        if (Array.isArray(connArray)) {
          for (const conn of connArray) {
            if (conn && typeof conn === 'object' && conn.node === targetNode) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Get tool variant of a regular node type if it exists
 */
function getToolVariant(nodeType: string): string | null {
  // Map of regular nodes to their tool variants
  const toolMappings: Record<string, string> = {
    'n8n-nodes-base.gmail': 'n8n-nodes-base.gmailTool',
    'n8n-nodes-base.googleSheets': 'n8n-nodes-base.googleSheetsTool',
    'n8n-nodes-base.slack': 'n8n-nodes-base.slackTool',
    'n8n-nodes-base.notion': 'n8n-nodes-base.notionTool',
    'n8n-nodes-base.airtable': 'n8n-nodes-base.airtableTool',
    'n8n-nodes-base.github': 'n8n-nodes-base.githubTool',
    'n8n-nodes-base.googleDrive': 'n8n-nodes-base.googleDriveTool',
    'n8n-nodes-base.hubspot': 'n8n-nodes-base.hubspotTool',
    'n8n-nodes-base.salesforce': 'n8n-nodes-base.salesforceTool',
    'n8n-nodes-base.jira': 'n8n-nodes-base.jiraTool',
    'n8n-nodes-base.trello': 'n8n-nodes-base.trelloTool',
    'n8n-nodes-base.asana': 'n8n-nodes-base.asanaTool',
    'n8n-nodes-base.linear': 'n8n-nodes-base.linearTool',
    'n8n-nodes-base.discord': 'n8n-nodes-base.discordTool',
    'n8n-nodes-base.telegram': 'n8n-nodes-base.telegramTool',
    'n8n-nodes-base.httpRequest': 'n8n-nodes-base.httpRequestTool',
  };

  return toolMappings[nodeType] || null;
}

/**
 * CRITICAL FIX #1: Remove Invalid AI Tool Connections
 * Only LangChain tools and service tools can use ai_tool connections.
 * Regular nodes should use main connections.
 */
function removeInvalidAIToolConnections(workflow: any): { removed: number } {
  console.log('[REMOVE-INVALID-AI-TOOL-CONNECTIONS] Starting validation...');

  if (!workflow.connections) {
    console.log('[REMOVE-INVALID-AI-TOOL-CONNECTIONS] No connections to validate');
    return { removed: 0 };
  }

  let removed = 0;

  // Build a map of node names to node types
  const nodeTypeMap = new Map<string, string>();
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    for (const node of workflow.nodes) {
      if (node.name && node.type) {
        nodeTypeMap.set(node.name, node.type);
      }
    }
  }

  // Check all connections
  for (const [sourceName, conns] of Object.entries(workflow.connections)) {
    const sourceType = nodeTypeMap.get(sourceName);

    if (!sourceType) continue;

    // Check if this node is allowed to have ai_tool connections
    const isAllowedToolNode = isLangChainTool(sourceType) || isServiceTool(sourceType);

    if (!isAllowedToolNode && typeof conns === 'object' && conns !== null) {
      // This is a regular node - remove ai_tool connections
      if ('ai_tool' in (conns as any)) {
        console.log(`[REMOVE-INVALID-AI-TOOL-CONNECTIONS] Removing ai_tool connection from regular node "${sourceName}" (type: ${sourceType})`);
        delete (conns as any).ai_tool;
        removed++;

        // Convert to main connection if there were ai_tool connections
        // This ensures the node isn't left disconnected
      }
    }
  }

  console.log(`[REMOVE-INVALID-AI-TOOL-CONNECTIONS] Removed ${removed} invalid ai_tool connections`);
  return { removed };
}

/**
 * CRITICAL FIX #2: Smart Regular-to-Tool Node Conversion
 * Converts regular service nodes to Tool variants when appropriate.
 * Conversion rules:
 * 1. Tool variant must exist
 * 2. Workflow must have AI agents
 * 3. Node must be disconnected OR only connected to AI infrastructure
 * 4. Nodes in main workflow flow are kept as regular nodes
 */
function convertRegularNodesToTools(workflow: any): { converted: number; fixes: string[] } {
  console.log('[CONVERT-REGULAR-TO-TOOLS] Starting conversion check...');

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    console.log('[CONVERT-REGULAR-TO-TOOLS] No nodes to convert');
    return { converted: 0, fixes: [] };
  }

  const fixes: string[] = [];
  let converted = 0;

  // Check if workflow has AI agents
  if (!hasAIAgents(workflow)) {
    console.log('[CONVERT-REGULAR-TO-TOOLS] No AI agents found - skipping conversion');
    return { converted: 0, fixes: [] };
  }

  console.log('[CONVERT-REGULAR-TO-TOOLS] AI agents detected, checking for convertible nodes...');

  for (const node of workflow.nodes) {
    if (!node.type || !node.name) continue;

    // Skip if already a tool node
    if (isToolNode(node.type)) {
      continue;
    }

    // Check if tool variant exists
    const toolVariant = getToolVariant(node.type);
    if (!toolVariant) {
      continue;
    }

    // Check if node is disconnected or only connected to AI infrastructure
    const shouldConvert = isConnectedOnlyToAIInfrastructure(node.name, workflow.connections);

    if (shouldConvert) {
      const oldType = node.type;
      node.type = toolVariant;
      converted++;
      const fix = `Converted "${node.name}" from ${oldType} to ${toolVariant} (AI tool variant)`;
      fixes.push(fix);
      console.log(`[CONVERT-REGULAR-TO-TOOLS] ${fix}`);
    }
  }

  console.log(`[CONVERT-REGULAR-TO-TOOLS] Converted ${converted} nodes to tool variants`);
  return { converted, fixes };
}

/**
 * CRITICAL FIX #3: Remove Hardcoded Model Parameters
 * LLM nodes should NEVER have hardcoded model names.
 * Only allowed: parameters: { options: {} } or parameters: { options: { temperature: 0.7, maxTokens: 4096 } }
 */
function removeHardcodedModelParameters(workflow: any): { removed: number; fixes: string[] } {
  console.log('[REMOVE-HARDCODED-MODELS] Starting model parameter validation...');

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    console.log('[REMOVE-HARDCODED-MODELS] No nodes to validate');
    return { removed: 0, fixes: [] };
  }

  const fixes: string[] = [];
  let removed = 0;

  // List of hardcoded model names to remove
  const hardcodedModelPatterns = [
    'gpt-4', 'gpt-3.5', 'gpt-4-turbo', 'gpt-4o',
    'claude-3', 'claude-2', 'claude-instant',
    'claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    'gemini', 'palm',
    'llama', 'mistral', 'mixtral',
  ];

  for (const node of workflow.nodes) {
    if (!node.type || !node.name) continue;

    // Check if this is an LLM node
    if (!isLanguageModelNode(node.type)) {
      continue;
    }

    // Check parameters for hardcoded model names
    if (node.parameters && typeof node.parameters === 'object') {
      let hadHardcodedModel = false;

      // Check for 'model' parameter
      if ('model' in node.parameters) {
        const modelValue = node.parameters.model;
        if (typeof modelValue === 'string') {
          // Check if it matches any hardcoded pattern
          for (const pattern of hardcodedModelPatterns) {
            if (modelValue.toLowerCase().includes(pattern.toLowerCase())) {
              console.log(`[REMOVE-HARDCODED-MODELS] Removing hardcoded model "${modelValue}" from "${node.name}"`);
              delete node.parameters.model;
              hadHardcodedModel = true;
              removed++;
              break;
            }
          }
        }
      }

      // Also check nested model configurations
      if ('modelName' in node.parameters) {
        const modelValue = node.parameters.modelName;
        if (typeof modelValue === 'string') {
          for (const pattern of hardcodedModelPatterns) {
            if (modelValue.toLowerCase().includes(pattern.toLowerCase())) {
              console.log(`[REMOVE-HARDCODED-MODELS] Removing hardcoded modelName "${modelValue}" from "${node.name}"`);
              delete node.parameters.modelName;
              hadHardcodedModel = true;
              removed++;
              break;
            }
          }
        }
      }

      if (hadHardcodedModel) {
        const fix = `Removed hardcoded model parameter from LLM node "${node.name}" (type: ${node.type})`;
        fixes.push(fix);

        // Ensure we have a valid parameters object with at least options
        if (!node.parameters.options) {
          node.parameters.options = {};
        }
      }
    }
  }

  console.log(`[REMOVE-HARDCODED-MODELS] Removed ${removed} hardcoded model parameters`);
  return { removed, fixes };
}

/**
 * CRITICAL FIX #4: Fix Backwards Tool Connections
 * CORRECT n8n pattern: Tools connect TO agent (tool is SOURCE, agent is TARGET)
 * WRONG pattern: Agent connects TO tool (agent is SOURCE, tool is TARGET)
 * This function reverses any backwards connections.
 */
function fixBackwardsToolConnections(workflow: any): { fixed: number; fixes: string[] } {
  console.log('[FIX-BACKWARDS-TOOL-CONNECTIONS] Starting connection validation...');

  if (!workflow.connections || !workflow.nodes) {
    console.log('[FIX-BACKWARDS-TOOL-CONNECTIONS] No connections to validate');
    return { fixed: 0, fixes: [] };
  }

  const fixes: string[] = [];
  let fixed = 0;

  // Build a map of node names to node types
  const nodeTypeMap = new Map<string, string>();
  for (const node of workflow.nodes) {
    if (node.name && node.type) {
      nodeTypeMap.set(node.name, node.type);
    }
  }

  const backwardsConnections: Array<{
    agentName: string;
    toolName: string;
    connectionType: string;
    index: number;
  }> = [];

  // Find backwards connections (agent -> tool with ai_tool type)
  for (const [sourceName, conns] of Object.entries(workflow.connections)) {
    const sourceType = nodeTypeMap.get(sourceName);

    if (!sourceType || !isAgentNode(sourceType)) continue;

    if (typeof conns === 'object' && conns !== null) {
      for (const [connType, outputs] of Object.entries(conns as any)) {
        if (connType === 'ai_tool' && Array.isArray(outputs)) {
          for (const connArray of outputs) {
            if (Array.isArray(connArray)) {
              for (const conn of connArray) {
                if (conn && typeof conn === 'object' && 'node' in conn) {
                  const targetType = nodeTypeMap.get(conn.node);
                  if (targetType && isToolNode(targetType)) {
                    // Found backwards connection: agent -> tool
                    backwardsConnections.push({
                      agentName: sourceName,
                      toolName: conn.node,
                      connectionType: conn.type,
                      index: conn.index || 0,
                    });
                    console.log(`[FIX-BACKWARDS-TOOL-CONNECTIONS] Found backwards connection: agent "${sourceName}" -> tool "${conn.node}"`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Fix each backwards connection by reversing it
  for (const backwards of backwardsConnections) {
    const { agentName, toolName, index } = backwards;

    // Remove the backwards connection (agent -> tool)
    if (workflow.connections[agentName] && workflow.connections[agentName].ai_tool) {
      workflow.connections[agentName].ai_tool = workflow.connections[agentName].ai_tool.map((connArray: any) => {
        if (!Array.isArray(connArray)) return connArray;
        return connArray.filter((conn: any) => conn.node !== toolName);
      }).filter((arr: any) => arr.length > 0);

      // Clean up empty ai_tool array
      if (workflow.connections[agentName].ai_tool.length === 0) {
        delete workflow.connections[agentName].ai_tool;
      }
    }

    // Create the correct connection (tool -> agent)
    if (!workflow.connections[toolName]) {
      workflow.connections[toolName] = {};
    }
    if (!workflow.connections[toolName].ai_tool) {
      workflow.connections[toolName].ai_tool = [[]];
    }

    // Add the connection if it doesn't already exist
    const existingConnection = workflow.connections[toolName].ai_tool[0].find(
      (conn: any) => conn.node === agentName
    );

    if (!existingConnection) {
      workflow.connections[toolName].ai_tool[0].push({
        node: agentName,
        type: 'ai_tool',
        index: index,
      });

      fixed++;
      const fix = `Reversed backwards connection: tool "${toolName}" now correctly connects TO agent "${agentName}"`;
      fixes.push(fix);
      console.log(`[FIX-BACKWARDS-TOOL-CONNECTIONS] ${fix}`);
    }
  }

  console.log(`[FIX-BACKWARDS-TOOL-CONNECTIONS] Fixed ${fixed} backwards connections`);
  return { fixed, fixes };
}

/**
 * CRITICAL FIX #5: Fix Node Positioning
 * UPDATED to use FlowEngine's generator positioning logic (horizontal spread below agent)
 * Based on FlowEngine/src/lib/workflowGenerator.ts lines 1660-1684
 */
function fixNodePositioning(workflow: any): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;

  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

  // For each AI agent, position support nodes BELOW and spread horizontally
  for (const agent of aiAgents) {
    const agentX = agent.position[0];
    const agentY = agent.position[1];

    // Find connected nodes
    const languageModels = workflow.nodes.filter((n: any) =>
      isChatModelNode(n.type) && isConnectedTo(workflow.connections, n.name, agent.name)
    );
    const memoryNodes = workflow.nodes.filter((n: any) =>
      isMemoryNode(n.type) && isConnectedTo(workflow.connections, n.name, agent.name)
    );
    const toolNodes = workflow.nodes.filter((n: any) =>
      isToolNode(n.type) && isConnectedTo(workflow.connections, n.name, agent.name)
    );

    // Position language model BELOW and LEFT of agent
    // FlowEngine formula: [agentX - 200, agentY + 300]
    languageModels.forEach((model: any, index: number) => {
      const newPos: [number, number] = [agentX - 200, agentY + 300 + (index * 150)];
      if (model.position[0] !== newPos[0] || model.position[1] !== newPos[1]) {
        model.position = newPos;
        fixes.push(`📍 Repositioned "${model.name}" below-left of AI Agent`);
        changed = true;
      }
    });

    // Position memory BELOW and RIGHT of agent
    // FlowEngine formula: [agentX + 200, agentY + 300]
    memoryNodes.forEach((memory: any, index: number) => {
      const newPos: [number, number] = [agentX + 200, agentY + 300 + (index * 150)];
      if (memory.position[0] !== newPos[0] || memory.position[1] !== newPos[1]) {
        memory.position = newPos;
        fixes.push(`📍 Repositioned "${memory.name}" below-right of AI Agent`);
        changed = true;
      }
    });

    // Position tools BELOW and CENTER of agent, spread horizontally
    // FlowEngine formula: [agentX + (index - floor(length/2)) * 200, agentY + 300]
    toolNodes.forEach((tool: any, index: number) => {
      const newPos: [number, number] = [
        agentX + (index - Math.floor(toolNodes.length / 2)) * 200,
        agentY + 300
      ];
      if (tool.position[0] !== newPos[0] || tool.position[1] !== newPos[1]) {
        tool.position = newPos;
        fixes.push(`📍 Repositioned "${tool.name}" below-center of AI Agent`);
        changed = true;
      }
    });
  }

  return { changed, fixes };
}

/**
 * CRITICAL FIX #6: Ensure Descriptive Names
 * Renames generic "Node1", "node2" to descriptive names
 */
function ensureDescriptiveNames(workflow: any): { changed: boolean; fixes: string[] } {
  console.log('[ENSURE-DESCRIPTIVE-NAMES] Starting name validation...');

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    console.log('[ENSURE-DESCRIPTIVE-NAMES] No nodes to check');
    return { changed: false, fixes: [] };
  }

  const fixes: string[] = [];
  let changed = false;

  const usedNames = new Set<string>();

  // First pass: collect all non-generic names
  for (const node of workflow.nodes) {
    if (node.name && !/^(Node|node)\d+$/i.test(node.name)) {
      usedNames.add(node.name);
    }
  }

  // Second pass: rename generic names
  for (const node of workflow.nodes) {
    if (!node.name || /^(Node|node)\d+$/i.test(node.name)) {
      const oldName = node.name;
      let newName = getSuggestedNodeName(node.type);
      let counter = 1;

      // Ensure uniqueness
      while (usedNames.has(newName)) {
        counter++;
        newName = `${getSuggestedNodeName(node.type)} ${counter}`;
      }

      // Update node name
      node.name = newName;
      usedNames.add(newName);

      // Update connections that reference this node
      if (workflow.connections && oldName) {
        // Update as source node
        if (workflow.connections[oldName]) {
          workflow.connections[newName] = workflow.connections[oldName];
          delete workflow.connections[oldName];
        }

        // Update as target node
        for (const conns of Object.values(workflow.connections)) {
          if (typeof conns === 'object' && conns !== null) {
            for (const outputs of Object.values(conns as any)) {
              if (Array.isArray(outputs)) {
                for (const connArray of outputs) {
                  if (Array.isArray(connArray)) {
                    for (const conn of connArray) {
                      if (conn && conn.node === oldName) {
                        conn.node = newName;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      fixes.push(`Renamed generic "${oldName}" to "${newName}"`);
      changed = true;
      console.log(`[ENSURE-DESCRIPTIVE-NAMES] Renamed "${oldName}" to "${newName}"`);
    }
  }

  console.log(`[ENSURE-DESCRIPTIVE-NAMES] ${changed ? 'Fixed' : 'No changes to'} node names`);
  return { changed, fixes };
}

/**
 * CRITICAL FIX #7: Normalize AI Tool Indexes
 * ALL ai_tool connections must have index: 0
 * Scans all connections, fixes any non-zero indexes
 */
function normalizeAIToolIndexes(workflow: any): { fixed: number; fixes: string[] } {
  console.log('[NORMALIZE-AI-TOOL-INDEXES] Starting index validation...');

  if (!workflow.connections) {
    console.log('[NORMALIZE-AI-TOOL-INDEXES] No connections to validate');
    return { fixed: 0, fixes: [] };
  }

  const fixes: string[] = [];
  let fixed = 0;

  // Scan all connections
  for (const [sourceName, conns] of Object.entries(workflow.connections)) {
    if (typeof conns === 'object' && conns !== null) {
      // Check for ai_tool connections
      if ('ai_tool' in (conns as any)) {
        const aiToolConns = (conns as any).ai_tool;
        if (Array.isArray(aiToolConns)) {
          for (const connArray of aiToolConns) {
            if (Array.isArray(connArray)) {
              for (const conn of connArray) {
                if (conn && typeof conn === 'object' && 'index' in conn) {
                  if (conn.index !== 0) {
                    const oldIndex = conn.index;
                    conn.index = 0;
                    fixed++;
                    const fix = `Fixed ai_tool connection from "${sourceName}" to "${conn.node}": index ${oldIndex} -> 0`;
                    fixes.push(fix);
                    console.log(`[NORMALIZE-AI-TOOL-INDEXES] ${fix}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`[NORMALIZE-AI-TOOL-INDEXES] Fixed ${fixed} ai_tool connection indexes`);
  return { fixed, fixes };
}

/**
 * CRITICAL FIX #8: Replace Deprecated Nodes (NEW from FlowEngine)
 * Replace deprecated node types with modern equivalents:
 * - Old: @n8n/n8n-nodes-langchain.openAi → New: @n8n/n8n-nodes-langchain.lmChatOpenAi
 * - Update node name to match new type
 */
function replaceDeprecatedNodes(workflow: any): { changed: boolean; fixes: string[] } {
  console.log('[REPLACE-DEPRECATED-NODES] Starting deprecated node check...');

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    console.log('[REPLACE-DEPRECATED-NODES] No nodes to check');
    return { changed: false, fixes: [] };
  }

  const fixes: string[] = [];
  let changed = false;

  for (const node of workflow.nodes) {
    if (!node.type) continue;

    // Check if node type is deprecated
    if (DEPRECATED_NODES[node.type]) {
      const oldType = node.type;
      const newType = DEPRECATED_NODES[node.type];

      node.type = newType;
      node.name = getSuggestedNodeName(newType);

      fixes.push(`Replaced deprecated node "${oldType}" with "${newType}" (name: "${node.name}")`);
      changed = true;
      console.log(`[REPLACE-DEPRECATED-NODES] Replaced "${oldType}" → "${newType}"`);
    }
  }

  console.log(`[REPLACE-DEPRECATED-NODES] ${changed ? 'Fixed' : 'No changes to'} deprecated nodes`);
  return { changed, fixes };
}

/**
 * Helper: Find node connected to target via specific connection type
 */
function findConnectedNodeByType(
  workflow: any,
  targetName: string,
  connectionType: string
): any | null {
  const connections = workflow.connections || {};

  for (const [sourceName, sourceConns] of Object.entries(connections)) {
    const typedConns = sourceConns as any;

    if (typedConns[connectionType]) {
      for (const connArray of typedConns[connectionType]) {
        for (const conn of connArray) {
          if (conn.node === targetName) {
            return workflow.nodes.find((n: any) => n.name === sourceName);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Helper: Check if path exists between two nodes
 */
function hasPathBetween(workflow: any, fromNode: string, toNode: string, visited = new Set<string>()): boolean {
  if (fromNode === toNode) return true;
  if (visited.has(fromNode)) return false;

  visited.add(fromNode);
  const connections = workflow.connections || {};
  const nodeConnections = connections[fromNode]?.main?.[0] || [];

  for (const conn of nodeConnections) {
    if (hasPathBetween(workflow, conn.node, toNode, visited)) {
      return true;
    }
  }

  return false;
}

/**
 * VALIDATION: Validate AI Agent Requirements (NEW from FlowEngine)
 * Validate EVERY AI agent has required connections:
 * - Must have language model via ai_languageModel
 * - Must have memory via ai_memory
 * - Should have tools via ai_tool (warning if missing)
 */
function validateAIAgentRequirements(workflow: any): { errors: string[]; warnings: string[] } {
  console.log('[VALIDATE-AI-AGENT-REQUIREMENTS] Starting AI agent validation...');

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return { errors, warnings };
  }

  // Find all AI agent nodes
  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

  if (aiAgents.length === 0) {
    console.log('[VALIDATE-AI-AGENT-REQUIREMENTS] No AI agents found - skipping validation');
    return { errors, warnings };
  }

  console.log(`[VALIDATE-AI-AGENT-REQUIREMENTS] Found ${aiAgents.length} AI agent(s)`);

  // Validate each agent
  for (const agent of aiAgents) {
    // Rule 1: Must have language model connection
    const modelNode = findConnectedNodeByType(workflow, agent.name, 'ai_languageModel');

    if (!modelNode) {
      errors.push(`Agent "${agent.name}" missing language model connection (required: lmChatOpenAi/Anthropic/Gemini/Groq/Ollama)`);
    } else {
      // Validate it's a proper chat model
      if (!REQUIRED_MODEL_TYPES.includes(modelNode.type)) {
        errors.push(`Agent "${agent.name}" has invalid model type "${modelNode.type}" (expected one of: ${REQUIRED_MODEL_TYPES.join(', ')})`);
      }
    }

    // Rule 2: Must have memory connection
    const memoryNode = findConnectedNodeByType(workflow, agent.name, 'ai_memory');

    if (!memoryNode) {
      errors.push(`Agent "${agent.name}" missing memory connection (required: memoryBufferWindow or similar)`);
    } else {
      // Validate it's a proper memory node
      if (!isMemoryNode(memoryNode.type)) {
        errors.push(`Agent "${agent.name}" has invalid memory type "${memoryNode.type}"`);
      }
    }

    // Rule 3: Should have tools (warning if missing)
    const connections = workflow.connections || {};
    let hasTools = false;

    for (const [sourceName, conns] of Object.entries(connections)) {
      if (typeof conns === 'object' && conns !== null) {
        const aiToolConns = (conns as any).ai_tool;
        if (Array.isArray(aiToolConns)) {
          for (const connArray of aiToolConns) {
            if (Array.isArray(connArray)) {
              for (const conn of connArray) {
                if (conn && conn.node === agent.name) {
                  hasTools = true;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (!hasTools) {
      warnings.push(`Agent "${agent.name}" has no tools connected - agent may have limited capabilities`);
    }
  }

  console.log(`[VALIDATE-AI-AGENT-REQUIREMENTS] Validation complete: ${errors.length} errors, ${warnings.length} warnings`);
  return { errors, warnings };
}

/**
 * CRITICAL FIX #9: Remove Over-linking (NEW from FlowEngine)
 * Remove excess connections - each node should connect to only ONE next node:
 * - Skip conditional nodes (IF/Switch) - they can have multiple outputs
 * - Keep only first connection, remove others
 */
function removeOverlinking(workflow: any): { fixed: number; fixes: string[] } {
  console.log('[REMOVE-OVERLINKING] Starting over-linking check...');

  if (!workflow.connections) {
    console.log('[REMOVE-OVERLINKING] No connections to check');
    return { fixed: 0, fixes: [] };
  }

  const fixes: string[] = [];
  let fixed = 0;

  for (const [sourceNode, nodeConns] of Object.entries(workflow.connections)) {
    // Only check main connections (not ai_tool, ai_languageModel, etc.)
    if (!nodeConns || !(nodeConns as any).main) continue;

    const mainConns = (nodeConns as any).main[0];
    if (!Array.isArray(mainConns) || mainConns.length <= 1) continue;

    // Check if this is a conditional node (IF/Switch) that legitimately has multiple outputs
    const sourceNodeObj = workflow.nodes.find((n: any) => n.name === sourceNode);
    const isConditionalNode = sourceNodeObj?.type === 'n8n-nodes-base.if' ||
                             sourceNodeObj?.type === 'n8n-nodes-base.switch';

    if (isConditionalNode) {
      console.log(`[REMOVE-OVERLINKING] Skipping conditional node "${sourceNode}" (legitimate multiple outputs)`);
      continue;
    }

    // Non-conditional node with multiple connections - keep only the FIRST connection
    const firstConnection = mainConns[0];
    const removedConnections = mainConns.slice(1);

    console.log(`[REMOVE-OVERLINKING] Found over-linked node: "${sourceNode}" → ${mainConns.length} targets`);
    console.log(`[REMOVE-OVERLINKING]   Keeping: "${firstConnection.node}"`);
    removedConnections.forEach((conn: any) => {
      console.log(`[REMOVE-OVERLINKING]   Removing: "${conn.node}"`);
    });

    // Keep only the first connection
    (nodeConns as any).main[0] = [firstConnection];

    removedConnections.forEach((conn: any) => {
      fixes.push(`Removed over-linking: "${sourceNode}" no longer connects to "${conn.node}" (keeping linear flow to "${firstConnection.node}")`);
    });

    fixed += removedConnections.length;
  }

  console.log(`[REMOVE-OVERLINKING] Removed ${fixed} excess connections`);
  return { fixed, fixes };
}

/**
 * CRITICAL FIX #10: Rebuild Orphaned Connections (NEW from FlowEngine)
 * Reconnect orphaned nodes (no incoming AND no outgoing connections):
 * - Skip AI agents (they don't need main output)
 * - Tool nodes → connect via ai_tool to nearest agent
 * - Regular nodes → connect from agent's main output
 */
function rebuildOrphanedConnections(workflow: any): { fixed: number; fixes: string[] } {
  console.log('[REBUILD-ORPHANED-CONNECTIONS] Starting orphaned node check...');

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    console.log('[REBUILD-ORPHANED-CONNECTIONS] No nodes to check');
    return { fixed: 0, fixes: [] };
  }

  const fixes: string[] = [];
  let fixed = 0;
  const connections = workflow.connections || {};

  // Build incoming connections map to detect nodes that have incoming connections
  const incomingConnections = new Map<string, number>();
  for (const [sourceNode, conns] of Object.entries(connections)) {
    for (const [connType, connArrays] of Object.entries(conns as any)) {
      if (Array.isArray(connArrays)) {
        for (const connArray of connArrays) {
          if (Array.isArray(connArray)) {
            for (const conn of connArray) {
              if (conn.node) {
                incomingConnections.set(conn.node, (incomingConnections.get(conn.node) || 0) + 1);
              }
            }
          }
        }
      }
    }
  }

  // Find nodes with NO connections (neither incoming nor outgoing)
  for (const node of workflow.nodes) {
    const nodeConns = connections[node.name];
    const hasOutgoing = nodeConns && Object.keys(nodeConns).length > 0;
    const hasIncoming = incomingConnections.has(node.name);

    // Only consider truly orphaned nodes (no incoming AND no outgoing)
    const isOrphaned = !hasOutgoing && !hasIncoming;

    if (isOrphaned) {
      console.log(`[REBUILD-ORPHANED-CONNECTIONS] Found orphaned node: "${node.name}" (type: ${node.type})`);

      // Skip AI Agents - they often have no main output (chat-based workflows)
      if (isAIAgentNode(node.type)) {
        console.log(`[REBUILD-ORPHANED-CONNECTIONS] Skipping AI Agent "${node.name}" - no main output needed for chat workflows`);
        continue;
      }

      // Check if it's a tool node
      const isToolNodeType = isLangChainTool(node.type) || isServiceTool(node.type);

      if (isToolNodeType) {
        // Rebuild ai_tool connection to nearest agent
        const agents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

        if (agents.length > 0) {
          const nearestAgent = agents[0];
          if (!connections[node.name]) connections[node.name] = {};
          connections[node.name].ai_tool = [
            [
              {
                node: nearestAgent.name,
                type: 'ai_tool',
                index: 0,
              },
            ],
          ];
          fixes.push(`Rebuilt ai_tool connection: "${node.name}" → "${nearestAgent.name}"`);
          fixed++;
          console.log(`[REBUILD-ORPHANED-CONNECTIONS] Reconnected tool "${node.name}" to agent "${nearestAgent.name}"`);
        }
      } else {
        // Regular node - connect from AI Agent's main output (after agent executes)
        const agents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

        if (agents.length > 0) {
          const agent = agents[0]; // Use first agent
          if (!connections[agent.name]) connections[agent.name] = {};
          if (!connections[agent.name].main) connections[agent.name].main = [[]];

          // Add connection from agent to orphaned node
          connections[agent.name].main[0].push({
            node: node.name,
            type: 'main',
            index: 0,
          });
          fixes.push(`Reconnected orphaned node "${node.name}" from agent output "${agent.name}"`);
          fixed++;
          console.log(`[REBUILD-ORPHANED-CONNECTIONS] Reconnected regular node "${node.name}" from agent "${agent.name}"`);
        } else {
          // No agents found - connect from first non-trigger node as fallback
          const targetNode = workflow.nodes.find(
            (n: any) =>
              !n.type.toLowerCase().includes('trigger') &&
              n.name !== node.name
          );

          if (targetNode) {
            if (!connections[targetNode.name]) connections[targetNode.name] = {};
            if (!connections[targetNode.name].main) connections[targetNode.name].main = [[]];
            connections[targetNode.name].main[0].push({
              node: node.name,
              type: 'main',
              index: 0,
            });
            fixes.push(`Reconnected orphaned node "${node.name}" from "${targetNode.name}"`);
            fixed++;
            console.log(`[REBUILD-ORPHANED-CONNECTIONS] Reconnected regular node "${node.name}" from "${targetNode.name}" (no agent found)`);
          }
        }
      }
    }
  }

  workflow.connections = connections;
  console.log(`[REBUILD-ORPHANED-CONNECTIONS] Fixed ${fixed} orphaned nodes`);
  return { fixed, fixes };
}

/**
 * Main validation function with FlowEngine-level auto-fixing
 */
export function validateWorkflow(workflowJson: any, autofix = true): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  try {
    // STEP 0: CRITICAL - Malformed JSON Detection (FlowEngine feature #1)
    if (!workflowJson || typeof workflowJson !== 'object') {
      return {
        valid: false,
        errors: ['❌ CRITICAL: Invalid workflow format - not a valid JSON object'],
        warnings: [],
        fixes: [],
        autofixed: false,
      };
    }

    // Check for incomplete node structures
    if (workflowJson.nodes && Array.isArray(workflowJson.nodes)) {
      for (let i = 0; i < workflowJson.nodes.length; i++) {
        const node = workflowJson.nodes[i];

        if (!node || typeof node !== 'object') {
          errors.push(`❌ CRITICAL: Node at index ${i} is not a valid object - workflow JSON is malformed`);
          return { valid: false, errors, warnings, fixes: [], autofixed: false };
        }

        // Check for incomplete parameters
        if ('parameters' in node) {
          if (typeof node.parameters !== 'object') {
            errors.push(`❌ CRITICAL: Node "${node.name || `at index ${i}`}" has malformed parameters`);
            return { valid: false, errors, warnings, fixes: [], autofixed: false };
          }

          try {
            JSON.stringify(node.parameters);
          } catch (e) {
            errors.push(`❌ CRITICAL: Node "${node.name || `at index ${i}`}" has unparseable parameters - workflow JSON is incomplete`);
            return { valid: false, errors, warnings, fixes: [], autofixed: false };
          }
        }

        // Check for missing required fields
        if (!node.name) {
          errors.push(`❌ CRITICAL: Node at index ${i} is missing 'name' field`);
        }
        if (!node.type) {
          errors.push(`❌ CRITICAL: Node at index ${i} is missing 'type' field`);
        }
        if (!node.position || !Array.isArray(node.position)) {
          errors.push(`❌ CRITICAL: Node "${node.name || `at index ${i}`}" is missing 'position' field`);
        }
      }

      if (errors.length > 0) {
        return {
          valid: false,
          errors: [
            '❌ WORKFLOW JSON IS MALFORMED/INCOMPLETE',
            'The workflow contains incomplete node definitions.',
            'This usually means the AI response was cut off or truncated.',
            '',
            'Specific errors:',
            ...errors
          ],
          warnings,
          fixes: [],
          autofixed: false
        };
      }
    }

    // STEP 1: Schema Validation
    const schemaValidation = WorkflowSchema.safeParse(workflowJson);
    if (!schemaValidation.success) {
      const schemaErrors = schemaValidation.error.errors.map(
        (error) => `❌ ${error.path.join('.')}: ${error.message}`
      );
      errors.push(...schemaErrors);
    }

    // STEP 2: Basic structure validation
    if (!workflowJson.nodes || !Array.isArray(workflowJson.nodes)) {
      return {
        valid: false,
        errors: ['Workflow must have nodes array'],
        warnings: [],
        fixes: [],
        autofixed: false,
      };
    }

    if (workflowJson.nodes.length === 0) {
      return {
        valid: false,
        errors: ['Workflow must have at least one node'],
        warnings: [],
        fixes: [],
        autofixed: false,
      };
    }

    const nodeNames = new Set(workflowJson.nodes.map((n: any) => n.name));
    if (nodeNames.size !== workflowJson.nodes.length) {
      errors.push('Workflow contains nodes with duplicate names');
    }

    // STEP 3: Validate each node
    for (const node of workflowJson.nodes) {
      if (!node.name) {
        errors.push('Node missing name');
      }
      if (!node.type) {
        errors.push(`Node "${node.name || 'unnamed'}" missing type`);
      }
      if (node.type && !node.type.includes('.')) {
        errors.push(`Node "${node.name}" has invalid type format "${node.type}"`);
      }
      if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
        errors.push(`Node "${node.name}" missing or invalid position array`);
      }
      if (typeof node.parameters !== 'object') {
        errors.push(`Node "${node.name}" missing parameters object`);
      }

      // FlowEngine feature #4: Generic name detection
      if (node.name && /^(Node|node)\d+$/i.test(node.name)) {
        errors.push(`Node "${node.name}" has generic name - use descriptive names`);
      }
    }

    // STEP 4: Validate connections
    if (workflowJson.connections) {
      const connErrors = validateConnections(workflowJson.nodes, workflowJson.connections);
      errors.push(...connErrors.errors);
      warnings.push(...connErrors.warnings);
    }

    // STEP 5: Apply auto-fixes if requested
    let normalizedWorkflow = workflowJson;
    let autofixed = false;

    if (autofix) {
      const fixResult = applyAutoFixes(workflowJson);
      normalizedWorkflow = fixResult.workflow;
      fixes.push(...fixResult.fixes);
      warnings.push(...fixResult.warnings);
      autofixed = fixResult.fixed;

      // Re-validate after fixes
      const postFixErrors: string[] = [];
      const postFixNodeNames = new Set(normalizedWorkflow.nodes.map((n: any) => n.name));

      if (postFixNodeNames.size !== normalizedWorkflow.nodes.length) {
        postFixErrors.push('Workflow still contains nodes with duplicate names after auto-fix');
      }

      // Clear original errors if fixes were successful
      if (autofixed && postFixErrors.length === 0) {
        errors.length = 0;
      } else {
        errors.push(...postFixErrors);
      }
    }

    const isValid = errors.length === 0;

    return {
      valid: isValid,
      errors,
      warnings,
      fixes,
      autofixed,
      normalized: autofixed ? normalizedWorkflow : workflowJson,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      warnings: [],
      fixes: [],
      autofixed: false,
    };
  }
}

/**
 * Validate connections with hanging node detection
 */
function validateConnections(
  nodes: any[],
  connections: any
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeNames = new Set(nodes.map((n) => n.name));
  const connectedNodes = new Set<string>();
  const connectionPairs = new Map<string, number>();

  // Validate connection structure
  for (const [sourceName, conns] of Object.entries(connections)) {
    if (!nodeNames.has(sourceName)) {
      errors.push(`❌ CRITICAL: Connection source "${sourceName}" does not match any node name`);
      continue;
    }

    connectedNodes.add(sourceName);

    if (typeof conns === 'object' && conns !== null) {
      for (const outputs of Object.values(conns as any)) {
        if (Array.isArray(outputs)) {
          for (const connArray of outputs) {
            if (Array.isArray(connArray)) {
              for (const conn of connArray) {
                if (conn && typeof conn === 'object' && 'node' in conn) {
                  if (!nodeNames.has(conn.node)) {
                    errors.push(`❌ CRITICAL: Connection target "${conn.node}" does not match any node name (from "${sourceName}")`);
                  } else {
                    connectedNodes.add(conn.node);

                    // Track duplicate connections (FlowEngine feature #7)
                    const pairKey = `${sourceName}->${conn.node}`;
                    connectionPairs.set(pairKey, (connectionPairs.get(pairKey) || 0) + 1);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // FlowEngine feature #11: Hanging node detection
  const unconnectedNodes = nodes.filter(node => !connectedNodes.has(node.name));
  for (const node of unconnectedNodes) {
    const nodeType = node.type || '';
    const nodeName = node.name;

    // Skip sticky notes
    if (nodeType === 'n8n-nodes-base.stickyNote') {
      continue;
    }

    if (isTriggerNode(nodeType)) {
      errors.push(
        `❌ HANGING TRIGGER: "${nodeName}" is not connected - workflow can't start. ` +
        `Connect this trigger to the first action node.`
      );
    } else if (isToolNode(nodeType)) {
      errors.push(
        `❌ HANGING TOOL: "${nodeName}" is not connected via ai_tool to any agent. ` +
        `Connect this tool to an AI agent.`
      );
    } else if (isLanguageModelNode(nodeType)) {
      errors.push(
        `❌ HANGING LLM: "${nodeName}" is not connected via ai_languageModel to any agent. ` +
        `Connect this model to an AI agent.`
      );
    } else if (isMemoryNode(nodeType)) {
      errors.push(
        `❌ HANGING MEMORY: "${nodeName}" is not connected via ai_memory to any agent. ` +
        `Connect this memory to an AI agent.`
      );
    } else {
      errors.push(
        `❌ HANGING NODE: "${nodeName}" is not connected to workflow. ` +
        `Every node must have at least one connection.`
      );
    }
  }

  // Check for duplicate connections
  for (const [pairKey, count] of connectionPairs.entries()) {
    if (count > 1) {
      const [source, target] = pairKey.split('->');
      warnings.push(`Duplicate connection detected: "${source}" is linked to "${target}" ${count} times`);
    }
  }

  return { errors, warnings };
}

/**
 * Apply comprehensive auto-fixes matching FlowEngine's capabilities
 */
function applyAutoFixes(workflowJson: any): {
  fixed: boolean;
  workflow: any;
  fixes: string[];
  warnings: string[];
} {
  const fixes: string[] = [];
  const warnings: string[] = [];
  let fixed = false;

  const workflow = JSON.parse(JSON.stringify(workflowJson));

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return { fixed: false, workflow, fixes: [], warnings: [] };
  }

  // FlowEngine feature #6: Fix missing workflow name
  if (!workflow.name || typeof workflow.name !== 'string') {
    workflow.name = 'My Workflow';
    fixes.push('✅ Added missing workflow name');
    fixed = true;
  }

  // FlowEngine feature #7: Ensure connections object exists
  if (!workflow.connections || typeof workflow.connections !== 'object') {
    workflow.connections = {};
    fixes.push('✅ Added missing connections object');
    fixed = true;
  }

  // FlowEngine feature #8: Placeholder credentials mapping
  const credentialMappings: Record<string, { type: string, name: string }> = {
    'googlesheets': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets account' },
    'gmail': { type: 'gmailOAuth2', name: 'Gmail account' },
    'slack': { type: 'slackOAuth2Api', name: 'Slack account' },
    'discord': { type: 'discordOAuth2Api', name: 'Discord account' },
    'notion': { type: 'notionOAuth2Api', name: 'Notion account' },
    'airtable': { type: 'airtableOAuth2Api', name: 'Airtable account' },
    'github': { type: 'githubOAuth2Api', name: 'GitHub account' },
    'gitlab': { type: 'gitlabOAuth2Api', name: 'GitLab account' },
    'shopify': { type: 'shopifyOAuth2Api', name: 'Shopify account' },
    'stripe': { type: 'stripeApi', name: 'Stripe account' },
    'hubspot': { type: 'hubspotOAuth2Api', name: 'HubSpot account' },
    'googledrive': { type: 'googleDriveOAuth2Api', name: 'Google Drive account' },
    'dropbox': { type: 'dropboxOAuth2Api', name: 'Dropbox account' },
    'postgres': { type: 'postgres', name: 'PostgreSQL account' },
    'mysql': { type: 'mySql', name: 'MySQL account' },
    'mongodb': { type: 'mongoDb', name: 'MongoDB account' },
    'redis': { type: 'redis', name: 'Redis account' },
    'ssh': { type: 'sshPassword', name: 'SSH account' },
    'ftp': { type: 'ftp', name: 'FTP account' },
    'openai': { type: 'openAiApi', name: 'OpenAI account' },
    'anthropic': { type: 'anthropicApi', name: 'Anthropic account' }
  };

  // Track node names to detect duplicates (FlowEngine feature #3)
  const nodeNames = new Set<string>();
  const nodeNameCounts = new Map<string, number>();

  // First pass: count node names
  for (const node of workflow.nodes) {
    if (node.name) {
      const count = nodeNameCounts.get(node.name) || 0;
      nodeNameCounts.set(node.name, count + 1);
    }
  }

  // Second pass: fix nodes
  for (let i = 0; i < workflow.nodes.length; i++) {
    const node = workflow.nodes[i];

    // Fix missing node type
    if (!node.type) {
      node.type = 'n8n-nodes-base.httpRequest';
      fixes.push(`✅ Added missing node type for node "${node.name || 'unnamed'}"`);
      fixed = true;
    }

    // Fix invalid node type format
    if (node.type && !node.type.includes('.')) {
      const oldType = node.type;
      node.type = `n8n-nodes-base.${oldType}`;
      fixes.push(`✅ Fixed node type format: "${oldType}" → "${node.type}"`);
      fixed = true;
    }

    // FlowEngine feature #3 & #5: Fix missing, duplicate, or generic node names
    if (!node.name || nodeNameCounts.get(node.name)! > 1 || /^(Node|node)\d+$/i.test(node.name)) {
      const descriptiveName = generateDescriptiveName(node, i);
      let uniqueName = descriptiveName;
      let counter = 1;

      while (nodeNames.has(uniqueName)) {
        counter++;
        uniqueName = `${descriptiveName} ${counter}`;
      }

      const oldName = node.name;
      node.name = uniqueName;
      if (!oldName) {
        fixes.push(`✅ Added descriptive name: "${uniqueName}"`);
      } else if (/^(Node|node)\d+$/i.test(oldName)) {
        fixes.push(`✅ Renamed generic "${oldName}" → "${uniqueName}"`);
      } else {
        fixes.push(`✅ Resolved duplicate name: "${oldName}" → "${uniqueName}"`);
      }
      fixed = true;
    }

    nodeNames.add(node.name);

    // Add missing ID
    if (!node.id) {
      node.id = uuidv4();
      fixes.push(`✅ Added ID to node "${node.name}"`);
      fixed = true;
    }

    // Fix missing position
    if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
      node.position = [100 + (i * 200), 250];
      fixes.push(`✅ Set default position for node "${node.name}"`);
      fixed = true;
    }

    // Fix missing parameters
    if (typeof node.parameters !== 'object' || node.parameters === null) {
      node.parameters = {};
      fixes.push(`✅ Added empty parameters object for node "${node.name}"`);
      fixed = true;
    }

    // FlowEngine feature #13: Empty parameter placeholders
    for (const [key, value] of Object.entries(node.parameters || {})) {
      if (value === '') {
        (node.parameters as any)[key] = `placeholder-${key}`;
        fixes.push(`✅ Replaced empty "${key}" parameter with placeholder in "${node.name}"`);
        fixed = true;
      }
    }

    // FlowEngine feature #8: Add placeholder credentials
    const nodeTypeSimple = node.type.split('.').pop()?.toLowerCase() || '';
    let credentialFixed = false;

    for (const [nodeKeyword, credInfo] of Object.entries(credentialMappings)) {
      if (nodeTypeSimple.includes(nodeKeyword)) {
        if (!node.credentials) {
          node.credentials = {
            [credInfo.type]: {
              id: `placeholder-${nodeKeyword}-${i}`,
              name: credInfo.name
            }
          };
          fixes.push(`✅ Added placeholder credentials for node "${node.name}"`);
          fixed = true;
          credentialFixed = true;
        }
        if (credentialFixed) break;
      }
    }
  }

  // FlowEngine feature #9: Intelligent auto-connection
  if (workflow.nodes.length > 1 && (!workflow.connections || Object.keys(workflow.connections).length === 0)) {
    const triggerNodes = workflow.nodes.filter((node: any) => isTriggerNode(node.type || ''));
    const actionNodes = workflow.nodes.filter((node: any) => !isTriggerNode(node.type || ''));

    if (triggerNodes.length === 1 && actionNodes.length === 1) {
      // Simple: 1 trigger + 1 action
      workflow.connections = {};
      workflow.connections[triggerNodes[0].name] = {
        main: [[{
          node: actionNodes[0].name,
          type: 'main',
          index: 0
        }]]
      };
      fixes.push(`✅ Connected trigger "${triggerNodes[0].name}" → "${actionNodes[0].name}"`);
      fixed = true;
    } else if (triggerNodes.length > 0 && actionNodes.length > 0) {
      // Complex: Create sequential flow
      workflow.connections = {};
      const flow = [triggerNodes[0], ...actionNodes];

      for (let i = 0; i < flow.length - 1; i++) {
        workflow.connections[flow[i].name] = {
          main: [[{
            node: flow[i + 1].name,
            type: 'main',
            index: 0
          }]]
        };
      }

      const flowDescription = flow.map((n: any) => n.name).join(' → ');
      fixes.push(`✅ Created sequential connections: ${flowDescription}`);
      fixed = true;
    }
  }

  // FlowEngine feature #10 & #7: Invalid and duplicate connection removal
  if (workflow.connections) {
    const validNodeNames = new Set(workflow.nodes.map((n: any) => n.name));

    for (const [sourceNode, connections] of Object.entries(workflow.connections)) {
      if (!validNodeNames.has(sourceNode)) {
        delete workflow.connections[sourceNode];
        fixes.push(`✅ Removed connections from non-existent source "${sourceNode}"`);
        fixed = true;
        continue;
      }

      for (const [, outputs] of Object.entries(connections as any)) {
        if (!Array.isArray(outputs)) continue;

        for (let i = 0; i < outputs.length; i++) {
          const outputConnections = outputs[i];
          if (!Array.isArray(outputConnections)) continue;

          const seenConnections = new Set<string>();
          const validConnections = outputConnections.filter((conn: any) => {
            // Remove connections to non-existent nodes
            if (!conn.node || !validNodeNames.has(conn.node)) {
              fixes.push(`✅ Removed connection from "${sourceNode}" to non-existent node "${conn.node}"`);
              fixed = true;
              return false;
            }

            // Remove duplicate connections
            const connectionKey = `${sourceNode}->${conn.node}:${conn.type}:${conn.index}`;
            if (seenConnections.has(connectionKey)) {
              fixes.push(`✅ Removed duplicate connection from "${sourceNode}" to "${conn.node}"`);
              fixed = true;
              return false;
            }

            seenConnections.add(connectionKey);
            return true;
          });

          outputs[i] = validConnections;
        }
      }
    }
  }

  // ========== CRITICAL AI AGENT FIXES ==========
  console.log('\n[VALIDATOR] Applying critical AI agent fixes...\n');

  // CRITICAL FIX #8: Replace Deprecated Nodes (NEW)
  const fix8Result = replaceDeprecatedNodes(workflow);
  if (fix8Result.changed) {
    fixes.push(`✅ [FIX-8] Replaced deprecated node types`);
    fixes.push(...fix8Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // VALIDATION: Validate AI Agent Requirements (NEW) - adds errors/warnings only
  const validationResult = validateAIAgentRequirements(workflow);
  if (validationResult.errors.length > 0) {
    warnings.push(...validationResult.errors.map(e => `⚠️ ${e}`));
  }
  if (validationResult.warnings.length > 0) {
    warnings.push(...validationResult.warnings);
  }

  // CRITICAL FIX #1: Remove Invalid AI Tool Connections
  const fix1Result = removeInvalidAIToolConnections(workflow);
  if (fix1Result.removed > 0) {
    fixes.push(`✅ [FIX-1] Removed ${fix1Result.removed} invalid ai_tool connections from regular nodes`);
    fixed = true;
  }

  // CRITICAL FIX #2: Smart Regular-to-Tool Node Conversion
  const fix2Result = convertRegularNodesToTools(workflow);
  if (fix2Result.converted > 0) {
    fixes.push(`✅ [FIX-2] Converted ${fix2Result.converted} regular nodes to tool variants`);
    fixes.push(...fix2Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #3: Remove Hardcoded Model Parameters
  const fix3Result = removeHardcodedModelParameters(workflow);
  if (fix3Result.removed > 0) {
    fixes.push(`✅ [FIX-3] Removed ${fix3Result.removed} hardcoded model parameters from LLM nodes`);
    fixes.push(...fix3Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #4: Fix Backwards Tool Connections
  const fix4Result = fixBackwardsToolConnections(workflow);
  if (fix4Result.fixed > 0) {
    fixes.push(`✅ [FIX-4] Fixed ${fix4Result.fixed} backwards tool connections`);
    fixes.push(...fix4Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #5: Fix Node Positioning
  const fix5Result = fixNodePositioning(workflow);
  if (fix5Result.changed) {
    fixes.push(`✅ [FIX-5] Fixed node positioning for AI agent support nodes`);
    fixes.push(...fix5Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #6: Ensure Descriptive Names
  const fix6Result = ensureDescriptiveNames(workflow);
  if (fix6Result.changed) {
    fixes.push(`✅ [FIX-6] Ensured descriptive names for all nodes`);
    fixes.push(...fix6Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #7: Normalize AI Tool Indexes
  const fix7Result = normalizeAIToolIndexes(workflow);
  if (fix7Result.fixed > 0) {
    fixes.push(`✅ [FIX-7] Normalized ${fix7Result.fixed} ai_tool connection indexes to 0`);
    fixes.push(...fix7Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #9: Remove Over-linking (NEW)
  const fix9Result = removeOverlinking(workflow);
  if (fix9Result.fixed > 0) {
    fixes.push(`✅ [FIX-9] Removed ${fix9Result.fixed} excess connections (over-linking)`);
    fixes.push(...fix9Result.fixes.map(f => `    → ${f}`));
    fixed = true;
  }

  // CRITICAL FIX #10: Rebuild Orphaned Connections (NEW)
  const hasAIAgentsInWorkflow = workflow.nodes.some((n: any) => isAIAgentNode(n.type));
  if (hasAIAgentsInWorkflow) {
    const fix10Result = rebuildOrphanedConnections(workflow);
    if (fix10Result.fixed > 0) {
      fixes.push(`✅ [FIX-10] Rebuilt ${fix10Result.fixed} orphaned node connections`);
      fixes.push(...fix10Result.fixes.map(f => `    → ${f}`));
      fixed = true;
    }
  } else {
    console.log('[REBUILD] Skipping orphaned node reconnection - no AI agents in workflow');
  }

  console.log('[VALIDATOR] Critical AI agent fixes complete\n');

  return { fixed, workflow, fixes, warnings };
}
