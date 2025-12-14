/**
 * Performance Analyzer - Workflow Performance Analysis
 *
 * Analyze workflows for performance bottlenecks, resource usage,
 * and optimization opportunities.
 */

import type { Workflow } from './generator.js';

export interface PerformanceMetrics {
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  estimatedExecutionTime: number;
  nodeCount: number;
  connectionCount: number;
  depth: number;
  parallelPaths: number;
  bottlenecks: BottleneckInfo[];
  recommendations: string[];
}

export interface BottleneckInfo {
  type: 'sequential-dependency' | 'excessive-branching' | 'heavy-computation' | 'external-api';
  location: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Analyze workflow performance
 */
export function analyzePerformance(workflow: Workflow): PerformanceMetrics {
  const nodeCount = workflow.nodes.length;
  const connectionCount = Object.values(workflow.connections)
    .reduce((total: number, conns: any) => {
      return total + Object.values(conns)
        .reduce((sum: number, arr: any) => sum + (arr?.reduce?.((s: number, a: any) => s + (a?.length || 0), 0) || 0), 0);
    }, 0);

  // Calculate workflow depth (longest path)
  const depth = calculateWorkflowDepth(workflow);

  // Count parallel paths
  const parallelPaths = countParallelPaths(workflow);

  // Detect bottlenecks
  const bottlenecks = detectBottlenecks(workflow);

  // Estimate execution time
  const estimatedExecutionTime = estimateExecutionTime(workflow);

  // Determine complexity
  const complexity = calculateComplexity(nodeCount, depth, parallelPaths);

  // Generate recommendations
  const recommendations = generatePerformanceRecommendations(
    workflow,
    nodeCount,
    depth,
    parallelPaths,
    bottlenecks
  );

  return {
    complexity,
    estimatedExecutionTime,
    nodeCount,
    connectionCount,
    depth,
    parallelPaths,
    bottlenecks,
    recommendations,
  };
}

/**
 * Calculate maximum workflow depth (longest execution path)
 */
function calculateWorkflowDepth(workflow: Workflow): number {
  const trigger = workflow.nodes.find(n =>
    n.type.includes('Trigger') || n.type.includes('trigger')
  );

  if (!trigger) return 0;

  const depths = new Map<string, number>();
  depths.set(trigger.name, 0);

  const queue: string[] = [trigger.name];
  let maxDepth = 0;

  while (queue.length > 0) {
    const currentNode = queue.shift()!;
    const currentDepth = depths.get(currentNode) || 0;

    const connections = workflow.connections[currentNode];
    if (!connections) continue;

    Object.values(connections as any).forEach((connArray: any) => {
      connArray?.forEach?.((conns: any) => {
        conns?.forEach?.((conn: any) => {
          const nextDepth = currentDepth + 1;
          const existingDepth = depths.get(conn.node) || 0;

          if (nextDepth > existingDepth) {
            depths.set(conn.node, nextDepth);
            maxDepth = Math.max(maxDepth, nextDepth);
            if (!queue.includes(conn.node)) {
              queue.push(conn.node);
            }
          }
        });
      });
    });
  }

  return maxDepth;
}

/**
 * Count parallel execution paths
 */
function countParallelPaths(workflow: Workflow): number {
  let maxParallel = 0;

  Object.values(workflow.connections).forEach(connections => {
    Object.values(connections as any).forEach((connArray: any) => {
      const pathCount = connArray?.reduce?.((sum: number, conns: any) => sum + (conns?.length || 0), 0) || 0;
      maxParallel = Math.max(maxParallel, pathCount);
    });
  });

  return maxParallel;
}

/**
 * Detect performance bottlenecks
 */
function detectBottlenecks(workflow: Workflow): BottleneckInfo[] {
  const bottlenecks: BottleneckInfo[] = [];

  workflow.nodes.forEach(node => {
    // Check for heavy computation nodes
    if (node.type === 'n8n-nodes-base.code') {
      bottlenecks.push({
        type: 'heavy-computation',
        location: node.name,
        impact: 'medium',
        description: 'Code node may perform heavy computation',
      });
    }

    // Check for API calls
    if (node.type === 'n8n-nodes-base.httpRequest' ||
        node.type.includes('api') ||
        node.type.includes('Api')) {
      bottlenecks.push({
        type: 'external-api',
        location: node.name,
        impact: 'high',
        description: 'External API call may cause latency',
      });
    }

    // Check for sequential dependencies
    const connections = workflow.connections[node.name];
    if (connections && (connections as any).main) {
      const outputCount = (connections as any).main?.reduce?.((sum: number, conns: any) => sum + (conns?.length || 0), 0) || 0;
      if (outputCount > 3) {
        bottlenecks.push({
          type: 'excessive-branching',
          location: node.name,
          impact: 'medium',
          description: `Node fans out to ${outputCount} paths`,
        });
      }
    }
  });

  // Check for long sequential chains
  const depth = calculateWorkflowDepth(workflow);
  if (depth > 10) {
    bottlenecks.push({
      type: 'sequential-dependency',
      location: 'Overall workflow',
      impact: 'high',
      description: `Long sequential chain of ${depth} nodes`,
    });
  }

  return bottlenecks;
}

/**
 * Estimate workflow execution time
 */
function estimateExecutionTime(workflow: Workflow): number {
  let totalTime = 0;

  workflow.nodes.forEach(node => {
    // Base time per node
    let nodeTime = 100; // 100ms base

    // Adjust based on node type
    if (node.type === 'n8n-nodes-base.httpRequest') {
      nodeTime += 500; // +500ms for API calls
    }

    if (node.type === 'n8n-nodes-base.code') {
      nodeTime += 200; // +200ms for code execution
    }

    if (node.type.includes('database') || node.type.includes('postgres') || node.type.includes('mysql')) {
      nodeTime += 300; // +300ms for database queries
    }

    if (node.type.includes('agent') || node.type.includes('langchain')) {
      nodeTime += 2000; // +2s for AI operations
    }

    totalTime += nodeTime;
  });

  return totalTime;
}

/**
 * Calculate workflow complexity
 */
function calculateComplexity(
  nodeCount: number,
  depth: number,
  parallelPaths: number
): 'low' | 'medium' | 'high' | 'very-high' {
  const score = nodeCount + (depth * 2) + (parallelPaths * 3);

  if (score < 10) return 'low';
  if (score < 25) return 'medium';
  if (score < 50) return 'high';
  return 'very-high';
}

/**
 * Generate performance recommendations
 */
function generatePerformanceRecommendations(
  workflow: Workflow,
  nodeCount: number,
  depth: number,
  parallelPaths: number,
  bottlenecks: BottleneckInfo[]
): string[] {
  const recommendations: string[] = [];

  // Check for excessive nodes
  if (nodeCount > 20) {
    recommendations.push('Consider splitting into multiple workflows for better maintainability');
  }

  // Check for deep sequential chains
  if (depth > 10) {
    recommendations.push('Long sequential chain detected - consider parallel processing where possible');
  }

  // Check for lack of parallelization
  if (nodeCount > 5 && parallelPaths < 2) {
    recommendations.push('Workflow runs sequentially - identify opportunities for parallel execution');
  }

  // API-specific recommendations
  const apiNodes = workflow.nodes.filter(n =>
    n.type === 'n8n-nodes-base.httpRequest' || n.type.includes('api')
  );

  if (apiNodes.length > 3) {
    recommendations.push('Multiple API calls detected - consider batching or caching to reduce latency');
  }

  // Database-specific recommendations
  const dbNodes = workflow.nodes.filter(n =>
    n.type.includes('postgres') || n.type.includes('mysql') || n.type.includes('database')
  );

  if (dbNodes.length > 2) {
    recommendations.push('Multiple database queries - optimize with joins or batch operations');
  }

  // Error handling recommendations
  const hasErrorHandling = workflow.nodes.some(n =>
    n.type.includes('errorTrigger') || n.type.includes('stopAndError')
  );

  if (!hasErrorHandling && nodeCount > 5) {
    recommendations.push('Add error handling to prevent workflow failures from cascading');
  }

  // Bottleneck-specific recommendations
  bottlenecks.forEach(bottleneck => {
    if (bottleneck.impact === 'high') {
      if (bottleneck.type === 'external-api') {
        recommendations.push(`Optimize ${bottleneck.location} - add caching or retry logic`);
      }
      if (bottleneck.type === 'sequential-dependency') {
        recommendations.push('Break up long sequential chains with parallel Split/Merge patterns');
      }
    }
  });

  return [...new Set(recommendations)]; // Remove duplicates
}

/**
 * Calculate resource usage estimate
 */
export function estimateResourceUsage(workflow: Workflow): {
  memory: 'low' | 'medium' | 'high';
  cpu: 'low' | 'medium' | 'high';
  network: 'low' | 'medium' | 'high';
} {
  let memoryScore = 0;
  let cpuScore = 0;
  let networkScore = 0;

  workflow.nodes.forEach(node => {
    // Memory-intensive nodes
    if (node.type.includes('aggregate') || node.type.includes('merge')) {
      memoryScore += 2;
    }

    if (node.type.includes('agent') || node.type.includes('langchain')) {
      memoryScore += 3;
    }

    // CPU-intensive nodes
    if (node.type === 'n8n-nodes-base.code') {
      cpuScore += 2;
    }

    if (node.type.includes('crypto') || node.type.includes('compress')) {
      cpuScore += 3;
    }

    // Network-intensive nodes
    if (node.type === 'n8n-nodes-base.httpRequest') {
      networkScore += 2;
    }

    if (node.type.includes('api') || node.type.includes('Api')) {
      networkScore += 2;
    }
  });

  return {
    memory: memoryScore < 5 ? 'low' : memoryScore < 10 ? 'medium' : 'high',
    cpu: cpuScore < 5 ? 'low' : cpuScore < 10 ? 'medium' : 'high',
    network: networkScore < 5 ? 'low' : networkScore < 10 ? 'medium' : 'high',
  };
}
