import { AlertTriangle, Check, Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SarabanDoc } from '../types/saraban';
import { WORKFLOW_STATUSES } from '../types/saraban';

interface DeleteDocModalProps {
  doc: SarabanDoc | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirmDelete: (mode: 'attachment' | 'record') => Promise<void>;
}

export function DeleteDocModal({
  doc,
  isBusy,
  onClose,
  onConfirmDelete,
}: DeleteDocModalProps) {
  const [mode, setMode] = useState<'attachment' | 'record'>('record');

  useEffect(() => {
    if (!doc) return;
    const hasAttachment = Boolean(doc.fileData && doc.fileData.trim());
    setMode(hasAttachment ? 'attachment' : 'record');
  }, [doc]);

  if (!doc) return null;
  const hasAttachment = Boolean(doc.fileData && doc.fileData.trim());

  return (
    <div className="no-print fixed inset-0 z-50 bg-[#1E1B4B]/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border-2 border-[#DC2626] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#991B1B] px-5 py-4 text-white flex items-center justify-between border-b-2 border-[#EF4444]">
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
              ? 'การลบไฟล์แนบจะเอาชื่อและ URL ออกจากรายการหนังสือ โดยไม่ลบไฟล์ต้นฉบับใน Google Drive'
              : 'รายการนี้ไม่มีไฟล์แนบ คุณสามารถลบรายการหนังสือนี้ออกจากฐานข้อมูลได้'}
          </p>

          <div className="space-y-2.5">
            {hasAttachment && (
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                  mode === 'attachment'
                    ? 'border-[#D97706] bg-[#FEF3C7]'
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
                    ล้างลิงก์ไฟล์ {doc.fileName || 'ไฟล์แนบ'} ออกจากแถวนี้เท่านั้น
                  </div>
                </div>
              </label>
            )}

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                mode === 'record'
                  ? 'border-[#DC2626] bg-[#FEE2E2]'
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
            onClick={() => onConfirmDelete(mode)}
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
    <div className="no-print fixed inset-0 z-50 bg-[#1E1B4B]/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border-2 border-[#4338CA] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#312E81] px-5 py-4 text-white flex items-center justify-between border-b-2 border-[#6366F1]">
          <h3 className="font-bold text-base">เปลี่ยนสถานะการดำเนินงาน</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="w-8 h-8 rounded-lg bg-[#1E1B4B] hover:bg-[#4338CA] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-xs font-semibold text-[#3730A3] bg-[#EEF2FF] border border-[#C7D2FE] p-3 rounded-xl">
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-left text-sm font-semibold flex items-center justify-between transition-colors ${
                    active
                      ? 'border-[#4338CA] bg-[#EEF2FF] text-[#1E1B4B]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-[#818CF8]'
                  }`}
                >
                  <span>{s}</span>
                  {active && <Check className="w-4 h-4 text-[#4338CA]" />}
                </button>
              );
            })}
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
            onClick={() => onConfirmStatus(selectedStatus)}
            className="px-4 py-2 rounded-xl bg-[#4338CA] hover:bg-[#3730A3] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>บันทึกสถานะ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
