---
name: incident-investigation
description: Full production incident investigation across Prometheus, SQL Server, and Azure DevOps. Use when users report issues, outages, or performance problems.
user-invocable: true
argument-hint: "[description of incident]"
model: sonnet
skills:
  - aiops-investigation
  - mssql-operations
---

# Incident Investigation

Comprehensive incident investigation using multi-system correlation and AI-powered analysis.

## Usage

```
/infrastructure-plugin:incident-investigation
/infrastructure-plugin:incident-investigation Users reporting timeouts on production API
/infrastructure-plugin:incident-investigation Application slow since last deployment
```

## Arguments

- **No argument:** Interactive investigation - will ask for details
- **Description:** Brief description of the incident to investigate

## What This Skill Does

1. **Discovery** - Automatically discovers infrastructure from Prometheus
2. **Data Collection** - Gathers evidence from Prometheus, SQL Server, Azure DevOps
3. **Correlation** - Connects findings across systems using specialized agents
4. **Root Cause Analysis** - Formulates hypothesis with confidence scoring
5. **Remediation Plan** - Provides actionable recovery steps

## Investigation Phases

### Phase 1: Discovery & Context

**Invoke `sql-instance-discovery` agent:**
- Get complete infrastructure inventory
- Detect architecture pattern
- Group by environment

**Establish Context:**
- When did incident start? (from user or infer from alerts)
- What systems are affected?
- What symptoms are reported?

### Phase 2: Multi-System Data Collection

**Prometheus (invoke `prometheus-correlator` agent):**
- `mcp__prometheus__list_alerts()` - Current firing alerts
- `mcp__prometheus__get_alert_history()` - Recent alert changes
- Identify infrastructure anomalies

**SQL Server (architecture-aware querying):**
For relevant instances (prioritize production, then affected systems):
- `mcp__mssql__get_database_states()` - Overall health
- `mcp__mssql__get_blocking()` - Blocking chains
- `mcp__mssql__get_expensive_queries()` - Resource-intensive queries
- `mcp__mssql__get_wait_stats()` - Performance bottlenecks

**Azure DevOps (invoke `azure-devops-analyzer` agent):**
- Recent builds and releases
- Deployments near incident time
- Code changes in deployments

### Phase 3: Correlation Analysis

**Create Unified Timeline:**
- Map events across all systems
- Identify temporal correlations
- Connect application servers to SQL instances

**Look for Patterns:**
- Deployment → Alert → Database issue (deployment caused incident)
- Disk full → Slow queries → Blocking (cascading failure)
- Alert storm → Multiple symptoms (infrastructure-wide issue)

### Phase 4: Root Cause Hypothesis

**Invoke `incident-report-generator` agent:**
- Synthesize findings from all systems
- Formulate root cause hypothesis
- Assign confidence level

**Confidence Scoring:**
- **High (>80%):** Multiple independent signals point to same cause
- **Medium (50-80%):** Strong correlation but some ambiguity
- **Low (<50%):** Insufficient data or multiple plausible causes

### Phase 5: Impact Assessment

**Determine:**
- Which systems affected?
- Which environments? (production only or also QA/dev)
- Type of impact: Complete outage vs degraded performance
- User impact: All users vs subset

**Assign Severity:**
- **P0:** Complete production outage, all users affected
- **P1:** Major issue, significant user impact, workaround possible
- **P2:** Minor issue, limited impact, can wait for normal fix

### Phase 6: Remediation Plan

**Immediate Actions** (require approval):
- If blocking: "Kill head blocker SPID {number}"
- If deployment issue: "Rollback to build {number}"
- If disk space: "Free up space on {drive}"
- If resource exhaustion: "Restart {service}"

**Verification Steps:**
- How to confirm fix worked
- Expected recovery timeframe
- Metrics to monitor

**Preventive Measures:**
- What monitoring was missing?
- What validation should be added?
- Process improvements needed?

## Report Format

```
## Incident Investigation Report

**Incident:** {brief description}
**Investigation Time:** {timestamp}
**Status:** {Active/Resolved/Mitigated}

### Executive Summary
{2-3 sentence summary of root cause and impact}

### Timeline
- {time}: {event 1}
- {time}: {event 2}
- {time}: {event 3}

### Root Cause
**Hypothesis:** {description}
**Confidence:** {High/Medium/Low} ({percentage}%)

**Supporting Evidence:**
1. {evidence 1}
2. {evidence 2}
3. {evidence 3}

**Alternative Theories:** (if confidence not High)
- {alternative 1}
- {alternative 2}

### Impact Assessment
- **Affected Systems:** {list}
- **Environments:** {production/QA/dev}
- **User Impact:** {description}
- **Severity:** {P0/P1/P2}

### Remediation Plan

**Immediate Actions** (require approval):
1. {action 1} - Expected result: {result}
2. {action 2} - Expected result: {result}

**Verification:**
- {how to verify fix worked}
- Expected recovery: {timeframe}

**Prevention:**
- {preventive measure 1}
- {preventive measure 2}

### Investigation Quality
- **Data Sources:** Prometheus ✅, SQL Server ✅, Azure DevOps ✅
- **Instances Checked:** {count}
- **Confidence Factors:** {what increased/decreased confidence}
```

## Token Efficiency

Uses progressive investigation:
1. Lightweight queries first (alerts, health checks)
2. Deep dive only on identified problem areas
3. Architecture-aware SQL querying

**Expected token usage:** 50-100k tokens for typical investigation
