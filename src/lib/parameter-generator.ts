/**
 * Intelligent Parameter Generator
 *
 * Generates appropriate parameters for n8n nodes based on node type and context.
 * Uses knowledge of real n8n node requirements to create working workflows.
 */

import { v4 as uuidv4 } from 'uuid';
import type { INodeParameters } from 'n8n-workflow';

export interface ParameterContext {
  description?: string;
  previousNode?: string;
  isFirstNode?: boolean;
  workflowType?: 'webhook' | 'scheduled' | 'manual' | 'event';
}

/**
 * Generate parameters for a node based on its type and context
 */
export function generateNodeParameters(
  nodeType: string,
  context: ParameterContext = {}
): INodeParameters {
  const generator = NODE_PARAMETER_GENERATORS[nodeType] || NODE_PARAMETER_GENERATORS['default'];
  return generator(context);
}

/**
 * Parameter generators for specific node types
 */
const NODE_PARAMETER_GENERATORS: Record<string, (context: ParameterContext) => INodeParameters> = {
  // Trigger nodes
  'n8n-nodes-base.webhook': (context) => ({
    httpMethod: 'POST',
    path: generateWebhookPath(context.description),
    responseMode: 'onReceived',
    options: {},
  }),

  'n8n-nodes-base.scheduleTrigger': (context) => ({
    rule: {
      interval: [
        {
          field: 'cronExpression',
          expression: '0 0 * * *', // Daily at midnight
        },
      ],
    },
  }),

  'n8n-nodes-base.manualTrigger': () => ({
    // Manual trigger has no parameters
  }),

  'n8n-nodes-base.emailTrigger': () => ({
    pollTimes: {
      item: [
        {
          mode: 'everyMinute',
        },
      ],
    },
  }),

  // Action nodes - Code
  'n8n-nodes-base.code': (context) => ({
    mode: 'runOnceForAllItems',
    jsCode: generateCodeSnippet(context.description),
  }),

  // Action nodes - HTTP
  'n8n-nodes-base.httpRequest': (context) => ({
    url: '=',
    method: 'GET',
    options: {},
  }),

  'n8n-nodes-base.respondToWebhook': (context) => ({
    options: {
      responseBody: context.previousNode
        ? `={{$node["${context.previousNode}"].json}}`
        : '={{ $json }}',
      responseFormat: 'json',
    },
  }),

  // Action nodes - Data manipulation
  'n8n-nodes-base.set': (context) => ({
    mode: 'manual',
    duplicateItem: false,
    assignments: {
      assignments: [
        {
          id: uuidv4(),
          name: 'data',
          value: '',
          type: 'string',
        },
      ],
    },
  }),

  'n8n-nodes-base.if': () => ({
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
      },
      conditions: [
        {
          id: uuidv4(),
          leftValue: '',
          rightValue: '',
          operator: {
            type: 'string',
            operation: 'equals',
          },
        },
      ],
      combinator: 'and',
    },
  }),

  'n8n-nodes-base.switch': () => ({
    mode: 'rules',
    rules: {
      rules: [
        {
          id: uuidv4(),
          outputKey: 'output1',
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: '',
              typeValidation: 'strict',
            },
            conditions: [
              {
                id: uuidv4(),
                leftValue: '',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'equals',
                },
              },
            ],
            combinator: 'and',
          },
        },
      ],
    },
    options: {},
  }),

  // Action nodes - Communication
  'n8n-nodes-base.slack': (context) => ({
    resource: 'message',
    operation: 'post',
    channel: '',
    text: context.description ? extractMessage(context.description) : 'Message from n8n workflow',
    attachments: [],
    otherOptions: {},
  }),

  'n8n-nodes-base.gmail': (context) => ({
    resource: 'message',
    operation: 'send',
    sendTo: '',
    subject: context.description ? extractSubject(context.description) : 'Email from n8n',
    message: '',
  }),

  'n8n-nodes-base.sendEmail': (context) => ({
    fromEmail: '',
    toEmail: '',
    subject: context.description ? extractSubject(context.description) : 'Email from n8n',
    text: '',
    options: {},
  }),

  // Action nodes - Storage
  'n8n-nodes-base.googleSheets': () => ({
    resource: 'sheet',
    operation: 'append',
    documentId: {
      __rl: true,
      value: '',
      mode: 'list',
      cachedResultName: '',
    },
    sheetName: {
      __rl: true,
      value: '',
      mode: 'list',
      cachedResultName: '',
    },
    columns: {
      mappingMode: 'defineBelow',
      value: {},
      matchingColumns: [],
      schema: [],
    },
    options: {},
  }),

  'n8n-nodes-base.postgres': () => ({
    operation: 'executeQuery',
    query: '',
    options: {},
  }),

  'n8n-nodes-base.mysql': () => ({
    operation: 'executeQuery',
    query: '',
    options: {},
  }),

  // AI/LangChain nodes
  '@n8n/n8n-nodes-langchain.agent': () => ({
    promptType: 'define',
    text: '={{ $json.input }}',
    hasOutputParser: false,
    options: {
      systemMessage: 'You are a helpful AI assistant.',
    },
  }),

  '@n8n/n8n-nodes-langchain.lmChatOpenAi': () => ({
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
  }),

  '@n8n/n8n-nodes-langchain.lmChatAnthropic': () => ({
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
  }),

  '@n8n/n8n-nodes-langchain.memoryBufferWindow': () => ({
    sessionIdType: 'customKey',
    sessionKey: '={{ $json.sessionId || "default" }}',
    contextWindowLength: 10,
  }),

  '@n8n/n8n-nodes-langchain.toolCalculator': () => ({}),

  '@n8n/n8n-nodes-langchain.toolCode': () => ({
    language: 'javaScript',
    code: 'return { result: "success" };',
  }),

  // Default fallback
  'default': () => ({}),
};

