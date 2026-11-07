import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

import { BaseRepository } from './base-repository';

// --- User & Auth ---
export class UserRepository extends BaseRepository<
  Prisma.UserDelegate,
  Prisma.UserGetPayload<{ include: { organizationMembers: true } }>
> {
  protected get delegate() {
    return prisma.user;
  }

  async findByEmail(email: string) {
    return this.findFirst({ email: email.toLowerCase() });
  }
}

export class AccountRepository extends BaseRepository<
  Prisma.AccountDelegate,
  Prisma.AccountGetPayload<object>
> {
  protected get delegate() {
    return prisma.account;
  }
}

export class SessionRepository extends BaseRepository<
  Prisma.SessionDelegate,
  Prisma.SessionGetPayload<object>
> {
  protected get delegate() {
    return prisma.session;
  }
}

// --- RBAC ---
export class RoleRepository extends BaseRepository<
  Prisma.RoleDelegate,
  Prisma.RoleGetPayload<{ include: { permissions: true } }>
> {
  protected get delegate() {
    return prisma.role;
  }

  async findByName(name: string) {
    return this.findFirst({ name });
  }
}

export class PermissionRepository extends BaseRepository<
  Prisma.PermissionDelegate,
  Prisma.PermissionGetPayload<object>
> {
  protected get delegate() {
    return prisma.permission;
  }

  async findByName(name: string) {
    return this.findFirst({ name });
  }
}

export class RolePermissionRepository extends BaseRepository<
  Prisma.RolePermissionDelegate,
  Prisma.RolePermissionGetPayload<object>
> {
  protected get delegate() {
    return prisma.rolePermission;
  }
}
