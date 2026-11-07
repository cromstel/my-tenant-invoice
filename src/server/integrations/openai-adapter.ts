import OpenAI from 'openai';

import env from '@/lib/config/env';
import { InternalError } from '@/lib/errors';
import logger from '@/lib/logging/logger';

export class OpenAIAdapter {
  private client: OpenAI | null = null;

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    model = 'gpt-4o-mini',
  ) {
    if (!this.client) throw new InternalError('OpenAI not configured');
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (err) {
      logger.error({ err }, 'OpenAI chat failed');
      throw new InternalError('AI chat failed', { cause: err });
    }
  }

  async explainInvoice(invoiceData: Record<string, unknown>) {
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a helpful billing assistant. Explain invoice charges clearly and concisely. Only use the data provided. Never make up charges or amounts.',
      },
      {
        role: 'user' as const,
        content: `Please explain this invoice: ${JSON.stringify(invoiceData)}`,
      },
    ];
    return this.chat(messages);
  }

  async explainTariff(tariffData: Record<string, unknown>) {
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a helpful billing assistant. Explain tariff rules in simple terms. Only use the data provided.',
      },
      {
        role: 'user' as const,
        content: `Please explain this tariff: ${JSON.stringify(tariffData)}`,
      },
    ];
    return this.chat(messages);
  }

  async explainConsumption(consumptionData: Record<string, unknown>) {
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a helpful billing assistant. Explain consumption data and trends. Only use the data provided.',
      },
      {
        role: 'user' as const,
        content: `Please explain this consumption data: ${JSON.stringify(consumptionData)}`,
      },
    ];
    return this.chat(messages);
  }
}

export const openaiAdapter = new OpenAIAdapter();
