import { UserWithoutPassword } from './db';

declare module 'express' {
  export interface Request {
    user: UserWithoutPassword;
  }
}
