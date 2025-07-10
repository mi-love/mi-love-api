import { UserWithoutPassword } from './db';

module 'express' {
  export interface Request {
    user: UserWithoutPassword;
  }
}
