# Setup Guide

Complete installation and configuration guide for the Infrastructure Plugin.

## Prerequisites

### Software Requirements

- **Claude Code:** Version 1.0 or higher
- **Node.js:** Version 18 or higher (for npx)
- **Access to Systems:**
  - Prometheus server
  - Azure DevOps / TFS server
  - SQL Server (CHAMDB)

### Credentials Required

- **Azure DevOps PAT** (Personal Access Token) with read permissions
- **Prometheus** credentials (if authentication required)
- **SQL Server** login with read permissions on all instances

## Installation Steps

### Step 1: Clone or Download Plugin

```bash
# Clone from Azure DevOps
git clone https://your-azure-devops/infrastructure-plugin.git

# Or download and extract archive
```

### Step 2: Configure Environment Variables

**Copy template:**
```bash
cd infrastructure-plugin
cp .env.example .env
```

**Edit `.env` file:**

```env
# Azure DevOps Configuration
AZURE_DEVOPS_URL=http://tfs:8080/tfs
AZURE_DEVOPS_PAT=your_pat_token_here
AZURE_DEVOPS_COLLECTION=DefaultCollection
AZURE_DEVOPS_PROJECT=YourProjectName

# Prometheus Configuration
PROMETHEUS_URL=http://prometheus:9090
PROMETHEUS_USERNAME=
PROMETHEUS_PASSWORD=

# SQL Server Configuration
MSSQL_HOST=chamdb.eladsolutions.local
MSSQL_PORT=1433
MSSQL_USER=your_sql_username
MSSQL_PASSWORD=your_sql_password
MSSQL_DATABASE=master
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true
```

#### Generating Azure DevOps PAT

1. Navigate to your Azure DevOps server
2. Click user icon → Security
3. Select "Personal Access Tokens"
4. Click "New Token"
5. Set expiration date
6. Select scopes:
   - Code: Read
   - Build: Read
   - Release: Read
   - Work Items: Read
