---
name: performance-analysis
description: Deep performance analysis of SQL Server instances
argument-hint: "[instance|environment]"
---

Invoke the `performance-analysis` skill for deep SQL Server performance investigation.

This command analyzes:
- Expensive queries (by CPU, reads)
- Wait statistics (bottleneck identification)
- Blocking chains
- Optimization recommendations

## Usage

```
/infrastructure-plugin:performance-analysis
/infrastructure-plugin:performance-analysis production
/infrastructure-plugin:performance-analysis SQLSERVER01\PROD_DB
```
