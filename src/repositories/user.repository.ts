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

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);

  return result.rows[0] ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  const query = `
  DELETE FROM users
  WHERE id = $1
  `;
  await pool.query(query, [id]);
}

export async function resetUserTokenUsage(userId: string, resetAt: Date): Promise<void> {
  const query = `
    UPDATE users
    SET
      token_used = 0,
      reset_at = $2,
      updated_at = NOW()
    WHERE id = $1
  `;

  await pool.query(query, [userId, resetAt]);
}

export async function incrementUserTokenUsage(userId: string, totalTokens: number): Promise<void> {
  const query = `
    UPDATE users
    SET
      token_used = token_used + $2,
      total_token_used = total_token_used + $2,
      updated_at = NOW()
    WHERE id = $1
  `;

  await pool.query(query, [userId, totalTokens]);
}
