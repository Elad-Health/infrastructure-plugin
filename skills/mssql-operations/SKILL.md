---
name: mssql-operations
description: SQL Server operations knowledge for CHAMDB architecture with 30+ named instances. Provides instance discovery patterns, naming conventions, and operational best practices.
user-invocable: false
model: inherit
---

# MSSQL Operations Skill

You have deep knowledge of SQL Server operations in a multi-instance environment, specifically the CHAMDB architecture with 30+ named SQL Server instances.

## CHAMDB Architecture

### Single Host, Multiple Named Instances

**Host:** chamdb.eladsolutions.local

**Architecture:**
- Single physical/virtual SQL Server host
- 30-40+ named SQL Server instances on this host
- Each instance serves a different application/environment
- Shared physical resources (CPU, memory, disk)

### Instance Naming Convention

**Pattern:** `{APPLICATION}_{ENVIRONMENT}_DB`

**Examples:**
- V85X_PROD_DB - Version 85X Production
- V87X_PROD_DB - Version 87X Production
- V85X_PROD2_DB - Version 85X Production (secondary)
- V87X_QA_DB - Version 87X QA/Test
- V91X_DEV_DB - Version 91X Development
- SOLUTIONSDB_DB - Solutions Database

### Environment Identification

**Production Instances:**
- Contains "_PROD_" in name
- Contains "_PROD2_" in name (secondary production)
- Examples: V85X_PROD_DB, V87X_PROD2_DB

**QA/Test Instances:**
- Contains "_QA_" in name
- Examples: V87X_QA_DB, V91X_QA_DB, V92X_QA_DB

**Development Instances:**
- Contains "_DEV_" in name
- Examples: V85X_DEV_DB, V87X_DEV_DB, V91X_DEV_DB

**Other Instances:**
- Doesn't fit above patterns
- Examples: SOLUTIONSDB_DB, V10X_DEMO_DB

## Discovery-First Pattern

### Never Hardcode Instance Lists

**Wrong Approach:**
```python
instances = ["V85X_PROD_DB", "V87X_PROD_DB", ...]  # Hardcoded
```

**Right Approach:**
```python
# Discover from Prometheus
instances = discover_instances_from_prometheus()
```

### Discovery Protocol

**Step 1: Always invoke `sql-instance-discovery` agent first**

Before ANY SQL Server operations:
1. Invoke the `sql-instance-discovery` agent
2. Wait for complete discovered list
3. Validate discovery (30+ instances expected)
4. Use discovered list for subsequent operations

**Step 2: Group by environment**

From discovered list:
- Separate Production vs QA vs Dev
- Prioritize based on incident scope

**Step 3: Target relevant instances**

- If incident specifies system (e.g., "V85X_PROD slow"), check that instance
- If disk space issue, check ALL instances (shared disk)
- If performance issue, check Production instances first, then others

## SQL Server Operations

### Connection Format

**Named Instance:**
```
Server: chamdb.eladsolutions.local\V85X_PROD_DB
Authentication: Windows or SQL Auth
```

**MCP Server Default:**
```
MSSQL_HOST=chamdb.eladsolutions.local
# Then specify instance in server parameter: "chamdb.eladsolutions.local\V85X_PROD_DB"
```

### Common Operations

**Health Check:**
```
mcp__mssql__get_database_states(server="chamdb\\V85X_PROD_DB")
```

**Blocking Detection:**
```
mcp__mssql__get_blocking(server="chamdb\\V85X_PROD_DB")
```

**Expensive Queries:**
```
mcp__mssql__get_expensive_queries(server="chamdb\\V85X_PROD_DB", top=10, metric="cpu")
```

**Disk Space:**
```
mcp__mssql__get_disk_space(server="chamdb\\V85X_PROD_DB")
```

**Wait Stats:**
```
mcp__mssql__get_wait_stats(server="chamdb\\V85X_PROD_DB", top=10)
```

**Failed Jobs:**
```
mcp__mssql__get_failed_jobs(server="chamdb\\V85X_PROD_DB", hours=24)
```

### Resource Sharing Implications

**Shared Resources:**
- All 30+ instances share same physical host
- CPU cores shared across all instances
- Memory shared (with instance max settings)
- Disk I/O bandwidth shared
- Network bandwidth shared

**Noisy Neighbor Problem:**
- One instance consuming high CPU affects all others
- One instance filling disk affects all instances on that drive
- One instance doing heavy disk I/O slows all instances

**Monitoring Strategy:**
- Check multiple instances, not just one
- Disk space issues: Check ALL instances (shared drives)
- Performance issues: Check if other instances also affected

## Storage Paths

### Never Assume Uniform Paths

**Critical Rule:** Always verify storage paths from actual data.

**Common Pattern (but VERIFY):**
- C: drive - OS, SQL binaries, system databases
- D: drive - User database data files (.mdf)
- L: drive - Transaction log files (.ldf)
- T: drive - tempdb files

**Per-Instance Subdirectories:**
```
D:\V85X_PROD_DB\Data\MyDatabase.mdf
D:\V85X_PROD_DB\Logs\MyDatabase_log.ldf
```

