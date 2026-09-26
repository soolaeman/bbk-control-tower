import React from 'react';
import { InventoryTable } from '@/components/admin/InventoryTable';

export const metadata = {
  title: 'Master Inventory | BBKitchen Control Tower',
  description: 'Master Inventory table with sticky top filter, multi-photo preview, and dual-track sold management.',
};

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <InventoryTable />
    </div>
  );
}
