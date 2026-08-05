import { z } from 'zod';

//* Password schema for validating password input
const passwordSchema = z
  .string({
    error: 'Password is required',
  })
  .min(8, 'Password must be at least 8 characters')
  .max(30, 'Password cannot exceed 30 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*(),.?":{}|<>_\-\\[\]~`+=/;]/,
    'Password must contain at least one special character'
  );

//* Register schema for validating the request body
export const registerSchema = z.object({
  name: z
    .string({
      error: 'Name is required',
    })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name cannot exceed 255 characters'),

  age: z
    .number({
      error: 'Age is required and must be a number',
    })
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(150, 'Age cannot exceed 150'),

  email: z
    .email({
      error: 'Email is required or invalid',
    })
    .max(255, 'Email cannot exceed 255 characters')
    .trim()
    .toLowerCase(),

  password: passwordSchema,
});

//* Login schema for validating the request body
export const loginSchema = z.object({
  email: z
    .email({
      error: 'Email is required or invalid',
    })
    .max(255, 'Email cannot exceed 255 characters')
    .trim()
    .toLowerCase(),

  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
