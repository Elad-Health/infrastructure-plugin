# Workflows and Usage Examples

Complete examples of using the Infrastructure Plugin for real incident investigations.

## Table of Contents

1. [Quick Health Check](#quick-health-check)
2. [Disk Space Incident](#disk-space-incident)
3. [Performance Degradation](#performance-degradation)
4. [Deployment-Related Issue](#deployment-related-issue)
5. [Complete Incident Investigation](#complete-incident-investigation)

---

## Quick Health Check

**Use Case:** Daily health check, quick status verification

**Command:**
```
/db-health
```

**Example Output:**
```
Discovery Phase:
Invoking sql-instance-discovery agent...

Discovered SQL instances from Prometheus (35 total):

Production:
- V85X_PROD_DB
- V87X_PROD_DB
- V85X_PROD2_DB
[... 12 more]

QA/Test:
- V87X_QA_DB
- V91X_QA_DB
[... 10 more]

Development:
- V85X_DEV_DB
- V87X_DEV_DB
[... 6 more]

Health Check Results:
Checking database states across 35 instances...

✓ V85X_PROD_DB: 5 databases, all ONLINE
✓ V87X_PROD_DB: 8 databases, all ONLINE
✓ V85X_PROD2_DB: 3 databases, all ONLINE
✓ V87X_QA_DB: 6 databases, all ONLINE
❌ V91X_DEV_DB: 4 databases, 1 SUSPECT

Critical Issues:
- V91X_DEV_DB: TestDatabase in SUSPECT state
  - Likely database corruption
  - Recommend: Run DBCC CHECKDB, restore from backup if needed

Summary:
- Total instances checked: 35
- Healthy: 34 (97%)
- Issues found: 1 (3%)
- Critical: 1 (requires immediate attention)
```

**Time:** <1 minute

---

## Disk Space Incident

**Scenario:** Alert fires for disk space >90% full

**Command:**
```
/disk-space
```

**Example Output:**
```
Discovery Phase:
✓ Discovered 35 SQL instances

Disk Space Analysis:
Checking ALL instances (shared drives)...

Summary:
- Total instances checked: 35
- Critical (>90%): 2 instances
- Warning (80-90%): 3 instances
- Normal (<80%): 30 instances

CRITICAL ISSUES:

Instance: V87X_QA_DB
Drive: L: (96% full - 480 GB / 500 GB used)
Large file: Chameleon_log.ldf (115 GB)
Path: L:\V87X_QA_DB\Logs\Chameleon_log.ldf

Analysis:
- Transaction log consuming 96% of L: drive
- Log growth likely due to long-running transaction
- Checked blocking: SPID 152 running for 8 hours (UPDATE statement)

Recommendation:
1. Kill blocking SPID 152 (appears stuck)
   Command: KILL 152
   Risk: Low (will rollback stuck transaction)

2. Backup transaction log:
   BACKUP LOG [Chameleon] TO DISK = 'C:\Backup\Chameleon_log.trn'

3. Shrink log file:
   DBCC SHRINKFILE([Chameleon_log], 10240)  -- Shrink to 10 GB

Expected Recovery: Free 105 GB on L: drive

---

Instance: V91X_DEV_DB
Drive: D: (92% full - 920 GB / 1000 GB used)
Large database: TestData (85 GB)
Path: D:\V91X_DEV_DB\Data\TestData.mdf

Analysis:
- Test database consuming significant space
- Contains data from 2023 (likely no longer needed)

Recommendation:
1. Archive or delete old test data
2. Or: Move to different server (development instance)

---

Detailed Breakdown:

D: Drive (1000 GB total, 860 GB used, 86%):
- V85X_PROD_DB: 150 GB
  - Chameleon: 80 GB (D:\V85X_PROD_DB\Data\Chameleon.mdf)
  - Orders: 45 GB (D:\V85X_PROD_DB\Data\Orders.mdf)
  - Products: 25 GB (D:\V85X_PROD_DB\Data\Products.mdf)
- V87X_PROD_DB: 200 GB
- V87X_QA_DB: 180 GB
- V91X_DEV_DB: 330 GB (includes 85 GB TestData - see above)

L: Drive (500 GB total, 480 GB used, 96%):
- V85X_PROD_DB logs: 50 GB
- V87X_PROD_DB logs: 80 GB
- V87X_QA_DB logs: 235 GB (includes 115 GB Chameleon_log - see above)
- V91X_DEV_DB logs: 115 GB
```

**Time:** 2-3 minutes (checking 35 instances)

**Follow-up Actions:**
1. Kill stuck SPID
2. Backup and shrink log
3. Schedule old data archival

---

## Performance Degradation

**Scenario:** Users report slow application performance

**Command:**
```
/performance-analysis

Users reporting slow performance on V85X_PROD
```

**Example Output:**
```
Discovery Phase:
✓ Discovered 35 SQL instances
✓ Focusing on V85X_PROD_DB based on user report

Performance Analysis: V85X_PROD_DB

Blocking Status:
❌ CRITICAL: 15 sessions blocked by SPID 152

Head Blocker: SPID 152
- Status: SLEEPING (waiting for application)
- Running for: 45 minutes
- Query: UPDATE Orders SET Status = 'Processed' WHERE OrderID = @OrderID
- Database: Chameleon
- Assessment: Appears stuck (application may have crashed)

Blocked Sessions (15 total):
- SPID 201 (waiting 43 min): SELECT * FROM Orders WHERE ...
- SPID 203 (waiting 42 min): UPDATE Orders SET ...
- SPID 205 (waiting 40 min): DELETE FROM Orders WHERE ...
[... 12 more sessions]

Recommendation: Kill SPID 152
Command: KILL 152
Risk: Low (query appears stuck, not making progress)
Impact: Will unblock 15 waiting sessions immediately
Rollback: UPDATE will be rolled back (operation was idempotent)

---

Top Expensive Queries (by CPU):

1. CustomerSearch Query (12.5B CPU, 5M executions)
   Text: SELECT * FROM Customers WHERE Name LIKE @param
   Issue: Full table scan on 10M row table
   Recommendation: CREATE INDEX IX_Customers_Name ON Customers(Name)
   Expected Improvement: 95% faster (2.5s → 0.1s)

2. OrderReport Query (8.2B CPU, 500K executions)
   Text: SELECT * FROM Orders o JOIN OrderDetails od ON o.OrderID = od.OrderID
   Issue: Missing join index on OrderDetails
   Recommendation: CREATE INDEX IX_OrderDetails_OrderID ON OrderDetails(OrderID)
   Expected Improvement: 70% faster (5s → 1.5s)

3. ProductInventory Query (5.1B CPU, 2M executions)
   Text: SELECT * FROM Products WHERE CategoryID = @CategoryID
   Executed frequently (2M times/day)
   Recommendation: Application-level caching (5 min TTL)
   Expected Improvement: 90% reduction in DB calls

---

Wait Stats Analysis:

| Wait Type | Wait Time (sec) | % of Total | Bottleneck |
|-----------|-----------------|------------|------------|
| PAGEIOLATCH_SH | 3600 | 45% | Disk I/O |
| LCK_M_U | 1800 | 23% | Blocking |
| SOS_SCHEDULER_YIELD | 1200 | 15% | CPU pressure |
| WRITELOG | 800 | 10% | Log I/O |
| Other | 600 | 7% | Various |

Primary Bottleneck: Disk I/O (45% of wait time)

---

Infrastructure Correlation:

Prometheus Metrics for V85X_PROD:9182:
- CPU: 75% (elevated from 40% baseline)
- Memory: 60% (normal)
- Disk I/O: 150 MB/s sustained (elevated)

No active Prometheus alerts.

---

Recommendations:

Immediate (Today):
1. Kill blocking SPID 152 → Unblocks 15 sessions
2. Add index on Customers(Name) → 95% improvement on CustomerSearch
3. Add index on OrderDetails(OrderID) → 70% improvement on OrderReport

Short-term (This Week):
4. Implement caching for ProductInventory query
5. Review disk I/O performance (consider faster storage)
6. Set up alert for blocking chains >5 minutes

Long-term (This Month):
7. Query optimization review for top 10 expensive queries
8. Consider read replica for reporting queries
9. Implement connection pooling optimization
```

**Time:** 3-5 minutes

**Follow-up Actions:**
1. Kill blocker immediately
2. Schedule index creation (low-impact time)
3. Plan caching implementation

---

## Deployment-Related Issue

**Scenario:** Performance issues started after deployment

**Command:**
```
/deployment-impact

Performance degraded since last deployment to V85X_PROD
```

**Example Output:**
```
Discovery Phase:
✓ Discovered 35 SQL instances
✓ Mapped V85X_PROD server → V85X_PROD_DB instance

Recent Deployments (24 hours):

Build #1234 - V85X_PROD (Production)
- Deployed: 14:25
- Status: Succeeded
- Commits: 3 changes
- Tests: All passed

Build #1233 - V87X_QA (QA)
- Deployed: 13:20
- Status: Succeeded
- Commits: 5 changes
- Tests: All passed

---

Deployment Analysis: Build #1234

Timing Correlation:
- Deployment: 14:25
- First Prometheus alert: 14:28 (+3 minutes)
- User reports: 14:30 (+5 minutes)
- SQL issues detected: 14:32 (+7 minutes)

Correlation: HIGH (symptoms within 5-7 minutes of deployment)

---

Code Changes (3 commits):

Commit abc123 - "Optimize customer search query"
- Files: Queries/CustomerSearch.sql
- Risk: HIGH
- Change Summary:
  OLD: SELECT CustomerID, Name FROM Customers WHERE Name = @name
  NEW: SELECT c.*, o.*, od.* FROM Customers c
        LEFT JOIN Orders o ON c.CustomerID = o.CustomerID
        LEFT JOIN OrderDetails od ON o.OrderID = od.OrderID
        WHERE c.Name LIKE @name
- Assessment: Query now returns excessive data with JOINs

Commit def456 - "Add caching for products"
- Files: Services/ProductService.cs, Cache/ProductCache.cs
- Risk: MEDIUM
- Change: Added Redis caching layer
- Assessment: New caching could cause memory issues if not configured properly

Commit ghi789 - "Update version number"
- Files: AssemblyInfo.cs
- Risk: LOW
- Change: Version bump (1.2.3 → 1.2.4)
- Assessment: No functional impact

---

Infrastructure Impact:

Prometheus Alerts After Deployment:
- 14:28: CPUUsageHigh on V85X_PROD:9182 (FIRING)
- 14:35: MemoryUsageHigh on V85X_PROD:9182 (FIRING)

Metrics Comparison:
Before Deployment (14:00-14:25):
- CPU: 40% average
- Memory: 4GB / 16GB (25%)
- Disk I/O: 50 MB/s

After Deployment (14:30-15:00):
- CPU: 95% average (SPIKE +138%)
- Memory: 12GB / 16GB (75%) (SPIKE +200%)
- Disk I/O: 200 MB/s (SPIKE +300%)

---

Database Impact:

SQL Instance: V85X_PROD_DB

New Expensive Query Detected (first seen 14:28):
Query: SELECT c.*, o.*, od.* FROM Customers c LEFT JOIN Orders o ON ...
- Executions: 5,000 since 14:28
- Avg CPU: 2,500ms per execution
- Total CPU: 12.5M ms
- Assessment: Matches CustomerSearch.sql change in commit abc123

Wait Stats Change:
- PAGEIOLATCH_SH: +300% (disk I/O pressure from large result sets)
- SOS_SCHEDULER_YIELD: +200% (CPU pressure from query processing)

No blocking detected (different issue than performance-analysis example).

---

Root Cause Assessment:

Hypothesis: Build #1234 introduced poorly-optimized query in CustomerSearch.sql

Confidence: HIGH (90%)

Supporting Evidence:
1. Deployment timing: 3-7 minutes before symptoms
2. Code change: SQL query modification in commit abc123
3. New expensive query: Matches changed query pattern
4. CPU/Memory/Disk spike: Correlates with query execution
5. Affected system: Matches deployment target (V85X_PROD)

Technical Explanation:
- New query uses LEFT JOIN to Orders and OrderDetails
- Returns all customer data + all orders + all order details
- For customers with many orders, result set is massive
- Causes high CPU (joining), high memory (result set), high disk I/O (reading data)
- Query executes frequently (customer search is common operation)

---

Rollback Recommendation:

Recommendation: Rollback Build #1234 to Build #1233

Justification:
- High confidence (90%) deployment caused issue
- Clear performance regression (CPU +138%, Memory +200%)
- Production impact ongoing (users affected)
- No immediate query fix available

Rollback Command:
bash
# Via Azure DevOps API
az pipelines runs rollback --build-id 1233 --project V85X_PROD


Last Known Good: Build #1233
- Deployed: 2 days ago
- Status: Stable (no issues reported)
- Version: 1.2.3

Rollback Risk: LOW
- Previous version proven stable
- No schema changes in Build #1234 (only query change)
- No data migration needed
- Rollback tested in QA environment (10 minutes ago)

Expected Recovery:
- Immediate improvement after rollback deployment (<10 minutes)
- CPU should return to 40% baseline
- Memory should return to 4GB (25%)
- Disk I/O should return to 50 MB/s
- Monitor Prometheus for 30 minutes post-rollback

---

Post-Rollback Actions:

Immediate (Before Next Deployment):
1. Fix CustomerSearch.sql query:
   - Remove unnecessary JOINs
   - Return only required columns
   - Add WHERE clause to limit result set

2. Add performance testing to CI/CD pipeline:
   - Query execution time checks
   - Result set size limits
   - Load testing before production deployment

3. Code review checklist item:
   - Flag any SQL query returning * or with JOINs

Short-term (This Week):
4. Implement query performance monitoring (alert on >2s queries)
5. Add database query profiling to QA environment
6. Require 4-hour QA soak time before production deployment

Long-term (This Month):
7. Automated rollback on performance regression (>2x baseline)
8. Database query governance (DBA review for complex queries)
9. Query optimization training for development team
```

**Time:** 5-7 minutes

**Follow-up Actions:**
1. Execute rollback immediately
2. Fix query in development
3. Implement preventive measures

---

## Complete Incident Investigation

**Scenario:** Unknown production issue, full investigation needed

**Command:**
```
/incident-investigation

Users reporting API timeouts and errors since 14:30
```

**Example Output:**
```
Loading aiops-investigation skill...

Phase 1: Infrastructure Discovery

Invoking sql-instance-discovery agent...

Discovered SQL instances from Prometheus (35 total):

Production (15 instances):
- V85X_PROD_DB
- V87X_PROD_DB
- V85X_PROD2_DB
[... 12 more]

QA/Test (12 instances):
[... list]

Development (8 instances):
[... list]

✓ Discovery validation: 35 instances found (expected 30-40+)
✓ Environment grouping complete
✓ Application server → SQL instance mapping ready

---

Phase 2: Establish Timeline & Collect Data

Timeline Establishment:
- Incident reported: 14:30 (user complaints)
- Incident start (estimated): 14:28-14:30
- Current time: 14:45 (15 minutes duration)

---

Prometheus Analysis:

Current FIRING Alerts (2):
1. CPUUsageHigh on V85X_PROD:9182
   - Fired at: 14:28
   - Current value: 95%
   - Threshold: 80%

2. MemoryUsageHigh on V85X_PROD:9182
   - Fired at: 14:35
   - Current value: 75%
   - Threshold: 70%

Alert History (last 2 hours):
- 14:28: CPUUsageHigh fired (V85X_PROD)
- 14:35: MemoryUsageHigh fired (V85X_PROD)
- No other alerts in timeframe

Infrastructure Metrics:
- V85X_PROD:9182 CPU: 95% (baseline: 40%)
- V85X_PROD:9182 Memory: 12GB/16GB (baseline: 4GB)
- V85X_PROD:9182 Disk I/O: 200 MB/s (baseline: 50 MB/s)

---

SQL Server Analysis:

Instance: V85X_PROD_DB (primary focus based on alerts)

Database States:
✓ All databases ONLINE (no availability issues)

Blocking Check:
✗ No blocking detected

Expensive Queries (Top 3):
1. CustomerSearch query - 2,500ms avg, 5,000 executions since 14:28
2. OrderReport query - 1,800ms avg, 800 executions
3. ProductInventory query - 500ms avg, 10,000 executions

Wait Stats (since SQL Server restart):
- PAGEIOLATCH_SH: 45% (disk I/O waits)
- SOS_SCHEDULER_YIELD: 25% (CPU pressure)
- WRITELOG: 15% (transaction log writes)

Disk Space:
✓ All drives <80% full (no capacity issues)

Failed Jobs:
✓ No failed SQL Agent jobs in last 24 hours

---

Azure DevOps Analysis:

Recent Builds (last 24 hours):
- Build #1234: V85X_PROD at 14:25 (5 min before incident)
- Build #1233: V87X_QA at 13:20
- Build #1232: V91X_DEV at 11:00

Recent Releases:
- Release R-523: V85X_PROD at 14:25 (5 min before incident)

Build #1234 Details:
- Status: Succeeded
- Tests: 150/150 passed
- Commits: 3 changes (including SQL query modification)

---

Phase 3: Correlation & Pattern Recognition

Invoking prometheus-correlator agent...

Infrastructure Correlation Analysis:

Application Server → SQL Instance Mapping:
- V85X_PROD:9182 (high CPU/memory) → V85X_PROD_DB (expensive queries)

Timeline Correlation:
| Time | Prometheus | SQL Server | Azure DevOps |
|------|------------|------------|--------------|
| 14:25 | Normal | Normal | Build #1234 deployed |
| 14:28 | CPU alert fires | Expensive queries start | - |
| 14:30 | CPU 95% | Query count increases | - |
| 14:35 | Memory alert fires | Wait stats elevated | - |

Pattern Recognition: Deployment-Triggered Performance Issue
- Deployment at 14:25
- Symptoms at 14:28 (+3 minutes)
- Strong temporal correlation

---

Invoking azure-devops-analyzer agent...

Deployment Correlation Analysis:

Build #1234 Code Changes:
- Commit abc123: Modified CustomerSearch.sql query
  - Added LEFT JOINs to Orders and OrderDetails
  - Returns excessive data
  - HIGH RISK change

Deployment Timing:
- Build #1234 deployed: 14:25
- First symptom: 14:28 (+3 minutes)
- Correlation: HIGH confidence

Test Coverage Gap:
- Unit tests passed
- Integration tests passed
- Performance tests: NOT RUN
- Gap: No load testing for query changes

---

Phase 4: Root Cause Hypothesis

Invoking incident-report-generator agent...

Root Cause Analysis:

Hypothesis:
Build #1234 introduced poorly-optimized SQL query in CustomerSearch.sql that causes excessive CPU, memory, and disk I/O usage, leading to application timeouts and errors.

Confidence Level: HIGH (90%)

Supporting Evidence:
1. Deployment timing: 3 minutes before first symptoms (very strong correlation)
2. Code change: SQL query modification in commit abc123 (direct mechanism)
3. New expensive query: Detected in SQL Server matching changed code
4. Infrastructure impact: CPU +138%, Memory +200%, Disk I/O +300%
5. Affected system scope: Only V85X_PROD affected (matches deployment target)

Technical Mechanism:
1. Build #1234 deployed CustomerSearch.sql with LEFT JOINs
2. Query now returns customer + all orders + all order details
3. For customers with many orders, result set is massive (MB per query)
4. Application executes query frequently (customer search common)
5. High CPU (joining tables), high memory (buffering results), high disk I/O
6. Query execution time increases from ~100ms to ~2,500ms
7. Application timeouts occur when query >30s timeout threshold
8. Users experience errors and timeouts

Alternative Theories: None (confidence is high)

---

Phase 5: Generate Incident Report

INCIDENT REPORT: Production Performance Degradation

Generated: 2025-01-23 14:45
Incident Start: 2025-01-23 14:28
Status: ONGOING (17 minutes duration)

---

Executive Summary:

Production application V85X_PROD experiencing severe performance degradation causing user timeouts and errors. Root cause identified as poorly-optimized SQL query introduced in Build #1234 deployed 3 minutes before incident. Immediate rollback recommended.

---

Affected Systems:

SQL Instances:
- V85X_PROD_DB (Production) - Expensive queries, high resource usage

Application Servers:
- V85X_PROD:9182 - CPU 95%, Memory 75%, Disk I/O elevated

Environments:
- Production (PRIMARY IMPACT)
- QA and Dev: UNAFFECTED

---

Timeline:

| Time | System | Event | Details |
|------|--------|-------|---------|
| 14:25 | Azure DevOps | Build #1234 deployed | V85X_PROD |
| 14:28 | Prometheus | CPUUsageHigh alert | V85X_PROD:9182 (95%) |
| 14:30 | Users | Complaints received | Timeouts and errors |
| 14:32 | SQL Server | Expensive query detected | CustomerSearch query |
| 14:35 | Prometheus | MemoryUsageHigh alert | V85X_PROD:9182 (75%) |
| 14:45 | Investigation | Root cause identified | Build #1234 query change |

---

Root Cause Analysis:

Hypothesis: Build #1234 introduced poorly-optimized SQL query

Confidence: HIGH (90%)

Supporting Evidence:
1. Deployment 3 minutes before incident (temporal correlation)
2. SQL query modification in commit abc123 (mechanism identified)
3. New expensive query matches changed code (direct link)
4. Infrastructure metrics spike correlates with query execution
5. Only deployed system affected (scope matches)

Technical Explanation:
Build #1234 modified CustomerSearch.sql to add LEFT JOINs to Orders and OrderDetails tables. This causes the query to return massive result sets for customers with many orders. The query is executed frequently (customer search is common operation), causing sustained high CPU, memory, and disk I/O. Application timeouts occur when queries exceed 30-second timeout threshold.

---

Impact Assessment:

Severity: P1 (Major Production Issue)

Justification:
- Production system affected
- Significant user impact (timeouts and errors)
- Workaround available (users can retry)
- Critical business function impacted (customer search)

User Impact:
- Affected users: All users of V85X_PROD application
- Functionality impacted: Customer search feature
- Duration: 17 minutes and ongoing
- Severity: Intermittent timeouts (not complete outage)

Business Impact:
- Customer service affected (cannot search customers efficiently)
- Sales potentially impacted (customer lookup slow)
- Duration: Acceptable for P1 (<1 hour target)

Data Impact:
- Data loss: NO
- Data corruption: NO
- Data integrity: MAINTAINED

---

Remediation Plan:

Immediate Actions (REQUIRE APPROVAL):

1. Rollback Build #1234 to Build #1233 (HIGHEST PRIORITY)
   Command: az pipelines runs rollback --build-id 1233 --project V85X_PROD
   Risk: LOW (previous version stable, no schema changes)
   Impact: Immediate performance restoration
   Verification: Check Prometheus CPU/memory return to baseline (<5 min)

Expected Recovery Time: 10 minutes (deployment time)

Monitoring Post-Fix:
- Prometheus CPU on V85X_PROD:9182: Should return to 40% baseline
- Prometheus Memory on V85X_PROD:9182: Should return to 4GB (25%)
- SQL expensive queries: CustomerSearch should disappear from top queries
- User reports: Should stop immediately after rollback

---

Preventive Measures:

Immediate (Before Next Deployment):
- Fix CustomerSearch.sql query (remove unnecessary JOINs, limit columns)
- Add performance testing to CI/CD pipeline
- Implement 4-hour QA soak time before production

Short-term (This Week):
- Set up alert for queries >2 seconds
- Add database query profiling to QA environment
- Code review checklist: Flag SQL queries with JOINs or returning *

Long-term (This Month):
- Automated rollback on performance regression
- Database query governance (DBA review required)
- Query optimization training for development team

---

Investigation Quality Metadata:

Data Completeness:
- Prometheus: ✓ AVAILABLE (full metrics and alerts)
- SQL Server: ✓ AVAILABLE (full performance data)
- Azure DevOps: ✓ AVAILABLE (complete build history)

Discovery:
- SQL Instances found: 35 (Expected: 30-40+)
- Discovery status: ✓ SUCCESS

Confidence Calibration:
- Evidence sources: 5 independent signals
- Contradictory evidence: NO
- Data gaps: NONE (all systems accessible)

---

END OF INCIDENT REPORT
```

**Time:** 5-10 minutes (comprehensive investigation)

**Follow-up Actions:**
1. Get approval for rollback
2. Execute rollback
3. Monitor recovery
4. Implement preventive measures
5. Fix query for next deployment

---

## Best Practices

### When to Use Each Command

| Situation | Command | Why |
|-----------|---------|-----|
| Daily check | `/db-health` | Quick, 1-minute check |
| Disk alert | `/disk-space` | Focused on storage |
| Slow queries | `/performance-analysis` | Deep performance dive |
| After deployment | `/deployment-impact` | Deployment correlation |
| Unknown issue | `/incident-investigation` | Comprehensive analysis |

### Tips for Effective Use

1. **Provide Context:** Always describe the incident when invoking commands
2. **Trust Discovery:** Don't assume which instances are affected
3. **Read Full Report:** Scroll to remediation recommendations
4. **Get Approval:** Never execute destructive actions without approval
5. **Follow Up:** Implement preventive measures, not just fixes

### Time Expectations

- Quick health check: <1 minute
- Disk space analysis: 2-3 minutes
- Performance analysis: 3-5 minutes
- Deployment impact: 5-7 minutes
- Full investigation: 5-10 minutes

**Note:** Times depend on number of instances and data volume.

## Need Help?

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
