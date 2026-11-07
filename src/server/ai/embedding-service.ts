import OpenAI from 'openai';

import env from '@/lib/config/env';
import { InternalError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { knowledgeBase } from '@/server/ai/knowledge-base';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export class EmbeddingService {
  private client: OpenAI | null = null;

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) throw new InternalError('OpenAI not configured');
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0]?.embedding ?? [];
    } catch (err) {
      logger.error({ err }, 'Embedding generation failed');
      throw new InternalError('Embedding generation failed', { cause: err });
    }
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.client) throw new InternalError('OpenAI not configured');
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map((d, i) => ({
        text: texts[i] ?? '',
        embedding: d.embedding,
      }));
    } catch (err) {
      logger.error({ err }, 'Batch embedding generation failed');
      throw new InternalError('Batch embedding generation failed', { cause: err });
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) ** 2;
      normB += (b[i] ?? 0) ** 2;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async semanticSearch(
    query: string,
    topK = 5,
  ): Promise<Array<{ id: string; question: string; answer: string; score: number }>> {
    if (!this.client) {
      // Fallback to keyword search
      const results = knowledgeBase.filter(
        (kb) =>
          kb.question.toLowerCase().includes(query.toLowerCase()) ||
          kb.answer.toLowerCase().includes(query.toLowerCase()),
      );
      return results.slice(0, topK).map((kb) => ({
        id: kb.id,
        question: kb.question,
        answer: kb.answer,
        score: 1,
      }));
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // In a real implementation, these would be pre-computed and stored
      const kbEmbeddings = await Promise.all(
        knowledgeBase.map(async (kb) => ({
          ...kb,
          embedding: await this.generateEmbedding(`${kb.question} ${kb.answer}`),
        })),
      );

      const scored = kbEmbeddings.map((kb) => ({
        id: kb.id,
        question: kb.question,
        answer: kb.answer,
        score: this.cosineSimilarity(queryEmbedding, kb.embedding),
      }));

      return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    } catch (err) {
      logger.error({ err }, 'Semantic search failed, falling back to keyword search');
      const results = knowledgeBase.filter(
        (kb) =>
          kb.question.toLowerCase().includes(query.toLowerCase()) ||
          kb.answer.toLowerCase().includes(query.toLowerCase()),
      );
      return results.slice(0, topK).map((kb) => ({
        id: kb.id,
        question: kb.question,
        answer: kb.answer,
        score: 1,
      }));
    }
  }
}

export const embeddingService = new EmbeddingService();
