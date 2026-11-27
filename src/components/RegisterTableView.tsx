import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Paperclip,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SarabanProcurementSyncRecord } from '../services/procurementSyncApi';
import {
  formatProcurementDisplayTitle,
  getProcurementQueueStatusMeta,
} from '../services/procurementSyncApi';
import type { SarabanProjectSyncRecord } from '../services/projectSyncApi';
import { getQueueStatusMeta } from '../services/projectSyncApi';
import type { DocType, SarabanDoc, SortState, TabId, UserSession } from '../types/saraban';
import { TAB_TITLES } from '../types/saraban';
import {
  CURRENT_YEAR_FILTER_KEY,
  formatRegDisplay,
  formatThaiAckDateTime,
  formatThaiDate,
  getAvailableYears,
  getCurrentBuddhistYear,
  getCurrentFiscalYear,
  getCurrentYearForType,
  getDocAttachments,
  getInboxDate,
  getInboxDateSortValue,
  getOrderedStatuses,
  getPartyLabel,
  isOverdueDoc,
  matchesCurrentYearByType,
  matchesDocumentSearch,
} from '../utils/sarabanUtils';
import {
  DocTypeBadge,
  StatusHighlightBadge,
  UrgencyHighlightBadge,
} from './StatusBadges';

export type RegisterTabId = Exclude<TabId, 'dashboard' | 'vouchersSummary'>;

export interface RegisterFilterPreset {
  tabId: RegisterTabId;
  year?: string;
  statuses?: string[];
  statusLabel?: string;
  urgency?: string;
  urgencies?: string[];
  urgencyLabel?: string;
  search?: string;
  nonce: number;
}

interface RegisterTableViewProps {
  tabId: RegisterTabId;
  documents: SarabanDoc[];
  projectSyncMap?: Record<string, SarabanProjectSyncRecord>;
  procurementSyncMap?: Record<string, SarabanProcurementSyncRecord>;
  currentUser: UserSession;
  isLoading: boolean;
  loadError: string;
  selectedDocId: string | number | null;
  externalFilter?: RegisterFilterPreset | null;
  onSelectDoc: (id: string | number) => void;
  onViewDoc: (doc: SarabanDoc) => void;
  onEditDoc: (doc: SarabanDoc) => void;
  onDeleteDoc: (doc: SarabanDoc) => void;
  onAcknowledgeDoc: (doc: SarabanDoc) => void;
  onUpdateStatusDoc: (doc: SarabanDoc) => void;
  onExportCSV: (type: DocType) => void;
  onImportExcel: (type: DocType, yearStr: string, file: File) => void;
  onDownloadExcelTemplate?: (type: DocType) => void;
  onPrintRegisterReport: (title: string, rows: SarabanDoc[], filterLabel: string) => void;
  onRetrySync: () => void;
  onRefreshProjectQueues?: () => void;
  isRefreshingProjectQueues?: boolean;
  pendingProjectQueueCount?: number;
}

