/**
 * Security Scanner - Vulnerability Detection
 *
 * Scan workflows for security issues like credential leaks,
 * unsafe code execution, and potential vulnerabilities.
 */

import type { Workflow} from './generator.js';

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  node?: string;
  recommendation: string;
}

/**
 * Scan workflow for security issues
 */
export function scanSecurity(workflow: Workflow): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  workflow.nodes.forEach(node => {
    // Check for hardcoded credentials
    const paramStr = JSON.stringify(node.parameters || {});

    if (paramStr.match(/api[_-]?key['"]?\s*:\s*['"]/i)) {
      issues.push({
        severity: 'critical',
        type: 'credential-leak',
        message: 'Possible hardcoded API key detected',
        node: node.name,
        recommendation: 'Use n8n credential system instead of hardcoding keys',
      });
    }

    if (paramStr.match(/password['"]?\s*:\s*['"]/i)) {
      issues.push({
        severity: 'critical',
        type: 'credential-leak',
        message: 'Possible hardcoded password detected',
        node: node.name,
        recommendation: 'Use n8n credential system for passwords',
      });
    }

    if (paramStr.match(/token['"]?\s*:\s*['"]/i)) {
      issues.push({
        severity: 'high',
        type: 'credential-leak',
        message: 'Possible hardcoded token detected',
        node: node.name,
        recommendation: 'Store tokens in n8n credentials',
      });
    }

    // Check for unsafe code execution
    if (node.type === 'n8n-nodes-base.code') {
      const code = node.parameters?.jsCode;

      if (typeof code === 'string' && code.includes('eval(')) {
        issues.push({
          severity: 'critical',
          type: 'unsafe-code',
          message: 'Use of eval() detected - potential code injection',
          node: node.name,
          recommendation: 'Avoid eval() - use safe alternatives',
        });
      }

      if (typeof code === 'string' && code.includes('Function(')) {
        issues.push({
          severity: 'high',
          type: 'unsafe-code',
          message: 'Use of Function() constructor - potential code injection',
          node: node.name,
          recommendation: 'Avoid dynamic code generation',
        });
      }

      if (typeof code === 'string' && (code.includes('child_process') || code.includes('exec'))) {
        issues.push({
          severity: 'critical',
          type: 'unsafe-code',
          message: 'Execution of system commands detected',
          node: node.name,
          recommendation: 'Avoid system command execution - use n8n nodes instead',
        });
      }
    }

    // Check for HTTP nodes without authentication
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const auth = node.parameters?.authentication;
      const url = node.parameters?.url;

      if (!auth || auth === 'none') {
        if (typeof url === 'string' && (url.includes('api') || url.includes('webhook'))) {
          issues.push({
            severity: 'medium',
            type: 'missing-auth',
            message: 'HTTP request to API endpoint without authentication',
            node: node.name,
            recommendation: 'Add authentication to protect API calls',
          });
        }
      }

      // Check for HTTP instead of HTTPS
      if (typeof url === 'string' && url.startsWith('http://') && !url.includes('localhost')) {
        issues.push({
          severity: 'medium',
          type: 'insecure-protocol',
          message: 'Using HTTP instead of HTTPS',
          node: node.name,
          recommendation: 'Use HTTPS for secure communication',
        });
      }
    }

    // Check for webhook nodes without validation
    if (node.type === 'n8n-nodes-base.webhook') {
      const options = node.parameters?.options as any;
      const hasValidation = options?.validation;

      if (!hasValidation) {
        issues.push({
          severity: 'high',
          type: 'missing-validation',
          message: 'Webhook without input validation',
          node: node.name,
          recommendation: 'Add validation to prevent malicious input',
        });
      }
    }

    // Check for SQL injection vulnerabilities
    if (node.type.includes('postgres') || node.type.includes('mysql')) {
      const query = node.parameters?.query;

      if (typeof query === 'string' && (query.includes('${') || query.includes('${{'))) {
        issues.push({
          severity: 'critical',
          type: 'sql-injection',
          message: 'Potential SQL injection - using string interpolation in query',
          node: node.name,
          recommendation: 'Use parameterized queries instead',
        });
      }
    }
  });

  return issues.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Check if workflow handles sensitive data
 */
export function detectSensitiveData(workflow: Workflow): string[] {
  const sensitiveTypes: string[] = [];

  workflow.nodes.forEach(node => {
    const paramStr = JSON.stringify(node.parameters || {}).toLowerCase();

    if (paramStr.includes('email') || node.type.includes('email') || node.type.includes('gmail')) {
      sensitiveTypes.push('Email addresses');
    }

    if (paramStr.includes('phone') || paramStr.includes('mobile')) {
      sensitiveTypes.push('Phone numbers');
    }

    if (paramStr.includes('credit') || paramStr.includes('card') || paramStr.includes('payment')) {
      sensitiveTypes.push('Payment information');
    }

    if (paramStr.includes('ssn') || paramStr.includes('social security')) {
      sensitiveTypes.push('SSN/Government IDs');
    }

    if (paramStr.includes('health') || paramStr.includes('medical')) {
      sensitiveTypes.push('Health/Medical data');
    }
  });

  return [...new Set(sensitiveTypes)];
}
