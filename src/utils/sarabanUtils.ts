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

export function getTodayISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-') return '-';
  let parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) {
    parts = String(dateStr).split('/');
  }
  if (parts.length === 3) {
    let year = parseInt(parts[0], 10);
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    if (!Number.isNaN(year)) {
      if (year < 2400) year += 543;
      return `${day}-${month}-${year}`;
    }
  }
  return String(dateStr);
}

export function formatThaiDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function mapRawRecordToDoc(d: RawSarabanRecord): SarabanDoc {
  return {
    id: d.id,
    type: d.type || '',
    regNo: d.reg_no ?? '-',
    yearStr: String(d.year_str || ''),
    centralRegNo: d.central_reg_no ?? '-',
    receiveDate: d.receive_date ?? '-',
    sender: d.sender || '',
    urgency: d.urgency || 'ปกติ',
    docNumber: d.doc_number || '',
    docDate: d.doc_date || '',
    subject: d.subject || '',
    status: d.status || '',
    assignee: d.assignee || '',
    dueDate: d.due_date || '',
    ackStatus: d.ack_status || 'รอรับทราบ',
    ackTime: d.ack_time || '-',
    fileName: d.file_name || '',
    fileData: d.file_url || '',
    memoWork: d.memo_work || '',
    formCode: d.form_code || '',
    formName: d.form_name || '',
    voucherDate: d.voucher_date || '',
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
  const value = String(dateValue).trim();
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let year: number;
  let month: number;
  let day: number;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!match) return Date.parse(value) || 0;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }
  if (year > 2400) year -= 543;
  return Date.UTC(year, month - 1, day);
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
  return Boolean(
    doc.dueDate &&
      doc.dueDate !== '-' &&
      doc.dueDate < todayISO &&
      doc.status !== 'ดำเนินการแล้ว' &&
      doc.status !== 'เสร็จสิ้น'
  );
}

export function excelDateToISOString(excelDate: unknown): string {
  if (!excelDate) return getTodayISO();
  if (typeof excelDate === 'string' && excelDate.includes('-')) {
    const parts = excelDate.split('-');
    let y = parseInt(parts[0], 10);
    if (!Number.isNaN(y) && y > 2400) {
      y -= 543;
      return `${y}-${parts[1]}-${parts[2]}`;
    }
    return excelDate;
  }
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
      ['วันที่ลงรับ', (d) => d.receiveDate],
      ['เลขที่หนังสือ', (d) => d.docNumber],
      ['ลงวันที่', (d) => d.docDate],
      ['เรื่อง', (d) => d.subject],
      ['ผู้ส่ง', (d) => d.sender],
      ['ความเร่งด่วน', (d) => d.urgency],
      ['สถานะ', (d) => d.status],
    ],
    outgoing: [
      ['เลขที่หนังสือส่ง', (d) => d.docNumber],
      ['ลงวันที่', (d) => d.docDate],
      ['เรื่อง', (d) => d.subject],
      ['ผู้รับ', (d) => d.sender],
      ['สถานะ', (d) => d.status],
    ],
    orders: [
      ['เลขที่คำสั่ง', (d) => d.docNumber],
      ['ลงวันที่', (d) => d.docDate],
      ['เรื่อง', (d) => d.subject],
      ['สถานะ', (d) => d.status],
    ],
    memos: [
      ['งาน', (d) => d.memoWork],
      ['เลขที่บันทึก', (d) => d.docNumber],
      ['ลงวันที่', (d) => d.docDate],
      ['เรียน', (d) => d.sender],
      ['เรื่อง', (d) => d.subject],
      ['สถานะ', (d) => d.status],
    ],
    vouchers: [
      ['วันที่จัดทำ', (d) => d.voucherDate],
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
