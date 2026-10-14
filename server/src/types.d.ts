import type { Role, UserStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      role: Role;
      status: UserStatus;
      isSuperAdmin: boolean;
      name: string;
      email: string;
      departmentId: string | null;
      managerId: string | null;
    }
    interface Request {
      user?: AuthUser;
      /** Parsed + coerced output of the validate() middleware. */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
