import sql from 'mssql';
import { Config } from './config.js';

export class MssqlClient {
  private pools: Map<string, sql.ConnectionPool> = new Map();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private async connect(server: string): Promise<sql.ConnectionPool> {
    const key = server || 'default';

    // Check for existing pool
    const existingPool = this.pools.get(key);
    if (existingPool?.connected) {
      return existingPool;
    }

    // Parse server for port/instance handling
    let serverHost = server;
    let port = this.config.port;
    let instanceName: string | undefined;

    if (server.includes('\\')) {
      // Named instance: server\instance
      [serverHost, instanceName] = server.split('\\');
    } else if (server.includes(',')) {
      // Port notation: server,port
      const [host, portStr] = server.split(',');
      serverHost = host;
      port = parseInt(portStr, 10);
    }

    const config: sql.config = {
      server: serverHost,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        trustServerCertificate: this.config.trustServerCertificate,
        instanceName,
      },
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
    };

    if (!instanceName) {
      config.port = port;
    }

    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    this.pools.set(key, pool);
    return pool;
  }

  private resolveServer(server?: string): string {
    if (!server) {
      // No server param - use default host as-is
      if (!this.config.host) {
        throw new Error('No server specified. Provide the "server" parameter.');
      }
      return this.config.host;
    }

    // If server contains backslash, it's a full path - use as-is
    if (server.includes('\\')) {
      return server;
    }

    // Otherwise, it's an instance name - combine with default host
    if (this.config.host) {
      return `${this.config.host}\\${server}`;
    }

    return server;
  }

  async query<T = Record<string, unknown>>(
    queryText: string,
    params?: Record<string, unknown>,
    server?: string
  ): Promise<T[]> {
    const targetServer = this.resolveServer(server);
    const pool = await this.connect(targetServer);
    const request = pool.request();

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }
    }

    const result = await request.query(queryText);
    return result.recordset as T[];
  }

  async testConnection(server?: string): Promise<{ success: boolean; server: string; version?: string; error?: string }> {
    let targetServer: string;
    try {
      targetServer = this.resolveServer(server);
    } catch {
      return {
        success: false,
        server: server || '(none)',
        error: 'No server specified. Provide the "server" parameter (e.g., "V85X_QA_DB").'
      };
    }

    // Check if credentials are configured
    if (!this.config.user || !this.config.password) {
      return {
        success: false,
        server: targetServer,
        error: `SQL Authentication required. Set MSSQL_USER and MSSQL_PASSWORD environment variables.`
      };
    }

    try {
      const result = await this.query<{ version: string }>('SELECT @@VERSION as version', undefined, server);
      return { success: true, server: targetServer, version: result[0]?.version };
    } catch (error) {
      return { success: false, server: targetServer, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async close(): Promise<void> {
    for (const [key, pool] of this.pools) {
      if (pool?.connected) {
        await pool.close();
      }
      this.pools.delete(key);
    }
  }
}
