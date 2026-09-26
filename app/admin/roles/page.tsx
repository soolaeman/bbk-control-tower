import React from 'react';
import { RoleManagement } from '@/components/admin/RoleManagement';

export const metadata = {
  title: 'Roles & Team Management | BBKitchen Control Tower',
  description: 'Role-Based Access Control (RBAC) settings for Owner, Sales, Warehouse Operator, and Marketing teams.',
};

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <RoleManagement />
    </div>
  );
}
