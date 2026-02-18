# Changelog

All notable changes to the Infrastructure Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-18

### Changed

- **BREAKING:** Renamed plugin from `infrastructure-plugin` to `ops` for shorter command invocations
  - All skills now use `/ops:` prefix (e.g., `/ops:quick-health` instead of `/infrastructure-plugin:quick-health`)
  - Updated plugin.json, marketplace.json, all SKILL.md files, command files, README, and CLAUDE.md

## [1.0.6] - 2025-01-24

### Fixed

- Changed all `model: sonnet` and `model: haiku` to `model: inherit` for Bedrock EU compatibility
- Skills and agents now respect user's configured model region

### Added

- Restored `commands/` directory for slash command auto-completion
- Commands: quick-health, db-health, disk-space, incident-investigation, performance-analysis, deployment-impact

## [1.0.5] - 2025-01-24

### Fixed

- Removed duplicate hooks reference from plugin.json (hooks/hooks.json is auto-loaded)

## [1.0.4] - 2025-01-24

### Added - Skill Reference Files

**Reference Documentation:**
- `skills/mssql-operations/references/wait-types.md` - SQL Server wait type interpretation guide
- `skills/mssql-operations/references/common-issues.md` - Quick reference for diagnosing common SQL issues
- `skills/aiops-investigation/references/incident-patterns.md` - Common incident patterns and investigation flows
- `skills/aiops-investigation/references/correlation-techniques.md` - Multi-system correlation methods

**How References Work:**
- Knowledge skills (`mssql-operations`, `aiops-investigation`) own reference files
- Child skills inherit references via `skills:` field in frontmatter
- Haiku-based skills skip heavy references for speed

### Fixed

- Restored reference files for skills (were deleted in 1.0.3)
- CHANGELOG correction: 1.0.3 incorrectly listed references as removed

## [1.0.3] - 2025-01-24

### Added - Skills-Based Architecture

**New Skills (6 user-invocable):**
- `quick-health` - Fast daily health check using haiku model
- `disk-space` - Architecture-aware disk space analysis
- `incident-investigation` - Full incident response workflow
- `db-health` - Quick database state verification
- `performance-analysis` - Deep performance investigation
- `deployment-impact` - Deployment correlation analysis

**Hooks System:**
- `hooks/hooks.json` - Automated result analysis
- PostToolUse hooks for disk space, blocking, alerts
- SubagentStop hooks for discovery validation

**Agent Enhancements:**
- All agents now linked to relevant skills via `skills:` field
- Proper tool format (comma-separated string)
- Removed invalid `capabilities` field

**Infrastructure:**
- `marketplace.json` restored for GitHub auto-install/update
- `plugin.json` updated with hooks and mcpServers references

### Changed

**Architecture:**
- Migrated from legacy commands to modern skills
- Skills support arguments, model selection, context forking
- Better user experience with argument hints

### Removed

- `commands/` directory (migrated to skills)

## [1.0.2] - 2025-01-24

### Removed - Documentation Consolidation

**Deleted redundant human documentation:**
- Removed `docs/` directory entirely (CONFIGURATION-GUIDE.md, SETUP.md, TOKEN-OPTIMIZATION.md, TROUBLESHOOTING.md, WORKFLOWS.md)
- Removed INSTALL.md
- Removed IMPROVEMENTS.md
- Removed DYNAMIC-REFACTORING.md

**All essential information consolidated into README.md:**
- Installation & setup instructions
- Configuration examples for all platforms
- Troubleshooting guide
- Usage examples
- Architecture documentation
- Performance optimization details

**Rationale:**
- Single source of truth in README.md
- Easier maintenance
- Better user experience (one file to read)
- Agent/command/skill files preserved (required for Claude Code functionality)

### Changed - Universal Dynamic Support (Major Enhancement)

**Dynamic Infrastructure Discovery:**
- Completely refactored to work with ANY company's infrastructure
- Removed all hardcoded server and instance names
- Plugin now discovers and adapts to user's specific Prometheus/SQL Server setup
- Zero configuration needed beyond connection details

