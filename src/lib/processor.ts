/**
 * Workflow JSON Processor
 *
 * Extracts and parses n8n workflow JSON from AI responses
 */

export interface WorkflowDetectionResult {
  hasWorkflow: boolean;
  isPartial: boolean;
  workflowJSON?: any;
  cleanContent: string;
}

export function extractWorkflowJSON(text: string): WorkflowDetectionResult {
  try {
    // Priority 1: Look for WORKFLOW_JSON blocks
    const workflowJsonRegex = /```(?:WORKFLOW_JSON)(?:\s|Copy code)*\s*([\s\S]*?)```/gi;
    const workflowMatches = [...text.matchAll(workflowJsonRegex)];

    // Priority 2: Fallback to json blocks
    const jsonBlockRegex = /```(?:json)(?:\s|Copy code)*\s*([\s\S]*?)```/gi;
    const jsonMatches = [...text.matchAll(jsonBlockRegex)];

    const allMatches = [...workflowMatches, ...jsonMatches];

    if (allMatches.length === 0) {
      return {
        hasWorkflow: false,
        isPartial: false,
        cleanContent: text,
      };
    }

    // Find the best match
    let bestMatch = null;
    let bestScore = 0;

    for (const match of allMatches) {
      const jsonText = match[0].trim();
      const isWorkflowJsonBlock = match[0].includes('WORKFLOW_JSON');

      // Scoring
      let score = 0;
      if (isWorkflowJsonBlock) score += 100;
      if (jsonText.includes('"nodes"')) score += 50;
      if (jsonText.includes('"connections"')) score += 30;
      score += jsonText.length / 100;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = match[1].trim();
      }
    }

    if (!bestMatch) {
      return {
        hasWorkflow: false,
        isPartial: false,
        cleanContent: text,
      };
    }

    try {
      const parsed = JSON.parse(bestMatch);

      // Validate it looks like a workflow
      const hasNodes = Array.isArray(parsed.nodes) && parsed.nodes.length > 0;
      const hasConnections = parsed.connections && typeof parsed.connections === 'object';
      const hasValidNodeStructure =
        hasNodes &&
        parsed.nodes.every((node: any) => node.name && node.type && node.position);

      if (hasNodes && hasConnections && hasValidNodeStructure) {
        return {
          hasWorkflow: true,
          isPartial: false,
          workflowJSON: parsed,
          cleanContent: text.replace(/```(?:WORKFLOW_JSON|json)[\s\S]*?```/gi, '✅ Workflow Generated'),
        };
      }

      // Parsed but not a valid workflow
      return {
        hasWorkflow: false,
        isPartial: false,
        cleanContent: text,
      };
    } catch (parseError) {
      // JSON is malformed
      return {
        hasWorkflow: false,
        isPartial: true,
        cleanContent: text,
      };
    }
  } catch (error) {
    console.error('Error extracting workflow JSON:', error);
    return {
      hasWorkflow: false,
      isPartial: false,
      cleanContent: text,
    };
  }
}