7. Copy token (save it - won't be shown again)

#### SQL Server Authentication

**Windows Authentication:**
```env
MSSQL_USER=DOMAIN\\username
MSSQL_PASSWORD=your_password
```

**SQL Authentication:**
```env
MSSQL_USER=sa
MSSQL_PASSWORD=your_sa_password
```

**Permissions Required:**
- VIEW SERVER STATE
- VIEW DATABASE STATE
- SELECT on system views (sys.dm_*)

### Step 3: Install Plugin

**Copy to Claude plugins directory:**

```bash
# Windows
xcopy /E /I . "%USERPROFILE%\.claude\plugins\infrastructure-plugin\"

# macOS/Linux
cp -r . ~/.claude/plugins/infrastructure-plugin/
```

**Verify directory structure:**
```
~/.claude/plugins/infrastructure-plugin/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── .env
├── agents/
├── skills/
├── commands/
└── docs/
```

### Step 4: Restart Claude Code

**Windows:**
```powershell
# Close Claude Code completely
# Restart from Start Menu or desktop shortcut
```

**macOS:**
```bash
# Quit Claude Code
# Restart from Applications
```

**Linux:**
```bash
# Kill process
pkill claude-code

# Restart
claude-code
```

### Step 5: Verify Installation

**Check plugin loaded:**
```
/plugin list
```

Should show:
```
infrastructure-plugin (v1.0.0) - ACTIVE
```

**Check MCP servers loaded:**
```
/mcp
```

Should show 3 servers:
- azure-devops
- prometheus
- mssql

**Test MCP server connectivity:**

```
Test Prometheus connection:
mcp__prometheus__list_targets

Test SQL Server connection:
mcp__mssql__list_databases

Test Azure DevOps connection:
mcp__azure-devops__list_projects
```

## Configuration Options

### MCP Server Configuration

The `.mcp.json` file configures MCP servers using npx @latest:

```json
{
  "azure-devops": {
    "command": "npx",
    "args": ["-y", "azure-devops-mcp@latest"],
    "env": {
      "AZURE_DEVOPS_URL": "${AZURE_DEVOPS_URL}",
      "AZURE_DEVOPS_PAT": "${AZURE_DEVOPS_PAT}",
      ...
    }
  },
  ...
}
```

**How it works:**
- npx automatically downloads latest MCP server version from npm
- First run downloads and caches servers (~1-2 minutes)
- Subsequent runs use cached versions (instant)
- Restart Claude Code to get MCP server updates

### Environment Variable Precedence

Variables are resolved in this order:
1. Shell environment variables
2. `.env` file in plugin directory
3. System environment variables

**Tip:** Use `.env` file for plugin-specific configuration.

### Optional Configuration

**Project Default:**
```env
AZURE_DEVOPS_PROJECT=MyDefaultProject
```
This can be overridden in commands.

**Prometheus Authentication:**
```env
# Leave empty if no auth required
PROMETHEUS_USERNAME=
PROMETHEUS_PASSWORD=

# Or provide credentials
PROMETHEUS_USERNAME=admin
PROMETHEUS_PASSWORD=secret
```

**SQL Server Encryption:**
```env
# For on-prem with self-signed certs
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# For Azure SQL or properly-signed certs
MSSQL_ENCRYPT=true
MSSQL_TRUST_SERVER_CERTIFICATE=false
```

## Validation

### Test Discovery

Run a quick test to verify everything works:

```
/db-health
```

Expected output:
```
Discovery Phase:
✓ Discovered 35 SQL instances from Prometheus
✓ Grouped: 15 Production, 12 QA, 8 Development

Health Check:
✓ Checking 35 instances...
✓ All databases ONLINE
✓ No critical issues detected

Summary:
- Total instances: 35
- Healthy: 35 (100%)
```

### Verify Commands Available

```
/
```

Should show 5 new commands:
- /incident-investigation
- /db-health
- /disk-space
- /performance-analysis
- /deployment-impact

### Verify Skills Loaded

Skills load automatically. To verify:

```
During an incident investigation, Claude should reference:
- aiops-investigation skill (6-phase methodology)
- mssql-operations skill (SQL Server architecture)
```

## Troubleshooting Installation

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

### Common Issues

**Plugin not loading:**
- Verify plugin.json exists in .claude-plugin/
- Check file permissions (must be readable)
- Check Claude Code logs for errors

**MCP servers not starting:**
- Verify Node.js installed (node --version)
- Check .env file has correct credentials
- Try manual test: `npx -y azure-devops-mcp@latest`

**Connection errors:**
- Verify URLs are correct and accessible
- Check firewall/proxy settings
- Test connectivity with curl/telnet

## Updating the Plugin

### Update MCP Servers

MCP servers update automatically on Claude Code restart (npx @latest).

To force update:
```bash
# Clear npx cache
npm cache clean --force

# Restart Claude Code
```

### Update Plugin

```bash
# Pull latest from git
cd ~/.claude/plugins/infrastructure-plugin
git pull

# Restart Claude Code
```

## Uninstalling

```bash
# Remove plugin directory
rm -rf ~/.claude/plugins/infrastructure-plugin/

# Restart Claude Code
```

## Security Considerations

### Credential Storage

- `.env` file contains sensitive credentials
- **DO NOT** commit `.env` to version control
- `.gitignore` includes `.env` by default

### Network Security

- All connections use credentials from .env
- No credentials stored in plugin code
- MCP servers run locally (not cloud services)

### Permissions

Plugin requires read-only access:
- Prometheus: Read metrics and alerts
- Azure DevOps: Read builds, releases, code
- SQL Server: Read database states, queries, metrics

**No write permissions required.**

### Audit Trail

All actions logged in Claude Code conversation history.

## Next Steps

Once installed:

1. **Read Workflows:** See [WORKFLOWS.md](WORKFLOWS.md) for usage examples
2. **Try Commands:** Start with `/db-health` for quick test
3. **Investigate:** Use `/incident-investigation` for first incident
4. **Provide Feedback:** Report issues or suggestions to Infrastructure Team

## Support

**Installation Issues:**
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Contact Infrastructure Team
- Create issue in Azure DevOps

**Questions:**
- See [README.md](../README.md) for overview
- See [WORKFLOWS.md](WORKFLOWS.md) for usage examples
