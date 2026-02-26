import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

// Shared server parameter for all tools
const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const connectionTools = {
  test_connection: {
    description: 'Test the connection to SQL Server and verify authentication',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      return await client.testConnection(args.server);
    },
  },

  list_databases: {
    description: 'List all databases on the SQL Server instance with their status and size',
    inputSchema: z.object({
      server: serverParam,
      includeSystem: z.boolean().optional().default(false).describe('Include system databases (master, model, msdb, tempdb)'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; includeSystem?: boolean }) => {
      const systemFilter = args.includeSystem
        ? ''
        : "WHERE d.name NOT IN ('master', 'model', 'msdb', 'tempdb')";

      const query = `
        SELECT
          d.name,
          d.database_id,
          d.state_desc as state,
          d.recovery_model_desc as recovery_model,
          d.compatibility_level,
          d.collation_name,
          d.create_date,
          CAST(SUM(mf.size) * 8.0 / 1024 AS DECIMAL(10,2)) as size_mb
        FROM sys.databases d
        LEFT JOIN sys.master_files mf ON d.database_id = mf.database_id
        ${systemFilter}
        GROUP BY d.name, d.database_id, d.state_desc, d.recovery_model_desc,
                 d.compatibility_level, d.collation_name, d.create_date
        ORDER BY d.name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_server_info: {
    description: 'Get SQL Server instance information including version, edition, and configuration',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      const query = `
        SELECT
          SERVERPROPERTY('ServerName') as server_name,
          SERVERPROPERTY('InstanceName') as instance_name,
          SERVERPROPERTY('ProductVersion') as version,
          SERVERPROPERTY('ProductLevel') as product_level,
          SERVERPROPERTY('Edition') as edition,
          SERVERPROPERTY('EngineEdition') as engine_edition,
          SERVERPROPERTY('Collation') as collation,
          SERVERPROPERTY('IsHadrEnabled') as is_hadr_enabled,
          SERVERPROPERTY('IsClustered') as is_clustered,
          @@MAX_CONNECTIONS as max_connections,
          (SELECT COUNT(*) FROM sys.dm_exec_connections) as current_connections
      `;

      const result = await client.query(query, undefined, args.server);
      return result[0];
    },
  },
};
