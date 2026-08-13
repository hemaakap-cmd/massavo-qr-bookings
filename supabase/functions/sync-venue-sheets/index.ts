import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { buildCorsHeaders } from '../_shared/cors.ts';
import { isServiceRoleCall, isAdminCall, unauthorized } from '../_shared/internal-auth.ts';

const GW = 'https://connector-gateway.lovable.dev/google_sheets/v4';
const HEADERS_DE = ['Buchungs-ID','Kundenname','E-Mail','Telefon','Datum','Uhrzeit','Service','Preis','Währung','Status','Zahlung','Erstellt am'];
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// MASSAVO brand colors
const BRAND_DARK = { red: 0.07, green: 0.09, blue: 0.13 };       // #121723
const BRAND_GOLD = { red: 0.83, green: 0.69, blue: 0.30 };       // #d4b04d
const BRAND_CREAM = { red: 0.98, green: 0.96, blue: 0.92 };      // #faf6eb
const BAND_ALT = { red: 0.96, green: 0.94, blue: 0.88 };         // beige stripe
const BORDER_GREY = { red: 0.85, green: 0.83, blue: 0.78 };
const TEXT_DARK = { red: 0.12, green: 0.14, blue: 0.18 };

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTHS_DE[parseInt(m, 10) - 1]} ${y}`;
}

function gsHeaders() {
  const lk = Deno.env.get('LOVABLE_API_KEY');
  const gk = Deno.env.get('GOOGLE_SHEETS_API_KEY');
  if (!lk) throw new Error('LOVABLE_API_KEY missing');
  if (!gk) throw new Error('GOOGLE_SHEETS_API_KEY missing');
  return {
    'Authorization': `Bearer ${lk}`,
    'X-Connection-Api-Key': gk,
    'Content-Type': 'application/json',
  };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 1500;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fn();
      await sleep(250); // gentle pacing between writes (~4/s, far under 60/min)
      return res;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const is429 = msg.includes('429') || msg.includes('RATE_LIMIT') || msg.includes('RESOURCE_EXHAUSTED');
      if (!is429 || attempt === 5) throw e;
      console.log(`[${label}] rate limited, waiting ${delay}ms (attempt ${attempt + 1})`);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
  throw new Error('unreachable');
}

async function gsGet(spreadsheetId: string) {
  const r = await fetch(`${GW}/spreadsheets/${spreadsheetId}`, { headers: gsHeaders() });
  if (!r.ok) throw new Error(`get spreadsheet ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function gsBatchUpdate(spreadsheetId: string, requests: any[]) {
  return withRetry(async () => {
    const r = await fetch(`${GW}/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST', headers: gsHeaders(), body: JSON.stringify({ requests }),
    });
    if (!r.ok) throw new Error(`batchUpdate ${r.status}: ${await r.text()}`);
    return await r.json();
  }, 'batchUpdate');
}

async function gsPutValues(spreadsheetId: string, range: string, values: any[][]) {
  return withRetry(async () => {
    const url = `${GW}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const r = await fetch(url, { method: 'PUT', headers: gsHeaders(), body: JSON.stringify({ values }) });
    if (!r.ok) throw new Error(`putValues ${r.status}: ${await r.text()}`);
    return await r.json();
  }, 'putValues');
}

async function gsClear(spreadsheetId: string, range: string) {
  await withRetry(async () => {
    const url = `${GW}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
    const r = await fetch(url, { method: 'POST', headers: gsHeaders(), body: '{}' });
    if (!r.ok) throw new Error(`clear ${r.status}: ${await r.text()}`);
    return r;
  }, 'clear');
}

async function formatMonthSheet(spreadsheetId: string, sid: number, totalRows: number) {
  const COLS = 12;
  const requests: any[] = [
    // Title row (row 0): merge A:L, gold bg, dark bold large text
    { mergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: 'MERGE_ALL' } },
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_DARK,
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
        textFormat: { foregroundColor: BRAND_GOLD, bold: true, fontSize: 16, fontFamily: 'Inter' },
      } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    } },
    // Subtitle row (row 1): merge, cream bg, dark text
    { mergeCells: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: 'MERGE_ALL' } },
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_CREAM,
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
        textFormat: { foregroundColor: TEXT_DARK, bold: false, fontSize: 10, fontFamily: 'Inter' },
      } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    } },
    // Header row (row 2): dark bg, gold text, bold
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_DARK,
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
        textFormat: { foregroundColor: BRAND_GOLD, bold: true, fontSize: 11, fontFamily: 'Inter' },
        borders: {
          bottom: { style: 'SOLID_MEDIUM', color: BRAND_GOLD },
        },
      } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,borders)',
    } },
    // Row heights
    { updateDimensionProperties: {
      range: { sheetId: sid, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 44 }, fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId: sid, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 28 }, fields: 'pixelSize',
    } },
    { updateDimensionProperties: {
      range: { sheetId: sid, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
      properties: { pixelSize: 34 }, fields: 'pixelSize',
    } },
    // Frozen rows = 3
    { updateSheetProperties: {
      properties: { sheetId: sid, gridProperties: { frozenRowCount: 3 } },
      fields: 'gridProperties.frozenRowCount',
    } },
  ];

  // Data rows formatting (only if there is data)
  if (totalRows > 3) {
    // Base data style: padding via vertical middle, font Inter
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: {
        textFormat: { foregroundColor: TEXT_DARK, fontSize: 10, fontFamily: 'Inter' },
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'CLIP',
      } },
      fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)',
    } });
    // Banding (zebra)
    requests.push({ addBanding: {
      bandedRange: {
        range: { sheetId: sid, startRowIndex: 2, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: COLS },
        rowProperties: {
          headerColor: BRAND_DARK,
          firstBandColor: { red: 1, green: 1, blue: 1 },
          secondBandColor: BAND_ALT,
        },
      },
    } });
    // Currency column (H = index 7)
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 7, endColumnIndex: 8 },
      cell: { userEnteredFormat: {
        numberFormat: { type: 'NUMBER', pattern: '#,##0.00' },
        horizontalAlignment: 'RIGHT',
        textFormat: { bold: true, fontSize: 10, fontFamily: 'Inter', foregroundColor: TEXT_DARK },
      } },
      fields: 'userEnteredFormat(numberFormat,horizontalAlignment,textFormat)',
    } });
    // Date column E (index 4)
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 4, endColumnIndex: 5 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd.mm.yyyy' }, horizontalAlignment: 'CENTER' } },
      fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
    } });
    // Time column F (index 5)
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 5, endColumnIndex: 6 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
      fields: 'userEnteredFormat(horizontalAlignment)',
    } });
    // Status & Payment center (J=9, K=10)
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 9, endColumnIndex: 11 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { fontSize: 10, fontFamily: 'Inter', bold: true, foregroundColor: TEXT_DARK } } },
      fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
    } });
    // Currency code I (8) center
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 8, endColumnIndex: 9 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
      fields: 'userEnteredFormat(horizontalAlignment)',
    } });
    // Conditional formatting on status column (J = index 9)
    const statusRange = { sheetId: sid, startRowIndex: 3, endRowIndex: totalRows, startColumnIndex: 9, endColumnIndex: 10 };
    const cf = (text: string, bg: any, fg: any) => ({
      addConditionalFormatRule: { rule: {
        ranges: [statusRange],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] },
          format: { backgroundColor: bg, textFormat: { foregroundColor: fg, bold: true } },
        },
      }, index: 0 },
    });
    requests.push(cf('confirmed', { red: 0.85, green: 0.95, blue: 0.85 }, { red: 0.10, green: 0.40, blue: 0.15 }));
    requests.push(cf('completed', { red: 0.82, green: 0.92, blue: 1.0 },  { red: 0.10, green: 0.30, blue: 0.55 }));
    requests.push(cf('pending',   { red: 1.0,  green: 0.95, blue: 0.78 }, { red: 0.55, green: 0.40, blue: 0.05 }));
    requests.push(cf('cancelled', { red: 1.0,  green: 0.85, blue: 0.85 }, { red: 0.60, green: 0.10, blue: 0.10 }));
    requests.push(cf('rescheduled',{ red: 0.92, green: 0.88, blue: 1.0 }, { red: 0.30, green: 0.20, blue: 0.55 }));
  }

  // Column widths
  const widths: Array<[number, number]> = [
    [0, 230], // ID
    [1, 180], // Name
    [2, 220], // Email
    [3, 140], // Phone
    [4, 110], // Date
    [5, 80],  // Time
    [6, 220], // Service
    [7, 100], // Price
    [8, 80],  // Currency
    [9, 110], // Status
    [10, 110], // Payment
    [11, 160], // Created
  ];
  for (const [idx, w] of widths) {
    requests.push({ updateDimensionProperties: {
      range: { sheetId: sid, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
      properties: { pixelSize: w }, fields: 'pixelSize',
    } });
  }
  // Hide gridlines for premium look
  requests.push({ updateSheetProperties: {
    properties: { sheetId: sid, gridProperties: { hideGridlines: true, frozenRowCount: 3 } },
    fields: 'gridProperties.hideGridlines,gridProperties.frozenRowCount',
  } });

  // Send in chunks – ignore banding error if already exists
  try { await gsBatchUpdate(spreadsheetId, requests); }
  catch (e) {
    // Retry without banding (it errors if a banding already exists on overlapping range)
    const filtered = requests.filter(r => !r.addBanding);
    await gsBatchUpdate(spreadsheetId, filtered);
  }
}

async function formatOverviewSheet(spreadsheetId: string, sid: number, totalRows: number, monthStart: number) {
  const requests: any[] = [
    // Tab color
    { updateSheetProperties: { properties: { sheetId: sid, tabColor: BRAND_GOLD, gridProperties: { hideGridlines: true } }, fields: 'tabColor,gridProperties.hideGridlines' } },
    // Title (row 0) merge A:C
    { mergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 }, mergeType: 'MERGE_ALL' } },
    { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_DARK,
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
        textFormat: { foregroundColor: BRAND_GOLD, bold: true, fontSize: 18, fontFamily: 'Inter' },
      } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    } },
    // Venue name (row 1)
    { mergeCells: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 3 }, mergeType: 'MERGE_ALL' } },
    { repeatCell: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_CREAM,
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
        textFormat: { foregroundColor: TEXT_DARK, bold: true, fontSize: 14, fontFamily: 'Inter' },
      } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    } },
    // Subtitle (row 2)
    { mergeCells: { range: { sheetId: sid, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 3 }, mergeType: 'MERGE_ALL' } },
    { repeatCell: { range: { sheetId: sid, startRowIndex: 2, endRowIndex: 3 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_CREAM,
        horizontalAlignment: 'CENTER',
        textFormat: { foregroundColor: TEXT_DARK, fontSize: 10, fontFamily: 'Inter' },
      } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
    } },
    // KPI block (rows 4-7)
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 4, endRowIndex: 8, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_DARK,
        textFormat: { foregroundColor: BRAND_GOLD, bold: true, fontSize: 11, fontFamily: 'Inter' },
        verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT', padding: { left: 12 },
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,padding)',
    } },
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 4, endRowIndex: 8, startColumnIndex: 1, endColumnIndex: 3 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_CREAM,
        textFormat: { foregroundColor: TEXT_DARK, bold: true, fontSize: 12, fontFamily: 'Inter' },
        verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT', padding: { left: 12 },
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,padding)',
    } },
    { mergeCells: { range: { sheetId: sid, startRowIndex: 4, endRowIndex: 8, startColumnIndex: 1, endColumnIndex: 3 }, mergeType: 'MERGE_ROWS' } },
    // Months header row
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: monthStart - 1, endRowIndex: monthStart, startColumnIndex: 0, endColumnIndex: 3 },
      cell: { userEnteredFormat: {
        backgroundColor: BRAND_DARK,
        textFormat: { foregroundColor: BRAND_GOLD, bold: true, fontSize: 11, fontFamily: 'Inter' },
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
        borders: { bottom: { style: 'SOLID_MEDIUM', color: BRAND_GOLD } },
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
    } },
  ];

  if (totalRows > monthStart) {
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: monthStart, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: 3 },
      cell: { userEnteredFormat: {
        textFormat: { foregroundColor: TEXT_DARK, fontSize: 11, fontFamily: 'Inter' },
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
      } },
      fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
    } });
    requests.push({ addBanding: {
      bandedRange: {
        range: { sheetId: sid, startRowIndex: monthStart - 1, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: 3 },
        rowProperties: {
          headerColor: BRAND_DARK,
          firstBandColor: { red: 1, green: 1, blue: 1 },
          secondBandColor: BAND_ALT,
        },
      },
    } });
  }

  // Row heights
  const rowH: Array<[number, number, number]> = [
    [0, 1, 56], [1, 2, 36], [2, 3, 24], [3, 4, 18],
    [4, 8, 36], [8, 9, 18], [monthStart - 1, monthStart, 32],
  ];
  for (const [s, e, h] of rowH) {
    requests.push({ updateDimensionProperties: {
      range: { sheetId: sid, dimension: 'ROWS', startIndex: s, endIndex: e },
      properties: { pixelSize: h }, fields: 'pixelSize',
    } });
  }
  // Column widths
  const widths: Array<[number, number]> = [[0, 220], [1, 220], [2, 220]];
  for (const [idx, w] of widths) {
    requests.push({ updateDimensionProperties: {
      range: { sheetId: sid, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
      properties: { pixelSize: w }, fields: 'pixelSize',
    } });
  }

  try { await gsBatchUpdate(spreadsheetId, requests); }
  catch (e) {
    const filtered = requests.filter(r => !r.addBanding);
    await gsBatchUpdate(spreadsheetId, filtered);
  }
}

async function syncVenue(supabase: any, sheet: any) {
  const venueTable = sheet.venue_type === 'hotel' ? 'hotels' : 'gyms';
  const { data: venue } = await supabase.from(venueTable).select('name').eq('id', sheet.venue_id).maybeSingle();
  if (!venue) throw new Error('venue not found');

  // Fetch all bookings for this venue
  const col = sheet.venue_type === 'hotel' ? 'hotel_id' : 'gym_id';
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id,customer_name,customer_email,client_phone,booking_date,booking_time,service_name_snapshot,total_amount,currency,status,payment_status,created_at')
    .eq(col, sheet.venue_id)
    .order('booking_date', { ascending: true });
  if (error) throw error;

  // Group by month
  const byMonth = new Map<string, any[]>();
  for (const b of bookings || []) {
    const ym = (b.booking_date as string).slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym)!.push(b);
  }

  // Always ensure current + next 2 months exist
  const today = new Date();
  const ensureMonths = new Set<string>(byMonth.keys());
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    ensureMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Get existing tabs
  const meta = await gsGet(sheet.spreadsheet_id);
  const existingTabs: Record<string, number> = {};
  for (const s of meta.sheets) existingTabs[s.properties.title] = s.properties.sheetId;

  // Add missing month tabs
  const addReqs: any[] = [];
  for (const ym of ensureMonths) {
    const label = monthLabel(ym);
    if (!(label in existingTabs)) {
      addReqs.push({ addSheet: { properties: {
        title: label,
        gridProperties: { frozenRowCount: 3, columnCount: 12 },
        tabColor: BRAND_GOLD,
      } } });
    }
  }
  if (addReqs.length) {
    const res = await gsBatchUpdate(sheet.spreadsheet_id, addReqs);
    for (const r of res.replies || []) {
      if (r.addSheet) existingTabs[r.addSheet.properties.title] = r.addSheet.properties.sheetId;
    }
  }

  // Refresh data per month
  let totalRows = 0;
  for (const ym of ensureMonths) {
    const label = monthLabel(ym);
    const rows = byMonth.get(ym) || [];
    const monthRevenue = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const currency = rows[0]?.currency || 'EUR';
    // Title rows + header
    const values: any[][] = [
      [`MASSAVO · ${venue.name} · ${label}`, '', '', '', '', '', '', '', '', '', '', ''],
      [`Buchungen: ${rows.length}    Umsatz: ${monthRevenue.toFixed(2)} ${currency}    Aktualisiert: ${new Date().toLocaleString('de-DE')}`, '', '', '', '', '', '', '', '', '', '', ''],
      HEADERS_DE,
    ];
    for (const r of rows) {
      values.push([
        r.id, r.customer_name ?? '', r.customer_email ?? '', r.client_phone ?? '',
        r.booking_date, r.booking_time, r.service_name_snapshot ?? '',
        r.total_amount ?? '', r.currency ?? '', r.status ?? '', r.payment_status ?? '',
        r.created_at ?? '',
      ]);
    }
    await gsClear(sheet.spreadsheet_id, `${label}!A:L`);
    await gsPutValues(sheet.spreadsheet_id, `${label}!A1`, values);
    totalRows += rows.length;

    const sid = existingTabs[label];
    if (sid !== undefined) {
      await formatMonthSheet(sheet.spreadsheet_id, sid, values.length);
    }
  }

  // Übersicht (Dashboard)
  const totalRev = (bookings || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const cur = (bookings || [])[0]?.currency || 'EUR';
  const overview: any[][] = [
    [`MASSAVO · Standort-Übersicht`, ''],
    [venue.name, ''],
    [`${sheet.venue_type === 'hotel' ? 'Hotel' : 'Studio'} · Letzter Sync: ${new Date().toLocaleString('de-DE')}`, ''],
    ['', ''],
    ['Standort', venue.name],
    ['Typ', sheet.venue_type === 'hotel' ? 'Hotel' : 'Gym / Studio'],
    ['Buchungen gesamt', totalRows],
    ['Umsatz gesamt', `${totalRev.toFixed(2)} ${cur}`],
    ['', ''],
    ['Monat', 'Buchungen', 'Umsatz'],
  ];
  const monthStart = overview.length; // first month row index (0-based)
  for (const ym of [...ensureMonths].sort()) {
    const mRows = byMonth.get(ym) || [];
    const rev = mRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    overview.push([monthLabel(ym), mRows.length, `${rev.toFixed(2)} ${cur}`]);
  }
  if ('Übersicht' in existingTabs) {
    await gsClear(sheet.spreadsheet_id, 'Übersicht!A:C');
    await gsPutValues(sheet.spreadsheet_id, 'Übersicht!A1', overview);
    await formatOverviewSheet(sheet.spreadsheet_id, existingTabs['Übersicht'], overview.length, monthStart);
  }

  return totalRows;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Internal/admin-only: prevents anonymous callers from triggering costly syncs
  // or reading per-venue booking volume from the response.
  if (!isServiceRoleCall(req) && !(await isAdminCall(req))) {
    return unauthorized(corsHeaders, 403);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    let q = supabase.from('venue_sheets').select('*').eq('is_active', true);
    if (body.venue_id) q = q.eq('venue_id', body.venue_id);
    const { data: sheets, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (let i = 0; i < (sheets?.length || 0); i++) {
      const s = sheets![i];
      if (i > 0) await sleep(2000); // pause between venues to respect 60/min quota
      try {
        const rows = await syncVenue(supabase, s);
        await supabase.from('venue_sheets').update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: 'success',
          last_sync_error: null,
          rows_synced: rows,
        }).eq('id', s.id);
        results.push({ venue_id: s.venue_id, status: 'success', rows });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        await supabase.from('venue_sheets').update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: 'error',
          last_sync_error: msg.slice(0, 500),
        }).eq('id', s.id);
        results.push({ venue_id: s.venue_id, status: 'error', error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});