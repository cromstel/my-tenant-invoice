# ADR-008: Enforcing Zod for Server-Side Input Validation

**Status**: Accepted

---

## Context

Security and data integrity are paramount for **myTenant Invoice**, especially given its financial nature and multi-tenant architecture. All user inputs, API requests, and server actions must be rigorously validated to prevent:

-   **Security Vulnerabilities**: SQL injection, XSS, mass assignment, broken access control, etc.
-   **Data Corruption**: Invalid or malformed data entering the database.
-   **Application Errors**: Unexpected input leading to crashes or incorrect logic.
-   **Cross-Tenant Data Leakage**: Malicious inputs attempting to bypass tenant isolation.

Client-side validation provides a better user experience but is never sufficient for security. Robust server-side validation is mandatory.

---

## Decision

We have chosen **Zod** as the primary library for **server-side input validation** across **myTenant Invoice**.

Zod is a TypeScript-first schema declaration and validation library that offers:

-   **Type Safety**: Automatically infers TypeScript types from schemas, ensuring that validated data matches expected types throughout the application.
-   **Runtime Validation**: Provides powerful runtime validation for any JavaScript value, not just forms.
-   **Comprehensive Schema Features**: Supports complex object schemas, arrays, unions, discriminated unions, refinements, and custom validation logic.
-   **Developer Experience**: Intuitive API, clear error messages, and excellent integration with React Hook Form (`@hookform/resolvers/zod`).
-   **Performance**: Highly optimized for performance.
-   **Security**: Helps enforce strict data contracts, preventing unexpected or malicious data from reaching business logic or the database.

---

## Consequences

### Positive

-   **Enhanced Security**: Significantly reduces the attack surface by ensuring all incoming data conforms to strict schemas.
-   **Improved Data Integrity**: Prevents invalid data from polluting the database.
-   **Reduced Bugs**: Type inference and runtime checks catch errors early in the development cycle.
-   **Clear API Contracts**: Zod schemas serve as living documentation for expected input and output structures for APIs and Server Actions.
-   **Consistent Validation**: Establishes a standardized approach to validation across the entire backend.
-   **Better Developer Experience**: Simplified validation logic and improved type safety increase productivity.

### Negative

-   **Boilerplate**: Defining schemas for every input can introduce some boilerplate code, though this is a necessary trade-off for security.
-   **Learning Curve**: Developers new to Zod will need to learn its API and patterns.
-   **Performance Overhead**: While optimized, validation adds a small amount of overhead to request processing (negligible compared to security benefits).

---