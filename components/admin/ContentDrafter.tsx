'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Sparkles,
  Search,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  RefreshCw,
  ExternalLink,
  BookOpen,
  HelpCircle,
  ShoppingBag,
  Tag,
  ArrowRight,
  Layers,
  Send,
} from 'lucide-react';

interface ArticleItem {
  id: number;
  slug: string;
  title: string;
  seoTitle: string;
  categorySlug: string;
  articleType: string;
  summary: string;
  contentMarkdown: string;
  faqJson: string;
  targetKeywords: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  revisionNotes: string;
  publishedAt?: string | null;
  createdAt: string;
}

export function ContentDrafter() {
  const { role } = useAuth();
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'PUBLISHED' | 'ALL'>('DRAFT');
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/content/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        if (data.articles?.length > 0 && !selectedArticle) {
          setSelectedArticle(data.articles[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedArticle]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handlePublish = async (id: number) => {
    try {
      const res = await fetch('/api/content/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PUBLISH', articleId: id }),
      });
      if (res.ok) {
        setActionMessage('Artikel berhasil di-ACC & diterbitkan ke Storefront!');
        fetchArticles();
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRevision = async (id: number) => {
    try {
      const res = await fetch('/api/content/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVISE', articleId: id, revisionNotes }),
      });
      if (res.ok) {
        setActionMessage('Catatan revisi tersimpan untuk AI refinement.');
        fetchArticles();
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredArticles = articles.filter((a) => {
    if (activeTab === 'ALL') return true;
    return a.status === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-100">
              Autonomous Content Drafter (DeepSeek Engine)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Programmatic SEO Pillar/Cluster Drafter dengan 3 Live Product Cards & FAQ Schema Generator
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchArticles()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Split Grid: Article List vs Detail/Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Queue List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            {(['DRAFT', 'PUBLISHED', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab === 'DRAFT' ? 'Review Queue' : tab === 'PUBLISHED' ? 'Published' : 'Semua'}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800/80">
                Tidak ada artikel dalam status ini.
              </div>
            ) : (
              filteredArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => {
                    setSelectedArticle(article);
                    setRevisionNotes(article.revisionNotes || '');
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedArticle?.id === article.id
                      ? 'bg-slate-900 border-purple-500/50 shadow-md ring-1 ring-purple-500/20'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800/40">
                      {article.articleType}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        article.status === 'PUBLISHED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                      }`}
                    >
                      {article.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-200 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {article.summary}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono">Kategori: {article.categorySlug}</span>
                    <span>{new Date(article.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Active Article Inspector & Actions */}
        <div className="lg:col-span-7">
          {selectedArticle ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-mono text-purple-400">/{selectedArticle.slug}</span>
                  <h2 className="text-base font-bold text-slate-100 mt-0.5">
                    {selectedArticle.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{previewMode ? 'Edit Mode' : 'Live Preview'}</span>
                  </button>

                  {selectedArticle.status === 'DRAFT' && (
                    <button
                      onClick={() => handlePublish(selectedArticle.id)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-slate-950 flex items-center gap-1.5 transition shadow-sm shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ACC & Publish</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Preview or Markdown Source */}
              {previewMode ? (
                <div className="space-y-6 bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <div className="prose prose-invert prose-amber max-w-none text-xs text-slate-300 space-y-4">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {selectedArticle.contentMarkdown}
                    </div>
                  </div>

                  {/* 3 Live Product Cards Preview */}
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-3">
                      <ShoppingBag className="w-4 h-4" />
                      <span>Live Product Embeds (3 Unit Ready Stok)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[1, 2, 3].map((idx) => (
                        <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                          <div className="w-full aspect-[4/3] bg-slate-950 rounded flex items-center justify-center text-slate-600 text-[10px] mb-2 font-mono">
                            Foto Unit {idx}
                          </div>
                          <div className="text-[11px] font-bold text-slate-200 truncate">
                            Upright Chiller Ready #{idx}
                          </div>
                          <div className="text-[10px] text-amber-400 font-bold mt-1">
                            Rp 14.500.000
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FAQ Schema Preview */}
                  {selectedArticle.faqJson && (
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-400 mb-3">
                        <HelpCircle className="w-4 h-4" />
                        <span>FAQ Schema JSON-LD Embed</span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 overflow-x-auto">
                        {selectedArticle.faqJson}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      SEO Title (SERP Preview)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={selectedArticle.seoTitle}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Target Keywords (Silo Strategy)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={selectedArticle.targetKeywords}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Content Markdown (DeepSeek Output)
                    </label>
                    <textarea
                      rows={12}
                      readOnly
                      value={selectedArticle.contentMarkdown}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed"
                    />
                  </div>

                  {/* Revision Notes Box */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Catatan Revisi AI (Opsional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="Contoh: Tambahkan penekanan pada garansi 3 bulan dan perbandingan harga baru..."
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => handleSaveRevision(selectedArticle.id)}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim Revisi</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-24 text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
              Pilih artikel dari antrean di sebelah kiri untuk meninjau.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
