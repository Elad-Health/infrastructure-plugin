---
name: quick-health
description: This skill should be used for fast infrastructure health checks. It runs lightweight queries across Prometheus, SQL Server, and Azure DevOps to quickly assess infrastructure status. Use when performing daily checks, quick status verification, or when the user asks "is everything healthy?" or "quick check".
user-invocable: true
argument-hint: "[environment]"
model: inherit
---

# Quick Health Check

Perform a fast infrastructure health check across Prometheus, SQL Server, and Azure DevOps.

## Usage

```
/infrastructure-plugin:quick-health
/infrastructure-plugin:quick-health production
```

## What This Skill Does

Runs lightweight health checks to quickly assess infrastructure status:

1. **Prometheus Alerts** - Check for any FIRING alerts
2. **SQL Database States** - Verify all databases are ONLINE
3. **Recent Deployments** - Check for deployments in last 24 hours
4. **Quick Summary** - Report overall health status

## Instructions

### Step 1: Check Prometheus Alerts

Call `mcp__prometheus__list_alerts()` to get current alert status.

**Report:**
- Number of FIRING alerts
- Number of PENDING alerts
- List any CRITICAL severity alerts

**If no alerts firing:** ✅ Prometheus: Healthy

### Step 2: Discover SQL Instances

Invoke `sql-instance-discovery` agent to get instance list.

**Filter by environment if specified:**
- If `$ARGUMENTS` contains "production" or "prod" → filter to production
- If `$ARGUMENTS` contains "qa" or "test" → filter to QA
- If `$ARGUMENTS` is empty → check all environments

### Step 3: Check Database States

For discovered instances (or sample if many), call:
```
mcp__mssql__get_database_states(server="{instance}")
```

**Report:**
- Total databases checked
- Any databases NOT in ONLINE state
- Flag OFFLINE, SUSPECT, RECOVERING as issues

**If all databases ONLINE:** ✅ SQL Server: Healthy

### Step 4: Check Recent Deployments

Call `mcp__azure-devops__list_builds(top=5)` for recent builds.

**Report:**
- Any builds in last 24 hours
- Build status (succeeded/failed)
- Note if recent deployment might explain any issues

**If no recent failed builds:** ✅ Azure DevOps: Healthy

### Step 5: Generate Summary

**Example Output - All Healthy:**
```
## Infrastructure Health Check ✅

Checked at: {timestamp}
Environment: {all/production/qa/dev}

### Prometheus
✅ No firing alerts
   - 0 FIRING, 0 PENDING

### SQL Server
✅ All databases online
   - Instances checked: 31
   - Databases: 124 total, 124 ONLINE

### Azure DevOps
✅ Recent builds healthy
   - Last 24h: 3 builds, all succeeded
   - No failed deployments

### Overall Status: HEALTHY ✅
```

**Example Output - Issues Found:**
```
## Infrastructure Health Check ⚠️

Checked at: {timestamp}
Environment: production

### Prometheus
⚠️ 2 alerts firing
   - CPUUsageHigh on prod-app-01 (CRITICAL)
   - DiskSpaceLow on sqlserver01 (WARNING)

### SQL Server
✅ All databases online
   - Instances checked: 5 (production)
   - Databases: 42 total, 42 ONLINE

### Azure DevOps
⚠️ Recent failed build
   - Build #1234 failed 2 hours ago
   - Project: MainApp

### Overall Status: NEEDS ATTENTION ⚠️

Recommended Actions:
1. Investigate CPU alert on prod-app-01
2. Check disk space on sqlserver01
3. Review failed build #1234
```

## Performance

**Expected Duration:** 10-30 seconds
**Token Usage:** ~5-15k tokens (lightweight queries)

This is designed for quick daily checks, not deep investigation.
For detailed analysis, use `/infrastructure-plugin:incident-investigation`.
