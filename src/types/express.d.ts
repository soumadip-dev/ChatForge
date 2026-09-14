import { TokenPayload, User } from './user';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
      tokenpayload?: TokenPayload;
    }
  }
}

export {};
