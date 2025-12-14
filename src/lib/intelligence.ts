/**
 * Intelligence Engine - AI-Driven Workflow Analysis and Suggestions
 *
 * Provides intelligent pattern recognition, architecture recommendations,
 * and context-aware suggestions for workflow building.
 */

import type { Workflow, WorkflowNode } from './generator.js';
import { searchNodes, getNodesByCategory } from './nodes.js';

export interface ArchitecturePattern {
  name: string;
  description: string;
  useCases: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  requiredNodes: string[];
  optionalNodes: string[];
}

export interface WorkflowInsight {
  type: 'info' | 'warning' | 'suggestion' | 'optimization';
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestedFix?: string;
}

/**
 * Architecture Patterns
 */
export const ARCHITECTURE_PATTERNS: Record<string, ArchitecturePattern> = {
  linear: {
    name: 'Linear Pipeline',
    description: 'Simple A -> B -> C flow for straightforward data processing',
    useCases: ['Data transformation', 'API integration', 'Simple automation'],
    complexity: 'simple',
    requiredNodes: ['trigger', 'action'],
    optionalNodes: ['error-handler'],
  },

  conditional: {
    name: 'Conditional Branching',
    description: 'IF/THEN/ELSE logic for decision-based routing',
    useCases: ['Content filtering', 'Conditional notifications', 'Smart routing'],
    complexity: 'moderate',
    requiredNodes: ['trigger', 'if', 'action'],
    optionalNodes: ['merge', 'error-handler'],
  },

  parallel: {
    name: 'Parallel Processing',
    description: 'Split work across multiple parallel paths and merge results',
    useCases: ['Multi-API calls', 'Concurrent operations', 'Fan-out/fan-in'],
    complexity: 'moderate',
    requiredNodes: ['trigger', 'split', 'merge'],
    optionalNodes: ['error-handler'],
  },

  aiAgent: {
    name: 'AI Agent',
    description: 'Autonomous agent with tools, memory, and decision-making',
    useCases: ['Customer support', 'Data analysis', 'Task automation'],
    complexity: 'complex',
    requiredNodes: ['trigger', 'agent', 'model'],
    optionalNodes: ['tools', 'memory', 'output-parser'],
  },

  eventDriven: {
    name: 'Event-Driven',
    description: 'React to external events with webhook/trigger handlers',
    useCases: ['Real-time alerts', 'Webhook processing', 'Event streaming'],
    complexity: 'moderate',
    requiredNodes: ['webhook', 'action'],
    optionalNodes: ['filter', 'error-handler'],
  },

  dataTransformation: {
    name: 'ETL Pipeline',
    description: 'Extract, Transform, Load data processing',
    useCases: ['Data migration', 'Report generation', 'Database sync'],
    complexity: 'moderate',
    requiredNodes: ['trigger', 'extract', 'transform', 'load'],
    optionalNodes: ['validation', 'error-handler'],
  },

  orchestration: {
    name: 'Multi-Agent Orchestration',
    description: 'Coordinate multiple AI agents for complex tasks',
    useCases: ['Complex reasoning', 'Multi-step analysis', 'Collaborative agents'],
    complexity: 'complex',
    requiredNodes: ['trigger', 'router', 'multiple-agents', 'aggregator'],
    optionalNodes: ['memory', 'tools'],
  },
};

/**
 * Suggest architecture pattern based on description
 */
