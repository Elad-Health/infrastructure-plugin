# Database Health Check

Quick health check across all SQL Server instances to identify critical issues.

## Usage

```
/db-health
```

Optional: Specify environment to focus on
- "Check production databases"
- "Check QA environment"

## What This Command Does

Performs a rapid health assessment of all SQL Server instances:

1. **Discovery** - Invokes `sql-instance-discovery` agent
2. **Health Check** - Checks database states across all instances
3. **Critical Issues** - Flags any databases offline, recovering, or suspect
4. **Summary** - Provides quick overview of overall health

## Instructions

### Step 1: Discover SQL Instances

Invoke the `sql-instance-discovery` agent to get complete list of instances.

Expected: 30-40+ instances grouped by environment (Production/QA/Dev).

### Step 2: Check Database States

For each discovered instance, call:
```
mcp__mssql__get_database_states(server="chamdb\\{instance_name}")
```

This returns all databases with their states:
- ONLINE (healthy)
- OFFLINE (not accessible)
- RESTORING (backup being restored)
- RECOVERING (startup recovery)
- RECOVERY_PENDING (recovery stuck)
- SUSPECT (database corruption suspected)
- EMERGENCY (emergency mode)

### Step 3: Identify Critical Issues

Flag any databases NOT in ONLINE state:
- **CRITICAL:** SUSPECT, EMERGENCY, RECOVERY_PENDING
- **WARNING:** OFFLINE, RECOVERING (if prolonged)
- **INFO:** RESTORING (if expected)

### Step 4: Generate Report

**Healthy Systems:**
- List instances with all databases ONLINE
- Count: X/Y instances healthy

**Issues Found:**
- Instance: V87X_QA_DB
  - Database: MyDatabase - State: SUSPECT - Action Required
- Instance: V91X_DEV_DB
  - Database: TestDB - State: OFFLINE - Investigate

**Summary:**
- Total instances checked: 35
- Healthy: 33 (94%)
- Issues found: 2 (6%)
- Critical issues requiring immediate attention: 1

## Error Handling

If instance unreachable:
- Note connectivity issue
- Continue checking other instances
- Report at end: "Unable to check: V10X_DEMO_DB (connection failed)"

## Quick vs Comprehensive

This command provides quick health status.

For comprehensive investigation, use:
- `/incident-investigation` - Full multi-system analysis
- `/performance-analysis` - Deep performance dive
- `/disk-space` - Detailed disk analysis
