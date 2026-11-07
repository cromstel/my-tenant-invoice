import type { Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

import { BaseRepository } from './base-repository';

// --- Documents ---
export class DocumentRepository extends BaseRepository<
  Prisma.DocumentDelegate,
  Prisma.DocumentGetPayload<object>
> {
  protected get delegate() {
    return prisma.document;
  }
}

// --- Notifications ---
export class NotificationRepository extends BaseRepository<
  Prisma.NotificationDelegate,
  Prisma.NotificationGetPayload<object>
> {
  protected get delegate() {
    return prisma.notification;
  }
}

export class NotificationPreferenceRepository extends BaseRepository<
  Prisma.NotificationPreferenceDelegate,
  Prisma.NotificationPreferenceGetPayload<object>
> {
  protected get delegate() {
    return prisma.notificationPreference;
  }
}

// --- Audit Log ---
export class AuditLogRepository extends BaseRepository<
  Prisma.AuditLogDelegate,
  Prisma.AuditLogGetPayload<object>
> {
  protected get delegate() {
    return prisma.auditLog;
  }
}

// --- Webhooks ---
export class WebhookEndpointRepository extends BaseRepository<
  Prisma.WebhookEndpointDelegate,
  Prisma.WebhookEndpointGetPayload<object>
> {
  protected get delegate() {
    return prisma.webhookEndpoint;
  }
}

export class WebhookEventRepository extends BaseRepository<
  Prisma.WebhookEventDelegate,
  Prisma.WebhookEventGetPayload<object>
> {
  protected get delegate() {
    return prisma.webhookEvent;
  }
}

// --- API Keys ---
export class ApiKeyRepository extends BaseRepository<
  Prisma.ApiKeyDelegate,
  Prisma.ApiKeyGetPayload<object>
> {
  protected get delegate() {
    return prisma.apiKey;
  }
}

// --- Integrations ---
export class IntegrationRepository extends BaseRepository<
  Prisma.IntegrationDelegate,
  Prisma.IntegrationGetPayload<object>
> {
  protected get delegate() {
    return prisma.integration;
  }
}

// --- Support ---
export class SupportTicketRepository extends BaseRepository<
  Prisma.SupportTicketDelegate,
  Prisma.SupportTicketGetPayload<object>
> {
  protected get delegate() {
    return prisma.supportTicket;
  }
}

// --- Subscriptions ---
export class SubscriptionPlanRepository extends BaseRepository<
  Prisma.SubscriptionPlanDelegate,
  Prisma.SubscriptionPlanGetPayload<object>
> {
  protected get delegate() {
    return prisma.subscriptionPlan;
  }
}

export class OrganizationSubscriptionRepository extends BaseRepository<
  Prisma.OrganizationSubscriptionDelegate,
  Prisma.OrganizationSubscriptionGetPayload<{ include: { plan: true } }>
> {
  protected get delegate() {
    return prisma.organizationSubscription;
  }
}
