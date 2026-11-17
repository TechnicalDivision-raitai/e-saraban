import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Folder,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SarabanDoc, TabId } from '../types/saraban';
import {
  CURRENT_YEAR_FILTER_KEY,
  formatRegDisplay,
  formatThaiDate,
  getAvailableYears,
  getCurrentBuddhistYear,
  getCurrentFiscalYear,
  isOverdueDoc,
  matchesCurrentYearByType,
} from '../utils/sarabanUtils';
import { BarChart, DoughnutChart } from './Charts';
import { UrgencyHighlightBadge } from './StatusBadges';

interface DashboardViewProps {
  documents: SarabanDoc[];
  isLoading: boolean;
  isAdmin: boolean;
  selectedDocId: string | number | null;
  onSelectDoc: (id: string | number) => void;
  onViewDoc: (doc: SarabanDoc) => void;
  onEditDoc: (doc: SarabanDoc) => void;
  onDeleteDoc: (doc: SarabanDoc) => void;
  onNavigateTab: (tab: TabId) => void;
}

export function DashboardView({
  documents,
  isLoading,
  isAdmin,
  selectedDocId,
  onSelectDoc,
  onViewDoc,
  onEditDoc,
  onDeleteDoc,
  onNavigateTab,
}: DashboardViewProps) {
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR_FILTER_KEY);
  const currentCalendarYear = getCurrentBuddhistYear();
  const currentFiscalYear = getCurrentFiscalYear();
  const years = useMemo(
    () => getAvailableYears(documents, true, currentCalendarYear),
    [documents, currentCalendarYear]
  );

  const filteredDocs = useMemo(() => {
    if (filterYear === CURRENT_YEAR_FILTER_KEY) {
      return documents.filter((d) => matchesCurrentYearByType(d));
    }
    if (filterYear) {
      return documents.filter((d) => String(d.yearStr) === String(filterYear));
    }
    return documents;
  }, [documents, filterYear]);

  const stats = useMemo(() => {
    const total = filteredDocs.length;
    const pending = filteredDocs.filter(
      (d) => d.status === 'รอรับทราบ' || d.ackStatus === 'รอรับทราบ'
    ).length;
    const progress = filteredDocs.filter(
      (d) => d.status === 'กำลังดำเนินการ' || d.status === 'เสนอเซนต์'
    ).length;
    const done = filteredDocs.filter(
      (d) => d.status === 'เสร็จสิ้น' || d.status === 'ดำเนินการแล้ว'
    ).length;
    const overdue = filteredDocs.filter((d) => isOverdueDoc(d)).length;
    return { total, pending, progress, done, overdue };
  }, [filteredDocs]);

  const typeCounts = useMemo(
    () => [
      filteredDocs.filter((d) => d.type === 'incoming').length,
      filteredDocs.filter((d) => d.type === 'outgoing').length,
      filteredDocs.filter((d) => d.type === 'orders').length,
      filteredDocs.filter((d) => d.type === 'memos').length,
      filteredDocs.filter((d) => d.type === 'forms').length,
      filteredDocs.filter((d) => d.type === 'vouchers').length,
    ],
    [filteredDocs]
  );

  const statusBarCounts = useMemo(
    () => [
      filteredDocs.filter((d) => d.status === 'รอรับทราบ' || d.status === 'ลงรับแล้ว').length,
      filteredDocs.filter(
        (d) =>
          d.status === 'กำลังดำเนินการ' ||
          d.status === 'เสนอเซนต์' ||
          d.status === 'ออกเอกสาร'
      ).length,
      filteredDocs.filter((d) => d.status === 'เสร็จสิ้น' || d.status === 'ดำเนินการแล้ว').length,
    ],
    [filteredDocs]
  );

  const recentDocs = useMemo(() => filteredDocs.slice(0, 6), [filteredDocs]);

  return (
    <div className="space-y-5 w-full">
      {/* Year Filter Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E2F0] shadow-[0_4px_20px_rgba(36,32,56,0.05)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#6B6293] text-white border border-[#524A75] flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[#242038] text-sm sm:text-base">
              กรองภาพรวมข้อมูลสารบรรณตามปี
            </h2>
            <p className="text-xs text-slate-600">
              แสดงสถิติ กราฟสัดส่วนงาน และรายการหนังสือล่าสุดของกองช่าง อบต.ไร่ใต้
            </p>
          </div>
        </div>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          aria-label="เลือกปีสำหรับกรองภาพรวมแดชบอร์ด"
          className={`w-full sm:w-auto sm:min-w-[260px] px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors border focus:outline-none ${
            filterYear
              ? 'border-[#B5B1C8] bg-[#FAF9FC] text-[#242038]'
              : 'border-[#E2DFEE] bg-white text-slate-800 hover:border-[#B5B1C8]'
          }`}
        >
          <option value={CURRENT_YEAR_FILTER_KEY}>
            ปีปัจจุบัน (ปฏิทิน {currentCalendarYear} / ปีงบฯ {currentFiscalYear})
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              ปี {y}
            </option>
          ))}
          <option value="">ทุกปี (All Years)</option>
        </select>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 items-stretch">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E2F0] shadow-[0_4px_18px_rgba(36,32,56,0.05)] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#574F7D]">หนังสือทั้งหมด</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#242038] tabular-nums">
              {stats.total}
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#F1EFF7] border border-[#E2DFEE] text-[#6B6293] flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#FDE68A] shadow-[0_4px_18px_rgba(245,158,11,0.08)] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#78350F]">รอรับทราบ</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#B45309] tabular-nums">
              {stats.pending}
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7]/70 border border-[#FDE68A] text-[#B45309] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#BFDBFE] shadow-[0_4px_18px_rgba(59,130,246,0.08)] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#1E40AF]">กำลังดำเนินการ</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#2563EB] tabular-nums">
              {stats.progress}
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#DBEAFE]/70 border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#A7F3D0] shadow-[0_4px_18px_rgba(16,185,129,0.08)] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#14532D]">เสร็จสิ้นแล้ว</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#15803D] tabular-nums">
              {stats.done}
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#DCFCE7]/70 border border-[#A7F3D0] text-[#15803D] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#FECACA] shadow-[0_4px_18px_rgba(239,68,68,0.08)] flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-[#7F1D1D]">เกินกำหนดส่ง</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#DC2626] tabular-nums">
              {stats.overdue}
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#FEE2E2]/70 border border-[#FECACA] text-[#DC2626] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E2F0] shadow-[0_4px_20px_rgba(36,32,56,0.05)] flex flex-col">
          <h3 className="font-bold text-[#242038] mb-4 text-sm">
            สัดส่วนประเภทหนังสือ
          </h3>
          <div className="relative flex-1 min-h-[250px]">
            <DoughnutChart
              labels={['หนังสือรับ', 'หนังสือส่ง', 'คำสั่ง', 'บันทึกข้อความ', 'แบบฟอร์ม', 'งานฎีกา']}
              data={typeCounts}
              colors={['#6B6293', '#10B981', '#F59E0B', '#0EA5E9', '#14B8A6', '#F43F5E']}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E2F0] shadow-[0_4px_20px_rgba(36,32,56,0.05)] lg:col-span-2 flex flex-col">
          <h3 className="font-bold text-[#242038] mb-4 text-sm">
            ภาพรวมสถานะการทำงาน
          </h3>
          <div className="relative flex-1 min-h-[250px]">
            <BarChart
              labels={['รอดำเนินการ / ลงรับแล้ว', 'กำลังดำเนินการ / เสนอเซนต์', 'ดำเนินการแล้ว / เสร็จสิ้น']}
              datasetLabel="จำนวนหนังสือ"
              data={statusBarCounts}
              colors={['#F59E0B', '#6B6293', '#16A34A']}
            />
          </div>
        </div>
      </div>

      {/* Urgent / Recent Table */}
      <div className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_4px_20px_rgba(36,32,56,0.05)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#ECEAF4] bg-[#FAF9FC] flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#242038] text-sm sm:text-base">
              หนังสือเร่งด่วน / งานล่าสุด
            </h3>
            <p className="text-xs text-slate-500">
              แสดง 6 รายการล่าสุดตามตัวกรองปีที่เลือก
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('allDocs')}
            className="text-xs font-bold text-[#4A4173] hover:text-white bg-[#F1EFF7] hover:bg-[#6B6293] border border-[#C9C4DC] hover:border-[#524A75] px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            ดูทะเบียนทั้งหมด →
          </button>
        </div>

        <div className="overflow-x-auto saraban-scroll">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead className="bg-[#F6F4FA] text-xs font-semibold text-[#242038] border-b border-[#E5E2F0]">
              <tr>
                <th className="p-3.5">เลขทะเบียน</th>
                <th className="p-3.5">เรื่อง / ผู้เกี่ยวข้อง</th>
                <th className="p-3.5">ผู้รับผิดชอบ</th>
                <th className="p-3.5 text-center">ความเร่งด่วน</th>
                <th className="p-3.5">กำหนดเสร็จ</th>
                <th className="p-3.5 text-center">ไฟล์แนบ</th>
                <th className="p-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EEF6] text-sm">
              {isLoading && documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-600">
                    กำลังโหลดข้อมูลทะเบียนเอกสารจาก Google Drive...
                  </td>
                </tr>
              ) : recentDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    ยังไม่มีข้อมูลในระบบสำหรับปีที่เลือก
                  </td>
                </tr>
              ) : (
                recentDocs.map((d) => {
                  const isSelected = String(d.id) === String(selectedDocId);
                  return (
                    <tr
                      key={String(d.id)}
                      onClick={() => onSelectDoc(d.id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#ECEAF4] outline-2 -outline-offset-2 outline-[#6B6293]'
                          : 'hover:bg-[#F8F7FB]'
                      }`}
                    >
                      <td className="p-3.5 font-bold text-[#574F7D] whitespace-nowrap tabular-nums">
                        {formatRegDisplay(d)}
                      </td>
                      <td className="p-3.5 max-w-md">
                        <div className="font-semibold text-slate-900 truncate">
                          {d.subject || d.formName || d.voucherProject || '-'}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          จาก/ถึง: {d.sender || d.voucherPayee || '-'}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-700 whitespace-nowrap">
                        {d.assignee || d.voucherMaker || '-'}
                      </td>
                      <td className="p-3.5 text-center">
                        <UrgencyHighlightBadge urgency={d.urgency} />
                      </td>
                      <td className="p-3.5 text-slate-700 whitespace-nowrap tabular-nums">
                        {formatThaiDate(d.dueDate)}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {d.fileData && d.fileData.trim() !== '' ? (
                          <a
                            href={d.fileData}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={d.fileName || 'เปิดดูไฟล์แนบ'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#C9C4DC] bg-[#F1EFF7] hover:bg-[#6B6293] text-[#242038] hover:text-white text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>เปิดไฟล์</span>
                          </a>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewDoc(d)}
                            title="ดูรายละเอียดและพิมพ์ใบปะหน้า"
                            className="w-8 h-8 rounded-lg border border-[#9690B0] bg-[#ECEAF4] hover:bg-[#6B6293] text-[#242038] hover:text-white inline-flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditDoc(d)}
                                title="แก้ไข"
                                className="w-8 h-8 rounded-lg border border-[#F59E0B] bg-[#FEF3C7] hover:bg-[#D97706] text-[#92400E] hover:text-white inline-flex items-center justify-center transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteDoc(d)}
                                title="ลบ"
                                className="w-8 h-8 rounded-lg border border-[#EF4444] bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white inline-flex items-center justify-center transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
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
