import { getTodayISO, normalizeDateToISO } from '../utils/sarabanUtils';

export const PROJECT_SYNC_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzzWSWjjgNcPJ69Rvacq6uGZPE36RAO-JCpqwC6favyCPKjEpmNIjqjz7uEgdS6SGf5/exec';

const PROJECT_SYNC_HISTORY_KEY = 'esaraban_project_sync_history_v1';
const PROJECT_SYNC_REVISION_KEY = 'esaraban_project_sync_revisions_v1';
const DELETED_PROJECT_QUEUES_KEY = 'esaraban_deleted_project_queues_v1';

export type ProjectDocCategory =
  | 'project_approval'
  | 'tor_order'
  | 'tor_approval'
  | 'ref_price'
  | 'inspect_order'
  | 'contract'
  | 'work_notice'
  | 'delivery'
  | 'inspection'
  | 'disbursement'
  | 'remuneration'
  | 'other';

export interface ProjectCategoryMeta {
  value: ProjectDocCategory;
  label: string;
  hint: string;
}

export const PROJECT_DOC_CATEGORIES: ProjectCategoryMeta[] = [
  {
    value: 'project_approval',
    label: 'หนังสือขออนุมัติโครงการ (ขั้นตอนที่ 1)',
    hint: 'ส่งเลขที่หนังสือ ลงวันที่ และไฟล์แนบ ไปลงช่องหนังสือขออนุมัติโครงการในแท็บที่ 1 ให้อัตโนมัติ (ไม่ต้องกรอกฟิลด์เพิ่ม)',
  },
  {
    value: 'tor_order',
    label: 'คำสั่งแต่งตั้ง กก. TOR / ราคากลาง',
    hint: 'ระบุผู้รับผิดชอบหรือหมายเหตุเพิ่มเติมได้ (ไม่บังคับ)',
  },
  {
    value: 'tor_approval',
    label: 'ขออนุมัติ / จัดทำ TOR',
    hint: 'ระบุชื่อผู้จัดทำ TOR เพื่อส่งเข้าระบบโครงการ',
  },
  {
    value: 'ref_price',
    label: 'ขออนุมัติราคากลาง',
    hint: 'ระบุวงเงินราคากลาง (บาท)',
  },
  {
    value: 'inspect_order',
    label: 'คำสั่งแต่งตั้งผู้ควบคุมงาน / กก.ตรวจรับ',
    hint: 'ระบุชื่อผู้ควบคุมงาน',
  },
  {
    value: 'contract',
    label: 'สัญญาจ้าง',
    hint: 'ระบุวงเงินสัญญา ผู้รับจ้าง วันเริ่มสัญญา และวันสิ้นสุดสัญญา',
  },
  {
    value: 'work_notice',
    label: 'หนังสือแจ้งเข้าทำงาน',
    hint: 'ระบุวันที่เข้าทำงานจริง (ถ้ามี) และหมายเหตุ',
  },
  {
    value: 'delivery',
    label: 'หนังสือส่งมอบงาน',
    hint: 'ระบุงวดงาน วันที่ส่งมอบจริง และรายละเอียด',
  },
  {
    value: 'inspection',
    label: 'รายงานผลตรวจรับงาน',
    hint: 'ระบุงวดงาน ผลการตรวจรับ และรายละเอียด',
  },
  {
    value: 'disbursement',
    label: 'ฎีกาเบิกจ่ายเงิน',
    hint: 'ระบุงวดงาน จำนวนเงิน และสถานะการเบิกจ่าย',
  },
  {
    value: 'remuneration',
    label: 'เบิกค่าตอบแทนกรรมการ',
    hint: 'ระบุประเภทกรรมการ รายการค่าตอบแทน และผู้รับเงิน',
  },
  {
    value: 'other',
    label: 'เอกสารอื่นๆ ที่เกี่ยวข้อง',
    hint: 'บันทึกเอกสารประกอบอื่นของโครงการ',
  },
];

export interface ProjectOption {
  id: string;
  projectCode: string;
  fiscalYear: number;
  name: string;
  status: string;
  contractNo: string;
}

