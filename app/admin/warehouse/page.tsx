import React from 'react';
import { WarehouseIntelligence } from '@/components/admin/WarehouseIntelligence';

export const metadata = {
  title: 'Warehouse Intelligence | BBKitchen Control Tower',
  description: '14 Partner Hubs monitoring, aging radar, velocity index, and dead stock prevention.',
};

export default function WarehousePage() {
  return (
    <div className="space-y-6">
      <WarehouseIntelligence />
    </div>
  );
}
