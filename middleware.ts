import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole, RolePermissions } from "@/lib/types/auth";

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // 1. Static assets & public auth bypass
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const session = request.auth;
  const isApi = pathname.startsWith("/api/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // 2. Public route isolation
  if (!isAdmin && !isApi && pathname !== "/login") {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname === "/login") {
    if (session?.user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // 3. Unauthenticated gatekeeper
  if (!session?.user) {
    if (isApi) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = (session.user as { role?: UserRole }).role;
  const permissions = (session.user as { permissions?: RolePermissions }).permissions;

  if (!role) {
    if (isApi) {
      return NextResponse.json({ error: "ROLE_NOT_ASSIGNED" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login?error=role", request.url));
  }

  // 4. Server-Side Permission Enforcement for APIs
  if (isApi) {
    // ADMIN (Owner) always has master bypass
    if (role === "ADMIN") {
      const headers = new Headers(request.headers);
      headers.set("x-bbk-role", role);
      headers.set("x-bbk-authenticated", "true");
      if (permissions) headers.set("x-bbk-permissions", JSON.stringify(permissions));
      return NextResponse.next({ request: { headers } });
    }

    // Gating for /api/roles:
    // GET: Any authenticated user can read role metadata and permissions
    // POST: Only ADMIN can modify roles and users
    if (pathname.startsWith("/api/roles")) {
      if (request.method === "POST") {
        return NextResponse.json(
          { error: "FORBIDDEN: Hanya ADMIN yang dapat mengonfigurasi role dan pengguna." },
          { status: 403 }
        );
      }
      const headers = new Headers(request.headers);
      headers.set("x-bbk-role", role);
      headers.set("x-bbk-authenticated", "true");
      return NextResponse.next({ request: { headers } });
    }

    // Permission-based gating for other API routes
    let isAllowed = true;

    if (pathname.startsWith("/api/finance")) {
      isAllowed = Boolean(permissions?.canViewFinanceReports);
    } else if (pathname.startsWith("/api/invoices")) {
      isAllowed = Boolean(permissions?.canManageInvoices);
    } else if (pathname.startsWith("/api/inventory")) {
      isAllowed = Boolean(permissions?.canViewFloorPrice || permissions?.canEditInventory);
    } else if (pathname.startsWith("/api/pipeline")) {
      isAllowed = Boolean(permissions?.canEditInventory);
    } else if (pathname.startsWith("/api/sales-helper")) {
      isAllowed = Boolean(permissions?.canViewDealPrice || permissions?.canViewFloorPrice);
    } else if (pathname.startsWith("/api/seo")) {
      isAllowed = Boolean(permissions?.canEditSEO);
    } else if (pathname.startsWith("/api/analytics")) {
      isAllowed = Boolean(permissions?.canViewRawAnalytics || permissions?.canViewFinanceReports);
    }

    if (!isAllowed) {
      return NextResponse.json(
        { error: "FORBIDDEN: Role Anda tidak memiliki izin untuk modul ini." },
        { status: 403 }
      );
    }

    const headers = new Headers(request.headers);
    headers.set("x-bbk-role", role);
    headers.set("x-bbk-authenticated", "true");
    if (permissions) headers.set("x-bbk-permissions", JSON.stringify(permissions));
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
