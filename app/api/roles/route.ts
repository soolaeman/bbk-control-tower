import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  fetchTursoRoles,
  fetchTursoUsers,
  createCustomRole,
  updateRole,
  deleteCustomRole,
  upsertAppUser,
  updateUserRole,
  toggleUserStatus,
  deleteAppUser,
} from '@/lib/repositories/turso-roles-repository';
import type { RolePermissions } from '@/lib/types/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';

    // Allow authenticated users to fetch roles/permissions matrix
    const [roles, users] = await Promise.all([fetchTursoRoles(), fetchTursoUsers()]);

    const permissionsMatrix: Record<string, RolePermissions> = {};
    for (const r of roles) {
      permissionsMatrix[r.id] = r.permissions;
    }

    return NextResponse.json({
      success: true,
      roles,
      users,
      permissionsMatrix,
      currentUserRole: session?.user?.role || 'VIEWER',
    });
  } catch (error: any) {
    console.error('API /api/roles GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data roles & users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const callerRole = session?.user?.role;
    const isDev = process.env.NODE_ENV === 'development';

    // Strictly enforce ADMIN access
    if (callerRole !== 'ADMIN' && !isDev) {
      return NextResponse.json(
        { error: 'FORBIDDEN: Hanya role ADMIN (Owner) yang berhak mengubah konfigurasi otorisasi.' },
        { status: 403 }
      );
    }

    const callerEmail = session?.user?.email || 'ADMIN';
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'ADD_USER': {
        const { email, role, name } = body;
        if (!email || !email.includes('@')) {
          return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
        }
        const user = await upsertAppUser(email, role || 'VIEWER', name || '', callerEmail);
        return NextResponse.json({ success: true, user });
      }

      case 'UPDATE_USER_ROLE': {
        const { email, role } = body;
        if (!email || !role) {
          return NextResponse.json({ error: 'Email dan role wajib diisi.' }, { status: 400 });
        }
        await updateUserRole(email, role, callerEmail);
        return NextResponse.json({ success: true });
      }

      case 'TOGGLE_USER_STATUS': {
        const { email, isActive } = body;
        if (!email) {
          return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
        }
        await toggleUserStatus(email, Boolean(isActive));
        return NextResponse.json({ success: true });
      }

      case 'DELETE_USER': {
        const { email } = body;
        if (!email) {
          return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
        }
        await deleteAppUser(email);
        return NextResponse.json({ success: true });
      }

      case 'CREATE_ROLE': {
        const { id, name, description, permissions } = body;
        if (!id || !name) {
          return NextResponse.json({ error: 'Kode role dan nama role wajib diisi.' }, { status: 400 });
        }
        const createdRole = await createCustomRole(
          id,
          name,
          description || '',
          permissions || {},
          callerEmail
        );
        return NextResponse.json({ success: true, role: createdRole });
      }

      case 'UPDATE_ROLE': {
        const { id, name, description, permissions } = body;
        if (!id) {
          return NextResponse.json({ error: 'ID role wajib diisi.' }, { status: 400 });
        }
        await updateRole(id, name, description || '', permissions, callerEmail);
        return NextResponse.json({ success: true });
      }

      case 'DELETE_ROLE': {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: 'ID role wajib diisi.' }, { status: 400 });
        }
        const delRes = await deleteCustomRole(id);
        if (!delRes.success) {
          return NextResponse.json({ error: delRes.message }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      case 'SAVE_PERMISSIONS_MATRIX': {
        const { matrix } = body;
        if (!matrix || typeof matrix !== 'object') {
          return NextResponse.json({ error: 'Data matriks permissions tidak valid.' }, { status: 400 });
        }

        for (const [roleId, perms] of Object.entries(matrix)) {
          if (roleId === 'ADMIN') continue; // Always keep ADMIN full access
          await updateRole(roleId, roleId, '', perms as RolePermissions, callerEmail);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Aksi '${action}' tidak dikenali.` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API /api/roles POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses permintaan role/user' },
      { status: 500 }
    );
  }
}
