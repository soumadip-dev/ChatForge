import { AppError } from '../errors/AppError';
import { createUser, findUserByEmail } from '../repositories/user.repository';
import { createToken } from '../lib/jwt.lib';
import type { RegisterInput } from '../validators/auth.validator';

import bcrypt from 'bcrypt';
import type { User } from '../types/user.types';

export async function registerUser({
  name,
  age,
  email,
  password,
}: RegisterInput): Promise<{ accessToken: string; newUser: User }> {
  // find the user if already exists
  const exitingUser = await findUserByEmail(email);

  if (exitingUser) {
    throw new AppError(409, 'User already exists');
  }

  const hashPassword = await bcrypt.hash(password, 12);

  const newUser = await createUser(name, age, email, hashPassword);

  const accessToken = createToken({ id: newUser.id, email: newUser.email });

  return { accessToken, newUser };
}
