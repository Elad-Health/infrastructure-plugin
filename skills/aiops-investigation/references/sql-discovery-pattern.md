# SQL Instance Discovery Pattern

## Overview

The SQL instance discovery pattern is the foundation of all AIOps investigations. It maps Prometheus-monitored application servers to SQL Server instances on CHAMDB.

## Architecture

### Application Server vs SQL Instance

**Application Servers:**
- Run application code (IIS, .NET applications)
- Monitored by Prometheus windows_exporter on port 9182
- Examples: V85X_PROD:9182, V87X_QA:9182, V91X_DEV:9182

**SQL Server Instances:**
- Run on CHAMDB (chamdb.eladsolutions.local)
- Named instances (30+ instances on single host)
- Named after application servers with "_DB" suffix
- Examples: V85X_PROD_DB, V87X_QA_DB, V91X_DEV_DB

### Naming Convention

```
Application Server → SQL Instance
V85X_PROD        → V85X_PROD_DB
V87X_PROD        → V87X_PROD_DB
V85X_PROD2       → V85X_PROD2_DB
V87X_QA          → V87X_QA_DB
V91X_DEV         → V91X_DEV_DB
```

## Discovery Implementation

### Step 1: Query Prometheus Targets

```python
# Pseudocode
targets = prometheus.list_targets()
```

Returns all monitored targets including:
- windows_exporter targets (application servers)
- node_exporter targets (Linux servers)
- blackbox_exporter targets (endpoint monitoring)
- Other exporters

### Step 2: Filter Windows Exporter Targets

```python
# Filter for windows_exporter job
windows_targets = [t for t in targets if t.job == "windows_exporter"]

# Example result:
# [
#   {job: "windows_exporter", instance: "V85X_PROD:9182", health: "up"},
#   {job: "windows_exporter", instance: "V87X_PROD:9182", health: "up"},
#   {job: "windows_exporter", instance: "V87X_QA:9182", health: "up"},
#   ...
# ]
```

### Step 3: Transform to SQL Instance Names

```python
sql_instances = []
for target in windows_targets:
    # Extract hostname: "V85X_PROD:9182" → "V85X_PROD"
    hostname = target.instance.split(":")[0]

    # Append "_DB" suffix: "V85X_PROD" → "V85X_PROD_DB"
    sql_instance = f"{hostname}_DB"

    sql_instances.append(sql_instance)
```

### Step 4: Environment Classification

```python
def classify_environment(instance_name):
    if "_PROD_" in instance_name or "_PROD2_" in instance_name:
        return "Production"
    elif "_QA_" in instance_name:
        return "QA/Test"
    elif "_DEV_" in instance_name:
        return "Development"
    else:
        return "Other"

# Group instances by environment
production = [i for i in sql_instances if classify_environment(i) == "Production"]
qa = [i for i in sql_instances if classify_environment(i) == "QA/Test"]
dev = [i for i in sql_instances if classify_environment(i) == "Development"]
other = [i for i in sql_instances if classify_environment(i) == "Other"]
```

### Step 5: Validation

```python
total_instances = len(sql_instances)

if total_instances < 20:
    raise DiscoveryError(
        f"Only {total_instances} instances discovered. Expected 30-40+. "
        "Check Prometheus connectivity or windows_exporter configuration."
    )
```

## Expected Results

**Typical Discovery Output:**
- Production: 15-20 instances
- QA/Test: 10-15 instances
- Development: 5-10 instances
- Other: 2-5 instances
- **Total: 30-40+ instances**

## Error Scenarios

### Scenario 1: Prometheus Unreachable

**Symptom:** `list_targets()` fails with connection error

**Cause:** Network issue, Prometheus down, wrong URL

**Resolution:**
1. Verify Prometheus URL in environment variables
2. Check network connectivity
3. Verify Prometheus service is running
4. Check credentials if authentication required

### Scenario 2: Zero Windows Exporter Targets

**Symptom:** No targets with `job="windows_exporter"`

**Cause:** Exporters not configured, wrong job name

**Resolution:**
1. Verify windows_exporter is deployed to application servers
2. Check Prometheus scrape configuration
3. Verify job name matches "windows_exporter"

### Scenario 3: Partial Discovery (<20 instances)

**Symptom:** Some instances found but fewer than expected

**Cause:** Some exporters down, partial Prometheus outage

**Resolution:**
1. Check which application servers are missing
2. Verify those servers are running
3. Check if specific exporters are down
4. Proceed with available instances but note limitation

## Why Discovery First?

**Benefits:**
1. **No hardcoding:** Don't need to maintain static instance list
2. **Dynamic discovery:** Automatically finds new instances
3. **Environment validation:** Confirms infrastructure is healthy
4. **Correlation foundation:** Provides mapping for later analysis
5. **Safety:** Don't query instances that don't exist

**Without discovery:**
- Risk querying non-existent instances (errors)
- Miss newly added instances (incomplete analysis)
- No validation that infrastructure is accessible
