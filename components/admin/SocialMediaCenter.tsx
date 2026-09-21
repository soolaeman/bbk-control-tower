'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { SocialContentItem, SocialChannel, SocialContentStatus } from '@/lib/types/social';
import { getSocialContent, createSocialPost, updateSocialStatus } from '@/lib/repositories/social-repository';
import {
  Share2,
  Instagram,
  Facebook,
  MessageCircle,
  Plus,
  Calendar,
  ExternalLink,
  CheckCircle,
  Video,
  Clock,
  Sparkles,
} from 'lucide-react';

export function SocialMediaCenter() {
  const { role, permissions } = useAuth();
  const canEdit = role === 'ADMIN' || Boolean(permissions?.canEditSocial || permissions?.canManageSocialMedia);
  const [items, setItems] = useState<SocialContentItem[]>(() => getSocialContent());
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New item state
  const [topic, setTopic] = useState('');
  const [channel, setChannel] = useState<SocialChannel>('INSTAGRAM');
  const [caption, setCaption] = useState('');
  const [relatedSku, setRelatedSku] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [mediaType, setMediaType] = useState<'IMAGE' | 'REEL' | 'VIDEO' | 'CAROUSEL'>('REEL');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createSocialPost({
      topic,
      channel,
      status: 'DRAFT',
      caption,
      relatedSku,
      callToAction,
      destinationUrl: `https://bukanbarukitchen.com/product/${relatedSku.toLowerCase()}`,
      mediaType,
      assignedCreator: 'Tim Media BBKitchen',
      performanceNotes: 'Draf konten baru',
    });
    setItems([...getSocialContent()]);
    setShowCreateModal(false);
    // Reset
    setTopic('');
    setCaption('');
    setRelatedSku('');
    setCallToAction('');
  };

  const handleStatusChange = (id: string, status: SocialContentStatus) => {
    updateSocialStatus(id, status);
    setItems([...getSocialContent()]);
  };

  const getChannelBadge = (ch: SocialChannel) => {
    switch (ch) {
      case 'INSTAGRAM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-950 text-pink-300 border border-pink-800">INSTAGRAM</span>;
      case 'TIKTOK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">TIKTOK</span>;
      case 'WHATSAPP_STORY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">WA STORY</span>;
      case 'GOOGLE_BUSINESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">GOOGLE BUSINESS</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">{ch}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Share2 className="w-6 h-6 text-amber-500" />
            <span>Social Media & Content Operations</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Pusat koordinasi konten Instagram Reels, TikTok, WhatsApp broadcast, dan Google Business Profile.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Konten Baru</span>
          </button>
        )}
      </div>

      {/* Content Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {getChannelBadge(item.channel)}
                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {item.mediaType}
                  </span>
                </div>

                {canEdit ? (
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value as SocialContentStatus)}
                    className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-bold text-amber-300 focus:outline-none"
                  >
                    <option value="IDEA">IDEA</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                  </select>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 border border-slate-800 text-amber-300 font-mono">
                    {item.status}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-white mt-2.5 line-clamp-1">{item.topic}</h3>
              <p className="text-xs text-slate-300 mt-2 line-clamp-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 leading-relaxed font-sans">
                {item.caption}
              </p>

              {item.relatedSku && (
                <div className="mt-2.5 text-xs flex items-center gap-2 text-slate-400">
                  <span>Terkait SKU:</span>
                  <span className="font-mono text-amber-400 font-bold px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800">
                    {item.relatedSku}
                  </span>
                </div>
              )}
            </div>

            {/* Performance Stats */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3 font-mono text-[11px]">
                {item.engagementStats?.waInquiries ? (
                  <span className="text-emerald-400 font-bold">
                    💬 {item.engagementStats.waInquiries} WA Leads
                  </span>
                ) : null}
                {item.engagementStats?.likes ? (
                  <span>❤️ {item.engagementStats.likes} Likes</span>
                ) : null}
              </div>
              <span className="text-slate-500 text-[11px]">PJ: {item.assignedCreator}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Create Social Content */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Rencanakan Konten Sosial Media
            </h2>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Topik / Ide Utama</label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Showcase Chiller 2 Pintu Bekas Cafe"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Channel Distribusi</label>
                  <select
                    value={channel}
                    onChange={(e: any) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="WHATSAPP_STORY">WhatsApp Story</option>
                    <option value="GOOGLE_BUSINESS">Google Business Profile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tipe Media</label>
                  <select
                    value={mediaType}
                    onChange={(e: any) => setMediaType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="REEL">Instagram / TikTok Reel</option>
                    <option value="VIDEO">Video Showcase</option>
                    <option value="IMAGE">Foto Single / Story</option>
                    <option value="CAROUSEL">Carousel Multi-Slide</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">SKU Terkait (Opsional)</label>
                <input
                  type="text"
                  value={relatedSku}
                  onChange={(e) => setRelatedSku(e.target.value)}
                  placeholder="BBK-ML-REF-0021"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Draf Caption & Hashtag</label>
                <textarea
                  rows={3}
                  required
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ketik draf copy naskah..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
