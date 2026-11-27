import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileUp,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  ProcurementDocCategory,
  ProcurementSyncSelection,
  SarabanProcurementSyncRecord,
} from '../services/procurementSyncApi';
import {
  getProcurementQueueStatusMeta,
  validateProcurementSyncSelection,
} from '../services/procurementSyncApi';
import type {
  ProjectDocCategory,
  ProjectSyncSelection,
  SarabanProjectSyncRecord,
} from '../services/projectSyncApi';
import { getQueueStatusMeta, validateProjectSyncSelection } from '../services/projectSyncApi';
import type { DocAttachment, SarabanDoc } from '../types/saraban';
import { WORKFLOW_STATUSES } from '../types/saraban';
import {
  formatFileSizeLabel,
  formatRegDisplay,
  formatThaiDate,
  getDocAttachments,
  mergeDocAttachments,
  normalizeDateToISO,
  normalizeWhitespace,
  resolveManualAttachmentName,
  validateAttachmentUrl,
} from '../utils/sarabanUtils';
import { ProcurementSyncPanel } from './ProcurementSyncPanel';
import { ProjectSyncPanel } from './ProjectSyncPanel';
import { SmartAutocompleteInput } from './SmartAutocompleteInput';
import { DocTypeBadge, StatusHighlightBadge, UrgencyHighlightBadge } from './StatusBadges';

export interface QuickDetailSavePayload {
  id: string | number;
  assignee: string;
  status: string;
  dueDate: string;
  keptExistingAttachments: DocAttachment[];
  selectedFiles: File[];
  manualAttachments: DocAttachment[];
  trashRemovedDriveFiles: boolean;
}

interface DocumentDetailModalProps {
  doc: SarabanDoc | null;
  isAdmin: boolean;
  assigneeSuggestions: string[];
  isSavingQuickUpdate: boolean;
  uploadPhaseLabel: string;
  existingProjectSync?: SarabanProjectSyncRecord | null;
  isSyncingToProject?: boolean;
  isDeletingProjectQueue?: boolean;
  isRefreshingQueueStatus?: boolean;
  existingProcurementSync?: SarabanProcurementSyncRecord | null;
  isSyncingToProcurement?: boolean;
  isDeletingProcurementQueue?: boolean;
  isRefreshingProcurementQueueStatus?: boolean;
  onClose: () => void;
  onEdit: (doc: SarabanDoc) => void;
  onPrintCoverSheet: (doc: SarabanDoc) => void;
  onQuickSave: (payload: QuickDetailSavePayload) => Promise<void>;
  onSyncToProject?: (
    doc: SarabanDoc,
    selection: ProjectSyncSelection,
    quickFilePayload: QuickDetailSavePayload
  ) => Promise<void>;
  onDeleteProjectQueue?: (record: SarabanProjectSyncRecord) => Promise<void>;
  onRefreshQueueStatus?: (options?: { silent?: boolean }) => Promise<void>;
  onSyncToProcurement?: (
    doc: SarabanDoc,
    selection: ProcurementSyncSelection,
    quickFilePayload: QuickDetailSavePayload
  ) => Promise<void>;
  onDeleteProcurementQueue?: (record: SarabanProcurementSyncRecord) => Promise<void>;
  onRefreshProcurementQueueStatus?: (options?: { silent?: boolean }) => Promise<void>;
}

function buildInitialProjectSync(
  doc: SarabanDoc | null,
  existingSync?: SarabanProjectSyncRecord | null
): ProjectSyncSelection {
  const defaultCategory: ProjectDocCategory =
    doc?.type === 'vouchers'
      ? 'disbursement'
      : doc?.type === 'orders'
      ? 'tor_order'
      : 'other';
  return {
    enabled: false,
    fiscalYearFilter: existingSync?.fiscalYear ? String(existingSync.fiscalYear) : 'all',
    project: existingSync
      ? {
          id: existingSync.projectId,
          projectCode: existingSync.projectCode,
          fiscalYear: existingSync.fiscalYear,
          name: existingSync.projectName,
          status: '',
          contractNo: '',
        }
      : null,
    docCategory: existingSync?.docCategory || defaultCategory,
    fields: {
      installment: '1',
      result: 'pass',
      status: 'pending',
      remunerationType: 'inspection',
      ...(doc?.type === 'vouchers' && doc.voucherAmount
        ? { amount: String(doc.voucherAmount) }
        : {}),
    },
  };
}

