import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { UserRole } from "@/lib/types/auth";
import { getUserWithRoleByEmail } from "@/lib/repositories/turso-roles-repository";

const OWNER_EMAIL = "bukanbarukitchen@gmail.com";

function getFallbackUsers(): Record<string, UserRole> {
  try {
    return JSON.parse(process.env.BBK_ALLOWED_EMAILS_JSON || "{}") as Record<string, UserRole>;
  } catch {
    return {};
  }
}

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      // 1. Sovereign Owner bypass
      if (email === OWNER_EMAIL) return true;

      // 2. Query Turso Cloud DB SSOT
      try {
        const userRecord = await getUserWithRoleByEmail(email);
        if (userRecord?.user?.isActive) return true;
      } catch (err) {
        console.error("Turso auth check error:", err);
      }

      // 3. Fallback to env file if set
      return Boolean(getFallbackUsers()[email]);
    },
    async jwt({ token, user }) {
      const email = (user?.email || token.email)?.toLowerCase().trim();
      if (email) {
        if (email === OWNER_EMAIL) {
          token.role = "ADMIN";
        } else {
          try {
            const userRecord = await getUserWithRoleByEmail(email);
            if (userRecord?.user?.role) {
              token.role = userRecord.user.role;
            } else {
              token.role = getFallbackUsers()[email] || "VIEWER";
            }
          } catch {
            token.role = getFallbackUsers()[email] || "VIEWER";
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
