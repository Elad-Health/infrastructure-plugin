# Performance Analysis

Deep performance analysis of SQL Server instances to identify bottlenecks and expensive operations.

## Usage

```
/performance-analysis
```

Optional context:
- "Analyze V85X_PROD_DB performance"
- "Check production performance"
- "Users reporting slow queries"

## What This Command Does

Performs comprehensive performance analysis:

1. **Discovery** - Invokes `sql-instance-discovery` agent
2. **Expensive Queries** - Identifies resource-intensive queries
3. **Wait Stats** - Analyzes performance bottlenecks
4. **Blocking Detection** - Checks for blocking chains
5. **Recommendations** - Provides optimization suggestions

## Instructions

### Step 1: Discover SQL Instances

Invoke the `sql-instance-discovery` agent to get complete list of instances.

Prioritize based on context:
- If user specified instance → check that one
- If "production" mentioned → check Production instances first
- If no specification → check all Production instances

### Step 2: Check for Blocking

Blocking is often the #1 cause of performance issues.

For each target instance:
```
mcp__mssql__get_blocking(server="chamdb\\{instance}")
```

Returns:
- blocked_spid (session being blocked)
- blocking_spid (session causing block)
- wait_time_seconds
- blocked_query_text
- blocking_query_text

**Analyze Blocking Chain:**
- Identify head blocker (root of blocking chain)
- Count how many sessions are blocked
- Determine if blocker is legitimate (long operation) or stuck

### Step 3: Get Expensive Queries

Identify queries consuming most resources:

```
mcp__mssql__get_expensive_queries(
  server="chamdb\\{instance}",
  top=20,
  metric="cpu"
)
```

**Check Multiple Metrics:**
- CPU (processor time)
- Reads (logical I/O)
- Writes (physical I/O)
- Duration (elapsed time)
- Executions (frequency)

**Identify Patterns:**
- High CPU + many executions → needs optimization or caching
- High reads + low executions → missing index or table scan
- High duration → blocking, I/O wait, or complex query

### Step 4: Analyze Wait Stats

Wait stats show WHERE SQL Server is spending time:

```
mcp__mssql__get_wait_stats(
  server="chamdb\\{instance}",
  top=10,
  excludeIdle=true
)
```

**Common Wait Types:**

**I/O Waits:**
- PAGEIOLATCH_* - Waiting for data pages from disk
- WRITELOG - Waiting for transaction log writes
- **Cause:** Slow disk I/O, under-provisioned storage
- **Fix:** Add indexes, optimize queries, faster disks

**Lock Waits:**
- LCK_* - Waiting for locks
- **Cause:** Blocking, poor transaction management
- **Fix:** Kill blocker, optimize transactions, use NOLOCK hints (carefully)

**CPU Waits:**
- SOS_SCHEDULER_YIELD - CPU pressure
- **Cause:** Expensive queries, insufficient CPU
- **Fix:** Optimize queries, add CPU, limit concurrent queries

**Memory Waits:**
- RESOURCE_SEMAPHORE - Waiting for query memory grant
- **Cause:** Insufficient memory, large queries
- **Fix:** Increase SQL memory, optimize queries

**Network Waits:**
- ASYNC_NETWORK_IO - Waiting for client to consume results
- **Cause:** Client application slow to read results
- **Fix:** Application-side issue, not SQL Server

### Step 5: Correlation with Infrastructure

Check Prometheus for infrastructure metrics:

```
mcp__prometheus__query_windows_exporter(
  instance="{application_server}:9182",
  metric="cpu"
)
```

**Correlate:**
- High SQL CPU → Check application server CPU
- High WRITELOG waits → Check disk I/O on L: drive
- High PAGEIOLATCH waits → Check disk I/O on D: drive

### Step 6: Generate Report

**Performance Summary:**

**Instance: V85X_PROD_DB**

**Blocking Status:**
- CRITICAL: 15 sessions blocked by SPID 152
- Head blocker: SPID 152 running for 45 minutes
- Blocking query: UPDATE Orders SET Status = 'Processed' WHERE ...
- Recommendation: Kill SPID 152 (appears stuck)

**Top Expensive Queries (by CPU):**

