import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { ConflictError, NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { repositories } from '@/server/repositories';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  image: z.string().url().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
});

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  image?: string;
}

export class UserService {
  private userRepo = repositories.user;
  private orgMemberRepo = repositories.organizationMember;
  private roleRepo = repositories.role;
  private auditRepo = repositories.auditLog;

  async getById(id: string) {
    const user = await this.userRepo.findById(id, {
      organizationMembers: { include: { role: true } },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async getByEmail(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async create(input: CreateUserData) {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.userRepo.create({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      image: input.image,
    });

    const currentUser = await getCurrentUser();
    if (currentUser?.activeTenantId) {
      await this.auditRepo.create({
        organizationId: currentUser.activeTenantId,
        actorId: currentUser.id,
        action: 'user.create',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, name: user.name },
      });
    }

    logger.info({ userId: user.id, email: user.email }, 'User created');
    return user;
  }

  async inviteToOrganization(orgId: string, email: string, roleId: string) {
    const ok = await hasPermission('team.invite');
    if (!ok) throw new Error('Requires team.invite permission');

    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError('Role not found');

    let user = await this.userRepo.findByEmail(email);
    if (!user) {
      const tempPassword = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      user = await this.userRepo.create({
        email: email.toLowerCase(),
        passwordHash,
        name: email.split('@')[0] ?? 'New User',
      });
    }

    const existingMember = await this.orgMemberRepo.findByOrgAndUser(orgId, user.id);
    if (existingMember) throw new ConflictError('User is already a member of this organization');

    const member = await this.orgMemberRepo.create({
      organizationId: orgId,
      userId: user.id,
      roleId,
    });

    const currentUser = await getCurrentUser();
    if (currentUser) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: currentUser.id,
        action: 'organization.member.invite',
        entityType: 'OrganizationMember',
        entityId: member.id,
        metadata: { userId: user.id, email: user.email, roleId },
      });
    }

    logger.info({ orgId, userId: user.id, email: user.email }, 'User invited to organization');
    return { user, member };
  }

  async removeMember(orgId: string, userId: string) {
    const ok = await hasPermission('team.remove');
    if (!ok) throw new Error('Requires team.remove permission');

    const member = await this.orgMemberRepo.findByOrgAndUser(orgId, userId);
    if (!member) throw new NotFoundError('Membership not found');

    await this.orgMemberRepo.delete(member.id);

    const currentUser = await getCurrentUser();
    if (currentUser) {
      await this.auditRepo.create({
        organizationId: orgId,
        actorId: currentUser.id,
        action: 'organization.member.remove',
        entityType: 'OrganizationMember',
        entityId: member.id,
        metadata: { userId },
      });
    }
  }

  async getUserRoles(orgId: string, userId: string): Promise<string[]> {
    const member = await this.orgMemberRepo.findByOrgAndUser(orgId, userId);
    if (!member) return [];
    const role = await this.roleRepo.findById(member.roleId);
    return role ? [role.name] : [];
  }
}

export const userService = new UserService();
