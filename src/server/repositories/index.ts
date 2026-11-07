export * from './base-repository';
export * from './billing-repositories';
export * from './domain-repositories';
export * from './invoice-payment-repositories';
export * from './platform-repositories';
export * from './supporting-repositories';

import {
  BillingCycleRepository,
  MeterReadingRepository,
  MeterRepository,
  ServicePackageItemRepository,
  ServicePackageRepository,
  ServiceRepository,
  TariffRepository,
  TariffVersionRepository,
} from './billing-repositories';
import {
  BuildingRepository,
  CustomerContactRepository,
  CustomerRepository,
  LeaseRepository,
  OrganizationMemberRepository,
  OrganizationRepository,
  PortfolioRepository,
  PropertyRepository,
  UnitRepository,
} from './domain-repositories';
import {
  CreditNoteItemRepository,
  CreditNoteRepository,
  InvoiceItemRepository,
  InvoiceRepository,
  PaymentAllocationRepository,
  PaymentRepository,
  RefundRepository,
} from './invoice-payment-repositories';
import {
  AccountRepository,
  PermissionRepository,
  RolePermissionRepository,
  RoleRepository,
  SessionRepository,
  UserRepository,
} from './platform-repositories';
import {
  ApiKeyRepository,
  AuditLogRepository,
  DocumentRepository,
  IntegrationRepository,
  NotificationPreferenceRepository,
  NotificationRepository,
  OrganizationSubscriptionRepository,
  SubscriptionPlanRepository,
  SupportTicketRepository,
  WebhookEndpointRepository,
  WebhookEventRepository,
} from './supporting-repositories';

export const repositories = {
  user: new UserRepository(),
  account: new AccountRepository(),
  session: new SessionRepository(),
  role: new RoleRepository(),
  permission: new PermissionRepository(),
  rolePermission: new RolePermissionRepository(),
  organization: new OrganizationRepository(),
  organizationMember: new OrganizationMemberRepository(),
  subscriptionPlan: new SubscriptionPlanRepository(),
  organizationSubscription: new OrganizationSubscriptionRepository(),
  portfolio: new PortfolioRepository(),
  property: new PropertyRepository(),
  building: new BuildingRepository(),
  unit: new UnitRepository(),
  customer: new CustomerRepository(),
  customerContact: new CustomerContactRepository(),
  lease: new LeaseRepository(),
  service: new ServiceRepository(),
  servicePackage: new ServicePackageRepository(),
  servicePackageItem: new ServicePackageItemRepository(),
  tariff: new TariffRepository(),
  tariffVersion: new TariffVersionRepository(),
  meter: new MeterRepository(),
  meterReading: new MeterReadingRepository(),
  billingCycle: new BillingCycleRepository(),
  invoice: new InvoiceRepository(),
  invoiceItem: new InvoiceItemRepository(),
  creditNote: new CreditNoteRepository(),
  creditNoteItem: new CreditNoteItemRepository(),
  payment: new PaymentRepository(),
  paymentAllocation: new PaymentAllocationRepository(),
  refund: new RefundRepository(),
  document: new DocumentRepository(),
  notification: new NotificationRepository(),
  notificationPreference: new NotificationPreferenceRepository(),
  auditLog: new AuditLogRepository(),
  webhookEndpoint: new WebhookEndpointRepository(),
  webhookEvent: new WebhookEventRepository(),
  apiKey: new ApiKeyRepository(),
  integration: new IntegrationRepository(),
  supportTicket: new SupportTicketRepository(),
} as const;

export type Repositories = typeof repositories;
