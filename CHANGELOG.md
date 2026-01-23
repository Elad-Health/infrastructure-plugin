# Changelog

All notable changes to the Infrastructure Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-23

### Added

**Core Plugin Infrastructure:**
- Plugin manifest with official schema
- MCP server configuration using npx @latest approach
- Environment variable template for all three systems

**Agents (Specialized AI Experts):**
- `sql-instance-discovery` - Discovers SQL instances from Prometheus
- `prometheus-correlator` - Analyzes infrastructure metrics and correlations
- `azure-devops-analyzer` - Analyzes deployment history and code changes
- `incident-report-generator` - Synthesizes findings and generates reports

**Skills (Persistent Knowledge):**
- `aiops-investigation` - Complete investigation methodology with 6 phases
- `mssql-operations` - SQL Server architecture and operational knowledge
- Reference documentation for discovery patterns, correlation techniques, and infrastructure architecture

**Commands (User-Facing Workflows):**
- `/incident-investigation` - Comprehensive incident response workflow
- `/db-health` - Quick health check across all instances
- `/disk-space` - Detailed disk space analysis
- `/performance-analysis` - Deep performance investigation
- `/deployment-impact` - Deployment correlation analysis

**MCP Server Integration:**
- Azure DevOps MCP server (77 tools)
- Prometheus MCP server (monitoring and alerts)
- SQL Server MCP server (database operations)

**Documentation:**
- Comprehensive README with quick start
- Detailed setup guide (SETUP.md)
- Workflow examples (WORKFLOWS.md)
- Troubleshooting guide (TROUBLESHOOTING.md)

### Features

**Multi-Layered AI Architecture:**
- Commands provide user-facing workflows
- Agents provide specialized domain expertise
- Skills provide persistent infrastructure knowledge
- MCP servers provide real-time data access

**Discovery-First Pattern:**
- Automatic SQL instance discovery from Prometheus
- No hardcoded instance lists
- Dynamic infrastructure mapping

**Multi-System Correlation:**
- Unified timeline across Prometheus, SQL Server, Azure DevOps
- Application server → SQL instance mapping
- Deployment → Infrastructure → Database correlation

**Confidence-Based Analysis:**
- High/Medium/Low confidence levels
- Evidence-based hypothesis formulation
- Alternative theories when confidence not high

**Safety Features:**
- All remediation actions require approval
- No automatic destructive operations
- Clear risk assessment for recommendations

## [Unreleased]

### Planned for v1.1
- Capacity planning command
- Alert correlation command
- Historical incident search

### Planned for v2.0
- Automated remediation (safe actions)
- Multi-environment support
- Runbook executor