**When Reporting Disk Space:**
- Read actual file_path from `get_disk_space()` results
- Report specific paths, not assumptions
- Good: "Chameleon database is on D:\V85X_QA_DB\Data\Chameleon.mdf (65 GB)"
- Bad: "All databases are on D:" (unverified generalization)

## Error Handling

### Instance Unreachable

**Possible Causes:**
- Instance name misspelled
- Instance not running (stopped service)
- Network connectivity issue
- Authentication failure
- Firewall blocking

**Handling:**
```
Try to connect to instance V85X_PROD_DB...
Error: Cannot connect

Actions:
1. Verify instance name from discovery (typo?)
2. Check if other instances on same host reachable (host vs instance issue?)
3. Note error clearly in report
4. Continue investigation with other instances
5. Do NOT fail entire investigation
```

### Timeout Issues

**Causes:**
- Instance heavily loaded
- Query timeout too short
- Network latency

**Handling:**
- Note timeout in report
- Try simpler query if possible
- Continue with other operations
- Mention in investigation quality metadata

## Best Practices

### 1. Discovery First, Always

Every command/investigation MUST start with:
```
Invoke sql-instance-discovery agent → Get complete list → Proceed with operations
```

### 2. Check Multiple Instances

Don't assume one instance status applies to all:
- Disk space: Check ALL (shared resource)
- Performance: Check multiple to identify scope
- Deployment: Check relevant instances based on deployment target

### 3. Verify From Data

Don't assume:
- Storage paths
- Instance availability
- Resource limits
- Configuration settings

Always verify from actual MCP tool results.

### 4. Parallel Operations Where Possible

If checking 30+ instances for disk space:
- Can run queries in parallel
- Aggregate results
- Report summary + details

### 5. Clear Error Reporting

If operation fails:
- State which instance
- State specific error
- Suggest troubleshooting
- Continue investigation (don't fail entirely)

## Application Server Correlation

### Mapping Pattern

**Prometheus monitors application servers:**
- V85X_PROD:9182 (windows_exporter)
- Hostname: V85X_PROD

**SQL instances on CHAMDB:**
- V85X_PROD_DB (named instance)

**Correlation:**
- High CPU on V85X_PROD application server
- → Check V85X_PROD_DB SQL instance for expensive queries
- → Likely database queries causing application server load

### Incident Investigation Flow

1. Prometheus alert: CPUUsageHigh on V85X_PROD:9182
2. Extract hostname: V85X_PROD
3. Map to SQL instance: V85X_PROD_DB
4. Check expensive queries on V85X_PROD_DB
5. Identify problematic query
6. Correlate with recent deployment (Azure DevOps)

## Common Incident Patterns

### Pattern: Disk Space Exhaustion

**Symptoms:**
- Transaction log cannot grow
- Insert/update operations fail
- Backups fail

**Investigation:**
1. Discover all instances
2. Check disk space on ALL instances (shared drives)
3. Identify which database(s) large
4. Check transaction log sizes (often culprit)
5. Check for long-running transactions preventing log truncation

**Remediation:**
- Free up space (delete old backups, compress files)
- Shrink transaction log (if safe - after log backup)
- Kill long-running transaction (if blocking log truncation)

### Pattern: Blocking Chain

**Symptoms:**
- Queries slow or timing out
- Users reporting delays
- Application unresponsive

**Investigation:**
1. Call `get_blocking()` on affected instance
2. Identify head blocker (root of blocking chain)
3. Check what head blocker is doing (query text)
4. Determine if blocker is legitimate (long operation) or stuck

**Remediation:**
- Kill head blocker session (if stuck/orphaned)
- Optimize blocking query (if legitimate but slow)
- Application code change (better transaction management)

### Pattern: Expensive Query After Deployment

**Symptoms:**
- High CPU on application server
- High CPU on SQL instance
- Slow queries after deployment

**Investigation:**
1. Get expensive queries on affected instance
2. Review recent deployment (Azure DevOps)
3. Identify SQL code changes in deployment
4. Match expensive query to changed code

**Remediation:**
- Rollback deployment
- Optimize query
- Add index
- Redeploy with fix

## Security Considerations

### Read-Only Operations

Plugin uses read-only MCP tools:
- `get_` operations (safe)
- `list_` operations (safe)
- `execute_query` with SELECT only (safe)

### No Destructive Operations

Plugin does NOT:
- Kill sessions (recommendation only)
- Modify data
- Change configuration
- Execute DDL/DML

All remediation actions require human approval and execution.

## Performance Considerations

### Query Timeouts

Some operations on heavily-loaded instances may timeout:
- `get_expensive_queries()` - can be slow
- `get_wait_stats()` - usually fast
- `get_blocking()` - usually fast

Set appropriate timeouts (30-60 seconds).

### Parallel Operations

When checking 30+ instances:
- Parallel queries can reduce total time
- But: May overload CHAMDB if too aggressive
- Recommend: 5-10 concurrent queries max

### Caching

Discovery results valid for ~5 minutes:
- Can reuse discovered instance list
- Don't need to re-discover for every operation in same investigation
