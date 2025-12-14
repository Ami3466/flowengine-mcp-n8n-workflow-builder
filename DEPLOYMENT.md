# Deployment Guide

This document outlines the deployment process for the FlowEngine n8n Workflow Builder MCP Server.

## Pre-Deployment Checklist

- [x] All tests pass
- [x] Build completes successfully
- [x] Version bumped in package.json
- [x] CHANGELOG.md updated
- [x] README.md comprehensive and up-to-date
- [x] Smithery configuration files updated
- [x] No development artifacts in repository
- [x] Git history clean

## Deployment Steps

### 1. Push to GitHub

```bash
git push origin master
```

This pushes all commits to the GitHub repository.

### 2. Publish to npm

```bash
npm publish
```

This publishes to the npm registry at:
https://www.npmjs.com/package/flowengine-n8n-workflow-builder

**Verification:**
- Check package appears on npm
- Test installation: `npm install -g flowengine-n8n-workflow-builder`
- Verify command works: `flowengine-n8n --version`

### 3. Submit to Smithery

The package will be automatically indexed by Smithery once published to npm.

**Manual submission (if needed):**
1. Visit https://smithery.ai
2. Submit the package URL
3. Verify listing appears

**Verification:**
- Check package appears on Smithery
- Test Smithery install: `npx @smithery/cli install flowengine-n8n-workflow-builder --client claude`

## Post-Deployment

### Verify Installation Methods

1. **npm (global install):**
   ```bash
   npm install -g flowengine-n8n-workflow-builder
   flowengine-n8n
   ```

2. **Smithery (Claude Desktop):**
   ```bash
   npx @smithery/cli install flowengine-n8n-workflow-builder --client claude
   ```

3. **Direct in Claude Desktop:**
   - Add to `claude_desktop_config.json`
   - Restart Claude Desktop
   - Verify MCP server appears

### Test in Each Platform

1. **Claude Desktop** - Test workflow generation
2. **Claude Code** - Test in VS Code
3. **Cursor** - Test in Cursor IDE
4. **Cline** - Test in VS Code extension
5. **Continue.dev** - Test in Continue extension

### Monitor

- npm download stats
- GitHub issues
- User feedback
- Smithery installations

## Rollback (if needed)

If issues are discovered:

```bash
# Unpublish the version (within 72 hours of publish)
npm unpublish flowengine-n8n-workflow-builder@<version>

# Or deprecate
npm deprecate flowengine-n8n-workflow-builder@<version> "Issue found, use version X.X.X instead"
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for full version history.

## Support Channels

- GitHub Issues: https://github.com/Ami3466/flowengine-mcp-n8n-workflow-builder/issues
- npm: https://www.npmjs.com/package/flowengine-n8n-workflow-builder
- Smithery: https://smithery.ai/server/flowengine-n8n-workflow-builder
