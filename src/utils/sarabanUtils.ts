import * as XLSX from 'xlsx';
import type { DocType, RawSarabanRecord, SarabanDoc } from '../types/saraban';
import { BASE_YEARS, DOC_TYPE_META, WORKFLOW_STATUSES } from '../types/saraban';

export const CURRENT_YEAR_FILTER_KEY = '__CURRENT__';

export function getCurrentFiscalYear(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value || date.getFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value || date.getMonth() + 1);
  return String(year + 543 + (month >= 10 ? 1 : 0));
}

export function getCurrentBuddhistYear(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(date);
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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  if (!rows || rows.length === 0) {
    throw new Error('ไม่พบข้อมูลภายในไฟล์ Excel ที่เลือก');
  }

  let nextIncomingRegNo = getNextRegNoForYear(existingDocs, 'incoming', selectedYearStr);

  return rows.map((row, idx) => {
    const newId = Date.now() + idx;
    const rec: RawSarabanRecord = {
      id: newId,
      type: importType,
      year_str: selectedYearStr,
      status: 'ลงรับแล้ว',
      assignee: 'นิศาชล คงดี',
      due_date: '',
      ack_status: 'รอรับทราบ',
      ack_time: '-',
      file_name: '',
      file_url: '',
    };

    if (importType === 'incoming') {
      rec.reg_no = nextIncomingRegNo++;
      rec.central_reg_no = String(row['เลขรับส่วนกลาง'] || row['central_reg_no'] || '-');
      rec.receive_date = excelDateToISOString(row['วันที่ลงรับ'] || row['receive_date']);
      rec.doc_number = String(row['เลขที่หนังสือ'] || row['doc_number'] || '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.subject = String(row['เรื่อง'] || row['subject'] || 'ไม่มีชื่อเรื่อง');
      rec.sender = String(row['ผู้ส่ง'] || row['sender'] || '-');
      rec.urgency = String(row['ความเร่งด่วน'] || row['urgency'] || 'ปกติ');
    } else if (importType === 'outgoing') {
      rec.reg_no = '-';
      rec.doc_number = String(row['เลขที่หนังสือส่ง'] || row['doc_number'] || '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.subject = String(row['เรื่อง'] || row['subject'] || 'ไม่มีชื่อเรื่อง');
      rec.sender = String(row['ผู้รับ'] || row['sender'] || '-');
      rec.status = String(row['สถานะ'] || row['status'] || 'ออกเอกสาร');
    } else if (importType === 'orders') {
      rec.reg_no = '-';
      rec.doc_number = String(row['เลขที่คำสั่ง'] || row['doc_number'] || '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.subject = String(row['เรื่อง'] || row['subject'] || 'ไม่มีชื่อเรื่อง');
      rec.status = String(row['สถานะ'] || row['status'] || 'ออกเอกสาร');
    } else if (importType === 'memos') {
      rec.reg_no = '-';
      rec.memo_work = String(row['งาน'] || row['memo_work'] || 'งานสารบรรณ');
      rec.doc_number = String(row['เลขที่บันทึก'] || row['doc_number'] || '-');
      rec.doc_date = excelDateToISOString(row['ลงวันที่'] || row['doc_date']);
      rec.sender = String(row['เรียน'] || row['sender'] || '-');
      rec.subject = String(row['เรื่อง'] || row['subject'] || 'ไม่มีชื่อเรื่อง');
      rec.status = String(row['สถานะ'] || row['status'] || 'ออกเอกสาร');
    } else if (importType === 'vouchers') {
      rec.reg_no = '-';
      rec.voucher_date = excelDateToISOString(row['วันที่จัดทำ'] || row['voucher_date']);
      rec.voucher_maker = String(row['ผู้จัดทำ'] || row['voucher_maker'] || '-');
      rec.voucher_no = String(row['เลขที่ผู้เบิก'] || row['voucher_no'] || '-');
      rec.voucher_category = String(row['ประเภทฎีกา'] || row['voucher_category'] || '-');
      rec.voucher_payee = String(row['ผู้รับเงิน'] || row['voucher_payee'] || '-');
      rec.voucher_amount = parseFloat(String(row['จำนวนเงิน'] || row['voucher_amount'] || 0)) || 0;
      rec.voucher_project = String(row['ชื่อโครงการ'] || row['voucher_project'] || '-');
    }

    return rec;
  });
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
