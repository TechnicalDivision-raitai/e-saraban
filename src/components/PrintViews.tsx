import { Printer, X } from 'lucide-react';
import type { DocType, SarabanDoc } from '../types/saraban';
import { DOC_TYPE_META } from '../types/saraban';
import {
  formatRegDisplay,
  formatThaiDate,
  formatThaiDateTime,
  getPartyLabel,
} from '../utils/sarabanUtils';

interface CoverSheetPrintModalProps {
  doc: SarabanDoc | null;
  onClose: () => void;
}

export function CoverSheetPrintModal({ doc, onClose }: CoverSheetPrintModalProps) {
  if (!doc) return null;

  const meta = DOC_TYPE_META[doc.type as DocType];

  return (
    <div className="fixed inset-0 z-50 bg-[#2F2A44]/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-white rounded-2xl border border-white/85 ring-1 ring-[#C9C4DC]/60 shadow-2xl w-full max-w-3xl overflow-hidden my-auto print-only-container">
        {/* Toolbar (hidden on print) */}
        <div className="no-print bg-[#B5B1C8] px-5 py-3.5 text-[#242038] flex items-center justify-between border-none">
          <div className="font-bold text-sm sm:text-base">
            ตัวอย่างใบปะหน้าหนังสือราชการ (A4)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] border border-[#524A75] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ / บันทึก PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดตัวอย่างใบปะหน้า"
              className="w-8 h-8 rounded-lg bg-white/85 hover:bg-white border border-white/90 text-[#242038] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Cover Sheet Body */}
        <div className="p-8 sm:p-10 font-sarabun text-black space-y-6 bg-white">
          <div className="border-b-2 border-black pb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold tracking-wide text-slate-700">
                กองช่าง องค์การบริหารส่วนตำบลไร่ใต้
              </div>
              <h1 className="text-2xl font-bold mt-1">
                ใบปะหน้าเอกสารงานสารบรรณ ({meta?.label || doc.type})
              </h1>
            </div>
            <div className="border-2 border-black px-4 py-2 text-right shrink-0">
              <div className="text-xs">เลขรับกองช่าง</div>
              <div className="text-lg font-bold tabular-nums">
                {doc.regNo && doc.regNo !== '-'
                  ? formatRegDisplay(doc)
                  : doc.voucherNo || doc.docNumber || '-'}
              </div>
              <div className="text-xs tabular-nums">
                วันที่: {formatThaiDate(doc.receiveDate !== '-' ? doc.receiveDate : doc.docDate || doc.voucherDate)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border border-black p-4">
            <div>
              <span className="font-bold">เลขที่หนังสือ / อ้างอิง: </span>
              <span>{doc.docNumber || doc.voucherNo || doc.formCode || '-'}</span>
            </div>
            <div>
              <span className="font-bold">ลงวันที่: </span>
              <span className="tabular-nums">
                {formatThaiDate(doc.docDate || doc.voucherDate)}
              </span>
            </div>
            <div>
              <span className="font-bold">เลขรับส่วนกลาง: </span>
              <span>{doc.centralRegNo || '-'}</span>
            </div>
            <div>
              <span className="font-bold">ความเร่งด่วน: </span>
              <span className="font-bold">{doc.urgency || 'ปกติ'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-bold">ผู้ส่ง / ผู้รับ / เรียน: </span>
              <span>{doc.sender || doc.voucherPayee || '-'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-bold">เรื่อง / โครงการ: </span>
              <span>{doc.subject || doc.voucherProject || doc.formName || '-'}</span>
            </div>
            {doc.type === 'vouchers' && (
              <>
                <div>
                  <span className="font-bold">ประเภทฎีกา: </span>
                  <span>{doc.voucherCategory || '-'}</span>
                </div>
                <div>
                  <span className="font-bold">จำนวนเงินขอเบิก: </span>
                  <span className="font-bold tabular-nums">
                    {Number(doc.voucherAmount || 0).toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    บาท
                  </span>
                </div>
              </>
            )}
            <div>
              <span className="font-bold">ผู้รับผิดชอบ: </span>
              <span>{doc.assignee || '-'}</span>
            </div>
            <div>
              <span className="font-bold">กำหนดแล้วเสร็จ: </span>
              <span className="tabular-nums">{formatThaiDate(doc.dueDate)}</span>
            </div>
          </div>

          {/* Official Endorsement / Routing Boxes */}
          <div className="space-y-4">
            <div className="border border-black p-4 min-h-[120px] flex flex-col justify-between">
              <div className="font-bold text-sm">
                ความเห็น / คำสั่งการหัวหน้าส่วน (ผู้อำนวยการกองช่าง):
              </div>
              <div className="pt-10 text-right text-sm">
                <div>ลงชื่อ .......................................................</div>
                <div className="mt-1">(.......................................................)</div>
                <div className="mt-1">วันที่ ......... / ................... / .............</div>
              </div>
            </div>

            <div className="border border-black p-4 min-h-[120px] flex flex-col justify-between">
              <div className="font-bold text-sm">
                บันทึกการพิจารณาสั่งการ (ปลัด อบต. / นายก อบต.ไร่ใต้):
              </div>
              <div className="pt-10 text-right text-sm">
                <div>ลงชื่อ .......................................................</div>
                <div className="mt-1">(.......................................................)</div>
                <div className="mt-1">วันที่ ......... / ................... / .............</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 flex justify-between pt-2 border-t border-slate-300">
            <span>ระบบ e-Saraban กองช่าง อบต.ไร่ใต้</span>
            <span>พิมพ์เมื่อ: {formatThaiDateTime(new Date())}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RegisterReportPrintModalProps {
  report: { title: string; rows: SarabanDoc[]; filterLabel: string } | null;
  onClose: () => void;
}

export function RegisterReportPrintModal({ report, onClose }: RegisterReportPrintModalProps) {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#2F2A44]/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-white rounded-2xl border border-white/85 ring-1 ring-[#C9C4DC]/60 shadow-2xl w-full max-w-5xl overflow-hidden my-auto print-only-container">
        <div className="no-print bg-[#B5B1C8] px-5 py-3.5 text-[#242038] flex items-center justify-between border-none">
          <div className="font-bold text-sm sm:text-base">
            ตัวอย่างรายงานทะเบียนเอกสาร A4 ({report.rows.length} รายการ)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] border border-[#524A75] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์รายงาน A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดรายงาน"
              className="w-8 h-8 rounded-lg bg-white/85 hover:bg-white border border-white/90 text-[#242038] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 font-sarabun text-black bg-white space-y-4">
          <div className="border-b-2 border-black pb-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold">
                กองช่าง องค์การบริหารส่วนตำบลไร่ใต้
              </div>
              <h1 className="text-xl font-bold mt-0.5">{report.title}</h1>
              <div className="text-xs text-slate-700 mt-0.5">
                เงื่อนไขรายงาน: {report.filterLabel || 'ทั้งหมด'} · รวม {report.rows.length} รายการ
              </div>
            </div>
            <div className="text-xs text-right tabular-nums">
              พิมพ์เมื่อ: {formatThaiDateTime(new Date())}
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-2 text-center w-10">ลำดับ</th>
                <th className="border border-black p-2 text-left">ประเภท</th>
                <th className="border border-black p-2 text-left">เลขทะเบียน / เลขที่</th>
                <th className="border border-black p-2 text-left">วันที่</th>
                <th className="border border-black p-2 text-left">เรื่อง / โครงการ</th>
                <th className="border border-black p-2 text-left">ผู้เกี่ยวข้อง</th>
                <th className="border border-black p-2 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-black p-6 text-center">
                    ไม่มีรายการเอกสาร
                  </td>
                </tr>
              ) : (
                report.rows.map((d, idx) => (
                  <tr key={String(d.id)}>
                    <td className="border border-black p-2 text-center tabular-nums">{idx + 1}</td>
                    <td className="border border-black p-2">
                      {DOC_TYPE_META[d.type as DocType]?.label || d.type}
                    </td>
                    <td className="border border-black p-2 tabular-nums">
                      {d.regNo && d.regNo !== '-'
                        ? formatRegDisplay(d)
                        : d.docNumber || d.voucherNo || d.formCode || '-'}
                    </td>
                    <td className="border border-black p-2 whitespace-nowrap tabular-nums">
                      {formatThaiDate(
                        d.receiveDate !== '-'
                          ? d.receiveDate
                          : d.docDate || d.voucherDate || '-'
                      )}
                    </td>
                    <td className="border border-black p-2">
                      {d.subject || d.voucherProject || d.formName || '-'}
                    </td>
                    <td className="border border-black p-2">
                      {getPartyLabel(d).replace(/^[^:]+:\s*/, '') || d.assignee || '-'}
                    </td>
                    <td className="border border-black p-2 text-center">{d.status || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
