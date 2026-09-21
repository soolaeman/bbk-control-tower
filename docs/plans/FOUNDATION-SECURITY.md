# BBK Control Tower — Foundation Security

## Boundary

This repository is the INTERNAL Control Tower.

The public BBKitchen website remains in:

- Front-End-BBKitchen

Public prototype routes in this repository are intentionally isolated by middleware.

## Authentication

Authentication uses Auth.js / NextAuth with Google OAuth.

Required server environment variables:

- AUTH_SECRET
- AUTH_GOOGLE_ID
- AUTH_GOOGLE_SECRET
- BBK_ALLOWED_EMAILS_JSON

Example:

```json
{
  "admin@example.com": "ADMIN",
  "operator@example.com": "OPERATOR",
  "marketing@example.com": "MARKETING",
  "finance@example.com": "FINANCE",
  "viewer@example.com": "VIEWER",
  "investor@example.com": "INVESTOR"
}
```

Never commit real credentials.

## Server-side RBAC

The authenticated Google identity is mapped to a server-side role.

The browser cannot choose the role.

Middleware injects the authenticated role into protected internal API requests as a server-controlled header.

Existing API handlers may still contain legacy role parameters; those must be removed or ignored in a later hardening pass.

## Sensitive data

Never expose these publicly:

- HARGA_MODAL
- HARGA_BUKA_WA
- HARGA_DEAL_WA
- HARGA_FLOOR_WA
- MARGIN_FLOOR
- MARGIN_DEAL
- LINK_TELEGRAM
- supplier_code
- internal_notes

## Mock data

The existing inventory repository is still MOCK DATA.

Do not connect production Google Sheets data until authentication and authorization have been verified in deployment.

## Next step

Replace the mock inventory repository with a server-only Google Sheets adapter while preserving the repository interface.
