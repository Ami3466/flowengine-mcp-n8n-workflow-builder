/**
 * Workflow Tester - Dry-run and Simulation
 *
 * Test workflows without executing them, with mock data injection
 * and validation of execution paths.
 */

import type { Workflow } from './generator.js';

export interface TestResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  executionPath: string[];
  estimatedDuration?: number;
}

/**
 * Perform dry-run test of workflow
 */
export function testWorkflow(workflow: Workflow, mockData?: Record<string, any>): TestResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const executionPath: string[] = [];

  // Find trigger node
  const trigger = workflow.nodes.find(n =>
    n.type.includes('Trigger') || n.type.includes('trigger')
  );

  if (!trigger) {
    errors.push('No trigger node found - workflow cannot start');
    return { success: false, errors, warnings, executionPath };
  }

  executionPath.push(trigger.name);

  // Trace execution path
  let currentNode = trigger.name;
  const visited = new Set<string>();
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (currentNode && iterations < maxIterations) {
    if (visited.has(currentNode)) {
      warnings.push(`Potential infinite loop detected at ${currentNode}`);
      break;
    }

    visited.add(currentNode);
    iterations++;

    // Find next nodes
    const connections = workflow.connections[currentNode];
    if (!connections || !connections.main || connections.main.length === 0) {
      break; // End of workflow
    }

    // Take first path (main output 0)
    const nextConnections = connections.main[0];
    if (!nextConnections || nextConnections.length === 0) {
      break;
    }

    currentNode = nextConnections[0].node;
    executionPath.push(currentNode);
  }

  // Check for orphaned nodes (not in execution path)
  const orphaned = workflow.nodes.filter(n =>
    !n.type.includes('Trigger') &&
    !n.type.includes('trigger') &&
    !executionPath.includes(n.name)
  );

  if (orphaned.length > 0) {
    warnings.push(`${orphaned.length} node(s) not in execution path: ${orphaned.map(n => n.name).join(', ')}`);
  }

  // Validate required credentials
  workflow.nodes.forEach(node => {
    if (node.credentials && Object.keys(node.credentials).length > 0) {
      Object.keys(node.credentials).forEach(credType => {
        const cred = (node.credentials as any)?.[credType];
        if (cred?.id?.includes('placeholder')) {
          errors.push(`Node "${node.name}" requires ${credType} credentials`);
        }
      });
    }
  });

  // Estimate duration (rough calculation)
  const estimatedDuration = executionPath.length * 1000; // 1 second per node

  return {
    success: errors.length === 0,
    errors,
    warnings,
    executionPath,
    estimatedDuration,
  };
}

/**
 * Validate workflow can execute end-to-end
 */
export function validateExecutionPath(workflow: Workflow): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check all connections point to valid nodes
  Object.entries(workflow.connections).forEach(([sourceName, connections]) => {
    const sourceNode = workflow.nodes.find(n => n.name === sourceName);
    if (!sourceNode) {
      issues.push(`Connection source "${sourceName}" not found in nodes`);
    }

    Object.values(connections as any).forEach((connArray: any) => {
      connArray?.forEach?.((conns: any) => {
        conns?.forEach?.((conn: any) => {
          const targetNode = workflow.nodes.find(n => n.name === conn?.node);
          if (!targetNode && conn?.node) {
            issues.push(`Connection target "${conn.node}" not found in nodes`);
          }
        });
      });
    });
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}
