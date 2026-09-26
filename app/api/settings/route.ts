import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/repositories/turso-inventory-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const client = getTursoClient();

    // Ensure system_settings table exists
    await client.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.execute(`SELECT * FROM system_settings`);
    const settingsMap: Record<string, string> = {
      meta_pixel_id: '1692161474757353',
      ga4_measurement_id: 'G-7NKG2N67L2',
      deepseek_api_key: 'sk-deepseek-enterprise',
      whatsapp_sales_number: '6281234567890',
      company_name: 'Bukan Baru Kitchen (BBKitchen)',
      holding_fee_max: '1000000',
    };

    for (const row of result.rows) {
      if (row.key) {
        settingsMap[String(row.key)] = String(row.value || '');
      }
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    const client = getTursoClient();
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (settings && typeof settings === 'object') {
      for (const [key, val] of Object.entries(settings)) {
        await client.execute({
          sql: `
            INSERT INTO system_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
          `,
          args: [key, String(val), nowStr],
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Pengaturan sistem berhasil diperbarui di SQLite SSOT.' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}
