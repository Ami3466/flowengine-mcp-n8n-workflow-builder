/**
 * Workflow Generator - FlowEngine-Compatible Generation Engine
 *
 * Generates n8n workflows using real node descriptions and parameter schemas.
 * Replicates FlowEngine's approach by loading actual INodeTypeDescription from n8n packages.
 */

import { v4 as uuidv4 } from 'uuid';
import type { INode, INodeParameters, IConnections, INodeCredentials, INodeTypeDescription } from 'n8n-workflow';
import { getNode, type NodeTemplate } from './nodes.js';
import { getNodeDescription, getDefaultParameters } from './node-descriptions.js';

// Re-export n8n types for easier use
export type WorkflowNode = INode;
export type WorkflowConnection = IConnections;

export interface Workflow {
  id?: string;
  name: string;
  nodes: INode[];
  connections: IConnections;
  active?: boolean;
  settings?: Record<string, any>;
}

export interface GeneratorOptions {
  name?: string;
  description?: string;
  pattern?: 'linear' | 'conditional' | 'parallel' | 'ai-agent' | 'event-driven';
  addErrorHandling?: boolean;
  addLogging?: boolean;
}

/**
 * Workflow Generator Class
 */
export class WorkflowGenerator {
  private workflow: Workflow;
  private nodeCounter: number = 0;
  private xPosition: number = 250;
  private yPosition: number = 300;

  constructor(name: string = 'My Workflow') {
    this.workflow = {
      id: uuidv4(),
      name,
      nodes: [],
      connections: {},
      active: false,
    };
  }

  /**
   * Add a node to the workflow with real parameter schemas
   */
  async addNode(
    nodeType: string,
    parameters: INodeParameters = {},
    options: {
      name?: string;
      position?: [number, number];
      credentials?: INodeCredentials;
      description?: string;
    } = {}
  ): Promise<string> {
    const template = getNode(nodeType);

    if (!template) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    const nodeName = options.name || this.generateNodeName(template);
    const position = options.position || this.getNextPosition();

    // Load real node description to get proper defaults and schema
    const nodeDescription = await getNodeDescription(nodeType);
    let nodeParams: INodeParameters = {};

    if (nodeDescription) {
      // Start with default parameters from node description
      nodeParams = getDefaultParameters(nodeDescription);

      // Apply context-specific parameter generation
      const contextParams = await this.generateContextualParameters(
        nodeType,
        nodeDescription,
        options.description
      );

      // Merge: defaults < contextual < user-provided
      nodeParams = { ...nodeParams, ...contextParams, ...parameters };
    } else {
      // Fallback to user-provided parameters if description not found
      nodeParams = parameters;
    }

    const node: INode = {
      id: uuidv4(),
      name: nodeName,
      type: template.type,
      typeVersion: 1,
      position,
      parameters: nodeParams,
    };

    // Add webhookId for webhook nodes
    if (nodeType === 'n8n-nodes-base.webhook') {
      (node as any).webhookId = uuidv4();
    }

    if (options.credentials || template.requiresCredentials) {
      node.credentials = options.credentials || this.getPlaceholderCredentials(template);
    }

    this.workflow.nodes.push(node);
    return nodeName;
  }

  /**
   * Generate contextual parameters based on workflow description
   * NOTE: This is intentionally empty - the LLM calling the MCP provides parameters
   * We only use defaults from n8n node descriptions
   */
  private async generateContextualParameters(
    nodeType: string,
    description: INodeTypeDescription,
    contextDescription?: string
  ): Promise<INodeParameters> {
    // Return empty - let LLM provide parameters, we only use n8n defaults
    return {};
  }

  /**
   * Connect two nodes
   */
  connect(
    sourceNode: string,
    targetNode: string,
    connectionType: 'main' | 'ai_languageModel' | 'ai_memory' | 'ai_tool' = 'main',
    sourceIndex: number = 0,
    targetIndex: number = 0
  ): void {
    if (!this.workflow.connections[sourceNode]) {
      this.workflow.connections[sourceNode] = {} as any;
    }

    if (!this.workflow.connections[sourceNode][connectionType]) {
      (this.workflow.connections[sourceNode] as any)[connectionType] = [[]];
    }

    // Ensure array exists for the source index
    while ((this.workflow.connections[sourceNode] as any)[connectionType].length <= sourceIndex) {
      (this.workflow.connections[sourceNode] as any)[connectionType].push([]);
    }

    // Add connection
    (this.workflow.connections[sourceNode] as any)[connectionType][sourceIndex].push({
      node: targetNode,
      type: connectionType,
      index: targetIndex,
    });
  }

