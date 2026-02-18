---
name: disk-space
description: Analyze disk space across SQL Server infrastructure
argument-hint: "[instance|environment|threshold]"
---

Invoke the `disk-space` skill to analyze disk space across SQL Server infrastructure.

This command uses architecture-aware optimization:
- Smart sampling for shared-disk architectures (97% token reduction)
- Per-server queries for independent servers
- Critical drive identification (>90% full)

## Usage

```
/ops:disk-space
/ops:disk-space production
/ops:disk-space >90%
```
