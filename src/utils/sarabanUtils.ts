import * as XLSX from 'xlsx';
import type { DocType, RawSarabanRecord, SarabanDoc } from '../types/saraban';
import { BASE_YEARS, DOC_TYPE_META, WORKFLOW_STATUSES } from '../types/saraban';

export const CURRENT_YEAR_FILTER_KEY = '__CURRENT__';

const BANGKOK_YEAR_MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric',
});

const BANGKOK_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
});

const BANGKOK_DATETIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function getCurrentFiscalYear(date = new Date()): string {
  const parts = BANGKOK_YEAR_MONTH_FORMATTER.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value || date.getFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value || date.getMonth() + 1);
  return String(year + 543 + (month >= 10 ? 1 : 0));
}

export function getCurrentBuddhistYear(date = new Date()): string {
  const parts = BANGKOK_YEAR_FORMATTER.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value || date.getFullYear());
  return String(year + 543);
}

export function getCurrentYearForType(typeOrTab: string, date = new Date()): string {
  if (typeOrTab === 'vouchersSummary') {
    return getCurrentFiscalYear(date);
  }
  const meta = DOC_TYPE_META[typeOrTab as DocType];
  if (meta?.yearKind === 'fiscal') {
    return getCurrentFiscalYear(date);
  }
  return getCurrentBuddhistYear(date);
}

export function matchesCurrentYearByType(doc: SarabanDoc, date = new Date()): boolean {
  const meta = DOC_TYPE_META[doc.type as DocType];
  if (meta?.yearKind === 'none') {
    return true;
  }
  return String(doc.yearStr || '').trim() === getCurrentYearForType(doc.type, date);
}

const THAI_MONTH_MAP: Record<string, number> = {
  'ม.ค.': 1,
  'มกราคม': 1,
  'ก.พ.': 2,
  'กุมภาพันธ์': 2,
  'มี.ค.': 3,
  'มีนาคม': 3,
  'เม.ย.': 4,
  'เมษายน': 4,
  'พ.ค.': 5,
  'พฤษภาคม': 5,
  'มิ.ย.': 6,
  'มิถุนายน': 6,
  'ก.ค.': 7,
  'กรกฎาคม': 7,
  'ส.ค.': 8,
  'สิงหาคม': 8,
  'ก.ย.': 9,
  'กันยายน': 9,
  'ต.ค.': 10,
  'ตุลาคม': 10,
  'พ.ย.': 11,
  'พฤศจิกายน': 11,
  'ธ.ค.': 12,
  'ธันวาคม': 12,
};

function getBangkokDateTimeParts(date: Date): {
  year: number;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const parts = BANGKOK_DATETIME_FORMATTER.formatToParts(date);

  return {
    year: Number(parts.find((p) => p.type === 'year')?.value || date.getFullYear()),
    month: parts.find((p) => p.type === 'month')?.value || '01',
    day: parts.find((p) => p.type === 'day')?.value || '01',
    hour: parts.find((p) => p.type === 'hour')?.value || '00',
    minute: parts.find((p) => p.type === 'minute')?.value || '00',
  };
}

function buildValidISO(yearInput: number, monthInput: number, dayInput: number): string {
  let year = yearInput;
  if (year > 2400) year -= 543;
  if (
    Number.isNaN(year) ||
    Number.isNaN(monthInput) ||
    Number.isNaN(dayInput) ||
    year < 1900 ||
    year > 2300 ||
    monthInput < 1 ||
    monthInput > 12 ||
    dayInput < 1 ||
    dayInput > 31
  ) {
    return '';
  }
  return `${String(year).padStart(4, '0')}-${String(monthInput).padStart(2, '0')}-${String(dayInput).padStart(2, '0')}`;
}

export function normalizeDateToISO(value?: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const bkk = getBangkokDateTimeParts(value);
    return buildValidISO(bkk.year, Number(bkk.month), Number(bkk.day));
  }

  const raw = String(value).trim();
  if (!raw || raw === '-') return '';

  // ISO timestamp with time/timezone (e.g. 2026-05-14T17:00:00.000Z from Google Sheets)
  if (/[TZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const bkk = getBangkokDateTimeParts(parsed);
      return buildValidISO(bkk.year, Number(bkk.month), Number(bkk.day));
    }
  }

  // YYYY-MM-DD or YYYY/M/D (with optional time suffix)
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (match) {
    return buildValidISO(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // DD-MM-YYYY or DD/MM/YYYY (with optional time suffix)
  match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (match) {
    return buildValidISO(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  // Thai month string e.g. "15 พ.ย. 2569" or "15 พ.ย. 2569 05:43"
  match = raw.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (match) {
    const monthNum = THAI_MONTH_MAP[match[2]];
    if (monthNum) {
      return buildValidISO(Number(match[3]), monthNum, Number(match[1]));
    }
  }

  return '';
}

export function getTodayISO(): string {
  const bkk = getBangkokDateTimeParts(new Date());
  return `${String(bkk.year).padStart(4, '0')}-${bkk.month}-${bkk.day}`;
}

export function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr || String(dateStr).trim() === '' || String(dateStr).trim() === '-') return '-';
  const iso = normalizeDateToISO(dateStr);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const buddhistYear = Number(match[1]) + 543;
    return `${match[3]}-${match[2]}-${buddhistYear}`;
  }
  return String(dateStr);
}

export function formatThaiDateTime(dateInput: Date | string = new Date()): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '-';
  const bkk = getBangkokDateTimeParts(date);
  const buddhistYear = bkk.year < 2400 ? bkk.year + 543 : bkk.year;
  return `${bkk.day}-${bkk.month}-${buddhistYear} ${bkk.hour}:${bkk.minute}`;
}

