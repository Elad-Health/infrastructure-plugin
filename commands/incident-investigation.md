# Incident Investigation

Comprehensive production incident investigation across Prometheus, SQL Server, and Azure DevOps.

## Usage

```
/incident-investigation
```

Optional context:
- Describe the incident: "Users reporting API timeouts"
- When it started: "30 minutes ago" or "since last deployment"

## What This Command Does

Orchestrates a complete AI-powered incident investigation:

1. **Discovery Phase**
   - Invokes `sql-instance-discovery` agent
   - Maps infrastructure from Prometheus
   - Validates discovery (30+ SQL instances expected)

2. **Data Collection Phase**
   - Checks Prometheus alerts and infrastructure metrics
   - Analyzes SQL Server performance across relevant instances
   - Reviews Azure DevOps recent deployments and builds

3. **Correlation Phase**
   - Invokes `prometheus-correlator` agent for infrastructure analysis
   - Invokes `azure-devops-analyzer` agent for deployment correlation
   - Creates unified timeline of events

4. **Analysis Phase**
   - Invokes `incident-report-generator` agent
   - Formulates root cause hypothesis with confidence level
   - Identifies supporting evidence

5. **Reporting Phase**
   - Generates comprehensive incident report
   - Provides immediate remediation actions (for approval)
   - Suggests preventive measures

## Instructions

You are investigating a production incident. Load the `aiops-investigation` skill for methodology.

### Phase 1: Infrastructure Discovery (ALWAYS FIRST)

**Critical:** Before investigating ANY system, discover ALL SQL Server instances.

Invoke the `sql-instance-discovery` agent:
- This agent is specialized in Prometheus → SQL instance mapping
- It will call `mcp__prometheus__list_targets()` and extract SQL instances
- It will display complete discovered list grouped by environment
- Expected: 30-40+ SQL instance names

**Validation checkpoint:**
- [ ] Discovery completed successfully
- [ ] At least 20 instances discovered
- [ ] Complete list displayed to user
- [ ] Instances grouped by environment (Production/QA/Dev)

**DO NOT proceed to Phase 2 until discovery completes successfully.**

---

### Phase 2: Establish Timeline & Collect Data

**Timeline:**
- When did incident start? (from user or Prometheus alerts)
- What symptoms are reported?
- What systems are affected?

**Prometheus Analysis:**
- Call `mcp__prometheus__list_alerts()` for currently FIRING alerts
- Call `mcp__prometheus__get_alert_history(timeRange: "2h")` for recent changes
- For each FIRING alert, get details and investigate related metrics

**SQL Server Analysis:**
- Prioritize instances based on:
  - If user specified affected system → check that instance
  - If disk space incident → check ALL instances
  - If performance incident → check production instances first

- For each relevant instance:
  - `mcp__mssql__get_database_states()` - Check overall health
  - `mcp__mssql__get_blocking()` - Blocking sessions?
  - `mcp__mssql__get_expensive_queries(top: 10)` - Resource-intensive queries?
  - `mcp__mssql__get_wait_stats(top: 10)` - Performance bottlenecks?
  - `mcp__mssql__get_disk_space()` - Disk utilization?
  - `mcp__mssql__get_failed_jobs(hours: 24)` - SQL Agent job failures?

**Azure DevOps Analysis:**
- `mcp__azure-devops__list_builds()` for last 24 hours
- Identify builds around incident time (±2 hours)
- `mcp__azure-devops__list_releases()` for last 24 hours
- Note deployment timing relative to incident start

---

### Phase 3: Correlation & Pattern Recognition

Invoke the `prometheus-correlator` agent to:
- Analyze infrastructure findings
- Map application server alerts to SQL instances
- Identify infrastructure patterns

Invoke the `azure-devops-analyzer` agent to:
- Correlate deployment timing with incident
- Analyze what changed in recent builds
- Review test failures or warnings

Create unified timeline:

| Time | Prometheus | SQL Server | Azure DevOps |
|------|------------|------------|--------------|
| [time] | [alerts fired] | [blocking/queries] | [builds/releases] |
| [time] | [metrics anomalies] | [disk issues] | [code changes] |

Look for patterns:
- **Deployment correlation:** Incident started within 30 minutes of deployment?
- **Cascading failures:** Alert → SQL issue → More alerts?
- **Resource exhaustion:** Disk full → Slow queries → Blocking?

---

### Phase 4: Root Cause Hypothesis

Invoke the `incident-report-generator` agent to synthesize findings.

The agent will:
- Analyze all evidence from Prometheus, SQL, Azure DevOps
- Formulate root cause hypothesis
- Assign confidence level (High/Medium/Low)
- List supporting evidence (3-5 pieces)
- Mention alternative theories if confidence not High

---

### Phase 5: Generate Report

Create comprehensive incident report with these sections:

#### Incident Summary
- Brief description
- Start time and current status
- Affected systems (specific instances, databases, servers)

#### Timeline
Chronological list of key events:
- 14:30 - Incident reported (user complaints)
- 14:32 - Prometheus alert: DiskSpaceAlert on V87X_QA
- 14:35 - SQL blocking detected on V87X_QA_DB (SPID 52)
- 14:35 - Build #1234 deployed to V87X_QA
- 14:40 - Prometheus alert: CPUUsageHigh on V87X_QA

#### Root Cause Analysis
- **Hypothesis:** [Most likely cause]
- **Confidence:** High (>80%) / Medium (50-80%) / Low (<50%)
- **Supporting Evidence:**
  - Evidence point 1 (with specific data/metrics)
  - Evidence point 2
  - Evidence point 3
- **Alternative Theories:** [If confidence not High, mention other possibilities]

#### Impact Assessment
- **Severity:** P0 / P1 / P2 (with justification)
- **Affected Systems:** [Specific instances, databases, application servers]
- **User Impact:** [All users, subset, specific functionality]
- **Data Impact:** [Any data loss or corruption]

#### Remediation Plan

**Immediate Actions (for approval):**
1. [Most critical action first]
2. [Second priority action]
3. [Third priority action]

Example:
- Kill blocking session SPID 52 on V87X_QA_DB to unblock 15 waiting sessions
- Rollback build #1234 to previous known-good version
- Monitor disk space on D: drive for continued growth

**Verification Steps:**
- How to confirm the fix worked (specific metrics to check)
- Expected timeframe for recovery
- What to monitor post-fix

**Preventive Measures:**
- What monitoring was missing that would have caught this earlier?
- What validation should be added to deployment pipeline?
- What process changes are needed?

---

## Safety Notes

**CRITICAL: All remediation actions require human approval.**

- Do NOT execute destructive actions (kill sessions, rollback, restart) automatically
- Present recommendations clearly for user to approve
- Flag any actions that could cause data loss or extended outage
- If unsure about any step, ask user for clarification before proceeding

## Error Handling

If any phase fails:
- Continue investigation with available data
- Clearly note what data is missing and why
- Suggest troubleshooting for failed system (connection issue, permissions, etc.)
- Distinguish between "service down" vs "cannot reach service"

## Example Investigation Output

See `docs/WORKFLOWS.md` for complete example investigations of:
- Disk space incident
- Performance degradation
- Deployment-related issue
