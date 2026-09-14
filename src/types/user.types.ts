// Data returned directly from the database
export type User = {
  id: string;
  name: string;
  age: number;
  email: string;
  total_token_used: number;
  created_at: Date;
  updated_at: Date;
};

// Database row used for inserts/selects
export type DBUserRow = {
  id: string;
  name: string;
  age: number;
  email: string;
  total_token_used?: number;
  created_at: Date;
  updated_at: Date;
};

export type DBUserWithPasswordRow = DBUserRow & {
  password: string | null;
};

export type TokenPayload = {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
};