export function formatThaiAckDateTime(value?: string | null): string {
  if (!value) return '-';
  const raw = String(value).trim();
  if (!raw || raw === '-') return '-';
  if (raw === 'รับทราบแล้ว') return raw;

  // ISO timestamp with timezone (e.g. 2026-11-14T13:43:00.000Z)
  if (/[TZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatThaiDateTime(parsed);
    }
  }

  // YYYY-MM-DD HH:mm or YYYY/MM/DD HH:mm
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    let year = Number(match[1]);
    if (year < 2400) year += 543;
    return `${match[3].padStart(2, '0')}-${match[2].padStart(2, '0')}-${year} ${match[4].padStart(2, '0')}:${match[5]}`;
  }

  // DD-MM-YYYY HH:mm or DD/MM/YYYY HH:mm
  match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    let year = Number(match[3]);
    if (year < 2400) year += 543;
    return `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}-${year} ${match[4].padStart(2, '0')}:${match[5]}`;
  }

  // Thai short/full month with optional time (e.g. "15 พ.ย. 2569 05:43")
  match = raw.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (match) {
    const monthNum = THAI_MONTH_MAP[match[2]];
    if (monthNum) {
      let year = Number(match[3]);
      if (year < 2400) year += 543;
      const datePart = `${match[1].padStart(2, '0')}-${String(monthNum).padStart(2, '0')}-${year}`;
      if (match[4] && match[5]) {
        return `${datePart} ${match[4].padStart(2, '0')}:${match[5]}`;
      }
      return datePart;
    }
  }

  const isoDateOnly = normalizeDateToISO(raw);
  if (isoDateOnly) {
    return formatThaiDate(isoDateOnly);
  }

  return raw;
}

export function mapRawRecordToDoc(d: RawSarabanRecord): SarabanDoc {
  const normalizedReceiveDate =
    d.receive_date && String(d.receive_date).trim() !== '-'
      ? normalizeDateToISO(d.receive_date) || String(d.receive_date).trim()
      : '-';
  const normalizedDocDate =
    normalizeDateToISO(d.doc_date) ||
    (d.doc_date && String(d.doc_date).trim() !== '-' ? String(d.doc_date).trim() : '');
  const normalizedDueDate =
    normalizeDateToISO(d.due_date) ||
    (d.due_date && String(d.due_date).trim() !== '-' ? String(d.due_date).trim() : '');
  const normalizedVoucherDate =
    normalizeDateToISO(d.voucher_date) ||
    (d.voucher_date && String(d.voucher_date).trim() !== '-' ? String(d.voucher_date).trim() : '');
  const normalizedAckTime =
    d.ack_time && String(d.ack_time).trim() !== '-'
      ? formatThaiAckDateTime(String(d.ack_time))
      : '-';

  return {
    id: d.id,
    type: d.type || '',
    regNo: d.reg_no ?? '-',
    yearStr: String(d.year_str || ''),
    centralRegNo: d.central_reg_no ?? '-',
    receiveDate: normalizedReceiveDate,
    sender: d.sender || '',
    urgency: d.urgency || 'ปกติ',
    docNumber: d.doc_number || '',
    docDate: normalizedDocDate,
    subject: d.subject || '',
    status: d.status || '',
    assignee: d.assignee || '',
    dueDate: normalizedDueDate,
    ackStatus: d.ack_status || 'รอรับทราบ',
    ackTime: normalizedAckTime,
    fileName: d.file_name || '',
    fileData: d.file_url || '',
    memoWork: d.memo_work || '',
    formCode: d.form_code || '',
    formName: d.form_name || '',
    voucherDate: normalizedVoucherDate,
    voucherMaker: d.voucher_maker || '',
    voucherNo: d.voucher_no || '',
    voucherCategory: d.voucher_category || '',
    voucherPayee: d.voucher_payee || '',
    voucherAmount: Number(d.voucher_amount || 0),
    voucherProject: d.voucher_project || '',
  };
}

export function docToRawRecord(doc: SarabanDoc): RawSarabanRecord {
  return {
    id: doc.id,
    type: doc.type || '',
    reg_no: doc.regNo ?? '-',
    year_str: doc.yearStr || '',
    central_reg_no: doc.centralRegNo ?? '-',
    receive_date: doc.receiveDate ?? '-',
    sender: doc.sender || '',
    urgency: doc.urgency || 'ปกติ',
    doc_number: doc.docNumber || '',
    doc_date: doc.docDate || '',
    subject: doc.subject || '',
    status: doc.status || '',
    assignee: doc.assignee || '',
    due_date: doc.dueDate || '',
    ack_status: doc.ackStatus || 'รอรับทราบ',
    ack_time: doc.ackTime || '-',
    file_name: doc.fileName || '',
    file_url: doc.fileData || '',
    memo_work: doc.memoWork || '',
    form_code: doc.formCode || '',
    form_name: doc.formName || '',
    voucher_date: doc.voucherDate || '',
    voucher_maker: doc.voucherMaker || '',
    voucher_no: doc.voucherNo || '',
    voucher_category: doc.voucherCategory || '',
    voucher_payee: doc.voucherPayee || '',
    voucher_amount: Number(doc.voucherAmount || 0),
    voucher_project: doc.voucherProject || '',
  };
}

export function getNextRegNoForYear(docs: SarabanDoc[], type: string, yearStr: string): number {
  const matched = docs.filter((d) => d.type === type && String(d.yearStr) === String(yearStr));
  if (matched.length === 0) return 1;
  const maxNo = Math.max(
    ...matched.map((d) => {
      const num = parseInt(String(d.regNo), 10);
      return Number.isNaN(num) ? 0 : num;
    })
  );
  return maxNo + 1;
}

