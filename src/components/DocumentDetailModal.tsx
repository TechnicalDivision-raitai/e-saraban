import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileUp,
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
import { useEffect, useState } from 'react';
import type {
  ProjectDocCategory,
  ProjectSyncSelection,
  SarabanProjectSyncRecord,
} from '../services/projectSyncApi';
import { getQueueStatusMeta, validateProjectSyncSelection } from '../services/projectSyncApi';
import type { SarabanDoc } from '../types/saraban';
import { WORKFLOW_STATUSES } from '../types/saraban';
import { formatRegDisplay, formatThaiDate, normalizeWhitespace } from '../utils/sarabanUtils';
import { ProjectSyncPanel } from './ProjectSyncPanel';
import { SmartAutocompleteInput } from './SmartAutocompleteInput';
import { DocTypeBadge, StatusHighlightBadge, UrgencyHighlightBadge } from './StatusBadges';

export interface QuickDetailSavePayload {
  id: string | number;
  assignee: string;
  status: string;
  dueDate: string;
  selectedFile: File | null;
  removeExistingAttachment: boolean;
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
  onClose,
  onEdit,
  onPrintCoverSheet,
  onQuickSave,
  onSyncToProject,
  onDeleteProjectQueue,
  onRefreshQueueStatus,
}: DocumentDetailModalProps) {
  const [assignee, setAssignee] = useState('');
  const [status, setStatus] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const [projectSync, setProjectSync] = useState<ProjectSyncSelection>(() =>
    buildInitialProjectSync(doc, existingProjectSync)
  );
  const [projectPushError, setProjectPushError] = useState('');

  useEffect(() => {
    if (!doc) return;
    setAssignee(doc.assignee || 'นิศาชล คงดี');
    setStatus(doc.status || 'ลงรับแล้ว');
    setDueDate(doc.dueDate && doc.dueDate !== '-' ? doc.dueDate : '');
    setSelectedFile(null);
    setRemoveExistingAttachment(false);
    setProjectSync(buildInitialProjectSync(doc, existingProjectSync));
    setProjectPushError('');
    if (existingProjectSync && onRefreshQueueStatus) {
      onRefreshQueueStatus({ silent: true });
    }
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!doc) return;
    if (!existingProjectSync && !projectSync.enabled) {
      setProjectSync(buildInitialProjectSync(doc, null));
    }
  }, [doc, existingProjectSync, projectSync.enabled]);

  if (!doc) return null;

  const hasExistingAttachment = Boolean(doc.fileData && doc.fileData.trim() !== '');
  const hasPendingChanges =
    normalizeWhitespace(assignee) !== normalizeWhitespace(doc.assignee || 'นิศาชล คงดี') ||
    status !== (doc.status || 'ลงรับแล้ว') ||
    dueDate !== (doc.dueDate && doc.dueDate !== '-' ? doc.dueDate : '') ||
    selectedFile !== null ||
    removeExistingAttachment;

  const handleSaveDetails = async () => {
    await onQuickSave({
      id: doc.id,
      assignee: normalizeWhitespace(assignee) || 'นิศาชล คงดี',
      status,
      dueDate,
      selectedFile,
      removeExistingAttachment,
    });
  };

  const handlePushProjectSync = async () => {
    if (!onSyncToProject) return;
    setProjectPushError('');
    const err = validateProjectSyncSelection({ ...projectSync, enabled: true });
    if (err) {
      setProjectPushError(err);
      return;
    }
    try {
      await onSyncToProject(doc, projectSync, {
        id: doc.id,
        assignee: normalizeWhitespace(assignee) || 'นิศาชล คงดี',
        status,
        dueDate,
        selectedFile,
        removeExistingAttachment,
      });
    } catch (pushErr) {
      setProjectPushError(
        pushErr instanceof Error
          ? pushErr.message
          : 'ไม่สามารถส่งข้อมูลเข้าระบบงานโครงการได้'
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
                      {statusMeta.shortLabel}: {existingProjectSync.queueId}
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
                {hasExistingAttachment && !removeExistingAttachment && !selectedFile && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-[#E5E2F0]">
                    <a
                      href={doc.fileData}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#574F7D] hover:underline flex items-center gap-2 min-w-0"
                    >
                      <Paperclip className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        ไฟล์แนบปัจจุบัน: {doc.fileName || 'เปิดดูไฟล์ใน Drive'}
                      </span>
                    </a>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={doc.fileData}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิดดู</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setRemoveExistingAttachment(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white border border-[#FCA5A5] text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>นำออก</span>
                      </button>
                    </div>
                  </div>
                )}

                {hasExistingAttachment && removeExistingAttachment && !selectedFile && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]">
                    <span className="text-xs font-semibold text-[#78350F]">
                      ไฟล์แนบเดิมจะถูกนำออกเมื่อกดบันทึก
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingAttachment(false)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#F59E0B] text-[#78350F] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>ยกเลิก</span>
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#6B6293] file:text-white hover:file:bg-[#574F7D] bg-white rounded-xl border border-[#C9C4DC] p-1.5"
                />

                {selectedFile && (
                  <div className="text-xs font-semibold text-[#14532D] bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 rounded-lg flex items-center justify-between">
                    <span className="truncate">
                      ไฟล์ใหม่ที่จะอัปโหลด: {selectedFile.name} (
                      {(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-[#7F1D1D] underline ml-2 shrink-0"
                    >
                      ล้างไฟล์
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-[#E5E2F0] bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 text-sm">
                <Paperclip className="w-4 h-4 text-[#6B6293] shrink-0" />
                <span className="font-medium text-slate-700 truncate">
                  ไฟล์แนบ: {doc.fileName || 'ไม่มีเอกสารแนบ'}
                </span>
              </div>
              {hasExistingAttachment && (
                <a
                  href={doc.fileData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>เปิดดูไฟล์</span>
                </a>
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

