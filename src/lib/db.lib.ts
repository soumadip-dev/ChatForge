import { Pool } from 'pg';
import { env } from '../config/env.config';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});