export const MEMO_DOC_PREFIX = 'อบ 87303';

export function getNextMemoDocNumber(
  docs: SarabanDoc[],
  docDateInput?: string,
  excludeId?: string | number | null
): string {
  const iso = normalizeDateToISO(docDateInput) || getTodayISO();
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const [, yearPart, monthPart, dayPart] = match;
  const dateToken = `${monthPart}-${dayPart}`;
  const prefix = `${MEMO_DOC_PREFIX}/${dateToken}/`;
  const escapedToken = dateToken.replace('-', '\\-');
  const pattern = new RegExp(`^อบ\\s*87303\\/${escapedToken}\\/(\\d+)$`);

  let maxSeq = 0;
  let sameDateCount = 0;

  docs.forEach((d) => {
    if (d.type !== 'memos') return;
    if (excludeId !== undefined && excludeId !== null && String(d.id) === String(excludeId)) {
      return;
    }
    const dIso = normalizeDateToISO(d.docDate);
    const dYear = dIso ? dIso.slice(0, 4) : '';
    const rawNum = String(d.docNumber || '').trim();
    const numMatch = rawNum.match(pattern);

    if (dIso === iso) {
      sameDateCount += 1;
      if (numMatch) {
        const parsed = parseInt(numMatch[1], 10);
        if (!Number.isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    } else if ((!dYear || dYear === yearPart) && numMatch) {
      const parsed = parseInt(numMatch[1], 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });

  const nextSeq = Math.max(maxSeq, sameDateCount) + 1;
  return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

export function normalizeMemoDocNumbers(docs: SarabanDoc[]): SarabanDoc[] {
  const validPattern = /^อบ\s*87303\/(\d{2})-(\d{2})\/(\d+)$/;
  const usedByDate = new Map<string, Set<number>>();

  docs.forEach((d) => {
    if (d.type !== 'memos') return;
    const iso = normalizeDateToISO(d.docDate);
    if (!iso) return;
    const m = String(d.docNumber || '').trim().match(validPattern);
    if (m) {
      const seq = parseInt(m[3], 10);
      if (!Number.isNaN(seq)) {
        if (!usedByDate.has(iso)) usedByDate.set(iso, new Set());
        usedByDate.get(iso)!.add(seq);
      }
    }
  });

  const memoIndices = docs
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => d.type === 'memos')
    .sort((a, b) => Number(a.d.id || 0) - Number(b.d.id || 0));

  const replacements = new Map<number, { docNumber: string; docDate: string }>();

  memoIndices.forEach(({ d, idx }) => {
    const iso = normalizeDateToISO(d.docDate);
    if (!iso) return;
    const [, , mm, dd] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
    if (!mm || !dd) return;

    const trimmed = String(d.docNumber || '').trim();
    const m = trimmed.match(validPattern);
    if (m && m[1] === mm && m[2] === dd) {
      const canonical = `${MEMO_DOC_PREFIX}/${mm}-${dd}/${String(parseInt(m[3], 10)).padStart(2, '0')}`;
      if (canonical !== d.docNumber || iso !== d.docDate) {
        replacements.set(idx, { docNumber: canonical, docDate: iso });
      }
      return;
    }

    if (!usedByDate.has(iso)) usedByDate.set(iso, new Set());
    const usedSet = usedByDate.get(iso)!;
    let seq = 1;
    while (usedSet.has(seq)) {
      seq += 1;
    }
    usedSet.add(seq);
    const formatted = `${MEMO_DOC_PREFIX}/${mm}-${dd}/${String(seq).padStart(2, '0')}`;
    replacements.set(idx, { docNumber: formatted, docDate: iso });
  });

  if (replacements.size === 0) return docs;

  return docs.map((d, idx) => {
    const rep = replacements.get(idx);
    return rep ? { ...d, docNumber: rep.docNumber, docDate: rep.docDate } : d;
  });
}

export function formatRegDisplay(doc: SarabanDoc): string {
  if (doc.regNo !== undefined && doc.regNo !== null && String(doc.regNo) !== '-' && String(doc.regNo) !== '') {
    return doc.yearStr ? `${doc.regNo} - ${doc.yearStr}` : String(doc.regNo);
  }
  return '-';
}

export function getPartyLabel(doc: SarabanDoc): string {
  if (doc.type === 'incoming') return doc.sender ? `ผู้ส่ง: ${doc.sender}` : '';
  if (doc.type === 'outgoing') return doc.sender ? `ผู้รับ: ${doc.sender}` : '';
  if (doc.type === 'vouchers') return doc.voucherPayee ? `ผู้รับเงิน: ${doc.voucherPayee}` : '';
  if (doc.type === 'memos') return doc.sender ? `เรียน: ${doc.sender}` : '';
  return doc.sender ? `ผู้เกี่ยวข้อง: ${doc.sender}` : '';
}

export function getInboxDate(doc: SarabanDoc): string {
  const pick = (...dates: (string | undefined)[]) => dates.find((d) => d && d !== '-') || '';
  if (doc.type === 'incoming') return pick(doc.receiveDate, doc.docDate);
  if (doc.type === 'vouchers') return pick(doc.voucherDate, doc.docDate);
  return pick(doc.docDate, doc.receiveDate, doc.voucherDate);
}

export function getInboxDateSortValue(dateValue?: string): number {
  if (!dateValue || dateValue === '-') return 0;
  const iso = normalizeDateToISO(dateValue);
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  return Date.parse(String(dateValue).trim()) || 0;
}

export function matchesDocumentSearch(doc: SarabanDoc, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase('th-TH');
  if (!query) return true;
  const searchableValues = [
    doc.subject,
    doc.sender,
    doc.voucherPayee,
    doc.voucherMaker,
    doc.docNumber,
    doc.regNo,
    doc.centralRegNo,
    doc.voucherNo,
    doc.voucherCategory,
    doc.formCode,
    doc.formName,
    doc.memoWork,
    doc.voucherProject,
    doc.yearStr,
    doc.assignee,
  ];
  return searchableValues.some((v) => String(v || '').toLocaleLowerCase('th-TH').includes(query));
}

export function getAvailableYears(
  docs: SarabanDoc[],
  includeBase = true,
  anchorYear = getCurrentBuddhistYear()
): string[] {
  const set = new Set<string>(includeBase ? BASE_YEARS : []);
  if (includeBase && anchorYear) {
    set.add(anchorYear);
  }
  docs.forEach((d) => {
    const y = String(d.yearStr || '').trim();
    if (y) set.add(y);
  });

  const anchorNum = Number(anchorYear);
  return [...set].sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (Number.isNaN(numA) || Number.isNaN(numB) || Number.isNaN(anchorNum)) {
      return a.localeCompare(b, 'th');
    }
    if (numA === anchorNum && numB !== anchorNum) return -1;
    if (numB === anchorNum && numA !== anchorNum) return 1;

    const aPast = numA < anchorNum;
    const bPast = numB < anchorNum;
    if (aPast && bPast) return numB - numA;
    if (!aPast && !bPast) return numA - numB;
    return aPast ? -1 : 1;
  });
}

export function normalizeWhitespace(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getUniqueNormalizedSuggestions(values: (string | undefined | null)[]): string[] {
  const seen = new Map<string, string>();
  values.forEach((raw) => {
    const normalized = normalizeWhitespace(raw || '');
    if (!normalized || normalized === '-') return;
    const key = normalized.toLocaleLowerCase('th-TH');
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'th'));
}

export function normalizeDocNumberKey(raw?: string | null): string {
  const cleaned = String(raw || '')
    .replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)))
    .replace(/\s+/g, '')
    .toLocaleLowerCase('th-TH');
  if (!cleaned || cleaned === '-') return '';
  return cleaned;
}

