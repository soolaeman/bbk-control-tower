import React from 'react';
import { AdminLayoutWrapper } from '@/components/layout/AdminLayoutWrapper';

export const metadata = {
  title: 'BBKitchen Sovereign Control Tower',
  description: 'Enterprise ERP & Operations Control Tower for Bukan Baru Kitchen',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
