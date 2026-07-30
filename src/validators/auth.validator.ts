import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name cannot exceed 255 characters'),

  age: z
    .number({
      error: 'Age must be a number',
    })
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative'),

  email: z
    .email('Invalid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(255, 'Password cannot exceed 255 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