1. **CustomerSearch query (12.5B CPU, 5M executions)**
   - Text: `SELECT * FROM Customers WHERE Name LIKE @param`
   - Issue: Full table scan, no index on Name column
   - Recommendation: Add index on Customers(Name)

2. **OrderReport query (8.2B CPU, 500K executions)**
   - Text: `SELECT * FROM Orders o JOIN OrderDetails od ...`
   - Issue: Missing join index
   - Recommendation: Add index on OrderDetails(OrderID)

3. **ProductInventory query (5.1B CPU, 2M executions)**
   - Executed very frequently
   - Recommendation: Consider caching at application layer

**Wait Stats Analysis:**

| Wait Type | Total Wait (sec) | % of Total | Issue |
|-----------|------------------|------------|-------|
| PAGEIOLATCH_SH | 3600 | 45% | Disk I/O bottleneck |
| LCK_M_U | 1800 | 23% | Blocking (see above) |
| SOS_SCHEDULER_YIELD | 1200 | 15% | CPU pressure |
| WRITELOG | 800 | 10% | Transaction log I/O |

**Primary Bottleneck:** Disk I/O (45% of wait time)

**Infrastructure Correlation:**
- Application server V85X_PROD: CPU 75%, Memory 60%
- Prometheus alerts: None currently firing
- Disk I/O on D: drive elevated (150 MB/s sustained)

**Recommendations:**

**Immediate (Today):**
1. Kill blocking SPID 152 to unblock 15 sessions
2. Add index on Customers(Name) for CustomerSearch query
3. Add index on OrderDetails(OrderID) for OrderReport query

**Short-term (This Week):**
4. Implement application-level caching for ProductInventory query
5. Review disk I/O performance (consider faster storage)
6. Set up alert for blocking chains >5 minutes

**Long-term (This Month):**
7. Query optimization review for top 10 expensive queries
8. Consider read replica for reporting queries
9. Implement connection pooling optimization

## Detailed Analysis Sections

### Blocking Chain Analysis

**Example Output:**
```
Blocking Chain Detected on V85X_PROD_DB:

Head Blocker: SPID 152
- Running for: 45 minutes
- Status: SLEEPING (waiting for application)
- Query: UPDATE Orders SET Status = 'Processed' ...
- Assessment: Appears stuck (application may have crashed)

Blocked Sessions (15 total):
- SPID 201 (waiting 43 min) - SELECT FROM Orders WHERE ...
- SPID 203 (waiting 42 min) - UPDATE Orders SET ...
- SPID 205 (waiting 40 min) - DELETE FROM Orders WHERE ...
[... 12 more]

Recommendation: Kill SPID 152 (KILL 152)
- Risk: Low (query appears stuck, not making progress)
- Impact: Will unblock 15 waiting sessions immediately
- Rollback: UPDATE will be rolled back (idempotent operation)
```

### Query Optimization Opportunities

**Example Output:**
```
Top Optimization Opportunities:

1. CustomerSearch Query (Impact: HIGH)
   Current: 5M executions/day, 2.5 sec avg duration
   Problem: Full table scan on 10M row table
   Solution: CREATE INDEX IX_Customers_Name ON Customers(Name)
   Expected improvement: 95% faster (0.1 sec avg)

2. OrderReport Query (Impact: MEDIUM)
   Current: 500K executions/day, 5 sec avg duration
   Problem: Missing join index
   Solution: CREATE INDEX IX_OrderDetails_OrderID ON OrderDetails(OrderID)
   Expected improvement: 70% faster (1.5 sec avg)

3. ProductInventory Query (Impact: MEDIUM)
   Current: 2M executions/day, 0.5 sec avg duration
   Problem: High frequency, simple query
   Solution: Application-level caching (5 minute TTL)
   Expected improvement: 90% reduction in DB calls
```

## Error Handling

If instance unreachable:
- Note connectivity issue
- Continue checking other instances
- Performance data from available instances still valuable

If queries timeout:
- Note timeout (instance may be overloaded)
- Try simpler queries
- This itself is a performance indicator

## Related Commands

- `/incident-investigation` - Full incident analysis
- `/db-health` - Quick health status
- `/disk-space` - If disk I/O is bottleneck
- `/deployment-impact` - If performance regression after deployment