export function suggestArchitecture(description: string): {
  recommended: ArchitecturePattern;
  alternatives: ArchitecturePattern[];
  confidence: number;
} {
  const lower = description.toLowerCase();
  const scores: Record<string, number> = {};

  // Score each pattern based on keywords
  for (const [key, pattern] of Object.entries(ARCHITECTURE_PATTERNS)) {
    let score = 0;

    // Check use cases
    pattern.useCases.forEach(useCase => {
      if (lower.includes(useCase.toLowerCase())) score += 3;
    });

    // Check pattern name/description
    if (lower.includes(pattern.name.toLowerCase())) score += 2;
    if (lower.includes(pattern.description.toLowerCase())) score += 1;

    // Specific keywords
    if (key === 'aiAgent' && (lower.includes('ai') || lower.includes('agent') || lower.includes('llm'))) score += 5;
    if (key === 'conditional' && (lower.includes('if') || lower.includes('condition') || lower.includes('when'))) score += 4;
    if (key === 'parallel' && (lower.includes('parallel') || lower.includes('concurrent'))) score += 4;
    if (key === 'eventDriven' && (lower.includes('webhook') || lower.includes('event') || lower.includes('trigger'))) score += 4;
    if (key === 'dataTransformation' && (lower.includes('etl') || lower.includes('transform') || lower.includes('data'))) score += 3;

    scores[key] = score;
  }

  // Get top patterns
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => key);

  const topPattern = sorted[0] || 'linear';
  const confidence = Math.min(scores[topPattern] / 10, 1);

  return {
    recommended: ARCHITECTURE_PATTERNS[topPattern],
    alternatives: sorted.slice(1, 4).map(key => ARCHITECTURE_PATTERNS[key]),
    confidence,
  };
}

/**
 * Suggest nodes for a task
 */
