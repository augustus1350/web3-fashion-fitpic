import { Client } from "pg";

export async function canReachPostgres(databaseUrl: string): Promise<boolean> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
  });

  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}
