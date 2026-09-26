import React from 'react';
import { SystemSettingsView } from '@/components/admin/SystemSettingsView';

export const metadata = {
  title: 'Settings & API Keys | BBKitchen Control Tower',
  description: 'Manage Meta Pixel ID, GA4 ID, DeepSeek API Keys, and Commercial Rules without touching source code.',
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SystemSettingsView />
    </div>
  );
}
