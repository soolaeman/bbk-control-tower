import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/repositories/turso-inventory-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const client = getTursoClient();

    // Ensure articles table exists
    await client.execute(`
      CREATE TABLE IF NOT EXISTS content_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        seo_title TEXT,
        category_slug TEXT,
        article_type TEXT DEFAULT 'CLUSTER', -- PILLAR, CLUSTER, BUYER_GUIDE
        summary TEXT,
        content_markdown TEXT NOT NULL,
        faq_json TEXT,
        target_keywords TEXT,
        status TEXT DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ARCHIVED
        revision_notes TEXT,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.execute(`
      SELECT * FROM content_articles ORDER BY created_at DESC LIMIT 50
    `);

    // If empty, insert standard initial articles
    if (result.rows.length === 0) {
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const initialArticle = {
        slug: 'panduan-memilih-upright-chiller-bekas-resto-berkualitas',
        title: 'Panduan Lengkap Memilih Upright Chiller Bekas Restoran Bergaransi',
        seo_title: 'Panduan Beli Upright Chiller Bekas Resto Bergaransi | BBKitchen',
        category_slug: 'upright-chiller',
        article_type: 'BUYER_GUIDE',
        summary: 'Tips praktis inspeksi kompresor, kondisi karet pintu, thermostat digital, dan uji suhu operasional kulkas resto komersial bekas.',
        content_markdown: `## Mengapa Upright Chiller Bekas Masih Menjadi Pilihan Cerdas?

Membuka restoran atau kafe baru membutuhkan alokasi modal yang terukur. Salah satu pos pengeluaran terbesar adalah peralatan pendingin (chiller & freezer). Unit upright chiller baru berkapasitas 2-4 pintu dapat mencapai Rp 25 juta hingga Rp 45 juta. Dengan memilih unit bekas berkualitas dari BBKitchen, Anda menghemat 50-65% Capex tanpa mengorbankan performa.

### 4 Titik Kritis yang Wajib Diperiksa Sebelum Membeli:

1. **Kompresor & Tekanan Freon (R134a / R404a):** Pastikan tidak ada kebocoran oli pada sambungan pipa tembaga dan suara mesin halus.
2. **Kondensor & Fan Motor:** Sirkulasi udara pendingin harus lancar dan kisi-kisi kondensor bersih dari kerak lemak.
3. **Karet Pintu (Door Gasket Magnetic):** Kerapatan segel pintu menjaga suhu internal stabil antara +2°C hingga +8°C.
4. **Digital Thermostat & Evaporator:** Sensor defrost otomatis berfungsi normal tanpa bunga es berlebih.

BBKitchen melakukan tes fungsi 24 jam untuk seluruh unit pendingin sebelum dikirim ke dapur Anda.`,
        faq_json: JSON.stringify([
          {
            q: 'Berapa lama masa garansi unit pendingin di BBKitchen?',
            a: 'BBKitchen memberikan garansi fungsi resmi 1 hingga 3 bulan mencakup kompresor dan sistem pendingin.',
          },
          {
            q: 'Apakah unit bisa dikirim ke luar Jabodetabek?',
            a: 'Bisa. Kami bekerjasama dengan ekspedisi kargo khusus (Sentral Cargo / Dakota) dengan packing kayu aman.',
          },
        ]),
        target_keywords: 'upright chiller bekas, chiller resto bekas, kulkas komersial bekas bergaransi',
        status: 'DRAFT',
      };

      await client.execute({
        sql: `
          INSERT INTO content_articles (slug, title, seo_title, category_slug, article_type, summary, content_markdown, faq_json, target_keywords, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          initialArticle.slug,
          initialArticle.title,
          initialArticle.seo_title,
          initialArticle.category_slug,
          initialArticle.article_type,
          initialArticle.summary,
          initialArticle.content_markdown,
          initialArticle.faq_json,
          initialArticle.target_keywords,
          initialArticle.status,
          nowStr,
        ],
      });
    }

    const reloaded = await client.execute(`
      SELECT * FROM content_articles ORDER BY created_at DESC LIMIT 50
    `);

    const articles = reloaded.rows.map((row) => ({
      id: Number(row.id),
      slug: String(row.slug || ''),
      title: String(row.title || ''),
      seoTitle: String(row.seo_title || ''),
      categorySlug: String(row.category_slug || ''),
      articleType: String(row.article_type || 'CLUSTER'),
      summary: String(row.summary || ''),
      contentMarkdown: String(row.content_markdown || ''),
      faqJson: String(row.faq_json || '[]'),
      targetKeywords: String(row.target_keywords || ''),
      status: String(row.status || 'DRAFT'),
      revisionNotes: String(row.revision_notes || ''),
      publishedAt: row.published_at ? String(row.published_at) : null,
      createdAt: String(row.created_at || ''),
    }));

    return NextResponse.json({ articles });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content articles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, articleId, revisionNotes, articleData } = body;

    const client = getTursoClient();
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (action === 'PUBLISH') {
      await client.execute({
        sql: `
          UPDATE content_articles 
          SET status = 'PUBLISHED', published_at = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [nowStr, nowStr, articleId],
      });
      return NextResponse.json({ success: true, message: 'Artikel berhasil di-ACC & dipublikasikan ke Storefront!' });
    } else if (action === 'REVISE') {
      await client.execute({
        sql: `
          UPDATE content_articles 
          SET status = 'DRAFT', revision_notes = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [revisionNotes || 'Catatan revisi dicatat', nowStr, articleId],
      });
      return NextResponse.json({ success: true, message: 'Catatan revisi berhasil disimpan.' });
    } else if (action === 'CREATE') {
      const { slug, title, seoTitle, categorySlug, articleType, summary, contentMarkdown, faqJson, targetKeywords } = articleData;
      await client.execute({
        sql: `
          INSERT INTO content_articles (slug, title, seo_title, category_slug, article_type, summary, content_markdown, faq_json, target_keywords, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
        `,
        args: [
          slug,
          title,
          seoTitle || `${title} | BBKitchen`,
          categorySlug || 'umum',
          articleType || 'CLUSTER',
          summary || '',
          contentMarkdown || '',
          faqJson || '[]',
          targetKeywords || '',
          nowStr,
          nowStr,
        ],
      });
      return NextResponse.json({ success: true, message: 'Draft artikel baru berhasil dibuat.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process content action' },
      { status: 500 }
    );
  }
}
