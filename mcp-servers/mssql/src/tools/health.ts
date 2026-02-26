import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const healthTools = {
  get_database_states: {
    description: 'Get the health status of all databases including any that are offline, recovering, or suspect',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      const query = `
        SELECT
          name,
          database_id,
          state_desc as state,
          user_access_desc as user_access,
          is_read_only,
          is_auto_close_on,
          is_auto_shrink_on,
          recovery_model_desc as recovery_model,
          log_reuse_wait_desc as log_reuse_wait,
          CASE
            WHEN state_desc != 'ONLINE' THEN 'CRITICAL'
            WHEN is_auto_shrink_on = 1 THEN 'WARNING'
            WHEN log_reuse_wait_desc NOT IN ('NOTHING', 'LOG_BACKUP') THEN 'WARNING'
            ELSE 'OK'
          END as health_status
        FROM sys.databases
        ORDER BY
          CASE WHEN state_desc != 'ONLINE' THEN 0 ELSE 1 END,
          name
      `;

      const result = await client.query<{ health_status: string }>(query, undefined, args.server);
      const critical = result.filter((r) => r.health_status === 'CRITICAL');
      const warning = result.filter((r) => r.health_status === 'WARNING');

      return {
        summary: {
          total: result.length,
          critical: critical.length,
          warning: warning.length,
          healthy: result.length - critical.length - warning.length,
        },
        databases: result,
      };
    },
  },

  get_disk_space: {
    description: 'Get disk space usage for all database files including data and log files',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().optional().describe('Specific database to check (optional, checks all if not specified)'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database?: string }) => {
      const dbFilter = args.database ? `AND DB_NAME(database_id) = '${args.database}'` : '';

      const query = `
        SELECT
          DB_NAME(database_id) as database_name,
          name as file_name,
          physical_name as file_path,
          type_desc as file_type,
          CAST(size * 8.0 / 1024 AS DECIMAL(10,2)) as size_mb,
          CAST(FILEPROPERTY(name, 'SpaceUsed') * 8.0 / 1024 AS DECIMAL(10,2)) as used_mb,
          CAST((size - FILEPROPERTY(name, 'SpaceUsed')) * 8.0 / 1024 AS DECIMAL(10,2)) as free_mb,
          CAST(100.0 * FILEPROPERTY(name, 'SpaceUsed') / size AS DECIMAL(5,2)) as used_percent,
          CASE max_size
            WHEN -1 THEN 'Unlimited'
            WHEN 0 THEN 'No growth'
            ELSE CAST(CAST(max_size * 8.0 / 1024 AS DECIMAL(10,2)) AS VARCHAR) + ' MB'
          END as max_size,
          CASE is_percent_growth
            WHEN 1 THEN CAST(growth AS VARCHAR) + '%'
            ELSE CAST(growth * 8 / 1024 AS VARCHAR) + ' MB'
          END as growth_increment
        FROM sys.master_files
        WHERE database_id > 0
        ${dbFilter}
        ORDER BY database_name, type_desc
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_memory_usage: {
    description: 'Get SQL Server memory usage including buffer pool, plan cache, and other memory clerks',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      const query = `
        SELECT
          type as memory_clerk_type,
          name as memory_clerk_name,
          CAST(pages_kb / 1024.0 AS DECIMAL(10,2)) as size_mb,
          CAST(100.0 * pages_kb / SUM(pages_kb) OVER() AS DECIMAL(5,2)) as pct_of_total
        FROM sys.dm_os_memory_clerks
        WHERE pages_kb > 0
        ORDER BY pages_kb DESC
      `;

      const clerks = await client.query(query, undefined, args.server);

      // Get overall memory status
      const memoryQuery = `
        SELECT
          physical_memory_kb / 1024 as physical_memory_mb,
          committed_kb / 1024 as committed_mb,
          committed_target_kb / 1024 as committed_target_mb,
          visible_target_kb / 1024 as visible_target_mb
        FROM sys.dm_os_sys_info
      `;

      const memoryInfo = await client.query(memoryQuery, undefined, args.server);

      // Get buffer pool usage
      const bufferQuery = `
        SELECT
          DB_NAME(database_id) as database_name,
          COUNT(*) * 8 / 1024 as buffer_pool_mb
        FROM sys.dm_os_buffer_descriptors
        GROUP BY database_id
        ORDER BY COUNT(*) DESC
      `;

      const bufferUsage = await client.query(bufferQuery, undefined, args.server);

      return {
        serverMemory: memoryInfo[0],
        topMemoryClerks: clerks.slice(0, 15),
        bufferPoolByDatabase: bufferUsage,
      };
    },
  },

  get_log_space: {
    description: 'Get transaction log space usage for all databases',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      const query = `
        DBCC SQLPERF(LOGSPACE) WITH NO_INFOMSGS
      `;

      interface LogSpaceRow {
        'Database Name': string;
        'Log Size (MB)': number;
        'Log Space Used (%)': number;
        Status: number;
      }

      const result = await client.query<LogSpaceRow>(query, undefined, args.server);

      // Add health assessment
      const assessed = result.map((r) => ({
        ...r,
        health: r['Log Space Used (%)'] > 90 ? 'CRITICAL' :
                r['Log Space Used (%)'] > 75 ? 'WARNING' : 'OK',
      }));

      const critical = assessed.filter((r) => r.health === 'CRITICAL');
      const warning = assessed.filter((r) => r.health === 'WARNING');

      return {
        summary: {
          total: assessed.length,
          critical: critical.length,
          warning: warning.length,
        },
        databases: assessed,
      };
    },
  },

  get_backup_status: {
    description: 'Get last backup information for all databases',
    inputSchema: z.object({
      server: serverParam,
      maxAgeDays: z.number().optional().default(7).describe('Flag databases with no backup in this many days as warning'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; maxAgeDays?: number }) => {
      const query = `
        SELECT
          d.name as database_name,
          d.recovery_model_desc as recovery_model,
          MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) as last_full_backup,
          MAX(CASE WHEN b.type = 'I' THEN b.backup_finish_date END) as last_diff_backup,
          MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END) as last_log_backup,
          DATEDIFF(DAY, MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END), GETDATE()) as days_since_full,
          DATEDIFF(HOUR, MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END), GETDATE()) as hours_since_log
        FROM sys.databases d
        LEFT JOIN msdb.dbo.backupset b ON d.name = b.database_name
        WHERE d.database_id > 4  -- Exclude system databases
        AND d.state_desc = 'ONLINE'
        GROUP BY d.name, d.recovery_model_desc
        ORDER BY
          CASE WHEN MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) IS NULL THEN 0 ELSE 1 END,
          MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END)
      `;

      interface BackupRow {
        database_name: string;
        recovery_model: string;
        last_full_backup: Date | null;
        last_diff_backup: Date | null;
        last_log_backup: Date | null;
        days_since_full: number | null;
        hours_since_log: number | null;
      }

      const result = await client.query<BackupRow>(query, undefined, args.server);

      // Add health assessment
      const maxAge = args.maxAgeDays || 7;
      const assessed = result.map((r) => ({
        ...r,
        health: r.days_since_full === null ? 'CRITICAL' :
                r.days_since_full > maxAge ? 'WARNING' :
                (r.recovery_model === 'FULL' && (r.hours_since_log === null || r.hours_since_log > 24)) ? 'WARNING' : 'OK',
      }));

      return {
        summary: {
          total: assessed.length,
          neverBackedUp: assessed.filter((r) => r.days_since_full === null).length,
          stale: assessed.filter((r) => r.days_since_full !== null && r.days_since_full > maxAge).length,
        },
        databases: assessed,
      };
    },
  },
};