export function suggestNodes(task: string): Array<{
  node: string;
  reason: string;
  confidence: number;
}> {
  const suggestions: Array<{ node: string; reason: string; confidence: number }> = [];
  const lower = task.toLowerCase();

  // Communication tools
  if (lower.includes('email') || lower.includes('gmail')) {
    suggestions.push({
      node: 'n8n-nodes-base.gmail',
      reason: 'Send and manage Gmail emails',
      confidence: 0.9,
    });
  }

  if (lower.includes('slack')) {
    suggestions.push({
      node: 'n8n-nodes-base.slack',
      reason: 'Send Slack messages',
      confidence: 0.95,
    });
  }

  if (lower.includes('telegram')) {
    suggestions.push({
      node: 'n8n-nodes-base.telegram',
      reason: 'Send Telegram messages',
      confidence: 0.9,
    });
  }

  if (lower.includes('discord')) {
    suggestions.push({
      node: 'n8n-nodes-base.discord',
      reason: 'Send Discord messages',
      confidence: 0.9,
    });
  }

  // Data storage
  if (lower.includes('sheets') || lower.includes('google sheets')) {
    suggestions.push({
      node: 'n8n-nodes-base.googleSheets',
      reason: 'Read/write Google Sheets data',
      confidence: 0.95,
    });
  }

  if (lower.includes('airtable')) {
    suggestions.push({
      node: 'n8n-nodes-base.airtable',
      reason: 'Manage Airtable records',
      confidence: 0.9,
    });
  }

  if (lower.includes('database') || lower.includes('postgres') || lower.includes('sql')) {
    suggestions.push({
      node: 'n8n-nodes-base.postgres',
      reason: 'Execute SQL queries',
      confidence: 0.8,
    });
  }

  if (lower.includes('mongodb') || lower.includes('nosql')) {
    suggestions.push({
      node: 'n8n-nodes-base.mongodb',
      reason: 'Query MongoDB database',
      confidence: 0.85,
    });
  }

  // AI/Agent nodes
  if (lower.includes('ai') || lower.includes('agent') || lower.includes('llm')) {
    suggestions.push({
      node: '@n8n/n8n-nodes-langchain.agent',
      reason: 'AI Agent with tools and memory',
      confidence: 0.95,
    });

    // Suggest model based on preference
    if (lower.includes('openai') || lower.includes('gpt')) {
      suggestions.push({
        node: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        reason: 'OpenAI language model',
        confidence: 0.9,
      });
    } else if (lower.includes('anthropic') || lower.includes('claude')) {
      suggestions.push({
        node: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
        reason: 'Claude language model',
        confidence: 0.9,
      });
    } else if (lower.includes('gemini') || lower.includes('google')) {
      suggestions.push({
        node: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
        reason: 'Google Gemini model',
        confidence: 0.9,
      });
    } else {
      // Default to OpenAI
      suggestions.push({
        node: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        reason: 'OpenAI language model (default)',
        confidence: 0.7,
      });
    }
  }

  // HTTP/API
  if (lower.includes('api') || lower.includes('http') || lower.includes('webhook')) {
    suggestions.push({
      node: 'n8n-nodes-base.httpRequest',
      reason: 'Make HTTP API requests',
      confidence: 0.85,
    });
  }

  // Code/Transform
  if (lower.includes('code') || lower.includes('javascript') || lower.includes('custom logic')) {
    suggestions.push({
      node: 'n8n-nodes-base.code',
      reason: 'Execute custom JavaScript',
      confidence: 0.8,
    });
  }

  if (lower.includes('transform') || lower.includes('modify') || lower.includes('set')) {
    suggestions.push({
      node: 'n8n-nodes-base.set',
      reason: 'Transform and set data fields',
      confidence: 0.75,
    });
  }

  // Conditional logic
  if (lower.includes('if') || lower.includes('condition') || lower.includes('when')) {
    suggestions.push({
      node: 'n8n-nodes-base.if',
      reason: 'Add conditional branching',
      confidence: 0.85,
    });
  }

  if (lower.includes('switch') || lower.includes('route')) {
    suggestions.push({
      node: 'n8n-nodes-base.switch',
      reason: 'Route to multiple branches',
      confidence: 0.8,
    });
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Analyze workflow and provide insights
 */
export function analyzeWorkflow(workflow: Workflow): WorkflowInsight[] {
  const insights: WorkflowInsight[] = [];

  // Check for missing error handling
  const hasErrorHandler = workflow.nodes.some(n =>
    n.type.includes('errorTrigger') || n.type.includes('stopAndError')
  );

  if (!hasErrorHandler && workflow.nodes.length > 3) {
    insights.push({
      type: 'suggestion',
      message: 'Consider adding error handling to make workflow more robust',
      severity: 'medium',
      suggestedFix: 'Add an Error Trigger node or Stop and Error node',
    });
  }

  // Check for AI agents without memory
  const hasAgent = workflow.nodes.some(n => n.type.includes('agent'));
  const hasMemory = workflow.nodes.some(n => n.type.includes('memory'));

  if (hasAgent && !hasMemory) {
    insights.push({
      type: 'suggestion',
      message: 'AI Agent without memory - conversations won\'t be remembered',
      severity: 'low',
      suggestedFix: 'Add a Memory node (Window Buffer, Summary, etc.)',
    });
  }

  // Check for agents without tools
  const hasTools = workflow.nodes.some(n => n.type.includes('Tool') || n.type.includes('tool'));

  if (hasAgent && !hasTools) {
    insights.push({
      type: 'warning',
      message: 'AI Agent has no tools - limited capabilities',
      severity: 'high',
      suggestedFix: 'Add at least one tool (Calculator, Code, HTTP Request, etc.)',
    });
  }

  // Check for complex workflows without split nodes
  if (workflow.nodes.length > 5 && !workflow.nodes.some(n =>
    n.type.includes('if') || n.type.includes('switch') || n.type.includes('merge')
  )) {
    insights.push({
      type: 'info',
      message: 'Linear workflow - consider adding conditional logic for flexibility',
      severity: 'low',
      suggestedFix: 'Add IF or Switch nodes for branching logic',
    });
  }

  // Check for hardcoded credentials
  const hasCredentials = workflow.nodes.some(n =>
    n.parameters && JSON.stringify(n.parameters).includes('api_key')
  );

  if (hasCredentials) {
    insights.push({
      type: 'warning',
      message: 'Possible hardcoded credentials detected',
      severity: 'high',
      suggestedFix: 'Use n8n credential system instead of hardcoding keys',
    });
  }

  // Check node positioning (too close together)
  for (let i = 0; i < workflow.nodes.length - 1; i++) {
    const node1 = workflow.nodes[i];
    const node2 = workflow.nodes[i + 1];

    const distance = Math.sqrt(
      Math.pow(node2.position[0] - node1.position[0], 2) +
      Math.pow(node2.position[1] - node1.position[1], 2)
    );

    if (distance < 150) {
      insights.push({
        type: 'info',
        message: `Nodes "${node1.name}" and "${node2.name}" are too close together`,
        severity: 'low',
        suggestedFix: 'Increase spacing between nodes for better readability',
      });
      break; // Only report once
    }
  }

  // Check for orphaned nodes (no connections)
  const connectedNodes = new Set<string>();
  Object.values(workflow.connections).forEach(nodeConnections => {
    Object.values(nodeConnections as any).forEach((connectionArray: any) => {
      connectionArray?.forEach?.((connections: any) => {
        connections?.forEach?.((conn: any) => {
          if (conn?.node) connectedNodes.add(conn.node);
        });
      });
    });
  });

  const orphanedNodes = workflow.nodes.filter(
    n => n.type !== 'n8n-nodes-base.manualTrigger' &&
      !n.type.includes('Trigger') &&
      !connectedNodes.has(n.name) &&
      !Object.keys(workflow.connections).includes(n.name)
  );

  if (orphanedNodes.length > 0) {
    insights.push({
      type: 'warning',
      message: `${orphanedNodes.length} orphaned node(s) with no connections`,
      severity: 'medium',
      suggestedFix: `Connect or remove: ${orphanedNodes.map(n => n.name).join(', ')}`,
    });
  }

  return insights;
}

/**
 * Suggest improvements for a workflow
 */
export function suggestImprovements(workflow: Workflow): Array<{
  category: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
}> {
  const improvements: Array<{
    category: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high';
  }> = [];

  const insights = analyzeWorkflow(workflow);

  // Convert insights to improvements
  insights.forEach(insight => {
    if (insight.type === 'suggestion' || insight.type === 'warning') {
      improvements.push({
        category: insight.type === 'warning' ? 'Critical' : 'Enhancement',
        suggestion: insight.message + (insight.suggestedFix ? ` (${insight.suggestedFix})` : ''),
        priority: insight.severity as any,
      });
    }
  });

  // Performance improvements
  if (workflow.nodes.length > 10) {
    improvements.push({
      category: 'Performance',
      suggestion: 'Consider splitting into multiple workflows for better performance',
      priority: 'medium',
    });
  }

  // Naming improvements
  const hasGenericNames = workflow.nodes.some(n =>
    n.name.includes('Node ') || n.name === 'HTTP Request' || n.name === 'Code'
  );

  if (hasGenericNames) {
    improvements.push({
      category: 'Maintainability',
      suggestion: 'Use descriptive names for nodes to improve workflow readability',
      priority: 'low',
    });
  }

  return improvements;
}

/**
 * Explain what a workflow does in natural language
 */
export function explainWorkflow(workflow: Workflow): string {
  let explanation = `# ${workflow.name}\n\n`;

  // Identify pattern
  const hasAgent = workflow.nodes.some(n => n.type.includes('agent'));
  const hasIf = workflow.nodes.some(n => n.type.includes('if'));
  const hasMerge = workflow.nodes.some(n => n.type.includes('merge'));

  if (hasAgent) {
    explanation += 'This is an **AI Agent workflow** that:\n\n';
  } else if (hasIf) {
    explanation += 'This is a **conditional workflow** that:\n\n';
  } else if (hasMerge) {
    explanation += 'This is a **parallel processing workflow** that:\n\n';
  } else {
    explanation += 'This is a **linear workflow** that:\n\n';
  }

  // Describe trigger
  const trigger = workflow.nodes.find(n =>
    n.type.includes('Trigger') || n.type.includes('trigger')
  );

  if (trigger) {
    if (trigger.type.includes('manual')) {
      explanation += '1. Starts when manually triggered\n';
    } else if (trigger.type.includes('webhook')) {
      explanation += '1. Starts when a webhook is called\n';
    } else if (trigger.type.includes('schedule')) {
      explanation += '1. Runs on a schedule\n';
    } else if (trigger.type.includes('email')) {
      explanation += '1. Triggers when new email arrives\n';
    } else {
      explanation += '1. Starts automatically\n';
    }
  }

  // Describe key actions
  const actions = workflow.nodes.filter(n =>
    !n.type.includes('Trigger') &&
    !n.type.includes('trigger') &&
    !n.type.includes('memory') &&
    !n.type.includes('model')
  );

  let step = 2;
  actions.slice(0, 5).forEach(node => {
    const action = node.type.split('.').pop() || node.type;
    explanation += `${step}. ${node.name} (${action})\n`;
    step++;
  });

  if (actions.length > 5) {
    explanation += `... and ${actions.length - 5} more steps\n`;
  }

  explanation += `\n**Total nodes:** ${workflow.nodes.length}\n`;
  explanation += `**Connections:** ${Object.keys(workflow.connections).length}\n`;

  return explanation;
}
