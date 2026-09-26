import React from 'react';
import { SocialMediaCenter } from '@/components/admin/SocialMediaCenter';

export const metadata = {
  title: 'Social Media Center | BBKitchen Control Tower',
  description: 'Multi-channel social media copy generator: Telegram Broadcast, IG Carousel, and TikTok short scripts.',
};

export default function SocialPage() {
  return (
    <div className="space-y-6">
      <SocialMediaCenter />
    </div>
  );
}