export interface ProjectSyncCategoryFields {
  assigneeName?: string;
  torAuthor?: string;
  refPrice?: string;
  supervisorName?: string;
  contractAmount?: string;
  contractorName?: string;
  startDate?: string;
  endDate?: string;
  actualWorkDate?: string;
  installment?: string;
  actualDeliveryDate?: string;
  details?: string;
  result?: 'pass' | 'fail' | 'need_revision';
  amount?: string;
  status?: 'pending' | 'paid';
  remunerationType?: 'tor_author' | 'tor' | 'supervisor' | 'inspection';
  title?: string;
  payeeName?: string;
  notes?: string;
}

export interface ProjectSyncSelection {
  enabled: boolean;
  fiscalYearFilter: string;
  project: ProjectOption | null;
  docCategory: ProjectDocCategory;
  fields: ProjectSyncCategoryFields;
}

export interface SarabanAttachmentMeta {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType: string;
}

export interface SarabanQueuePushInput {
  docId: string | number;
  project: ProjectOption;
  docCategory: ProjectDocCategory;
  fields: ProjectSyncCategoryFields;
  bookNo: string;
  bookDate: string;
  subject: string;
  attachment: SarabanAttachmentMeta | null;
  submittedBy: string;
  idempotencyRevision?: number;
}

export interface SarabanQueuePushResponse {
  status: 'success' | 'error';
  queueId?: string;
  queueStatus?: string;
  duplicated?: boolean;
  message?: string;
  idempotencyKey?: string;
}

export type SarabanQueueStatus = 'pending' | 'approved' | 'rejected' | string;

