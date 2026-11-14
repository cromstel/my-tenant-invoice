import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

import env from '@/lib/config/env';
import { InternalError } from '@/lib/errors';
import logger from '@/lib/logging/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
  replyTo?: string;
}

export class EmailAdapter {
  private resend: Resend | null = null;
  private transporter: Transporter | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    }

    if (env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_SECURE ?? false,
        auth:
          env.SMTP_USER && env.SMTP_PASSWORD
            ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
            : undefined,
      });
    }
  }

  isConfigured(): boolean {
    return this.resend !== null || this.transporter !== null;
  }

  async sendEmail(options: EmailOptions): Promise<{ id: string }> {
    const from = options.from ?? env.EMAIL_FROM ?? 'noreply@mytenant.cromstelit.com';
    const fromName = env.EMAIL_FROM_NAME ?? 'myTenant Invoice';

    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: `${fromName} <${from}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
        });
        logger.info(
          { to: options.to, subject: options.subject, id: result.data?.id },
          'Email sent via Resend',
        );
        return { id: result.data?.id ?? 'unknown' };
      } catch (err) {
        logger.error({ err, to: options.to }, 'Resend email failed, trying SMTP fallback');
      }
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: `${fromName} <${from}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
        });
        logger.info(
          { to: options.to, subject: options.subject, id: info.messageId },
          'Email sent via SMTP',
        );
        return { id: info.messageId };
      } catch (err) {
        logger.error({ err, to: options.to }, 'SMTP email failed');
        throw new InternalError('Failed to send email', { cause: err });
      }
    }

    throw new InternalError('No email provider configured');
  }

  async sendTemplate(
    to: string,
    template: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const templates: Record<
      string,
      (data: Record<string, unknown>) => { subject: string; html: string }
    > = {
      invoiceSent: (d) => ({
        subject: `Invoice ${d.invoiceNumber} from ${d.organizationName}`,
        html: `<h1>Invoice ${d.invoiceNumber}</h1><p>Dear ${d.customerName},</p><p>Your invoice for ${d.total} is now available.</p><p>Due date: ${d.dueDate}</p>`,
      }),
      paymentReceived: (d) => ({
        subject: `Payment Received - ${d.amount}`,
        html: `<h1>Payment Received</h1><p>Thank you for your payment of ${d.amount}.</p>`,
      }),
      paymentFailed: (d) => ({
        subject: 'Payment Failed',
        html: `<h1>Payment Failed</h1><p>Your payment of ${d.amount} could not be processed.</p><p>Reason: ${d.reason}</p>`,
      }),
      overdueReminder: (d) => ({
        subject: `Overdue Invoice ${d.invoiceNumber}`,
        html: `<h1>Invoice Overdue</h1><p>Your invoice ${d.invoiceNumber} for ${d.total} is now overdue.</p><p>Please make a payment as soon as possible.</p>`,
      }),
      welcome: (d) => ({
        subject: `Welcome to ${d.organizationName}`,
        html: `<h1>Welcome!</h1><p>Your account has been created. You can now log in to your portal.</p>`,
      }),
    };

    const templateFn = templates[template];
    if (!templateFn) throw new InternalError(`Unknown email template: ${template}`);

    const { subject, html } = templateFn(data);
    return this.sendEmail({ to, subject, html });
  }
}

export const emailAdapter = new EmailAdapter();
