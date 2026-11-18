import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ProjectDocCategory,
  ProjectOption,
  ProjectSyncSelection,
  SarabanProjectSyncRecord,
} from '../services/projectSyncApi';
import {
  fetchProjectOptions,
  getQueueStatusMeta,
  PROJECT_DOC_CATEGORIES,
} from '../services/projectSyncApi';
import { BASE_YEARS } from '../types/saraban';
import { formatThaiAckDateTime, getCurrentFiscalYear } from '../utils/sarabanUtils';

interface ProjectSyncPanelProps {
  value: ProjectSyncSelection;
  onChange: (next: ProjectSyncSelection) => void;
  existingSync?: SarabanProjectSyncRecord | null;
  disabled?: boolean;
  onPushNow?: () => Promise<void>;
  isPushingNow?: boolean;
  pushError?: string;
  onDeleteSyncedQueue?: (record: SarabanProjectSyncRecord) => Promise<void>;
  isDeletingQueue?: boolean;
  onRefreshQueueStatus?: () => Promise<void>;
  isRefreshingQueueStatus?: boolean;
}

export function ProjectSyncPanel({
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
}: ProjectSyncPanelProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
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
      ...projects.map((p) => String(p.fiscalYear)).filter(Boolean),
    ]);
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [projects]);

  const loadProjects = useCallback(async (fiscalFilter: string) => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoadingProjects(true);
    setLoadError('');

    try {
      const list = await fetchProjectOptions(fiscalFilter, controller.signal);
      if (controller.signal.aborted) return;
      setProjects(list);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setLoadError(
        err instanceof Error ? err.message : 'ไม่สามารถโหลดรายชื่อโครงการจากระบบงานโครงการได้'
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (!value.enabled) return;
    loadProjects(value.fiscalYearFilter || 'all');
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
  }, [value.enabled, value.fiscalYearFilter, loadProjects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const text = `[${p.projectCode}] ${p.name} ปี ${p.fiscalYear} ${p.contractNo || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [projects, projectSearch]);

  const selectedCategoryMeta = useMemo(
    () =>
      PROJECT_DOC_CATEGORIES.find((c) => c.value === value.docCategory) ||
      PROJECT_DOC_CATEGORIES[0],
    [value.docCategory]
  );

  const isLockedDuplicate = Boolean(
    existingSync &&
      !allowModifySynced &&
      (!value.project || existingSync.projectId === value.project.id) &&
      existingSync.docCategory === value.docCategory
  );

  const updateFields = (patch: Partial<ProjectSyncSelection['fields']>) => {
    onChange({
      ...value,
      fields: {
        ...value.fields,
        ...patch,
      },
    });
  };

  const existingCategoryLabel = existingSync
    ? PROJECT_DOC_CATEGORIES.find((c) => c.value === existingSync.docCategory)?.label ||
      existingSync.docCategory
    : '';
  const statusMeta = existingSync ? getQueueStatusMeta(existingSync.queueStatus) : null;

  return (
    <div className="p-4 rounded-xl border border-[#D7D2E6] bg-[#FAF9FC] space-y-3.5">
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
            className="w-4 h-4 rounded border-[#8E86B4] text-[#6B6293] focus:ring-[#6B6293]"
          />
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#242038]">
            <FolderKanban className="w-4 h-4 text-[#6B6293]" />
            <span>ส่งเข้าระบบงานโครงการ (ถ้าเกี่ยวข้อง)</span>
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
                โครงการ: [{existingSync.projectCode}] {existingSync.projectName} (ปี{' '}
                {existingSync.fiscalYear})
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
                  ผู้ตรวจสอบ: <span className="font-semibold">{existingSync.reviewedBy || '-'}</span>
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
                  title="ดึงสถานะล่าสุดจากระบบงานโครงการ"
                  className="px-2.5 py-1.5 rounded-lg border border-[#C9C4DC] bg-white hover:bg-[#ECEAF4] text-[#242038] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isRefreshingQueueStatus ? 'animate-spin text-[#6B6293]' : ''}`}
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
                <span>{existingSync.rejectReason || 'ระบบโครงการไม่ได้ระบุเหตุผลเพิ่มเติม'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {value.enabled && (
        <div className="space-y-3.5 pt-1 border-t border-[#ECEAF4]">
          {/* Fiscal Year + Searchable Project Picker */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-[#242038] mb-1">
                ปีงบประมาณโครงการ
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
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] bg-white text-sm font-semibold text-[#242038] focus:outline-none focus:border-[#6B6293]"
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
                  disabled={isLoadingProjects || disabled || isPushingNow}
                  onClick={() => loadProjects(value.fiscalYearFilter || 'all')}
                  title="โหลดรายชื่อโครงการใหม่"
                  className="p-2 rounded-xl border border-[#C9C4DC] bg-white hover:bg-[#ECEAF4] text-[#574F7D] transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoadingProjects ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>

            <div className="md:col-span-8" ref={dropdownRef}>
              <label className="block text-xs font-bold text-[#242038] mb-1">
                เลือกโครงการกองช่าง *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#6B6293] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  disabled={disabled || isPushingNow}
                  value={
                    dropdownOpen
                      ? projectSearch
                      : value.project
                      ? `[${value.project.projectCode}] ${value.project.name} (ปี ${value.project.fiscalYear})`
                      : projectSearch
                  }
                  onFocus={() => {
                    setDropdownOpen(true);
                    if (value.project) {
                      setProjectSearch('');
                    }
                  }}
                  onChange={(e) => {
                    setProjectSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder={
                    isLoadingProjects
                      ? 'กำลังโหลดรายชื่อโครงการ...'
                      : 'พิมพ์รหัสโครงการ หรือชื่อโครงการเพื่อค้นหา...'
                  }
                  className="w-full pl-9 pr-16 py-2 rounded-xl border border-[#C9C4DC] bg-white text-sm text-[#242038] focus:outline-none focus:border-[#6B6293]"
                />
                {value.project && !dropdownOpen && (
                  <button
                    type="button"
                    disabled={disabled || isPushingNow}
                    onClick={() => {
                      onChange({ ...value, project: null });
                      setProjectSearch('');
                      setDropdownOpen(true);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#6B6293] hover:text-[#242038] px-1.5 py-0.5 rounded bg-[#F1EFF7]"
                  >
                    เปลี่ยน
                  </button>
                )}

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl border border-[#C9C4DC] bg-white shadow-xl saraban-scroll">
                    {isLoadingProjects ? (
                      <div className="p-3 text-xs text-slate-600 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B6293]" />
                        <span>กำลังโหลดรายชื่อโครงการ...</span>
                      </div>
                    ) : loadError ? (
                      <div className="p-3 text-xs text-[#991B1B] bg-[#FEF2F2]">
                        {loadError}
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="p-3 text-xs text-amber-800 bg-amber-50">
                        ไม่พบข้อมูลโครงการในระบบงานโครงการ (ปลายทางส่งกลับ 0 รายการ กรุณาตรวจสอบ Google Sheet ของระบบโครงการ)
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">
                        ไม่พบโครงการตามคำค้น หรือปีงบประมาณที่เลือก
                      </div>
                    ) : (
                      filteredProjects.map((proj) => {
                        const isChosen = value.project?.id === proj.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onChange({ ...value, project: proj });
                              setProjectSearch('');
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 text-xs border-b border-[#F3F1F8] last:border-b-0 transition-colors ${
                              isChosen
                                ? 'bg-[#ECEAF4] text-[#242038] font-bold'
                                : 'hover:bg-[#F8F7FB] text-slate-800'
                            }`}
                          >
                            <div className="font-semibold text-[#242038]">
                              [{proj.projectCode}] {proj.name} (ปี {proj.fiscalYear})
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              {proj.contractNo && <span>สัญญา: {proj.contractNo}</span>}
                              {proj.status && <span>สถานะ: {proj.status}</span>}
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
            <label className="block text-xs font-bold text-[#242038] mb-1">
              หมวดหมู่เอกสารในระบบโครงการ *
            </label>
            <select
              value={value.docCategory}
              disabled={disabled || isPushingNow}
              onChange={(e) =>
                onChange({
                  ...value,
                  docCategory: e.target.value as ProjectDocCategory,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] bg-white text-sm font-semibold text-[#242038] focus:outline-none focus:border-[#6B6293]"
            >
              {PROJECT_DOC_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#574F7D] mt-1">{selectedCategoryMeta.hint}</p>
          </div>

          {/* Category-Specific Dynamic Subfields */}
          {value.docCategory === 'tor_order' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้รับผิดชอบหลัก (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={value.fields.assigneeName || ''}
                  onChange={(e) => updateFields({ assigneeName: e.target.value })}
                  placeholder="ระบุชื่อประธาน/ผู้รับผิดชอบ"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={value.fields.notes || ''}
                  onChange={(e) => updateFields({ notes: e.target.value })}
                  placeholder="เช่น คำสั่งแต่งตั้ง กก. กำหนดราคากลาง"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'tor_approval' && (
            <div className="p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ผู้จัดทำ TOR (torAuthor) *
              </label>
              <input
                type="text"
                value={value.fields.torAuthor || ''}
                onChange={(e) => updateFields({ torAuthor: e.target.value })}
                placeholder="เช่น นายช่างโยธา"
                className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
              />
            </div>
          )}

          {value.docCategory === 'ref_price' && (
            <div className="p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วงเงินราคากลาง (บาท) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value.fields.refPrice || ''}
                onChange={(e) => updateFields({ refPrice: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
              />
            </div>
          )}

          {value.docCategory === 'inspect_order' && (
            <div className="p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อผู้ควบคุมงาน (supervisorName) *
              </label>
              <input
                type="text"
                value={value.fields.supervisorName || ''}
                onChange={(e) => updateFields({ supervisorName: e.target.value })}
                placeholder="ระบุชื่อ-สกุล ผู้ควบคุมงาน"
                className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
              />
            </div>
          )}

          {value.docCategory === 'contract' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วงเงินสัญญา (บาท) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={value.fields.contractAmount || ''}
                  onChange={(e) => updateFields({ contractAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้รับจ้าง *
                </label>
                <input
                  type="text"
                  value={value.fields.contractorName || ''}
                  onChange={(e) => updateFields({ contractorName: e.target.value })}
                  placeholder="เช่น หจก. ..."
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันเริ่มสัญญา *
                </label>
                <input
                  type="date"
                  value={value.fields.startDate || ''}
                  onChange={(e) => updateFields({ startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันสิ้นสุดสัญญา *
                </label>
                <input
                  type="date"
                  value={value.fields.endDate || ''}
                  onChange={(e) => updateFields({ endDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'work_notice' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันที่เข้าทำงานจริง (ถ้ามี)
                </label>
                <input
                  type="date"
                  value={value.fields.actualWorkDate || ''}
                  onChange={(e) => updateFields({ actualWorkDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={value.fields.notes || ''}
                  onChange={(e) => updateFields({ notes: e.target.value })}
                  placeholder="รายละเอียดการแจ้งเข้าทำงาน"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'delivery' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  งวดที่ *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={value.fields.installment || '1'}
                  onChange={(e) => updateFields({ installment: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันที่ส่งมอบจริง *
                </label>
                <input
                  type="date"
                  value={value.fields.actualDeliveryDate || ''}
                  onChange={(e) => updateFields({ actualDeliveryDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดการส่งมอบ
                </label>
                <input
                  type="text"
                  value={value.fields.details || ''}
                  onChange={(e) => updateFields({ details: e.target.value })}
                  placeholder="ระบุรายละเอียดงานที่ส่งมอบ"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'inspection' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  งวดที่ *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={value.fields.installment || '1'}
                  onChange={(e) => updateFields({ installment: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผลการตรวจรับ *
                </label>
                <select
                  value={value.fields.result || 'pass'}
                  onChange={(e) =>
                    updateFields({
                      result: e.target.value as 'pass' | 'fail' | 'need_revision',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] bg-white text-sm font-semibold focus:outline-none focus:border-[#6B6293]"
                >
                  <option value="pass">ผ่านการตรวจรับ (pass)</option>
                  <option value="need_revision">ต้องแก้ไขเพิ่มเติม (need_revision)</option>
                  <option value="fail">ไม่ผ่านการตรวจรับ (fail)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดผลการตรวจรับ
                </label>
                <input
                  type="text"
                  value={value.fields.details || ''}
                  onChange={(e) => updateFields({ details: e.target.value })}
                  placeholder="ระบุรายละเอียดหรือความเห็นคณะกรรมการ"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'disbursement' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  งวดที่ *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={value.fields.installment || '1'}
                  onChange={(e) => updateFields({ installment: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนเงิน (บาท) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={value.fields.amount || ''}
                  onChange={(e) => updateFields({ amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สถานะเบิกจ่าย *
                </label>
                <select
                  value={value.fields.status || 'pending'}
                  onChange={(e) =>
                    updateFields({ status: e.target.value as 'pending' | 'paid' })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] bg-white text-sm font-semibold focus:outline-none focus:border-[#6B6293]"
                >
                  <option value="pending">รอเบิกจ่าย (pending)</option>
                  <option value="paid">จ่ายแล้ว (paid)</option>
                </select>
              </div>
            </div>
          )}

          {value.docCategory === 'remuneration' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ประเภทค่าตอบแทน *
                </label>
                <select
                  value={value.fields.remunerationType || 'inspection'}
                  onChange={(e) =>
                    updateFields({
                      remunerationType: e.target.value as
                        | 'tor_author'
                        | 'tor'
                        | 'supervisor'
                        | 'inspection',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] bg-white text-sm font-semibold focus:outline-none focus:border-[#6B6293]"
                >
                  <option value="tor_author">ผู้จัดทำ TOR (tor_author)</option>
                  <option value="tor">กก.กำหนด TOR/ราคากลาง (tor)</option>
                  <option value="supervisor">ผู้ควบคุมงาน (supervisor)</option>
                  <option value="inspection">กก.ตรวจรับพัสดุ (inspection)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายการค่าตอบแทน *
                </label>
                <input
                  type="text"
                  value={value.fields.title || ''}
                  onChange={(e) => updateFields({ title: e.target.value })}
                  placeholder="เช่น ค่าตอบแทนคณะกรรมการตรวจรับฯ"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้รับเงิน *
                </label>
                <input
                  type="text"
                  value={value.fields.payeeName || ''}
                  onChange={(e) => updateFields({ payeeName: e.target.value })}
                  placeholder="ระบุชื่อผู้รับเงิน"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนเงิน (บาท, ถ้ามี)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={value.fields.amount || ''}
                  onChange={(e) => updateFields({ amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm tabular-nums focus:outline-none focus:border-[#6B6293]"
                />
              </div>
            </div>
          )}

          {value.docCategory === 'other' && (
            <div className="p-3 rounded-xl bg-white border border-[#E5E2F0]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุ / รายละเอียดเพิ่มเติม
              </label>
              <input
                type="text"
                value={value.fields.notes || ''}
                onChange={(e) => updateFields({ notes: e.target.value })}
                placeholder="ระบุรายละเอียดเอกสารที่ส่งเข้าระบบโครงการ"
                className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] text-sm focus:outline-none focus:border-[#6B6293]"
              />
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
              <span className="text-[11px] text-[#574F7D]">
                {isLockedDuplicate
                  ? 'หมวดหมู่นี้ถูกส่งเข้าคิวโครงการแล้ว ระบบป้องกันการส่งซ้ำอัตโนมัติ'
                  : 'เมื่อกดปุ่ม ระบบจะส่งข้อมูลและลิงก์ไฟล์แนบ (ถ้ามี) ไปยังระบบงานโครงการทันที'}
              </span>
              <button
                type="button"
                disabled={disabled || isPushingNow || isLockedDuplicate}
                onClick={onPushNow}
                className="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] border border-[#075985] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-55 whitespace-nowrap shrink-0"
              >
                {isPushingNow ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังส่งเข้าระบบโครงการ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ส่งซิงค์เข้าระบบโครงการ</span>
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
