---
name: performance-analysis
description: This skill should be used for deep performance analysis of SQL Server instances. It analyzes expensive queries, wait stats, blocking chains, and provides optimization recommendations. Use when investigating slow queries, performance degradation, or when the user asks "why is the database slow?".
user-invocable: true
argument-hint: "[instance|environment]"
model: inherit
skills:
  - mssql-operations
---

# Performance Analysis

Deep performance investigation of SQL Server instances to identify bottlenecks and optimization opportunities.

## Usage

```
/infrastructure-plugin:performance-analysis
/infrastructure-plugin:performance-analysis production
/infrastructure-plugin:performance-analysis SQLSERVER01\PROD_DB
```

## Arguments

- **No argument:** Analyze production instances
- **Environment:** `production`, `qa`, `dev` - analyze specific environment
- **Instance name:** Analyze specific instance only

## What This Skill Does

1. **Discovery** - Identifies relevant SQL instances
2. **Expensive Queries** - Finds resource-intensive queries
3. **Wait Stats** - Analyzes performance bottlenecks
4. **Blocking Detection** - Identifies blocking chains
5. **Recommendations** - Provides optimization guidance

## Instructions

### Step 1: Discover and Filter Instances

Invoke `sql-instance-discovery` agent.

**Filter Logic:**
- If specific instance in `$ARGUMENTS` → analyze that instance only
- If environment specified → filter to that environment
- If no argument → default to production instances

### Step 2: Analyze Each Instance

For each target instance, collect:

**Expensive Queries:**
```
mcp__mssql__get_expensive_queries(server="{instance}", top=10, metric="cpu")
mcp__mssql__get_expensive_queries(server="{instance}", top=10, metric="reads")
```

**Wait Stats:**
```
mcp__mssql__get_wait_stats(server="{instance}", top=10)
```

**Blocking:**
```
mcp__mssql__get_blocking(server="{instance}")
```

### Step 3: Analyze Findings

**Expensive Query Analysis:**
- Identify queries consuming most CPU/IO
- Check for missing indexes (high logical reads)
- Look for queries that could benefit from optimization

**Wait Stats Analysis:**
- `PAGEIOLATCH_*` → Disk I/O bottleneck
- `LCK_*` → Locking/blocking issues
- `WRITELOG` → Transaction log bottleneck
- `CXPACKET` → Parallelism waits (may be normal)
- `ASYNC_NETWORK_IO` → Application not consuming results fast enough

**Blocking Analysis:**
- Identify head blocker (root of chain)
- Calculate blocked session count
- Assess impact of blocking

### Step 4: Generate Recommendations

Based on findings:
- Query optimization suggestions
- Index recommendations
- Configuration recommendations
- Architecture recommendations

### Step 5: Generate Report

```
## Performance Analysis Report

Instance: {instance_name}
Environment: {environment}
Analysis Time: {timestamp}

### Executive Summary
{2-3 sentence summary of key findings}

### Expensive Queries (Top 10 by CPU)

| Rank | CPU (ms) | Reads | Executions | Query |
|------|----------|-------|------------|-------|
| 1 | 125,000 | 5.2M | 1,250 | SELECT * FROM Orders... |
| 2 | 98,000 | 3.1M | 890 | UPDATE Inventory SET... |
| ... | ... | ... | ... | ... |

**Recommendations:**
1. Query #1: Add index on Orders(CustomerID, OrderDate)
2. Query #2: Rewrite to avoid table scan

### Wait Statistics (Top 10)

| Wait Type | Wait Time (ms) | % of Total | Analysis |
|-----------|----------------|------------|----------|
| PAGEIOLATCH_SH | 45,000 | 35% | Disk I/O bottleneck |
| LCK_M_X | 28,000 | 22% | Lock contention |
| ... | ... | ... | ... |

**Analysis:**
- Primary bottleneck: Disk I/O (35% of waits)
- Secondary: Lock contention (22%)

**Recommendations:**
1. Consider faster storage or more memory for buffer pool
2. Review transactions causing lock contention

### Blocking Analysis

**Current Status:** {Active blocking / No blocking}

{If blocking detected:}
**Head Blocker:**
- SPID: 152
- Login: app_user
- Command: UPDATE
- Wait Time: 45 seconds
- Blocked Sessions: 12

**Recommendation:**
Consider killing SPID 152 if wait time exceeds threshold.
Query: `KILL 152`

### Overall Health Score

| Metric | Score | Status |
|--------|-------|--------|
| Query Efficiency | 65/100 | ⚠️ Needs improvement |
| Wait Stats | 72/100 | ⚠️ Moderate issues |
| Blocking | 95/100 | ✅ Healthy |
| **Overall** | **71/100** | **⚠️ Optimization recommended** |

### Action Items (Priority Order)

1. **High:** Add index for Query #1 (estimated 40% improvement)
2. **High:** Investigate disk I/O bottleneck
3. **Medium:** Review lock contention in Query #2
4. **Low:** Consider query plan optimization for Query #5
```

## Token Usage

**Single Instance:** ~30-50k tokens
**Multiple Instances:** Scales linearly with instance count

For quick checks, use `/infrastructure-plugin:db-health` instead.
