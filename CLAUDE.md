# Infrastructure Plugin Development

## Repository Structure

This is a **monorepo** containing the Claude Code plugin and all three MCP servers.

```
infrastructure-plugin/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest
│   └── marketplace.json         # GitHub auto-install config
├── agents/                      # Specialized AI agents
│   ├── sql-instance-discovery.md
│   ├── prometheus-correlator.md
│   ├── azure-devops-analyzer.md
│   └── incident-report-generator.md
├── skills/                      # Skills with references
│   ├── aiops-investigation/
│   ├── mssql-operations/
│   ├── quick-health/
│   ├── db-health/
│   ├── disk-space/
│   ├── incident-investigation/
│   ├── performance-analysis/
│   └── deployment-impact/
├── mcp-servers/                 # MCP servers (npm workspaces)
│   ├── mssql/                   # @elad-nofy/mssql-mcp
│   ├── prometheus/              # @elad-nofy/prometheus-mcp
│   └── azure-devops/            # azure-devops-mcp
├── hooks/
│   └── hooks.json               # Auto-loaded by Claude Code
├── .github/workflows/
│   ├── ci.yml                   # Build + type-check all workspaces
│   └── publish.yml              # Tag-based npm publish per workspace
├── .mcp.json                    # MCP server configuration (npx for end users)
├── package.json                 # Root workspace config
├── tsconfig.base.json           # Shared TypeScript config
├── CHANGELOG.md
└── CLAUDE.md                    # This file
```

## Versioning

### Plugin Versioning

Every change to the plugin (agents, skills, hooks, commands) MUST include updates to:

1. **`.claude-plugin/plugin.json`** - Bump version using semver
2. **`.claude-plugin/marketplace.json`** - Match version
3. **`CHANGELOG.md`** - Document changes using Keep a Changelog format

### MCP Server Versioning

Each MCP server is versioned independently and published to npm via git tags:

```bash
git tag mssql-v0.1.0 && git push --tags         # publishes @elad-nofy/mssql-mcp
git tag prometheus-v1.0.1 && git push --tags     # publishes @elad-nofy/prometheus-mcp
git tag azure-devops-v1.2.0 && git push --tags   # publishes azure-devops-mcp
```

### Version Bumping Rules

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, major reorganization
- **MINOR** (1.0.0 → 1.1.0): New tools, significant features
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, doc updates, minor improvements

## Development Workflow

### Building

```bash
npm install                    # Install all workspace dependencies
npm run build                  # Build all MCP servers
npm run build:mssql            # Build only mssql
npm run build:prometheus       # Build only prometheus
npm run build:azure-devops     # Build only azure-devops
```

### CI/CD

- **CI** (`ci.yml`): Runs on every push/PR to main. Builds and type-checks all 3 workspaces.
- **Publish** (`publish.yml`): Runs on tags matching `mssql-v*`, `prometheus-v*`, `azure-devops-v*`. Parses the tag to determine which workspace to publish.

## MCP Server Configuration

The plugin uses three MCP servers defined in `.mcp.json`:

- **mssql** — SQL Server operations (`mcp-servers/mssql/`)
- **prometheus** — Prometheus monitoring (`mcp-servers/prometheus/`)
- **azure-devops** — Azure DevOps/TFS integration (`mcp-servers/azure-devops/`)

### Windows Compatibility

All MCP servers use `cmd /c npx` wrapper for Windows in `.mcp.json`:

```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@package/name@latest"]
}
```

### MCP Server Architecture

Each MCP server follows the same structure:

```
mcp-servers/<name>/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── config.ts          # Zod-validated environment config
│   ├── <name>Client.ts    # Core client logic
│   └── tools/             # Tool definitions grouped by domain
├── package.json           # Independent npm package
└── tsconfig.json          # Extends ../../tsconfig.base.json
```

Key design principles:
- Each server uses `new sql.ConnectionPool(config)` (NOT `sql.connect()`) for per-instance pools
- Named instance resolution uses SQL Server Browser (UDP 1434)
- Connection pools are cached per unique server string
- All queries are read-only (SELECT only)

## Skill Compliance Checklist

### YAML Frontmatter (Required)

- [ ] `name:` present and matches directory name (lowercase-with-hyphens)
- [ ] `description:` present and uses **third person** ("This skill should be used when...")
- [ ] `user-invocable:` set appropriately (true for slash commands, false for knowledge skills)

### Reference Links (Required if references/ exists)

- [ ] All files in `references/` are linked as `[filename.md](./references/filename.md)`
- [ ] No bare backtick references - use proper markdown links

### Writing Style

- [ ] Use imperative/infinitive form (verb-first instructions)
- [ ] Avoid second person ("you should") in instructions - use objective language

## Agent Compliance Checklist

### YAML Frontmatter (Required)

- [ ] `name:` present (lowercase-with-hyphens)
- [ ] `description:` present with example usage pattern
- [ ] `tools:` comma-separated string of MCP tools needed
- [ ] `model:` specified (sonnet, haiku, or inherit)
- [ ] `skills:` list of knowledge skills this agent uses

### Description Examples

Include example usage in agent descriptions for auto-discovery:

```yaml
description: "Brief description. <example>Context: ...\nuser: \"...\"\nassistant: \"I'll use this agent...\"</example>"
```

## Hooks

Hooks are defined in `hooks/hooks.json` and auto-loaded by Claude Code.

**Do NOT** reference hooks in plugin.json - this causes duplicate loading errors.

## Testing

After changes, test with:

```bash
/plugin reload ops
/ops:quick-health
```
