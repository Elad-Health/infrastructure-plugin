---
name: deployment-impact
description: Analyze recent deployments and their impact on infrastructure
argument-hint: "[hours|build-number]"
---

Invoke the `deployment-impact` skill to correlate deployments with infrastructure issues.

This command analyzes:
- Recent builds and releases from Azure DevOps
- Timing correlation with alerts and incidents
- Code changes in deployments
- Rollback recommendations if needed

## Usage

```
/infrastructure-plugin:deployment-impact
/infrastructure-plugin:deployment-impact 24h
/infrastructure-plugin:deployment-impact build-1234
```
