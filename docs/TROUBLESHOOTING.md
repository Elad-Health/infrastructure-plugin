# Troubleshooting Guide

Solutions to common issues with the Infrastructure Plugin.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [MCP Server Issues](#mcp-server-issues)
3. [Connection Issues](#connection-issues)
4. [Discovery Issues](#discovery-issues)
5. [Performance Issues](#performance-issues)
6. [Command Issues](#command-issues)

---

## Installation Issues

### Plugin Not Loading

**Symptom:** Plugin doesn't appear in `/plugin list`

**Causes & Solutions:**

1. **Incorrect directory structure**
   ```bash
   # Verify structure
   ls ~/.claude/plugins/infrastructure-plugin/.claude-plugin/plugin.json
   ```
   Should show plugin.json file. If not, ensure you copied all files including `.claude-plugin/` directory.

2. **Invalid plugin.json**
   ```bash
   # Validate JSON
   cat ~/.claude/plugins/infrastructure-plugin/.claude-plugin/plugin.json | python -m json.tool
   ```
   Should parse without errors. Check for syntax errors (missing commas, quotes).

3. **File permissions**
   ```bash
   # Fix permissions (Unix/Mac)
   chmod -R 755 ~/.claude/plugins/infrastructure-plugin/
   ```

4. **Claude Code not restarted**
   - Close Claude Code completely
   - Restart application
   - Wait 30 seconds for plugins to load

**Verification:**
```
/plugin list
```
Should show `infrastructure-plugin (v1.0.0) - ACTIVE`

---

### Commands Not Available

**Symptom:** `/incident-investigation` not found

**Causes & Solutions:**

1. **Commands directory missing**
   ```bash
   ls ~/.claude/plugins/infrastructure-plugin/commands/
   ```
   Should show 5 .md files. If missing, re-copy plugin.

2. **Plugin loaded but commands not registered**
   - Commands load automatically from `commands/` directory
   - Restart Claude Code
   - Check Claude Code logs for errors

**Verification:**
```
/
```
Should show 5 commands: incident-investigation, db-health, disk-space, performance-analysis, deployment-impact

---

## MCP Server Issues

### MCP Servers Not Starting

**Symptom:** `/mcp` shows 0 servers or servers in error state

**Causes & Solutions:**

1. **Node.js not installed**
   ```bash
   node --version
   ```
   Should show v18 or higher. If not:
   - Windows: Download from nodejs.org
   - Mac: `brew install node`
   - Linux: `sudo apt install nodejs`

2. **npx not available**
   ```bash
   npx --version
   ```
   Should show version. If not, reinstall Node.js.

3. **Network issues preventing npm download**
   ```bash
   # Test manual download
   npx -y azure-devops-mcp@latest
   ```
   If fails with network error:
   - Check proxy settings
   - Check firewall
   - Try different network

4. **Missing .env file**
   ```bash
   ls ~/.claude/plugins/infrastructure-plugin/.env
   ```
   If missing:
   ```bash
   cp .env.example .env
   # Edit .env with credentials
   ```

5. **Invalid .mcp.json**
   ```bash
   cat ~/.claude/plugins/infrastructure-plugin/.mcp.json | python -m json.tool
   ```
   Should parse without errors.

**Verification:**
```
/mcp
```
Should show 3 servers: azure-devops, prometheus, mssql (all in "ready" state)

---

### MCP Server Errors

**Symptom:** Server shows "error" state in `/mcp`

**Check logs:**
```bash
# Claude Code logs location varies by platform
# Windows: %APPDATA%\Claude Code\logs\
# Mac: ~/Library/Application Support/Claude Code/logs/
# Linux: ~/.config/claude-code/logs/
```

**Common Errors:**

1. **"Authentication failed"**
   - Check credentials in `.env`
   - Verify URLs are correct
   - Test connectivity manually

2. **"Connection refused"**
   - Server may be down
   - Firewall blocking connection
   - Wrong URL or port

3. **"Timeout"**
   - Server slow to respond
   - Network latency high
   - Increase timeout in .mcp.json

---

## Connection Issues

### Prometheus Connection Failed

**Symptom:** `mcp__prometheus__list_targets` fails

**Diagnosis:**
```bash
# Test connectivity
curl http://prometheus:9090/api/v1/targets

# Or with auth
curl -u username:password http://prometheus:9090/api/v1/targets
```

**Solutions:**

1. **Wrong URL**
   - Check PROMETHEUS_URL in `.env`
   - Verify hostname resolves: `nslookup prometheus`
   - Try IP address instead of hostname

2. **Authentication required**
   - Set PROMETHEUS_USERNAME and PROMETHEUS_PASSWORD in `.env`
   - Verify credentials are correct

3. **Firewall blocking**
   - Check firewall rules
   - Verify port 9090 accessible
   - Test from different network

4. **Prometheus service down**
   - Check Prometheus service status
   - Verify Prometheus accessible from browser

---

### SQL Server Connection Failed

**Symptom:** `mcp__mssql__list_databases` fails

**Diagnosis:**
```bash
# Test connectivity (if you have sqlcmd)
sqlcmd -S chamdb.eladsolutions.local -U username -P password -Q "SELECT @@VERSION"
```

**Solutions:**

1. **Wrong hostname or instance**
   - Check MSSQL_HOST in `.env`
   - Format: `hostname\instancename` or `hostname,port`
   - Verify: `nslookup chamdb.eladsolutions.local`

2. **Authentication failed**
   - Check MSSQL_USER and MSSQL_PASSWORD
   - Try Windows auth: `DOMAIN\\username`
   - Try SQL auth: `sa` or service account

3. **SQL Server Browser not running**
   - Named instances require SQL Browser service
   - Verify service running on SQL Server host

4. **Firewall blocking**
   - Default port: 1433
   - Named instances use dynamic ports
   - Verify SQL Server accessible from your machine

5. **Encryption issues**
   - Try: `MSSQL_ENCRYPT=false`
   - Try: `MSSQL_TRUST_SERVER_CERTIFICATE=true`
   - For self-signed certs, trust certificate is required

---

### Azure DevOps Connection Failed

**Symptom:** `mcp__azure-devops__list_projects` fails

**Diagnosis:**
```bash
# Test connectivity
curl http://tfs:8080/tfs/DefaultCollection/_apis/projects?api-version=5.0

# With auth
curl -u :PAT_TOKEN http://tfs:8080/tfs/DefaultCollection/_apis/projects?api-version=5.0
```

**Solutions:**

1. **Wrong URL**
   - Check AZURE_DEVOPS_URL in `.env`
   - Format: `http://server:port/tfs`
   - Verify URL accessible in browser

2. **Invalid PAT**
   - Generate new PAT in Azure DevOps
   - Verify PAT has read permissions
   - Check PAT expiration date

3. **Wrong collection**
   - Check AZURE_DEVOPS_COLLECTION in `.env`
   - Common: "DefaultCollection"
   - List collections in browser: `http://tfs:8080/tfs/`

4. **Proxy issues**
   - Check proxy settings
   - Try bypassing proxy for internal servers

---

## Discovery Issues

### No SQL Instances Discovered

**Symptom:** sql-instance-discovery agent finds 0 instances

**Diagnosis:**
1. **Check Prometheus connectivity**
   ```
   mcp__prometheus__list_targets
   ```
   Should return targets. If error, see Prometheus connection issues above.

2. **Check for windows_exporter targets**
   ```
   mcp__prometheus__list_targets
   ```
   Look for entries with `job="windows_exporter"` and `instance="{hostname}:9182"`

**Solutions:**

1. **windows_exporter not configured**
   - Verify windows_exporter installed on application servers
   - Check Prometheus scrape config includes windows_exporter job
   - Verify port 9182 accessible

2. **Wrong job name**
   - Check Prometheus config for job name
   - If not "windows_exporter", modify agent code or contact support

3. **Targets down**
   - Check target health in Prometheus
   - Verify application servers running
   - Check windows_exporter service status on servers

**Workaround:**
If discovery consistently fails but you need to investigate:
- Manually specify instance names in commands
- Contact Infrastructure Team for investigation

---

### Fewer Instances Than Expected

**Symptom:** Discovery finds 15 instances but expecting 30+

**Causes:**

1. **Some targets down**
   - Check target health: `mcp__prometheus__get_target_health`
   - Verify which servers are down
   - Only "up" targets included in discovery

2. **Recent infrastructure changes**
   - Servers decommissioned
   - Servers not yet added to Prometheus
   - Maintenance window (servers offline)

3. **Prometheus scrape issues**
   - Check Prometheus logs
   - Verify scrape interval not too long
   - Check for scrape errors

**Verification:**
- Expected: 30-40+ instances typically
- If <20: Investigate (something likely wrong)
- If 20-30: May be normal (some servers down for maintenance)

---

## Performance Issues

### Commands Taking Too Long

**Symptom:** `/disk-space` takes >5 minutes

**Causes & Solutions:**

1. **Checking too many instances**
   - 35 instances * 5 seconds each = ~3 minutes (normal)
   - If >5 minutes, individual queries timing out

2. **SQL Server overloaded**
   - Queries timing out due to server load
   - Try during off-peak hours
   - Consider increasing timeout

3. **Network latency**
   - High latency to CHAMDB
   - Check network connection
   - Try from closer network location

**Optimization:**
- Use focused commands instead of `/incident-investigation` if you know specific issue
- `/db-health` faster than full investigation
- `/performance-analysis` on specific instance faster than all instances

---

### Discovery Times Out

**Symptom:** sql-instance-discovery agent never completes

**Solutions:**

1. **Prometheus query slow**
   - Prometheus may be overloaded
   - Try again during off-peak
   - Check Prometheus performance

2. **Network timeout**
   - Increase timeout in .mcp.json
   - Check network stability

**Workaround:**
- Cancel and retry
- Use `/db-health` which is faster (doesn't do full correlation)

---

## Command Issues

### Agent Not Invoked

**Symptom:** Command runs but agent never called

**Check:**
- Agent should be explicitly invoked by command
- Check agent name matches exactly
- Verify agent file exists in `agents/` directory

**Solutions:**

1. **Agent file missing**
   ```bash
   ls ~/.claude/plugins/infrastructure-plugin/agents/
   ```
   Should show 4 .md files. If missing, re-copy plugin.

2. **Agent frontmatter invalid**
   - Check YAML frontmatter in agent file
   - Verify `name:` field matches

3. **Command instruction unclear**
   - Commands should explicitly say "Invoke [agent-name] agent"
   - Check command file for invocation instructions

---

### Skill Not Loading

**Symptom:** Claude doesn't reference skill methodology

**Check:**
- Skills load automatically based on description matching
- Check skill frontmatter

**Solutions:**

1. **Skill file missing**
   ```bash
   ls ~/.claude/plugins/infrastructure-plugin/skills/*/SKILL.md
   ```
   Should show 2 SKILL.md files. If missing, re-copy plugin.

2. **Skill frontmatter invalid**
   - Check YAML frontmatter in SKILL.md
   - Verify `description:` field is clear

3. **Skill description doesn't match context**
   - Skills load based on conversation context
   - If investigating incident, aiops-investigation should load
   - If not loading, description may need adjustment

**Verification:**
During investigation, Claude should mention:
- "Following aiops-investigation methodology"
- "Referencing investigation patterns"
- "As described in the skill..."

---

### Command Produces No Results

**Symptom:** Command completes but shows no data

**Check:**
1. All MCP servers connected
2. Discovery succeeded
3. No error messages

**Solutions:**

1. **No data available**
   - Check if there actually are issues
   - `/db-health` may show no issues (good!)
   - `/disk-space` may show all <80% (good!)

2. **Filtering too restrictive**
   - Command may filter by environment
   - Try broader query

3. **Time range too narrow**
   - Azure DevOps queries default to 24h
   - Try longer time range if needed

---

## Getting Help

### Collect Diagnostic Information

Before contacting support, collect:

1. **Plugin version**
   ```
   /plugin list
   ```

2. **MCP server status**
   ```
   /mcp
   ```

3. **Error messages**
   - Copy exact error text
   - Include command that failed

4. **Environment**
   - OS and version
   - Claude Code version
   - Node.js version

5. **Connectivity tests**
   ```bash
   # Prometheus
   curl http://your-prometheus:9090/api/v1/targets

   # SQL Server
   sqlcmd -S your-server -Q "SELECT @@VERSION"

   # Azure DevOps
   curl http://your-tfs:8080/tfs/
   ```

### Contact Support

**Infrastructure Team:**
- Email: [email protected]
- Azure DevOps: Create issue in infrastructure-plugin project
- Slack/Teams: #infrastructure-ops channel

**Include in report:**
- What you were trying to do
- What happened instead
- Error messages
- Diagnostic information above
- What you've already tried

---

## Common Patterns

### Issue: Partial Failures

**Pattern:** Some operations succeed, others fail

**Approach:**
- Don't fail entire investigation
- Continue with available data
- Note what's missing in report
- Investigate failed components separately

**Example:**
```
✓ Prometheus: Connected
✓ SQL Server: Connected
✗ Azure DevOps: Connection failed

Continuing investigation with Prometheus and SQL Server data.
Deployment correlation not available (Azure DevOps unreachable).
```

### Issue: Conflicting Data

**Pattern:** Different systems show contradictory information

**Approach:**
- Note discrepancy in report
- Lower confidence level
- Investigate discrepancy as separate issue
- Trust most recent/reliable source

**Example:**
```
Prometheus shows high CPU at 14:30
SQL Server logs show normal activity at 14:30

Discrepancy noted. Confidence lowered to MEDIUM.
Possible causes: Clock skew, metric lag, separate issue.
```

---

## Prevention

### Regular Checks

Run weekly to prevent issues:

1. **Connectivity check**
   ```
   /db-health
   ```
   Should complete in <1 minute

2. **MCP server check**
   ```
   /mcp
   ```
   All 3 servers should be "ready"

3. **Discovery validation**
   ```
   /incident-investigation
   ```
   Cancel after discovery phase, verify 30+ instances found

### Keep Updated

1. **MCP servers auto-update**
   - Restart Claude Code weekly to get updates
   - npx @latest fetches newest versions

2. **Plugin updates**
   ```bash
   cd ~/.claude/plugins/infrastructure-plugin
   git pull
   ```
   - Check CHANGELOG.md for breaking changes
   - Restart Claude Code

### Credential Rotation

When rotating credentials:
1. Update `.env` file
2. Restart Claude Code
3. Verify connectivity with `/db-health`

---

Still having issues? Contact Infrastructure Team with diagnostic information above.
