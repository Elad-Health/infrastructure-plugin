---
name: aiops-investigation
description: Use this skill for production incident investigation. Provides investigation methodology, correlation techniques, and infrastructure knowledge for autonomous incident response.
user-invocable: true
model: inherit
---

# AIOps Investigation Skill

You are investigating production infrastructure incidents using AI-powered analysis across multiple systems.

## Investigation Methodology

### Phase 1: Discovery & Baseline

**Objective:** Understand current infrastructure state

**Actions:**
1. **Discover Infrastructure**
   - Invoke `sql-instance-discovery` agent
   - Validate discovery results
   - Detect architecture pattern (shared-disk vs independent servers)
   - Map application servers to SQL instances

2. **Establish Timeline**
   - When did incident start? (from user or alerts)
   - What systems are affected?
   - What changed recently?

### Phase 2: Multi-System Data Collection

**Objective:** Gather evidence from all systems

**Prometheus Analysis:**
- Call `mcp__prometheus__list_alerts()` for FIRING alerts
- Call `mcp__prometheus__get_alert_history()` for recent alert changes
- Query relevant metrics (CPU, memory, disk, network)
- Identify infrastructure anomalies

**SQL Server Analysis:**
- For each relevant instance (prioritize based on incident):
  - `mcp__mssql__get_blocking()` - Check for blocking sessions
  - `mcp__mssql__get_expensive_queries()` - Identify resource-intensive queries
  - `mcp__mssql__get_wait_stats()` - Analyze performance bottlenecks
  - `mcp__mssql__get_disk_space()` - Check disk utilization
  - `mcp__mssql__get_failed_jobs()` - Review SQL Agent job failures

**Azure DevOps Analysis:**
- `mcp__azure-devops__list_builds()` for last 24 hours
- `mcp__azure-devops__list_releases()` for last 24 hours
- Identify deployments near incident time

### Phase 3: Correlation Analysis

**Objective:** Connect findings across systems

**Invoke `prometheus-correlator` agent** to:
- Create unified timeline of events
- Map application servers to SQL instances
- Identify infrastructure patterns

**Invoke `azure-devops-analyzer` agent** to:
- Correlate deployment timing with incident
- Identify code changes in deployment
- Review test results and build logs

**Look for patterns:**
- Deployment → Alert → Database issue (deployment caused incident)
- Disk full → Slow queries → Blocking (cascading failure)
- Alert storm → Multiple symptoms (widespread infrastructure issue)

### Phase 4: Root Cause Hypothesis

**Objective:** Determine most likely cause

**Invoke `incident-report-generator` agent** to:
- Synthesize findings from all systems
- Formulate root cause hypothesis
- Assign confidence level: High (>80%), Medium (50-80%), Low (<50%)
- List supporting evidence (3-5 pieces)
- Mention alternative theories if confidence not High

**Confidence Scoring:**
- **High (>80%):** Multiple independent signals point to same cause
  - Example: Deployment timing + new code + specific error + affected instances
- **Medium (50-80%):** Strong correlation but some ambiguity
  - Example: Deployment timing aligns but no obvious code issue
- **Low (<50%):** Insufficient data or multiple plausible causes
  - Example: Symptoms present but no clear triggering event

### Phase 5: Impact Assessment

**Objective:** Quantify blast radius

**Determine:**
- Which systems affected? (specific SQL instances, application servers)
- Which environments? (production only or also QA/dev)
- Type of impact: Complete outage vs degraded performance
- User impact: All users vs subset
- Data impact: Any data loss or corruption?

**Assign Severity:**
- **P0:** Complete production outage, all users affected, critical business function down
- **P1:** Major production issue, significant user impact, workaround possible
- **P2:** Minor production issue, limited user impact, can wait for normal fix

### Phase 6: Remediation Plan

**Objective:** Provide actionable recovery steps

**Immediate Actions** (for approval - never execute automatically):
- If SQL blocking: "Kill head blocker session SPID [number] to unblock [X] waiting sessions"
- If deployment issue: "Rollback to build [number] from [time] (last known good)"
- If disk space: "Free up space on [specific drive/server]"
- If resource exhaustion: "Restart [specific service]"

**Verification Steps:**
- How to confirm fix worked (measurable criteria)
- Expected recovery timeframe
- What metrics to monitor

**Preventive Measures:**
- What monitoring was missing?
- What validation should be added to deployment pipeline?
- What process changes needed?

## Storage Path Analysis (Critical)

**NEVER assume storage paths are uniform across instances.**

When analyzing `get_disk_space()` results:
- Examine the actual `file_path` field in results
- System databases (master, model, msdb): Often on C: drive
- User databases: Typically on D: drive but VERIFY from data
- Transaction logs: Often on L: drive but check actual paths
- tempdb: Often on T: drive but verify

**Report ACTUAL paths from data:**
- Good: "Database data file is on D:\Instance\Data\MyDatabase.mdf (65 GB)"
- Bad: "All instances use D: for data files" (inaccurate generalization)

## Application Server ↔ SQL Instance Correlation

**Critical Pattern:** Prometheus monitors application servers, SQL instances discovered dynamically.

**Correlation Flow:**
1. Prometheus alert on application server (e.g., `hostname:9182`)
2. Extract server identifier from alert
3. Map to SQL instance using discovery results
4. Check corresponding SQL instance for database issues

**Example Correlation:**
1. Prometheus alert: `CPUUsageHigh` on `appserver-prod:9182`
2. Discovery shows SQL instance: `SQLHOST\PROD_DB` serves this application
3. Check `PROD_DB` for expensive queries
4. If expensive query found: Application load is causing database load
5. Root cause: Application behavior triggering database bottleneck

This correlation is KEY to incident investigation.

## Investigation Patterns

### Pattern: Disk Space Incident

1. Discovery → Find all SQL instances
2. Disk check → Identify instance(s) with >90% disk usage
3. Identify database(s) → Which databases are large?
4. Check growth → Transaction log growth? Data file growth?
5. Recent changes → Deployment that changed data access patterns?
6. Remediation → Shrink logs if safe, or free up space

### Pattern: Performance Incident

1. Discovery → Find all SQL instances
2. Identify affected instance(s) → User reports or alerts
3. Check blocking → Is something blocked?
4. Check expensive queries → What's consuming CPU/IO?
5. Check wait stats → What's the bottleneck? (PAGEIOLATCH, WRITELOG, etc.)
6. Correlate with deployment → Did recent deployment introduce bad query?
7. Remediation → Kill blocker, optimize query, or rollback deployment

### Pattern: Deployment-Related Incident

1. Timing correlation → When did incident start vs when deployment happened?
2. Review deployment → What changed? (code, queries, schema)
3. Check test results → Were there test failures ignored?
4. Check affected instances → Which SQL instances impacted?
5. Identify specific change → Which code change caused issue?
6. Remediation → Rollback deployment, fix code, redeploy

## Best Practices

1. **Always discover instances first** - Never assume you know which instances exist
2. **Check multiple instances** - One instance down doesn't mean all are down
3. **Correlate across systems** - Prometheus + SQL + Azure DevOps provides complete picture
4. **Verify from data** - Don't make assumptions about storage paths or configurations
5. **Confidence levels matter** - Be honest about confidence, mention alternatives
6. **Safety first** - All remediation actions require approval, never auto-execute

## Architecture-Aware Investigation

**Shared-Disk Multi-Instance Architecture:**
- Multiple instances share physical drives
- Disk space issues affect all instances
- Use smart sampling for disk queries (1-2 instances for drive info)

**Independent Server Architecture:**
- Each server has independent resources
- Query each server for complete picture
- No shared-resource concerns
