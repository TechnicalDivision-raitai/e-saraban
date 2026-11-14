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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B4B]/95 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white border-2 border-[#4338CA] shadow-2xl overflow-hidden my-auto">
        {/* Solid Blue-Purple Header */}
        <div className="bg-[#312E81] px-6 py-7 text-white relative border-b-4 border-[#6366F1]">
          {canDismiss && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="ปิดหน้าต่างสลับสิทธิ์"
              className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-[#1E1B4B] hover:bg-[#4338CA] border border-[#6366F1] text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#4338CA] border-2 border-[#A5B4FC] flex items-center justify-center shrink-0 shadow-md">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-[#1E1B4B] border border-[#818CF8] text-[#E0E7FF] text-xs font-semibold mb-1.5">
                ระบบงานสารบรรณอิเล็กทรอนิกส์
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                e-Saraban กองช่าง
              </h1>
              <p className="text-sm text-[#C7D2FE]">องค์การบริหารส่วนตำบลไร่ใต้</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1E1B4B]">
              เลือกสิทธิ์เพื่อเข้าสู่ระบบ
            </span>
            <span className="text-xs font-medium text-[#4338CA] bg-[#EEF2FF] border border-[#A5B4FC] px-2.5 py-0.5 rounded-md">
              เชื่อมต่อ Google Drive
            </span>
          </div>

          {!showAdminPrompt ? (
            <div className="space-y-3">
              {/* Admin Role Card */}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setPassword('');
                  setShowAdminPrompt(true);
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-[#4338CA] bg-[#EEF2FF] hover:bg-[#E0E7FF] text-left transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#3730A3] text-white flex items-center justify-center shrink-0 border border-[#6366F1]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#1E1B4B] text-base">
                      ผู้ดูแลระบบ (Admin)
                    </div>
                    <div className="text-xs text-[#3730A3] mt-0.5">
                      นส. นิศาชล คงดี · ลงทะเบียน แก้ไข รับทราบงาน นำเข้า Excel และตั้งค่า
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#4338CA] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </button>

              {/* Staff Role Card */}
              <button
                type="button"
                onClick={onLoginStaff}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-300 bg-slate-50 hover:bg-[#F5F3FF] hover:border-[#7C3AED] text-left transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#4C1D95] text-white flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-base">
                      บุคลากร / เจ้าหน้าที่ (Staff)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      ดูรายงานสรุป · ค้นหาหนังสือ · เปิดดูไฟล์แนบ · พิมพ์ใบปะหน้า/รายงาน
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#5B21B6] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="p-4 rounded-xl bg-[#EEF2FF] border-2 border-[#6366F1] space-y-3">
                <div className="flex items-center gap-2.5 text-[#1E1B4B] font-semibold text-sm">
                  <KeyRound className="w-4 h-4 text-[#4338CA]" />
                  <span>ยืนยันตัวตนผู้ดูแลระบบ (นส. นิศาชล คงดี)</span>
                </div>
                <div>
                  <label
                    htmlFor="adminPasswordInput"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#4338CA] bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                {errorMsg && (
                  <div className="px-3 py-2 rounded-lg bg-[#FEE2E2] border border-[#DC2626] text-[#991B1B] text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdminPrompt(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium transition-colors"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#3730A3] hover:bg-[#312E81] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors border border-[#6366F1]"
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
