import type { RawSarabanRecord, SarabanDoc } from '../types/saraban';
import { docToRawRecord, mapRawRecordToDoc, normalizeMemoDocNumbers } from '../utils/sarabanUtils';

export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz_8BWpjt04SLRb0cBx60vkXp1RGT7QVfo7ZQkfW5YrKccQTiGRtf98BGDNv2NZlvqs/exec';

const SCRIPT_URL_STORAGE_KEY = 'esaraban_apps_script_url_v1';
const DOCS_CACHE_KEY = 'esaraban_docs_cache_v1';
const DOCS_BACKUP_KEY = 'esaraban_docs_backup_v1';

export function getConfiguredScriptUrl(): string {
  try {
    const saved = localStorage.getItem(SCRIPT_URL_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return DEFAULT_APPS_SCRIPT_URL;
}

export function setConfiguredScriptUrl(url: string): void {
  const trimmed = url.trim();
  if (
    !trimmed.startsWith('https://script.google.com/macros/s/') ||
    !trimmed.endsWith('/exec')
  ) {
    throw new Error('URL ของ Google Apps Script ต้องขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec');
  }
  localStorage.setItem(SCRIPT_URL_STORAGE_KEY, trimmed);
}

export function resetConfiguredScriptUrl(): void {
  try {
    localStorage.removeItem(SCRIPT_URL_STORAGE_KEY);
  } catch {}
}

export function loadDocsCache(): SarabanDoc[] {
  try {
    const raw = localStorage.getItem(DOCS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { docs?: SarabanDoc[] };
    if (parsed && Array.isArray(parsed.docs)) {
      return normalizeMemoDocNumbers(parsed.docs);
    }
  } catch {}
  return [];
}

export function loadBackupSnapshot(): SarabanDoc[] {
  try {
    const raw = localStorage.getItem(DOCS_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { docs?: SarabanDoc[] };
    if (parsed && Array.isArray(parsed.docs)) {
      return normalizeMemoDocNumbers(parsed.docs);
    }
  } catch {}
  return [];
}

export function saveDocsCache(docs: SarabanDoc[]): void {
  try {
    const payload = JSON.stringify({
      ts: Date.now(),
      docs,
    });
    localStorage.setItem(DOCS_CACHE_KEY, payload);
    if (docs.length > 0) {
      localStorage.setItem(DOCS_BACKUP_KEY, payload);
    }
  } catch {}
}

function isPreviewHost(): boolean {
  const host = String(window.location.hostname || '').toLowerCase();
  return host.endsWith('.run.app') || host === 'localhost' || host === '127.0.0.1';
}

function getDriveEndpoints(queryString = '', overrideUrl?: string): { url: string; useProxyHeader: boolean }[] {
  const scriptUrl = (overrideUrl || getConfiguredScriptUrl()).trim();
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

  const timer = setTimeout(() => controller.abort(new Error('การเชื่อมต่อใช้เวลานานเกินกำหนด')), timeoutMs);

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

interface CompactListResponse {
  status: string;
  message?: string;
  format?: string;
  headers?: string[];
  rows?: unknown[][];
  data?: RawSarabanRecord[];
}

function parseDriveListPayload(result: CompactListResponse): SarabanDoc[] {
  if (result.format === 'compact' && Array.isArray(result.headers) && Array.isArray(result.rows)) {
    const headers = result.headers;
    const docs = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((key, idx) => {
        if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
          obj[key] = row[idx];
        }
      });
      return mapRawRecordToDoc(obj as unknown as RawSarabanRecord);
    });
    return normalizeMemoDocNumbers(docs);
  }
  const allRows = Array.isArray(result.data) ? result.data : [];
  return normalizeMemoDocNumbers(allRows.map(mapRawRecordToDoc));
}

export async function fetchDocumentsFromDrive(
  signal?: AbortSignal,
  overrideUrl?: string
): Promise<SarabanDoc[]> {
  const scriptUrl = (overrideUrl || getConfiguredScriptUrl()).trim();
  const endpoints = getDriveEndpoints(`action=list&mode=compact&_t=${Date.now()}`, scriptUrl);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const headers: Record<string, string> = {};
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = scriptUrl;
      }
      const response = await fetchWithTimeout(
        endpoint.url,
        { method: 'GET', headers, signal },
        14000
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const parsed = JSON.parse(text) as CompactListResponse;
      if (!parsed || parsed.status !== 'success') {
        throw new Error(parsed?.message || 'ไม่สามารถดึงข้อมูลจาก Google Drive ได้');
      }
      const docs = parseDriveListPayload(parsed);
      if (!overrideUrl && docs.length === 0 && scriptUrl !== DEFAULT_APPS_SCRIPT_URL) {
        const defaultDocs = await fetchDocumentsFromDrive(signal, DEFAULT_APPS_SCRIPT_URL);
        if (defaultDocs.length > 0) {
          resetConfiguredScriptUrl();
          return defaultDocs;
        }
      }
      return docs;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถเชื่อมต่อ Google Drive ได้');
}

export async function callDriveApi<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
  overrideUrl?: string
): Promise<T & { status: string; message?: string; fileUrl?: string }> {
  const scriptUrl = (overrideUrl || getConfiguredScriptUrl()).trim();
  const endpoints = getDriveEndpoints('', scriptUrl);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8',
      };
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = scriptUrl;
      }

      const response = await fetchWithTimeout(
        endpoint.url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        30000
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const result = JSON.parse(text) as T & { status: string; message?: string; fileUrl?: string };
      if (!result || result.status !== 'success') {
        throw new Error(result?.message || 'ไม่สามารถดำเนินการกับ Google Drive ได้');
      }
      return result;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถดำเนินการกับ Google Drive ได้');
}