**Architecture-Aware Optimization:**
- Auto-detects infrastructure patterns (shared-disk vs independent servers)
- Applies appropriate token optimization based on detected architecture
- Smart sampling for shared-disk environments (97% token reduction)
- Per-server querying for independent server environments
- Hybrid strategy for mixed architectures

**Flexible Prometheus Integration:**
- Adapts to any Prometheus label schema
- Supports multiple exporter types (windows_exporter, mssql_exporter, custom)
- Handles various instance name formats (named instances, standalone, cloud)
- Works with any naming convention

**Universal Environment Detection:**
- Auto-detects production, QA, dev, staging environments
- Case-insensitive pattern matching
- Supports common environment naming variations
- Works with custom environment labels

### Added

**Documentation:**
- `docs/CONFIGURATION-GUIDE.md` - Comprehensive configuration for any infrastructure
  - Infrastructure architecture patterns
  - MCP server configuration for Windows/Linux/Mac
  - Prometheus label configuration
  - Token optimization strategies per architecture type
  - Multi-tenant and cloud setup patterns
  - Testing and troubleshooting guidance
- `DYNAMIC-REFACTORING.md` - Complete refactoring documentation
  - Explains dynamic discovery approach
  - Architecture detection logic
  - Real-world examples for different company types
  - Migration path for existing users

**Enhanced Agent Capabilities:**
- `agents/sql-instance-discovery.md` - Fully dynamic discovery agent
  - Works with any Prometheus setup
  - Flexible label parsing
  - Architecture detection
  - Environment categorization
  - Adaptive instance name extraction

**Enhanced Command Intelligence:**
- `commands/disk-space.md` - Architecture-aware disk space analysis
  - Detects shared-disk vs independent server architecture
  - Applies appropriate optimization automatically
  - Generic examples work for any infrastructure
  - Clear architecture insights in output

### Impact

**Universal Applicability:**
- Plugin now works with ANY company's infrastructure
- Small businesses (5 servers) to enterprises (50+ servers)
- Traditional Windows SQL to cloud-native databases
- Single data centers to multi-region deployments
- MSPs can use for all customers without modification

**No Breaking Changes:**
- Existing configurations continue to work
- All commands remain backward compatible
- Discovery now shows what was previously assumed
- Token optimizations still apply

**Key Benefits:**
- **For Users:** Zero configuration overhead, automatic adaptation
- **For MSPs:** One plugin for all customers, multi-tenant ready
- **For Developers:** Maintainable, testable, extensible
- **For Enterprises:** Works with complex hybrid architectures

## [1.0.1] - 2025-01-24

### Fixed

**Windows Compatibility:**
- Fixed MCP server execution on Windows by adding `cmd /c` wrapper to all server commands
- Updated `.mcp.json` configurations for azure-devops, prometheus, and mssql servers
- Windows users can now properly load and use all MCP servers

### Changed

**Token Usage Optimization (Major Performance Improvement):**
- Optimized `/disk-space` command with smart sampling approach
  - Reduced token usage from 446k to 15-30k tokens (97% reduction)
  - Query only representative instances since all share physical drives
  - Progressive investigation: drill down only when critical issues found
- Optimized `/incident-investigation` command with progressive investigation pattern
  - Reduced token usage from 500k+ to 50-100k tokens (90% reduction)
  - Lightweight queries first, detailed analysis only for affected systems
  - Targeted investigation based on Prometheus alerts and user context

### Added

**Documentation:**
- `docs/TOKEN-OPTIMIZATION.md` - Comprehensive token optimization guide
  - Explains optimization strategies (batching, sampling, progressive investigation)
  - Command-specific optimization patterns
  - Token usage comparisons and best practices
- `IMPROVEMENTS.md` - Detailed log of optimizations and architectural insights
  - Documents the CHAMDB shared-drive architecture
  - Provides token usage comparison tables
  - Outlines future optimization opportunities

### Impact

**Before Optimizations:**
- Commands frequently exceeded context limits
- `/disk-space` on 31 instances: 446k tokens
- `/incident-investigation`: 500k+ tokens
- Poor Windows support

**After Optimizations:**
- All commands stay within context limits
- `/disk-space`: 15-30k tokens (97% reduction)
- `/incident-investigation`: 50-100k tokens (90% reduction)
- Full Windows compatibility

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
