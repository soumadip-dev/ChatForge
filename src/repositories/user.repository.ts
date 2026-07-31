// find user by email

import { pool } from '../lib/db.lib';
import type { DBUserRow, DBUserWithPasswordRow, User } from '../types/user.types';

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

  return result.rows[0] ?? null;
}

export async function createUser(
  name: string,
  age: number,
  email: string,
  password: string
): Promise<User> {
  const result = await pool.query<DBUserRow>(
    `
      INSERT INTO users (name, age, email, password)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [name, age, email, password]
  );
  return result.rows[0] as User;
}

export async function findUserByEmailWithPassword(
  email: string
): Promise<DBUserWithPasswordRow | null> {
  const result = await pool.query<DBUserWithPasswordRow>('SELECT * FROM users WHERE email = $1', [
    email,
  ]);
  return result.rows[0] ?? null;
}