export async function pingAppsScript(urlToTest: string): Promise<{
  status: string;
  message?: string;
  sheetName?: string;
  rowCount?: number;
  folderName?: string;
  folderId?: string;
}> {
  const trimmed = urlToTest.trim();
  const endpoints = getDriveEndpoints(`action=ping&_t=${Date.now()}`, trimmed);
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const headers: Record<string, string> = {};
      if (endpoint.useProxyHeader) {
        headers['x-apps-script-url'] = trimmed;
      }
      const response = await fetchWithTimeout(endpoint.url, { method: 'GET', headers }, 12000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        status: string;
        message?: string;
        sheetName?: string;
        rowCount?: number;
        folderName?: string;
        folderId?: string;
      };
      if (data.status !== 'success') {
        throw new Error(data.message || 'ไม่สามารถทดสอบการเชื่อมต่อได้');
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('ทดสอบการเชื่อมต่อไม่สำเร็จ');
}

export async function syncDocumentsToSheet(
  sourceDocs: SarabanDoc[],
  targetUrl: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ inserted: number; skipped: number; totalSource: number }> {
  const cleanUrl = targetUrl.trim();
  if (
    !cleanUrl.startsWith('https://script.google.com/macros/s/') ||
    !cleanUrl.endsWith('/exec')
  ) {
    throw new Error('URL ของ Google Apps Script ต้องขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec');
  }

  let docsToSync = sourceDocs;
  if (docsToSync.length === 0) {
    docsToSync = loadBackupSnapshot();
  }
  if (docsToSync.length === 0) {
    docsToSync = await fetchDocumentsFromDrive(undefined, DEFAULT_APPS_SCRIPT_URL);
  }
  if (docsToSync.length === 0) {
    return { inserted: 0, skipped: 0, totalSource: 0 };
  }

  const existingDocs = await fetchDocumentsFromDrive(undefined, cleanUrl);
  const existingIds = new Set(existingDocs.map((d) => String(d.id)));
  const missingDocs = docsToSync.filter((d) => !existingIds.has(String(d.id)));
  const skipped = docsToSync.length - missingDocs.length;

  if (missingDocs.length === 0) {
    return { inserted: 0, skipped, totalSource: docsToSync.length };
  }

  const rawRecords = missingDocs.map(docToRawRecord);
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < rawRecords.length; i += BATCH_SIZE) {
    const chunk = rawRecords.slice(i, i + BATCH_SIZE);
    await callDriveApi(
      {
        action: 'insertBatch',
        records: chunk,
      },
      cleanUrl
    );
    inserted += chunk.length;
    onProgress?.(inserted, rawRecords.length);
  }

  return { inserted, skipped, totalSource: docsToSync.length };
}
