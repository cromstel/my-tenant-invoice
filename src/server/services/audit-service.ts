import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface AuditLogEntry {
  organizationId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  private auditRepo = repositories.auditLog;

  async log(entry: AuditLogEntry) {
    const log = await this.auditRepo.create({
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });

    logger.debug(
      { action: entry.action, entityType: entry.entityType, entityId: entry.entityId },
      'Audit log created',
    );
    return log;
  }

  async getByEntity(entityType: string, entityId: string) {
    return this.auditRepo.findAll({ entityType, entityId }, undefined, { createdAt: 'desc' });
  }

  async getByActor(actorId: string, _limit = 50) {
    return this.auditRepo.findAll({ actorId }, undefined, { createdAt: 'desc' });
  }

  async getByOrganization(orgId?: string, _limit = 100) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.auditRepo.findAll({ organizationId }, undefined, { createdAt: 'desc' });
  }

  async getRecentActivity(_limit = 20) {
    const orgId = await getActiveOrganizationId();
    return this.auditRepo.findAll({ organizationId: orgId }, undefined, { createdAt: 'desc' });
  }
}

export const auditService = new AuditService();
