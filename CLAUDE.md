# Infrastructure Plugin Development

## Versioning Requirements

**IMPORTANT**: Every change to this plugin MUST include updates to:

1. **`.claude-plugin/plugin.json`** - Bump version using semver
2. **`.claude-plugin/marketplace.json`** - Match version
3. **`CHANGELOG.md`** - Document changes using Keep a Changelog format

### Version Bumping Rules

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, major reorganization
- **MINOR** (1.0.0 → 1.1.0): New agents, skills, or significant features
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, doc updates, minor improvements

## Directory Structure

```
ops/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   └── marketplace.json     # GitHub auto-install config
├── agents/                  # Specialized AI agents
│   ├── sql-instance-discovery.md
│   ├── prometheus-correlator.md
│   ├── azure-devops-analyzer.md
│   └── incident-report-generator.md
├── skills/                  # Skills with references
│   ├── aiops-investigation/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── mssql-operations/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── quick-health/SKILL.md
│   ├── db-health/SKILL.md
│   ├── disk-space/SKILL.md
│   ├── incident-investigation/SKILL.md
│   ├── performance-analysis/SKILL.md
│   └── deployment-impact/SKILL.md
├── hooks/
│   └── hooks.json           # Auto-loaded by Claude Code
├── .mcp.json               # MCP server configuration
├── README.md               # User documentation
├── CHANGELOG.md            # Version history
└── CLAUDE.md               # This file
```

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
description: "Brief description. <example>Context: ...\\nuser: \"...\"\\nassistant: \"I'll use this agent...\"</example>"
```

## MCP Server Configuration

The plugin uses three MCP servers defined in `.mcp.json`:

- **azure-devops** - Azure DevOps/TFS integration
- **prometheus** - Prometheus monitoring
- **mssql** - SQL Server operations

### Windows Compatibility

All MCP servers use `cmd /c npx` wrapper for Windows:

```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@package/name@latest"]
}
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
