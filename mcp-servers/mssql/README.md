# MSSQL MCP Server

MCP (Model Context Protocol) server for Microsoft SQL Server. Provides AI assistants with read-only access to SQL Server for query execution, performance analysis, health monitoring, and troubleshooting.

## Features

### Connection & Discovery
- **test_connection** - Verify SQL Server connectivity and authentication
- **list_databases** - List all databases with status and size
- **get_server_info** - Server version, edition, and configuration

### Query Execution
- **execute_query** - Run read-only SELECT queries (INSERT/UPDATE/DELETE blocked)
- **get_expensive_queries** - Find resource-intensive queries from plan cache
- **get_running_queries** - View currently executing queries

### Schema Exploration
- **get_tables** - List tables with row counts, sizes, and metadata
- **get_columns** - Column definitions for a table (types, keys, defaults)
- **get_stored_procedures** - List and view stored procedure code
- **get_functions** - List and view user-defined function code
- **get_views** - List and view definitions
- **get_foreign_keys** - Table relationships and constraints
- **get_indexes** - Index definitions with included columns
- **get_triggers** - Table triggers with event types
- **get_connected_users** - Active sessions and connections

### Performance Analysis
- **get_blocking** - Identify blocking chains and deadlocks
- **get_wait_stats** - Analyze wait statistics for bottlenecks
- **get_cpu_usage** - CPU usage history from ring buffer
- **get_index_usage** - Find unused or missing indexes

### Health Monitoring
- **get_database_states** - Database health and status
- **get_disk_space** - Data and log file space usage
- **get_memory_usage** - Buffer pool and memory clerk stats
- **get_log_space** - Transaction log usage
- **get_backup_status** - Last backup times and status

### SQL Agent Jobs
- **list_jobs** - All SQL Agent jobs with status
- **get_running_jobs** - Currently executing jobs
- **get_failed_jobs** - Recent job failures
- **get_job_history** - Execution history for a job

### Availability Groups
- **get_ag_status** - Always On AG health and sync status
- **get_replica_states** - Detailed replica information
- **get_cluster_status** - WSFC cluster status

## Installation

```bash
npx @elad-nofy/mssql-mcp
```

## Configuration

### Environment Variables

```bash
# Required
MSSQL_HOST=your-server.domain.com

# Optional
MSSQL_PORT=1433                          # Default: 1433
MSSQL_DATABASE=master                    # Default: master

# Authentication - Windows Auth (default)
# Leave MSSQL_USER and MSSQL_PASSWORD empty for Windows Authentication

# Authentication - SQL Auth
MSSQL_USER=your_username
MSSQL_PASSWORD=your_password

# Connection Options
MSSQL_ENCRYPT=false                      # Default: false
MSSQL_TRUST_SERVER_CERTIFICATE=true      # Default: true
MSSQL_CONNECTION_TIMEOUT=30000           # Default: 30000ms
MSSQL_REQUEST_TIMEOUT=30000              # Default: 30000ms
```

### Claude Code CLI

**Windows:**
```json
{
  "mcpServers": {
    "mssql": {
      "command": "cmd",
      "args": ["/c", "npx", "@elad-nofy/mssql-mcp"],
      "env": {
        "MSSQL_HOST": "your-server.domain.com"
      }
    }
  }
}
```

**macOS/Linux:**
```json
{
  "mcpServers": {
    "mssql": {
      "command": "npx",
      "args": ["@elad-nofy/mssql-mcp"],
      "env": {
        "MSSQL_HOST": "your-server.domain.com"
      }
    }
  }
}
```

### Windows Authentication

For Windows Authentication, run the MCP server under an account with SQL Server access. The server will use the process credentials automatically.

### Required Permissions

The SQL Server login needs these permissions:
- `VIEW SERVER STATE` - For DMVs (wait stats, blocking, etc.)
- `VIEW DATABASE STATE` - For database-level DMVs
- `SELECT` on `msdb` - For SQL Agent job information

Example:
```sql
USE master;
CREATE LOGIN [DOMAIN\ServiceAccount] FROM WINDOWS;
GRANT VIEW SERVER STATE TO [DOMAIN\ServiceAccount];
GRANT VIEW ANY DATABASE TO [DOMAIN\ServiceAccount];

USE msdb;
CREATE USER [DOMAIN\ServiceAccount] FOR LOGIN [DOMAIN\ServiceAccount];
GRANT SELECT ON SCHEMA::dbo TO [DOMAIN\ServiceAccount];
```

## Example Usage

### Explore Database Schema

```
"What tables are in the Orders database?"
→ Uses get_tables to list all tables with row counts

"Show me the columns in the Customers table"
→ Uses get_columns to show column definitions

"What stored procedures exist for order processing?"
→ Uses get_stored_procedures with name filter

"How are the tables related?"
→ Uses get_foreign_keys to map relationships
```

### Investigate Performance Issues

```
"Check for blocking on PROD-SQL-01"
→ Uses get_blocking to show blocking chains

"What are the top CPU-consuming queries?"
→ Uses get_expensive_queries sorted by CPU

"Show me the wait stats"
→ Uses get_wait_stats to identify bottlenecks
```

### Health Check

```
"Are all databases healthy?"
→ Uses get_database_states to check status

"When was the last backup for each database?"
→ Uses get_backup_status to show backup times

"Check disk space on SQL Server"
→ Uses get_disk_space for file usage
```

### Troubleshoot Jobs

```
"What jobs failed in the last 24 hours?"
→ Uses get_failed_jobs to show failures

"Is the nightly backup job running?"
→ Uses get_running_jobs to check status
```

## Troubleshooting

### Connection Issues

**"Login failed for user"**
- Verify SQL Server allows the authentication type (Windows/SQL)
- Check the account has server-level permissions
- For Windows Auth, ensure the process runs as the correct user

**"Connection timeout"**
- Verify network connectivity to SQL Server
- Check firewall allows port 1433 (or custom port)
- Increase `MSSQL_CONNECTION_TIMEOUT` if needed

**"Cannot open database"**
- Verify the account has access to the database
- Check database is online: `SELECT state_desc FROM sys.databases`

### Permission Errors

**"The server principal is not able to access the database"**
- Create a user in the target database for the login
- Grant appropriate permissions

**"VIEW SERVER STATE permission denied"**
- Grant at server level: `GRANT VIEW SERVER STATE TO [login]`

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development (watch mode)
npm run dev
```

## Security Notes

- **Read-only by design** - Only SELECT queries are allowed
- **No secrets in code** - All credentials via environment variables
- **Parameterized queries** - Protection against SQL injection
- **Blocked dangerous operations** - INSERT, UPDATE, DELETE, EXEC prevented
- **Graceful shutdown** - Connection pool properly closed on exit

## License

MIT
