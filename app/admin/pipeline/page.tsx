import React from 'react';
import { PipelineMonitor } from '@/components/admin/PipelineMonitor';

export const metadata = {
  title: 'Pipeline & Review | BBKitchen Control Tower',
  description: 'Review incoming raw inventory intake and autonomous Telegram 4-Sensor SOLD detection queue.',
};

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <PipelineMonitor />
    </div>
  );
}