export interface SarabanRemoteQueueItem {
  queueId: string;
  idempotencyKey: string;
  projectId: string;
  projectCode: string;
  fiscalYear?: number;
  docCategory: ProjectDocCategory | string;
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

export interface SarabanQueueFetchResult {
  pendingCount: number;
  items: SarabanRemoteQueueItem[];
}

export interface SarabanProjectSyncRecord {
  docId: string;
  queueId: string;
  idempotencyKey?: string;
  queueStatus: SarabanQueueStatus;
  projectId: string;
  projectCode: string;
  projectName: string;
  fiscalYear: number;
  docCategory: ProjectDocCategory;
  bookNo: string;
  syncedAt: string;
  duplicated?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  lastCheckedAt?: string;
}

function isPreviewHost(): boolean {
  const host = String(window.location.hostname || '').toLowerCase();
  return host.endsWith('.run.app') || host === 'localhost' || host === '127.0.0.1';
}

function getEndpoints(queryString = ''): { url: string; useProxyHeader: boolean }[] {
  const scriptUrl = PROJECT_SYNC_SCRIPT_URL;
  const sep = scriptUrl.includes('?') ? '&' : '?';
  const directUrl = queryString ? `${scriptUrl}${sep}${queryString}` : scriptUrl;
  const proxyParams = new URLSearchParams(queryString);
  proxyParams.set('_scriptUrl', scriptUrl);
  const proxyUrl = `/api/drive-proxy?${proxyParams.toString()}`;

  if (isPreviewHost()) {
    return [
      { url: proxyUrl, useProxyHeader: true },
      { url: directUrl, useProxyHeader: false },
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
    () => controller.abort(new Error('การเชื่อมต่อระบบงานโครงการใช้เวลานานเกินกำหนด')),
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

export function inferMimeTypeFromFileName(fileName?: string): string {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return 'application/octet-stream';
}

function normalizeProjectOption(raw: Record<string, unknown>): ProjectOption | null {
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;
  const rawFiscal = Number(raw.fiscalYear);
  return {
    id,
    projectCode: String(raw.projectCode || '-').trim(),
    fiscalYear: Number.isFinite(rawFiscal) && rawFiscal > 0 ? rawFiscal : 2569,
    name,
    status: String(raw.status || '').trim(),
    contractNo: String(raw.contractNo || '').trim(),
  };
}

export async function fetchProjectOptions(
  fiscalYear = 'all',
  signal?: AbortSignal
): Promise<ProjectOption[]> {
  const cleanFiscal = fiscalYear && fiscalYear.trim() ? fiscalYear.trim() : 'all';

  const requestAction = async (query: string) => {
    const endpoints = getEndpoints(query);
    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const headers: Record<string, string> = {};
        if (endpoint.useProxyHeader) {
          headers['x-apps-script-url'] = PROJECT_SYNC_SCRIPT_URL;
        }
        const response = await fetchWithTimeout(
          endpoint.url,
          { method: 'GET', headers, redirect: 'follow', signal },
          15000
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        return JSON.parse(text) as {
          status?: string;
          message?: string;
          data?: Record<string, unknown>[];
        };
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('ไม่สามารถโหลดรายชื่อโครงการจากระบบงานโครงการได้');
  };

  const primaryRes = await requestAction(
    `action=getProjectOptions&fiscalYear=${encodeURIComponent(cleanFiscal)}&_t=${Date.now()}`
  );

  if (primaryRes?.status === 'success' && Array.isArray(primaryRes.data)) {
    return primaryRes.data
      .map(normalizeProjectOption)
      .filter((item): item is ProjectOption => item !== null);
  }

  // Fallback gracefully if target GAS deployment only exposes action=getProjects
  if (
    primaryRes?.status === 'error' &&
    String(primaryRes.message || '').toLowerCase().includes('unknown get action')
  ) {
    const fallbackRes = await requestAction(`action=getProjects&_t=${Date.now()}`);
    if (fallbackRes?.status === 'success' && Array.isArray(fallbackRes.data)) {
      const mapped = fallbackRes.data
        .map(normalizeProjectOption)
        .filter((item): item is ProjectOption => item !== null);
      if (cleanFiscal !== 'all') {
        return mapped.filter((p) => String(p.fiscalYear) === cleanFiscal);
      }
      return mapped;
    }
  }

  throw new Error(primaryRes?.message || 'ไม่สามารถโหลดรายชื่อโครงการได้');
}

function toISOCEDate(value?: string): string {
  if (!value || !String(value).trim()) return '';
  return normalizeDateToISO(value);
}

function toPositiveNumber(value?: string, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function buildSarabanCategoryPayload(
  docCategory: ProjectDocCategory,
  fields: ProjectSyncCategoryFields
): Record<string, unknown> {
  switch (docCategory) {
    case 'project_approval':
      return {};
    case 'tor_order':
      return {
        ...(fields.assigneeName?.trim() ? { assigneeName: fields.assigneeName.trim() } : {}),
        ...(fields.notes?.trim() ? { notes: fields.notes.trim() } : {}),
      };
    case 'tor_approval':
      return {
        torAuthor: (fields.torAuthor || '').trim(),
      };
    case 'ref_price':
      return {
        refPrice: toPositiveNumber(fields.refPrice, 0),
      };
    case 'inspect_order':
      return {
        supervisorName: (fields.supervisorName || '').trim(),
      };
    case 'contract':
      return {
        contractAmount: toPositiveNumber(fields.contractAmount, 0),
        contractorName: (fields.contractorName || '').trim(),
        startDate: toISOCEDate(fields.startDate),
        endDate: toISOCEDate(fields.endDate),
      };
    case 'work_notice':
      return {
        ...(toISOCEDate(fields.actualWorkDate)
          ? { actualWorkDate: toISOCEDate(fields.actualWorkDate) }
          : {}),
        notes: (fields.notes || '').trim(),
      };
    case 'delivery':
      return {
        installment: Math.max(1, Math.round(toPositiveNumber(fields.installment, 1)) || 1),
        actualDeliveryDate: toISOCEDate(fields.actualDeliveryDate),
        details: (fields.details || '').trim(),
      };
    case 'inspection':
      return {
        installment: Math.max(1, Math.round(toPositiveNumber(fields.installment, 1)) || 1),
        result: fields.result || 'pass',
        details: (fields.details || '').trim(),
      };
    case 'disbursement':
      return {
        installment: Math.max(1, Math.round(toPositiveNumber(fields.installment, 1)) || 1),
        amount: toPositiveNumber(fields.amount, 0),
        status: fields.status || 'pending',
      };
    case 'remuneration':
      return {
        type: fields.remunerationType || 'inspection',
        title: (fields.title || '').trim(),
        payeeName: (fields.payeeName || '').trim(),
        ...(fields.amount?.trim() ? { amount: toPositiveNumber(fields.amount, 0) } : {}),
      };
    case 'other':
    default:
      return {
        notes: (fields.notes || fields.details || '').trim(),
      };
  }
}

export function validateProjectSyncSelection(selection: ProjectSyncSelection): string | null {
  if (!selection.enabled) return null;
  if (!selection.project) {
    return 'กรุณาเลือกโครงการที่ต้องการเชื่อมโยง';
  }
  const f = selection.fields;
  switch (selection.docCategory) {
    case 'tor_approval':
      if (!f.torAuthor?.trim()) return 'กรุณาระบุชื่อผู้จัดทำ TOR';
      break;
    case 'ref_price':
      if (!f.refPrice || Number(f.refPrice) <= 0) return 'กรุณาระบุวงเงินราคากลาง';
      break;
    case 'inspect_order':
      if (!f.supervisorName?.trim()) return 'กรุณาระบุชื่อผู้ควบคุมงาน';
      break;
    case 'contract':
      if (!f.contractAmount || Number(f.contractAmount) <= 0) return 'กรุณาระบุวงเงินสัญญา';
      if (!f.contractorName?.trim()) return 'กรุณาระบุชื่อผู้รับจ้าง';
      if (!f.startDate) return 'กรุณาระบุวันเริ่มสัญญา';
      if (!f.endDate) return 'กรุณาระบุวันสิ้นสุดสัญญา';
      break;
    case 'delivery':
      if (!f.actualDeliveryDate) return 'กรุณาระบุวันที่ส่งมอบงานจริง';
      break;
    case 'disbursement':
      if (!f.amount || Number(f.amount) <= 0) return 'กรุณาระบุจำนวนเงินเบิกจ่าย';
      break;
    case 'remuneration':
      if (!f.title?.trim()) return 'กรุณาระบุรายการค่าตอบแทน';
      if (!f.payeeName?.trim()) return 'กรุณาระบุชื่อผู้รับเงินค่าตอบแทน';
      break;
    default:
      break;
  }
  return null;
}

export async function pushSarabanQueue(
  input: SarabanQueuePushInput
): Promise<SarabanQueuePushResponse> {
  const isoBookDate = toISOCEDate(input.bookDate) || getTodayISO();
  const fiscalYearNum = Number(input.project.fiscalYear) || 2569;
  const idempotencyKey = buildSarabanIdempotencyKey(
    input.docId,
    input.docCategory,
    input.idempotencyRevision
  );

  const requestBody = {
    action: 'pushSarabanQueue',
    idempotencyKey,
    projectId: input.project.id,
    projectCode: input.project.projectCode,
    fiscalYear: fiscalYearNum,
    docCategory: input.docCategory,
    bookNo: input.bookNo.trim() || '-',
    bookDate: isoBookDate,
    subject: input.subject.trim() || '-',
    payload: buildSarabanCategoryPayload(input.docCategory, input.fields),
    attachment: input.attachment
      ? {
          fileName: input.attachment.fileName,
          fileUrl: input.attachment.fileUrl,
          ...(typeof input.attachment.fileSize === 'number' && input.attachment.fileSize > 0
            ? { fileSize: input.attachment.fileSize }
            : {}),
          mimeType: input.attachment.mimeType || inferMimeTypeFromFileName(input.attachment.fileName),
        }
      : null,
    submittedBy: input.submittedBy.trim() || 'เจ้าหน้าที่สารบรรณ',
  };

  const endpoints = getEndpoints('');
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8',
      };
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = PROJECT_SYNC_SCRIPT_URL;
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
      const parsed = JSON.parse(text) as SarabanQueuePushResponse;
      if (!parsed || parsed.status !== 'success') {
        throw new Error(parsed?.message || 'ส่งข้อมูลเข้าคิวระบบงานโครงการไม่สำเร็จ');
      }
      return { ...parsed, idempotencyKey };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถส่งข้อมูลไปยังระบบงานโครงการได้');
}

export function loadProjectSyncMap(): Record<string, SarabanProjectSyncRecord> {
  try {
    const raw = localStorage.getItem(PROJECT_SYNC_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SarabanProjectSyncRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistProjectSyncMap(map: Record<string, SarabanProjectSyncRecord>): void {
  try {
    localStorage.setItem(PROJECT_SYNC_HISTORY_KEY, JSON.stringify(map));
  } catch {}
}

export function saveProjectSyncRecord(
  record: SarabanProjectSyncRecord
): Record<string, SarabanProjectSyncRecord> {
  const current = loadProjectSyncMap();
  const next = {
    ...current,
    [String(record.docId)]: record,
  };
  persistProjectSyncMap(next);
  return next;
}

export function removeProjectSyncRecord(
  docId: string | number
): Record<string, SarabanProjectSyncRecord> {
  const current = loadProjectSyncMap();
  const key = String(docId);
  if (!(key in current)) return current;
  const next = { ...current };
  delete next[key];
  persistProjectSyncMap(next);
  return next;
}

export function getProjectSyncRevision(docId: string | number): number {
  try {
    const raw = localStorage.getItem(PROJECT_SYNC_REVISION_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    const val = Number(map?.[String(docId)] || 0);
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function incrementProjectSyncRevision(docId: string | number): number {
  const nextVal = getProjectSyncRevision(docId) + 1;
  try {
    const raw = localStorage.getItem(PROJECT_SYNC_REVISION_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[String(docId)] = nextVal;
    localStorage.setItem(PROJECT_SYNC_REVISION_KEY, JSON.stringify(map));
  } catch {}
  return nextVal;
}

export function buildSarabanIdempotencyKey(
  docId: string | number,
  docCategory: ProjectDocCategory | string,
  revision?: number
): string {
  const rev = revision && revision > 0 ? revision : 0;
  return rev > 0
    ? `${String(docId)}:${docCategory}:r${rev}`
    : `${String(docId)}:${docCategory}`;
}

function getDeletedQueueSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROJECT_QUEUES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown[];
    return new Set(
      Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : []
    );
  } catch {
    return new Set();
  }
}

export function markQueueAsDeleted(record: SarabanProjectSyncRecord): void {
  try {
    const set = getDeletedQueueSet();
    if (record.queueId?.trim()) set.add(record.queueId.trim());
    if (record.idempotencyKey?.trim()) set.add(record.idempotencyKey.trim());
    localStorage.setItem(DELETED_PROJECT_QUEUES_KEY, JSON.stringify([...set].slice(-200)));
  } catch {}
}

export async function deleteSarabanQueue(record: SarabanProjectSyncRecord): Promise<{
  remoteDeleted: boolean;
  remoteUnsupported: boolean;
  message?: string;
}> {
  const rev = getProjectSyncRevision(record.docId);
  const idempotencyKey =
    record.idempotencyKey || buildSarabanIdempotencyKey(record.docId, record.docCategory, rev);

  const requestBody = {
    action: 'deleteSarabanQueue',
    queueId: record.queueId,
    idempotencyKey,
    docId: record.docId,
    docCategory: record.docCategory,
    projectId: record.projectId,
  };

  const endpoints = getEndpoints('');
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8',
      };
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = PROJECT_SYNC_SCRIPT_URL;
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

      throw new Error(msg || 'ไม่สามารถลบคิวจากระบบงานโครงการได้');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถเชื่อมต่อระบบงานโครงการเพื่อลบคิวได้');
}

export async function fetchSarabanQueueStatuses(
  signal?: AbortSignal
): Promise<SarabanQueueFetchResult> {
  const query = `action=getSarabanQueue&queueStatus=all&t=${Date.now()}`;
  const endpoints = getEndpoints(query);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const headers: Record<string, string> = {};
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = PROJECT_SYNC_SCRIPT_URL;
      }

      const response = await fetchWithTimeout(
        endpoint.url,
        { method: 'GET', headers, redirect: 'follow', signal },
        20000
      );

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
        throw new Error(parsed?.message || 'ไม่สามารถดึงสถานะคิวจากระบบงานโครงการได้');
      }

      const items: SarabanRemoteQueueItem[] = parsed.data
        .map((raw): SarabanRemoteQueueItem | null => {
          const queueId = String(raw.queueId || '').trim();
          const idempotencyKey = String(raw.idempotencyKey || '').trim();
          if (!queueId && !idempotencyKey) return null;
          return {
            queueId,
            idempotencyKey,
            projectId: String(raw.projectId || '').trim(),
            projectCode: String(raw.projectCode || '').trim(),
            fiscalYear: Number(raw.fiscalYear) || undefined,
            docCategory: String(raw.docCategory || 'other').trim(),
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
        .filter((x): x is SarabanRemoteQueueItem => x !== null);

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
    : new Error('ไม่สามารถตรวจสอบสถานะคิวจากระบบงานโครงการได้');
}

function parseIdempotencyKey(
  key: string
): { docId: string; docCategory: string; revision: number } | null {
  const trimmed = String(key || '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 2 || !parts[0]) return null;
  let revision = 0;
  if (parts[2]) {
    const m = parts[2].match(/^r(\d+)$/i);
    if (m) revision = Number(m[1]) || 0;
  }
  return {
    docId: parts[0],
    docCategory: parts[1],
    revision,
  };
}

export interface QueueStatusChangeEvent {
  docId: string;
  queueId: string;
  fromStatus: string;
  toStatus: string;
  projectCode: string;
  rejectReason?: string;
}

export function reconcileProjectSyncMap(
  currentMap: Record<string, SarabanProjectSyncRecord>,
  remote: SarabanQueueFetchResult,
  options: {
    existingDocIds?: Set<string>;
    projectNameById?: Map<string, string>;
    fetchStartedAt?: number;
  } = {}
): {
  nextMap: Record<string, SarabanProjectSyncRecord>;
  updatedCount: number;
  hydratedCount: number;
  removedCount: number;
  statusChanges: QueueStatusChangeEvent[];
} {
  const deletedSet = getDeletedQueueSet();
  const nextMap: Record<string, SarabanProjectSyncRecord> = { ...currentMap };
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
      const currentRev = getProjectSyncRevision(parsedKey.docId);
      if (!rec.queueId || parsedKey.revision >= currentRev) {
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
          projectCode: item.projectCode || prev.projectCode,
          rejectReason: nextRejectReason,
        });
      }

      const resolvedProjectName = options.projectNameById?.get(item.projectId);
      const needsNameEnrich = Boolean(
        resolvedProjectName &&
          (!prev.projectName || prev.projectName.startsWith('โครงการ ')) &&
          prev.projectName !== resolvedProjectName
      );

      if (changed || needsNameEnrich || !prev.lastCheckedAt) {
        nextMap[matchedDocId] = {
          ...prev,
          queueId: item.queueId || prev.queueId,
          idempotencyKey: item.idempotencyKey || prev.idempotencyKey,
          queueStatus: normalizedStatus,
          projectCode: item.projectCode || prev.projectCode,
          projectName: resolvedProjectName || prev.projectName,
          fiscalYear: item.fiscalYear || prev.fiscalYear,
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
      parsedKey.revision >= getProjectSyncRevision(parsedKey.docId)
    ) {
      matchedOrHydratedDocIds.add(parsedKey.docId);
      const projectName =
        options.projectNameById?.get(item.projectId) ||
        (item.projectCode ? `โครงการ ${item.projectCode}` : 'โครงการกองช่าง');

      nextMap[parsedKey.docId] = {
        docId: parsedKey.docId,
        queueId: item.queueId,
        idempotencyKey: item.idempotencyKey,
        queueStatus: (item.queueStatus || 'pending').toLowerCase(),
        projectId: item.projectId,
        projectCode: item.projectCode || '-',
        projectName,
        fiscalYear: item.fiscalYear || 2569,
        docCategory: (item.docCategory as ProjectDocCategory) || 'other',
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

  persistProjectSyncMap(nextMap);

  return {
    nextMap,
    updatedCount,
    hydratedCount,
    removedCount,
    statusChanges,
  };
}

export function getQueueStatusMeta(queueStatus?: string): {
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
      label: 'โครงการรับข้อมูลแล้ว (Approved)',
      shortLabel: 'โครงการรับแล้ว',
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
      label: 'ถูกส่งกลับ / ปฏิเสธ (Rejected)',
      shortLabel: 'ถูกส่งกลับ',
      badgeClass:
        'border-[#EF4444] bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] shadow-[0_0_8px_rgba(239,68,68,0.28)]',
      bannerClass: 'border-[#FCA5A5] bg-[#FEF2F2] text-[#7F1D1D]',
      titleTextClass: 'text-[#7F1D1D]',
      subTextClass: 'text-[#991B1B]',
    };
  }
  return {
    status: 'pending',
    label: 'รอระบบโครงการตรวจสอบ (Pending)',
    shortLabel: 'รอตรวจรับ',
    badgeClass:
      'border-[#F59E0B] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#78350F] shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    bannerClass: 'border-[#FCD34D] bg-[#FFFBEB] text-[#78350F]',
    titleTextClass: 'text-[#78350F]',
    subTextClass: 'text-[#92400E]',
  };
}
