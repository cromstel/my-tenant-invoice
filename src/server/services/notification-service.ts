import { NotFoundError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { repositories } from '@/server/repositories';

export interface CreateNotificationInput {
  userId: string;
  organizationId?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  private notificationRepo = repositories.notification;
  private preferenceRepo = repositories.notificationPreference;

  async getById(id: string) {
    const notification = await this.notificationRepo.findById(id);
    if (!notification) throw new NotFoundError('Notification not found');
    return notification;
  }

  async listForUser(userId: string, unreadOnly = false) {
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.readAt = null;
    return this.notificationRepo.findAll(where, undefined, { createdAt: 'desc' });
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.notificationRepo.create({
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      metadata: input.metadata,
    });

    logger.info(
      { notificationId: notification.id, userId: input.userId, type: input.type },
      'Notification created',
    );
    return notification;
  }

  async markAsRead(id: string) {
    await this.getById(id);
    return this.notificationRepo.update(id, { readAt: new Date() });
  }

  async markAllAsRead(userId: string) {
    const notifications = await this.listForUser(userId, true);
    for (const n of notifications) {
      await this.notificationRepo.update(n.id, { readAt: new Date() });
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.listForUser(userId, true);
    return notifications.length;
  }

  async setPreference(
    userId: string,
    channel: string,
    notificationType: string,
    enabled: boolean,
    orgId?: string,
  ) {
    const organizationId = orgId ?? (await getActiveOrganizationId());
    return this.preferenceRepo.create({
      userId,
      organizationId,
      channel,
      notificationType,
      enabled,
    });
  }

  // Template-based notification helpers
  async notifyInvoiceCreated(invoiceId: string, customerId: string, userId: string) {
    return this.create({
      userId,
      type: 'INVOICE_CREATED',
      title: 'New Invoice',
      message: `A new invoice has been created for you.`,
      link: `/portal/invoices/${invoiceId}`,
      metadata: { invoiceId, customerId },
    });
  }

  async notifyPaymentReceived(paymentId: string, customerId: string, userId: string) {
    return this.create({
      userId,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Received',
      message: 'Your payment has been received and processed.',
      link: `/portal/payments`,
      metadata: { paymentId, customerId },
    });
  }

  async notifyInvoiceOverdue(invoiceId: string, customerId: string, userId: string) {
    return this.create({
      userId,
      type: 'INVOICE_OVERDUE',
      title: 'Invoice Overdue',
      message: 'An invoice is now overdue. Please make a payment.',
      link: `/portal/invoices/${invoiceId}`,
      metadata: { invoiceId, customerId },
    });
  }
}

export const notificationService = new NotificationService();
