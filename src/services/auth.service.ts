import { AppError } from '../errors/AppError';
import {
  createUser,
  deleteUser,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserById,
} from '../repositories/user.repository';
import { createToken } from '../lib/jwt.lib';
import type { LoginInput, RegisterInput } from '../validators/auth.validator';

import bcrypt from 'bcrypt';
import type { DBUserWithPasswordRow, User } from '../types/user.types';

export async function registerUserService({
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

export async function loginUserService({
  email,
  password,
}: LoginInput): Promise<{ accessToken: string; user: DBUserWithPasswordRow }> {
  const user = await findUserByEmailWithPassword(email);

  if (!user) {
    throw new AppError(409, 'Invalid credentials');
  }

  if (!user.password) {
    throw new AppError(409, 'Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError(409, 'Invalid credentials');
  }

  const accessToken = createToken({ id: user.id, email: user.email });

  return { accessToken, user };
}

export async function deleteUserService(id: string) {
  const user = await findUserById(id);

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  await deleteUser(id);
}
