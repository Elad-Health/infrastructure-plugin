import { z } from 'zod';

const ConfigSchema = z.object({
  host: z.string().default(''),  // Optional - can specify server per-tool call
  port: z.coerce.number().default(1433),
  database: z.string().default('master'),
  // 'sql' = SQL Server login (user/password); 'windows' = Windows Integrated
  // Security (connects as the logged-in Windows account, no credentials needed).
  authType: z.enum(['sql', 'windows']).default('sql'),
  user: z.string().optional(),
  password: z.string().optional(),
  encrypt: z.coerce.boolean().default(false),
  trustServerCertificate: z.coerce.boolean().default(true),
  connectionTimeout: z.coerce.number().default(30000),
  requestTimeout: z.coerce.number().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const raw = {
    host: process.env.MSSQL_HOST,
    port: process.env.MSSQL_PORT,
    database: process.env.MSSQL_DATABASE,
    authType: process.env.MSSQL_AUTH,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    encrypt: process.env.MSSQL_ENCRYPT,
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE,
    connectionTimeout: process.env.MSSQL_CONNECTION_TIMEOUT,
    requestTimeout: process.env.MSSQL_REQUEST_TIMEOUT,
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Configuration error:\n${errors}`);
  }

  return result.data;
}
