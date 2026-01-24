---
name: disk-space
description: This skill should be used for disk space analysis across SQL Server infrastructure. It uses architecture-aware optimization to minimize token usage while providing comprehensive drive analysis. Use when investigating disk space alerts, checking storage capacity, or when users ask about disk usage or "is disk full?".
user-invocable: true
argument-hint: "[instance|environment|threshold]"
model: sonnet
skills:
  - mssql-operations
---

# Disk Space Analysis

Comprehensive disk space analysis across all SQL Server instances with architecture-aware optimization.

## Usage

```
/infrastructure-plugin:disk-space
/infrastructure-plugin:disk-space production
/infrastructure-plugin:disk-space >90%
/infrastructure-plugin:disk-space SQLSERVER01\PROD_DB
```

## Arguments

- **No argument:** Analyze all discovered infrastructure
- **Environment:** `production`, `qa`, `dev` - filter to specific environment
- **Threshold:** `>90%`, `>80%` - show only drives above threshold
- **Instance name:** Check specific instance only

## What This Skill Does

1. **Discovery** - Automatically discovers SQL instances from Prometheus
2. **Architecture Detection** - Identifies shared-disk vs independent servers
3. **Smart Sampling** - Queries optimally based on architecture
4. **Critical Identification** - Flags drives >90% full
5. **Recommendations** - Provides remediation guidance

## Token Efficiency

**Shared-Disk Architecture (30+ instances on one server):**
- Queries only 1-2 representative instances
- All instances share same physical drives
- Token usage: ~15-30k (97% reduction vs naive approach)

**Independent Servers:**
- Queries each unique server
- Token usage scales with server count, not instance count

## Instructions

### Step 1: Discover Infrastructure

Invoke `sql-instance-discovery` agent to get:
- Complete instance list
- Architecture pattern (shared-disk vs independent)
- Environment grouping

### Step 2: Apply Filters

If `$ARGUMENTS` specified:
- Environment filter: `production` → only production instances
- Threshold filter: `>90%` → only report drives above threshold
- Instance filter: specific instance name → query only that instance

### Step 3: Query Disk Space (Architecture-Optimized)

**Shared-Disk Architecture:**
```
# Query 1-2 representative instances only
mcp__mssql__get_disk_space(server="{first_discovered_instance}")
```
Drive info is identical across all instances on same host.

**Independent Servers:**
```
# Query one instance per unique hostname
for each unique_hostname:
    mcp__mssql__get_disk_space(server="{instance_on_hostname}")
```

### Step 4: Analyze Results

Extract drive-level information:
- Drive letter
- Total capacity
- Used space
- Free space
- Percentage used

**Thresholds:**
- **CRITICAL (>90%):** Immediate action required
- **WARNING (80-90%):** Monitor closely
- **HEALTHY (<80%):** Normal operation

### Step 5: Deep Dive on Critical

If any drive >90%, investigate further:
- Query additional instances to find largest databases
- Identify transaction logs vs data files
- Check for growth patterns

### Step 6: Generate Report

**Format for Shared-Disk:**
```
## Disk Space Analysis

Server: {hostname}
Instances: {count} (shared-disk architecture)
Architecture: All instances share physical drives

### Drive Summary

✅ Drive C: (System)
   Total: 120 GB | Used: 68 GB (56.7%) | Free: 52 GB

⚠️ Drive D: (SQL Data)
   Total: 2,000 GB | Used: 1,750 GB (87.5%) | Free: 250 GB
   Status: WARNING - approaching capacity

✅ Drive E: (SQL Data)
   Total: 2,000 GB | Used: 820 GB (41.0%) | Free: 1,180 GB

✅ Drive F: (SQL Logs)
   Total: 1,000 GB | Used: 550 GB (55.0%) | Free: 450 GB

### Overall Storage
Total Capacity: 5,120 GB
Total Used: 3,188 GB (62.3%)
Total Free: 1,932 GB

### Recommendations
- Monitor Drive D: - approaching 90% threshold
- Consider moving databases to Drive E: (more free space)
```

**Format for Independent Servers:**
```
## Disk Space Analysis

Servers: {count} independent SQL Servers

### Server: sql-prod.company.com
✅ Drive C: 100 GB total, 45 GB used (45%)
⚠️ Drive D: 500 GB total, 450 GB used (90%) - WARNING

### Server: sql-qa.company.com
✅ Drive C: 100 GB total, 42 GB used (42%)
✅ Drive D: 500 GB total, 210 GB used (42%)

### Summary
- 1 drive needs attention (sql-prod D:)
- 3 drives healthy
```

## Remediation Guidance

**For Large Transaction Logs:**
1. Check for long-running transactions: `mcp__mssql__get_blocking()`
2. Backup transaction log to allow truncation
3. Shrink log file after backup

**For Large Data Files:**
1. Identify largest databases in results
2. Consider data archiving
3. Enable compression if not enabled
4. Add storage capacity

**For Critical Disk Space (<10% free):**
1. **Immediate:** Free up space or add capacity
2. **Short-term:** Archive old data, shrink logs
3. **Long-term:** Capacity planning, storage expansion
