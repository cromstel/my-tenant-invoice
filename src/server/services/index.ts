export { type AuditLogEntry, AuditService, auditService } from './audit-service';
export {
  BillingService,
  billingService,
  type GenerateInvoiceFromLeaseInput,
} from './billing-service';
export {
  type CreateCustomerContactInput,
  type CreateCustomerInput,
  CustomerService,
  customerService,
} from './customer-service';
export { type CreateInvoiceInput, InvoiceService, invoiceService } from './invoice-service';
export { type CreateLeaseInput, LeaseService, leaseService } from './lease-service';
export {
  type CreateMeterInput,
  type CreateMeterReadingInput,
  MeterService,
  meterService,
} from './meter-service';
export {
  type CreateNotificationInput,
  NotificationService,
  notificationService,
} from './notification-service';
export {
  type CreateOrganizationInput,
  OrganizationService,
  organizationService,
  type UpdateOrganizationInput,
} from './organization-service';
export { PaymentService, paymentService, type RecordPaymentInput } from './payment-service';
export {
  type CreateBuildingInput,
  type CreatePropertyInput,
  type CreateUnitInput,
  PropertyService,
  propertyService,
} from './property-service';
export { type ReportFilters, ReportService, reportService } from './report-service';
export {
  type CreateServiceInput,
  type CreateServicePackageInput,
  ServiceService,
  serviceService,
} from './service-service';
export {
  type CreateTariffInput,
  type CreateTariffVersionInput,
  type TariffCalculationInput,
  TariffService,
  tariffService,
} from './tariff-service';
export {
  type CreateUserData,
  createUserSchema,
  inviteMemberSchema,
  UserService,
  userService,
} from './user-service';

// Re-export all services as a single object for convenience
import { auditService } from './audit-service';
import { billingService } from './billing-service';
import { customerService } from './customer-service';
import { invoiceService } from './invoice-service';
import { leaseService } from './lease-service';
import { meterService } from './meter-service';
import { notificationService } from './notification-service';
import { organizationService } from './organization-service';
import { paymentService } from './payment-service';
import { propertyService } from './property-service';
import { reportService } from './report-service';
import { serviceService } from './service-service';
import { tariffService } from './tariff-service';
import { userService } from './user-service';

export const services = {
  organization: organizationService,
  user: userService,
  property: propertyService,
  customer: customerService,
  lease: leaseService,
  service: serviceService,
  tariff: tariffService,
  meter: meterService,
  invoice: invoiceService,
  payment: paymentService,
  notification: notificationService,
  report: reportService,
  audit: auditService,
  billing: billingService,
} as const;

export type Services = typeof services;
