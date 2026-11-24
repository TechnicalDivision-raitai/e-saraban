import { getTodayISO, normalizeDateToISO } from '../utils/sarabanUtils';
import type {
  QueueStatusChangeEvent,
  SarabanAttachmentMeta,
  SarabanQueueStatus,
} from './projectSyncApi';
import { inferMimeTypeFromFileName } from './projectSyncApi';

export const PROCUREMENT_SYNC_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxSQAaWvVcrjEEnYUFnX3A8t4DBKS1m5fdfFZ8y7qJK1b75urBE7Dlcxi_OZEuYzT3m/exec';

const PROCUREMENT_SYNC_HISTORY_KEY = 'esaraban_procurement_sync_history_v1';
const PROCUREMENT_SYNC_REVISION_KEY = 'esaraban_procurement_sync_revisions_v1';
const DELETED_PROCUREMENT_QUEUES_KEY = 'esaraban_deleted_procurement_queues_v1';

export type ProcurementDocCategory =
  | 'general_approval'
  | 'tor_order'
  | 'tor_approval'
  | 'ref_price'
  | 'disbursement';

export interface ProcurementCategoryMeta {
  value: ProcurementDocCategory;
  label: string;
  hint: string;
}

export const PROCUREMENT_DOC_CATEGORIES: ProcurementCategoryMeta[] = [
  {
    value: 'general_approval',
    label: '1. ขออนุมัติโครงการ (general_approval)',
    hint: 'เชื่อมโยงขั้นตอนการขออนุมัติโครงการ ส่งเลขที่บันทึก วันที่ขออนุมัติ ไฟล์แนบ และผู้รับผิดชอบ (ช่องที่เว้นว่างจะไม่ทับข้อมูลเดิม)',
  },
  {
    value: 'tor_order',
    label: '2. คำสั่งแต่งตั้งผู้รับผิดชอบ TOR และราคากลาง',
    hint: 'ส่งเลขที่คำสั่ง วันที่คำสั่ง ผู้รับผิดชอบ/กรรมการ และหมายเหตุ (ช่องที่เว้นว่างจะยึดตามระบบปลายทาง)',
  },
  {
    value: 'tor_approval',
    label: '3. จัดทำ TOR และราคากลาง',
    hint: 'ส่งวงเงินราคากลาง ชื่อผู้จัดทำ TOR และรายละเอียดเพิ่มเติม (ช่องที่เว้นว่างจะยึดตามระบบปลายทาง)',
  },
  {
    value: 'disbursement',
    label: '4. ฎีกาเบิกจ่ายเงิน',
    hint: 'ส่งงวดที่ จำนวนเงิน สถานะเบิกจ่าย และเลขที่ฎีกา (ช่องที่เว้นว่างจะยึดตามระบบปลายทาง)',
  },
];

export function getProcurementCategoryLabel(category?: string): string {
  if (category === 'ref_price') {
    return '3. จัดทำ TOR และราคากลาง';
  }
  return (
    PROCUREMENT_DOC_CATEGORIES.find((c) => c.value === category)?.label ||
    category ||
    '1. ขออนุมัติโครงการ (general_approval)'
  );
}

export interface ProcurementOption {
  id: string;
  projectCode: string;
  fiscalYear: number;
  name: string;
  status: string;
  statusLabel: string;
  method: string;
  budget: number;
  responsibleName?: string;
  startDate?: string;
  approvalDocNo?: string;
  budgetPoolId?: string;
  budgetPoolName?: string;
  planName?: string;
  workName?: string;
  budgetType?: string;
  expenseCategory?: string;
  expenseSubCategory?: string;
}

export interface ProcurementSyncCategoryFields {
  // general_approval
  approvalDate?: string;
  responsibleName?: string;
  notes?: string;
  // tor_order
  orderNo?: string;
  orderDate?: string;
  assigneeName?: string;
  // tor_approval
  refPrice?: string;
  torAuthor?: string;
  details?: string;
  // disbursement
  installment?: string;
  amount?: string;
  status?: '' | 'pending' | 'paid';
  voucherNo?: string;
}

export interface ProcurementSyncSelection {
  enabled: boolean;
  fiscalYearFilter: string;
  procurement: ProcurementOption | null;
  docCategory: ProcurementDocCategory;
  fields: ProcurementSyncCategoryFields;
}

