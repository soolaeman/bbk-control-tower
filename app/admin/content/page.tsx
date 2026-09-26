import React from 'react';
import { ContentDrafter } from '@/components/admin/ContentDrafter';

export const metadata = {
  title: 'Content Drafter (AI) | BBKitchen Control Tower',
  description: 'Autonomous DeepSeek Content Drafter with 3 Live Product Cards, FAQ Schema, and ACC Review Queue.',
};

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <ContentDrafter />
    </div>
  );
}
