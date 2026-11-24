import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
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
  getProcurementQueueStatusMeta,
  PROCUREMENT_DOC_CATEGORIES,
} from '../services/procurementSyncApi';
import { BASE_YEARS } from '../types/saraban';
import { formatThaiAckDateTime, formatThaiDate, getCurrentFiscalYear } from '../utils/sarabanUtils';

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
    statusLabel: item.statusLabel,
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

  const loadOptions = useCallback(async () => {
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
      const list = await fetchProcurementOptions('all', controller.signal);
      if (controller.signal.aborted) return;
      setOptions(list);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setLoadError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถโหลดรายชื่อโครงการจากระบบงานจัดซื้อจัดจ้างได้'
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
    loadOptions();
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [value.enabled, loadOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isApprovalCategory = value.docCategory === 'general_approval';

  const yearFilteredOptions = useMemo(() => {
    const fy = String(value.fiscalYearFilter || 'all').trim();
    if (!fy || fy === 'all') return options;
    return options.filter((p) => String(p.fiscalYear || '') === fy);
  }, [options, value.fiscalYearFilter]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = !q
      ? yearFilteredOptions
      : yearFilteredOptions.filter((p) => {
          const text =
            `${p.projectCode} ${p.name} ${p.method} ${p.status} ${p.statusLabel} ${p.responsibleName || ''} ${p.fiscalYear || ''}`.toLowerCase();
          return text.includes(q);
        });

    if (!isApprovalCategory) return matched;

    const waitingApproval: ProcurementOption[] = [];
    const others: ProcurementOption[] = [];
    for (const item of matched) {
      if (item.status === 'waiting_project_approval') {
        waitingApproval.push(item);
      } else {
        others.push(item);
      }
    }
    return [...waitingApproval, ...others];
  }, [yearFilteredOptions, searchQuery, isApprovalCategory]);

  const waitingApprovalCount = useMemo(
    () => filteredOptions.filter((p) => p.status === 'waiting_project_approval').length,
    [filteredOptions]
  );

  const selectedCategoryMeta = useMemo(
    () =>
      PROCUREMENT_DOC_CATEGORIES.find((c) => c.value === value.docCategory) ||
      PROCUREMENT_DOC_CATEGORIES[0],
    [value.docCategory]
  );

  const statusMeta = existingSync ? getProcurementQueueStatusMeta(existingSync.queueStatus) : null;

  const isLockedDuplicate = Boolean(
    existingSync &&
      statusMeta?.status !== 'rejected' &&
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

  const normalizedCategory: ProcurementDocCategory =
    value.docCategory === 'ref_price' ? 'tor_approval' : value.docCategory;

  const renderProcurementOptionItem = (item: ProcurementOption) => {
    const isChosen = value.procurement?.id === item.id;
    const isWaitingApproval = item.status === 'waiting_project_approval';
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
            : isWaitingApproval && isApprovalCategory
            ? 'bg-[#FFFBEB]/65 hover:bg-[#FEF3C7]/75 text-slate-800'
            : 'hover:bg-[#F0FDFA] text-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="font-semibold text-[#134E4A] leading-snug">
            {formatProcurementLabel(item)}
          </span>
          {isWaitingApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#F59E0B] bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              <span>รอขออนุมัติโครงการ</span>
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {item.method && <span>วิธีจัดหา: {item.method}</span>}
          {item.responsibleName && <span>ผู้รับผิดชอบ: {item.responsibleName}</span>}
          {item.approvalDocNo && <span>เลขขออนุมัติเดิม: {item.approvalDocNo}</span>}
          {item.budget > 0 && (
            <span className="tabular-nums font-semibold text-[#0F766E]">
              วงเงิน {item.budget.toLocaleString('th-TH')} บาท
            </span>
          )}
        </div>
      </button>
    );
  };

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
              {statusMeta.shortLabel}: {existingSync.queueId}
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
                    ? ` · เวลา ${formatThaiAckDateTime(existingSync.reviewedAt)}`
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
                  {statusMeta.status === 'rejected' ? 'แก้ไขและส่งเข้าคิวใหม่' : 'ส่งหมวดหมู่อื่นเพิ่ม'}
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
                <span className="font-bold">เหตุผลที่ถูกส่งกลับ/ปฏิเสธ: </span>
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
          {/* Document Category First so selection helps prioritize waiting_project_approval */}
          <div>
            <label className="block text-xs font-bold text-[#134E4A] mb-1">
              หมวดหมู่เอกสารในระบบจัดซื้อจัดจ้าง *
            </label>
            <select
              value={normalizedCategory}
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
                  onClick={() => loadOptions()}
                  title="โหลดรายชื่อโครงการจัดซื้อจัดจ้างใหม่"
                  className="p-2 rounded-xl border border-[#99F6E4] bg-white hover:bg-[#CCFBF1] text-[#0F766E] transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingOptions ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="md:col-span-8" ref={dropdownRef}>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <label className="block text-xs font-bold text-[#134E4A]">
                  เลือกโครงการจัดซื้อจัดจ้าง *
                </label>
                {isApprovalCategory && waitingApprovalCount > 0 && (
                  <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] border border-[#F59E0B] px-2 py-0.5 rounded-full">
                    พบโครงการรอขออนุมัติ {waitingApprovalCount} รายการ (แสดงด้านบนสุด)
                  </span>
                )}
              </div>
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
                      ? 'กำลังโหลดรายชื่อโครงการจัดซื้อจัดจ้าง...'
                      : 'พิมพ์รหัสโครงการ ชื่อโครงการ หรือสถานะเพื่อค้นหา...'
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
                  <div className="absolute left-0 right-0 mt-1.5 z-30 max-h-64 overflow-y-auto rounded-xl border border-[#99F6E4] bg-white shadow-xl saraban-scroll">
                    {isLoadingOptions ? (
                      <div className="p-3 text-xs text-slate-600 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F766E]" />
                        <span>กำลังโหลดรายชื่อโครงการจากระบบจัดซื้อจัดจ้าง...</span>
                      </div>
                    ) : loadError ? (
                      <div className="p-3 text-xs text-[#991B1B] bg-[#FEF2F2] space-y-2">
                        <div>{loadError}</div>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            loadOptions();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#FCA5A5] text-[#991B1B] font-semibold inline-flex items-center gap-1 hover:bg-[#FEE2E2]"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>ลองโหลดรายชื่อโครงการใหม่</span>
                        </button>
                      </div>
                    ) : options.length === 0 ? (
                      <div className="p-3 text-xs text-amber-800 bg-amber-50">
                        ไม่พบรายชื่อโครงการในระบบงานจัดซื้อจัดจ้าง
                      </div>
                    ) : filteredOptions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">
                        ไม่พบโครงการตามคำค้น หรือปีงบประมาณที่เลือก
                      </div>
                    ) : isApprovalCategory && waitingApprovalCount > 0 ? (
                      <>
                        <div className="px-3 py-1.5 bg-[#FEF3C7] border-b border-[#FCD34D] text-[11px] font-bold text-[#92400E] sticky top-0 z-10 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span>โครงการรอขออนุมัติโครงการ ({waitingApprovalCount})</span>
                        </div>
                        {filteredOptions
                          .filter((item) => item.status === 'waiting_project_approval')
                          .map(renderProcurementOptionItem)}

                        {filteredOptions.some((item) => item.status !== 'waiting_project_approval') && (
                          <>
                            <div className="px-3 py-1.5 bg-slate-100 border-y border-slate-200 text-[11px] font-bold text-slate-600">
                              โครงการสถานะอื่น
                            </div>
                            {filteredOptions
                              .filter((item) => item.status !== 'waiting_project_approval')
                              .map(renderProcurementOptionItem)}
                          </>
                        )}
                      </>
                    ) : (
                      filteredOptions.map(renderProcurementOptionItem)
                    )}
                  </div>
                )}
              </div>
              {loadError && !dropdownOpen && (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] px-2.5 py-1.5 text-[11px] text-[#991B1B]">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => loadOptions()}
                    className="font-bold underline shrink-0"
                  >
                    ลองใหม่
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Selected Procurement Highlight Info */}
          {value.procurement && (
            <div className="p-2.5 rounded-xl bg-white border border-[#CCFBF1] text-[11px] text-[#134E4A] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-bold">โครงการที่เลือก:</span>
                <span className="truncate">{formatProcurementLabel(value.procurement)}</span>
              </div>
              {value.procurement.status === 'waiting_project_approval' && (
                <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] font-bold shrink-0">
                  สถานะปัจจุบัน: รอขออนุมัติโครงการ
                </span>
              )}
            </div>
          )}

          {/* Category-Specific Dynamic Subfields (Only non-empty real values are sent) */}
          {normalizedCategory === 'general_approval' && (
            <div className="space-y-3 p-3 rounded-xl bg-white border border-[#CCFBF1]">
              <div className="text-xs text-[#134E4A] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#0F766E]" />
                <div>
                  <span className="font-bold">เชื่อมโยงขั้นตอนการขออนุมัติโครงการ: </span>
                  <span className="text-slate-600">
                    ระบบจะส่งเลขที่บันทึกขออนุมัติ วันที่ขออนุมัติ เรื่อง และไฟล์แนบ (ถ้ามี)
                    เมื่อฝั่งจัดซื้อฯ กดรับเข้าจะบันทึกขั้นตอนการขออนุมัติและย้ายเข้า “กล่องงานของฉัน”
                    โดยไม่กระทบข้อมูลตั้งต้นอื่นของโครงการ
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่ขออนุมัติ
                    {value.fields.approvalDate && (
                      <span className="ml-1.5 text-[10px] font-medium text-[#0F766E] tabular-nums">
                        ({formatThaiDate(value.fields.approvalDate)})
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={value.fields.approvalDate || ''}
                    onChange={(e) => updateFields({ approvalDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้รับผิดชอบโครงการ
                  </label>
                  <input
                    type="text"
                    value={value.fields.responsibleName || ''}
                    onChange={(e) => updateFields({ responsibleName: e.target.value })}
                    placeholder="เว้นว่างหากยึดตามระบบจัดซื้อฯ"
                    className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมายเหตุ / รายละเอียดเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={value.fields.notes || ''}
                    onChange={(e) => updateFields({ notes: e.target.value })}
                    placeholder="ระบุหมายเหตุ (ไม่บังคับ)"
                    className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                  />
                </div>
              </div>
            </div>
          )}

          {normalizedCategory === 'tor_order' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-xl bg-white border border-[#CCFBF1]">
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
                  {value.fields.orderDate && (
                    <span className="ml-1.5 text-[10px] font-medium text-[#0F766E] tabular-nums">
                      ({formatThaiDate(value.fields.orderDate)})
                    </span>
                  )}
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
                  ผู้รับผิดชอบ / กรรมการ
                </label>
                <input
                  type="text"
                  value={value.fields.assigneeName || ''}
                  onChange={(e) => updateFields({ assigneeName: e.target.value })}
                  placeholder="เว้นว่างหากยึดระบบปลายทาง"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  value={value.fields.notes || ''}
                  onChange={(e) => updateFields({ notes: e.target.value })}
                  placeholder="ระบุหมายเหตุ (ไม่บังคับ)"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            </div>
          )}

          {normalizedCategory === 'tor_approval' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-white border border-[#CCFBF1]">
              <div>
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อผู้จัดทำ TOR
                </label>
                <input
                  type="text"
                  value={value.fields.torAuthor || ''}
                  onChange={(e) => updateFields({ torAuthor: e.target.value })}
                  placeholder="เว้นว่างหากยึดระบบปลายทาง"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={value.fields.details || ''}
                  onChange={(e) => updateFields({ details: e.target.value })}
                  placeholder="ระบุรายละเอียด (ไม่บังคับ)"
                  className="w-full px-3 py-2 rounded-xl border border-[#99F6E4] text-sm focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            </div>
          )}

          {normalizedCategory === 'disbursement' && (
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
                  : statusMeta?.status === 'rejected'
                  ? 'คิวเดิมถูกส่งกลับ/ปฏิเสธ สามารถปรับแก้ข้อมูลและส่งเข้าคิวใหม่ด้วยรหัสคิวใหม่ได้ทันที'
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
                    <span>
                      {statusMeta?.status === 'rejected'
                        ? 'ส่งข้อมูลเข้าคิวใหม่'
                        : 'ส่งซิงค์เข้าระบบจัดซื้อจัดจ้าง'}
                    </span>
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