function buildInitialProcurementSync(
  doc: SarabanDoc | null,
  existingSync?: SarabanProcurementSyncRecord | null
): ProcurementSyncSelection {
  const defaultCategory: ProcurementDocCategory =
    doc?.type === 'vouchers'
      ? 'disbursement'
      : doc?.type === 'orders'
      ? 'tor_order'
      : 'general_approval';
  const cleanOrderNo =
    doc?.type === 'orders' && doc.docNumber && doc.docNumber !== '-' ? String(doc.docNumber) : '';
  const cleanOrderDate =
    doc?.type === 'orders' && doc.docDate && doc.docDate !== '-'
      ? normalizeDateToISO(doc.docDate)
      : '';
  const cleanApprovalDate =
    doc?.docDate && doc.docDate !== '-'
      ? normalizeDateToISO(doc.docDate)
      : doc?.receiveDate && doc.receiveDate !== '-'
      ? normalizeDateToISO(doc.receiveDate)
      : '';
  const cleanAssignee =
    doc?.assignee && doc.assignee !== '-' ? normalizeWhitespace(doc.assignee) : '';
  const cleanVoucherNo =
    doc?.type === 'vouchers' && doc.voucherNo && doc.voucherNo !== '-' ? String(doc.voucherNo) : '';

  return {
    enabled: false,
    fiscalYearFilter:
      existingSync?.fiscalYear && existingSync.fiscalYear > 0
        ? String(existingSync.fiscalYear)
        : 'all',
    procurement: existingSync
      ? {
          id: existingSync.procurementId,
          projectCode: existingSync.projectCode,
          fiscalYear: existingSync.fiscalYear,
          name: existingSync.procurementName,
          status: '',
          statusLabel: '',
          method: '',
          budget: 0,
        }
      : null,
    docCategory:
      existingSync?.docCategory === 'ref_price'
        ? 'tor_approval'
        : existingSync?.docCategory || defaultCategory,
    fields: {
      ...(cleanApprovalDate ? { approvalDate: cleanApprovalDate } : {}),
      ...(cleanAssignee ? { responsibleName: cleanAssignee } : {}),
      ...(cleanOrderNo ? { orderNo: cleanOrderNo } : {}),
      ...(cleanOrderDate ? { orderDate: cleanOrderDate } : {}),
      ...(doc?.type === 'orders' && cleanAssignee ? { assigneeName: cleanAssignee } : {}),
      ...(doc?.type === 'vouchers' && doc.voucherAmount && Number(doc.voucherAmount) > 0
        ? { amount: String(doc.voucherAmount) }
        : {}),
      ...(cleanVoucherNo ? { voucherNo: cleanVoucherNo } : {}),
    },
  };
}

