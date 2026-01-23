# Deployment Impact Analysis

Analyzes recent deployments and correlates with infrastructure and database changes to identify deployment-related issues.

## Usage

```
/deployment-impact
```

Optional context:
- "Check last deployment"
- "Analyze deployment from 2 hours ago"
- "Did recent release cause issues?"

## What This Command Does

Correlates deployments with infrastructure and database impact:

1. **Recent Deployments** - Lists builds and releases from last 24 hours
2. **Code Changes** - Identifies what changed in recent deployments
3. **Infrastructure Impact** - Correlates with Prometheus alerts
4. **Database Impact** - Correlates with SQL Server performance
5. **Assessment** - Determines if deployment likely caused issues

## Instructions

### Step 1: Discover SQL Instances

Invoke the `sql-instance-discovery` agent to get complete list of instances.

This provides the mapping for correlation (V85X_PROD server → V85X_PROD_DB instance).

### Step 2: Get Recent Deployments

**List Recent Builds:**
```
mcp__azure-devops__list_builds(top=20)
```

Filter to last 24 hours.

**List Recent Releases:**
```
mcp__azure-devops__list_releases(top=20)
```

Filter to last 24 hours.

**Create Deployment Timeline:**

| Time | Type | Project | Environment | Status |
|------|------|---------|-------------|--------|
| 14:25 | Release | V85X_PROD | Production | Succeeded |
| 13:20 | Build | V87X_QA | QA | Succeeded |
| 11:45 | Build | V91X_DEV | Development | Failed |

### Step 3: Analyze Code Changes

For each successful deployment in last 24h:

**Get Build Details:**
```
mcp__azure-devops__get_build(buildId={id})
```

**List Commits:**
```
mcp__azure-devops__list_commits(repository, branch)
```

**Identify High-Risk Changes:**

**SQL Changes:**
- Stored procedure modifications
- View changes
- Schema migrations
- Index additions/removals

**Query Changes:**
- ORM query modifications
- Parameterized query changes
- Dynamic SQL changes

**Configuration Changes:**
- Connection strings
- Timeout settings
- Retry logic
- Feature flags

**Dependency Updates:**
- Database drivers
- ORM libraries
- Framework updates

### Step 4: Check Infrastructure Impact

For each deployment, check Prometheus for alerts around deployment time (±30 minutes):

```
mcp__prometheus__get_alert_history(timeRange="2h")
```

**Correlate:**
- Did alerts fire after deployment?
- Which servers affected?
- Do affected servers match deployment target?

**Example:**
```
Deployment: Build #1234 to V85X_PROD at 14:25
Alerts:
- 14:28 (+3 min): CPUUsageHigh on V85X_PROD:9182
- 14:35 (+10 min): MemoryUsageHigh on V85X_PROD:9182

Correlation: Strong (alerts fired 3-10 minutes after deployment)
```

### Step 5: Check Database Impact

For relevant SQL instances, check for issues after deployment:

**Expensive Queries:**
```
mcp__mssql__get_expensive_queries(server="chamdb\\V85X_PROD_DB", top=10)
```

Look for:
- New queries (from deployment)
- Increased execution count
- Increased CPU/IO usage

**Blocking:**
```
mcp__mssql__get_blocking(server="chamdb\\V85X_PROD_DB")
```

Check if blocking started after deployment.

**Failed Jobs:**
```
mcp__mssql__get_failed_jobs(server="chamdb\\V85X_PROD_DB", hours=24)
```

Check if jobs started failing after deployment.

### Step 6: Invoke azure-devops-analyzer Agent

Invoke the `azure-devops-analyzer` agent to perform detailed deployment analysis:
- Deployment timing correlation
- Code change risk assessment
- Test quality analysis
- Rollback recommendations

### Step 7: Generate Report

**Deployment Impact Report**

**Recent Deployments (24 hours):**

**Build #1234 - V85X_PROD (Production)**
- Deployed: 14:25
- Status: Succeeded
- Commits: 3 changes
- Tests: All passed

**Build #1233 - V87X_QA (QA)**
- Deployed: 13:20
- Status: Succeeded
- Commits: 5 changes
- Tests: All passed

---

**Deployment Analysis: Build #1234**

**Timing Correlation:**
- Deployment: 14:25
- First alert: 14:28 (+3 minutes)
- User reports: 14:30 (+5 minutes)
- **Correlation: HIGH (alerts within 5 minutes)**

**Code Changes (3 commits):**

1. **Commit abc123 - "Optimize customer search query"**
   - Files: `Queries/CustomerSearch.sql`
   - Risk: HIGH
   - Change: Modified SQL query for performance
   - Assessment: Query change could introduce performance regression

