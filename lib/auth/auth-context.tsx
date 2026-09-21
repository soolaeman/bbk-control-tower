"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import type { UserRole, UserSession, RolePermissions } from "@/lib/types/auth";
import { ROLE_PERMISSIONS } from "@/lib/types/auth";

interface AuthContextType {
  user: UserSession | null;
  role: UserRole;
  permissions: RolePermissions;
  permissionsMatrix: Record<string, RolePermissions>;
  switchRole: never;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<string, RolePermissions>>(
    ROLE_PERMISSIONS as unknown as Record<string, RolePermissions>
  );

  const role: UserRole = session?.user?.role ?? "VIEWER";
  const user: UserSession | null = session?.user
    ? {
        id: session.user.email ?? "authenticated-user",
        name: session.user.name ?? "BBK User",
        email: session.user.email ?? "",
        role,
        avatarUrl: session.user.image ?? undefined,
      }
    : null;

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        if (data.permissionsMatrix) {
          setPermissionsMatrix((prev) => ({
            ...prev,
            ...data.permissionsMatrix,
          }));
        }
      }
    } catch (err) {
      console.warn("Could not sync permissions from /api/roles, using defaults:", err);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    const handleChanged = () => {
      fetchPermissions();
    };

    window.addEventListener("bbk-role-permissions-changed", handleChanged);
    return () => {
      window.removeEventListener("bbk-role-permissions-changed", handleChanged);
    };
  }, [fetchPermissions]);

  // Compute active permissions: ADMIN is always full control, otherwise check dynamic matrix or fallback
  const activePermissions: RolePermissions =
    role === "ADMIN"
      ? ROLE_PERMISSIONS.ADMIN
      : permissionsMatrix[role] || (ROLE_PERMISSIONS as Record<string, RolePermissions>)[role] || ROLE_PERMISSIONS.VIEWER;

  const value: AuthContextType = {
    user,
    role,
    permissions: activePermissions,
    permissionsMatrix,
    switchRole: undefined as never,
    isLoading: status === "loading",
    logout: () => signOut({ callbackUrl: "/login" }),
    refreshPermissions: fetchPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
