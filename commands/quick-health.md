---
name: quick-health
description: Fast infrastructure health check across Prometheus, SQL Server, and Azure DevOps
argument-hint: "[environment]"
---

Invoke the `quick-health` skill to perform a fast infrastructure health check.

This command runs lightweight queries to quickly assess:
- Prometheus alerts (FIRING/PENDING)
- SQL Server database states (ONLINE/OFFLINE/SUSPECT)
- Recent Azure DevOps deployments

## Usage

```
/ops:quick-health
/ops:quick-health production
```
