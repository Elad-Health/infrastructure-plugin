# Multi-System Correlation Techniques

Methods for correlating findings across Prometheus, SQL Server, and Azure DevOps.

## Temporal Correlation

### Timeline Construction

Build a unified timeline from all data sources:

```
Time        | Source       | Event
------------|--------------|----------------------------------
08:55       | Azure DevOps | Build #1234 started
09:00       | Azure DevOps | Build #1234 completed (deployed)
09:03       | Prometheus   | CPUUsageHigh alert fired
09:05       | SQL Server   | Expensive query detected
09:08       | User Report  | "API is slow"
09:10       | Prometheus   | MemoryUsageHigh alert fired
09:15       | SQL Server   | Blocking detected (15 sessions)
```

### Correlation Windows

| Gap | Correlation | Interpretation |
|-----|-------------|----------------|
| 0-5 min | Very High | Direct causation likely |
| 5-15 min | High | Strong relationship |
| 15-30 min | Medium | Possible relationship |
| 30-60 min | Low | Weak relationship |
| >60 min | Very Low | Probably unrelated |

## Application-to-Database Mapping

### Prometheus → SQL Instance Correlation

**Pattern 1: Hostname Matching**
```
Prometheus target: app-server-01:9182
SQL Instance: SQLSERVER01\APP_DB

Correlation: app-server-01 connects to APP_DB
```

**Pattern 2: Label Matching**
```
Prometheus labels: {app="orders", env="prod"}
SQL Instance: ORDERS_PROD_DB

Correlation: Match by application name
```

**Pattern 3: Discovery Mapping**
```
Discovery shows:
- V85X_PROD (app server) → V85X_PROD_DB (SQL instance)

When alert fires on V85X_PROD:9182
→ Check V85X_PROD_DB for SQL issues
```

### Correlation Query Pattern

```
1. Alert on app server: "CPUUsageHigh" on "app-prod-01"
2. Extract identifier: "app-prod-01" or "app" or "prod"
3. Match to SQL instance from discovery
4. Query SQL instance for performance issues
5. Correlate timing
```

## Deployment Impact Correlation

### Build/Release to Alert Correlation

```
Build Completed: 09:00 (project: OrderService)
Alert Fired: 09:05 (target: orders-prod:9182)

Correlation Check:
- Same project/application? ✓
- Within correlation window? ✓ (5 min)
- Affected instance serves this app? ✓

Result: HIGH correlation
```

### Code Change Analysis

```
1. Get commits in build
   → mcp__azure-devops__list_commits(build_id)

2. Categorize changes:
   - SQL queries changed? → Check expensive queries
   - Data access patterns changed? → Check blocking
   - Configuration changed? → Check all metrics

3. Match to symptoms:
   - New query text matches expensive query?
   - Changed table matches blocking resource?
```

## Alert Storm Analysis

### Pattern Recognition

**Cascading Failure:**
```
Alert 1: DiskSpaceLow (09:00)
Alert 2: TransactionLogFull (09:05)
Alert 3: DatabaseOffline (09:10)
Alert 4: ApplicationTimeout (09:12)

Root Cause: Alert 1 (disk space)
Others are cascading effects
```

**Simultaneous Alerts:**
```
Alert 1: CPUHigh on server-01 (09:00)
Alert 2: CPUHigh on server-02 (09:00)
Alert 3: CPUHigh on server-03 (09:00)

Pattern: Infrastructure-wide issue
Check: Shared resource (host, storage, network)
```

### Alert Grouping Strategy

1. **Group by time:** Alerts within 5 minutes
2. **Group by target:** Same server/instance
3. **Group by type:** Similar alert names
4. **Identify primary:** First alert or root cause

## Cross-System Evidence Correlation

### Evidence Strength Levels

| Evidence Type | Strength | Example |
|---------------|----------|---------|
| Direct match | Very Strong | Query text in build matches expensive query |
| Timing correlation | Strong | Alert 3 min after deployment |
| Type correlation | Medium | CPU alert + CPU-heavy query found |
| Circumstantial | Weak | Deployment same day as incident |

### Building a Hypothesis

**Minimum for High Confidence:**
- At least 3 independent pieces of evidence
- At least 1 "Very Strong" or 2 "Strong" evidence
- No contradicting evidence

**Example:**
```
Evidence 1 (Very Strong): Build #1234 changed OrderQuery.cs
Evidence 2 (Strong): Alert fired 5 min after deployment
Evidence 3 (Strong): Expensive query matches OrderQuery code
Evidence 4 (Medium): Affected server runs Orders service

Confidence: HIGH (4 pieces, including 1 very strong, 2 strong)
```

## Prometheus Metric Correlation

### CPU Correlation
```
High CPU on app server
→ Check: mcp__mssql__get_expensive_queries(metric="cpu")
→ Match: Query consuming most CPU to app behavior
```

### Memory Correlation
```
High memory on app server
→ Check: mcp__mssql__get_wait_stats() for RESOURCE_SEMAPHORE
→ Match: Memory-intensive queries to app operations
```

### Disk Correlation
```
High disk I/O on server
→ Check: mcp__mssql__get_wait_stats() for PAGEIOLATCH_*
→ Check: mcp__mssql__get_disk_space() for capacity
```

## Multi-Instance Correlation

### Shared-Disk Architecture

When multiple instances share physical resources:

```
Instance A: High CPU query
Instance B: Slow performance (no obvious cause)
Instance C: Slow performance (no obvious cause)

Correlation: A is "noisy neighbor" affecting B and C
Solution: Address A's query to fix all
```

### Independent Server Analysis

When instances are independent:

```
Instance A: Issue
Instance B: No issue
Instance C: No issue

Correlation: Problem is specific to A
Analysis: Focus on A only
```

## Report Integration Points

### Linking Findings in Report

```markdown
### Root Cause Analysis

**Primary Finding:**
SQL Server query causing high CPU

**Correlated Evidence:**
1. Prometheus alert: CPUUsageHigh on app-server-01 at 09:05
2. Azure DevOps: Build #1234 deployed OrderService at 09:00
3. SQL Server: Query in OrderService using 85% CPU since 09:03

**Correlation Timeline:**
09:00 → 09:03 → 09:05
Deploy → Query starts → Alert fires

**Confidence:** HIGH (95%)
- Timing alignment: ✓ (3 min, 5 min)
- Code correlation: ✓ (Query matches changed code)
- Impact correlation: ✓ (Affected server runs deployed service)
```

## Quick Reference: What to Correlate

| If You Find | Correlate With | Looking For |
|-------------|----------------|-------------|
| CPU alert | Expensive queries | Query causing CPU |
| Memory alert | Wait stats, queries | Memory-hungry queries |
| Disk alert | Disk space, blocking | Space issue, long transaction |
| SQL blocking | Recent deployments | New problematic code |
| Expensive query | Deployment timeline | When query was deployed |
| Failed build | Subsequent alerts | Build causing issues |
