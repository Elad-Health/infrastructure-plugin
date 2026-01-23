# Disk Space Analysis

Comprehensive disk space analysis across all SQL Server instances to identify storage issues.

## Usage

```
/disk-space
```

Optional threshold:
- "Show instances over 90% full"
- "Check disk space on V87X_QA_DB"

## What This Command Does

Analyzes disk usage across all SQL Server instances:

1. **Discovery** - Invokes `sql-instance-discovery` agent
2. **Disk Check** - Checks disk space on ALL instances (shared drives)
3. **Identify Critical** - Flags instances >90% full
4. **Report Paths** - Shows actual storage paths (never assumes)

## Instructions

### Step 1: Discover SQL Instances

Invoke the `sql-instance-discovery` agent to get complete list of instances.

**Critical:** Check ALL instances because disk drives are shared.
- All instances on D: share the same D: drive
- One instance filling disk affects all instances

### Step 2: Check Disk Space on All Instances

For each discovered instance, call:
```
mcp__mssql__get_disk_space(server="chamdb\\{instance_name}")
```

This returns:
- database_name
- file_type (DATA or LOG)
- file_path (actual path on disk)
- size_mb
- used_mb
- free_mb
- percent_used

### Step 3: Analyze Storage Paths

**CRITICAL:** Read actual file_path from data. Never assume.

Group results by:
- Drive letter (C:, D:, L:, T:, etc.)
- File type (DATA files vs LOG files)
- Instance

Example:
```
D: Drive (Shared):
- V85X_PROD_DB databases: 150 GB
- V87X_PROD_DB databases: 200 GB
- V87X_QA_DB databases: 180 GB
- Total D: usage: 530 GB / 1000 GB (53%)

L: Drive (Shared):
- V85X_PROD_DB logs: 50 GB
- V87X_PROD_DB logs: 80 GB
- V87X_QA_DB logs: 120 GB (WARNING: Large log file)
- Total L: usage: 250 GB / 500 GB (50%)
```

### Step 4: Identify Critical Issues

**Thresholds:**
- **CRITICAL (>90%):** Immediate action required
- **WARNING (80-90%):** Monitor closely
- **NORMAL (<80%):** Acceptable

**Critical Issues:**
- Flag any drive >90% full
- Identify which databases are largest
- Check for unusually large transaction logs

**Example:**
```
CRITICAL: V87X_QA_DB
- L:\V87X_QA_DB\Logs\Chameleon_log.ldf: 115 GB (96% of drive)
- Likely long-running transaction preventing log truncation
- Recommend: Investigate active transactions, backup log, shrink if safe
```

### Step 5: Generate Report

**Summary:**
- Total instances checked: 35
- Critical (>90%): 2 instances
- Warning (80-90%): 5 instances
- Normal (<80%): 28 instances

**Critical Issues Requiring Immediate Attention:**

**Instance: V87X_QA_DB**
- Drive: L: (96% full)
- Large file: Chameleon_log.ldf (115 GB)
- Path: L:\V87X_QA_DB\Logs\Chameleon_log.ldf
- Recommendation: Backup transaction log, check for long-running transactions

**Instance: V91X_DEV_DB**
- Drive: D: (92% full)
- Large database: TestData (85 GB)
- Path: D:\V91X_DEV_DB\Data\TestData.mdf
- Recommendation: Archive or delete old test data

**Detailed Breakdown by Drive:**

**D: Drive (1000 GB total, 53% used):**
- Instance: V85X_PROD_DB - 150 GB
  - Database: Chameleon - 80 GB (D:\V85X_PROD_DB\Data\Chameleon.mdf)
  - Database: Orders - 45 GB (D:\V85X_PROD_DB\Data\Orders.mdf)
  - Database: Products - 25 GB (D:\V85X_PROD_DB\Data\Products.mdf)
- Instance: V87X_PROD_DB - 200 GB
  - [details...]
- Instance: V87X_QA_DB - 180 GB
  - [details...]

**L: Drive (500 GB total, 50% used):**
- [Similar breakdown for log files...]

## Storage Path Verification

**Report actual paths from data:**

✅ Good:
- "Chameleon database data file is on D:\V85X_QA_DB\Data\Chameleon.mdf (65 GB)"
- "Transaction log is on L:\V85X_QA_DB\Logs\Chameleon_log.ldf (115 GB)"

❌ Bad:
- "All instances use D: for data" (unverified assumption)
- "Logs are on L:" (not always true, verify from data)

## Remediation Recommendations

**For Large Transaction Logs:**
1. Check for active long-running transactions:
   ```
   mcp__mssql__get_blocking(server="chamdb\\{instance}")
   ```
2. Backup transaction log (allows truncation):
   ```sql
   BACKUP LOG [DatabaseName] TO DISK = 'path\backup.trn'
   ```
3. Shrink log file (only after backup):
   ```sql
   DBCC SHRINKFILE([LogFileName], target_size_mb)
   ```

**For Large Data Files:**
1. Identify which tables are largest
2. Archive old data if possible
3. Consider compression
4. Add more disk space if needed

## Error Handling

If instance unreachable:
- Note connectivity issue
- Continue checking other instances
- Partial data is still valuable (shared drives)

## Related Commands

- `/incident-investigation` - If disk space caused incident
- `/db-health` - Quick health check
- `/performance-analysis` - If disk I/O causing performance issues