2. **Commit def456 - "Add caching for products"**
   - Files: `Services/ProductService.cs`, `Cache/ProductCache.cs`
   - Risk: MEDIUM
   - Change: Added Redis caching layer
   - Assessment: New caching could cause memory issues

3. **Commit ghi789 - "Update version number"**
   - Files: `AssemblyInfo.cs`
   - Risk: LOW
   - Change: Version bump
   - Assessment: No functional impact

**Infrastructure Impact:**

**Prometheus Alerts After Deployment:**
- 14:28: CPUUsageHigh on V85X_PROD:9182 (FIRING)
- 14:35: MemoryUsageHigh on V85X_PROD:9182 (FIRING)

**Baseline Before Deployment:**
- CPU: 40% average
- Memory: 4GB/16GB (25%)

**After Deployment:**
- CPU: 95% (SPIKE)
- Memory: 12GB/16GB (75%)

**Database Impact:**

**SQL Instance: V85X_PROD_DB**

**New Expensive Query Detected:**
```sql
SELECT c.*, o.*, od.*
FROM Customers c
LEFT JOIN Orders o ON c.CustomerID = o.CustomerID
LEFT JOIN OrderDetails od ON o.OrderID = od.OrderID
WHERE c.Name LIKE @SearchTerm
```
- Executions: 5,000 since 14:28
- Avg CPU: 2,500ms per execution
- Assessment: Matches CustomerSearch.sql change in commit abc123

**Wait Stats Change:**
- PAGEIOLATCH_SH increased 300% (disk I/O pressure)
- SOS_SCHEDULER_YIELD increased 200% (CPU pressure)

**No Blocking Detected**

**No Failed Jobs**

---

**Root Cause Assessment**

**Hypothesis:** Build #1234 introduced poorly-optimized query in CustomerSearch.sql

**Confidence:** HIGH (90%)

**Supporting Evidence:**
1. Deployment timing: 5 minutes before symptoms
2. Code change: SQL query modification in commit abc123
3. New expensive query: Matches changed query pattern
4. CPU/Memory spike: Correlates with query execution
5. Affected system: Matches deployment target (V85X_PROD)

**Mechanism:**
- New query uses LEFT JOIN to Orders and OrderDetails
- Returns excessive data (customers + all orders + all details)
- Causes table scans on large tables
- Results in high CPU and memory usage

---

**Rollback Recommendation**

**Recommendation:** Rollback Build #1234

**Justification:**
- High confidence (90%) deployment caused issue
- Clear performance regression
- Production impact ongoing
- No immediate fix available

**Rollback Command:**
```bash
# Via Azure DevOps
az pipelines runs rollback --build-id 1233 --project V85X_PROD

# Or: Manual redeployment
az pipelines run --name "V85X_PROD-Pipeline" --branch previous-release
```

**Last Known Good:** Build #1233 (deployed 2 days ago, stable)

**Rollback Risk:** LOW
- Previous version stable
- No schema changes requiring data migration
- Rollback tested in QA

**Expected Recovery:**
- Immediate improvement after rollback
- CPU should return to 40% baseline
- Memory should return to 4GB baseline
- Monitor for 30 minutes post-rollback

---

**Preventive Measures**

**Immediate:**
1. Add performance testing to deployment pipeline
2. Require QA soak time (4+ hours) before Prod deployment

**Short-term:**
3. Implement query performance monitoring (alert on slow queries)
4. Add query explain plan review to code review process
5. Automated load testing for SQL queries

**Long-term:**
6. Canary deployments (gradual rollout to detect issues)
7. Automatic rollback on performance regression
8. Database query governance (DBA review for complex queries)

---

## No-Impact Scenario

If no correlation found:

**No Deployment Impact Detected**

**Recent Deployments:**
- 3 deployments in last 24 hours
- All to QA/Dev environments only
- No Production deployments

**Infrastructure Status:**
- 2 Prometheus alerts firing
- Alerts started 8 hours ago (no recent deployments)

**Assessment:**
- Incident NOT deployment-related
- No code changes in timeframe
- No configuration changes detected

**Recommendation:**
- Focus investigation on infrastructure/capacity issues
- Check for external factors (API dependencies, data growth)
- Use `/incident-investigation` for full analysis

---

## Error Handling

If Azure DevOps unreachable:
- Cannot determine deployment correlation
- Note limitation in report
- Recommend manual review of deployment history

If no recent deployments:
- Clearly state no deployments found
- Incident likely not deployment-related
- Suggest alternative investigation paths

## Related Commands

- `/incident-investigation` - Full multi-system analysis
- `/performance-analysis` - Detailed performance investigation
- `/db-health` - Quick health check
