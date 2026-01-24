---
name: incident-investigation
description: Full production incident investigation across all systems
argument-hint: "[description of incident]"
---

Invoke the `incident-investigation` skill for comprehensive incident analysis.

This command performs multi-system correlation:
- Prometheus alerts and metrics
- SQL Server performance and blocking
- Azure DevOps deployment history
- Root cause hypothesis with confidence scoring

## Usage

```
/infrastructure-plugin:incident-investigation
/infrastructure-plugin:incident-investigation Users reporting timeouts on API
/infrastructure-plugin:incident-investigation Application slow since deployment
```