export interface DocNumberDuplicateCheck {
  hasInput: boolean;
  sameYearMatches: SarabanDoc[];
  otherYearMatches: SarabanDoc[];
}

export function findDuplicateDocumentsByNumber(options: {
  documents: SarabanDoc[];
  type: DocType;
  field: 'docNumber' | 'centralRegNo' | 'formCode' | 'voucherNo';
  value: string;
  yearStr?: string;
  excludeId?: string | number | null;
  includeOtherYears?: boolean;
}): DocNumberDuplicateCheck {
  const targetKey = normalizeDocNumberKey(options.value);
  if (!targetKey) {
    return { hasInput: false, sameYearMatches: [], otherYearMatches: [] };
  }

  const meta = DOC_TYPE_META[options.type];
  const checkYear = meta?.yearKind !== 'none';
  const targetYear = String(options.yearStr || '').trim();

  const sameYearMatches: SarabanDoc[] = [];
  const otherYearMatches: SarabanDoc[] = [];

  for (const doc of options.documents) {
    if (doc.type !== options.type) continue;
    if (
      options.excludeId !== null &&
      options.excludeId !== undefined &&
      String(doc.id) === String(options.excludeId)
    ) {
      continue;
    }

    const candidateRaw =
      options.field === 'centralRegNo'
        ? doc.centralRegNo
        : options.field === 'formCode'
          ? doc.formCode
          : options.field === 'voucherNo'
            ? doc.voucherNo
            : doc.docNumber;

    const candidateKey = normalizeDocNumberKey(candidateRaw);
    if (!candidateKey || candidateKey !== targetKey) continue;

    if (!checkYear || !targetYear || !doc.yearStr || String(doc.yearStr).trim() === targetYear) {
      sameYearMatches.push(doc);
    } else if (options.includeOtherYears && targetKey.length >= 4) {
      otherYearMatches.push(doc);
    }
  }

  return {
    hasInput: true,
    sameYearMatches,
    otherYearMatches,
  };
}

export function getOrderedStatuses(docs: SarabanDoc[]): string[] {
  const present = [...new Set(docs.map((d) => String(d.status || '').trim()).filter(Boolean))];
  return [
    ...WORKFLOW_STATUSES.filter((s) => present.includes(s)),
    ...present.filter((s) => !(WORKFLOW_STATUSES as string[]).includes(s)).sort((a, b) => a.localeCompare(b, 'th')),
  ];
}

export function isOverdueDoc(doc: SarabanDoc, todayISO = getTodayISO()): boolean {
  const dueISO = normalizeDateToISO(doc.dueDate);
  return Boolean(
    dueISO &&
      dueISO < todayISO &&
      doc.status !== 'ดำเนินการแล้ว' &&
      doc.status !== 'เสร็จสิ้น'
  );
}