export interface ProcurementQueuePushInput {
  docId: string | number;
  procurement: ProcurementOption;
  docCategory: ProcurementDocCategory;
  fields: ProcurementSyncCategoryFields;
  bookNo: string;
  bookDate: string;
  subject: string;
  attachment: SarabanAttachmentMeta | null;
  submittedBy: string;
  idempotencyRevision?: number;
}

export interface ProcurementQueuePushResponse {
  status: 'success' | 'error';
  queueId?: string;
  queueStatus?: string;
  duplicated?: boolean;
  message?: string;
  idempotencyKey?: string;
}

export interface ProcurementRemoteQueueItem {
  queueId: string;
  idempotencyKey: string;
  procurementId: string;
  projectCode: string;
  fiscalYear?: number;
  docCategory: ProcurementDocCategory | string;
  bookNo?: string;
  bookDate?: string;
  subject?: string;
  queueStatus: SarabanQueueStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  createdAt?: string;
  submittedBy?: string;
}

export interface ProcurementQueueFetchResult {
  pendingCount: number;
  items: ProcurementRemoteQueueItem[];
}

export interface SarabanProcurementSyncRecord {
  docId: string;
  queueId: string;
  idempotencyKey?: string;
  queueStatus: SarabanQueueStatus;
  procurementId: string;
  projectCode: string;
  procurementName: string;
  fiscalYear: number;
  docCategory: ProcurementDocCategory;
  bookNo: string;
  syncedAt: string;
  duplicated?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  lastCheckedAt?: string;
}

const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getProcurementDisplayCode(projectCode?: string, procurementId?: string): string {
  const code = String(projectCode || '').trim();
  if (code && code !== '-') return code;
  const id = String(procurementId || '').trim();
  if (id && !UUID_LIKE_RE.test(id) && id.length <= 20) return id;
  return '';
}

export function formatProcurementDisplayTitle(params: {
  name: string;
  projectCode?: string;
  procurementId?: string;
  statusLabel?: string;
  fiscalYear?: number;
}): string {
  const code = getProcurementDisplayCode(params.projectCode, params.procurementId);
  const statusPart = params.statusLabel?.trim() ? ` (${params.statusLabel.trim()})` : '';
  const yearPart =
    params.fiscalYear && params.fiscalYear > 0 ? ` · ปีงบฯ ${params.fiscalYear}` : '';
  const prefix = code ? `[${code}] ` : '';
  return `${prefix}${params.name}${statusPart}${yearPart}`;
}

function isPreviewHost(): boolean {
  const host = String(window.location.hostname || '').toLowerCase();
  return host.endsWith('.run.app') || host === 'localhost' || host === '127.0.0.1';
}

