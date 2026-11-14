import { Filter, Receipt, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SarabanDoc } from '../types/saraban';
import { getAvailableYears, getCurrentFiscalYear } from '../utils/sarabanUtils';
import { BarChart, DoughnutChart } from './Charts';

interface VouchersSummaryViewProps {
  documents: SarabanDoc[];
  onViewDoc: (doc: SarabanDoc) => void;
}

export function VouchersSummaryView({ documents, onViewDoc }: VouchersSummaryViewProps) {
  const currentFiscalYear = getCurrentFiscalYear();
  const [summaryYear, setSummaryYear] = useState(() => getCurrentFiscalYear());

  const allVoucherDocs = useMemo(
    () => documents.filter((d) => d.type === 'vouchers'),
    [documents]
  );

  const years = useMemo(
    () => getAvailableYears(allVoucherDocs, true, currentFiscalYear),
    [allVoucherDocs, currentFiscalYear]
  );

  const filteredVouchers = useMemo(() => {
    return allVoucherDocs
      .filter((d) => !summaryYear || String(d.yearStr) === String(summaryYear))
      .sort((a, b) => new Date(b.voucherDate || 0).getTime() - new Date(a.voucherDate || 0).getTime());
  }, [allVoucherDocs, summaryYear]);

  const { grandTotal, categoryRows } = useMemo(() => {
    let totalSum = 0;
    const map: Record<string, { count: number; total: number }> = {};

    filteredVouchers.forEach((v) => {
      const cat = v.voucherCategory || 'ไม่ระบุประเภท';
      const amt = Number(v.voucherAmount || 0);
      totalSum += amt;
      if (!map[cat]) {
        map[cat] = { count: 0, total: 0 };
      }
      map[cat].count += 1;
      map[cat].total += amt;
    });

    const rows = Object.entries(map).map(([category, stats]) => ({
      category,
      count: stats.count,
      total: stats.total,
    }));

    return { grandTotal: totalSum, categoryRows: rows };
  }, [filteredVouchers]);

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Year Filter */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-[#B5B1C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#6B6293] text-white border-2 border-[#B5B1C8] flex items-center justify-center shrink-0">
            <Filter className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[#242038] text-sm sm:text-base">
              กรองข้อมูลสรุปงานฎีกาตามปีงบประมาณ
            </h2>
            <p className="text-xs text-slate-600">
              เลือกปีงบประมาณเพื่อดูยอดเงินขอเบิก สัดส่วน และรายการฎีกาเฉพาะปีนั้น
            </p>
          </div>
        </div>
        <select
          value={summaryYear}
          onChange={(e) => setSummaryYear(e.target.value)}
          aria-label="กรองปีงบประมาณงานฎีกา"
          className={`w-full sm:w-60 px-3.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors focus:outline-none ${
            summaryYear
              ? 'border-[#6B6293] bg-[#F5F4F9] text-[#242038]'
              : 'border-[#B5B1C8] bg-white text-slate-800 hover:border-[#9690B0]'
          }`}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              ปีงบฯ {y}
              {y === currentFiscalYear ? ' (ปีปัจจุบัน)' : ''}
            </option>
          ))}
          <option value="">ทุกปีงบประมาณ (All Years)</option>
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <div className="bg-white p-5 rounded-2xl border-2 border-[#B5B1C8] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#574F7D]">จำนวนฎีกาทั้งหมด</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-[#242038] tabular-nums">
              {filteredVouchers.length}
            </span>
            <div className="w-11 h-11 rounded-xl bg-[#ECEAF4] border border-[#9690B0] text-[#6B6293] flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-[#ECEAF4] p-5 rounded-2xl border-2 border-[#6B6293] text-[#242038] flex flex-col justify-between md:col-span-2">
          <span className="text-xs font-bold text-[#574F7D]">ยอดเงินขอเบิกรวมทั้งหมด</span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-[#242038] tabular-nums">
              {grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
            </span>
            <div className="w-11 h-11 rounded-xl bg-[#6B6293] border border-[#524A75] text-white flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        <div className="bg-white p-5 rounded-2xl border-2 border-[#B5B1C8] flex flex-col">
          <h3 className="font-bold text-[#242038] mb-4 text-sm">
            สัดส่วนประเภทฎีกา (จำนวนรายการ)
          </h3>
          <div className="relative flex-1 min-h-[250px]">
            <DoughnutChart
              labels={categoryRows.length ? categoryRows.map((r) => r.category) : ['ยังไม่มีข้อมูล']}
              data={categoryRows.length ? categoryRows.map((r) => r.count) : [1]}
              colors={['#6B6293', '#0EA5E9', '#F43F5E', '#10B981', '#F59E0B', '#14B8A6']}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-[#B5B1C8] lg:col-span-2 flex flex-col">
          <h3 className="font-bold text-[#242038] mb-4 text-sm">
            ยอดเงินขอเบิกแยกตามประเภทฎีกา (บาท)
          </h3>
          <div className="relative flex-1 min-h-[250px]">
            <BarChart
              labels={categoryRows.length ? categoryRows.map((r) => r.category) : ['ยังไม่มีข้อมูล']}
              datasetLabel="ยอดเงินขอเบิก (บาท)"
              data={categoryRows.length ? categoryRows.map((r) => r.total) : [0]}
              colors="#6B6293"
            />
          </div>
        </div>
      </div>

      {/* Summary + Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        <div className="bg-white rounded-2xl border-2 border-[#B5B1C8] overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b-2 border-[#E2DFEE] bg-[#F8F7FB]">
            <h3 className="font-bold text-[#242038] text-sm sm:text-base">
              สรุปยอดเงินแยกตามประเภทฎีกา
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F1EFF7] text-xs font-semibold text-[#242038] border-b border-[#B5B1C8]">
                <tr>
                  <th className="p-3.5">ประเภทฎีกา</th>
                  <th className="p-3.5 text-center">จำนวน</th>
                  <th className="p-3.5 text-right">ยอดเงินรวม (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {categoryRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">
                      ยังไม่มีข้อมูลสำหรับสรุปงานฎีกาในปีนี้
                    </td>
                  </tr>
                ) : (
                  categoryRows.map((row) => (
                    <tr key={row.category} className="hover:bg-[#F8F7FB]">
                      <td className="p-3.5 font-semibold text-slate-800">{row.category}</td>
                      <td className="p-3.5 text-center font-semibold text-[#574F7D] tabular-nums">
                        {row.count} รายการ
                      </td>
                      <td className="p-3.5 text-right font-bold text-[#242038] tabular-nums">
                        {row.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-[#B5B1C8] overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b-2 border-[#E2DFEE] bg-[#F8F7FB]">
            <h3 className="font-bold text-[#242038] text-sm sm:text-base">
              รายการงานฎีกาล่าสุด
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F1EFF7] text-xs font-semibold text-[#242038] border-b border-[#B5B1C8]">
                <tr>
                  <th className="p-3.5">เลขผู้เบิก</th>
                  <th className="p-3.5">โครงการ / ผู้รับเงิน</th>
                  <th className="p-3.5 text-right">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">
                      ไม่มีรายการงานฎีกาในปีนี้
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.slice(0, 6).map((v) => (
                    <tr
                      key={String(v.id)}
                      onClick={() => onViewDoc(v)}
                      className="hover:bg-[#ECEAF4]/70 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-[#574F7D] text-xs whitespace-nowrap tabular-nums">
                        {v.voucherNo || '-'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900 text-xs line-clamp-1">
                          {v.voucherProject || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          ผู้รับ: {v.voucherPayee || '-'}
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-bold text-[#242038] text-xs tabular-nums whitespace-nowrap">
                        {Number(v.voucherAmount || 0).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
