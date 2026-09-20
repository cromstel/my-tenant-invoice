# ADR-006: Adopting S3-Compatible Object Storage for File Management

**Status**: Accepted

---

## Context

**myTenant Invoice** needs to handle various types of files, including tenant logos, property images, customer documents, and generated PDF invoices. Key requirements for file storage include:

-   **Scalability**: Ability to store petabytes of data without performance degradation.
-   **Durability and Availability**: High resilience against data loss and consistent access.
-   **Security**: Robust access control, encryption at rest and in transit, and tenant isolation.
-   **Cost-Effectiveness**: Efficient storage for varying access patterns.
-   **Stateless Servers**: Decoupling file storage from application servers.
-   **Global Distribution**: Potential for delivering files from edge locations (CDN).

Traditional filesystem storage on application servers is not suitable for a scalable SaaS platform.

---

## Decision

We have chosen to adopt **S3-compatible object storage** (e.g., AWS S3 in production, MinIO for local development) for all file management needs in **myTenant Invoice**.

Object storage provides a highly scalable, durable, and secure solution that aligns perfectly with our SaaS architectural principles:

-   **Scalability**: Object storage services are designed for virtually unlimited storage capacity.
-   **Durability**: Offers extremely high durability (e.g., 99.999999999% for AWS S3) and availability.
-   **Security**: Provides fine-grained access control (IAM policies), encryption at rest (AES-256), and secure data transfer (TLS).
-   **Cost-Effectiveness**: Pay-as-you-go model with various storage classes.
-   **Integration with CDN**: Seamless integration with Content Delivery Networks (CDNs) for global content delivery and performance.
-   **Tenant Isolation**: Natural fit for structuring data with `organizationId` prefixes, enforcing logical separation.

---

## Consequences

### Positive

-   **Infinite Scalability**: Storage capacity grows with demand without requiring changes to application architecture.
-   **High Durability and Availability**: Reduced risk of data loss and consistent access for users.
-   **Enhanced Security**: Leverages cloud provider security features for encryption and access control.
-   **Stateless Application Servers**: Simplifies server management and horizontal scaling of application instances.
-   **Improved Performance**: Integrates well with CDNs for faster content delivery worldwide.
-   **Clear Tenant Separation**: `organizationId`-prefixed paths enforce strong data isolation at the storage level.

### Negative

-   **Eventual Consistency**: Object storage can be eventually consistent, meaning a file written might not be immediately readable in all regions (though typically fine for our use cases).
-   **Cost Management**: Costs can grow significantly with large data volumes and high access patterns if not managed properly.
-   **External Dependency**: Introduces a dependency on an external cloud storage provider.
-   **Latency**: Retrieving many small objects can sometimes be slower than direct database reads, requiring careful design (e.g., batching).

---

## Related Documentation

-   [File Storage Architecture](../file-storage-architecture.md)
-   [Security Overview](../05-security/security-overview.md)
-   [Tenant Security](../05-security/tenant-security.md)
-   [Secrets Management](../05-security/secrets-management.md)
-   [Image Guidelines](../06-ui-ux/image-guidelines.md)
