#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js']
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

console.log('\n=== Testing build_workflow ===');
try {
  const result1 = await client.callTool({
    name: 'build_workflow',
    arguments: {
      description: 'Send email when webhook receives data',
      name: 'Test Workflow',
      pattern: 'linear'
    }
  });
  console.log('✅ build_workflow:', result1.content[0].text.substring(0, 200));
} catch (e) {
  console.log('❌ build_workflow error:', e.message);
}

console.log('\n=== Testing add_node ===');
try {
  const result2 = await client.callTool({
    name: 'add_node',
    arguments: {
      workflow: {
        name: 'Test',
        nodes: [],
        connections: {}
      },
      nodeType: 'n8n-nodes-base.webhook',
      parameters: { httpMethod: 'POST', path: 'test' }
    }
  });
  console.log('✅ add_node:', result2.content[0].text.substring(0, 200));
} catch (e) {
  console.log('❌ add_node error:', e.message);
}

console.log('\n=== Testing search_nodes ===');
try {
  const result3 = await client.callTool({
    name: 'search_nodes',
    arguments: {
      query: 'slack'
    }
  });
  console.log('✅ search_nodes:', result3.content[0].text.substring(0, 200));
} catch (e) {
  console.log('❌ search_nodes error:', e.message);
}

await client.close();
process.exit(0);
