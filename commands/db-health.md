---
name: db-health
description: Quick database health check across SQL Server instances
argument-hint: "[environment]"
---

Invoke the `db-health` skill to check database health across all SQL Server instances.

This command verifies database states and identifies:
- Offline databases
- Suspect databases
- Recovering databases

## Usage

```
/infrastructure-plugin:db-health
/infrastructure-plugin:db-health production
```
