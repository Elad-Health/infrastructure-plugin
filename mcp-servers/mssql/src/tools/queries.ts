import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const queryTools = {
  execute_query: {
    description: 'Execute a read-only SQL query. Only SELECT statements are allowed for safety.',
    inputSchema: z.object({
      server: serverParam,
      query: z.string().describe('The SQL SELECT query to execute'),
      database: z.string().optional().describe('Database to run the query against (optional, uses default if not specified)'),
      maxRows: z.number().optional().default(1000).describe('Maximum rows to return (default: 1000)'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; query: string; database?: string; maxRows?: number }) => {
      // Safety check: only allow SELECT statements
      const trimmedQuery = args.query.trim().toUpperCase();
      if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
        throw new Error('Only SELECT queries are allowed. For safety, INSERT/UPDATE/DELETE/EXEC are not permitted.');
      }

      // Check for dangerous keywords
      const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE', 'XP_', 'SP_'];
      for (const keyword of dangerous) {
        if (trimmedQuery.includes(keyword) && !trimmedQuery.startsWith('WITH')) {
          throw new Error(`Query contains forbidden keyword: ${keyword}`);
        }
      }

      let finalQuery = args.query;

      // Add TOP clause if not present and maxRows specified
      if (args.maxRows && !trimmedQuery.includes('TOP')) {
        finalQuery = args.query.replace(/^SELECT/i, `SELECT TOP ${args.maxRows}`);
      }

      // Switch database if specified
      if (args.database) {
        finalQuery = `USE [${args.database}]; ${finalQuery}`;
      }

      const result = await client.query(finalQuery, undefined, args.server);
      return {
        rowCount: result.length,
        rows: result,
      };
    },
  },

  get_expensive_queries: {
    description: 'Get the most resource-intensive queries from the query store or plan cache',
    inputSchema: z.object({
      server: serverParam,
      metric: z.enum(['cpu', 'reads', 'writes', 'duration', 'executions']).optional().default('cpu')
        .describe('Metric to sort by'),
      top: z.number().optional().default(20).describe('Number of queries to return'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; metric?: string; top?: number }) => {
      const orderByMap: Record<string, string> = {
        cpu: 'total_worker_time',
        reads: 'total_logical_reads',
        writes: 'total_logical_writes',
        duration: 'total_elapsed_time',
        executions: 'execution_count',
      };

      const orderBy = orderByMap[args.metric || 'cpu'];

      const query = `
        SELECT TOP ${args.top || 20}
          qs.execution_count,
          qs.total_worker_time / 1000 as total_cpu_ms,
          qs.total_worker_time / qs.execution_count / 1000 as avg_cpu_ms,
          qs.total_elapsed_time / 1000 as total_duration_ms,
          qs.total_elapsed_time / qs.execution_count / 1000 as avg_duration_ms,
          qs.total_logical_reads,
          qs.total_logical_reads / qs.execution_count as avg_logical_reads,
          qs.total_logical_writes,
          qs.last_execution_time,
          SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
            ((CASE qs.statement_end_offset
              WHEN -1 THEN DATALENGTH(st.text)
              ELSE qs.statement_end_offset
            END - qs.statement_start_offset)/2)+1) as query_text,
          DB_NAME(st.dbid) as database_name
        FROM sys.dm_exec_query_stats qs
        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
        WHERE qs.execution_count > 0
        ORDER BY ${orderBy} DESC
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_running_queries: {
    description: 'Get currently executing queries with their status and resource usage',
    inputSchema: z.object({
      server: serverParam,
      includeSystem: z.boolean().optional().default(false).describe('Include system processes'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; includeSystem?: boolean }) => {
      const systemFilter = args.includeSystem ? '' : 'AND s.is_user_process = 1';

      const query = `
        SELECT
          r.session_id,
          r.request_id,
          r.start_time,
          DATEDIFF(SECOND, r.start_time, GETDATE()) as duration_seconds,
          r.status,
          r.command,
          r.database_id,
          DB_NAME(r.database_id) as database_name,
          r.wait_type,
          r.wait_time,
          r.blocking_session_id,
          r.cpu_time,
          r.total_elapsed_time,
          r.reads,
          r.writes,
          r.logical_reads,
          s.login_name,
          s.host_name,
          s.program_name,
          SUBSTRING(st.text, (r.statement_start_offset/2)+1,
            ((CASE r.statement_end_offset
              WHEN -1 THEN DATALENGTH(st.text)
              ELSE r.statement_end_offset
            END - r.statement_start_offset)/2)+1) as current_statement,
          st.text as full_query
        FROM sys.dm_exec_requests r
        INNER JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
        CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
        WHERE r.session_id != @@SPID
        ${systemFilter}
        ORDER BY r.total_elapsed_time DESC
      `;

      return await client.query(query, undefined, args.server);
    },
  },
};
