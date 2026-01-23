# Infrastructure Plugin

AI-powered infrastructure observability for incident investigation across Prometheus, SQL Server, and Azure DevOps.

## Overview

The Infrastructure Plugin provides comprehensive incident response capabilities by combining:

- **Commands** - User-facing workflows for incident investigation
- **Agents** - Specialized AI experts for discovery, correlation, and analysis
- **Skills** - Persistent infrastructure knowledge and methodology
- **MCP Servers** - Real-time data access to Prometheus, SQL Server, and Azure DevOps

### Key Innovation

Multi-layered AI architecture where Claude deeply understands YOUR infrastructure:

```
┌─────────────────────────────────────────────────┐
│  Commands (Workflows)                           │
│  /incident-investigation, /db-health, etc.      │
└─────────────────────────────────────────────────┘
           ↓ orchestrates
┌─────────────────────────────────────────────────┐
│  Agents (Specialized Experts)                   │
│  sql-instance-discovery, prometheus-correlator  │
└─────────────────────────────────────────────────┘
           ↓ references
┌─────────────────────────────────────────────────┐
│  Skills (Persistent Knowledge)                  │
│  Investigation methodology, architecture        │
└─────────────────────────────────────────────────┘
           ↓ queries
┌─────────────────────────────────────────────────┐
│  MCP Servers (Real-Time Data)                   │
│  Prometheus, SQL Server, Azure DevOps           │
└─────────────────────────────────────────────────┘
```

## Features

### 🚨 Incident Investigation

Autonomous incident response across multiple systems:
- Discovers all SQL instances automatically
- Correlates Prometheus alerts with database performance
- Identifies deployment-related issues
- Generates comprehensive incident reports with confidence levels

### 📊 Performance Analysis

Deep performance investigation:
- Expensive query identification
- Wait stats analysis
- Blocking chain detection
- Optimization recommendations

### 💾 Disk Space Management

Comprehensive disk analysis:
- Checks ALL SQL instances (shared drives)
- Identifies instances >90% full
- Reports actual storage paths
- Recommends remediation actions

### 🚀 Deployment Impact

Deployment correlation:
- Analyzes recent builds and releases
- Identifies code changes
- Correlates with infrastructure impact
- Provides rollback recommendations

## Quick Start

### Installation

**For detailed installation instructions, see [INSTALL.md](INSTALL.md)**

Quick summary:

1. **Add marketplace:**
   ```
   /plugin marketplace add https://your-azure-devops-url/infrastructure-plugin.git
   ```

2. **Install plugin:**
   ```
   /plugin install infrastructure-plugin@infrastructure-marketplace
   ```

3. **Configure credentials in `~/.claude/settings.json`:**
   ```json
   {
     "env": {
       "AZURE_DEVOPS_URL": "http://tfs2022:8080/tfs",
       "AZURE_DEVOPS_PAT": "your_token",
       "PROMETHEUS_URL": "http://devopsmgr:9090",
       "MSSQL_HOST": "chamdb.eladsolutions.local",
       "MSSQL_USER": "your_username",
       "MSSQL_PASSWORD": "your_password",
       ...
     }
   }
   ```

4. **Restart Claude Code**

5. **Test:**
   ```
   /infrastructure-plugin:db-health
   ```

### Basic Usage

**Investigate an incident:**
```
/incident-investigation

Users reporting API timeouts since last deployment
```

**Quick health check:**
```
/db-health
```

**Check disk space:**
```
/disk-space
```

**Analyze performance:**
```
/performance-analysis

Check V85X_PROD_DB performance
```

**Check deployment impact:**
```
/deployment-impact
```

## Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `/incident-investigation` | Full incident response | Production outages, unknown issues |
| `/db-health` | Quick health check | Daily checks, quick status |
| `/disk-space` | Disk space analysis | Disk alerts, capacity planning |
| `/performance-analysis` | Performance deep dive | Slow queries, blocking |
| `/deployment-impact` | Deployment correlation | Post-deployment issues |

## Architecture

### Multi-System Integration

**Prometheus → SQL Instance Mapping:**
- Prometheus monitors application servers (V85X_PROD:9182)
- SQL instances on CHAMDB (V85X_PROD_DB)
- Plugin automatically maps server → instance

**CHAMDB Architecture:**
- Single SQL Server host
- 30-40+ named instances
- Shared resources (CPU, memory, disk)

### Discovery-First Pattern

**Never hardcode instance lists.**

Every investigation starts with:
1. Invoke `sql-instance-discovery` agent
2. Discover 30+ SQL instances from Prometheus
3. Group by environment (Production/QA/Dev)
4. Use discovered list for all operations

## Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation instructions
- **[Workflows](docs/WORKFLOWS.md)** - Complete usage examples
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Example Investigation

```
User: /incident-investigation
      Users reporting timeouts on V85X_PROD

Claude:
1. Discovery Phase
   ✓ Discovered 35 SQL instances from Prometheus
   ✓ Grouped by environment (15 Prod, 12 QA, 8 Dev)

2. Data Collection
   ✓ Prometheus: 2 FIRING alerts on V85X_PROD:9182
   ✓ SQL Server: Blocking detected on V85X_PROD_DB
   ✓ Azure DevOps: Build #1234 deployed 5 minutes ago

3. Correlation Analysis
   ✓ Deployment timing: HIGH correlation (5 min before incident)
   ✓ Code changes: SQL query modification detected
   ✓ Infrastructure: CPU spike after deployment

4. Root Cause Hypothesis
   Confidence: HIGH (90%)
   Hypothesis: Build #1234 introduced poorly-optimized query

   Supporting Evidence:
   - Deployment 5 minutes before incident
   - SQL query change in commit abc123
   - Expensive query matches changed code
   - CPU spike correlates with query execution

5. Remediation Plan
   Immediate Actions (for approval):
   1. Rollback Build #1234 to Build #1233
   2. Kill blocking SPID 152 (stuck query)

   Expected Recovery: Immediate (<5 minutes)
```

## Safety Features

**All remediation actions require approval:**
- No automatic destructive operations
- Clear risk assessment provided
- Verification steps included
- Preventive measures suggested

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues:** Report bugs or request features in Azure DevOps
- **Documentation:** See [docs/](docs/) directory
- **Questions:** Contact Infrastructure Team

## Roadmap

### v1.0 (Current)
- Core incident investigation
- Performance analysis
- Disk space management
- Deployment correlation

### v1.1 (Planned)
- Capacity planning command
- Alert correlation command
- Historical incident search

### v2.0 (Future)
- Automated remediation (safe actions)
- Multi-environment support
- Runbook executor

---

**Built with Claude Code** - AI-powered infrastructure observability for autonomous incident response.