  /**
   * Build a linear workflow (trigger -> action1 -> action2 -> ...)
   */
  async buildLinear(nodes: Array<{ type: string; parameters?: INodeParameters }>): Promise<Workflow> {
    let previousNode: string | null = null;

    for (const nodeSpec of nodes) {
      const nodeName = await this.addNode(nodeSpec.type, nodeSpec.parameters || {});

      if (previousNode) {
        this.connect(previousNode, nodeName);
      }

      previousNode = nodeName;
    }

    return this.getWorkflow();
  }

  /**
   * Build a conditional workflow (IF node with true/false branches)
   */
  async buildConditional(
    trigger: { type: string; parameters?: Record<string, any> },
    condition: { type: string; parameters?: Record<string, any> },
    trueBranch: Array<{ type: string; parameters?: Record<string, any> }>,
    falseBranch: Array<{ type: string; parameters?: Record<string, any> }>
  ): Promise<Workflow> {
    // Add trigger
    const triggerName = await this.addNode(trigger.type, trigger.parameters || {});

    // Add condition node
    const conditionName = await this.addNode(condition.type, condition.parameters || {});
    this.connect(triggerName, conditionName);

    // Build true branch
    let previousTrue: string = conditionName;
    for (const nodeSpec of trueBranch) {
      const nodeName = await this.addNode(nodeSpec.type, nodeSpec.parameters || {}, {
        position: [this.xPosition, this.yPosition + 150],
      });
      this.connect(previousTrue, nodeName, 'main', 0); // True output (index 0)
      previousTrue = nodeName;
      this.xPosition += 200;
    }

    // Reset position for false branch
    this.xPosition = 650;
    this.yPosition += 150;

    // Build false branch
    let previousFalse: string = conditionName;
    for (const nodeSpec of falseBranch) {
      const nodeName = await this.addNode(nodeSpec.type, nodeSpec.parameters || {}, {
        position: [this.xPosition, this.yPosition + 150],
      });
      this.connect(previousFalse, nodeName, 'main', 1); // False output (index 1)
      previousFalse = nodeName;
      this.xPosition += 200;
    }

    return this.getWorkflow();
  }

  /**
   * Build an AI Agent workflow
   */
  async buildAIAgent(options: {
    modelType: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama';
    tools: string[];
    memory?: boolean;
    trigger?: { type: string; parameters?: Record<string, any> };
  }): Promise<Workflow> {
    // Add trigger
    const triggerType = options.trigger?.type || 'n8n-nodes-base.manualTrigger';
    const triggerName = await this.addNode(triggerType, options.trigger?.parameters || {});

    // Add AI Agent
    const agentName = await this.addNode('@n8n/n8n-nodes-langchain.agent', {
      promptType: 'define',
      text: '={{ $json.input }}',
    }, {
      position: [450, 300],
    });

    // Connect trigger to agent
    this.connect(triggerName, agentName);

    // Add language model
    const modelTypeMap = {
      openai: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      anthropic: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
      gemini: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
      groq: '@n8n/n8n-nodes-langchain.lmChatGroq',
      ollama: '@n8n/n8n-nodes-langchain.lmChatOllama',
    };

    const modelName = await this.addNode(modelTypeMap[options.modelType], {
      options: {},
    }, {
      position: [250, 600], // Below-left of agent
    });

    // Connect model to agent
    this.connect(modelName, agentName, 'ai_languageModel');

    // Add memory if requested
    if (options.memory !== false) {
      const memoryName = await this.addNode('@n8n/n8n-nodes-langchain.memoryBufferWindow', {
        sessionIdType: 'customKey',
        sessionKey: '={{ $json.sessionId }}',
      }, {
        position: [650, 600], // Below-right of agent
      });

      this.connect(memoryName, agentName, 'ai_memory');
    }

    // Add tools
    const toolsStartX = 450 - (Math.floor(options.tools.length / 2) * 200);
    for (let index = 0; index < options.tools.length; index++) {
      const toolType = options.tools[index];
      const toolName = await this.addNode(toolType, {}, {
        position: [toolsStartX + (index * 200), 600],
      });

      this.connect(toolName, agentName, 'ai_tool');
    }

    return this.getWorkflow();
  }

