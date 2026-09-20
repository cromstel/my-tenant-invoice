# ADR-007: Utilizing shadcn/ui for Design System and UI Components

**Status**: Accepted

---

## Context

**myTenant Invoice** requires a professional, modern, accessible, and highly customizable user interface. Building a design system and component library from scratch is time-consuming and resource-intensive. Key requirements for our UI development include:

-   **Quality**: Production-grade components with excellent UX and accessibility.
-   **Consistency**: A unified visual language across the entire application.
-   **Customization**: Ability to easily theme and brand components for white-label multi-tenancy.
-   **Developer Experience**: Reusable, well-documented components that accelerate UI development.
-   **Accessibility**: Adherence to WCAG 2.2 AA standards.
-   **Integration**: Seamless compatibility with React, Next.js, and Tailwind CSS.

---

## Decision

We have decided to utilize **shadcn/ui** as the foundation for our design system and UI components in **myTenant Invoice**.

shadcn/ui is not a traditional component library but rather a collection of re-usable components that developers copy and paste into their projects and have full control over. Its benefits include:

-   **Headless Approach (Radix UI)**: Built on top of [Radix UI primitives](https://www.radix-ui.com/primitives), which provide unstyled, accessible, and highly customizable components.
-   **Tailwind CSS Integration**: Designed to be styled with Tailwind CSS, offering maximum flexibility for custom branding and theming.
-   **Full Ownership**: By copying the code, we have complete control over every component, allowing for deep customization and integration with our specific design requirements (e.g., multi-tenant branding).
-   **Accessibility**: Radix UI ensures robust accessibility features are baked in, helping us meet WCAG 2.2 AA standards.
-   **Composition over Configuration**: Encourages composing small, focused components into larger, more complex UI elements.
-   **Themeability**: Easy to implement light/dark modes and tenant-specific brand colors by adjusting Tailwind CSS configuration and CSS variables.

---

## Consequences

### Positive

-   **Rapid UI Development**: Speeds up the creation of polished and functional user interfaces.
-   **Consistent UX**: Enforces a consistent design language across the application.
-   **High Accessibility**: Inherits strong accessibility foundations from Radix UI.
-   **Full Customization**: Complete control over component markup and styling, enabling white-label branding for tenants.
-   **Reduced Bundle Size**: Only includes the components actually used, avoiding bloat from large UI libraries.
-   **Improved Maintainability**: Well-structured and isolated components are easier to maintain and update.

### Negative

-   **Initial Setup**: Requires a bit more setup than a pre-built component library, as components are copied and configured manually.
-   **No Built-in State Management**: Radix UI handles component logic but not global UI state, requiring integration with React's state management.
-   **Upgrade Path**: Updates to shadcn/ui require manually syncing changes to copied components (though typically straightforward).
-   **Responsibility for Maintenance**: Since components are copied, we are responsible for their long-term maintenance and any custom modifications.

---

## Related Documentation

-   [Design System](../06-ui-ux/design-system.md)
-   [UI/UX Design (in Master Prompt)](../../project-documentation.md#39-ui--ux-design)
-   [Accessibility](../06-ui-ux/accessibility.md)
-   [Tech Stack (in Master Prompt)](../../project-documentation.md#36-tech-stack)