export function DocumentDetailModal({
  doc,
  isAdmin,
  assigneeSuggestions,
  isSavingQuickUpdate,
  uploadPhaseLabel,
  existingProjectSync = null,
  isSyncingToProject = false,
  isDeletingProjectQueue = false,
  isRefreshingQueueStatus = false,
  existingProcurementSync = null,
  isSyncingToProcurement = false,
  isDeletingProcurementQueue = false,
  isRefreshingProcurementQueueStatus = false,
  onClose,
  onEdit,
  onPrintCoverSheet,
  onQuickSave,
  onSyncToProject,
  onDeleteProjectQueue,
  onRefreshQueueStatus,
  onSyncToProcurement,
  onDeleteProcurementQueue,
  onRefreshProcurementQueueStatus,
}: DocumentDetailModalProps) {
  const [assignee, setAssignee] = useState('');
  const [status, setStatus] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attachmentMode, setAttachmentMode] = useState<'upload' | 'url'>('upload');
  const [keptExistingAttachments, setKeptExistingAttachments] = useState<DocAttachment[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [manualAttachments, setManualAttachments] = useState<DocAttachment[]>([]);
  const [manualFileUrl, setManualFileUrl] = useState('');
  const [manualFileName, setManualFileName] = useState('');
  const [attachmentUrlError, setAttachmentUrlError] = useState('');
  const [trashRemovedDriveFiles, setTrashRemovedDriveFiles] = useState(true);
  const [projectSync, setProjectSync] = useState<ProjectSyncSelection>(() =>
    buildInitialProjectSync(doc, existingProjectSync)
  );
  const [projectPushError, setProjectPushError] = useState('');
  const [procurementSync, setProcurementSync] = useState<ProcurementSyncSelection>(() =>
    buildInitialProcurementSync(doc, existingProcurementSync)
  );
  const [procurementPushError, setProcurementPushError] = useState('');
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!doc) return;
    setAssignee(doc.assignee || 'นิศาชล คงดี');
    setStatus(doc.status || 'ลงรับแล้ว');
    setDueDate(doc.dueDate && doc.dueDate !== '-' ? doc.dueDate : '');
    setAttachmentMode('upload');
    setKeptExistingAttachments(getDocAttachments(doc));
    setSelectedFiles([]);
    setManualAttachments([]);
    setManualFileUrl('');
    setManualFileName('');
    setAttachmentUrlError('');
    setTrashRemovedDriveFiles(true);
    setCopiedLinkKey(null);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setProjectSync(buildInitialProjectSync(doc, existingProjectSync));
    setProjectPushError('');
    setProcurementSync(buildInitialProcurementSync(doc, existingProcurementSync));
    setProcurementPushError('');
    if (existingProjectSync && onRefreshQueueStatus) {
      onRefreshQueueStatus({ silent: true });
    }
    if (existingProcurementSync && onRefreshProcurementQueueStatus) {
      onRefreshProcurementQueueStatus({ silent: true });
    }
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!doc) return;
    if (!existingProjectSync && !projectSync.enabled) {
      setProjectSync(buildInitialProjectSync(doc, null));
    }
  }, [doc, existingProjectSync, projectSync.enabled]);

  useEffect(() => {
    if (!doc) return;
    if (!existingProcurementSync && !procurementSync.enabled) {
      setProcurementSync(buildInitialProcurementSync(doc, null));
    }
  }, [doc, existingProcurementSync, procurementSync.enabled]);

  if (!doc) return null;

  const originalAttachments = getDocAttachments(doc);
  const keptUrlSet = new Set(keptExistingAttachments.map((a) => a.fileUrl));
  const manualUrlValidation = validateAttachmentUrl(manualFileUrl);
  const hasManualUrlInput = manualFileUrl.trim() !== '';

  const getCombinedManualAttachments = (): DocAttachment[] => {
    if (hasManualUrlInput && manualUrlValidation.valid && manualUrlValidation.normalizedUrl) {
      return mergeDocAttachments(manualAttachments, [
        {
          fileName: resolveManualAttachmentName(
            manualFileName,
            manualUrlValidation.normalizedUrl
          ),
          fileUrl: manualUrlValidation.normalizedUrl,
        },
      ]);
    }
    return manualAttachments;
  };

  const handleAddManualAttachment = () => {
    if (!hasManualUrlInput) return;
    if (!manualUrlValidation.valid || !manualUrlValidation.normalizedUrl) {
      setAttachmentUrlError(manualUrlValidation.error || 'กรุณาตรวจสอบลิงก์ URL ไฟล์แนบ');
      return;
    }
    setAttachmentUrlError('');
    setManualAttachments((prev) =>
      mergeDocAttachments(prev, [
        {
          fileName: resolveManualAttachmentName(
            manualFileName,
            manualUrlValidation.normalizedUrl
          ),
          fileUrl: manualUrlValidation.normalizedUrl,
        },
      ])
    );
    setManualFileUrl('');
    setManualFileName('');
  };

  const hasPendingAttachmentChanges =
    keptExistingAttachments.length !== originalAttachments.length ||
    selectedFiles.length > 0 ||
    manualAttachments.length > 0 ||
    hasManualUrlInput;

  const hasPendingChanges =
    normalizeWhitespace(assignee) !== normalizeWhitespace(doc.assignee || 'นิศาชล คงดี') ||
    status !== (doc.status || 'ลงรับแล้ว') ||
    dueDate !== (doc.dueDate && doc.dueDate !== '-' ? doc.dueDate : '') ||
    hasPendingAttachmentChanges;

  const buildQuickPayload = (): QuickDetailSavePayload => ({
    id: doc.id,
    assignee: normalizeWhitespace(assignee) || 'นิศาชล คงดี',
    status,
    dueDate,
    keptExistingAttachments,
    selectedFiles,
    manualAttachments: getCombinedManualAttachments(),
    trashRemovedDriveFiles:
      keptExistingAttachments.length < originalAttachments.length ? trashRemovedDriveFiles : false,
  });

  const handleSaveDetails = async () => {
    if (hasManualUrlInput && !manualUrlValidation.valid) {
      setAttachmentUrlError(manualUrlValidation.error || 'กรุณาตรวจสอบลิงก์ URL ไฟล์แนบ');
      return;
    }
    setAttachmentUrlError('');
    await onQuickSave(buildQuickPayload());
  };

  const handleCopyAttachmentLink = async (rawUrl: string) => {
    const url = String(rawUrl || '').trim();
    if (!url) return;

    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedLinkKey(url);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedLinkKey(null);
        copyTimerRef.current = null;
      }, 2200);
    }
  };

  const handlePushProjectSync = async () => {
    if (!onSyncToProject) return;
    setProjectPushError('');
    if (hasManualUrlInput && !manualUrlValidation.valid) {
      const urlErr = manualUrlValidation.error || 'กรุณาตรวจสอบลิงก์ URL ไฟล์แนบ';
      setAttachmentUrlError(urlErr);
      setProjectPushError(urlErr);
      return;
    }
    setAttachmentUrlError('');
    const err = validateProjectSyncSelection({ ...projectSync, enabled: true });
    if (err) {
      setProjectPushError(err);
      return;
    }
    try {
      await onSyncToProject(doc, projectSync, buildQuickPayload());
    } catch (pushErr) {
      setProjectPushError(
        pushErr instanceof Error
          ? pushErr.message
          : 'ไม่สามารถส่งข้อมูลเข้าระบบงานโครงการได้'
      );
    }
  };

  const handlePushProcurementSync = async () => {
    if (!onSyncToProcurement) return;
    setProcurementPushError('');
    if (hasManualUrlInput && !manualUrlValidation.valid) {
      const urlErr = manualUrlValidation.error || 'กรุณาตรวจสอบลิงก์ URL ไฟล์แนบ';
      setAttachmentUrlError(urlErr);
      setProcurementPushError(urlErr);
      return;
    }
    setAttachmentUrlError('');
    const err = validateProcurementSyncSelection({ ...procurementSync, enabled: true });
    if (err) {
      setProcurementPushError(err);
      return;
    }
    try {
      await onSyncToProcurement(doc, procurementSync, buildQuickPayload());
    } catch (pushErr) {
      setProcurementPushError(
        pushErr instanceof Error
          ? pushErr.message
          : 'ไม่สามารถส่งข้อมูลเข้าระบบงานจัดซื้อจัดจ้างได้'
      );
    }
  };

  const supportsProjectSync = ['outgoing', 'memos', 'orders', 'vouchers'].includes(doc.type);

  return (
    <div className="no-print fixed inset-0 z-50 bg-[#2F2A44]/55 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-white/85 ring-1 ring-[#C9C4DC]/60 shadow-2xl w-full max-w-2xl max-h-[93dvh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#B5B1C8] px-5 sm:px-6 py-4 text-[#242038] flex items-center justify-between border-none shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <DocTypeBadge type={doc.type} />
            <h3 className="font-bold text-base sm:text-lg truncate">
              รายละเอียดเอกสารสารบรรณ
            </h3>
          </div>
          <button
            type="button"
            disabled={isSavingQuickUpdate}
            onClick={onClose}
            aria-label="ปิดรายละเอียด"
            className="w-8 h-8 rounded-lg bg-white/85 hover:bg-white border border-white/90 text-[#242038] flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 saraban-scroll">
          {/* Highlight Metadata Strip */}
          <div className="p-4 rounded-xl border border-[#E5E2F0] bg-[#FAF9FC] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#574F7D]">
                {doc.regNo && doc.regNo !== '-'
                  ? 'เลขรับกองช่าง'
                  : doc.type === 'vouchers'
                  ? 'เลขที่ผู้เบิก'
                  : 'เลขที่หนังสือ'}
              </div>
              <div className="text-lg font-bold text-[#242038] tabular-nums">
                {doc.regNo && doc.regNo !== '-'
                  ? formatRegDisplay(doc)
                  : doc.voucherNo || doc.docNumber || doc.formCode || '-'}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {doc.type === 'incoming' && <UrgencyHighlightBadge urgency={doc.urgency} />}
              {doc.status && <StatusHighlightBadge status={doc.status} />}
              {existingProjectSync && (() => {
                const statusMeta = getQueueStatusMeta(existingProjectSync.queueStatus);
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums whitespace-nowrap ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.status === 'approved' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : statusMeta.status === 'rejected' ? (
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      โครงการ · {statusMeta.shortLabel}: {existingProjectSync.queueId}
                    </span>
                  </span>
                );
              })()}
              {existingProcurementSync && (() => {
                const statusMeta = getProcurementQueueStatusMeta(
                  existingProcurementSync.queueStatus
                );
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums whitespace-nowrap ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.status === 'approved' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : statusMeta.status === 'rejected' ? (
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {statusMeta.shortLabel}: {existingProcurementSync.queueId}
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Detail Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-[#F8FAFC] p-4 rounded-xl border border-slate-200">
            {doc.yearStr && (
              <div>
                <span className="text-xs text-slate-500 block">
                  {doc.type === 'memos' || doc.type === 'vouchers' ? 'ปีงบประมาณ' : 'ปีปฏิทิน'}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">{doc.yearStr}</span>
              </div>
            )}

            {doc.type === 'incoming' && (
              <>
                <div>
                  <span className="text-xs text-slate-500 block">เลขรับส่วนกลาง</span>
                  <span className="font-semibold text-slate-900">{doc.centralRegNo || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">วันที่ลงรับ</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatThaiDate(doc.receiveDate)}
                  </span>
                </div>
              </>
            )}

            {doc.docNumber && (
              <div>
                <span className="text-xs text-slate-500 block">เลขที่หนังสือ</span>
                <span className="font-semibold text-slate-900">
                  {doc.docNumber} (ลงวันที่ {formatThaiDate(doc.docDate)})
                </span>
              </div>
            )}

            {doc.type === 'memos' && (
              <div>
                <span className="text-xs text-slate-500 block">งาน</span>
                <span className="font-semibold text-slate-900">{doc.memoWork || '-'}</span>
              </div>
            )}

            {doc.type === 'forms' && (
              <>
                <div>
                  <span className="text-xs text-slate-500 block">งาน</span>
                  <span className="font-semibold text-slate-900">{doc.memoWork || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">เลขที่แบบ</span>
                  <span className="font-semibold text-slate-900">{doc.formCode || '-'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-slate-500 block">ชื่อแบบฟอร์ม</span>
                  <span className="font-semibold text-slate-900">{doc.formName || '-'}</span>
                </div>
              </>
            )}

            {doc.type === 'vouchers' && (
              <>
                <div>
                  <span className="text-xs text-slate-500 block">วันที่จัดทำ</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatThaiDate(doc.voucherDate)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">ผู้จัดทำ</span>
                  <span className="font-semibold text-slate-900">{doc.voucherMaker || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">ประเภทฎีกา</span>
                  <span className="font-semibold text-slate-900">{doc.voucherCategory || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">ผู้รับเงิน</span>
                  <span className="font-semibold text-slate-900">{doc.voucherPayee || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">จำนวนเงินขอเบิก</span>
                  <span className="font-bold text-[#574F7D] tabular-nums">
                    {Number(doc.voucherAmount || 0).toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    บาท
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-slate-500 block">ชื่อโครงการ</span>
                  <span className="font-semibold text-slate-900">{doc.voucherProject || '-'}</span>
                </div>
              </>
            )}

            {doc.subject && (
              <div className="sm:col-span-2">
                <span className="text-xs text-slate-500 block">เรื่อง</span>
                <span className="font-semibold text-slate-900">{doc.subject}</span>
              </div>
            )}

            {doc.sender && (
              <div className="sm:col-span-2">
                <span className="text-xs text-slate-500 block">ผู้ส่ง / ผู้รับ / เรียน</span>
                <span className="font-semibold text-slate-900">{doc.sender}</span>
              </div>
            )}

            {!isAdmin && doc.assignee && (
              <div>
                <span className="text-xs text-slate-500 block">ผู้รับผิดชอบ</span>
                <span className="font-semibold text-slate-900">{doc.assignee}</span>
              </div>
            )}

            {!isAdmin && doc.dueDate && (
              <div>
                <span className="text-xs text-slate-500 block">กำหนดแล้วเสร็จ</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatThaiDate(doc.dueDate)}
                </span>
              </div>
            )}
          </div>

          {/* Admin Quick Assignment + Attachment Update Panel */}
          {isAdmin ? (
            <div className="p-4 rounded-xl border border-[#E2DFEE] bg-[#FAF9FC] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#242038]">
                  <FileUp className="w-4 h-4 text-[#6B6293]" />
                  <span>มอบหมายงาน / เปลี่ยนสถานะ / แนบไฟล์เพิ่มเติม</span>
                </div>
                {hasPendingChanges && (
                  <span className="px-2 py-0.5 rounded-md border border-[#F59E0B] bg-[#FEF3C7] text-[#78350F] text-[11px] font-bold shadow-[0_0_10px_rgba(245,158,11,0.5),inset_0_0_4px_rgba(252,211,77,0.4)]">
                    มีการแก้ไขที่ยังไม่บันทึก
                  </span>
                )}
              </div>

              {doc.type !== 'forms' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#242038] mb-1">
                      ผู้รับผิดชอบ
                    </label>
                    <SmartAutocompleteInput
                      value={assignee}
                      onChange={setAssignee}
                      suggestions={assigneeSuggestions}
                      placeholder="ระบุชื่อผู้รับผิดชอบ"
                      className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] focus:border-[#6B6293] bg-white text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#242038] mb-1">
                      สถานะดำเนินการ
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] focus:border-[#6B6293] bg-white text-sm font-semibold focus:outline-none"
                    >
                      {WORKFLOW_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#242038] mb-1">
                      กำหนดแล้วเสร็จ
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] focus:border-[#6B6293] bg-white text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {originalAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-[#242038]">
                      ไฟล์แนบปัจจุบัน ({keptExistingAttachments.length}/{originalAttachments.length} ไฟล์)
                    </div>
                    {originalAttachments.map((att, idx) => {
                      const isKept = keptUrlSet.has(att.fileUrl);
                      const isCopied = copiedLinkKey === att.fileUrl;
                      if (!isKept) {
                        return (
                          <div
                            key={`${att.fileUrl}-${idx}`}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]"
                          >
                            <span className="text-xs font-semibold text-[#78350F] truncate">
                              ไฟล์ “{att.fileName}” จะถูกนำออกเมื่อกดบันทึก
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setKeptExistingAttachments((prev) =>
                                  mergeDocAttachments(prev, [att])
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#F59E0B] text-[#78350F] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>คืนค่า</span>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${att.fileUrl}-${idx}`}
                          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-[#E5E2F0]"
                        >
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[#574F7D] hover:underline flex items-center gap-2 min-w-0 flex-1"
                          >
                            <Paperclip className="w-4 h-4 shrink-0" />
                            <span className="truncate">
                              {idx + 1}. {att.fileName || 'เปิดดูไฟล์ใน Drive'}
                            </span>
                          </a>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyAttachmentLink(att.fileUrl)}
                              title="คัดลอกลิงก์ URL ของไฟล์แนบเพื่อส่งให้ผู้อื่น"
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                                isCopied
                                  ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                                  : 'bg-[#F1EFF7] hover:bg-[#E4E0F2] text-[#4A4173] border-[#C9C4DC]'
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>คัดลอกแล้ว</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>คัดลอกลิงก์</span>
                                </>
                              )}
                            </button>
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>เปิดดู</span>
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                setKeptExistingAttachments((prev) =>
                                  prev.filter((item) => item.fileUrl !== att.fileUrl)
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white border border-[#FCA5A5] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>นำออก</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {keptExistingAttachments.length < originalAttachments.length && (
                      <label className="flex items-start gap-2 p-2.5 rounded-xl bg-[#FAF9FC] border border-[#E5E2F0] cursor-pointer hover:bg-[#F1EFF7] transition-colors">
                        <input
                          type="checkbox"
                          checked={trashRemovedDriveFiles}
                          onChange={(e) => setTrashRemovedDriveFiles(e.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 accent-[#6B6293] rounded"
                        />
                        <span className="text-[11px] font-semibold text-[#242038] leading-snug">
                          ย้ายไฟล์ที่นำออกใน Google Drive ลงถังขยะด้วย (เฉพาะไฟล์ในโฟลเดอร์ระบบ)
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <span className="text-xs font-bold text-[#242038]">
                    {originalAttachments.length > 0 ? 'เพิ่มไฟล์แนบ (คงไฟล์เดิมไว้)' : 'แนบไฟล์เอกสาร'}
                  </span>
                  <div
                    role="tablist"
                    aria-label="เลือกวิธีแนบไฟล์"
                    className="inline-flex rounded-xl bg-white p-0.5 border border-[#D7D2E6]"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={attachmentMode === 'upload'}
                      onClick={() => {
                        setAttachmentMode('upload');
                        setAttachmentUrlError('');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                        attachmentMode === 'upload'
                          ? 'bg-[#6B6293] text-white shadow-xs'
                          : 'text-[#574F7D] hover:bg-[#F4F2FA]'
                      }`}
                    >
                      <FileUp className="w-3 h-3" />
                      <span>อัปโหลดไฟล์</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={attachmentMode === 'url'}
                      onClick={() => {
                        setAttachmentMode('url');
                        setAttachmentUrlError('');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                        attachmentMode === 'url'
                          ? 'bg-[#6B6293] text-white shadow-xs'
                          : 'text-[#574F7D] hover:bg-[#F4F2FA]'
                      }`}
                    >
                      <Link2 className="w-3 h-3" />
                      <span>แปะลิงก์ URL (ไฟล์ใหญ่)</span>
                    </button>
                  </div>
                </div>

                {attachmentMode === 'upload' ? (
                  <>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        if (picked.length > 0) {
                          setSelectedFiles((prev) => {
                            const seen = new Set(
                              prev.map((f) => `${f.name}|${f.size}|${f.lastModified}`)
                            );
                            const next = [...prev];
                            picked.forEach((f) => {
                              const key = `${f.name}|${f.size}|${f.lastModified}`;
                              if (!seen.has(key)) {
                                seen.add(key);
                                next.push(f);
                              }
                            });
                            return next;
                          });
                          setAttachmentUrlError('');
                        }
                        e.target.value = '';
                      }}
                      className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#6B6293] file:text-white hover:file:bg-[#574F7D] bg-white rounded-xl border border-[#C9C4DC] p-1.5"
                    />

                    {selectedFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-[#14532D]">
                          <span>ไฟล์ใหม่ที่จะอัปโหลดเพิ่ม ({selectedFiles.length} ไฟล์)</span>
                          <button
                            type="button"
                            onClick={() => setSelectedFiles([])}
                            className="text-[#7F1D1D] underline font-semibold"
                          >
                            ล้างไฟล์ทั้งหมด
                          </button>
                        </div>
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="text-xs font-semibold text-[#14532D] bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              {idx + 1}. {file.name} ({formatFileSizeLabel(file.size)})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-[#7F1D1D] hover:underline shrink-0"
                            >
                              นำออก
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <input
                          type="url"
                          value={manualFileUrl}
                          onChange={(e) => {
                            setManualFileUrl(e.target.value);
                            if (attachmentUrlError) setAttachmentUrlError('');
                          }}
                          placeholder="วางลิงก์ URL เช่น https://drive.google.com/file/d/..."
                          className={`w-full px-3 py-2 rounded-xl border bg-white text-xs sm:text-sm focus:outline-none transition-colors ${
                            (attachmentUrlError || (hasManualUrlInput && !manualUrlValidation.valid))
                              ? 'border-rose-400 focus:border-rose-500 bg-rose-50/40'
                              : 'border-[#C9C4DC] focus:border-[#6B6293]'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={manualFileName}
                          onChange={(e) => setManualFileName(e.target.value)}
                          placeholder="ชื่อไฟล์ (ไม่บังคับ)"
                          className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] focus:border-[#6B6293] bg-white text-xs sm:text-sm focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          disabled={!hasManualUrlInput || !manualUrlValidation.valid}
                          onClick={handleAddManualAttachment}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-bold whitespace-nowrap disabled:opacity-45 transition-colors"
                        >
                          + เพิ่มลิงก์
                        </button>
                      </div>
                    </div>

                    {(attachmentUrlError || (hasManualUrlInput && !manualUrlValidation.valid)) && (
                      <p className="text-xs font-semibold text-rose-700">
                        {attachmentUrlError || manualUrlValidation.error}
                      </p>
                    )}

                    {hasManualUrlInput && manualUrlValidation.valid && (
                      <div className="text-xs font-semibold text-[#14532D] bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate flex items-center gap-1.5 min-w-0">
                          <Link2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            ลิงก์ใหม่ที่จะบันทึก: {resolveManualAttachmentName(manualFileName, manualUrlValidation.normalizedUrl)}
                          </span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={manualUrlValidation.normalizedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#15803D] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>ทดสอบลิงก์</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setManualFileUrl('');
                              setManualFileName('');
                              setAttachmentUrlError('');
                            }}
                            className="text-[#7F1D1D] underline"
                          >
                            ล้างช่อง
                          </button>
                        </div>
                      </div>
                    )}

                    {manualAttachments.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-[#14532D]">
                          <span>ลิงก์ที่เพิ่มในคิวแล้ว ({manualAttachments.length} ลิงก์)</span>
                          <button
                            type="button"
                            onClick={() => setManualAttachments([])}
                            className="text-[#7F1D1D] underline font-semibold"
                          >
                            ล้างลิงก์ทั้งหมด
                          </button>
                        </div>
                        {manualAttachments.map((att, idx) => (
                          <div
                            key={`${att.fileUrl}-${idx}`}
                            className="text-xs font-semibold text-[#14532D] bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                          >
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <Link2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {idx + 1}. {att.fileName}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setManualAttachments((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-[#7F1D1D] hover:underline shrink-0"
                            >
                              นำออก
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {!hasManualUrlInput && manualAttachments.length === 0 && (
                      <p className="text-[11px] text-[#574F7D]">
                        สำหรับไฟล์ขนาดใหญ่ ให้อัปโหลดขึ้น Google Drive ก่อนแล้วนำลิงก์มาวางที่นี่ เพิ่มได้หลายลิงก์ (แนะนำเปิดสิทธิ์แชร์เป็น “ทุกคนที่มีลิงก์สามารถดูได้”)
                      </p>
                    )}
                  </div>
                )}

                {attachmentMode === 'upload' && manualAttachments.length > 0 && (
                  <div className="text-xs font-semibold text-[#14532D] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-2 rounded-lg">
                    มีลิงก์ URL ที่เพิ่มไว้แล้วอีก {manualAttachments.length} ลิงก์ (จะบันทึกแนบรวมไปด้วย)
                  </div>
                )}
                {attachmentMode === 'url' && selectedFiles.length > 0 && (
                  <div className="text-xs font-semibold text-[#14532D] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-2 rounded-lg">
                    มีไฟล์จากเครื่องที่เลือกไว้แล้วอีก {selectedFiles.length} ไฟล์ (จะอัปโหลดรวมไปด้วย)
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-[#E5E2F0] bg-white space-y-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="w-4 h-4 text-[#6B6293] shrink-0" />
                <span className="font-bold text-[#242038]">
                  {originalAttachments.length > 0
                    ? `ไฟล์แนบทั้งหมด (${originalAttachments.length} ไฟล์)`
                    : 'ไฟล์แนบ: ไม่มีเอกสารแนบ'}
                </span>
              </div>
              {originalAttachments.length > 0 && (
                <div className="space-y-2">
                  {originalAttachments.map((att, idx) => {
                    const isCopied = copiedLinkKey === att.fileUrl;
                    return (
                      <div
                        key={`${att.fileUrl}-${idx}`}
                        className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF9FC] border border-[#E5E2F0]"
                      >
                        <span className="text-xs sm:text-sm font-medium text-slate-700 truncate min-w-0 flex-1">
                          {originalAttachments.length > 1 ? `${idx + 1}. ` : ''}
                          {att.fileName || 'เปิดดูไฟล์'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyAttachmentLink(att.fileUrl)}
                            title="คัดลอกลิงก์ URL ของไฟล์แนบเพื่อส่งให้ผู้อื่น"
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                              isCopied
                                ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                                : 'bg-[#F1EFF7] hover:bg-[#E4E0F2] text-[#4A4173] border-[#C9C4DC]'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>คัดลอกลิงก์</span>
                              </>
                            )}
                          </button>
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>เปิดดูไฟล์</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isAdmin && supportsProjectSync && onSyncToProject && (
            <ProjectSyncPanel
              value={projectSync}
              onChange={(next) => {
                setProjectPushError('');
                setProjectSync(next);
              }}
              existingSync={existingProjectSync}
              disabled={isSavingQuickUpdate}
              onPushNow={handlePushProjectSync}
              isPushingNow={isSyncingToProject}
              pushError={projectPushError}
              onDeleteSyncedQueue={onDeleteProjectQueue}
              isDeletingQueue={isDeletingProjectQueue}
              onRefreshQueueStatus={
                onRefreshQueueStatus ? () => onRefreshQueueStatus({ silent: false }) : undefined
              }
              isRefreshingQueueStatus={isRefreshingQueueStatus}
            />
          )}

          {isAdmin && supportsProjectSync && onSyncToProcurement && (
            <ProcurementSyncPanel
              value={procurementSync}
              onChange={(next) => {
                setProcurementPushError('');
                setProcurementSync(next);
              }}
              existingSync={existingProcurementSync}
              disabled={isSavingQuickUpdate}
              onPushNow={handlePushProcurementSync}
              isPushingNow={isSyncingToProcurement}
              pushError={procurementPushError}
              onDeleteSyncedQueue={onDeleteProcurementQueue}
              isDeletingQueue={isDeletingProcurementQueue}
              onRefreshQueueStatus={
                onRefreshProcurementQueueStatus
                  ? () => onRefreshProcurementQueueStatus({ silent: false })
                  : undefined
              }
              isRefreshingQueueStatus={isRefreshingProcurementQueueStatus}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 bg-[#FAF9FC] border-t border-[#ECEAF4] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isSavingQuickUpdate}
            onClick={() => onPrintCoverSheet(doc)}
            className="px-4 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] border border-[#524A75] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ใบปะหน้า</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  disabled={isSavingQuickUpdate}
                  onClick={() => {
                    onClose();
                    onEdit(doc);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#78350F] text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  <span>แก้ไขทั้งหมด</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingQuickUpdate || !hasPendingChanges}
                  onClick={handleSaveDetails}
                  className="px-4 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] border border-[#14532D] text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSavingQuickUpdate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadPhaseLabel || 'กำลังบันทึก...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกข้อมูล</span>
                    </>
                  )}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={isSavingQuickUpdate}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

