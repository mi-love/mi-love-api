import { user } from '@prisma/client';

export type UserWithoutPassword = Omit<user, 'password'>;
