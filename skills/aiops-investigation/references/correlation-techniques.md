# Multi-System Correlation Techniques

## Overview

Effective incident investigation requires correlating evidence from three independent systems:
1. **Prometheus** - Infrastructure monitoring (alerts, metrics)
2. **SQL Server** - Database performance (queries, blocking, disk)
3. **Azure DevOps** - Deployment history (builds, releases, code changes)

## Correlation Patterns

### Pattern 1: Deployment-Triggered Incident

**Timeline:**
- T-0: Deployment completes (Azure DevOps)
- T+5min: Infrastructure alert fires (Prometheus)
- T+8min: Database issues detected (SQL Server)
- T+10min: User complaints begin

**Correlation Logic:**
1. Deployment timing is close to incident start (5-30 minutes)
2. Code changes in deployment are relevant to symptoms
3. Affected systems match deployment target

**Confidence:** High (if all three align)

**Example:**
```
14:25 - Build #1234 deployed to V85X_PROD
14:30 - CPUUsageHigh alert on V85X_PROD:9182
14:32 - Expensive query detected on V85X_PROD_DB
14:33 - Users report timeouts

Root Cause: Deployment introduced poorly optimized query
Confidence: High (90%)
```

### Pattern 2: Cascading Failure

**Timeline:**
- T-0: Primary failure occurs
- T+2min: Secondary failure (downstream dependency)
- T+5min: Tertiary failure (further downstream)

**Correlation Logic:**
1. Failures happen in sequence, not simultaneously
2. Later failures are caused by earlier failures
3. Dependency relationships explain propagation

**Example:**
```
14:00 - Disk full on V87X_QA (SQL Server)
14:02 - Transaction log cannot grow, queries start failing
14:05 - Application server V87X_QA shows errors
14:08 - Prometheus DiskSpaceAlert fires
14:10 - Blocking detected on V87X_QA_DB (queries waiting for log writes)

Root Cause: Disk space exhaustion caused cascading failures
Confidence: High (85%)
```

### Pattern 3: Resource Exhaustion

**Timeline:**
- Gradual degradation over hours/days
- Threshold crossed triggering alerts
- No specific triggering event

**Correlation Logic:**
1. Metrics show gradual increase (not sudden spike)
2. No deployment or external event at failure time
3. Capacity-related (disk, memory, CPU trending up)

**Example:**
```
Jan 20 - Transaction log at 60% (SQL Server)
Jan 21 - Transaction log at 75%
Jan 22 - Transaction log at 85%
Jan 23 14:00 - Transaction log hits 95%, alert fires
Jan 23 14:05 - Queries start failing

Root Cause: Long-running transaction preventing log truncation
Confidence: Medium (70%) - need to find specific transaction
```

### Pattern 4: External Factor

**Timeline:**
- Incident occurs without internal changes
- External system or event is the cause

**Correlation Logic:**
1. No recent deployments in Azure DevOps
2. Prometheus shows external metrics anomalies
3. SQL Server shows symptoms but no internal cause

**Example:**
```
14:00 - Network latency spike (Prometheus)
14:02 - SQL Server connections increase dramatically
14:05 - Connection pool exhaustion on V85X_PROD
14:08 - Users report timeouts

Root Cause: External API slowdown caused connection buildup
Confidence: Medium (65%) - would need external system data to confirm
```

## Correlation Techniques

### Technique 1: Timeline Alignment

Create unified timeline with all events:

| Time | System | Event | Details |
|------|--------|-------|---------|
| 14:25 | Azure DevOps | Build #1234 deployed | V85X_PROD |
| 14:28 | Prometheus | Alert: CPUUsageHigh | V85X_PROD:9182 |
| 14:30 | Users | Complaints | Timeouts |
| 14:32 | SQL Server | Blocking detected | SPID 152 |
| 14:35 | Prometheus | Alert: MemoryUsageHigh | V85X_PROD:9182 |

**Analysis:** Deployment at 14:25 is 5 minutes before first alert. Strong temporal correlation.

### Technique 2: System Mapping

Map related entities across systems:

| Prometheus | SQL Server | Azure DevOps | Environment |
|------------|------------|--------------|-------------|
| V85X_PROD:9182 | V85X_PROD_DB | V85X_PROD project | Production |
| V87X_QA:9182 | V87X_QA_DB | V87X_QA project | QA |

**Analysis:** If V85X_PROD:9182 has alert, check V85X_PROD_DB for SQL issues and V85X_PROD builds.

### Technique 3: Change Detection

Identify what changed recently:

**Azure DevOps Changes:**
- Builds in last 24h
- Releases in last 24h
- Code commits with risk factors (SQL changes, config changes)

**SQL Server Changes:**
- Schema changes (new indexes, tables)
- Query plan changes
- Configuration changes

**Prometheus Changes:**
- New alerts firing
- Metrics crossing thresholds
- Target health changes

### Technique 4: Impact Analysis

Determine scope of impact:

**Affected SQL Instances:**
- From SQL Server: Which instances have issues?
- From Prometheus: Which application servers alerted?
- From Azure DevOps: Which projects deployed?

**Cross-reference:**
- Does deployment scope match affected instances?
- Are unrelated instances also affected? (suggests broader issue)

### Technique 5: Evidence Triangulation

Use multiple independent signals to confirm hypothesis:

**Example: Confirming Deployment Cause**

**Signal 1 (Timing):** Deployment 5 minutes before incident
**Signal 2 (Code):** Deployment includes SQL query change
**Signal 3 (Symptom):** Expensive query matches changed query
**Signal 4 (Scope):** Only deployed instance affected

**Conclusion:** High confidence (4 independent signals align)

## Confidence Calibration

### High Confidence (>80%)

Requires:
- 3+ independent signals pointing to same cause
- Clear mechanism explaining symptoms
- No contradictory evidence
- Timing correlation <30 minutes

### Medium Confidence (50-80%)

Characteristics:
- 2 signals align, others weak or absent
- Mechanism plausible but not certain
- Some contradictory evidence exists
- Timing correlation 30-120 minutes

### Low Confidence (<50%)

Characteristics:
- Only 1 weak signal
- Multiple plausible causes
- Significant contradictory evidence
- No clear timing correlation

## Common Pitfalls

### Pitfall 1: Correlation vs Causation

**Mistake:** Deployment happened before incident → deployment caused incident

**Reality:** Need mechanism, not just timing

**Fix:** Ask "HOW would this deployment cause these symptoms?"

### Pitfall 2: Confirmation Bias

**Mistake:** Find deployment, stop looking for other causes

**Reality:** Recent deployment is attractive but may be coincidence

**Fix:** Actively look for contradictory evidence

### Pitfall 3: Ignoring Negative Evidence

**Mistake:** Focus only on data that supports hypothesis

**Reality:** Contradictory data is valuable

**Fix:** Lower confidence when contradictory evidence exists

### Pitfall 4: Over-Generalizing

**Mistake:** "All instances are affected" when only checked one

**Reality:** Need to validate scope with multiple instances

**Fix:** Check multiple instances before making scope claims
