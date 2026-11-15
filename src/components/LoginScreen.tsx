import { useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  FolderOpen,
  KeyRound,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { ADMIN_PASSWORD } from '../types/saraban';

interface LoginScreenProps {
  onLoginAdmin: () => void;
  onLoginStaff: () => void;
  canDismiss?: boolean;
  onDismiss?: () => void;
}

export function LoginScreen({
  onLoginAdmin,
  onLoginStaff,
  canDismiss = false,
  onDismiss,
}: LoginScreenProps) {
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setErrorMsg('');
      setPassword('');
      setShowAdminPrompt(false);
      onLoginAdmin();
    } else {
      setErrorMsg('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${
        canDismiss ? 'bg-[#2F2A44]/55' : 'bg-[#E4E1EE]'
      }`}
    >
      <div className="w-full max-w-[400px] rounded-2xl bg-white border border-white/85 ring-1 ring-[#C9C4DC]/60 shadow-[0_20px_50px_rgba(36,32,56,0.14)] overflow-hidden my-auto">
        {/* Bright #B5B1C8 Signature Header */}
        <div className="bg-[#B5B1C8] px-5 py-4 text-[#242038] relative border-none">
          {canDismiss && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="ปิดหน้าต่างสลับสิทธิ์"
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/80 hover:bg-white border border-white/90 text-[#242038] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/85 border border-white flex items-center justify-center shrink-0 shadow-xs">
              <FolderOpen className="w-5 h-5 text-[#5A5180]" />
            </div>
            <div className="min-w-0">
              <div className="inline-block px-2 py-0.5 rounded-md bg-white/75 border border-white/90 text-[#242038] text-[11px] font-semibold mb-1">
                ระบบงานสารบรรณอิเล็กทรอนิกส์
              </div>
              <h1 className="text-lg font-bold tracking-tight text-[#242038] leading-tight">
                E-Saraban กองช่าง
              </h1>
              <p className="text-xs font-medium text-[#3A3454]">องค์การบริหารส่วนตำบลไร่ใต้</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3 bg-white border-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4A4369]">
              เลือกสิทธิ์เพื่อเข้าสู่ระบบ
            </span>
          </div>

          {!showAdminPrompt ? (
            <div className="space-y-2.5">
              {/* Staff Role Card */}
              <button
                type="button"
                onClick={onLoginStaff}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5E2F0] bg-white hover:bg-[#FAF9FC] hover:border-[#B5B1C8] text-left transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#6B6293] text-white flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#242038] text-sm">
                      บุคลากร / เจ้าหน้าที่ (Staff)
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      ดูรายงานสรุป · ค้นหาหนังสือ · เปิดดูไฟล์แนบ · พิมพ์รายงาน
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#78709B] group-hover:text-[#6B6293] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </button>

              {/* Admin Role Card */}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setPassword('');
                  setShowAdminPrompt(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5E2F0] bg-white hover:bg-[#FAF9FC] hover:border-[#B5B1C8] text-left transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#F1EFF7] border border-[#E2DFEE] text-[#574F7D] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#242038] text-sm">
                      ผู้ดูแลระบบ (Admin)
                    </div>
                    <div className="text-[11px] text-[#574F7D] mt-0.5 leading-snug">
                      นส. นิศาชล คงดี · ลงทะเบียน แก้ไข รับทราบงาน นำเข้า Excel
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#78709B] group-hover:text-[#6B6293] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </button>

              <div className="pt-2.5 mt-1 border-t border-[#F0EEF6] text-center text-[11px] text-slate-400">
                กองช่าง องค์การบริหารส่วนตำบลไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#FAF9FC] border border-[#E5E2F0] space-y-2.5">
                <div className="flex items-center gap-2 text-[#242038] font-semibold text-xs sm:text-sm">
                  <KeyRound className="w-4 h-4 text-[#6B6293]" />
                  <span>ยืนยันตัวตนผู้ดูแลระบบ (นส. นิศาชล คงดี)</span>
                </div>
                <div>
                  <label
                    htmlFor="adminPasswordInput"
                    className="block text-xs font-medium text-[#4A4369] mb-1"
                  >
                    รหัสผ่านผู้ดูแลระบบ
                  </label>
                  <input
                    id="adminPasswordInput"
                    type="password"
                    autoFocus
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="กรอกรหัสผ่านที่นี่..."
                    className="w-full px-3 py-2 rounded-xl border border-[#C9C4DC] bg-white text-[#242038] text-sm focus:outline-none focus:border-[#6B6293] focus:ring-2 focus:ring-[#B5B1C8]/40"
                  />
                </div>
                {errorMsg && (
                  <div className="px-3 py-1.5 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminPrompt(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#DCD8EB] bg-white hover:bg-[#F5F4F9] text-[#242038] text-xs sm:text-sm font-medium transition-colors"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors border border-[#524A75]"
                >
                  <span>เข้าสู่ระบบ Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
