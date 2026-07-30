// for returning user data
export type User = {
  id: string;
  name: string;
  age: number;
  email: string;
  tokenUsed: number;
  tokenLimit: number;
  resetAt: Date;
  totalTokenUsed: number;
  createdAt: Date;
  updatedAt: Date;
};

// for saving user data
export type DBUserRow = {
  id: string;
  name: string;
  age: number;
  email: string;
  tokenUsed?: number;
  tokenLimit?: number;
  resetAt?: Date;
  totalTokenUsed?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DBUserWithPasswordRow = DBUserRow & {
  password: string | null;
};

export type TokenPayload = {
  id: string;
  email: string;
};
