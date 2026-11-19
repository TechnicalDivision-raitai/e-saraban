import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ProcurementDocCategory,
  ProcurementOption,
  ProcurementSyncSelection,
  SarabanProcurementSyncRecord,
} from '../services/procurementSyncApi';
import {
  fetchProcurementOptions,
  formatProcurementDisplayTitle,
  getProcurementCategoryLabel,
  getQueueStatusMeta,
  PROCUREMENT_DOC_CATEGORIES,
} from '../services/procurementSyncApi';
import { BASE_YEARS } from '../types/saraban';
import { formatThaiAckDateTime, getCurrentFiscalYear } from '../utils/sarabanUtils';

interface ProcurementSyncPanelProps {
  value: ProcurementSyncSelection;
  onChange: (next: ProcurementSyncSelection) => void;
  existingSync?: SarabanProcurementSyncRecord | null;
  disabled?: boolean;
  onPushNow?: () => Promise<void>;
  isPushingNow?: boolean;
  pushError?: string;
  onDeleteSyncedQueue?: (record: SarabanProcurementSyncRecord) => Promise<void>;
  isDeletingQueue?: boolean;
  onRefreshQueueStatus?: () => Promise<void>;
  isRefreshingQueueStatus?: boolean;
}

function formatProcurementLabel(item: ProcurementOption): string {
  return formatProcurementDisplayTitle({
    name: item.name,
    projectCode: item.projectCode,
    procurementId: item.id,
    fiscalYear: item.fiscalYear,
  });
}

