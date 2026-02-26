import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const performanceTools = {
  get_blocking: {
    description: 'Get current blocking chains showing blocked and blocking sessions',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      const query = `
        WITH BlockingTree AS (
          SELECT
            r.session_id as blocked_session_id,
            r.blocking_session_id,
            s.login_name as blocked_login,
            s.host_name as blocked_host,
            s.program_name as blocked_program,
            DB_NAME(r.database_id) as database_name,
            r.wait_type,
            r.wait_time / 1000.0 as wait_time_seconds,
            r.wait_resource,
            SUBSTRING(st.text, (r.statement_start_offset/2)+1,
              ((CASE r.statement_end_offset
                WHEN -1 THEN DATALENGTH(st.text)
                ELSE r.statement_end_offset
              END - r.statement_start_offset)/2)+1) as blocked_query
          FROM sys.dm_exec_requests r
          INNER JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
          CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
          WHERE r.blocking_session_id > 0
        )
        SELECT
          bt.*,
          bs.login_name as blocking_login,
          bs.host_name as blocking_host,
          bs.program_name as blocking_program,
          COALESCE(
            (SELECT TOP 1 text FROM sys.dm_exec_sql_text(bc.most_recent_sql_handle)),
            'No query available'
          ) as blocking_query
        FROM BlockingTree bt
        LEFT JOIN sys.dm_exec_sessions bs ON bt.blocking_session_id = bs.session_id
        LEFT JOIN sys.dm_exec_connections bc ON bt.blocking_session_id = bc.session_id
        ORDER BY bt.wait_time_seconds DESC
      `;

      const result = await client.query(query, undefined, args.server);
      return {
        blockingCount: result.length,
        chains: result,
      };
    },
  },

  get_wait_stats: {
    description: 'Get aggregated wait statistics to identify performance bottlenecks',
    inputSchema: z.object({
      server: serverParam,
      top: z.number().optional().default(20).describe('Number of top waits to return'),
      excludeIdle: z.boolean().optional().default(true).describe('Exclude idle and benign waits'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; top?: number; excludeIdle?: boolean }) => {
      const excludeFilter = args.excludeIdle
        ? `WHERE wait_type NOT IN (
            'CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE', 'SLEEP_TASK',
            'SLEEP_SYSTEMTASK', 'SQLTRACE_BUFFER_FLUSH', 'WAITFOR', 'LOGMGR_QUEUE',
            'CHECKPOINT_QUEUE', 'REQUEST_FOR_DEADLOCK_SEARCH', 'XE_TIMER_EVENT',
            'BROKER_TO_FLUSH', 'BROKER_TASK_STOP', 'CLR_MANUAL_EVENT',
            'CLR_AUTO_EVENT', 'DISPATCHER_QUEUE_SEMAPHORE', 'FT_IFTS_SCHEDULER_IDLE_WAIT',
            'XE_DISPATCHER_WAIT', 'XE_DISPATCHER_JOIN', 'BROKER_EVENTHANDLER',
            'TRACEWRITE', 'FT_IFTSHC_MUTEX', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
            'BROKER_RECEIVE_WAITFOR', 'ONDEMAND_TASK_QUEUE', 'DBMIRROR_EVENTS_QUEUE',
            'DBMIRRORING_CMD', 'BROKER_TRANSMITTER', 'SQLTRACE_WAIT_ENTRIES',
            'SLEEP_BPOOL_FLUSH', 'SQLTRACE_LOCK', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION',
            'DIRTY_PAGE_POLL', 'SP_SERVER_DIAGNOSTICS_SLEEP'
          )
          AND wait_type NOT LIKE 'PREEMPTIVE_%'
          AND wait_type NOT LIKE 'BROKER_%'
          AND wait_type NOT LIKE 'SLEEP_%'`
        : '';

      const query = `
        SELECT TOP ${args.top || 20}
          wait_type,
          waiting_tasks_count,
          wait_time_ms,
          max_wait_time_ms,
          signal_wait_time_ms,
          wait_time_ms - signal_wait_time_ms as resource_wait_time_ms,
          CAST(100.0 * wait_time_ms / SUM(wait_time_ms) OVER() AS DECIMAL(5,2)) as pct_of_total
        FROM sys.dm_os_wait_stats
        ${excludeFilter}
        ORDER BY wait_time_ms DESC
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_cpu_usage: {
    description: 'Get CPU usage history for SQL Server from ring buffer',
    inputSchema: z.object({
      server: serverParam,
      minutes: z.number().optional().default(30).describe('Minutes of history to retrieve'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; minutes?: number }) => {
      const query = `
        DECLARE @ts_now BIGINT = (SELECT cpu_ticks/(cpu_ticks/ms_ticks) FROM sys.dm_os_sys_info);

        SELECT TOP ${args.minutes || 30}
          DATEADD(ms, -1 * (@ts_now - [timestamp]), GETDATE()) as event_time,
          SQLProcessUtilization as sql_cpu_percent,
          SystemIdle as system_idle_percent,
          100 - SystemIdle - SQLProcessUtilization as other_cpu_percent
        FROM (
          SELECT
            record.value('(./Record/@id)[1]', 'int') as record_id,
            record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') as SystemIdle,
            record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') as SQLProcessUtilization,
            [timestamp]
          FROM (
            SELECT [timestamp], CONVERT(xml, record) as record
            FROM sys.dm_os_ring_buffers
            WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
            AND record LIKE '%<SystemHealth>%'
          ) AS x
        ) AS y
        ORDER BY record_id DESC
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_index_usage: {
    description: 'Get index usage statistics to identify unused or missing indexes',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name to analyze'),
      showUnused: z.boolean().optional().default(true).describe('Include unused indexes'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; showUnused?: boolean }) => {
      const unusedFilter = args.showUnused
        ? ''
        : 'AND (user_seeks + user_scans + user_lookups) > 0';

      const query = `
        USE [${args.database}];

        SELECT
          OBJECT_SCHEMA_NAME(i.object_id) as schema_name,
          OBJECT_NAME(i.object_id) as table_name,
          i.name as index_name,
          i.type_desc as index_type,
          ISNULL(s.user_seeks, 0) as user_seeks,
          ISNULL(s.user_scans, 0) as user_scans,
          ISNULL(s.user_lookups, 0) as user_lookups,
          ISNULL(s.user_updates, 0) as user_updates,
          ISNULL(s.last_user_seek, '1900-01-01') as last_user_seek,
          ISNULL(s.last_user_scan, '1900-01-01') as last_user_scan,
          CAST(ps.used_page_count * 8.0 / 1024 AS DECIMAL(10,2)) as size_mb
        FROM sys.indexes i
        LEFT JOIN sys.dm_db_index_usage_stats s
          ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
        LEFT JOIN sys.dm_db_partition_stats ps
          ON i.object_id = ps.object_id AND i.index_id = ps.index_id
        WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
        AND i.index_id > 0
        ${unusedFilter}
        ORDER BY (ISNULL(s.user_seeks, 0) + ISNULL(s.user_scans, 0) + ISNULL(s.user_lookups, 0)) ASC
      `;

      return await client.query(query, undefined, args.server);
    },
  },
};
