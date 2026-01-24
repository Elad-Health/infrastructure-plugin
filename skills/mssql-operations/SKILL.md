---
name: mssql-operations
description: This skill should be used when working with SQL Server infrastructure. It provides operations knowledge for multi-instance environments, including instance discovery patterns, naming conventions, and operational best practices. Use when querying SQL Server, analyzing performance, or investigating database issues.
user-invocable: false
model: inherit
---

# MSSQL Operations Skill

You have deep knowledge of SQL Server operations in multi-instance environments, adaptable to any SQL Server infrastructure architecture.

## Infrastructure Architecture Patterns

### Pattern 1: Single Host, Multiple Named Instances

**Characteristics:**
- Single physical/virtual SQL Server host
- Multiple named SQL Server instances on the host
- Each instance serves different application/environment
- Shared physical resources (CPU, memory, disk)

**Connection Format:**
```
Server: hostname\INSTANCE_NAME
Example: sqlserver01\PROD_DB
```

### Pattern 2: Multiple Independent Servers

**Characteristics:**
- Separate SQL Servers for different environments
- Independent resources per server
- May be physical, virtual, or cloud

**Connection Format:**
```
Server: sql-prod.company.com
Server: sql-qa.company.com
```

### Pattern 3: Cloud Managed (Azure SQL, RDS)

**Characteristics:**
- Managed database services
- Individual databases, not instances
- Cloud-specific monitoring

**Connection Format:**
```
Server: yourserver.database.windows.net
Server: yourserver.us-east-1.rds.amazonaws.com
```

## Discovery-First Pattern

### Never Hardcode Instance Lists

**Wrong Approach:**
```python
instances = ["PROD_DB", "QA_DB", ...]  # Hardcoded - BAD
```

**Right Approach:**
```python
# Discover from Prometheus dynamically
instances = discover_instances_from_prometheus()  # GOOD
```

### Discovery Protocol

**Step 1: Always invoke `sql-instance-discovery` agent first**

Before ANY SQL Server operations:
1. Invoke the `sql-instance-discovery` agent
2. Wait for complete discovered list
3. Validate discovery results
4. Use discovered list for subsequent operations

**Step 2: Group by environment**

From discovered list:
- Separate Production vs QA vs Dev
- Use environment labels from Prometheus when available
- Fall back to name parsing if no labels

**Step 3: Detect architecture pattern**

From discovered hostnames:
- Multiple instances on same hostname → Shared-disk architecture
- Different hostnames → Independent servers
- Apply appropriate optimization strategy

## Environment Identification

### Common Naming Patterns

**Production Indicators:**
- Contains: `prod`, `production`, `prd`, `live`, `p01`
- Examples: `PROD_DB`, `sql-production`, `app-prd-01`

**QA/Test Indicators:**
- Contains: `qa`, `test`, `tst`, `uat`, `q01`
- Examples: `QA_DB`, `test-sql`, `app-uat-01`

**Development Indicators:**
- Contains: `dev`, `development`, `devel`, `d01`
- Examples: `DEV_DB`, `sql-dev`, `app-d01`

**Staging Indicators:**
- Contains: `stage`, `staging`, `stg`, `s01`
- Examples: `STAGING_DB`, `sql-stage`

**Case-insensitive matching** - works with any naming convention.

## SQL Server Operations

### Common MCP Operations

**Health Check:**
```
mcp__mssql__get_database_states(server="{discovered_instance}")
```

**Blocking Detection:**
```
mcp__mssql__get_blocking(server="{discovered_instance}")
```

**Expensive Queries:**
```
mcp__mssql__get_expensive_queries(server="{discovered_instance}", top=10, metric="cpu")
```

**Disk Space:**
```
mcp__mssql__get_disk_space(server="{discovered_instance}")
```

**Wait Stats:**
```
mcp__mssql__get_wait_stats(server="{discovered_instance}", top=10)
```

**Failed Jobs:**
```
mcp__mssql__get_failed_jobs(server="{discovered_instance}", hours=24)
```

### Resource Sharing Implications (Shared-Disk Architecture)

**When multiple instances share a host:**
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

### Independent Server Considerations

**When instances are on separate servers:**
- Each server has independent resources
- Disk space is per-server
- Performance issues are isolated

**Monitoring Strategy:**
- Query each server separately
- No shared-resource concerns
- Can investigate in parallel

## Storage Paths

### Never Assume Uniform Paths

**Critical Rule:** Always verify storage paths from actual data.

**Common Pattern (but VERIFY):**
- C: drive - OS, SQL binaries, system databases
- D: drive - User database data files (.mdf)
- L: drive - Transaction log files (.ldf)
- T: drive - tempdb files

**When Reporting Disk Space:**
- Read actual `file_path` from `get_disk_space()` results
- Report specific paths, not assumptions
- Good: "Database is on D:\Instance\Data\MyDB.mdf (65 GB)"
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
Try to connect to instance...
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

### 2. Architecture-Aware Operations

**Shared-Disk Architecture:**
- Disk space: Query 1-2 instances for drive info (shared drives return same info)
- Performance: Check if issue affects multiple instances

**Independent Servers:**
- Disk space: Query each server
- Performance: Check affected servers only

### 3. Verify From Data

Don't assume:
- Storage paths
- Instance availability
- Resource limits
- Configuration settings

Always verify from actual MCP tool results.

### 4. Token-Efficient Operations

**Shared-Disk (30+ instances):**
- Smart sampling for disk space (97% token reduction)
- Query 1-2 instances for drive-level info
- Only drill down if critical issue found

**Independent Servers:**
- Query each unique server
- No sampling benefit

### 5. Clear Error Reporting

If operation fails:
- State which instance
- State specific error
- Suggest troubleshooting
- Continue investigation (don't fail entirely)

## Application Server Correlation

### Mapping Pattern

**Prometheus monitors application servers:**
- `hostname:9182` (windows_exporter)

**SQL instances discovered:**
- `hostname\INSTANCE_NAME` or `hostname`

**Correlation:**
- High CPU on application server
- → Check corresponding SQL instance for expensive queries
- → Likely database queries causing application server load

### Incident Investigation Flow

1. Prometheus alert on application server
2. Extract server identifier
3. Map to SQL instance (from discovery)
4. Check expensive queries on SQL instance
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
2. Check disk space (architecture-aware)
3. Identify which database(s) large
4. Check transaction log sizes (often culprit)
5. Check for long-running transactions preventing log truncation

**Remediation (recommend to user):**
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

**Remediation (recommend to user):**
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

**Remediation (recommend to user):**
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

### Token Budget

When checking many instances:
- Use architecture-aware sampling
- Don't query all 30+ instances for disk space if shared-disk
- Progressive investigation: lightweight first, detailed where needed

### Caching

Discovery results valid for ~5 minutes:
- Can reuse discovered instance list
- Don't need to re-discover for every operation in same investigation

## Reference Files

For detailed guidance, see:

- [wait-types.md](./references/wait-types.md) - SQL Server wait type interpretation guide
- [common-issues.md](./references/common-issues.md) - Quick reference for diagnosing common SQL issues
