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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap shadow-[0_0_10px_rgba(148,163,184,0.5)]">
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#22C55E] bg-[#DCFCE7] text-[#14532D] text-xs font-semibold whitespace-nowrap shadow-[0_0_12px_rgba(34,197,94,0.6),inset_0_0_6px_rgba(134,239,172,0.5)]">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  if (value === 'กำลังดำเนินการ' || value === 'เสนอเซนต์') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#3B82F6] bg-[#DBEAFE] text-[#1E3A8A] text-xs font-semibold whitespace-nowrap shadow-[0_0_12px_rgba(59,130,246,0.6),inset_0_0_6px_rgba(147,197,253,0.5)]">
        <Loader2 className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  if (value === 'ออกเอกสาร') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#EC4899] bg-[#FCE7F3] text-[#831843] text-xs font-semibold whitespace-nowrap shadow-[0_0_12px_rgba(236,72,153,0.6),inset_0_0_6px_rgba(249,168,212,0.5)]">
        <Send className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  if (value === 'ลงรับแล้ว') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#0EA5E9] bg-[#E0F2FE] text-[#0C4A6E] text-xs font-semibold whitespace-nowrap shadow-[0_0_12px_rgba(14,165,233,0.6),inset_0_0_6px_rgba(125,211,252,0.5)]">
        <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7] text-[#78350F] text-xs font-semibold whitespace-nowrap shadow-[0_0_12px_rgba(245,158,11,0.6),inset_0_0_6px_rgba(252,211,77,0.5)]">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{value}</span>
    </span>
  );
}

export function UrgencyHighlightBadge({ urgency }: { urgency?: string }) {
  const level = String(urgency || 'ปกติ').trim() || 'ปกติ';

  if (level === 'ด่วนที่สุด') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[#EF4444] bg-[#FEE2E2] text-[#7F1D1D] text-xs font-bold whitespace-nowrap badge-glow-urgent">
        <Flame className="w-3.5 h-3.5 shrink-0" />
        <span>{level}</span>
      </span>
    );
  }

  if (level === 'ด่วนมาก') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[#F97316] bg-[#FFEDD5] text-[#7C2D12] text-xs font-bold whitespace-nowrap shadow-[0_0_13px_rgba(249,115,22,0.65),inset_0_0_6px_rgba(253,186,116,0.5)]">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{level}</span>
      </span>
    );
  }

  if (level === 'ด่วน') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[#F59E0B] bg-[#FEF3C7] text-[#78350F] text-xs font-semibold whitespace-nowrap shadow-[0_0_12px_rgba(245,158,11,0.6),inset_0_0_6px_rgba(252,211,77,0.5)]">
        <Zap className="w-3.5 h-3.5 shrink-0" />
        <span>{level}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg border-2 border-[#94A3B8] bg-slate-100 text-slate-700 text-xs font-medium whitespace-nowrap shadow-[0_0_10px_rgba(148,163,184,0.5),inset_0_0_5px_rgba(226,232,240,0.6)]">
      {level}
    </span>
  );
}
