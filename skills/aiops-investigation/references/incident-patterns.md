# Incident Investigation Patterns Reference

Common incident patterns and their investigation approaches.

## Pattern 1: Deployment-Related Incident

### Signature
- Issue started shortly after deployment (within 30 minutes)
- Affected system matches deployed application
- New code/query visible in expensive queries

### Investigation Flow
```
1. Get deployment timeline
   → mcp__azure-devops__list_builds()
   → mcp__azure-devops__list_releases()

2. Correlate with incident time
   → Deployment 5-30 min before incident = HIGH correlation
   → Deployment same day = MEDIUM correlation
   → No recent deployment = LOW correlation

3. Identify code changes
   → mcp__azure-devops__list_commits(build_id)
   → Look for SQL query changes
   → Look for data access pattern changes

4. Match to symptoms
   → New expensive query matches changed code?
   → Error messages match changed code?
```

### Resolution Pattern
- **High confidence:** Rollback deployment
- **Medium confidence:** Hotfix specific issue
- **Low confidence:** More investigation needed

### Example Timeline
```
09:00 - Build #1234 deployed
09:05 - CPU alert fires on app server
09:10 - User reports: "API is slow"
09:15 - Expensive query detected matching deployed code

Confidence: HIGH (95%)
Action: Rollback to Build #1233
```

## Pattern 2: Disk Space Exhaustion

### Signature
- Transaction failures with error 9002
- Backup failures
- Gradually degrading performance
- Eventually complete failure

### Investigation Flow
```
1. Check disk space on all drives
   → mcp__mssql__get_disk_space(server="{instance}")

2. Identify largest consumers
   → Transaction logs (often culprit)
   → Data files
   → Backup files

3. Check for blocking transaction
   → mcp__mssql__get_blocking(server="{instance}")
   → Long-running transaction prevents log truncation

4. Check backup history
   → If no recent log backup, log cannot truncate
```

### Resolution Pattern
- **Immediate:** Free space or add capacity
- **Short-term:** Backup logs, shrink files
- **Long-term:** Implement monitoring, auto-growth limits

### Warning Signs
```
<50% free → Monitor
<20% free → Warning
<10% free → Critical
<5% free → Emergency
```

## Pattern 3: Blocking Cascade

### Signature
- One query blocking many others
- Exponential growth in blocked sessions
- Application-wide slowdown
- Usually one "head blocker" session

### Investigation Flow
```
1. Detect blocking
   → mcp__mssql__get_blocking(server="{instance}")

2. Identify head blocker
   → Session at root of blocking tree
   → May be single query holding locks

3. Analyze blocker query
   → What is it doing?
   → How long has it been running?
   → Is it stuck or just slow?

4. Assess impact
   → How many sessions blocked?
   → What's the business impact?
```

### Resolution Pattern
- **Orphaned session:** Kill immediately
- **Slow legitimate query:** Wait or optimize
- **Repeating issue:** Application code change needed

### Decision Matrix
```
Wait Time > 5 min AND Blocked > 10 → Consider killing
Wait Time > 15 min AND Any blocked → Likely stuck, kill
Wait Time < 1 min → May resolve naturally
```

## Pattern 4: Memory Pressure

### Signature
- `RESOURCE_SEMAPHORE` waits dominant
- Page life expectancy drops
- Query compilation delays
- Gradually worsening performance

### Investigation Flow
```
1. Check wait stats
   → mcp__mssql__get_wait_stats(server="{instance}")
   → Look for memory-related waits

2. Find memory-heavy queries
   → mcp__mssql__get_expensive_queries(metric="reads")
   → Large scans = large memory grants

3. Check instance configuration
   → Max server memory setting
   → Memory allocated vs available
```

### Resolution Pattern
- **Immediate:** Identify and optimize worst query
- **Short-term:** Adjust memory settings
- **Long-term:** Add RAM or optimize workload

## Pattern 5: Network/Client Issues

### Signature
- `ASYNC_NETWORK_IO` waits dominant
- Queries finish but results not consumed
- Intermittent connectivity
- Timeouts on specific operations

### Investigation Flow
```
1. Check wait stats
   → High ASYNC_NETWORK_IO = client issue

2. Identify affected queries
   → Usually large result sets
   → Slow client consumption

3. Check network path
   → Latency to client
   → Bandwidth utilization
```

### Resolution Pattern
- **Client-side:** Fix slow processing, use paging
- **Query-side:** Reduce result size
- **Network:** Upgrade infrastructure

## Pattern 6: Resource Contention (Multi-Instance)

### Signature
- Multiple instances affected simultaneously
- Shared resource saturation (CPU, disk, memory)
- "Noisy neighbor" effect
- Correlates with activity on other instance

### Investigation Flow
```
1. Check infrastructure metrics
   → mcp__prometheus__query_instant("cpu_usage")
   → Look for host-level saturation

2. Check multiple instances
   → All instances slow? = Host issue
   → One instance slow? = Instance issue

3. Identify the "noisy neighbor"
   → Which instance consuming most resources?
   → What query/operation is it running?
```

### Resolution Pattern
- **Immediate:** Throttle noisy neighbor
- **Short-term:** Resource Governor limits
- **Long-term:** Capacity planning, separation

## Correlation Scoring Guide

### High Confidence (>80%)
- Multiple independent signals point to same cause
- Clear temporal correlation
- Direct evidence (code change matches error)

**Example:**
- Deployment at 09:00
- Alert at 09:05
- New query in deployment matches expensive query
- Error message references changed code

### Medium Confidence (50-80%)
- Strong correlation but some ambiguity
- Temporal correlation without direct evidence
- Single strong signal

**Example:**
- Deployment at 09:00
- Alert at 09:20 (longer gap)
- General performance issue, not specific

### Low Confidence (<50%)
- Insufficient data
- Multiple plausible causes
- No clear correlation

**Example:**
- Issue started sometime yesterday
- No recent deployments
- Multiple systems affected

## Investigation Quality Checklist

Before finalizing root cause:
- [ ] Checked all data sources (Prometheus, SQL, Azure DevOps)
- [ ] Established clear timeline
- [ ] Correlated events across systems
- [ ] Identified at least 3 pieces of evidence
- [ ] Considered alternative theories
- [ ] Verified no data gaps in analysis
- [ ] Confirmed affected scope (instances, environments)
