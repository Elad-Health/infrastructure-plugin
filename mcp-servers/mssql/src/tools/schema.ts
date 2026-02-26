import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const schemaTools = {
  get_tables: {
    description: 'List all tables in a database with row counts, sizes, and metadata',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      schema: z.string().optional().describe('Filter by schema name (e.g., dbo)'),
      includeRowCounts: z.boolean().optional().default(true).describe('Include row counts (may be slow on large databases)'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; schema?: string; includeRowCounts?: boolean }) => {
      const schemaFilter = args.schema ? `AND s.name = '${args.schema}'` : '';

      const query = `
        USE [${args.database}];

        SELECT
          s.name as schema_name,
          t.name as table_name,
          t.create_date,
          t.modify_date,
          ${args.includeRowCounts ? `
          p.rows as row_count,
          CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(10,2)) as total_size_mb,
          CAST(SUM(a.used_pages) * 8.0 / 1024 AS DECIMAL(10,2)) as used_size_mb,
          ` : ''}
          (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) as column_count,
          (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = t.object_id AND i.is_primary_key = 0 AND i.type > 0) as index_count,
          ISNULL((SELECT COUNT(*) FROM sys.foreign_keys fk WHERE fk.parent_object_id = t.object_id), 0) as fk_count,
          OBJECTPROPERTY(t.object_id, 'TableHasPrimaryKey') as has_primary_key,
          OBJECTPROPERTY(t.object_id, 'TableHasIdentity') as has_identity
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        ${args.includeRowCounts ? `
        LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
        ` : ''}
        WHERE t.is_ms_shipped = 0
        ${schemaFilter}
        GROUP BY s.name, t.name, t.object_id, t.create_date, t.modify_date
        ${args.includeRowCounts ? ', p.rows' : ''}
        ORDER BY s.name, t.name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_columns: {
    description: 'Get column definitions for a specific table',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      table: z.string().describe('Table name'),
      schema: z.string().optional().default('dbo').describe('Schema name'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; table: string; schema?: string }) => {
      const query = `
        USE [${args.database}];

        SELECT
          c.column_id as ordinal_position,
          c.name as column_name,
          t.name as data_type,
          c.max_length,
          c.precision,
          c.scale,
          c.is_nullable,
          c.is_identity,
          c.is_computed,
          ISNULL(dc.definition, '') as default_value,
          ISNULL(cc.definition, '') as computed_definition,
          CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
          CASE WHEN fk.parent_column_id IS NOT NULL THEN 1 ELSE 0 END as is_foreign_key,
          ISNULL(fk_ref.referenced_table, '') as fk_references,
          ISNULL(ep.value, '') as description
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
        INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
        LEFT JOIN (
          SELECT ic.object_id, ic.column_id
          FROM sys.index_columns ic
          INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          WHERE i.is_primary_key = 1
        ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
        LEFT JOIN sys.foreign_key_columns fk ON c.object_id = fk.parent_object_id AND c.column_id = fk.parent_column_id
        LEFT JOIN (
          SELECT
            fkc.parent_object_id,
            fkc.parent_column_id,
            OBJECT_SCHEMA_NAME(fkc.referenced_object_id) + '.' + OBJECT_NAME(fkc.referenced_object_id) + '.' + COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as referenced_table
          FROM sys.foreign_key_columns fkc
        ) fk_ref ON c.object_id = fk_ref.parent_object_id AND c.column_id = fk_ref.parent_column_id
        LEFT JOIN sys.extended_properties ep ON c.object_id = ep.major_id AND c.column_id = ep.minor_id AND ep.name = 'MS_Description'
        WHERE tbl.name = @table AND s.name = @schema
        ORDER BY c.column_id
      `;

      return await client.query(query, { table: args.table, schema: args.schema || 'dbo' }, args.server);
    },
  },

  get_stored_procedures: {
    description: 'List stored procedures with optional code view',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      schema: z.string().optional().describe('Filter by schema name'),
      name: z.string().optional().describe('Filter by procedure name (supports wildcards with %)'),
      includeCode: z.boolean().optional().default(false).describe('Include procedure source code'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; schema?: string; name?: string; includeCode?: boolean }) => {
      const schemaFilter = args.schema ? `AND s.name = '${args.schema}'` : '';
      const nameFilter = args.name ? `AND p.name LIKE '${args.name}'` : '';

      const query = `
        USE [${args.database}];

        SELECT
          s.name as schema_name,
          p.name as procedure_name,
          p.create_date,
          p.modify_date,
          ${args.includeCode ? 'OBJECT_DEFINITION(p.object_id) as definition,' : ''}
          (SELECT COUNT(*) FROM sys.parameters pm WHERE pm.object_id = p.object_id) as parameter_count
        FROM sys.procedures p
        INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
        WHERE p.is_ms_shipped = 0
        ${schemaFilter}
        ${nameFilter}
        ORDER BY s.name, p.name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_functions: {
    description: 'List user-defined functions with optional code view',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      schema: z.string().optional().describe('Filter by schema name'),
      type: z.enum(['all', 'scalar', 'table', 'inline']).optional().default('all').describe('Function type filter'),
      includeCode: z.boolean().optional().default(false).describe('Include function source code'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; schema?: string; type?: string; includeCode?: boolean }) => {
      const schemaFilter = args.schema ? `AND s.name = '${args.schema}'` : '';
      const typeMap: Record<string, string> = {
        'scalar': "AND o.type = 'FN'",
        'table': "AND o.type = 'TF'",
        'inline': "AND o.type = 'IF'",
        'all': '',
      };
      const typeFilter = typeMap[args.type || 'all'];

      const query = `
        USE [${args.database}];

        SELECT
          s.name as schema_name,
          o.name as function_name,
          CASE o.type
            WHEN 'FN' THEN 'Scalar'
            WHEN 'TF' THEN 'Table-valued'
            WHEN 'IF' THEN 'Inline table-valued'
            ELSE o.type
          END as function_type,
          o.create_date,
          o.modify_date,
          ${args.includeCode ? 'OBJECT_DEFINITION(o.object_id) as definition,' : ''}
          (SELECT COUNT(*) FROM sys.parameters pm WHERE pm.object_id = o.object_id AND pm.parameter_id > 0) as parameter_count
        FROM sys.objects o
        INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE o.type IN ('FN', 'TF', 'IF')
        AND o.is_ms_shipped = 0
        ${schemaFilter}
        ${typeFilter}
        ORDER BY s.name, o.name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_views: {
    description: 'List views with optional definition',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      schema: z.string().optional().describe('Filter by schema name'),
      includeDefinition: z.boolean().optional().default(false).describe('Include view definition SQL'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; schema?: string; includeDefinition?: boolean }) => {
      const schemaFilter = args.schema ? `AND s.name = '${args.schema}'` : '';

      const query = `
        USE [${args.database}];

        SELECT
          s.name as schema_name,
          v.name as view_name,
          v.create_date,
          v.modify_date,
          ${args.includeDefinition ? 'OBJECT_DEFINITION(v.object_id) as definition,' : ''}
          (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = v.object_id) as column_count,
          OBJECTPROPERTY(v.object_id, 'IsIndexed') as is_indexed,
          OBJECTPROPERTY(v.object_id, 'IsSchemaBound') as is_schema_bound
        FROM sys.views v
        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
        WHERE v.is_ms_shipped = 0
        ${schemaFilter}
        ORDER BY s.name, v.name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_foreign_keys: {
    description: 'Get foreign key relationships between tables',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      table: z.string().optional().describe('Filter by table name (shows FKs from and to this table)'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; table?: string }) => {
      const tableFilter = args.table
        ? `AND (OBJECT_NAME(fk.parent_object_id) = '${args.table}' OR OBJECT_NAME(fk.referenced_object_id) = '${args.table}')`
        : '';

      const query = `
        USE [${args.database}];

        SELECT
          fk.name as constraint_name,
          OBJECT_SCHEMA_NAME(fk.parent_object_id) as from_schema,
          OBJECT_NAME(fk.parent_object_id) as from_table,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as from_column,
          OBJECT_SCHEMA_NAME(fk.referenced_object_id) as to_schema,
          OBJECT_NAME(fk.referenced_object_id) as to_table,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as to_column,
          fk.delete_referential_action_desc as on_delete,
          fk.update_referential_action_desc as on_update,
          fk.is_disabled,
          fk.is_not_trusted
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE 1=1
        ${tableFilter}
        ORDER BY from_schema, from_table, constraint_name, fkc.constraint_column_id
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_indexes: {
    description: 'Get index information for tables',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      table: z.string().optional().describe('Filter by table name'),
      schema: z.string().optional().default('dbo').describe('Schema name'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; table?: string; schema?: string }) => {
      const tableFilter = args.table ? `AND t.name = '${args.table}'` : '';
      const schemaFilter = args.schema ? `AND s.name = '${args.schema}'` : '';

      const query = `
        USE [${args.database}];

        SELECT
          s.name as schema_name,
          t.name as table_name,
          i.name as index_name,
          i.type_desc as index_type,
          i.is_unique,
          i.is_primary_key,
          i.is_unique_constraint,
          STUFF((
            SELECT ', ' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END
            FROM sys.index_columns ic
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
            ORDER BY ic.key_ordinal
            FOR XML PATH('')
          ), 1, 2, '') as key_columns,
          STUFF((
            SELECT ', ' + c.name
            FROM sys.index_columns ic
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
            ORDER BY ic.index_column_id
            FOR XML PATH('')
          ), 1, 2, '') as included_columns,
          i.filter_definition,
          ps.row_count,
          CAST(ps.used_page_count * 8.0 / 1024 AS DECIMAL(10,2)) as size_mb
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        LEFT JOIN sys.dm_db_partition_stats ps ON i.object_id = ps.object_id AND i.index_id = ps.index_id
        WHERE i.type > 0
        ${tableFilter}
        ${schemaFilter}
        ORDER BY s.name, t.name, i.index_id
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_connected_users: {
    description: 'Get currently connected users and sessions',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().optional().describe('Filter by database name'),
      activeOnly: z.boolean().optional().default(false).describe('Only show sessions with active requests'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database?: string; activeOnly?: boolean }) => {
      const dbFilter = args.database ? `AND DB_NAME(s.database_id) = '${args.database}'` : '';
      const activeFilter = args.activeOnly ? 'AND r.session_id IS NOT NULL' : '';

      const query = `
        SELECT
          s.session_id,
          s.login_name,
          s.host_name,
          s.program_name,
          DB_NAME(s.database_id) as database_name,
          s.login_time,
          s.last_request_start_time,
          s.last_request_end_time,
          s.status as session_status,
          s.cpu_time as total_cpu_time,
          s.memory_usage * 8 as memory_kb,
          s.reads as total_reads,
          s.writes as total_writes,
          c.client_net_address,
          c.auth_scheme,
          r.status as request_status,
          r.command,
          r.wait_type,
          r.blocking_session_id
        FROM sys.dm_exec_sessions s
        LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
        LEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id
        WHERE s.is_user_process = 1
        ${dbFilter}
        ${activeFilter}
        ORDER BY s.login_time DESC
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_triggers: {
    description: 'List triggers in a database',
    inputSchema: z.object({
      server: serverParam,
      database: z.string().describe('Database name'),
      table: z.string().optional().describe('Filter by table name'),
      includeDefinition: z.boolean().optional().default(false).describe('Include trigger definition SQL'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; database: string; table?: string; includeDefinition?: boolean }) => {
      const tableFilter = args.table ? `AND OBJECT_NAME(tr.parent_id) = '${args.table}'` : '';

      const query = `
        USE [${args.database}];

        SELECT
          OBJECT_SCHEMA_NAME(tr.parent_id) as schema_name,
          OBJECT_NAME(tr.parent_id) as table_name,
          tr.name as trigger_name,
          tr.is_disabled,
          tr.is_instead_of_trigger,
          CASE WHEN OBJECTPROPERTY(tr.object_id, 'ExecIsInsertTrigger') = 1 THEN 'INSERT ' ELSE '' END +
          CASE WHEN OBJECTPROPERTY(tr.object_id, 'ExecIsUpdateTrigger') = 1 THEN 'UPDATE ' ELSE '' END +
          CASE WHEN OBJECTPROPERTY(tr.object_id, 'ExecIsDeleteTrigger') = 1 THEN 'DELETE' ELSE '' END as trigger_events,
          tr.create_date,
          tr.modify_date
          ${args.includeDefinition ? ', OBJECT_DEFINITION(tr.object_id) as definition' : ''}
        FROM sys.triggers tr
        WHERE tr.parent_class = 1  -- Object triggers only
        ${tableFilter}
        ORDER BY schema_name, table_name, trigger_name
      `;

      return await client.query(query, undefined, args.server);
    },
  },
};