export function excelDateToISOString(excelDate: unknown): string {
  if (!excelDate) return getTodayISO();
  const normalized = normalizeDateToISO(excelDate);
  if (normalized) return normalized;
  const num = parseFloat(String(excelDate));
  if (!Number.isNaN(num)) {
    const utcDays = Math.floor(num - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const year = dateInfo.getUTCFullYear();
    const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateInfo.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return getTodayISO();
}

export const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (GAS Base64 ~33.3 MB ceiling)
const IMAGE_COMPRESS_THRESHOLD_BYTES = 1.2 * 1024 * 1024; // 1.2 MB
const IMAGE_MAX_DIMENSION_PX = 2200;

export function formatFileSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function fileToBase64Data(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
  });
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

async function compressImageIfBeneficial(file: File): Promise<{ file: File; compressed: boolean }> {
  const mime = String(file.type || '').toLowerCase();
  const isCompressibleImage =
    mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png' || mime === 'image/webp';
  if (!isCompressibleImage || file.size <= IMAGE_COMPRESS_THRESHOLD_BYTES) {
    return { file, compressed: false };
  }

  try {
    const img = await loadImageElement(file);
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) {
      return { file, compressed: false };
    }

    const scale = Math.min(1, IMAGE_MAX_DIMENSION_PX / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, compressed: false };

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    let blob = await canvasToJpegBlob(canvas, 0.82);
    if (blob && blob.size > 2 * 1024 * 1024) {
      const smallerBlob = await canvasToJpegBlob(canvas, 0.72);
      if (smallerBlob && smallerBlob.size < blob.size) {
        blob = smallerBlob;
      }
    }

    if (!blob || blob.size >= file.size * 0.92) {
      return { file, compressed: false };
    }

    const nextName = file.name.replace(/\.(png|webp|jpeg|jpg)$/i, '.jpg');
    const compressedFile = new File([blob], nextName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
    return { file: compressedFile, compressed: true };
  } catch {
    return { file, compressed: false };
  }
}

export async function prepareFileForUpload(
  file: File,
  onPhase?: (label: string) => void
): Promise<{
  base64Data: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  originalSize: number;
  compressed: boolean;
}> {
  const originalSize = file.size;
  const mime = String(file.type || '').toLowerCase();
  if (
    (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png' || mime === 'image/webp') &&
    originalSize > IMAGE_COMPRESS_THRESHOLD_BYTES
  ) {
    onPhase?.(`กำลังย่อขนาดรูปภาพ (${formatFileSizeLabel(originalSize)}) เพื่อให้อัปโหลดเร็วขึ้น...`);
  }

  const { file: readyFile, compressed } = await compressImageIfBeneficial(file);

  if (readyFile.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error(
      `ไฟล์มีขนาดใหญ่เกิน 25 MB (ขนาดปัจจุบัน ${formatFileSizeLabel(readyFile.size)}) กรุณาลดขนาดไฟล์ PDF หรืออัปโหลดลง Google Drive แล้วคัดลอกลิงก์แทน`
    );
  }

  const base64Data = await fileToBase64Data(readyFile);
  return {
    base64Data,
    mimeType: readyFile.type || 'application/octet-stream',
    fileName: readyFile.name,
    fileSize: readyFile.size,
    originalSize,
    compressed,
  };
}

export async function parseExcelToImportRecords(
  file: File,
  importType: DocType,
  selectedYearStr: string,
  existingDocs: SarabanDoc[]
): Promise<RawSarabanRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const rows = rawRows.filter((row) =>
    Object.values(row).some((val) => String(val ?? '').trim() !== '')
  );
  if (!rows || rows.length === 0) {
    throw new Error('ไม่พบข้อมูลภายในไฟล์ Excel ที่เลือก');
  }

  let nextIncomingRegNo = getNextRegNoForYear(existingDocs, 'incoming', selectedYearStr);

  const readText = (row: Record<string, unknown>, keys: string[], fallback: string): string => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return fallback;
  };

  return rows.map((row, idx) => {
    const newId = Date.now() + idx;
    const rec: RawSarabanRecord = {
      id: newId,
      type: importType,
      year_str: selectedYearStr,
      status: readText(row, ['สถานะ', 'status'], 'ลงรับแล้ว'),
      assignee: readText(row, ['ผู้รับผิดชอบ', 'assignee'], 'นิศาชล คงดี'),
      due_date: '',
      ack_status: 'รอรับทราบ',
      ack_time: '-',
      file_name: '',
      file_url: '',
    };

    if (importType === 'incoming') {
      rec.reg_no = nextIncomingRegNo++;
      rec.central_reg_no = readText(row, ['เลขรับส่วนกลาง', 'เลขที่รับส่วนกลาง', 'central_reg_no'], '-');
      rec.receive_date = excelDateToISOString(row['วันที่ลงรับ'] || row['receive_date']);
      rec.doc_number = readText(row, ['เลขที่หนังสือ', 'doc_number'], '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.subject = readText(row, ['เรื่อง', 'subject'], 'ไม่มีชื่อเรื่อง');
      rec.sender = readText(row, ['ผู้ส่ง', 'ผู้ส่ง / หน่วยงานต้นสังกัด', 'sender'], '-');
      rec.urgency = readText(row, ['ความเร่งด่วน', 'urgency'], 'ปกติ');
    } else if (importType === 'outgoing') {
      rec.reg_no = '-';
      rec.doc_number = readText(row, ['เลขที่หนังสือส่ง', 'เลขที่หนังสือ', 'doc_number'], '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.subject = readText(row, ['เรื่อง', 'subject'], 'ไม่มีชื่อเรื่อง');
      rec.sender = readText(row, ['ผู้รับ', 'ผู้รับ / หน่วยงานรับ', 'sender'], '-');
      rec.status = readText(row, ['สถานะ', 'status'], 'ออกเอกสาร');
    } else if (importType === 'orders') {
      rec.reg_no = '-';
      rec.doc_number = readText(row, ['เลขที่คำสั่ง', 'doc_number'], '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.subject = readText(row, ['เรื่อง', 'เรื่องคำสั่ง', 'subject'], 'ไม่มีชื่อเรื่อง');
      rec.status = readText(row, ['สถานะ', 'status'], 'ออกเอกสาร');
    } else if (importType === 'memos') {
      rec.reg_no = '-';
      rec.memo_work = readText(row, ['งาน', 'memo_work'], 'งานสารบรรณ');
      rec.doc_number = readText(row, ['เลขที่บันทึก', 'doc_number'], '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.sender = readText(row, ['เรียน', 'sender'], '-');
      rec.subject = readText(row, ['เรื่อง', 'subject'], 'ไม่มีชื่อเรื่อง');
      rec.status = readText(row, ['สถานะ', 'status'], 'ออกเอกสาร');
    } else if (importType === 'vouchers') {
      rec.reg_no = '-';
      rec.voucher_date = excelDateToISOString(row['วันที่จัดทำ'] || row['voucher_date']);
      rec.voucher_maker = readText(row, ['ผู้จัดทำ', 'voucher_maker'], '-');
      rec.voucher_no = readText(row, ['เลขที่ผู้เบิก', 'voucher_no'], '-');
      rec.voucher_category = readText(row, ['ประเภทฎีกา', 'voucher_category'], '-');
      rec.voucher_payee = readText(row, ['ผู้รับเงิน', 'voucher_payee'], '-');
      const rawAmount = String(row['จำนวนเงิน'] ?? row['voucher_amount'] ?? '0').replace(/,/g, '').trim();
      rec.voucher_amount = parseFloat(rawAmount) || 0;
      rec.voucher_project = readText(row, ['ชื่อโครงการ', 'voucher_project'], '-');
    }

    return rec;
  });
}

interface ExcelTemplateSpec {
  fileLabel: string;
  colWidths: number[];
  sampleRows: Record<string, string | number>[];
  guideRows: { คอลัมน์: string; ความจำเป็น: string; คำอธิบายและรูปแบบที่รองรับ: string }[];
}

export function downloadExcelImportTemplate(type: DocType): boolean {
  const currentYear = getCurrentYearForType(type);
  const currentADYear = Number(currentYear) - 543;
  const isoSample1 = `${currentADYear}-10-05`;
  const isoSample2 = `${currentADYear}-10-07`;
  const isoSample3 = `${currentADYear}-10-08`;

  const templates: Partial<Record<DocType, ExcelTemplateSpec>> = {
    incoming: {
      fileLabel: 'หนังสือรับ',
      colWidths: [20, 14, 22, 14, 44, 28, 14, 16, 18],
      sampleRows: [
        {
          เลขรับส่วนกลาง: `รับกลาง-101/${currentYear}`,
          วันที่ลงรับ: isoSample1,
          เลขที่หนังสือ: 'อบ 0023.23/ว 125',
          ลงวันที่: isoSample1,
          เรื่อง: 'ขอความอนุเคราะห์ตรวจสอบสภาพถนน คสล. หมู่ที่ 3',
          ผู้ส่ง: 'อำเภอพิบูลมังสาหาร',
          ความเร่งด่วน: 'ปกติ',
          สถานะ: 'ลงรับแล้ว',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
        {
          เลขรับส่วนกลาง: `รับกลาง-102/${currentYear}`,
          วันที่ลงรับ: isoSample2,
          เลขที่หนังสือ: 'มท 0808.2/ว 450',
          ลงวันที่: isoSample1,
          เรื่อง: 'แจ้งแนวทางปฏิบัติการจัดซื้อจัดจ้างประจำปีงบประมาณ',
          ผู้ส่ง: 'กรมส่งเสริมการปกครองท้องถิ่น',
          ความเร่งด่วน: 'ด่วน',
          สถานะ: 'ลงรับแล้ว',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
      ],
      guideRows: [
        { คอลัมน์: 'เลขรับส่วนกลาง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เลขที่รับจากสำนักปลัด/ส่วนกลาง (เลขรับกองช่างระบบจะรันต่อให้อัตโนมัติ)' },
        { คอลัมน์: 'วันที่ลงรับ', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'รองรับ YYYY-MM-DD (เช่น 2026-10-05), DD/MM/YYYY, วันที่ไทย หรือ Date ใน Excel' },
        { คอลัมน์: 'เลขที่หนังสือ', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เลขที่หนังสือต้นทาง เช่น อบ 0023.23/ว 125' },
        { คอลัมน์: 'ลงวันที่', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'วันที่ลงในหนังสือต้นทาง รูปแบบเดียวกับวันที่ลงรับ' },
        { คอลัมน์: 'เรื่อง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อเรื่องหนังสือ' },
        { คอลัมน์: 'ผู้ส่ง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อหน่วยงานหรือบุคคลต้นสังกัด' },
        { คอลัมน์: 'ความเร่งด่วน', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ปกติ / ด่วน / ด่วนมาก / ด่วนที่สุด (ค่าเริ่มต้น: ปกติ)' },
        { คอลัมน์: 'สถานะ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ลงรับแล้ว / อยู่ระหว่างดำเนินการ / ดำเนินการแล้ว (ค่าเริ่มต้น: ลงรับแล้ว)' },
        { คอลัมน์: 'ผู้รับผิดชอบ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อผู้รับผิดชอบ (ค่าเริ่มต้น: นิศาชล คงดี)' },
      ],
    },
    outgoing: {
      fileLabel: 'หนังสือส่ง',
      colWidths: [20, 14, 46, 32, 16, 18],
      sampleRows: [
        {
          เลขที่หนังสือส่ง: 'อบ 87303/101',
          ลงวันที่: isoSample2,
          เรื่อง: 'ขอความอนุเคราะห์ทดสอบตัวอย่างเหล็กเสริม โครงการถนน คสล.',
          ผู้รับ: 'โยธาธิการและผังเมืองจังหวัดอุบลราชธานี',
          สถานะ: 'ออกเอกสาร',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
        {
          เลขที่หนังสือส่ง: 'อบ 87303/102',
          ลงวันที่: isoSample3,
          เรื่อง: 'ส่งมอบแบบแปลนและประมาณการโครงการซ่อมแซมระบบประปา',
          ผู้รับ: 'นายอำเภอพิบูลมังสาหาร',
          สถานะ: 'ดำเนินการแล้ว',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
      ],
      guideRows: [
        { คอลัมน์: 'เลขที่หนังสือส่ง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เลขที่หนังสือส่ง เช่น อบ 87303/101' },
        { คอลัมน์: 'ลงวันที่', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'รองรับ YYYY-MM-DD, DD/MM/YYYY, วันที่ไทย หรือ Date ใน Excel' },
        { คอลัมน์: 'เรื่อง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อเรื่องหนังสือส่ง' },
        { คอลัมน์: 'ผู้รับ', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อหน่วยงานหรือผู้รับปลายทาง' },
        { คอลัมน์: 'สถานะ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ออกเอกสาร / อยู่ระหว่างดำเนินการ / ดำเนินการแล้ว (ค่าเริ่มต้น: ออกเอกสาร)' },
        { คอลัมน์: 'ผู้รับผิดชอบ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อผู้รับผิดชอบ (ค่าเริ่มต้น: นิศาชล คงดี)' },
      ],
    },
    orders: {
      fileLabel: 'คำสั่ง',
      colWidths: [18, 14, 48, 16, 18],
      sampleRows: [
        {
          เลขที่คำสั่ง: `ที่ 12/${currentYear}`,
          ลงวันที่: isoSample1,
          เรื่อง: 'แต่งตั้งคณะกรรมการกำหนดราคากลางโครงการก่อสร้างถนน คสล.',
          สถานะ: 'ออกเอกสาร',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
        {
          เลขที่คำสั่ง: `ที่ 13/${currentYear}`,
          ลงวันที่: isoSample3,
          เรื่อง: 'แต่งตั้งผู้ควบคุมงานและคณะกรรมการตรวจรับพัสดุ',
          สถานะ: 'ออกเอกสาร',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
      ],
      guideRows: [
        { คอลัมน์: 'เลขที่คำสั่ง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: `เช่น ที่ 12/${currentYear}` },
        { คอลัมน์: 'ลงวันที่', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'รองรับ YYYY-MM-DD, DD/MM/YYYY, วันที่ไทย หรือ Date ใน Excel' },
        { คอลัมน์: 'เรื่อง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อเรื่องคำสั่ง' },
        { คอลัมน์: 'สถานะ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ค่าเริ่มต้น: ออกเอกสาร' },
        { คอลัมน์: 'ผู้รับผิดชอบ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อผู้รับผิดชอบ (ค่าเริ่มต้น: นิศาชล คงดี)' },
      ],
    },
    memos: {
      fileLabel: 'บันทึกข้อความ',
      colWidths: [18, 22, 14, 34, 46, 16, 18],
      sampleRows: [
        {
          งาน: 'งานโยธา',
          เลขที่บันทึก: 'อบ 87303/10-07/01',
          ลงวันที่: isoSample2,
          เรียน: 'นายกองค์การบริหารส่วนตำบลไร่ใต้',
          เรื่อง: 'ขออนุมัติแต่งตั้งคณะกรรมการจัดทำขอบเขตของงาน (TOR)',
          สถานะ: 'ออกเอกสาร',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
        {
          งาน: 'งานไฟฟ้า',
          เลขที่บันทึก: 'อบ 87303/10-08/01',
          ลงวันที่: isoSample3,
          เรียน: 'นายกองค์การบริหารส่วนตำบลไร่ใต้',
          เรื่อง: 'ขออนุมัติจัดซื้อวัสดุไฟฟ้าเพื่อซ่อมแซมไฟฟ้าสาธารณะ',
          สถานะ: 'ออกเอกสาร',
          ผู้รับผิดชอบ: 'นิศาชล คงดี',
        },
      ],
      guideRows: [
        { คอลัมน์: 'งาน', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เช่น งานโยธา, งานไฟฟ้า, งานประปา, งานธุรการ, งานสารบรรณ' },
        { คอลัมน์: 'เลขที่บันทึก', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เช่น อบ 87303/10-07/01' },
        { คอลัมน์: 'ลงวันที่', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'รองรับ YYYY-MM-DD, DD/MM/YYYY, วันที่ไทย หรือ Date ใน Excel' },
        { คอลัมน์: 'เรียน', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เช่น นายกองค์การบริหารส่วนตำบลไร่ใต้' },
        { คอลัมน์: 'เรื่อง', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อเรื่องบันทึกข้อความ' },
        { คอลัมน์: 'สถานะ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ค่าเริ่มต้น: ออกเอกสาร' },
        { คอลัมน์: 'ผู้รับผิดชอบ', ความจำเป็น: 'ไม่บังคับ', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อผู้รับผิดชอบ (ค่าเริ่มต้น: นิศาชล คงดี)' },
      ],
    },
    vouchers: {
      fileLabel: 'ฎีกาเบิกจ่าย',
      colWidths: [14, 18, 20, 18, 28, 16, 44],
      sampleRows: [
        {
          วันที่จัดทำ: isoSample2,
          ผู้จัดทำ: 'นิศาชล คงดี',
          เลขที่ผู้เบิก: `ฎีกาที่ 1/${currentYear}`,
          ประเภทฎีกา: 'ค่าวัสดุก่อสร้าง',
          ผู้รับเงิน: 'หจก.ไร่ใต้การช่าง',
          จำนวนเงิน: 45000,
          ชื่อโครงการ: 'โครงการซ่อมแซมถนนลูกรังภายในตำบล',
        },
        {
          วันที่จัดทำ: isoSample3,
          ผู้จัดทำ: 'นิศาชล คงดี',
          เลขที่ผู้เบิก: `ฎีกาที่ 2/${currentYear}`,
          ประเภทฎีกา: 'ค่าจ้างเหมา',
          ผู้รับเงิน: 'ร้านพิบูลไฟฟ้าและวัสดุ',
          จำนวนเงิน: 28500.5,
          ชื่อโครงการ: 'โครงการซ่อมแซมระบบไฟฟ้าสาธารณะ หมู่ที่ 5',
        },
      ],
      guideRows: [
        { คอลัมน์: 'วันที่จัดทำ', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'รองรับ YYYY-MM-DD, DD/MM/YYYY, วันที่ไทย หรือ Date ใน Excel' },
        { คอลัมน์: 'ผู้จัดทำ', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อผู้จัดทำฎีกา' },
        { คอลัมน์: 'เลขที่ผู้เบิก', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: `เช่น ฎีกาที่ 1/${currentYear}` },
        { คอลัมน์: 'ประเภทฎีกา', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'เช่น ค่าวัสดุก่อสร้าง, ค่าจ้างเหมา, ค่าสาธารณูปโภค' },
        { คอลัมน์: 'ผู้รับเงิน', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อร้านค้า ห้างหุ้นส่วน หรือบุคคลผู้รับเงิน' },
        { คอลัมน์: 'จำนวนเงิน', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ตัวเลขจำนวนเงินขอเบิก (บาท) เช่น 45000 หรือ 28500.50' },
        { คอลัมน์: 'ชื่อโครงการ', ความจำเป็น: 'จำเป็น', คำอธิบายและรูปแบบที่รองรับ: 'ชื่อโครงการหรือรายละเอียดการเบิกจ่าย' },
      ],
    },
  };

  const spec = templates[type];
  if (!spec) return false;

  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.json_to_sheet(spec.sampleRows);
  dataSheet['!cols'] = spec.colWidths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'ข้อมูลนำเข้า');

  const guideRowsWithNote = [
    ...spec.guideRows,
    {
      คอลัมน์: 'หมายเหตุสำคัญ',
      ความจำเป็น: '-',
      คำอธิบายและรูปแบบที่รองรับ:
        'ระบบจะอ่านข้อมูลจากชีตแรก ("ข้อมูลนำเข้า") เท่านั้น กรุณาลบหรือแก้ไขทับแถวตัวอย่าง 2 แถวแรกก่อนอัปโหลดนำเข้าจริง และห้ามเปลี่ยนชื่อหัวคอลัมน์แถวที่ 1',
    },
  ];
  const guideSheet = XLSX.utils.json_to_sheet(guideRowsWithNote);
  guideSheet['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 76 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'คำแนะนำการกรอก');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `แบบฟอร์มนำเข้า_${spec.fileLabel}_${currentYear}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function exportRegisterCSV(docs: SarabanDoc[], type: DocType): boolean {
  const columnsByType: Record<string, [string, (d: SarabanDoc) => unknown][]> = {
    incoming: [
      ['เลขรับกองช่าง', (d) => d.regNo],
      ['เลขรับส่วนกลาง', (d) => d.centralRegNo],
      ['วันที่ลงรับ', (d) => formatThaiDate(d.receiveDate)],
      ['เลขที่หนังสือ', (d) => d.docNumber],
      ['ลงวันที่', (d) => formatThaiDate(d.docDate)],
      ['เรื่อง', (d) => d.subject],
      ['ผู้ส่ง', (d) => d.sender],
      ['ความเร่งด่วน', (d) => d.urgency],
      ['สถานะ', (d) => d.status],
    ],
    outgoing: [
      ['เลขที่หนังสือส่ง', (d) => d.docNumber],
      ['ลงวันที่', (d) => formatThaiDate(d.docDate)],
      ['เรื่อง', (d) => d.subject],
      ['ผู้รับ', (d) => d.sender],
      ['สถานะ', (d) => d.status],
    ],
    orders: [
      ['เลขที่คำสั่ง', (d) => d.docNumber],
      ['ลงวันที่', (d) => formatThaiDate(d.docDate)],
      ['เรื่อง', (d) => d.subject],
      ['สถานะ', (d) => d.status],
    ],
    memos: [
      ['งาน', (d) => d.memoWork],
      ['เลขที่บันทึก', (d) => d.docNumber],
      ['ลงวันที่', (d) => formatThaiDate(d.docDate)],
      ['เรียน', (d) => d.sender],
      ['เรื่อง', (d) => d.subject],
      ['สถานะ', (d) => d.status],
    ],
    vouchers: [
      ['วันที่จัดทำ', (d) => formatThaiDate(d.voucherDate)],
      ['ผู้จัดทำ', (d) => d.voucherMaker],
      ['เลขที่ผู้เบิก', (d) => d.voucherNo],
      ['ประเภทฎีกา', (d) => d.voucherCategory],
      ['ผู้รับเงิน', (d) => d.voucherPayee],
      ['จำนวนเงิน', (d) => d.voucherAmount],
      ['ชื่อโครงการ', (d) => d.voucherProject],
    ],
  };

  const columns = columnsByType[type];
  const filtered = docs.filter((d) => d.type === type);
  if (!columns || filtered.length === 0) return false;

  const escapeCSV = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [
    columns.map(([heading]) => escapeCSV(heading)).join(','),
    ...filtered.map((record) => columns.map(([, getter]) => escapeCSV(getter(record))).join(',')),
  ];
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `saraban_${type}_${getTodayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
