import crypto from 'node:crypto';

import { logger } from '@/lib/logging/logger';
import { repositories } from '@/server/repositories';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export async function deliverWebhook(
  endpointId: string,
  eventType: string,
  payload: Record<string, unknown>,
  attempt = 1,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const endpoint = await repositories.webhookEndpoint.findById(endpointId);
  if (!endpoint || !endpoint.isEnabled) {
    return { success: false, error: 'Endpoint not found or disabled' };
  }

  const webhookPayload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  };

  const body = JSON.stringify(webhookPayload);
  const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Timestamp': webhookPayload.timestamp,
      },
      body,
    });

    await repositories.webhookEvent.create({
      webhookEndpointId: endpointId,
      eventType,
      payload: webhookPayload as unknown as Record<string, unknown>,
      deliveryStatus: response.ok ? 'SUCCEEDED' : 'FAILED',
      statusCode: response.status,
      responseBody: await response.text().catch(() => ''),
      retries: attempt - 1,
      lastAttemptAt: new Date(),
    });

    if (response.ok) {
      logger.info(
        { endpointId, eventType, statusCode: response.status },
        'Webhook delivered successfully',
      );
      return { success: true, statusCode: response.status };
    }

    logger.warn(
      { endpointId, eventType, statusCode: response.status, attempt },
      'Webhook delivery failed',
    );

    // Retry logic
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      setTimeout(() => {
        deliverWebhook(endpointId, eventType, payload, attempt + 1);
      }, delay);
    }

    return { success: false, statusCode: response.status };
  } catch (err) {
    logger.error({ err, endpointId, eventType, attempt }, 'Webhook delivery error');

    await repositories.webhookEvent.create({
      webhookEndpointId: endpointId,
      eventType,
      payload: webhookPayload as unknown as Record<string, unknown>,
      deliveryStatus: 'FAILED',
      retries: attempt - 1,
      lastAttemptAt: new Date(),
    });

    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      setTimeout(() => {
        deliverWebhook(endpointId, eventType, payload, attempt + 1);
      }, delay);
    }

    return { success: false, error: String(err) };
  }
}

export async function triggerWebhooks(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const endpoints = await repositories.webhookEndpoint.findAll({
    organizationId,
    isEnabled: true,
  });

  const relevantEndpoints = endpoints.filter((ep) => {
    const events = ep.events as string[] | null;
    return !events || events.includes(eventType) || events.includes('*');
  });

  const results = await Promise.allSettled(
    relevantEndpoints.map((ep) => deliverWebhook(ep.id, eventType, payload)),
  );

  return results;
}
