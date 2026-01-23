# Quick Installation Guide

## Prerequisites

- Claude Code installed
- Node.js 18+ installed (for npx)
- Access to Prometheus, SQL Server, and Azure DevOps

## Installation Steps

### Step 1: Add Plugin Marketplace

In Claude Code, run:

```
/plugin marketplace add https://your-azure-devops-url/infrastructure-plugin.git
```

Replace `your-azure-devops-url` with your actual repository URL.

### Step 2: Install Plugin

```
/plugin install infrastructure-plugin@infrastructure-marketplace
```

### Step 3: Configure Credentials

**Important:** Credentials must be added to your **user-level settings**, not the plugin directory.

**Windows:** Edit `C:\Users\<your-username>\.claude\settings.json`
**macOS/Linux:** Edit `~/.claude/settings.json`

Add an `"env"` section with your credentials:

```json
{
  "env": {
    "AZURE_DEVOPS_URL": "http://tfs2022:8080/tfs",
    "AZURE_DEVOPS_PAT": "your_personal_access_token",
    "AZURE_DEVOPS_COLLECTION": "Elad-health_Collection",
    "AZURE_DEVOPS_PROJECT": "Chameleon",
    "PROMETHEUS_URL": "http://devopsmgr:9090",
    "PROMETHEUS_USERNAME": "",
    "PROMETHEUS_PASSWORD": "",
    "MSSQL_HOST": "chamdb.eladsolutions.local",
    "MSSQL_PORT": "1433",
    "MSSQL_USER": "your_sql_username",
    "MSSQL_PASSWORD": "your_sql_password",
    "MSSQL_DATABASE": "master",
    "MSSQL_ENCRYPT": "false",
    "MSSQL_TRUST_SERVER_CERTIFICATE": "true"
  }
}
```

**Get your credentials from:**
- **Azure DevOps PAT:** Generate at `http://tfs2022:8080/tfs/_usersSettings/tokens`
- **SQL credentials:** Contact Infrastructure Team
- **Prometheus URL:** Use `http://devopsmgr:9090` (internal)

### Step 4: Restart Claude Code

Close and restart Claude Code for changes to take effect.

### Step 5: Verify Installation

Check plugin is loaded:
```
/plugin
```

Look for `infrastructure-plugin` with status "Enabled" and no errors.

### Step 6: Test Commands

Try a command:
```
/infrastructure-plugin:db-health
```

You should see:
- SQL instances discovered from Prometheus
- Health check results
- Summary of all instances

## Available Commands

- `/infrastructure-plugin:incident-investigation` - Full incident response
- `/infrastructure-plugin:db-health` - Quick health check
- `/infrastructure-plugin:disk-space` - Disk space analysis
- `/infrastructure-plugin:performance-analysis` - Performance investigation
- `/infrastructure-plugin:deployment-impact` - Deployment correlation

## Troubleshooting

### MCP Server Errors

If you see "Missing environment variables" errors:
1. Verify credentials are in `~/.claude/settings.json`
2. Check the `"env"` section exists and has all required variables
3. Restart Claude Code

### Commands Not Available

If commands don't show up:
1. Check plugin is enabled: `/plugin`
2. Restart Claude Code
3. Re-install plugin if needed

### Connection Errors

**Azure DevOps:**
- Verify URL: `http://tfs2022:8080/tfs`
- Test PAT token expiration
- Check network access

**Prometheus:**
- Verify URL: `http://devopsmgr:9090`
- Check firewall/network access

**SQL Server:**
- Verify host: `chamdb.eladsolutions.local`
- Test with: `sqlcmd -S chamdb.eladsolutions.local -U username -P password`
- Check SQL Server allows remote connections

## Getting Help

- **Documentation:** See [docs/](docs/) directory
- **Issues:** Report in Azure DevOps repository
- **Team:** Ask in #infrastructure-ops Slack channel

## Security Note

**Never commit credentials to git!**

- Credentials go in `~/.claude/settings.json` (on your machine only)
- Do NOT create `.env` files in the plugin directory
- Do NOT commit `settings.json` with credentials
