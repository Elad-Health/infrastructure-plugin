# Common SQL Server Issues Reference

Quick reference for diagnosing and resolving common SQL Server issues.

## Issue: Blocking Sessions

### Symptoms
- Queries timing out
- Application hangs
- Users reporting delays
- High `LCK_*` wait types

### Diagnosis
```
mcp__mssql__get_blocking(server="{instance}")
```

### Key Fields to Check
- `head_blocker` - Root cause of blocking chain
- `blocked_count` - Number of affected sessions
- `wait_time_ms` - How long blocked
- `wait_resource` - What's being waited on

### Resolution Options
1. **Kill head blocker** (if stuck/orphaned):
   - Only if wait time is excessive (>minutes)
   - User must approve: `KILL {spid}`

2. **Optimize blocking query**:
   - Add appropriate indexes
   - Shorten transaction scope
   - Use `NOLOCK` hint if appropriate

3. **Application changes**:
   - Implement retry logic
   - Use shorter transactions
   - Add timeout handling

## Issue: High CPU Usage

### Symptoms
- CPU consistently >80%
- Slow query response
- `SOS_SCHEDULER_YIELD` waits
- `CXPACKET` waits

### Diagnosis
```
mcp__mssql__get_expensive_queries(server="{instance}", metric="cpu", top=10)
```

### Key Fields to Check
- `total_worker_time` - CPU time
- `execution_count` - How often called
- `avg_worker_time` - Per-execution CPU

### Resolution Options
1. **Optimize top CPU consumers**:
   - Add missing indexes
   - Rewrite inefficient queries
   - Update statistics

2. **Review execution plans**:
   - Look for scans vs seeks
   - Check for implicit conversions
   - Identify missing indexes

3. **Configuration**:
   - Review MAXDOP settings
   - Consider Resource Governor

## Issue: Disk Space Exhaustion

### Symptoms
- Transaction log cannot grow
- Inserts/updates failing
- Backup failures
- Error 1105 or 9002

### Diagnosis
```
mcp__mssql__get_disk_space(server="{instance}")
```

### Key Fields to Check
- `percent_used` - Drive utilization
- `file_type` - DATA vs LOG
- `size_mb` - File sizes
- `file_path` - Actual location

### Resolution Options

**For Transaction Logs:**
1. Check for long-running transactions:
   ```
   mcp__mssql__get_blocking(server="{instance}")
   ```
2. Backup transaction log (allows truncation)
3. After backup, shrink if needed

**For Data Files:**
1. Archive old data
2. Enable compression
3. Add storage capacity

## Issue: Memory Pressure

### Symptoms
- `RESOURCE_SEMAPHORE` waits
- High page life expectancy drops
- Frequent buffer pool flushes
- Slow query compilation

### Diagnosis
```
mcp__mssql__get_wait_stats(server="{instance}", top=10)
```

### Resolution Options
1. **Add memory** to server
2. **Optimize memory-heavy queries**:
   - Reduce result set sizes
   - Add indexes to reduce scans
3. **Review max server memory setting**
4. **Check for memory leaks** in applications

## Issue: Slow Queries After Deployment

### Symptoms
- Performance degraded after deployment
- Specific queries suddenly slow
- Users reporting issues since release

### Diagnosis
```
mcp__mssql__get_expensive_queries(server="{instance}", metric="reads", top=10)
mcp__azure-devops__list_builds(top=5)
```

### Correlation Pattern
1. Get deployment time from Azure DevOps
2. Get expensive queries
3. Match query text to deployed code changes
4. Identify regression

### Resolution Options
1. **Rollback deployment** if critical
2. **Hotfix the query** with optimization
3. **Add index** if missing
4. **Update statistics** if stale

## Issue: Failed SQL Agent Jobs

### Symptoms
- Scheduled tasks not running
- Data not updated
- Missing reports
- Backup failures

### Diagnosis
```
mcp__mssql__get_failed_jobs(server="{instance}", hours=24)
```

### Key Fields to Check
- `job_name` - Which job failed
- `step_name` - Which step failed
- `message` - Error details
- `run_datetime` - When it failed

### Common Causes
1. **Permissions** - Job owner lacks access
2. **Disk space** - No room for output
3. **Blocking** - Job queries blocked
4. **Dependencies** - External system unavailable
5. **Timeout** - Job exceeded time limit

## Issue: Connection Failures

### Symptoms
- "Cannot connect to server"
- Intermittent connection drops
- Login failures

### Diagnosis Checklist
1. **Network connectivity** - Can reach server?
2. **SQL Server running** - Service started?
3. **Authentication** - Credentials correct?
4. **Firewall** - Port 1433 open?
5. **Max connections** - Connection pool exhausted?

### Resolution
- Verify server name/instance name
- Check SQL Server Configuration Manager
- Review SQL Server error logs
- Check network firewall rules

## Issue: Always On Availability Group Problems

### Symptoms
- Secondary not synchronizing
- Failover failures
- Data loss warnings

### Diagnosis
```
mcp__mssql__get_ag_status(server="{instance}")
mcp__mssql__get_replica_states(server="{instance}")
```

### Key Fields to Check
- `synchronization_state` - Should be SYNCHRONIZED
- `synchronization_health` - Should be HEALTHY
- `connected_state` - Should be CONNECTED

### Common Issues
1. **Network latency** - Between replicas
2. **Disk throughput** - Log shipping can't keep up
3. **Configuration** - Endpoint issues

## Quick Reference: MCP Tool Selection

| Issue Type | Primary Tool | Secondary Tool |
|------------|--------------|----------------|
| Blocking | `get_blocking` | `get_wait_stats` |
| Performance | `get_expensive_queries` | `get_wait_stats` |
| Disk Space | `get_disk_space` | - |
| Job Failures | `get_failed_jobs` | - |
| Health Check | `get_database_states` | `get_blocking` |
| Memory | `get_wait_stats` | `get_expensive_queries` |
| CPU | `get_expensive_queries` | `get_wait_stats` |
