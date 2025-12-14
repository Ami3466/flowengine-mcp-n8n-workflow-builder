/**
 * Advanced JSON Parser - Reconstruction and Recovery
 *
 * Handles truncated, malformed, and incomplete JSON with intelligent
 * reconstruction and fuzzy parsing capabilities.
 */

export interface ParseResult {
  success: boolean;
  workflow?: any;
  error?: string;
  recovered?: boolean;
  completionSuggestions?: string[];
}

/**
 * Parse JSON with advanced error recovery
 */
export function parseWorkflowJSON(jsonString: string): ParseResult {
  // First, try standard parsing
  try {
    const workflow = JSON.parse(jsonString);
    return {
      success: true,
      workflow,
      recovered: false,
    };
  } catch (error) {
    // Try recovery techniques
    return recoverJSON(jsonString, error as Error);
  }
}

/**
 * Attempt to recover malformed JSON
 */
function recoverJSON(jsonString: string, originalError: Error): ParseResult {
  const techniques = [
    tryFixTrailingComma,
    tryFixMissingClosingBraces,
    tryFixTruncatedString,
    tryFixMissingQuotes,
    tryParsePartial,
  ];

  for (const technique of techniques) {
    try {
      const fixed = technique(jsonString);
      if (fixed !== jsonString) {
        const workflow = JSON.parse(fixed);
        return {
          success: true,
          workflow,
          recovered: true,
        };
      }
    } catch {
      // Continue to next technique
    }
  }

  return {
    success: false,
    error: originalError.message,
    completionSuggestions: generateCompletionSuggestions(jsonString),
  };
}

/**
 * Fix trailing commas
 */
function tryFixTrailingComma(json: string): string {
  // Remove trailing commas before closing brackets/braces
  return json
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/,(\s*$)/g, '');
}

/**
 * Fix missing closing braces/brackets
 */
function tryFixMissingClosingBraces(json: string): string {
  let fixed = json.trim();

  // Count opening and closing braces
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;

  // Add missing closing braces
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }

  // Add missing closing brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }

  return fixed;
}

/**
 * Fix truncated strings
 */
function tryFixTruncatedString(json: string): string {
  let fixed = json.trim();

  // If ends mid-string, close it
  const lastQuote = fixed.lastIndexOf('"');
  const afterQuote = fixed.substring(lastQuote + 1);

  // If there's content after the last quote without a closing quote
  if (afterQuote && !afterQuote.includes('"')) {
    fixed = fixed.substring(0, lastQuote + 1) + '"';
  }

  return fixed;
}

/**
 * Fix missing quotes around keys
 */
function tryFixMissingQuotes(json: string): string {
  // Add quotes around unquoted keys
  return json.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
}

/**
 * Try to parse partial workflow
 */
function tryParsePartial(json: string): string {
  let fixed = json.trim();

  // If it looks like the start of a workflow but incomplete
  if (fixed.startsWith('{') && !fixed.endsWith('}')) {
    // Try to find the last complete field
    const lastComma = fixed.lastIndexOf(',');
    const lastColon = fixed.lastIndexOf(':');

    if (lastColon > lastComma) {
      // Incomplete value, remove it
      fixed = fixed.substring(0, lastComma > 0 ? lastComma : fixed.lastIndexOf('{'));
    }

    // Close remaining structures
    fixed = tryFixMissingClosingBraces(fixed);
  }

  return fixed;
}

/**
 * Generate suggestions for completing the JSON
 */
function generateCompletionSuggestions(json: string): string[] {
  const suggestions: string[] = [];

  // Check what might be missing
  if (json.includes('"nodes"') && !json.includes('"connections"')) {
    suggestions.push('Add connections object: "connections": {}');
  }

  if (json.includes('"connections"') && !json.includes('"nodes"')) {
    suggestions.push('Add nodes array: "nodes": []');
  }

  if (!json.includes('"name"')) {
    suggestions.push('Add workflow name: "name": "My Workflow"');
  }

  // Check for incomplete node structure
  if (json.includes('"nodes"') && json.includes('[')) {
    const nodeMatch = json.match(/"nodes"\s*:\s*\[([\s\S]*?)$/);
    if (nodeMatch) {
      const nodesContent = nodeMatch[1];
      if (nodesContent.includes('{') && !nodesContent.includes('}')) {
        suggestions.push('Close incomplete node object');
      }
    }
  }

  // Check for incomplete string values
  const openStrings = (json.match(/:\s*"/g) || []).length;
  const closeStrings = (json.match(/"\s*,/g) || []).length + (json.match(/"\s*}/g) || []).length;

  if (openStrings > closeStrings) {
    suggestions.push(`${openStrings - closeStrings} unclosed string value(s)`);
  }

  return suggestions;
}

/**
 * Validate workflow structure after parsing
 */
export function validateWorkflowStructure(workflow: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!workflow || typeof workflow !== 'object') {
    errors.push('Workflow must be an object');
    return { valid: false, errors };
  }

  // Check required fields
  if (!workflow.nodes) {
    errors.push('Missing required field: nodes');
  } else if (!Array.isArray(workflow.nodes)) {
    errors.push('nodes must be an array');
  }

  if (!workflow.connections) {
    errors.push('Missing required field: connections');
  } else if (typeof workflow.connections !== 'object') {
    errors.push('connections must be an object');
  }

  // Validate nodes structure
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach((node: any, index: number) => {
      if (!node.name) {
        errors.push(`Node ${index}: missing name`);
      }
      if (!node.type) {
        errors.push(`Node ${index}: missing type`);
      }
      if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
        errors.push(`Node ${index}: invalid position (must be [x, y] array)`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Smart JSON extraction from mixed content
 */
export function extractJSON(text: string): ParseResult {
  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return parseWorkflowJSON(codeBlockMatch[1]);
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*"nodes"[\s\S]*\}/);
  if (jsonMatch) {
    return parseWorkflowJSON(jsonMatch[0]);
  }

  // Try to find any JSON object
  const anyJsonMatch = text.match(/\{[\s\S]*\}/);
  if (anyJsonMatch) {
    const result = parseWorkflowJSON(anyJsonMatch[0]);
    if (result.success) {
      const validation = validateWorkflowStructure(result.workflow);
      if (validation.valid) {
        return result;
      }
    }
  }

  return {
    success: false,
    error: 'No valid workflow JSON found in text',
  };
}
