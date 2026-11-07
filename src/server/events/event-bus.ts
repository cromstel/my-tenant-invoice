export type DomainEvent =
  | {
      type: 'organization.created';
      payload: { organizationId: string; name: string; slug: string };
    }
  | { type: 'user.created'; payload: { userId: string; email: string } }
  | {
      type: 'invoice.created';
      payload: { invoiceId: string; organizationId: string; customerId: string; total: number };
    }
  | { type: 'invoice.sent'; payload: { invoiceId: string; organizationId: string; sentAt: string } }
  | { type: 'invoice.paid'; payload: { invoiceId: string; organizationId: string; amount: number } }
  | {
      type: 'invoice.overdue';
      payload: { invoiceId: string; organizationId: string; dueDate: string };
    }
  | {
      type: 'payment.succeeded';
      payload: { paymentId: string; organizationId: string; amount: number };
    }
  | {
      type: 'payment.failed';
      payload: { paymentId: string; organizationId: string; reason: string };
    }
  | {
      type: 'meter.reading.created';
      payload: { meterId: string; organizationId: string; reading: number; anomaly: boolean };
    }
  | {
      type: 'lease.created';
      payload: { leaseId: string; organizationId: string; customerId: string; unitId: string };
    }
  | {
      type: 'customer.created';
      payload: { customerId: string; organizationId: string; name: string };
    };

type EventHandler<T extends DomainEvent['type']> = (
  event: Extract<DomainEvent, { type: T }>,
) => Promise<void> | void;

class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<string, Set<EventHandler<any>>>();

  on<T extends DomainEvent['type']>(type: T, handler: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off<T extends DomainEvent['type']>(type: T, handler: EventHandler<T>): void {
    this.handlers.get(type)?.delete(handler);
  }

  async emit(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises = Array.from(handlers as Set<any>).map((handler: any) => {
      try {
        return Promise.resolve(handler(event));
      } catch (err) {
        console.error(`Error in event handler for ${event.type}:`, err);
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }

  removeAllListeners(type?: DomainEvent['type']): void {
    if (type) {
      this.handlers.delete(type);
    } else {
      this.handlers.clear();
    }
  }
}

export const eventBus = new EventBus();
export type { EventHandler };
