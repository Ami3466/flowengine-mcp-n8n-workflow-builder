# Publishing Guide

This guide walks you through publishing the package to npm and Smithery.

## Prerequisites

- [ ] npm account (create at https://www.npmjs.com/signup)
- [ ] GitHub account with repository pushed
- [ ] All changes committed and pushed

## Step 1: Push to GitHub

```bash
git push origin master
```

**Verify:** Check that all commits are visible on GitHub at:
https://github.com/Ami3466/flowengine-mcp-n8n-workflow-builder

## Step 2: Login to npm

```bash
npm login
```

Enter your npm credentials:
- Username
- Password
- Email
- One-time password (if 2FA enabled)

**Verify login:**
```bash
npm whoami
```

## Step 3: Publish to npm

```bash
npm publish
```

This will:
1. Run `prepublishOnly` script (builds the package)
2. Create tarball
3. Upload to npm registry

**Verify publication:**
- Visit: https://www.npmjs.com/package/flowengine-n8n-workflow-builder
- Check version shows as latest
- Test install: `npm install -g flowengine-n8n-workflow-builder`

## Step 4: Submit to Smithery

### Option A: GitHub Integration (Recommended)

1. Go to https://smithery.ai
2. Sign in with GitHub
3. Click "Add Server" or "Submit"
4. Enter repository URL: `https://github.com/Ami3466/flowengine-mcp-n8n-workflow-builder`
5. Smithery will:
   - Clone repository
   - Read `smithery.yaml`
   - Build and deploy

### Option B: Manual npm Package

If you prefer to link the npm package directly:

1. Go to https://smithery.ai
2. Submit package: `flowengine-n8n-workflow-builder`
3. Smithery will pull from npm registry

## Step 5: Verify Smithery Installation

Once Smithery has processed your submission:

```bash
npx @smithery/cli install flowengine-n8n-workflow-builder --client claude
```

This should:
- ✅ Download and configure the server
- ✅ Add to Claude Desktop config
- ✅ Show success message

**Test in Claude Desktop:**
1. Restart Claude Desktop
2. Look for 🔌 MCP icon
3. Verify "flowengine-n8n" appears
4. Test: Ask Claude to "create an n8n workflow"

## Troubleshooting

### npm publish fails

**"You do not have permission to publish"**
```bash
# Check you're logged in
npm whoami

# Check package name isn't taken
npm view flowengine-n8n-workflow-builder

# If taken, update package.json name
```

**"Package version already exists"**
```bash
# Bump version
npm version patch  # e.g., 4.4.1 -> 4.4.2
npm publish
```

### Smithery not finding package

**"Server not found"**
- Wait 5-10 minutes after npm publish (npm registry needs to sync)
- Verify package exists: https://www.npmjs.com/package/flowengine-n8n-workflow-builder
- Try manual GitHub submission at smithery.ai

### Deployment fails on Smithery

Check the Smithery deployment logs for specific errors:
1. Go to smithery.ai
2. Find your deployment
3. Check build logs

Common issues:
- Missing dependencies → Add to package.json
- TypeScript errors → Fix and update version
- Build script fails → Test locally with `npm run build`

## Post-Deployment

### Update Documentation

1. Update README.md badges (if needed)
2. Add Smithery link to README
3. Create GitHub release

### Monitor

- npm downloads: https://www.npmjs.com/package/flowengine-n8n-workflow-builder
- GitHub issues: https://github.com/Ami3466/flowengine-mcp-n8n-workflow-builder/issues
- Smithery stats: https://smithery.ai/server/flowengine-n8n-workflow-builder

### Announce

- GitHub Discussions
- Twitter/X
- n8n Community
- MCP Developer Discord

## Version Management

For future updates:

```bash
# Make changes
git add .
git commit -m "feat: new feature"

# Bump version
npm version patch  # Bug fixes (4.0.1 -> 4.0.2)
npm version minor  # New features (e.g., 4.4.1 -> 4.5.0)
npm version major  # Breaking changes (e.g., 4.4.1 -> 5.0.0)

# Publish
git push && git push --tags
npm publish

# Smithery will auto-update from GitHub
```

## Success Checklist

- [ ] Package published to npm
- [ ] Package appears on npm website
- [ ] Can install via npm globally
- [ ] Submitted to Smithery
- [ ] Smithery deployment succeeds
- [ ] Can install via Smithery CLI
- [ ] Works in Claude Desktop
- [ ] GitHub release created
- [ ] Documentation updated
