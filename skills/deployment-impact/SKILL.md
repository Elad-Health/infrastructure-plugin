---
name: deployment-impact
description: Analyze recent deployments and their impact on infrastructure. Correlates Azure DevOps builds/releases with Prometheus alerts and SQL Server performance.
user-invocable: true
argument-hint: "[hours|build-number]"
model: sonnet
skills:
  - aiops-investigation
---

# Deployment Impact Analysis

Analyze recent deployments and correlate with infrastructure changes to identify deployment-related issues.

## Usage

```
/infrastructure-plugin:deployment-impact
/infrastructure-plugin:deployment-impact 24h
/infrastructure-plugin:deployment-impact build-1234
```

## Arguments

- **No argument:** Analyze last 24 hours of deployments
- **Time period:** `24h`, `12h`, `48h` - specify time window
- **Build number:** `build-1234` - analyze specific deployment

## What This Skill Does

1. **Deployment Timeline** - Gets recent builds and releases from Azure DevOps
2. **Infrastructure Correlation** - Compares deployment times with alert/incident times
3. **Code Change Analysis** - Reviews what changed in deployments
4. **Impact Assessment** - Determines if deployments caused issues
5. **Rollback Recommendations** - Suggests rollback if needed

## Instructions

### Step 1: Get Deployment History

**Invoke `azure-devops-analyzer` agent:**
```
mcp__azure-devops__list_builds(top=20)
mcp__azure-devops__list_releases(top=20)
```

Filter by time period from `$ARGUMENTS` or default to 24 hours.

### Step 2: Get Infrastructure Events

**Get Prometheus alerts for same time period:**
```
mcp__prometheus__list_alerts()
mcp__prometheus__get_alert_history(hours={time_period})
```

**Get SQL Server events:**
- Recent expensive queries
- Blocking incidents
- Failed jobs

### Step 3: Correlate Timelines

Create unified timeline:
```
{time}: Deployment Build #1234 started
{time}: Deployment Build #1234 completed
{time}: Alert CPUUsageHigh fired on app-server-01
{time}: Expensive query detected on PROD_DB
{time}: User reports started
```

**Look for patterns:**
- Alert within 30 minutes of deployment → High correlation
- New expensive query matching deployed code → Code issue
- Multiple systems affected after deployment → Deployment impact

### Step 4: Analyze Specific Deployments

For deployments with suspected impact:

```
mcp__azure-devops__get_build(build_id="{build_id}")
mcp__azure-devops__get_build_logs(build_id="{build_id}")
mcp__azure-devops__list_commits(build_id="{build_id}")
```

**Review:**
- What code changed?
- Any database changes (migrations, queries)?
- Test results in build

### Step 5: Generate Report

```
## Deployment Impact Analysis

Time Period: {start} to {end}
Deployments Analyzed: {count}

### Deployment Timeline

| Time | Event | Build | Status |
|------|-------|-------|--------|
| 09:00 | Build #1234 started | MyApp | - |
| 09:15 | Build #1234 completed | MyApp | ✅ Success |
| 09:18 | Alert: CPUUsageHigh | - | ⚠️ |
| 09:20 | User reports: "Slow API" | - | ⚠️ |

### Correlation Analysis

**Build #1234 (MyApp)** - ⚠️ High Correlation

**Timeline:**
- Deployed: 09:15
- First alert: 09:18 (3 minutes after)
- User reports: 09:20 (5 minutes after)

**Correlation Score:** 85% (High)

**Code Changes:**
- `OrderService.cs` - Modified query logic
- `ReportGenerator.cs` - Added new report
- 3 files changed, 150 additions, 45 deletions

**Suspected Issue:**
Query change in OrderService.cs may have introduced performance regression.

**Evidence:**
1. Timing correlation (alert 3 min after deploy)
2. New expensive query matches changed code
3. Affected system (app-server-01) runs OrderService

### Impact Assessment

| Metric | Before Deploy | After Deploy | Change |
|--------|---------------|--------------|--------|
| API Response Time | 120ms | 850ms | +608% ⚠️ |
| CPU Usage | 35% | 92% | +163% ⚠️ |
| Error Rate | 0.1% | 2.5% | +2400% ⚠️ |

### Recommendations

**Immediate (if issue confirmed):**
1. **Rollback** to Build #1233
   - Command: `az pipelines run --pipeline-id X --branch release/v1.2.3`
   - Last known good: Build #1233 (deployed 2 days ago)

**Investigation:**
1. Review OrderService.cs changes
2. Test query performance in QA
3. Add index if query is valid but slow

**Prevention:**
1. Add performance tests to pipeline
2. Implement gradual rollout for production
3. Set up automated rollback on error rate spike

### Other Deployments (No Issues Detected)

| Build | Project | Time | Status |
|-------|---------|------|--------|
| #1232 | AuthService | Yesterday 14:00 | ✅ No impact |
| #1230 | WebUI | 2 days ago | ✅ No impact |
```

## Token Usage

**Typical analysis:** 30-50k tokens
**With deep code review:** 50-80k tokens
