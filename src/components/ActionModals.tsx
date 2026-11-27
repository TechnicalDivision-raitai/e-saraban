import { AlertTriangle, Check, Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SarabanDoc } from '../types/saraban';
import { WORKFLOW_STATUSES } from '../types/saraban';
import { getDocAttachments } from '../utils/sarabanUtils';

interface DeleteDocModalProps {
  doc: SarabanDoc | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirmDelete: (
    mode: 'attachment' | 'record',
    options: { trashDriveFiles: boolean }
  ) => Promise<void>;
}

export function DeleteDocModal({
  doc,
  isBusy,
  onClose,
  onConfirmDelete,
}: DeleteDocModalProps) {
  const [mode, setMode] = useState<'attachment' | 'record'>('record');
  const [trashDriveFiles, setTrashDriveFiles] = useState(true);

  useEffect(() => {
    if (!doc) return;
    const hasAttachment = getDocAttachments(doc).length > 0;
    setMode(hasAttachment ? 'attachment' : 'record');
    setTrashDriveFiles(hasAttachment);
  }, [doc]);

  if (!doc) return null;
  const attachments = getDocAttachments(doc);
  const hasAttachment = attachments.length > 0;

  return (
    <div className="no-print fixed inset-0 z-50 bg-[#2F2A44]/55 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#FCA5A5] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#991B1B] px-5 py-4 text-white flex items-center justify-between border-none">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-5 h-5" />
            <span>เลือกสิ่งที่ต้องการลบ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="w-8 h-8 rounded-lg bg-[#7F1D1D] hover:bg-[#DC2626] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {hasAttachment
              ? 'เลือกว่าต้องการลบเฉพาะไฟล์แนบ หรือลบรายการหนังสือทั้งหมดออกจากฐานข้อมูล'
              : 'รายการนี้ไม่มีไฟล์แนบ คุณสามารถลบรายการหนังสือนี้ออกจากฐานข้อมูลได้'}
          </p>

          <div className="space-y-2.5">
            {hasAttachment && (
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  mode === 'attachment'
                    ? 'border-[#F59E0B] bg-[#FEF3C7]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="deleteMode"
                  checked={mode === 'attachment'}
                  onChange={() => setMode('attachment')}
                  className="mt-0.5 accent-[#D97706]"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    เอาไฟล์แนบออกจากรายการ (เก็บหนังสือไว้)
                  </div>
                  <div className="text-xs text-slate-600">
                    {attachments.length > 1
                      ? `ล้างลิงก์ไฟล์ทั้ง ${attachments.length} ไฟล์ (${attachments.map((a) => a.fileName).join(', ')}) ออกจากแถวนี้`
                      : `ล้างลิงก์ไฟล์ ${attachments[0]?.fileName || 'ไฟล์แนบ'} ออกจากแถวนี้`}
                  </div>
                </div>
              </label>
            )}

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                mode === 'record'
                  ? 'border-[#EF4444] bg-[#FEE2E2]'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="deleteMode"
                checked={mode === 'record'}
                onChange={() => setMode('record')}
                className="mt-0.5 accent-[#DC2626]"
              />
              <div>
                <div className="text-sm font-bold text-[#7F1D1D]">
                  ลบรายการหนังสือทั้งหมด
                </div>
                <div className="text-xs text-[#991B1B]">
                  ลบข้อมูล: {doc.subject || doc.voucherProject || doc.formName || doc.docNumber}
                </div>
              </div>
            </label>

            {hasAttachment && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E5E2F0] bg-[#FAF9FC] cursor-pointer hover:bg-[#F4F2FA] transition-colors">
                <input
                  type="checkbox"
                  checked={trashDriveFiles}
                  onChange={(e) => setTrashDriveFiles(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#6B6293] rounded"
                />
                <div className="text-xs leading-relaxed">
                  <div className="font-bold text-[#242038]">
                    ย้ายไฟล์ต้นฉบับใน Google Drive ลงถังขยะด้วย
                  </div>
                  <div className="text-slate-600">
                    ลบเฉพาะไฟล์ที่อัปโหลดอยู่ในโฟลเดอร์ระบบ (กู้คืนได้จากถังขยะ Drive ภายใน 30 วัน ส่วนลิงก์ภายนอกจะไม่ถูกลบ)
                  </div>
                </div>
              </label>
            )}
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirmDelete(mode, { trashDriveFiles: hasAttachment && trashDriveFiles })}
            className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>ยืนยันการลบ</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface StatusUpdateModalProps {
  doc: SarabanDoc | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirmStatus: (newStatus: string) => Promise<void>;
}

export function StatusUpdateModal({
  doc,
  isBusy,
  onClose,
  onConfirmStatus,
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState('ลงรับแล้ว');

  useEffect(() => {
    if (doc) {
      setSelectedStatus(doc.status || 'ลงรับแล้ว');
    }
  }, [doc]);

  if (!doc) return null;

  return (
    <div className="no-print fixed inset-0 z-50 bg-[#2F2A44]/55 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-white/85 ring-1 ring-[#C9C4DC]/60 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#B5B1C8] px-5 py-4 text-[#242038] flex items-center justify-between border-none">
          <h3 className="font-bold text-base">เปลี่ยนสถานะการดำเนินงาน</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="w-8 h-8 rounded-lg bg-white/85 hover:bg-white border border-white/90 text-[#242038] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-xs font-semibold text-[#242038] bg-[#FAF9FC] border border-[#E5E2F0] p-3 rounded-xl">
            เรื่อง: {doc.subject || doc.voucherProject || doc.formName || '-'}
          </div>
          <div className="space-y-2">
            {WORKFLOW_STATUSES.map((s) => {
              const active = selectedStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStatus(s)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-sm font-semibold flex items-center justify-between transition-colors ${
                    active
                      ? 'border-[#6B6293] bg-[#F1EFF7] text-[#242038]'
                      : 'border-[#E5E2F0] bg-white text-slate-700 hover:border-[#B5B1C8]'
                  }`}
                >
                  <span>{s}</span>
                  {active && <Check className="w-4 h-4 text-[#6B6293]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 bg-[#FAF9FC] border-t border-[#ECEAF4] flex justify-end gap-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#C9C4DC] bg-white hover:bg-[#F5F4F9] text-[#242038] text-sm font-medium"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirmStatus(selectedStatus)}
            className="px-4 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] border border-[#524A75] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>บันทึกสถานะ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
