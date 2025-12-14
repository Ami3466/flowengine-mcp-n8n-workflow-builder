/**
 * Template Library - Pre-built Workflow Templates
 *
 * Collection of ready-to-use workflow templates for common use cases.
 */

import type { Workflow } from './generator.js';
import { WorkflowGenerator } from './generator.js';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  workflow: Workflow;
}

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<WorkflowTemplate[]> {
  return await Promise.all([
    createSlackNotificationTemplate(),
    createGmailToSheetsTemplate(),
    createAICustomerSupportTemplate(),
    createWebhookToSlackTemplate(),
    createDatabaseBackupTemplate(),
  ]);
}

/**
 * Get template by ID
 */
export async function getTemplate(id: string): Promise<WorkflowTemplate | null> {
  const templates = await getAllTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * Search templates
 */
export async function searchTemplates(query: string): Promise<WorkflowTemplate[]> {
  const lowerQuery = query.toLowerCase();
  const templates = await getAllTemplates();
  return templates.filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(category: string): Promise<WorkflowTemplate[]> {
  const templates = await getAllTemplates();
  return templates.filter(t => t.category === category);
}

// ==================== TEMPLATE DEFINITIONS ====================

async function createSlackNotificationTemplate(): Promise<WorkflowTemplate> {
  const generator = new WorkflowGenerator('Slack Notification');

  const workflow = await generator.buildLinear([
    { type: 'n8n-nodes-base.manualTrigger' },
    {
      type: 'n8n-nodes-base.slack',
      parameters: {
        resource: 'message',
        operation: 'post',
        channel: '#general',
        text: 'Hello from n8n!',
      },
    },
  ]);

  return {
    id: 'slack-notification',
    name: 'Slack Notification',
    description: 'Send a message to Slack when manually triggered',
    category: 'communication',
    tags: ['slack', 'notification', 'messaging'],
    difficulty: 'beginner',
    workflow,
  };
}

async function createGmailToSheetsTemplate(): Promise<WorkflowTemplate> {
  const generator = new WorkflowGenerator('Gmail to Google Sheets');

  const workflow = await generator.buildLinear([
    {
      type: 'n8n-nodes-base.emailReadImap',
      parameters: {
        mailbox: 'INBOX',
        postProcessAction: 'mark',
      },
    },
    {
      type: 'n8n-nodes-base.set',
      parameters: {
        values: {
          string: [
            { name: 'from', value: '={{ $json.from.address }}' },
            { name: 'subject', value: '={{ $json.subject }}' },
            { name: 'date', value: '={{ $json.date }}' },
          ],
        },
      },
    },
    {
      type: 'n8n-nodes-base.googleSheets',
      parameters: {
        resource: 'sheet',
        operation: 'append',
        sheetId: 'YOUR_SHEET_ID',
        range: 'Sheet1!A:C',
      },
    },
  ]);

  return {
    id: 'gmail-to-sheets',
    name: 'Gmail to Google Sheets',
    description: 'Log incoming emails to Google Sheets automatically',
    category: 'productivity',
    tags: ['gmail', 'google sheets', 'email', 'logging'],
    difficulty: 'beginner',
    workflow,
  };
}

async function createAICustomerSupportTemplate(): Promise<WorkflowTemplate> {
  const generator = new WorkflowGenerator('AI Customer Support Agent');

  const workflow = await generator.buildAIAgent({
    modelType: 'openai',
    tools: [
      '@n8n/n8n-nodes-langchain.toolHttpRequest',
      '@n8n/n8n-nodes-langchain.toolCode',
    ],
    memory: true,
    trigger: {
      type: 'n8n-nodes-base.webhook',
      parameters: {
        httpMethod: 'POST',
        path: 'support-chat',
      },
    },
  });

  return {
    id: 'ai-customer-support',
    name: 'AI Customer Support Agent',
    description: 'AI-powered customer support with tools and memory',
    category: 'ai',
    tags: ['ai', 'customer support', 'chatbot', 'langchain'],
    difficulty: 'advanced',
    workflow,
  };
}

async function createWebhookToSlackTemplate(): Promise<WorkflowTemplate> {
  const generator = new WorkflowGenerator('Webhook to Slack Alert');

  const workflow = await generator.buildLinear([
    {
      type: 'n8n-nodes-base.webhook',
      parameters: {
        httpMethod: 'POST',
        path: 'alert',
      },
    },
    {
      type: 'n8n-nodes-base.set',
      parameters: {
        values: {
          string: [
            { name: 'message', value: '🚨 Alert: {{ $json.body.message }}' },
          ],
        },
      },
    },
    {
      type: 'n8n-nodes-base.slack',
      parameters: {
        resource: 'message',
        operation: 'post',
        channel: '#alerts',
        text: '={{ $json.message }}',
      },
    },
    {
      type: 'n8n-nodes-base.respondToWebhook',
      parameters: {
        options: {
          responseBody: '{ "status": "sent" }',
        },
      },
    },
  ]);

  return {
    id: 'webhook-to-slack',
    name: 'Webhook to Slack Alert',
    description: 'Receive webhooks and send alerts to Slack',
    category: 'integration',
    tags: ['webhook', 'slack', 'alerts', 'monitoring'],
    difficulty: 'beginner',
    workflow,
  };
}

async function createDatabaseBackupTemplate(): Promise<WorkflowTemplate> {
  const generator = new WorkflowGenerator('Daily Database Backup');

  const workflow = await generator.buildLinear([
    {
      type: 'n8n-nodes-base.scheduleTrigger',
      parameters: {
        rule: {
          interval: [{ field: 'hours', hoursInterval: 24 }],
        },
      },
    },
    {
      type: 'n8n-nodes-base.postgres',
      parameters: {
        operation: 'executeQuery',
        query: 'SELECT * FROM important_table',
      },
    },
    {
      type: 'n8n-nodes-base.set',
      parameters: {
        values: {
          string: [
            { name: 'backup_date', value: '={{ new Date().toISOString() }}' },
          ],
        },
      },
    },
    {
      type: 'n8n-nodes-base.googleSheets',
      parameters: {
        resource: 'sheet',
        operation: 'append',
        sheetId: 'BACKUP_SHEET_ID',
      },
    },
  ]);

  return {
    id: 'database-backup',
    name: 'Daily Database Backup',
    description: 'Scheduled database backup to Google Sheets',
    category: 'data',
    tags: ['database', 'backup', 'schedule', 'postgres'],
    difficulty: 'intermediate',
    workflow,
  };
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<string[]> {
  const templates = await getAllTemplates();
  const categories = new Set(templates.map(t => t.category));
  return Array.from(categories).sort();
}