function getEndpoints(queryString = ''): { url: string; useProxyHeader: boolean }[] {
  const scriptUrl = PROCUREMENT_SYNC_SCRIPT_URL;
  const sep = scriptUrl.includes('?') ? '&' : '?';
  const directUrl = queryString ? `${scriptUrl}${sep}${queryString}` : scriptUrl;
  const proxyParams = new URLSearchParams(queryString);
  proxyParams.set('_scriptUrl', scriptUrl);
  const proxyUrl = `/api/drive-proxy?${proxyParams.toString()}`;

  if (isPreviewHost()) {
    return [
      { url: directUrl, useProxyHeader: false },
      { url: proxyUrl, useProxyHeader: true },
    ];
  }
  return [{ url: directUrl, useProxyHeader: false }];
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = options.signal;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), {
        once: true,
      });
    }
  }

  const timer = setTimeout(
    () => controller.abort(new Error('การเชื่อมต่อระบบงานจัดซื้อจัดจ้างใช้เวลานานเกินกำหนด')),
    timeoutMs
  );

  try {
    const isRelative = url.startsWith('/');
    return await fetch(url, {
      ...options,
      credentials: isRelative ? 'same-origin' : 'omit',
      mode: isRelative ? 'same-origin' : 'cors',
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeProcurementOption(raw: Record<string, unknown>): ProcurementOption | null {
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;

  const projectCode = String(raw.projectCode || raw.code || '-').trim();
  const rawFiscal = Number(raw.fiscalYear);
  const inferredYear =
    Number.isFinite(rawFiscal) && rawFiscal > 2500
      ? rawFiscal
      : /^25\d{2}$/.test(projectCode)
      ? Number(projectCode)
      : Number(rawFiscal) || 0;

  return {
    id,
    projectCode,
    fiscalYear: inferredYear,
    name,
    status: String(raw.status || '').trim(),
    statusLabel: String(raw.statusLabel || raw.status || '').trim(),
    method: String(raw.method || '').trim(),
    budget: Number(raw.budget || 0) || 0,
    responsibleName: String(raw.responsibleName || '').trim() || undefined,
    startDate: String(raw.startDate || '').trim() || undefined,
    approvalDocNo: String(raw.approvalDocNo || '').trim() || undefined,
    budgetPoolId: String(raw.budgetPoolId || '').trim() || undefined,
    budgetPoolName: String(raw.budgetPoolName || '').trim() || undefined,
    planName: String(raw.planName || '').trim() || undefined,
    workName: String(raw.workName || '').trim() || undefined,
    budgetType: String(raw.budgetType || '').trim() || undefined,
    expenseCategory: String(raw.expenseCategory || '').trim() || undefined,
    expenseSubCategory: String(raw.expenseSubCategory || '').trim() || undefined,
  };
}

export async function fetchProcurementOptions(
  fiscalYear = 'all',
  signal?: AbortSignal
): Promise<ProcurementOption[]> {
  const cleanFiscal = fiscalYear && fiscalYear.trim() ? fiscalYear.trim() : 'all';
  const query = `action=getProcurementOptions&fiscalYear=${encodeURIComponent(cleanFiscal)}&t=${Date.now()}`;
  const endpoints = getEndpoints(query);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const fetchInit: RequestInit = endpoint.useProxyHeader
        ? {
            method: 'GET',
            headers: { 'x-apps-script-url': PROCUREMENT_SYNC_SCRIPT_URL },
            redirect: 'follow',
            signal,
          }
        : {
            method: 'GET',
            redirect: 'follow',
            signal,
          };

      const response = await fetchWithTimeout(endpoint.url, fetchInit, 15000);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const parsed = JSON.parse(text) as {
        status?: string;
        message?: string;
        data?: Record<string, unknown>[];
      };
      if (!parsed || parsed.status !== 'success' || !Array.isArray(parsed.data)) {
        throw new Error(parsed?.message || 'ไม่สามารถโหลดรายชื่อโครงการจัดซื้อจัดจ้างได้');
      }
      return parsed.data
        .map(normalizeProcurementOption)
        .filter((item): item is ProcurementOption => item !== null);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถโหลดรายชื่อโครงการจากระบบงานจัดซื้อจัดจ้างได้ กรุณาลองใหม่อีกครั้ง');
}

function toISOCEDate(value?: string): string {
  if (!value || !String(value).trim() || String(value).trim() === '-') return '';
  return normalizeDateToISO(value);
}

function cleanOptionalText(value?: string): string {
  const trimmed = String(value || '').trim();
  return trimmed && trimmed !== '-' ? trimmed : '';
}

function parseOptionalPositiveNumber(value?: string): number | undefined {
  const trimmed = String(value ?? '').trim().replace(/,/g, '');
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function parseOptionalPositiveInt(value?: string): number | undefined {
  const num = parseOptionalPositiveNumber(value);
  if (num === undefined) return undefined;
  const rounded = Math.round(num);
  return rounded >= 1 ? rounded : undefined;
}

export function buildProcurementCategoryPayload(
  docCategory: ProcurementDocCategory,
  fields: ProcurementSyncCategoryFields
): Record<string, unknown> {
  switch (docCategory) {
    case 'general_approval': {
      const approvalDate = toISOCEDate(fields.approvalDate);
      const responsibleName = cleanOptionalText(fields.responsibleName);
      const notes = cleanOptionalText(fields.notes);
      return {
        ...(approvalDate ? { approvalDate } : {}),
        ...(responsibleName ? { responsibleName } : {}),
        ...(notes ? { notes } : {}),
      };
    }
    case 'tor_order': {
      const orderNo = cleanOptionalText(fields.orderNo);
      const orderDate = toISOCEDate(fields.orderDate);
      const assigneeName = cleanOptionalText(fields.assigneeName);
      const notes = cleanOptionalText(fields.notes);
      return {
        ...(orderNo ? { orderNo } : {}),
        ...(orderDate ? { orderDate } : {}),
        ...(assigneeName ? { assigneeName } : {}),
        ...(notes ? { notes } : {}),
      };
    }
    case 'tor_approval':
    case 'ref_price': {
      const refPrice = parseOptionalPositiveNumber(fields.refPrice);
      const torAuthor = cleanOptionalText(fields.torAuthor);
      const details = cleanOptionalText(fields.details);
      return {
        ...(refPrice !== undefined ? { refPrice } : {}),
        ...(torAuthor ? { torAuthor } : {}),
        ...(details ? { details } : {}),
      };
    }
    case 'disbursement': {
      const installment = parseOptionalPositiveInt(fields.installment);
      const amount = parseOptionalPositiveNumber(fields.amount);
      const status = fields.status === 'pending' || fields.status === 'paid' ? fields.status : '';
      const voucherNo = cleanOptionalText(fields.voucherNo);
      return {
        ...(installment !== undefined ? { installment } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(voucherNo ? { voucherNo } : {}),
        ...(status ? { status } : {}),
      };
    }
  }
}

export function validateProcurementSyncSelection(
  selection: ProcurementSyncSelection
): string | null {
  if (!selection.enabled) return null;
  if (!selection.procurement) {
    return 'กรุณาเลือกโครงการจัดซื้อจัดจ้างที่ต้องการเชื่อมโยง';
  }
  return null;
}

export function buildProcurementIdempotencyKey(
  docId: string | number,
  docCategory: ProcurementDocCategory | string,
  revision?: number,
  timestamp?: number
): string {
  const rev = revision && revision > 0 ? revision : 0;
  const ts = typeof timestamp === 'number' && timestamp > 0 ? timestamp : Date.now();
  return `${String(docId)}:${docCategory}:r${rev}:${ts}`;
}

export async function pushProcurementQueue(
  input: ProcurementQueuePushInput
): Promise<ProcurementQueuePushResponse> {
  const normalizedCategory: ProcurementDocCategory =
    input.docCategory === 'ref_price' ? 'tor_approval' : input.docCategory;
  const fiscalYearNum = Number(input.procurement.fiscalYear) || 0;
  const idempotencyKey = buildProcurementIdempotencyKey(
    input.docId,
    normalizedCategory,
    input.idempotencyRevision,
    Date.now()
  );

  const outgoingBookNo =
    normalizedCategory === 'tor_order'
      ? cleanOptionalText(input.fields.orderNo) || cleanOptionalText(input.bookNo)
      : normalizedCategory === 'disbursement'
      ? cleanOptionalText(input.fields.voucherNo) || cleanOptionalText(input.bookNo)
      : cleanOptionalText(input.bookNo);

  const outgoingBookDate =
    normalizedCategory === 'general_approval'
      ? toISOCEDate(input.fields.approvalDate) || toISOCEDate(input.bookDate) || getTodayISO()
      : normalizedCategory === 'tor_order'
      ? toISOCEDate(input.fields.orderDate) || toISOCEDate(input.bookDate) || getTodayISO()
      : toISOCEDate(input.bookDate) || getTodayISO();

  const outgoingSubject = cleanOptionalText(input.subject);

  const requestBody = {
    action: 'pushProcurementQueue',
    idempotencyKey,
    procurementId: input.procurement.id,
    projectCode: input.procurement.projectCode,
    fiscalYear: fiscalYearNum,
    docCategory: normalizedCategory,
    bookNo: outgoingBookNo,
    bookDate: outgoingBookDate,
    subject: outgoingSubject,
    payload: buildProcurementCategoryPayload(normalizedCategory, input.fields),
    attachment: input.attachment
      ? {
          fileName: input.attachment.fileName,
          fileUrl: input.attachment.fileUrl,
          ...(typeof input.attachment.fileSize === 'number' && input.attachment.fileSize > 0
            ? { fileSize: input.attachment.fileSize }
            : {}),
          mimeType:
            input.attachment.mimeType || inferMimeTypeFromFileName(input.attachment.fileName),
        }
      : null,
    submittedBy: cleanOptionalText(input.submittedBy) || 'เจ้าหน้าที่สารบรรณ',
  };

  const endpoints = getEndpoints('');
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8',
      };
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = PROCUREMENT_SYNC_SCRIPT_URL;
      }

      const response = await fetchWithTimeout(
        endpoint.url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          redirect: 'follow',
        },
        30000
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const parsed = JSON.parse(text) as ProcurementQueuePushResponse;
      if (!parsed || parsed.status !== 'success') {
        throw new Error(parsed?.message || 'ส่งข้อมูลเข้าคิวระบบจัดซื้อจัดจ้างไม่สำเร็จ');
      }
      return { ...parsed, idempotencyKey: parsed.idempotencyKey || idempotencyKey };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถส่งข้อมูลไปยังระบบงานจัดซื้อจัดจ้างได้ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่');
}

export function loadProcurementSyncMap(): Record<string, SarabanProcurementSyncRecord> {
  try {
    const raw = localStorage.getItem(PROCUREMENT_SYNC_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SarabanProcurementSyncRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistProcurementSyncMap(
  map: Record<string, SarabanProcurementSyncRecord>
): void {
  try {
    localStorage.setItem(PROCUREMENT_SYNC_HISTORY_KEY, JSON.stringify(map));
  } catch {}
}

export function saveProcurementSyncRecord(
  record: SarabanProcurementSyncRecord
): Record<string, SarabanProcurementSyncRecord> {
  const current = loadProcurementSyncMap();
  const next = {
    ...current,
    [String(record.docId)]: record,
  };
  persistProcurementSyncMap(next);
  return next;
}

export function removeProcurementSyncRecord(
  docId: string | number
): Record<string, SarabanProcurementSyncRecord> {
  const current = loadProcurementSyncMap();
  const key = String(docId);
  if (!(key in current)) return current;
  const next = { ...current };
  delete next[key];
  persistProcurementSyncMap(next);
  return next;
}

export function getProcurementSyncRevision(docId: string | number): number {
  try {
    const raw = localStorage.getItem(PROCUREMENT_SYNC_REVISION_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    const val = Number(map?.[String(docId)] || 0);
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function incrementProcurementSyncRevision(docId: string | number): number {
  const nextVal = getProcurementSyncRevision(docId) + 1;
  try {
    const raw = localStorage.getItem(PROCUREMENT_SYNC_REVISION_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[String(docId)] = nextVal;
    localStorage.setItem(PROCUREMENT_SYNC_REVISION_KEY, JSON.stringify(map));
  } catch {}
  return nextVal;
}

function getDeletedProcurementQueueSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROCUREMENT_QUEUES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown[];
    return new Set(
      Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : []
    );
  } catch {
    return new Set();
  }
}

export function markProcurementQueueAsDeleted(record: SarabanProcurementSyncRecord): void {
  try {
    const set = getDeletedProcurementQueueSet();
    if (record.queueId?.trim()) set.add(record.queueId.trim());
    if (record.idempotencyKey?.trim()) set.add(record.idempotencyKey.trim());
    localStorage.setItem(DELETED_PROCUREMENT_QUEUES_KEY, JSON.stringify([...set].slice(-200)));
  } catch {}
}

export async function deleteProcurementQueue(record: SarabanProcurementSyncRecord): Promise<{
  remoteDeleted: boolean;
  remoteUnsupported: boolean;
  message?: string;
}> {
  const rev = getProcurementSyncRevision(record.docId);
  const idempotencyKey =
    record.idempotencyKey ||
    buildProcurementIdempotencyKey(record.docId, record.docCategory, rev);

  const requestBody = {
    action: 'deleteProcurementQueue',
    queueId: record.queueId,
    idempotencyKey,
    docId: record.docId,
    docCategory: record.docCategory,
    procurementId: record.procurementId,
  };

  const endpoints = getEndpoints('');
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8',
      };
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = PROCUREMENT_SYNC_SCRIPT_URL;
      }

      const response = await fetchWithTimeout(
        endpoint.url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          redirect: 'follow',
        },
        20000
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const parsed = JSON.parse(text) as { status?: string; message?: string };
      if (parsed?.status === 'success') {
        return { remoteDeleted: true, remoteUnsupported: false, message: parsed.message };
      }

      const msg = String(parsed?.message || '');
      if (msg.toLowerCase().includes('unknown') && msg.toLowerCase().includes('action')) {
        return { remoteDeleted: false, remoteUnsupported: true, message: msg };
      }

      throw new Error(msg || 'ไม่สามารถลบคิวจากระบบงานจัดซื้อจัดจ้างได้');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถเชื่อมต่อระบบงานจัดซื้อจัดจ้างเพื่อลบคิวได้');
}

export async function fetchProcurementQueueStatuses(
  signal?: AbortSignal
): Promise<ProcurementQueueFetchResult> {
  const query = `action=getProcurementQueue&queueStatus=all&t=${Date.now()}`;
  const endpoints = getEndpoints(query);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const fetchInit: RequestInit = endpoint.useProxyHeader
        ? {
            method: 'GET',
            headers: { 'x-apps-script-url': PROCUREMENT_SYNC_SCRIPT_URL },
            redirect: 'follow',
            signal,
          }
        : {
            method: 'GET',
            redirect: 'follow',
            signal,
          };

      const response = await fetchWithTimeout(endpoint.url, fetchInit, 20000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const parsed = JSON.parse(text) as {
        status?: string;
        message?: string;
        pendingCount?: number;
        data?: Record<string, unknown>[];
      };

      if (!parsed || parsed.status !== 'success' || !Array.isArray(parsed.data)) {
        throw new Error(parsed?.message || 'ไม่สามารถดึงสถานะคิวจากระบบจัดซื้อจัดจ้างได้');
      }

      const items: ProcurementRemoteQueueItem[] = parsed.data
        .map((raw): ProcurementRemoteQueueItem | null => {
          const queueId = String(raw.queueId || '').trim();
          const idempotencyKey = String(raw.idempotencyKey || '').trim();
          if (!queueId && !idempotencyKey) return null;
          return {
            queueId,
            idempotencyKey,
            procurementId: String(raw.procurementId || raw.projectId || '').trim(),
            projectCode: String(raw.projectCode || '').trim(),
            fiscalYear: Number(raw.fiscalYear) || undefined,
            docCategory: String(raw.docCategory || 'general_approval').trim(),
            bookNo: String(raw.bookNo || '').trim(),
            bookDate: String(raw.bookDate || '').trim(),
            subject: String(raw.subject || '').trim(),
            queueStatus: String(raw.queueStatus || 'pending').trim().toLowerCase(),
            reviewedBy: String(raw.reviewedBy || '').trim(),
            reviewedAt: String(raw.reviewedAt || '').trim(),
            rejectReason: String(raw.rejectReason || '').trim(),
            createdAt: String(raw.createdAt || '').trim(),
            submittedBy: String(raw.submittedBy || '').trim(),
          };
        })
        .filter((x): x is ProcurementRemoteQueueItem => x !== null);

      const pendingCount = Number.isFinite(Number(parsed.pendingCount))
        ? Number(parsed.pendingCount)
        : items.filter((item) => item.queueStatus === 'pending').length;

      return { pendingCount, items };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถตรวจสอบสถานะคิวจากระบบงานจัดซื้อจัดจ้างได้');
}

function parseIdempotencyKey(
  key: string
): { docId: string; docCategory: string; revision: number; timestamp: number } | null {
  const trimmed = String(key || '').trim();
  if (!trimmed) return null;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length < 2 || !parts[0]) return null;
    let revision = 0;
    if (parts[2]) {
      const m = parts[2].match(/^r(\d+)$/i);
      if (m) revision = Number(m[1]) || 0;
    }
    const ts = parts[3] ? Number(parts[3]) || 0 : 0;
    return {
      docId: parts[0],
      docCategory: parts[1],
      revision,
      timestamp: ts,
    };
  }

  const dashMatch = trimmed.match(
    /^(.+?)-(general_approval|tor_order|tor_approval|ref_price|disbursement)(?:-r(\d+))?(?:-(\d+))?$/
  );
  if (dashMatch) {
    return {
      docId: dashMatch[1],
      docCategory: dashMatch[2],
      revision: dashMatch[3] ? Number(dashMatch[3]) || 0 : 0,
      timestamp: dashMatch[4] ? Number(dashMatch[4]) || 0 : 0,
    };
  }

  return null;
}

export function reconcileProcurementSyncMap(
  currentMap: Record<string, SarabanProcurementSyncRecord>,
  remote: ProcurementQueueFetchResult,
  options: {
    existingDocIds?: Set<string>;
    procurementNameById?: Map<string, string>;
    fetchStartedAt?: number;
  } = {}
): {
  nextMap: Record<string, SarabanProcurementSyncRecord>;
  updatedCount: number;
  hydratedCount: number;
  removedCount: number;
  statusChanges: QueueStatusChangeEvent[];
} {
  const deletedSet = getDeletedProcurementQueueSet();
  const nextMap: Record<string, SarabanProcurementSyncRecord> = { ...currentMap };
  const nowIso = new Date().toISOString();
  const matchedOrHydratedDocIds = new Set<string>();

  let updatedCount = 0;
  let hydratedCount = 0;
  let removedCount = 0;
  const statusChanges: QueueStatusChangeEvent[] = [];

  for (const item of remote.items) {
    if (
      (item.queueId && deletedSet.has(item.queueId)) ||
      (item.idempotencyKey && deletedSet.has(item.idempotencyKey))
    ) {
      continue;
    }

    const parsedKey = parseIdempotencyKey(item.idempotencyKey);

    let matchedDocId = Object.keys(nextMap).find((docId) => {
      const rec = nextMap[docId];
      if (!rec) return false;
      if (item.queueId && rec.queueId === item.queueId) return true;
      if (item.idempotencyKey && rec.idempotencyKey && rec.idempotencyKey === item.idempotencyKey) {
        return true;
      }
      return false;
    });

    if (!matchedDocId && parsedKey && nextMap[parsedKey.docId]) {
      const rec = nextMap[parsedKey.docId];
      const currentRev = getProcurementSyncRevision(parsedKey.docId);
      const recParsed = parseIdempotencyKey(rec.idempotencyKey || '');
      const recRev = recParsed ? recParsed.revision : currentRev;
      if (!rec.queueId || parsedKey.revision > recRev || (parsedKey.revision >= currentRev && !rec.idempotencyKey)) {
        matchedDocId = parsedKey.docId;
      }
    }

    if (matchedDocId) {
      matchedOrHydratedDocIds.add(matchedDocId);
      const prev = nextMap[matchedDocId];
      const normalizedStatus = (item.queueStatus || prev.queueStatus || 'pending').toLowerCase();
      const nextReviewedBy = item.reviewedBy || '';
      const nextReviewedAt = item.reviewedAt || '';
      const nextRejectReason = item.rejectReason || '';

      const changed =
        prev.queueStatus !== normalizedStatus ||
        (prev.reviewedBy || '') !== nextReviewedBy ||
        (prev.reviewedAt || '') !== nextReviewedAt ||
        (prev.rejectReason || '') !== nextRejectReason ||
        (!prev.idempotencyKey && Boolean(item.idempotencyKey));

      if (prev.queueStatus !== normalizedStatus) {
        statusChanges.push({
          docId: matchedDocId,
          queueId: item.queueId || prev.queueId,
          fromStatus: prev.queueStatus,
          toStatus: normalizedStatus,
          projectCode: item.projectCode || prev.projectCode || item.procurementId,
          rejectReason: nextRejectReason,
        });
      }

      const resolvedName = options.procurementNameById?.get(item.procurementId);
      const needsNameEnrich = Boolean(
        resolvedName &&
          (!prev.procurementName || prev.procurementName.startsWith('รายการจัดซื้อฯ ')) &&
          prev.procurementName !== resolvedName
      );

      if (changed || needsNameEnrich || !prev.lastCheckedAt) {
        nextMap[matchedDocId] = {
          ...prev,
          queueId: item.queueId || prev.queueId,
          idempotencyKey: item.idempotencyKey || prev.idempotencyKey,
          queueStatus: normalizedStatus,
          projectCode: item.projectCode || prev.projectCode,
          procurementName: resolvedName || prev.procurementName,
          fiscalYear: item.fiscalYear ?? prev.fiscalYear,
          reviewedBy: nextReviewedBy,
          reviewedAt: nextReviewedAt,
          rejectReason: nextRejectReason,
          lastCheckedAt: nowIso,
        };
        if (changed || needsNameEnrich) updatedCount += 1;
      }
    } else if (
      parsedKey &&
      options.existingDocIds &&
      options.existingDocIds.has(parsedKey.docId) &&
      parsedKey.revision >= getProcurementSyncRevision(parsedKey.docId)
    ) {
      matchedOrHydratedDocIds.add(parsedKey.docId);
      const shortCode = getProcurementDisplayCode(item.projectCode, item.procurementId);
      const procurementName =
        options.procurementNameById?.get(item.procurementId) ||
        (shortCode ? `รายการจัดซื้อฯ ${shortCode}` : 'โครงการจัดซื้อจัดจ้าง');

      nextMap[parsedKey.docId] = {
        docId: parsedKey.docId,
        queueId: item.queueId,
        idempotencyKey: item.idempotencyKey,
        queueStatus: (item.queueStatus || 'pending').toLowerCase(),
        procurementId: item.procurementId,
        projectCode: item.projectCode || '-',
        procurementName,
        fiscalYear: item.fiscalYear || 0,
        docCategory: (item.docCategory as ProcurementDocCategory) || 'general_approval',
        bookNo: item.bookNo || '-',
        syncedAt: item.createdAt || nowIso,
        reviewedBy: item.reviewedBy || '',
        reviewedAt: item.reviewedAt || '',
        rejectReason: item.rejectReason || '',
        lastCheckedAt: nowIso,
      };
      hydratedCount += 1;
    }
  }

  for (const docId of Object.keys(nextMap)) {
    if (matchedOrHydratedDocIds.has(docId)) continue;
    const rec = nextMap[docId];
    if (rec && options.fetchStartedAt) {
      const syncedMs = Date.parse(rec.syncedAt || '');
      if (Number.isFinite(syncedMs) && syncedMs > options.fetchStartedAt - 2000) {
        continue;
      }
    }
    delete nextMap[docId];
    removedCount += 1;
  }

  persistProcurementSyncMap(nextMap);

  return {
    nextMap,
    updatedCount,
    hydratedCount,
    removedCount,
    statusChanges,
  };
}

export function getProcurementQueueStatusMeta(queueStatus?: string): {
  status: 'pending' | 'approved' | 'rejected';
  label: string;
  shortLabel: string;
  badgeClass: string;
  bannerClass: string;
  titleTextClass: string;
  subTextClass: string;
} {
  const normalized = String(queueStatus || 'pending').trim().toLowerCase();
  if (normalized === 'approved') {
    return {
      status: 'approved',
      label: 'จัดซื้อฯ รับเข้าโครงการแล้ว',
      shortLabel: 'จัดซื้อฯ รับเข้าโครงการแล้ว',
      badgeClass:
        'border-[#22C55E] bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#14532D] shadow-[0_0_8px_rgba(34,197,94,0.25)]',
      bannerClass: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#14532D]',
      titleTextClass: 'text-[#14532D]',
      subTextClass: 'text-[#166534]',
    };
  }
  if (normalized === 'rejected') {
    return {
      status: 'rejected',
      label: 'ถูกส่งกลับ/ปฏิเสธ',
      shortLabel: 'ถูกส่งกลับ/ปฏิเสธ',
      badgeClass:
        'border-[#EF4444] bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] shadow-[0_0_8px_rgba(239,68,68,0.28)]',
      bannerClass: 'border-[#FCA5A5] bg-[#FEF2F2] text-[#7F1D1D]',
      titleTextClass: 'text-[#7F1D1D]',
      subTextClass: 'text-[#991B1B]',
    };
  }
  return {
    status: 'pending',
    label: 'รอจัดซื้อฯ ตรวจสอบ',
    shortLabel: 'รอจัดซื้อฯ ตรวจสอบ',
    badgeClass:
      'border-[#F59E0B] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#78350F] shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    bannerClass: 'border-[#FCD34D] bg-[#FFFBEB] text-[#78350F]',
    titleTextClass: 'text-[#78350F]',
    subTextClass: 'text-[#92400E]',
  };
}
