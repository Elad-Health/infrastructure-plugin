# Infrastructure Plugin

**Universal AI-powered infrastructure observability for incident investigation across Prometheus, SQL Server, and Azure DevOps.**

Works dynamically with **any company's infrastructure** through intelligent discovery and architecture-aware optimization.

## Features

- **Dynamic Discovery** - Automatically detects SQL Server instances from Prometheus
- **Architecture-Aware Optimization** - Adapts to shared-disk vs independent server patterns
- **Multi-System Correlation** - Connects Prometheus alerts, SQL performance, and deployments
- **Token Efficient** - 97% reduction in token usage through smart sampling
- **Production Safe** - Read-only operations, all actions require approval

## Installation

### Via Claude Code (Recommended)

```bash
# Add the plugin marketplace
/plugin marketplace add https://github.com/elad-nofy/infrastructure-plugin.git

# Install the plugin
/plugin install infrastructure-plugin
```

### Manual Installation

```bash
git clone https://github.com/elad-nofy/infrastructure-plugin.git ~/.claude/plugins/infrastructure-plugin
```

### Configuration

Edit `.mcp.json` or add to `~/.claude/settings.json`:

**Windows:**
```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "azure-devops-mcp@latest"],
      "env": {
        "AZURE_DEVOPS_URL": "https://your-org.visualstudio.com",
        "AZURE_DEVOPS_PAT": "your_pat_token",
        "AZURE_DEVOPS_PROJECT": "YourProject"
      }
    },
    "prometheus": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@elad-nofy/prometheus-mcp@latest"],
      "env": {
        "PROMETHEUS_URL": "http://prometheus.company.com:9090"
      }
    },
    "mssql": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@elad-nofy/mssql-mcp@latest"],
      "env": {
        "MSSQL_HOST": "your-sql-server.domain.com",
        "MSSQL_USER": "readonly_user",
        "MSSQL_PASSWORD": "your_password"
      }
    }
  }
}
```

**Linux/Mac:** Remove `"cmd"` and `["/c",` from commands.

## Available Skills

| Skill | Description | Model | Use Case |
|-------|-------------|-------|----------|
| `/quick-health` | Fast infrastructure health check | haiku | Daily checks |
| `/incident-investigation` | Full incident response | sonnet | Production issues |
| `/disk-space` | Disk space analysis | sonnet | Storage alerts |
| `/db-health` | Database state check | haiku | Quick DB status |
| `/performance-analysis` | Performance deep dive | sonnet | Slow queries |
| `/deployment-impact` | Deployment correlation | sonnet | Post-deploy issues |

## Quick Start

### 1. Verify Installation
```
/infrastructure-plugin:quick-health
```

### 2. Discover Your Infrastructure
```
/infrastructure-plugin:sql-instance-discovery
```

### 3. Investigate an Issue
```
/infrastructure-plugin:incident-investigation Users reporting slow API response
```

## Usage Examples

### Daily Health Check
```
/infrastructure-plugin:quick-health
/infrastructure-plugin:quick-health production
```

### Check Disk Space
```
/infrastructure-plugin:disk-space
/infrastructure-plugin:disk-space >90%
```

### Investigate Incident
```
/infrastructure-plugin:incident-investigation
API timeouts started after deployment
```

### Performance Analysis
```
/infrastructure-plugin:performance-analysis production
```

### Deployment Impact
```
/infrastructure-plugin:deployment-impact 24h
/infrastructure-plugin:deployment-impact build-1234
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Skills (User-Facing)                           │
│  quick-health, incident-investigation, etc.     │
└─────────────────────────────────────────────────┘
           ↓ invoke
┌─────────────────────────────────────────────────┐
│  Agents (Specialized Experts)                   │
│  sql-instance-discovery, prometheus-correlator  │
│  azure-devops-analyzer, incident-report-gen     │
└─────────────────────────────────────────────────┘
           ↓ reference
┌─────────────────────────────────────────────────┐
│  Knowledge Skills                               │
│  aiops-investigation, mssql-operations          │
└─────────────────────────────────────────────────┘
           ↓ query
┌─────────────────────────────────────────────────┐
│  MCP Servers (Real-Time Data)                   │
│  Prometheus, SQL Server, Azure DevOps           │
└─────────────────────────────────────────────────┘
```

### Components

**Skills (8 total):**
- 6 user-invocable skills (quick-health, incident-investigation, disk-space, db-health, performance-analysis, deployment-impact)
- 2 knowledge skills (aiops-investigation, mssql-operations)

**Agents (4 total):**
- `sql-instance-discovery` - Dynamic infrastructure discovery
- `prometheus-correlator` - Alert and metric correlation
- `azure-devops-analyzer` - Deployment analysis
- `incident-report-generator` - Report synthesis

**Hooks:**
- PostToolUse hooks for automatic analysis of results
- SubagentStop hooks for discovery validation

## How It Works

### Dynamic Discovery

The plugin discovers your infrastructure from Prometheus - no hardcoded values:

1. Queries Prometheus targets for SQL Server exporters
2. Extracts instance names from any naming convention
3. Detects architecture (shared-disk vs independent servers)
4. Groups by environment (production/QA/dev)

### Architecture-Aware Optimization

**Shared-Disk (30+ instances on one server):**
- Queries 1-2 instances for drive info (97% token reduction)
- All instances share physical drives

**Independent Servers:**
- Queries each unique server
- No shared resources

### Supported Infrastructure

- Traditional Windows SQL Server (named instances)
- Standalone SQL Servers
- Cloud databases (Azure SQL, AWS RDS)
- Hybrid environments
- Any Prometheus exporter configuration
- Any naming convention

## Configuration Requirements

### Prometheus
- Read-only access to metrics
- List targets endpoint
- Windows Exporter or SQL Server Exporter configured

### SQL Server
- `VIEW SERVER STATE` permission
- `VIEW DATABASE STATE` permission

### Azure DevOps
- Read access to builds, releases, repositories
- Personal Access Token (PAT)

## Troubleshooting

### No instances discovered
1. Verify Prometheus URL
2. Check for SQL Server exporters in Prometheus targets
3. Test: `curl http://prometheus:9090/api/v1/targets`

### MCP servers not loading (Windows)
- Ensure `.mcp.json` uses `"command": "cmd"` with `["/c", "npx", ...]`

### Token limit exceeded
- Architecture detection should prevent this
- Try: `/infrastructure-plugin:disk-space production`

## Safety

**Read-Only Operations:**
- ✅ Reads metrics and states
- ✅ Analyzes and correlates
- ✅ Suggests remediation
- ❌ Never executes changes without approval

All remediation actions require explicit user approval.

## Version History

- **v1.0.2** - Skills-based architecture, hooks, dynamic discovery
- **v1.0.1** - Token optimization (97% reduction)
- **v1.0.0** - Initial release

See [CHANGELOG.md](CHANGELOG.md) for details.

## License

MIT License - see [LICENSE](LICENSE)

---

**The plugin discovers and adapts to YOUR infrastructure - no configuration of instance names required.**