export function ProcurementSyncPanel({
  value,
  onChange,
  existingSync,
  disabled = false,
  onPushNow,
  isPushingNow = false,
  pushError = '',
  onDeleteSyncedQueue,
  isDeletingQueue = false,
  onRefreshQueueStatus,
  isRefreshingQueueStatus = false,
}: ProcurementSyncPanelProps) {
  const [options, setOptions] = useState<ProcurementOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [allowModifySynced, setAllowModifySynced] = useState(false);
  const [confirmDeleteQueue, setConfirmDeleteQueue] = useState(false);

  useEffect(() => {
    setConfirmDeleteQueue(false);
  }, [existingSync?.queueId]);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fiscalYearChoices = useMemo(() => {
    const currentFY = Number(getCurrentFiscalYear());
    const set = new Set<string>([
      String(currentFY - 1),
      String(currentFY),
      String(currentFY + 1),
      ...BASE_YEARS,
      ...options
        .map((p) => (p.fiscalYear > 0 ? String(p.fiscalYear) : ''))
        .filter(Boolean),
    ]);
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [options]);

  const loadOptions = useCallback(async (fiscalFilter: string) => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoadingOptions(true);
    setLoadError('');

    try {
      const list = await fetchProcurementOptions(fiscalFilter, controller.signal);
      if (controller.signal.aborted) return;
      setOptions(list);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setLoadError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถโหลดรายชื่อรายการจากระบบงานจัดซื้อจัดจ้างได้'
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (!value.enabled) return;
    loadOptions(value.fiscalYearFilter || 'all');
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [value.enabled, value.fiscalYearFilter, loadOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((p) => {
      const text =
        `${p.projectCode} ${p.name} ${p.method} ${p.statusLabel} ${p.fiscalYear || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [options, searchQuery]);

  const selectedCategoryMeta = useMemo(
    () =>
      PROCUREMENT_DOC_CATEGORIES.find((c) => c.value === value.docCategory) ||
      PROCUREMENT_DOC_CATEGORIES[0],
    [value.docCategory]
  );

  const isLockedDuplicate = Boolean(
    existingSync &&
      !allowModifySynced &&
      (!value.procurement || existingSync.procurementId === value.procurement.id) &&
      existingSync.docCategory === value.docCategory
  );

  const updateFields = (patch: Partial<ProcurementSyncSelection['fields']>) => {
    onChange({
      ...value,
      fields: {
        ...value.fields,
        ...patch,
      },
    });
  };

  const existingCategoryLabel = existingSync
    ? getProcurementCategoryLabel(existingSync.docCategory)
    : '';
  const statusMeta = existingSync ? getQueueStatusMeta(existingSync.queueStatus) : null;

  return (
    <div className="p-4 rounded-xl border border-[#99F6E4] bg-[#F0FDFA]/65 space-y-3.5">
      {/* Header & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.enabled}
            disabled={disabled || isPushingNow}
            onChange={(e) =>
              onChange({
                ...value,
                enabled: e.target.checked,
              })
            }
            className="w-4 h-4 rounded border-[#0D9488] text-[#0F766E] focus:ring-[#0F766E]"
          />
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#134E4A]">
            <ShoppingBag className="w-4 h-4 text-[#0F766E]" />
            <span>ส่งเข้าระบบงานจัดซื้อจัดจ้าง (ขออนุมัติ / TOR / ราคากลาง / ฎีกา)</span>
          </span>
        </label>

        {existingSync && statusMeta && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums ${statusMeta.badgeClass}`}
          >
            {statusMeta.status === 'approved' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : statusMeta.status === 'rejected' ? (
              <XCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Clock className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              จัดซื้อฯ · {statusMeta.shortLabel}: {existingSync.queueId}
            </span>
          </span>
        )}
      </div>

      {/* Synced Summary Banner */}
      {existingSync && statusMeta && (
        <div className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${statusMeta.bannerClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="space-y-1 min-w-0 flex-1">
              <div className={`font-bold truncate ${statusMeta.titleTextClass}`}>
                จัดซื้อจัดจ้าง:{' '}
                {formatProcurementDisplayTitle({
                  name: existingSync.procurementName,
                  projectCode: existingSync.projectCode,
                  procurementId: existingSync.procurementId,
                  fiscalYear: existingSync.fiscalYear,
                })}
              </div>
              <div className={`text-[11px] tabular-nums ${statusMeta.subTextClass}`}>
                สถานะ: <span className="font-bold">{statusMeta.label}</span> · หมวด:{' '}
                {existingCategoryLabel}
              </div>
              <div className={`text-[11px] tabular-nums ${statusMeta.subTextClass}`}>
                เลขคิว: {existingSync.queueId} · ส่งเมื่อ{' '}
                {formatThaiAckDateTime(existingSync.syncedAt)}
              </div>
              {(existingSync.reviewedBy || existingSync.reviewedAt) && (
                <div className={`text-[11px] tabular-nums ${statusMeta.subTextClass}`}>
                  ผู้ตรวจสอบ:{' '}
                  <span className="font-semibold">{existingSync.reviewedBy || '-'}</span>
                  {existingSync.reviewedAt
                    ? ` · ตรวจเมื่อ ${formatThaiAckDateTime(existingSync.reviewedAt)}`
                    : ''}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {onRefreshQueueStatus && (
                <button
                  type="button"
                  disabled={disabled || isPushingNow || isDeletingQueue || isRefreshingQueueStatus}
                  onClick={onRefreshQueueStatus}
                  title="ดึงสถานะล่าสุดจากระบบงานจัดซื้อจัดจ้าง"
                  className="px-2.5 py-1.5 rounded-lg border border-[#99F6E4] bg-white hover:bg-[#CCFBF1] text-[#134E4A] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isRefreshingQueueStatus ? 'animate-spin text-[#0F766E]' : ''}`}
                  />
                  <span>{isRefreshingQueueStatus ? 'กำลังเช็ค...' : 'เช็คสถานะล่าสุด'}</span>
                </button>
              )}

              {!allowModifySynced && (
                <button
                  type="button"
                  disabled={disabled || isPushingNow || isDeletingQueue}
                  onClick={() => {
                    setAllowModifySynced(true);
                    if (!value.enabled) {
                      onChange({ ...value, enabled: true });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-current/30 bg-white hover:bg-white/80 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                >
                  {statusMeta.status === 'rejected' ? 'แก้ไขและส่งใหม่' : 'ส่งหมวดหมู่อื่นเพิ่ม'}
                </button>
              )}

              {onDeleteSyncedQueue && !confirmDeleteQueue && (
                <button
                  type="button"
                  disabled={disabled || isPushingNow || isDeletingQueue}
                  onClick={() => setConfirmDeleteQueue(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ลบคิว</span>
                </button>
              )}

              {onDeleteSyncedQueue && confirmDeleteQueue && (
                <div className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-[#FCA5A5]">
                  <span className="text-[11px] font-semibold text-[#991B1B] whitespace-nowrap">
                    ยืนยันลบคิวนี้?
                  </span>
                  <button
                    type="button"
                    disabled={isDeletingQueue}
                    onClick={async () => {
                      await onDeleteSyncedQueue(existingSync);
                      setConfirmDeleteQueue(false);
                      setAllowModifySynced(false);
                    }}
                    className="px-2 py-0.5 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    {isDeletingQueue && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>ยืนยันลบ</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingQueue}
                    onClick={() => setConfirmDeleteQueue(false)}
                    className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold whitespace-nowrap shrink-0"
                  >
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>
          </div>

          {statusMeta.status === 'rejected' && (
            <div className="p-2.5 rounded-lg bg-white/85 border border-[#FCA5A5] text-[#7F1D1D] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
              <div>
                <span className="font-bold">เหตุผลที่ถูกส่งกลับ: </span>
                <span>
                  {existingSync.rejectReason || 'ระบบจัดซื้อจัดจ้างไม่ได้ระบุเหตุผลเพิ่มเติม'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {value.enabled && (
        <div className="space-y-3.5 pt-2 border-t border-[#CCFBF1]">
          {/* Fiscal Year + Searchable Procurement Picker */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-[#134E4A] mb-1">
                ปีงบประมาณจัดซื้อฯ
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={value.fiscalYearFilter || 'all'}
                  disabled={disabled || isPushingNow}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      fiscalYearFilter: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] bg-white text-sm font-semibold text-[#242038] focus:outline-none focus:border-[#0F766E]"
                >
                  <option value="all">ทุกปีงบประมาณ</option>
                  {fiscalYearChoices.map((y) => (
                    <option key={y} value={y}>
                      ปีงบฯ {y}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isLoadingOptions || disabled || isPushingNow}
                  onClick={() => loadOptions(value.fiscalYearFilter || 'all')}
                  title="โหลดรายชื่อรายการจัดซื้อจัดจ้างใหม่"
                  className="p-2 rounded-xl border border-[#99F6E4] bg-white hover:bg-[#CCFBF1] text-[#0F766E] transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingOptions ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="md:col-span-8" ref={dropdownRef}>
              <label className="block text-xs font-bold text-[#134E4A] mb-1">
                เลือกรายการ / โครงการจัดซื้อจัดจ้าง *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#0F766E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  disabled={disabled || isPushingNow}
                  value={
                    dropdownOpen
                      ? searchQuery
                      : value.procurement
                      ? formatProcurementLabel(value.procurement)
                      : searchQuery
                  }
                  onFocus={() => {
                    setDropdownOpen(true);
                    if (value.procurement) {
                      setSearchQuery('');
                    }
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder={
                    isLoadingOptions
                      ? 'กำลังโหลดรายการจัดซื้อจัดจ้าง...'
                      : 'พิมพ์รหัส หรือชื่อรายการจัดซื้อจัดจ้างเพื่อค้นหา...'
                  }
                  className="w-full pl-9 pr-16 py-2 rounded-xl border border-[#99F6E4] bg-white text-sm text-[#242038] focus:outline-none focus:border-[#0F766E]"
                />
                {value.procurement && !dropdownOpen && (
                  <button
                    type="button"
                    disabled={disabled || isPushingNow}
                    onClick={() => {
                      onChange({ ...value, procurement: null });
                      setSearchQuery('');
                      setDropdownOpen(true);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#0F766E] hover:text-[#134E4A] px-1.5 py-0.5 rounded bg-[#CCFBF1]"
                  >
                    เปลี่ยน
                  </button>
                )}

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl border border-[#99F6E4] bg-white shadow-xl saraban-scroll">
                    {isLoadingOptions ? (
                      <div className="p-3 text-xs text-slate-600 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F766E]" />
                        <span>กำลังโหลดรายการจากระบบจัดซื้อจัดจ้าง...</span>
                      </div>
                    ) : loadError ? (
                      <div className="p-3 text-xs text-[#991B1B] bg-[#FEF2F2]">{loadError}</div>
                    ) : options.length === 0 ? (
                      <div className="p-3 text-xs text-amber-800 bg-amber-50">
                        ไม่พบรายการจัดซื้อจัดจ้างตามเงื่อนไขปีงบประมาณที่เลือก
                      </div>
                    ) : filteredOptions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">
                        ไม่พบรายการตามคำค้น หรือปีงบประมาณที่เลือก
                      </div>
                    ) : (
                      filteredOptions.map((item) => {
                        const isChosen = value.procurement?.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onChange({ ...value, procurement: item });
                              setSearchQuery('');
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 text-xs border-b border-[#F0FDFA] last:border-b-0 transition-colors ${
                              isChosen
                                ? 'bg-[#CCFBF1] text-[#134E4A] font-bold'
                                : 'hover:bg-[#F0FDFA] text-slate-800'
                            }`}
                          >
                            <div className="font-semibold text-[#134E4A]">
                              {formatProcurementLabel(item)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                              {item.method && <span>ประเภท: {item.method}</span>}
                              {item.statusLabel && <span>วิธี: {item.statusLabel}</span>}
                              {item.budget > 0 && (
                                <span className="tabular-nums font-semibold text-[#0F766E]">
                                  วงเงิน {item.budget.toLocaleString('th-TH')} บาท
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              {loadError && !dropdownOpen && (
                <p className="text-[11px] text-[#991B1B] mt-1">{loadError}</p>
              )}
            </div>
          </div>

          {/* Document Category */}
          <div>
            <label className="block text-xs font-bold text-[#134E4A] mb-1">
              หมวดหมู่เอกสารในระบบจัดซื้อจัดจ้าง *
            </label>
            <select
              value={value.docCategory}
              disabled={disabled || isPushingNow}
              onChange={(e) =>
                onChange({
                  ...value,
                  docCategory: e.target.value as ProcurementDocCategory,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] bg-white text-sm font-semibold text-[#242038] focus:outline-none focus:border-[#0F766E]"
            >
              {PROCUREMENT_DOC_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#0F766E] mt-1">{selectedCategoryMeta.hint}</p>
          </div>

          {/* Category-Specific Dynamic Subfields (All Optional) */}
          {value.docCategory === 'general_approval' && (
            <div className="p-3 rounded-xl bg-white border border-[#CCFBF1] text-xs text-[#134E4A] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#0F766E]" />
              <div>
                <span className="font-bold">ส่งเฉพาะไฟล์แนบไปยังหน้าข้อมูลทั่วไป: </span>
                <span className="text-slate-600">
                  ระบบจะส่งเฉพาะลิงก์ไฟล์แนบ (ไม่ส่งชื่อเรื่อง เลขหนังสือ หรือข้อความใดๆ)
                  เพื่อไม่ให้กระทบข้อมูลรายการตั้งต้นโครงการในระบบจัดซื้อจัดจ้าง
                </span>
              </div>
            </div>
          )}

          {value.docCategory === 'tor_order' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-white border border-[#CCFBF1]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขที่คำสั่ง
                </label>
                <input
                  type="text"
                  value={value.fields.orderNo || ''}
                  onChange={(e) => updateFields({ orderNo: e.target.value })}
                  placeholder="เว้นว่างหากยึดระบบปลายทาง"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันที่คำสั่ง
                </label>
                <input
                  type="date"
                  value={value.fields.orderDate || ''}
                  onChange={(e) => updateFields({ orderDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้รับผิดชอบ
                </label>
                <input
                  type="text"
                  value={value.fields.assigneeName || ''}
                  onChange={(e) => updateFields({ assigneeName: e.target.value })}
                  placeholder="เว้นว่างหากยึดระบบปลายทาง"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            </div>
          )}

          {(value.docCategory === 'tor_approval' || value.docCategory === 'ref_price') && (
            <div className="p-3 rounded-xl bg-white border border-[#CCFBF1]">
              <div className="max-w-sm">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วงเงินราคากลาง (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={value.fields.refPrice || ''}
                  onChange={(e) => updateFields({ refPrice: e.target.value })}
                  placeholder="เว้นว่างหากยึดระบบปลายทาง"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm tabular-nums focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'disbursement' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-xl bg-white border border-[#CCFBF1]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">งวดที่</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={value.fields.installment || ''}
                  onChange={(e) => updateFields({ installment: e.target.value })}
                  placeholder="เว้นว่างได้"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm tabular-nums focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={value.fields.amount || ''}
                  onChange={(e) => updateFields({ amount: e.target.value })}
                  placeholder="เว้นว่างได้"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm tabular-nums focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สถานะเบิกจ่าย
                </label>
                <select
                  value={value.fields.status || ''}
                  onChange={(e) =>
                    updateFields({ status: e.target.value as '' | 'pending' | 'paid' })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] bg-white text-sm font-semibold focus:outline-none focus:border-[#0F766E]"
                >
                  <option value="">-- ไม่ระบุ (ยึดระบบปลายทาง) --</option>
                  <option value="pending">รอเบิกจ่าย (pending)</option>
                  <option value="paid">จ่ายแล้ว (paid)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขที่ฎีกา
                </label>
                <input
                  type="text"
                  value={value.fields.voucherNo || ''}
                  onChange={(e) => updateFields({ voucherNo: e.target.value })}
                  placeholder="เว้นว่างได้"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            </div>
          )}

          {pushError && (
            <div className="p-3 rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] text-[#7F1D1D] text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{pushError}</span>
            </div>
          )}

          {onPushNow && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-[#0F766E]">
                {isLockedDuplicate
                  ? 'หมวดหมู่นี้ถูกส่งเข้าคิวจัดซื้อจัดจ้างแล้ว ระบบป้องกันการส่งซ้ำอัตโนมัติ'
                  : 'เมื่อกดปุ่ม ระบบจะส่งข้อมูลและลิงก์ไฟล์แนบ (ถ้ามี) ไปยังระบบงานจัดซื้อจัดจ้างทันที'}
              </span>
              <button
                type="button"
                disabled={disabled || isPushingNow || isLockedDuplicate}
                onClick={onPushNow}
                className="px-4 py-2 rounded-xl bg-[#0F766E] hover:bg-[#115E59] border border-[#115E59] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-55 whitespace-nowrap shrink-0"
              >
                {isPushingNow ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังส่งเข้าระบบจัดซื้อฯ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ส่งซิงค์เข้าระบบจัดซื้อจัดจ้าง</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