export function RegisterTableView({
  tabId,
  documents,
  projectSyncMap = {},
  procurementSyncMap = {},
  currentUser,
  isLoading,
  loadError,
  selectedDocId,
  externalFilter = null,
  onSelectDoc,
  onViewDoc,
  onEditDoc,
  onDeleteDoc,
  onAcknowledgeDoc,
  onUpdateStatusDoc,
  onExportCSV,
  onImportExcel,
  onDownloadExcelTemplate,
  onPrintRegisterReport,
  onRetrySync,
  onRefreshProjectQueues,
  isRefreshingProjectQueues = false,
  pendingProjectQueueCount = 0,
}: RegisterTableViewProps) {
  const isAdmin = currentUser.role === 'admin' && currentUser.name === 'นิศาชล คงดี';

  const [yearFilterByTab, setYearFilterByTab] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState('');
  const [statusPresetByTab, setStatusPresetByTab] = useState<
    Record<string, { statuses: string[]; label: string } | null>
  >({});
  const [urgencyFilterByTab, setUrgencyFilterByTab] = useState<
    Record<string, { levels: string[]; label: string } | null>
  >({});
  const [searchByTab, setSearchByTab] = useState<Record<string, string>>({});
  const [sortByTab, setSortByTab] = useState<Record<string, SortState>>({});

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const appliedFilterNonceRef = useRef<number>(0);

  useEffect(() => {
    if (!externalFilter || externalFilter.tabId !== tabId) return;
    if (appliedFilterNonceRef.current === externalFilter.nonce) return;
    appliedFilterNonceRef.current = externalFilter.nonce;

    if (externalFilter.year !== undefined) {
      setYearFilterByTab((prev) => ({ ...prev, [tabId]: externalFilter.year || '' }));
    }
    setStatusPresetByTab((prev) => ({
      ...prev,
      [tabId]:
        externalFilter.statuses && externalFilter.statuses.length > 0
          ? {
              statuses: externalFilter.statuses,
              label: externalFilter.statusLabel || externalFilter.statuses.join(' / '),
            }
          : null,
    }));
    if (tabId === 'myInbox') {
      setStatusFilter(
        externalFilter.statuses && externalFilter.statuses.length === 1
          ? externalFilter.statuses[0]
          : ''
      );
    }
    const urgencyLevels =
      externalFilter.urgencies && externalFilter.urgencies.length > 0
        ? externalFilter.urgencies
        : externalFilter.urgency
        ? [externalFilter.urgency]
        : [];
    setUrgencyFilterByTab((prev) => ({
      ...prev,
      [tabId]:
        urgencyLevels.length > 0
          ? {
              levels: urgencyLevels,
              label: externalFilter.urgencyLabel || urgencyLevels.join(' / '),
            }
          : null,
    }));
    setSearchByTab((prev) => ({
      ...prev,
      [tabId]: externalFilter.search ?? '',
    }));
  }, [externalFilter, tabId]);

  const currentCalendarYear = getCurrentBuddhistYear();
  const currentFiscalYear = getCurrentFiscalYear();
  const isFiscalTab = tabId === 'memos' || tabId === 'vouchers';
  const isMixedTypeTab = tabId === 'allDocs' || tabId === 'myInbox';
  const anchorYearForTab = isFiscalTab ? currentFiscalYear : currentCalendarYear;

  const defaultYearForTab =
    tabId === 'forms' || tabId === 'overdue'
      ? ''
      : isMixedTypeTab
      ? CURRENT_YEAR_FILTER_KEY
      : anchorYearForTab;

  const selectedYear =
    yearFilterByTab[tabId] !== undefined ? yearFilterByTab[tabId] : defaultYearForTab;
  const searchQuery = searchByTab[tabId] || '';
  const sortState = sortByTab[tabId];

  const tabMeta = TAB_TITLES[tabId];

  const baseDocsForTab = useMemo(() => {
    if (tabId === 'myInbox') {
      return documents.filter(
        (d) =>
          String(d.assignee || '').trim() === currentUser.name &&
          String(d.status || '').trim() !== 'เสร็จสิ้น'
      );
    }
    if (tabId === 'overdue') {
      return documents.filter((d) => isOverdueDoc(d));
    }
    if (tabId === 'allDocs') {
      return documents;
    }
    return documents.filter((d) => d.type === tabId);
  }, [documents, tabId, currentUser.name]);

  const availableYears = useMemo(
    () => getAvailableYears(baseDocsForTab, !isMixedTypeTab, anchorYearForTab),
    [baseDocsForTab, isMixedTypeTab, anchorYearForTab]
  );

  const availableStatuses = useMemo(
    () => getOrderedStatuses(baseDocsForTab),
    [baseDocsForTab]
  );

  const activeStatusPreset = statusPresetByTab[tabId] || null;
  const activeUrgencyFilter = urgencyFilterByTab[tabId] || null;

  const filteredAndSortedRows = useMemo(() => {
    let rows = baseDocsForTab.filter((d) => {
      if (selectedYear === CURRENT_YEAR_FILTER_KEY) {
        if (!matchesCurrentYearByType(d)) return false;
      } else if (selectedYear && String(d.yearStr) !== String(selectedYear)) {
        return false;
      }
      if (tabId === 'myInbox' && statusFilter && d.status !== statusFilter) return false;
      if (activeStatusPreset && activeStatusPreset.statuses.length > 0) {
        const docStatus = String(d.status || '').trim();
        if (!activeStatusPreset.statuses.includes(docStatus)) return false;
      }
      if (activeUrgencyFilter && activeUrgencyFilter.levels.length > 0) {
        const docUrgency = String(d.urgency || 'ปกติ').trim() || 'ปกติ';
        if (!activeUrgencyFilter.levels.includes(docUrgency)) return false;
      }
      if (searchQuery && !matchesDocumentSearch(d, searchQuery)) return false;
      return true;
    });

    if (sortState) {
      rows = [...rows].sort((a, b) => {
        const getVal = (doc: SarabanDoc) => {
          if (sortState.field === 'date') return getInboxDate(doc);
          if (sortState.field === 'regNo' && tabId === 'myInbox') {
            if (doc.type === 'outgoing' || doc.type === 'orders' || doc.type === 'memos') {
              return doc.docNumber || '';
            }
            if (doc.type === 'vouchers') {
              return doc.voucherNo || '';
            }
            return formatRegDisplay(doc);
          }
          if (sortState.field === 'subject') {
            return doc.subject || doc.voucherProject || doc.formName || '';
          }
          return (doc as unknown as Record<string, unknown>)[sortState.field] ?? '';
        };
        const x = getVal(a);
        const y = getVal(b);
        const cmp =
          sortState.field === 'voucherAmount'
            ? Number(x || 0) - Number(y || 0)
            : String(x).localeCompare(String(y), 'th', { numeric: true, sensitivity: 'base' });
        return sortState.direction === 'asc' ? cmp : -cmp;
      });
    } else {
      rows = [...rows];
      if (tabId === 'incoming') {
        rows.sort((a, b) => parseInt(String(b.regNo || 0), 10) - parseInt(String(a.regNo || 0), 10));
      } else if (tabId === 'outgoing' || tabId === 'memos') {
        rows.sort((a, b) => getInboxDateSortValue(b.docDate) - getInboxDateSortValue(a.docDate));
      } else if (tabId === 'orders') {
        rows.sort((a, b) => {
          const numA = parseInt(String(a.docNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
          const numB = parseInt(String(b.docNumber || '').replace(/[^0-9]/g, ''), 10) || 0;
          return numB - numA;
        });
      } else if (tabId === 'vouchers') {
        rows.sort(
          (a, b) => getInboxDateSortValue(b.voucherDate) - getInboxDateSortValue(a.voucherDate)
        );
      } else if (tabId === 'myInbox') {
        rows.sort(
          (a, b) =>
            getInboxDateSortValue(getInboxDate(b)) - getInboxDateSortValue(getInboxDate(a))
        );
      }
    }

    return rows;
  }, [
    baseDocsForTab,
    selectedYear,
    statusFilter,
    activeStatusPreset,
    activeUrgencyFilter,
    searchQuery,
    sortState,
    tabId,
  ]);

  const toggleSort = (field: string) => {
    setSortByTab((prev) => {
      const current = prev[tabId];
      const direction =
        current?.field === field && current.direction === 'asc' ? 'desc' : 'asc';
      return { ...prev, [tabId]: { field, direction } };
    });
  };

  const renderSortHeader = (label: string, field: string, align: 'left' | 'center' | 'right' = 'left') => {
    const active = sortState?.field === field;
    const alignClass =
      align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
    return (
      <th
        className={`p-3.5 sticky top-0 z-20 border-b transition-colors ${
          tabId === 'overdue'
            ? active
              ? 'bg-[#FEE2E2] text-[#7F1D1D] border-[#FCA5A5]'
              : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
            : active
            ? 'bg-[#ECEAF4] text-[#242038] border-[#C9C4DC]'
            : 'bg-[#F6F4FA] text-[#242038] border-[#E5E2F0]'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={`w-full inline-flex items-center gap-1.5 font-semibold text-xs ${alignClass} hover:text-[#6B6293]`}
        >
          <span>{label}</span>
          {active ? (
            sortState.direction === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-55 shrink-0" />
          )}
        </button>
      </th>
    );
  };

  const renderProjectSyncTag = (doc: SarabanDoc) => {
    const rec = projectSyncMap[String(doc.id)];
    const procRec = procurementSyncMap[String(doc.id)];
    if (!rec && !procRec) return null;

    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {rec && (() => {
          const statusMeta = getQueueStatusMeta(rec.queueStatus);
          const reasonText =
            statusMeta.status === 'rejected' && rec.rejectReason ? ` (${rec.rejectReason})` : '';
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDoc(doc);
              }}
              title={`ระบบงานโครงการ: [${rec.projectCode}] ${rec.projectName} · สถานะ: ${statusMeta.label}${reasonText} — คลิกเพื่อดูรายละเอียด/เช็คสถานะ/ลบคิว`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums transition-colors ${statusMeta.badgeClass}`}
            >
              {statusMeta.status === 'approved' ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              ) : statusMeta.status === 'rejected' ? (
                <XCircle className="w-3 h-3 shrink-0" />
              ) : (
                <Clock className="w-3 h-3 shrink-0" />
              )}
              <span>
                โครงการ · {statusMeta.shortLabel}: {rec.queueId}
              </span>
            </button>
          );
        })()}

        {procRec && (() => {
          const statusMeta = getProcurementQueueStatusMeta(procRec.queueStatus);
          const reasonText =
            statusMeta.status === 'rejected' && procRec.rejectReason
              ? ` (${procRec.rejectReason})`
              : '';
          const reviewerText =
            statusMeta.status === 'approved' && procRec.reviewedBy
              ? ` · ผู้ตรวจ: ${procRec.reviewedBy}`
              : '';
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDoc(doc);
              }}
              title={`ระบบจัดซื้อจัดจ้าง: ${formatProcurementDisplayTitle({
                name: procRec.procurementName,
                projectCode: procRec.projectCode,
                procurementId: procRec.procurementId,
                fiscalYear: procRec.fiscalYear,
              })} · สถานะ: ${statusMeta.label}${reviewerText}${reasonText} — คลิกเพื่อดูรายละเอียด/เช็คสถานะ/แก้ไขส่งใหม่`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums transition-colors ${statusMeta.badgeClass}`}
            >
              {statusMeta.status === 'approved' ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              ) : statusMeta.status === 'rejected' ? (
                <XCircle className="w-3 h-3 shrink-0" />
              ) : (
                <Clock className="w-3 h-3 shrink-0" />
              )}
              <span>
                {statusMeta.shortLabel}: {procRec.queueId}
              </span>
            </button>
          );
        })()}
      </div>
    );
  };

  const renderAttachmentCell = (doc: SarabanDoc) => {
    const attachments = getDocAttachments(doc);
    return (
      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
        {attachments.length === 0 ? (
          <span className="text-slate-300 text-xs">—</span>
        ) : attachments.length === 1 ? (
          <a
            href={attachments[0].fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={attachments[0].fileName || 'เปิดดูไฟล์แนบ'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#C9C4DC] bg-[#F1EFF7] hover:bg-[#6B6293] text-[#242038] hover:text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>เปิดไฟล์</span>
          </a>
        ) : (
          <div className="inline-flex flex-col items-center gap-1 max-w-[180px]">
            {attachments.map((att, idx) => (
              <a
                key={`${att.fileUrl}-${idx}`}
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={att.fileName || `ไฟล์แนบ ${idx + 1}`}
                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-[#C9C4DC] bg-[#F1EFF7] hover:bg-[#6B6293] text-[#242038] hover:text-white text-[11px] font-semibold transition-colors"
              >
                <Paperclip className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[135px]">
                  {att.fileName && att.fileName !== 'ไฟล์แนบ'
                    ? `${idx + 1}. ${att.fileName}`
                    : `ไฟล์ที่ ${idx + 1}`}
                </span>
              </a>
            ))}
          </div>
        )}
      </td>
    );
  };

  const renderActionCell = (doc: SarabanDoc) => (
    <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onViewDoc(doc)}
          title="ดูรายละเอียด / พิมพ์ใบปะหน้า"
          className="w-8 h-8 rounded-lg border border-[#9690B0] bg-[#ECEAF4] hover:bg-[#6B6293] text-[#242038] hover:text-white inline-flex items-center justify-center transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => onEditDoc(doc)}
              title="แก้ไข"
              className="w-8 h-8 rounded-lg border border-[#F59E0B] bg-[#FEF3C7] hover:bg-[#D97706] text-[#92400E] hover:text-white inline-flex items-center justify-center transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteDoc(doc)}
              title="ลบ"
              className="w-8 h-8 rounded-lg border border-[#EF4444] bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white inline-flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </td>
  );

  const canImportExport =
    tabId === 'incoming' ||
    tabId === 'outgoing' ||
    tabId === 'orders' ||
    tabId === 'memos' ||
    tabId === 'vouchers';

  const filterSummaryText = [
    selectedYear === CURRENT_YEAR_FILTER_KEY
      ? `ปีปัจจุบัน (ปฏิทิน ${currentCalendarYear} / ปีงบฯ ${currentFiscalYear})`
      : selectedYear
      ? `${isFiscalTab ? 'ปีงบฯ' : 'ปี'} ${selectedYear}`
      : 'ทุกปี',
    statusFilter ? `สถานะ: ${statusFilter}` : '',
    searchQuery ? `คำค้น: "${searchQuery}"` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const colCountMap: Record<RegisterTabId, number> = {
    myInbox: 7,
    incoming: 8,
    outgoing: 6,
    orders: 6,
    memos: 6,
    forms: 5,
    vouchers: 7,
    allDocs: 7,
    overdue: 7,
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_4px_20px_rgba(36,32,56,0.05)] overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Heading & Filter Bar */}
        <div className="px-4 py-3.5 border-b border-[#ECEAF4] bg-[#FAF9FC] flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 shrink-0">
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[#242038]">
                {tabMeta.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full border border-[#0EA5E9] bg-[#E0F2FE] text-[#0C4A6E] text-[11px] font-bold tabular-nums shadow-[0_0_8px_rgba(14,165,233,0.35),inset_0_0_4px_rgba(125,211,252,0.4)]">
                {filteredAndSortedRows.length} รายการ
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{tabMeta.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto xl:justify-end">
            {tabId !== 'forms' && tabId !== 'overdue' && (
              <select
                value={selectedYear}
                onChange={(e) =>
                  setYearFilterByTab((prev) => ({ ...prev, [tabId]: e.target.value }))
                }
                aria-label="กรองตามปี"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none ${
                  selectedYear
                    ? 'border-[#B5B1C8] bg-white text-[#242038]'
                    : 'border-[#E2DFEE] bg-white text-slate-800 hover:border-[#B5B1C8]'
                }`}
              >
                {isMixedTypeTab && (
                  <option value={CURRENT_YEAR_FILTER_KEY}>
                    ปีปัจจุบัน (ปฏิทิน {currentCalendarYear} / ปีงบฯ {currentFiscalYear})
                  </option>
                )}
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {isFiscalTab ? `ปีงบฯ ${y}` : `ปี ${y}`}
                    {!isMixedTypeTab && y === anchorYearForTab ? ' (ปีปัจจุบัน)' : ''}
                  </option>
                ))}
                <option value="">ทุกปี (All Years)</option>
              </select>
            )}

            {tabId === 'myInbox' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setStatusPresetByTab((prev) => ({ ...prev, [tabId]: null }));
                }}
                aria-label="กรองตามสถานะ"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none ${
                  statusFilter
                    ? 'border-[#B5B1C8] bg-white text-[#242038]'
                    : 'border-[#E2DFEE] bg-white text-slate-800 hover:border-[#B5B1C8]'
                }`}
              >
                <option value="">ทุกสถานะ</option>
                {availableStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {activeStatusPreset && (
              <button
                type="button"
                onClick={() =>
                  setStatusPresetByTab((prev) => ({ ...prev, [tabId]: null }))
                }
                title="คลิกเพื่อล้างตัวกรองสถานะ"
                className="px-2.5 py-1.5 rounded-lg border border-[#B5B1C8] bg-[#ECEAF4] hover:bg-[#E2DFEE] text-[#242038] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>สถานะ: {activeStatusPreset.label}</span>
                <X className="w-3.5 h-3.5 text-[#574F7D]" />
              </button>
            )}

            {activeUrgencyFilter && (
              <button
                type="button"
                onClick={() =>
                  setUrgencyFilterByTab((prev) => ({ ...prev, [tabId]: null }))
                }
                title="คลิกเพื่อล้างตัวกรองความเร่งด่วน"
                className="px-2.5 py-1.5 rounded-lg border border-[#F59E0B] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#78350F] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>ความเร็ว: {activeUrgencyFilter.label}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {tabId !== 'overdue' && (
              <div className="relative flex-1 sm:flex-initial min-w-[170px] sm:w-48 lg:w-52">
                <Search className="w-3.5 h-3.5 text-[#6B6293] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchByTab((prev) => ({ ...prev, [tabId]: e.target.value }))
                  }
                  placeholder="ค้นหาเรื่อง, เลขที่..."
                  className={`w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs border transition-colors focus:outline-none ${
                    searchQuery
                      ? 'border-[#6B6293] bg-white text-[#242038]'
                      : 'border-[#DCD8EB] bg-white text-slate-800 focus:border-[#6B6293]'
                  }`}
                />
              </div>
            )}

            {onRefreshProjectQueues &&
              ['myInbox', 'outgoing', 'orders', 'memos', 'vouchers', 'allDocs'].includes(
                tabId
              ) && (
                <button
                  type="button"
                  disabled={isRefreshingProjectQueues}
                  onClick={onRefreshProjectQueues}
                  title="เช็คสถานะโครงการ/จัดซื้อฯ ล่าสุด (Pending / Approved / Rejected)"
                  className="bg-[#E0F2FE] hover:bg-[#BAE6FD] border border-[#7DD3FC] text-[#0C4A6E] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isRefreshingProjectQueues ? 'animate-spin' : ''}`}
                  />
                  <span>เช็คสถานะ</span>
                  {pendingProjectQueueCount > 0 && (
                    <span className="px-1.5 rounded-full bg-[#FEF3C7] border border-[#F59E0B] text-[#78350F] text-[10px] font-bold tabular-nums">
                      {pendingProjectQueueCount}
                    </span>
                  )}
                </button>
              )}

            {canImportExport && isAdmin && (
              <>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const importYear =
                        selectedYear && selectedYear !== CURRENT_YEAR_FILTER_KEY
                          ? selectedYear
                          : getCurrentYearForType(tabId);
                      onImportExcel(tabId as DocType, importYear, file);
                    }
                    e.target.value = '';
                  }}
                />
                {onDownloadExcelTemplate && (
                  <button
                    type="button"
                    onClick={() => onDownloadExcelTemplate(tabId as DocType)}
                    title={`ดาวน์โหลดตัวอย่างแบบฟอร์ม Excel (.xlsx) สำหรับนำเข้าข้อมูล${tabMeta.title}`}
                    className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <FileDown className="w-3.5 h-3.5 text-amber-700" />
                    <span>ฟอร์ม Excel</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  title="นำเข้าข้อมูลจากไฟล์ Excel (.xlsx / .xls / .csv)"
                  className="bg-[#F1EFF7] hover:bg-[#6B6293] border border-[#C9C4DC] hover:border-[#524A75] text-[#4A4173] hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>นำเข้า</span>
                </button>
              </>
            )}

            {canImportExport && (
              <button
                type="button"
                onClick={() => onExportCSV(tabId as DocType)}
                title="ส่งออกข้อมูลทะเบียนเป็นไฟล์ CSV"
                className="bg-[#ECFDF5] hover:bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onPrintRegisterReport(tabMeta.title, filteredAndSortedRows, filterSummaryText)
              }
              title="พิมพ์รายงานทะเบียนขนาด A4"
              className="bg-[#6B6293] hover:bg-[#574F7D] border border-[#524A75] text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ A4</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 min-h-0 overflow-auto saraban-scroll">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              {tabId === 'myInbox' && (
                <tr>
                  {renderSortHeader('เลขทะเบียน', 'regNo')}
                  {renderSortHeader('ประเภท', 'type', 'center')}
                  {renderSortHeader('วันที่', 'date')}
                  {renderSortHeader('เรื่อง / ผู้เกี่ยวข้อง', 'subject')}
                  {renderSortHeader('สถานะงาน / รับทราบ', 'status', 'center')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    การกระทำ
                  </th>
                </tr>
              )}

              {tabId === 'incoming' && (
                <tr>
                  {renderSortHeader('เลขรับกองช่าง', 'regNo')}
                  {renderSortHeader('เลขรับส่วนกลาง / วันที่', 'centralRegNo')}
                  {renderSortHeader('เลขที่หนังสือ / ลงวันที่', 'docNumber')}
                  {renderSortHeader('เรื่อง / ผู้ส่ง', 'subject')}
                  {renderSortHeader('ความเร่งด่วน', 'urgency', 'center')}
                  {renderSortHeader('สถานะดำเนินการ', 'status', 'center')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'outgoing' && (
                <tr>
                  {renderSortHeader('ปีปฏิทิน', 'yearStr')}
                  {renderSortHeader('เลขที่หนังสือส่ง / วันที่', 'docNumber')}
                  {renderSortHeader('เรื่อง / ผู้รับ', 'subject')}
                  {renderSortHeader('สถานะดำเนินการ', 'status', 'center')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'orders' && (
                <tr>
                  {renderSortHeader('ปีปฏิทิน', 'yearStr')}
                  {renderSortHeader('เลขที่คำสั่ง / วันที่', 'docNumber')}
                  {renderSortHeader('เรื่องคำสั่ง', 'subject')}
                  {renderSortHeader('สถานะดำเนินการ', 'status', 'center')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'memos' && (
                <tr>
                  {renderSortHeader('ปีงบประมาณ', 'yearStr')}
                  {renderSortHeader('เลขที่บันทึก / วันที่', 'docNumber')}
                  {renderSortHeader('งาน / เรื่อง / เรียน', 'subject')}
                  {renderSortHeader('สถานะดำเนินการ', 'status', 'center')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'forms' && (
                <tr>
                  {renderSortHeader('งาน', 'memoWork')}
                  {renderSortHeader('เลขที่แบบ', 'formCode')}
                  {renderSortHeader('ชื่อแบบฟอร์ม', 'formName')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'vouchers' && (
                <tr>
                  {renderSortHeader('ปีงบประมาณ', 'yearStr')}
                  {renderSortHeader('วันที่จัดทำ', 'voucherDate')}
                  {renderSortHeader('เลขที่ผู้เบิก / ผู้จัดทำ', 'voucherNo')}
                  {renderSortHeader('ประเภทฎีกา / ชื่อโครงการ', 'voucherCategory')}
                  {renderSortHeader('ผู้รับเงิน', 'voucherPayee')}
                  {renderSortHeader('จำนวนเงิน (บาท)', 'voucherAmount', 'right')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'allDocs' && (
                <tr>
                  {renderSortHeader('ประเภท', 'type')}
                  {renderSortHeader('ปี', 'yearStr', 'center')}
                  {renderSortHeader('เลขทะเบียน / เลขที่', 'regNo')}
                  {renderSortHeader('เรื่อง / ผู้เกี่ยวข้อง', 'subject')}
                  {renderSortHeader('สถานะ', 'status', 'center')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#F6F4FA] text-[#242038] border-b border-[#E5E2F0] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}

              {tabId === 'overdue' && (
                <tr>
                  {renderSortHeader('ประเภท', 'type')}
                  {renderSortHeader('เลขทะเบียน', 'regNo')}
                  {renderSortHeader('เรื่อง', 'subject')}
                  {renderSortHeader('ผู้รับผิดชอบ', 'assignee')}
                  {renderSortHeader('กำหนดเสร็จ', 'dueDate')}
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#FEF2F2] text-[#991B1B] border-b border-[#FECACA] text-xs font-semibold">
                    ไฟล์แนบ
                  </th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-[#FEF2F2] text-[#991B1B] border-b border-[#FECACA] text-xs font-semibold">
                    จัดการ
                  </th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-[#F0EEF6] text-sm">
              {isLoading && documents.length === 0 ? (
                <tr>
                  <td colSpan={colCountMap[tabId]} className="p-10 text-center text-slate-600">
                    <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2 text-[#6B6293]" />
                    กำลังโหลดข้อมูลทะเบียนเอกสารจาก Google Drive...
                  </td>
                </tr>
              ) : loadError && documents.length === 0 ? (
                <tr>
                  <td colSpan={colCountMap[tabId]} className="p-10 text-center space-y-3">
                    <div className="text-sm font-semibold text-[#991B1B]">
                      ซิงค์ข้อมูลไม่สำเร็จ: {loadError}
                    </div>
                    <button
                      type="button"
                      onClick={onRetrySync}
                      className="px-4 py-2 rounded-xl bg-[#6B6293] text-white text-xs font-semibold hover:bg-[#574F7D] transition-colors"
                    >
                      ลองซิงค์ข้อมูลใหม่
                    </button>
                  </td>
                </tr>
              ) : filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={colCountMap[tabId]} className="p-10 text-center text-slate-500">
                    ไม่พบรายการเอกสารตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows.map((d) => {
                  const isSelected = String(d.id) === String(selectedDocId);
                  const rowClass = `cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#ECEAF4] outline-2 -outline-offset-2 outline-[#6B6293]'
                      : tabId === 'overdue'
                      ? 'hover:bg-[#FEF2F2]'
                      : 'hover:bg-[#F8F7FB]'
                  }`;

                  if (tabId === 'myInbox') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#574F7D] whitespace-nowrap tabular-nums">
                          {d.type === 'outgoing' || d.type === 'orders' || d.type === 'memos'
                            ? d.docNumber || '-'
                            : d.type === 'vouchers'
                            ? d.voucherNo || '-'
                            : formatRegDisplay(d)}
                        </td>
                        <td className="p-3.5 text-center">
                          <DocTypeBadge type={d.type} />
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-slate-700 tabular-nums">
                          {formatThaiDate(getInboxDate(d))}
                        </td>
                        <td className="p-3.5 max-w-md">
                          <div className="font-semibold text-slate-900">
                            {d.type === 'vouchers' ? d.voucherProject || '-' : d.subject || '-'}
                          </div>
                          <div className="text-xs text-slate-500">{getPartyLabel(d)}</div>
                          {renderProjectSyncTag(d)}
                        </td>
                        <td
                          className="p-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex flex-col items-center gap-1.5">
                            <StatusHighlightBadge status={d.status} />
                            {d.ackStatus === 'รับทราบแล้ว' ? (
                              <span className="text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                                {d.ackTime && d.ackTime !== '-'
                                  ? formatThaiAckDateTime(d.ackTime)
                                  : 'รับทราบแล้ว'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAcknowledgeDoc(d)}
                                className="px-2.5 py-1 rounded-lg bg-[#D97706] hover:bg-[#B45309] border border-[#92400E] text-white text-[11px] font-semibold transition-colors whitespace-nowrap"
                              >
                                กดรับทราบงาน
                              </button>
                            )}
                          </div>
                        </td>
                        {renderAttachmentCell(d)}
                        <td
                          className="p-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewDoc(d)}
                              title="ดูรายละเอียด"
                              className="w-8 h-8 rounded-lg border border-[#9690B0] bg-[#ECEAF4] text-[#242038] hover:bg-[#6B6293] hover:text-white inline-flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateStatusDoc(d)}
                              className="px-3 py-1.5 rounded-lg bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              เปลี่ยนสถานะ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (tabId === 'incoming') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#574F7D] whitespace-nowrap tabular-nums">
                          {d.regNo} - {d.yearStr}
                        </td>
                        <td className="p-3.5 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{d.centralRegNo || '-'}</div>
                          <div className="text-slate-500 tabular-nums">
                            {formatThaiDate(d.receiveDate)}
                          </div>
                        </td>
                        <td className="p-3.5 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{d.docNumber || '-'}</div>
                          <div className="text-slate-500 tabular-nums">
                            {formatThaiDate(d.docDate)}
                          </div>
                        </td>
                        <td className="p-3.5 max-w-md">
                          <div className="font-semibold text-slate-900">{d.subject || '-'}</div>
                          <div className="text-xs text-slate-500">ผู้ส่ง: {d.sender || '-'}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          <UrgencyHighlightBadge urgency={d.urgency} />
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <StatusHighlightBadge status={d.status} />
                            {d.ackStatus === 'รับทราบแล้ว' && d.ackTime && d.ackTime !== '-' && (
                              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatThaiAckDateTime(d.ackTime)}
                              </span>
                            )}
                          </div>
                        </td>
                        {renderAttachmentCell(d)}
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  if (tabId === 'outgoing') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#065F46] whitespace-nowrap tabular-nums">
                          ปี {d.yearStr}
                        </td>
                        <td className="p-3.5 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{d.docNumber || '-'}</div>
                          <div className="text-slate-500 tabular-nums">
                            {formatThaiDate(d.docDate)}
                          </div>
                        </td>
                        <td className="p-3.5 max-w-md">
                          <div className="font-semibold text-slate-900">{d.subject || '-'}</div>
                          <div className="text-xs text-slate-500">ผู้รับ: {d.sender || '-'}</div>
                          {renderProjectSyncTag(d)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <StatusHighlightBadge status={d.status} />
                            {d.ackStatus === 'รับทราบแล้ว' && d.ackTime && d.ackTime !== '-' && (
                              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatThaiAckDateTime(d.ackTime)}
                              </span>
                            )}
                          </div>
                        </td>
                        {renderAttachmentCell(d)}
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  if (tabId === 'orders') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#92400E] whitespace-nowrap tabular-nums">
                          ปี {d.yearStr}
                        </td>
                        <td className="p-3.5 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{d.docNumber || '-'}</div>
                          <div className="text-slate-500 tabular-nums">
                            {formatThaiDate(d.docDate)}
                          </div>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">
                          <div>{d.subject || '-'}</div>
                          {renderProjectSyncTag(d)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <StatusHighlightBadge status={d.status} />
                            {d.ackStatus === 'รับทราบแล้ว' && d.ackTime && d.ackTime !== '-' && (
                              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatThaiAckDateTime(d.ackTime)}
                              </span>
                            )}
                          </div>
                        </td>
                        {renderAttachmentCell(d)}
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  if (tabId === 'memos') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#574F7D] whitespace-nowrap tabular-nums">
                          ปีงบฯ {d.yearStr}
                        </td>
                        <td className="p-3.5 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{d.docNumber || '-'}</div>
                          <div className="text-slate-500 tabular-nums">
                            {formatThaiDate(d.docDate)}
                          </div>
                        </td>
                        <td className="p-3.5 max-w-md">
                          <span className="inline-block px-2 py-0.5 rounded-md border border-[#0EA5E9] bg-[#E0F2FE] text-[#0369A1] text-[11px] font-bold mb-1 shadow-[0_0_10px_rgba(14,165,233,0.45),inset_0_0_4px_rgba(125,211,252,0.35)]">
                            งาน: {d.memoWork || '-'}
                          </span>
                          <div className="font-semibold text-slate-900">
                            เรื่อง: {d.subject || '-'}
                          </div>
                          <div className="text-xs text-slate-600">เรียน: {d.sender || '-'}</div>
                          {renderProjectSyncTag(d)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <StatusHighlightBadge status={d.status} />
                            {d.ackStatus === 'รับทราบแล้ว' && d.ackTime && d.ackTime !== '-' && (
                              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatThaiAckDateTime(d.ackTime)}
                              </span>
                            )}
                          </div>
                        </td>
                        {renderAttachmentCell(d)}
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  if (tabId === 'forms') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#155E75]">{d.memoWork || '-'}</td>
                        <td className="p-3.5 font-semibold text-slate-900">{d.formCode || '-'}</td>
                        <td className="p-3.5 text-slate-800">{d.formName || '-'}</td>
                        {renderAttachmentCell(d)}
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  if (tabId === 'vouchers') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5 font-bold text-[#9F1239] whitespace-nowrap tabular-nums">
                          ปีงบฯ {d.yearStr || '-'}
                        </td>
                        <td className="p-3.5 text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {formatThaiDate(d.voucherDate)}
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="font-bold text-[#9F1239]">{d.voucherNo || '-'}</div>
                          <div className="text-slate-500">
                            ผู้จัดทำ: {d.voucherMaker || '-'}
                          </div>
                        </td>
                        <td className="p-3.5 max-w-md">
                          <span className="inline-block px-2 py-0.5 rounded-md border border-[#F43F5E] bg-[#FFE4E6] text-[#BE123C] text-[11px] font-bold mb-1 shadow-[0_0_10px_rgba(244,63,94,0.45),inset_0_0_4px_rgba(253,164,175,0.35)]">
                            {d.voucherCategory || '-'}
                          </span>
                          <div className="font-semibold text-slate-900">
                            {d.voucherProject || '-'}
                          </div>
                          {renderProjectSyncTag(d)}
                        </td>
                        <td className="p-3.5 text-slate-800">{d.voucherPayee || '-'}</td>
                        <td className="p-3.5 text-right font-bold text-[#574F7D] tabular-nums whitespace-nowrap">
                          {Number(d.voucherAmount || 0).toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  if (tabId === 'overdue') {
                    return (
                      <tr
                        key={String(d.id)}
                        onClick={() => onSelectDoc(d.id)}
                        className={rowClass}
                      >
                        <td className="p-3.5">
                          <DocTypeBadge type={d.type} />
                        </td>
                        <td className="p-3.5 font-bold text-[#DC2626] whitespace-nowrap tabular-nums">
                          {formatRegDisplay(d)}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">
                          {d.subject || d.voucherProject || '-'}
                        </td>
                        <td className="p-3.5 text-slate-700">{d.assignee || '-'}</td>
                        <td className="p-3.5 font-bold text-[#DC2626] whitespace-nowrap tabular-nums">
                          {formatThaiDate(d.dueDate)}
                        </td>
                        {renderAttachmentCell(d)}
                        {renderActionCell(d)}
                      </tr>
                    );
                  }

                  // allDocs
                  return (
                    <tr
                      key={String(d.id)}
                      onClick={() => onSelectDoc(d.id)}
                      className={rowClass}
                    >
                      <td className="p-3.5">
                        <DocTypeBadge type={d.type} />
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700 tabular-nums">
                        {d.yearStr || '-'}
                      </td>
                      <td className="p-3.5 font-bold text-[#574F7D] tabular-nums">
                        {formatRegDisplay(d)}{' '}
                        <span className="font-normal text-xs text-slate-500">
                          ({d.docNumber || d.formCode || d.voucherNo || '-'})
                        </span>
                      </td>
                      <td className="p-3.5 max-w-md">
                        <div className="font-semibold text-slate-900">
                          {d.subject || d.formName || d.voucherProject || '-'}
                        </div>
                        <div className="text-xs text-slate-500">{getPartyLabel(d)}</div>
                        {renderProjectSyncTag(d)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <StatusHighlightBadge status={d.status} />
                          {d.ackStatus === 'รับทราบแล้ว' && d.ackTime && d.ackTime !== '-' && (
                            <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                              {formatThaiAckDateTime(d.ackTime)}
                            </span>
                          )}
                        </div>
                      </td>
                      {renderAttachmentCell(d)}
                      {renderActionCell(d)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
