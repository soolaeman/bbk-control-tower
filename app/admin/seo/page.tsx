import React from 'react';
import { SEOQualityControl } from '@/components/admin/SEOQualityControl';

export const metadata = {
  title: 'SEO Quality & GSC Hub | BBKitchen Control Tower',
  description: 'GSC Health, Sacred 3.062 URLs protection, Dynamic 301 Redirect Manager, and Lead Attribution Signals.',
};

export default function SEOPage() {
  return (
    <div className="space-y-6">
      <SEOQualityControl />
    </div>
  );
}
