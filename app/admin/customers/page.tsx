import React from 'react';
import { CustomersCRM } from '@/components/admin/CustomersCRM';

export const metadata = {
  title: 'Buku Pelanggan & CRM | BBKitchen Control Tower',
  description: 'Customer directory, purchase history, Resto/Catering/MBG segmentation, and lead intelligence.',
};

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <CustomersCRM />
    </div>
  );
}
