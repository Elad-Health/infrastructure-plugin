import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const jobTools = {
  list_jobs: {
    description: 'List all SQL Server Agent jobs with their status and schedule',
    inputSchema: z.object({
      server: serverParam,
      enabledOnly: z.boolean().optional().default(false).describe('Only show enabled jobs'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; enabledOnly?: boolean }) => {
      const enabledFilter = args.enabledOnly ? 'AND j.enabled = 1' : '';

      const query = `
        SELECT
          j.job_id,
          j.name as job_name,
          j.description,
          CASE j.enabled WHEN 1 THEN 'Enabled' ELSE 'Disabled' END as status,
          c.name as category,
          SUSER_SNAME(j.owner_sid) as owner,
          j.date_created,
          j.date_modified,
          CASE
            WHEN ja.run_requested_date IS NOT NULL AND ja.stop_execution_date IS NULL THEN 'Running'
            ELSE 'Idle'
          END as current_status,
          h.last_run_date,
          h.last_run_time,
          h.last_run_outcome,
          h.last_run_duration_seconds
        FROM msdb.dbo.sysjobs j
        LEFT JOIN msdb.dbo.syscategories c ON j.category_id = c.category_id
        LEFT JOIN msdb.dbo.sysjobactivity ja ON j.job_id = ja.job_id
          AND ja.session_id = (SELECT MAX(session_id) FROM msdb.dbo.sysjobactivity)
        LEFT JOIN (
          SELECT
            job_id,
            MAX(CAST(
              CAST(run_date AS VARCHAR) + ' ' +
              STUFF(STUFF(RIGHT('000000' + CAST(run_time AS VARCHAR), 6), 5, 0, ':'), 3, 0, ':')
            AS DATETIME)) as last_run_date,
            MAX(run_time) as last_run_time,
            (SELECT TOP 1 CASE run_status
              WHEN 0 THEN 'Failed'
              WHEN 1 THEN 'Succeeded'
              WHEN 2 THEN 'Retry'
              WHEN 3 THEN 'Canceled'
              WHEN 4 THEN 'In Progress'
            END FROM msdb.dbo.sysjobhistory h2
            WHERE h2.job_id = h.job_id AND h2.step_id = 0
            ORDER BY run_date DESC, run_time DESC) as last_run_outcome,
            (SELECT TOP 1
              ((run_duration / 10000) * 3600) +
              (((run_duration % 10000) / 100) * 60) +
              (run_duration % 100)
            FROM msdb.dbo.sysjobhistory h2
            WHERE h2.job_id = h.job_id AND h2.step_id = 0
            ORDER BY run_date DESC, run_time DESC) as last_run_duration_seconds
          FROM msdb.dbo.sysjobhistory h
          WHERE step_id = 0
          GROUP BY job_id
        ) h ON j.job_id = h.job_id
        WHERE 1=1
        ${enabledFilter}
        ORDER BY j.name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_running_jobs: {
    description: 'Get currently executing SQL Server Agent jobs',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      const query = `
        SELECT
          j.name as job_name,
          j.job_id,
          ja.start_execution_date,
          DATEDIFF(SECOND, ja.start_execution_date, GETDATE()) as running_seconds,
          ISNULL(ja.last_executed_step_id, 0) as current_step,
          js.step_name as current_step_name,
          js.subsystem,
          js.command as step_command
        FROM msdb.dbo.sysjobactivity ja
        INNER JOIN msdb.dbo.sysjobs j ON ja.job_id = j.job_id
        LEFT JOIN msdb.dbo.sysjobsteps js ON j.job_id = js.job_id
          AND ja.last_executed_step_id + 1 = js.step_id
        WHERE ja.session_id = (SELECT MAX(session_id) FROM msdb.dbo.syssessions)
        AND ja.start_execution_date IS NOT NULL
        AND ja.stop_execution_date IS NULL
        ORDER BY ja.start_execution_date
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_failed_jobs: {
    description: 'Get jobs that failed in their last execution or recent history',
    inputSchema: z.object({
      server: serverParam,
      hours: z.number().optional().default(24).describe('Look back this many hours for failures'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; hours?: number }) => {
      const query = `
        SELECT
          j.name as job_name,
          j.job_id,
          h.step_id,
          h.step_name,
          CAST(
            CAST(h.run_date AS VARCHAR) + ' ' +
            STUFF(STUFF(RIGHT('000000' + CAST(h.run_time AS VARCHAR), 6), 5, 0, ':'), 3, 0, ':')
          AS DATETIME) as run_datetime,
          ((h.run_duration / 10000) * 3600) +
          (((h.run_duration % 10000) / 100) * 60) +
          (h.run_duration % 100) as duration_seconds,
          h.message as error_message
        FROM msdb.dbo.sysjobhistory h
        INNER JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
        WHERE h.run_status = 0  -- Failed
        AND CAST(
          CAST(h.run_date AS VARCHAR) + ' ' +
          STUFF(STUFF(RIGHT('000000' + CAST(h.run_time AS VARCHAR), 6), 5, 0, ':'), 3, 0, ':')
        AS DATETIME) > DATEADD(HOUR, -${args.hours || 24}, GETDATE())
        ORDER BY h.run_date DESC, h.run_time DESC
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_job_history: {
    description: 'Get execution history for a specific job',
    inputSchema: z.object({
      server: serverParam,
      jobName: z.string().describe('Name of the job'),
      top: z.number().optional().default(50).describe('Number of history records to return'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; jobName: string; top?: number }) => {
      const query = `
        SELECT TOP ${args.top || 50}
          j.name as job_name,
          h.step_id,
          h.step_name,
          CASE h.run_status
            WHEN 0 THEN 'Failed'
            WHEN 1 THEN 'Succeeded'
            WHEN 2 THEN 'Retry'
            WHEN 3 THEN 'Canceled'
            WHEN 4 THEN 'In Progress'
          END as status,
          CAST(
            CAST(h.run_date AS VARCHAR) + ' ' +
            STUFF(STUFF(RIGHT('000000' + CAST(h.run_time AS VARCHAR), 6), 5, 0, ':'), 3, 0, ':')
          AS DATETIME) as run_datetime,
          ((h.run_duration / 10000) * 3600) +
          (((h.run_duration % 10000) / 100) * 60) +
          (h.run_duration % 100) as duration_seconds,
          h.message
        FROM msdb.dbo.sysjobhistory h
        INNER JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
        WHERE j.name = @jobName
        ORDER BY h.run_date DESC, h.run_time DESC, h.step_id
      `;

      return await client.query(query, { jobName: args.jobName }, args.server);
    },
  },
};