  /**
   * Get the current workflow
   */
  getWorkflow(): Workflow {
    return { ...this.workflow };
  }

  /**
   * Generate a unique node name
   */
  private generateNodeName(template: NodeTemplate): string {
    this.nodeCounter++;
    return template.displayName || `Node ${this.nodeCounter}`;
  }

  /**
   * Get next position for a node
   */
  private getNextPosition(): [number, number] {
    const position: [number, number] = [this.xPosition, this.yPosition];
    this.xPosition += 200;
    return position;
  }

  /**
   * Get placeholder credentials for a node
   */
  private getPlaceholderCredentials(template: NodeTemplate): Record<string, any> {
    if (!template.credentialType) return {};

    return {
      [template.credentialType]: {
        id: `placeholder-${template.credentialType}`,
        name: `${template.displayName} account`,
      },
    };
  }
}

/**
 * Quick workflow generation functions
 */

export async function generateWorkflow(
  description: string,
  options: GeneratorOptions = {}
): Promise<Workflow> {
  const generator = new WorkflowGenerator(options.name || 'Generated Workflow');

  // Parse description and determine pattern
  const pattern = options.pattern || detectPattern(description);

  switch (pattern) {
    case 'ai-agent':
      return await buildAIAgentFromDescription(description, generator);
    case 'conditional':
      return await buildConditionalFromDescription(description, generator);
    case 'linear':
    default:
      return await buildLinearFromDescription(description, generator);
  }
}

function detectPattern(description: string): GeneratorOptions['pattern'] {
  const lower = description.toLowerCase();

  // Only treat as AI agent if explicitly mentioned, not just any AI-related words
  if ((lower.includes('ai agent') || lower.includes('llm') || lower.includes('chatbot')) &&
      !lower.includes('gmail') && !lower.includes('slack')) {
    return 'ai-agent';
  }

  if (lower.includes('if') || lower.includes('condition') || lower.includes('when')) {
    return 'conditional';
  }

  return 'linear';
}

async function buildAIAgentFromDescription(description: string, generator: WorkflowGenerator): Promise<Workflow> {
  // Detect model type
  const lower = description.toLowerCase();
  let modelType: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' = 'openai';

  if (lower.includes('anthropic') || lower.includes('claude')) modelType = 'anthropic';
  else if (lower.includes('gemini') || lower.includes('google')) modelType = 'gemini';
  else if (lower.includes('groq')) modelType = 'groq';
  else if (lower.includes('ollama')) modelType = 'ollama';

  // Detect tools needed
  const tools: string[] = [];
  if (lower.includes('gmail')) tools.push('n8n-nodes-base.gmailTool');
  if (lower.includes('slack')) tools.push('n8n-nodes-base.slackTool');
  if (lower.includes('sheets') || lower.includes('google sheets')) tools.push('n8n-nodes-base.googleSheetsTool');
  if (lower.includes('http') || lower.includes('api')) tools.push('n8n-nodes-base.httpRequestTool');
  if (lower.includes('calculator')) tools.push('@n8n/n8n-nodes-langchain.toolCalculator');
  if (lower.includes('code')) tools.push('@n8n/n8n-nodes-langchain.toolCode');

  // Default to calculator if no specific tools detected
  if (tools.length === 0) {
    tools.push('@n8n/n8n-nodes-langchain.toolCalculator');
  }

  return await generator.buildAIAgent({
    modelType,
    tools,
    memory: true,
  });
}

async function buildConditionalFromDescription(description: string, generator: WorkflowGenerator): Promise<Workflow> {
  // Simple conditional workflow
  return await generator.buildConditional(
    { type: 'n8n-nodes-base.manualTrigger' },
    { type: 'n8n-nodes-base.if', parameters: { conditions: { string: [] } } },
    [{ type: 'n8n-nodes-base.set', parameters: { values: { string: [{ name: 'result', value: 'true' }] } } }],
    [{ type: 'n8n-nodes-base.set', parameters: { values: { string: [{ name: 'result', value: 'false' }] } } }]
  );
}

