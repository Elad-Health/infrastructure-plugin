import sql from 'mssql';
import { Config } from './config.js';

export class MssqlClient {
  private pools: Map<string, sql.ConnectionPool> = new Map();
  private config: Config;
  // For Windows Integrated auth we need the msnodesqlv8 driver instead of the
  // default tedious driver (tedious cannot do trusted connections). Loaded
  // lazily so SQL-auth users never pull in the native dependency.
  private driver: typeof sql | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  private async getDriver(): Promise<typeof sql> {
    if (this.config.authType !== 'windows') {
      return sql;
    }
    if (!this.driver) {
      try {
        // mssql ships a separate entry point bound to the msnodesqlv8 driver.
        const mod = await import('mssql/msnodesqlv8.js');
        this.driver = (mod.default ?? mod) as typeof sql;
      } catch (error) {
        throw new Error(
          'Windows Integrated authentication requires the "msnodesqlv8" driver ' +
            'and a Microsoft ODBC Driver for SQL Server, which are only available ' +
            'on Windows. Original error: ' +
            (error instanceof Error ? error.message : String(error))
        );
      }
    }
    return this.driver;
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

    const isWindowsAuth = this.config.authType === 'windows';

    const config: sql.config = {
      server: serverHost,
      database: this.config.database,
      options: {
        trustServerCertificate: this.config.trustServerCertificate,
        instanceName,
        // Connect as the logged-in Windows account (no credentials).
        ...(isWindowsAuth ? { trustedConnection: true } : {}),
      },
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
    };

    if (!isWindowsAuth) {
      config.user = this.config.user;
      config.password = this.config.password;
    }

    if (!instanceName) {
      config.port = port;
    }

    const driver = await this.getDriver();
    const pool = new driver.ConnectionPool(config);
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

    // Check if credentials are configured (only for SQL authentication;
    // Windows Integrated auth uses the logged-in account instead).
    if (this.config.authType !== 'windows' && (!this.config.user || !this.config.password)) {
      return {
        success: false,
        server: targetServer,
        error: `SQL Authentication required. Set MSSQL_USER and MSSQL_PASSWORD environment variables, or set MSSQL_AUTH=windows to use Windows Integrated authentication.`
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
