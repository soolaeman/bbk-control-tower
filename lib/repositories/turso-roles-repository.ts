import { getTursoClient } from './turso-inventory-repository';
import {
  type AppRoleDefinition,
  type AppUserRecord,
  type RolePermissions,
  type UserRole,
  ROLE_PERMISSIONS,
} from '@/lib/types/auth';

const OWNER_EMAIL = 'bukanbarukitchen@gmail.com';

function parsePermissions(jsonStr: string | null | undefined, fallbackRole?: string): RolePermissions {
  if (jsonStr) {
    try {
      return JSON.parse(jsonStr) as RolePermissions;
    } catch {}
  }
  if (fallbackRole && (ROLE_PERMISSIONS as Record<string, RolePermissions>)[fallbackRole]) {
    return (ROLE_PERMISSIONS as Record<string, RolePermissions>)[fallbackRole];
  }
  return ROLE_PERMISSIONS.VIEWER;
}

export async function fetchTursoRoles(): Promise<AppRoleDefinition[]> {
  const client = getTursoClient();
  try {
    const res = await client.execute('SELECT * FROM app_roles ORDER BY is_system DESC, id ASC');
    if (res.rows.length === 0) {
      // Fallback if table empty
      return [
        {
          id: 'ADMIN',
          name: 'Administrator (Owner)',
          description: 'Akses penuh ke seluruh sistem dan konfigurasi.',
          isSystem: true,
          permissions: ROLE_PERMISSIONS.ADMIN,
        },
      ];
    }

    return res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || r.id),
      description: String(r.description || ''),
      isSystem: Number(r.is_system) === 1,
      permissions: parsePermissions(r.permissions_json as string, String(r.id)),
      createdAt: r.created_at ? String(r.created_at) : undefined,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined,
      createdBy: r.created_by ? String(r.created_by) : undefined,
    }));
  } catch (error) {
    console.error('Error fetching roles from Turso:', error);
    return [
      {
        id: 'ADMIN',
        name: 'Administrator (Owner)',
        description: 'Akses penuh ke seluruh sistem.',
        isSystem: true,
        permissions: ROLE_PERMISSIONS.ADMIN,
      },
    ];
  }
}

export async function fetchTursoUsers(): Promise<AppUserRecord[]> {
  const client = getTursoClient();
  try {
    const res = await client.execute('SELECT * FROM app_users ORDER BY is_active DESC, role ASC, created_at DESC');
    return res.rows.map((r) => ({
      id: String(r.id),
      email: String(r.email).toLowerCase().trim(),
      name: String(r.name || ''),
      role: String(r.role || 'VIEWER').toUpperCase(),
      isActive: Number(r.is_active) === 1,
      createdAt: r.created_at ? String(r.created_at) : undefined,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined,
      createdBy: r.created_by ? String(r.created_by) : undefined,
    }));
  } catch (error) {
    console.error('Error fetching users from Turso:', error);
    return [
      {
        id: 'usr_owner_bbk',
        email: OWNER_EMAIL,
        name: 'Bukan Baru Kitchen (Owner)',
        role: 'ADMIN',
        isActive: true,
      },
    ];
  }
}

export async function createCustomRole(
  id: string,
  name: string,
  description: string,
  permissions: RolePermissions,
  createdBy: string = 'ADMIN'
): Promise<AppRoleDefinition> {
  const client = getTursoClient();
  const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  await client.execute({
    sql: `
      INSERT INTO app_roles (id, name, description, is_system, permissions_json, created_at, updated_at, created_by)
      VALUES (?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `,
    args: [cleanId, name.trim(), description.trim(), JSON.stringify(permissions), createdBy],
  });

  return {
    id: cleanId,
    name: name.trim(),
    description: description.trim(),
    isSystem: false,
    permissions,
    createdBy,
  };
}

export async function updateRole(
  id: string,
  name: string,
  description: string,
  permissions: RolePermissions,
  updatedBy: string = 'ADMIN'
): Promise<boolean> {
  const client = getTursoClient();
  const cleanId = id.trim().toUpperCase();

  // Protect ADMIN system role from losing full access
  const finalPermissions = cleanId === 'ADMIN' ? ROLE_PERMISSIONS.ADMIN : permissions;

  await client.execute({
    sql: `
      UPDATE app_roles
      SET name = CASE WHEN ? != '' THEN ? ELSE name END,
          description = CASE WHEN ? != '' THEN ? ELSE description END,
          permissions_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE UPPER(id) = UPPER(?)
    `,
    args: [name.trim(), name.trim(), description.trim(), description.trim(), JSON.stringify(finalPermissions), cleanId],
  });

  return true;
}

export async function deleteCustomRole(id: string): Promise<{ success: boolean; message?: string }> {
  const client = getTursoClient();
  const cleanId = id.trim().toUpperCase();

  if (cleanId === 'ADMIN') {
    return { success: false, message: 'Role ADMIN adalah System Role dan tidak dapat dihapus.' };
  }

  // Check if role is system
  const roleRes = await client.execute({
    sql: 'SELECT is_system FROM app_roles WHERE UPPER(id) = UPPER(?) LIMIT 1',
    args: [cleanId],
  });

  if (roleRes.rows.length === 0) {
    return { success: false, message: 'Role tidak ditemukan.' };
  }

  if (Number(roleRes.rows[0].is_system) === 1) {
    return { success: false, message: 'System role bawaan tidak dapat dihapus.' };
  }

  // Reassign any users who currently hold this role to 'VIEWER'
  await client.execute({
    sql: `
      UPDATE app_users
      SET role = 'VIEWER', updated_at = CURRENT_TIMESTAMP
      WHERE UPPER(role) = UPPER(?)
    `,
    args: [cleanId],
  });

  // Delete role
  await client.execute({
    sql: 'DELETE FROM app_roles WHERE UPPER(id) = UPPER(?)',
    args: [cleanId],
  });

  return { success: true };
}

