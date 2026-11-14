import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  Flame,
  Loader2,
  Send,
  Zap,
} from 'lucide-react';
import type { DocType } from '../types/saraban';
import { DOC_TYPE_META } from '../types/saraban';

export function DocTypeBadge({ type }: { type: string }) {
  const meta = DOC_TYPE_META[type as DocType];
  if (!meta) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg border-2 border-slate-300 bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap">
        {type || '-'}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border-2 text-xs font-semibold whitespace-nowrap ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

export function StatusHighlightBadge({ status }: { status?: string }) {
  const value = String(status || '').trim();
  if (!value) {
    return <span className="text-slate-400 text-xs">-</span>;
  }

  if (value === 'เสร็จสิ้น' || value === 'ดำเนินการแล้ว') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#16A34A] bg-[#DCFCE7] text-[#14532D] text-xs font-semibold whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  if (value === 'กำลังดำเนินการ' || value === 'เสนอเซนต์') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#4F46E5] bg-[#E0E7FF] text-[#1E1B4B] text-xs font-semibold whitespace-nowrap">
        <Loader2 className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  if (value === 'ออกเอกสาร') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#7C3AED] bg-[#EDE9FE] text-[#4C1D95] text-xs font-semibold whitespace-nowrap">
        <Send className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  if (value === 'ลงรับแล้ว') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#0284C7] bg-[#E0F2FE] text-[#0C4A6E] text-xs font-semibold whitespace-nowrap">
        <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#D97706] bg-[#FEF3C7] text-[#78350F] text-xs font-semibold whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{value}</span>
    </span>
  );
}

export function UrgencyHighlightBadge({ urgency }: { urgency?: string }) {
  const level = String(urgency || 'ปกติ').trim() || 'ปกติ';

  if (level === 'ด่วนที่สุด') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[#DC2626] bg-[#FEE2E2] text-[#7F1D1D] text-xs font-bold whitespace-nowrap">
        <Flame className="w-3.5 h-3.5 shrink-0" />
        <span>{level}</span>
      </span>
    );
  }

  if (level === 'ด่วนมาก') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[#EA580C] bg-[#FFEDD5] text-[#7C2D12] text-xs font-bold whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{level}</span>
      </span>
    );
  }

  if (level === 'ด่วน') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[#D97706] bg-[#FEF3C7] text-[#78350F] text-xs font-semibold whitespace-nowrap">
        <Zap className="w-3.5 h-3.5 shrink-0" />
        <span>{level}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 text-xs font-medium whitespace-nowrap">
      {level}
    </span>
  );
}