/**
 * Generate webhook path from description
 */
function generateWebhookPath(description?: string): string {
  if (!description) return 'webhook';

  const lower = description.toLowerCase();

  // Extract meaningful keywords for path
  if (lower.includes('calculator')) return 'calculator';
  if (lower.includes('form')) return 'form-submission';
  if (lower.includes('contact')) return 'contact';
  if (lower.includes('payment')) return 'payment-webhook';
  if (lower.includes('notification')) return 'notification';
  if (lower.includes('data')) return 'data-intake';

  // Default
  return 'webhook';
}

/**
 * Generate code snippet based on description
 */
function generateCodeSnippet(description?: string): string {
  if (!description) {
    return `// Process the input data
const data = $input.all();

// Add your logic here
const result = data.map(item => ({
  ...item.json,
  processed: true,
  timestamp: new Date().toISOString()
}));

return result;`;
  }

  const lower = description.toLowerCase();

  // Calculator workflow
  if (lower.includes('calculator') || lower.includes('calculate') || lower.includes('math')) {
    return `const math = require('mathjs');
const expression = $json.body?.expression || $json.expression;

if (!expression) {
  $response.statusCode = 400;
  return { error: 'Expression not provided!' };
}

try {
  const result = math.evaluate(expression);
  return {
    expression,
    result,
    timestamp: new Date().toISOString()
  };
} catch (error) {
  $response.statusCode = 400;
  return {
    error: 'Invalid mathematical expression.',
    details: error.message
  };
}`;
  }

  // Data transformation
  if (lower.includes('transform') || lower.includes('format') || lower.includes('convert')) {
    return `// Transform the input data
const items = $input.all();

const transformed = items.map(item => {
  const data = item.json;

  // Add your transformation logic here
  return {
    ...data,
    transformed: true,
    timestamp: new Date().toISOString()
  };
});

return transformed;`;
  }

  // Validation
  if (lower.includes('validate') || lower.includes('check')) {
    return `// Validate input data
const data = $json;

// Define your validation rules
const isValid = data &&
  typeof data === 'object' &&
  Object.keys(data).length > 0;

if (!isValid) {
  throw new Error('Validation failed: Invalid input data');
}

return {
  ...data,
  validated: true,
  validatedAt: new Date().toISOString()
};`;
  }

  // Default code template
  return `// Process the input data
const data = $input.all();

// Add your custom logic here
const result = data.map(item => ({
  ...item.json,
  processed: true,
  timestamp: new Date().toISOString()
}));

return result;`;
}

/**
 * Extract message from description
 */
function extractMessage(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('alert')) return 'Alert: {{ $json.message }}';
  if (lower.includes('notify')) return 'Notification: {{ $json.content }}';
  if (lower.includes('error')) return 'Error occurred: {{ $json.error }}';
  if (lower.includes('success')) return 'Success: {{ $json.result }}';

  return '{{ $json.message || "Message from n8n workflow" }}';
}

/**
 * Extract subject from description
 */
function extractSubject(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('alert')) return 'Alert: {{ $json.title }}';
  if (lower.includes('report')) return 'Report: {{ $json.reportName }}';
  if (lower.includes('notification')) return 'Notification: {{ $json.subject }}';
  if (lower.includes('invoice')) return 'Invoice: {{ $json.invoiceNumber }}';

  return '{{ $json.subject || "Email from n8n" }}';
}

/**
 * Detect if a node type is a trigger
 */
export function isTriggerNode(nodeType: string): boolean {
  const triggerTypes = [
    'webhook',
    'scheduleTrigger',
    'manualTrigger',
    'emailTrigger',
    'cronTrigger',
    'formTrigger',
    'slackTrigger',
    'telegramTrigger',
  ];

  return triggerTypes.some(trigger => nodeType.includes(trigger));
}

/**
 * Get recommended trigger type based on description
 */
export function getRecommendedTrigger(description: string): string {
  const lower = description.toLowerCase();

  // Webhook triggers
  if (lower.includes('webhook') ||
      lower.includes('http') ||
      lower.includes('api') ||
      lower.includes('receive') ||
      lower.includes('post request') ||
      lower.includes('endpoint')) {
    return 'n8n-nodes-base.webhook';
  }

  // Schedule triggers
  if (lower.includes('schedule') ||
      lower.includes('cron') ||
      lower.includes('daily') ||
      lower.includes('hourly') ||
      lower.includes('every')) {
    return 'n8n-nodes-base.scheduleTrigger';
  }

  // Email triggers
  if (lower.includes('email arrives') ||
      lower.includes('new email') ||
      lower.includes('receive email')) {
    return 'n8n-nodes-base.emailTrigger';
  }

  // Form triggers
  if (lower.includes('form') ||
      lower.includes('submission')) {
    return 'n8n-nodes-base.formTrigger';
  }

  // Default to manual trigger
  return 'n8n-nodes-base.manualTrigger';
}
