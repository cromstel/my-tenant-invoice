import Stripe from 'stripe';

import env from '@/lib/config/env';
import { PaymentProviderError } from '@/lib/errors';
import logger from '@/lib/logging/logger';

export class StripeAdapter {
  private stripe: Stripe | null = null;

  constructor() {
    if (env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: Record<string, string>,
  ) {
    if (!this.stripe) throw new PaymentProviderError('Stripe not configured', 'NOT_CONFIGURED');
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata,
        automatic_payment_methods: { enabled: true },
      });
      return { id: paymentIntent.id, clientSecret: paymentIntent.client_secret };
    } catch (err) {
      logger.error({ err }, 'Stripe payment intent creation failed');
      throw new PaymentProviderError('Failed to create payment intent', 'CREATE_FAILED', {
        cause: err,
      });
    }
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, string>) {
    if (!this.stripe) throw new PaymentProviderError('Stripe not configured', 'NOT_CONFIGURED');
    try {
      const customer = await this.stripe.customers.create({ email, name, metadata });
      return { id: customer.id };
    } catch (err) {
      logger.error({ err }, 'Stripe customer creation failed');
      throw new PaymentProviderError('Failed to create customer', 'CREATE_FAILED', { cause: err });
    }
  }

  async createSubscription(customerId: string, priceId: string, metadata?: Record<string, string>) {
    if (!this.stripe) throw new PaymentProviderError('Stripe not configured', 'NOT_CONFIGURED');
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
      });
      return { id: subscription.id, status: subscription.status };
    } catch (err) {
      logger.error({ err }, 'Stripe subscription creation failed');
      throw new PaymentProviderError('Failed to create subscription', 'CREATE_FAILED', {
        cause: err,
      });
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    if (!this.stripe) throw new PaymentProviderError('Stripe not configured', 'NOT_CONFIGURED');
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });
      return { id: refund.id, status: refund.status };
    } catch (err) {
      logger.error({ err }, 'Stripe refund failed');
      throw new PaymentProviderError('Failed to process refund', 'REFUND_FAILED', { cause: err });
    }
  }

  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string) {
    if (!this.stripe) throw new PaymentProviderError('Stripe not configured', 'NOT_CONFIGURED');
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
      logger.error({ err }, 'Stripe webhook verification failed');
      throw new PaymentProviderError('Webhook verification failed', 'WEBHOOK_FAILED', {
        cause: err,
      });
    }
  }
}

export const stripeAdapter = new StripeAdapter();
