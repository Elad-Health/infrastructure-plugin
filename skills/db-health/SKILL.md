---
name: db-health
description: This skill should be used for quick database health checks across SQL Server instances. It verifies database states and identifies offline, suspect, or recovering databases. Use when the user asks about database health, wants to check if databases are online, or needs a quick SQL Server status.
user-invocable: true
argument-hint: "[environment]"
model: haiku
skills:
  - mssql-operations
---

# Database Health Check

Quick health check of all SQL Server databases across your infrastructure.

## Usage

```
/infrastructure-plugin:db-health
/infrastructure-plugin:db-health production
/infrastructure-plugin:db-health qa
```

## Arguments

- **No argument:** Check all discovered instances
- **Environment:** `production`, `qa`, `dev` - filter to specific environment

## What This Skill Does

1. **Discovery** - Gets SQL instance list from Prometheus
2. **Health Check** - Queries database states on all instances
3. **Issue Detection** - Flags any databases not ONLINE
4. **Summary Report** - Quick overview of database health

## Instructions

### Step 1: Discover Instances

Invoke `sql-instance-discovery` agent to get instance list.

Filter by `$ARGUMENTS` if environment specified.

### Step 2: Query Database States

For each instance, call:
```
mcp__mssql__get_database_states(server="{instance}")
```

This is a lightweight query (~500 tokens per instance).

### Step 3: Analyze Results

**Healthy States:**
- `ONLINE` - Normal operation

**Problem States (flag these):**
- `OFFLINE` - Database not accessible
- `SUSPECT` - Database may be corrupted
- `RECOVERING` - Database recovering from crash
- `RESTORING` - Database being restored
- `EMERGENCY` - Database in emergency mode

### Step 4: Generate Report

**Example - All Healthy:**
```
## Database Health Check ✅

Environment: All
Instances Checked: 31
Total Databases: 156

### Summary
✅ All 156 databases are ONLINE

### By Environment
- Production: 42 databases, all ONLINE
- QA: 78 databases, all ONLINE
- Development: 36 databases, all ONLINE

Last checked: {timestamp}
```

**Example - Issues Found:**
```
## Database Health Check ⚠️

Environment: Production
Instances Checked: 5
Total Databases: 42

### Issues Found

⚠️ Instance: SQLSERVER01\PROD_DB
   - Database: ReportingDB - SUSPECT
   - Database: ArchiveDB - OFFLINE

### Summary
- 40 databases ONLINE
- 1 database SUSPECT (requires investigation)
- 1 database OFFLINE (may be intentional)

### Recommended Actions

1. **ReportingDB (SUSPECT)**
   - Run DBCC CHECKDB to check for corruption
   - Review SQL Server error logs
   - Consider restoring from backup if corrupted

2. **ArchiveDB (OFFLINE)**
   - Verify if intentionally offline
   - If needed, bring online: ALTER DATABASE ArchiveDB SET ONLINE

Last checked: {timestamp}
```

## Performance

**Query Time:** 1-2 seconds per instance
**Token Usage:** ~500 tokens per instance, ~15-30k total
**Best For:** Daily health checks, quick status verification

For deeper investigation, use:
- `/infrastructure-plugin:incident-investigation` - Full incident analysis
- `/infrastructure-plugin:performance-analysis` - Performance deep dive