async function buildLinearFromDescription(description: string, generator: WorkflowGenerator): Promise<Workflow> {
  const nodes: Array<{ type: string; parameters?: INodeParameters }> = [];
  const lower = description.toLowerCase();

  // Choose trigger based on keywords
  let triggerType = 'n8n-nodes-base.manualTrigger';
  if (lower.includes('webhook') || lower.includes('http') || lower.includes('api')) {
    triggerType = 'n8n-nodes-base.webhook';
  } else if (lower.includes('schedule') || lower.includes('cron') || lower.includes('daily')) {
    triggerType = 'n8n-nodes-base.scheduleTrigger';
  }

  nodes.push({ type: triggerType });

  // Detect workflow patterns and add appropriate nodes

  // Webhook workflows - calculator, API, form submission
  if (triggerType === 'n8n-nodes-base.webhook') {
    // Add code node for processing if calculator/math is mentioned
    if (lower.includes('calculator') || lower.includes('calculate') || lower.includes('math')) {
      nodes.push({ type: 'n8n-nodes-base.code' });
    }
    // Add HTTP request if calling external API
    else if (lower.includes('call api') || lower.includes('fetch') || lower.includes('request')) {
      nodes.push({ type: 'n8n-nodes-base.httpRequest' });
    }
    // Generic data processing
    else if (lower.includes('process') || lower.includes('transform')) {
      nodes.push({ type: 'n8n-nodes-base.code' });
    }

    // Always end with respond to webhook for webhook workflows
    nodes.push({ type: 'n8n-nodes-base.respondToWebhook' });
  }
  // Scheduled workflows
  else if (triggerType === 'n8n-nodes-base.scheduleTrigger') {
    // Add data fetching
    if (lower.includes('gmail') || lower.includes('email')) {
      nodes.push({ type: 'n8n-nodes-base.gmail' });
    } else if (lower.includes('sheets') || lower.includes('google sheets')) {
      nodes.push({ type: 'n8n-nodes-base.googleSheets' });
    } else if (lower.includes('http') || lower.includes('api')) {
      nodes.push({ type: 'n8n-nodes-base.httpRequest' });
    }

    // Add notification/output
    if (lower.includes('slack')) {
      nodes.push({ type: 'n8n-nodes-base.slack' });
    } else if (lower.includes('email') && !lower.includes('gmail')) {
      nodes.push({ type: 'n8n-nodes-base.sendEmail' });
    }
  }
  // Manual workflows
  else {
    // Detect actions needed
    if (lower.includes('gmail')) {
      nodes.push({ type: 'n8n-nodes-base.gmail' });
    }

    if (lower.includes('slack')) {
      nodes.push({ type: 'n8n-nodes-base.slack' });
    }

    if (lower.includes('sheets') || lower.includes('google sheets')) {
      nodes.push({ type: 'n8n-nodes-base.googleSheets' });
    }

    if (lower.includes('http') || lower.includes('api') || lower.includes('request')) {
      nodes.push({ type: 'n8n-nodes-base.httpRequest' });
    }

    if (lower.includes('code') || lower.includes('script') || lower.includes('javascript')) {
      nodes.push({ type: 'n8n-nodes-base.code' });
    }

    // If still only trigger, add a processing node
    if (nodes.length === 1) {
      if (lower.includes('data') || lower.includes('process')) {
        nodes.push({ type: 'n8n-nodes-base.code' });
      } else {
        nodes.push({ type: 'n8n-nodes-base.set' });
      }
    }
  }

  // Build the workflow with context
  let previousNode: string | undefined = undefined;

  for (let i = 0; i < nodes.length; i++) {
    const nodeSpec = nodes[i];
    const nodeName = await generator.addNode(
      nodeSpec.type,
      nodeSpec.parameters || {},
      { description }
    );

    if (previousNode) {
      generator.connect(previousNode, nodeName);
    }

    previousNode = nodeName;
  }

  return generator.getWorkflow();
}
