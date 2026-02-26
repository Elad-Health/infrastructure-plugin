import { z } from 'zod';
import { MssqlClient } from '../mssqlClient.js';

const serverParam = z.string().optional().describe('SQL Server instance (e.g., "server\\instance" or "server,port"). Uses default if not specified.');

export const availabilityTools = {
  get_ag_status: {
    description: 'Get Always On Availability Group status and health',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      // First check if HADR is enabled
      const hadrCheck = await client.query<{ is_hadr_enabled: number }>(
        "SELECT CAST(SERVERPROPERTY('IsHadrEnabled') AS INT) as is_hadr_enabled",
        undefined,
        args.server
      );

      if (!hadrCheck[0]?.is_hadr_enabled) {
        return {
          hadrEnabled: false,
          message: 'Always On Availability Groups is not enabled on this server',
        };
      }

      const query = `
        SELECT
          ag.name as ag_name,
          ag.group_id,
          ags.primary_replica,
          ags.primary_recovery_health_desc as primary_health,
          ags.secondary_recovery_health_desc as secondary_health,
          ags.synchronization_health_desc as sync_health,
          ar.replica_server_name,
          ar.availability_mode_desc as availability_mode,
          ar.failover_mode_desc as failover_mode,
          ars.role_desc as current_role,
          ars.operational_state_desc as operational_state,
          ars.connected_state_desc as connected_state,
          ars.recovery_health_desc as recovery_health,
          ars.synchronization_health_desc as replica_sync_health,
          ars.last_connect_error_number,
          ars.last_connect_error_description
        FROM sys.availability_groups ag
        INNER JOIN sys.dm_hadr_availability_group_states ags ON ag.group_id = ags.group_id
        INNER JOIN sys.availability_replicas ar ON ag.group_id = ar.group_id
        INNER JOIN sys.dm_hadr_availability_replica_states ars ON ar.replica_id = ars.replica_id
        ORDER BY ag.name, ar.replica_server_name
      `;

      const replicas = await client.query(query, undefined, args.server);

      // Get database-level sync status
      const dbQuery = `
        SELECT
          ag.name as ag_name,
          adc.database_name,
          drs.is_local,
          drs.is_primary_replica,
          drs.synchronization_state_desc as sync_state,
          drs.synchronization_health_desc as sync_health,
          drs.database_state_desc as db_state,
          drs.is_suspended,
          drs.suspend_reason_desc,
          drs.log_send_queue_size,
          drs.log_send_rate,
          drs.redo_queue_size,
          drs.redo_rate,
          drs.last_commit_time,
          DATEDIFF(SECOND, drs.last_commit_time, GETDATE()) as seconds_behind
        FROM sys.availability_groups ag
        INNER JOIN sys.availability_databases_cluster adc ON ag.group_id = adc.group_id
        INNER JOIN sys.dm_hadr_database_replica_states drs ON adc.group_database_id = drs.group_database_id
        ORDER BY ag.name, adc.database_name, drs.is_primary_replica DESC
      `;

      const databases = await client.query(dbQuery, undefined, args.server);

      return {
        hadrEnabled: true,
        replicas,
        databases,
      };
    },
  },

  get_replica_states: {
    description: 'Get detailed state information for all availability group replicas',
    inputSchema: z.object({
      server: serverParam,
      agName: z.string().optional().describe('Filter by availability group name'),
    }),
    handler: async (client: MssqlClient, args: { server?: string; agName?: string }) => {
      const agFilter = args.agName ? `WHERE ag.name = '${args.agName}'` : '';

      const query = `
        SELECT
          ag.name as ag_name,
          ar.replica_server_name,
          ars.role_desc as role,
          ar.availability_mode_desc as availability_mode,
          ar.failover_mode_desc as failover_mode,
          ar.seeding_mode_desc as seeding_mode,
          ars.operational_state_desc as operational_state,
          ars.connected_state_desc as connected_state,
          ars.recovery_health_desc as recovery_health,
          ars.synchronization_health_desc as sync_health,
          ar.endpoint_url,
          ar.session_timeout,
          ar.primary_role_allow_connections_desc as primary_connections,
          ar.secondary_role_allow_connections_desc as secondary_connections,
          ar.backup_priority,
          ar.read_only_routing_url
        FROM sys.availability_groups ag
        INNER JOIN sys.availability_replicas ar ON ag.group_id = ar.group_id
        INNER JOIN sys.dm_hadr_availability_replica_states ars ON ar.replica_id = ars.replica_id
        ${agFilter}
        ORDER BY ag.name, ars.role_desc, ar.replica_server_name
      `;

      return await client.query(query, undefined, args.server);
    },
  },

  get_cluster_status: {
    description: 'Get Windows Server Failover Cluster status for the SQL Server instance',
    inputSchema: z.object({
      server: serverParam,
    }),
    handler: async (client: MssqlClient, args: { server?: string }) => {
      // Check if this is a clustered instance
      const clusterCheck = await client.query<{ is_clustered: number }>(
        "SELECT CAST(SERVERPROPERTY('IsClustered') AS INT) as is_clustered",
        undefined,
        args.server
      );

      if (!clusterCheck[0]?.is_clustered) {
        return {
          isClustered: false,
          message: 'This SQL Server instance is not clustered',
        };
      }

      const query = `
        SELECT
          cluster_name,
          quorum_type_desc as quorum_type,
          quorum_state_desc as quorum_state
        FROM sys.dm_hadr_cluster
      `;

      const cluster = await client.query(query, undefined, args.server);

      const membersQuery = `
        SELECT
          member_name,
          member_type_desc as member_type,
          member_state_desc as member_state,
          number_of_quorum_votes
        FROM sys.dm_hadr_cluster_members
      `;

      const members = await client.query(membersQuery, undefined, args.server);

      const networksQuery = `
        SELECT
          network_subnet_ip,
          network_subnet_ipv4_mask,
          network_subnet_prefix_length,
          is_public,
          is_ipv4
        FROM sys.dm_hadr_cluster_networks
      `;

      const networks = await client.query(networksQuery, undefined, args.server);

      return {
        isClustered: true,
        cluster: cluster[0],
        members,
        networks,
      };
    },
  },
};