export async function upsertAppUser(
  email: string,
  role: string,
  name: string = '',
  createdBy: string = 'ADMIN'
): Promise<AppUserRecord> {
  const client = getTursoClient();
  const cleanEmail = email.toLowerCase().trim();
  const cleanRole = role.toUpperCase().trim();
  const id = 'usr_' + cleanEmail.replace(/[^a-z0-9]/g, '_');

  await client.execute({
    sql: `
      INSERT INTO app_users (id, email, name, role, is_active, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(email) DO UPDATE SET
        role = excluded.role,
        name = CASE WHEN excluded.name != '' THEN excluded.name ELSE app_users.name END,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [id, cleanEmail, name.trim(), cleanRole, createdBy],
  });

  return {
    id,
    email: cleanEmail,
    name: name.trim(),
    role: cleanRole,
    isActive: true,
    createdBy,
  };
}

export async function updateUserRole(email: string, role: string, updatedBy: string = 'ADMIN'): Promise<boolean> {
  const client = getTursoClient();
  const cleanEmail = email.toLowerCase().trim();
  const cleanRole = role.toUpperCase().trim();

  // Safety lock for Owner
  if (cleanEmail === OWNER_EMAIL && cleanRole !== 'ADMIN') {
    throw new Error('Email Owner (bukanbarukitchen@gmail.com) terkunci mutlak sebagai ADMIN.');
  }

  await client.execute({
    sql: `
      UPDATE app_users
      SET role = ?, updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(email) = LOWER(?)
    `,
    args: [cleanRole, cleanEmail],
  });

  return true;
}

export async function toggleUserStatus(email: string, isActive: boolean): Promise<boolean> {
  const client = getTursoClient();
  const cleanEmail = email.toLowerCase().trim();

  // Safety lock for Owner
  if (cleanEmail === OWNER_EMAIL && !isActive) {
    throw new Error('Email Owner tidak dapat dinonaktifkan.');
  }

  await client.execute({
    sql: `
      UPDATE app_users
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(email) = LOWER(?)
    `,
    args: [isActive ? 1 : 0, cleanEmail],
  });

  return true;
}

export async function deleteAppUser(email: string): Promise<boolean> {
  const client = getTursoClient();
  const cleanEmail = email.toLowerCase().trim();

  // Safety lock for Owner
  if (cleanEmail === OWNER_EMAIL) {
    throw new Error('Email Owner tidak dapat dihapus.');
  }

  await client.execute({
    sql: 'DELETE FROM app_users WHERE LOWER(email) = LOWER(?)',
    args: [cleanEmail],
  });

  return true;
}

export async function getUserWithRoleByEmail(email: string): Promise<{
  user: AppUserRecord;
  permissions: RolePermissions;
} | null> {
  const client = getTursoClient();
  const cleanEmail = email.toLowerCase().trim();

  try {
    const userRes = await client.execute({
      sql: 'SELECT * FROM app_users WHERE LOWER(email) = LOWER(?) AND is_active = 1 LIMIT 1',
      args: [cleanEmail],
    });

    if (userRes.rows.length === 0) {
      // Automatic fallback for OWNER
      if (cleanEmail === OWNER_EMAIL) {
        return {
          user: {
            id: 'usr_owner_bbk',
            email: OWNER_EMAIL,
            name: 'Bukan Baru Kitchen (Owner)',
            role: 'ADMIN',
            isActive: true,
          },
          permissions: ROLE_PERMISSIONS.ADMIN,
        };
      }
      return null;
    }

    const u = userRes.rows[0];
    const userRole = String(u.role || 'VIEWER').toUpperCase();

    // Fetch permissions for this role from app_roles
    let permissions = parsePermissions(null, userRole);
    const roleRes = await client.execute({
      sql: 'SELECT permissions_json FROM app_roles WHERE UPPER(id) = UPPER(?) LIMIT 1',
      args: [userRole],
    });

    if (roleRes.rows.length > 0 && roleRes.rows[0].permissions_json) {
      permissions = parsePermissions(roleRes.rows[0].permissions_json as string, userRole);
    }

    return {
      user: {
        id: String(u.id),
        email: cleanEmail,
        name: String(u.name || ''),
        role: userRole,
        isActive: true,
      },
      permissions,
    };
  } catch (error) {
    console.error('Error querying user with role by email:', error);
    if (cleanEmail === OWNER_EMAIL) {
      return {
        user: {
          id: 'usr_owner_bbk',
          email: OWNER_EMAIL,
          name: 'Bukan Baru Kitchen (Owner)',
          role: 'ADMIN',
          isActive: true,
        },
        permissions: ROLE_PERMISSIONS.ADMIN,
      };
    }
    return null;
  }
}
