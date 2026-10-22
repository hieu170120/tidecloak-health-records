import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const host = process.env.DATABASE_HOST ?? '127.0.0.1';
    const port = Number(process.env.DATABASE_PORT ?? 5432);
    const user = process.env.DATABASE_USER ?? 'app_runtime';
    const database = process.env.DATABASE_NAME ?? process.env.POSTGRES_DB ?? 'tidecloak_health';
    const password = process.env.DATABASE_PASSWORD ?? process.env.APP_DB_PASSWORD;

    if (!password) {
      throw new Error('DATABASE_PASSWORD or APP_DB_PASSWORD must be set');
    }

    this.pool = new Pool({
      host,
      port,
      user,
      database,
      password,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    return this.pool.query<T>(text, values);
  }
}
