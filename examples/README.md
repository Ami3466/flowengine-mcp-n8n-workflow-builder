# Workflow Examples

Example n8n workflows that can be generated using the FlowEngine MCP server.

## Available Examples

### 1. Email to Slack Notifications
**File:** `email-slack-example.json`

Monitors Gmail for emails with "urgent" in the subject line and sends notifications to a Slack channel.

**Features:**
- Gmail trigger with polling
- Email filtering
- Slack message formatting
- Rich attachments

**To use:**
1. Import this JSON into your n8n instance
2. Configure Gmail credentials
3. Configure Slack credentials
4. Set your desired Slack channel
5. Activate the workflow

## Generating Your Own Workflows

Use the MCP server with your AI assistant to generate custom workflows:

```
"Create a workflow that monitors my database for new orders and sends notifications to Slack"
```

The MCP server will generate complete, working n8n workflows that you can import and use immediately.

## More Examples

Visit [FlowEngine Documentation](https://docs.flowengine.cloud) for more examples and templates.
