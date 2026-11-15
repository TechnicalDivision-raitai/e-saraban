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
      <div className="w-full max-w-lg rounded-2xl bg-white border-2 border-[#9690B0] shadow-xl overflow-hidden my-auto">
        {/* Bright #B5B1C8 Signature Header */}
        <div className="bg-[#B5B1C8] px-6 py-7 text-[#242038] relative border-none">
          {canDismiss && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="ปิดหน้าต่างสลับสิทธิ์"
              className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-white/85 hover:bg-white border border-[#78709B] text-[#242038] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white border-2 border-[#6B6293] flex items-center justify-center shrink-0 shadow-sm">
              <FolderOpen className="w-7 h-7 text-[#5A5180]" />
            </div>
            <div className="min-w-0">
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-white/85 border border-[#78709B] text-[#242038] text-xs font-semibold mb-1.5">
                ระบบงานสารบรรณอิเล็กทรอนิกส์
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242038]">
                E-Saraban กองช่าง
              </h1>
              <p className="text-sm font-medium text-[#3A3454]">องค์การบริหารส่วนตำบลไร่ใต้</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-white border-none">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#242038]">
              เลือกสิทธิ์เพื่อเข้าสู่ระบบ
            </span>
          </div>

          {!showAdminPrompt ? (
            <div className="space-y-3">
              {/* Staff Role Card */}
              <button
                type="button"
                onClick={onLoginStaff}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-[#B5B1C8] bg-white hover:bg-[#F5F4F9] hover:border-[#6B6293] text-left transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#8E87AD] text-white flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#242038] text-base">
                      บุคลากร / เจ้าหน้าที่ (Staff)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      ดูรายงานสรุป · ค้นหาหนังสือ · เปิดดูไฟล์แนบ · พิมพ์ใบปะหน้า/รายงาน
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#78709B] group-hover:text-[#6B6293] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </button>

              {/* Admin Role Card */}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setPassword('');
                  setShowAdminPrompt(true);
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-[#78709B] bg-[#F5F4F9] hover:bg-[#EBE9F2] text-left transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#6B6293] text-white flex items-center justify-center shrink-0 border border-[#524A75]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#242038] text-base">
                      ผู้ดูแลระบบ (Admin)
                    </div>
                    <div className="text-xs text-[#4A4369] mt-0.5">
                      นส. นิศาชล คงดี · ลงทะเบียน แก้ไข รับทราบงาน นำเข้า Excel และตั้งค่า
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6293] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F5F4F9] border-2 border-[#B5B1C8] space-y-3">
                <div className="flex items-center gap-2.5 text-[#242038] font-semibold text-sm">
                  <KeyRound className="w-4 h-4 text-[#6B6293]" />
                  <span>ยืนยันตัวตนผู้ดูแลระบบ (นส. นิศาชล คงดี)</span>
                </div>
                <div>
                  <label
                    htmlFor="adminPasswordInput"
                    className="block text-xs font-medium text-[#4A4369] mb-1.5"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#9690B0] bg-white text-[#242038] text-sm focus:outline-none focus:border-[#6B6293] focus:ring-2 focus:ring-[#B5B1C8]"
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
                  className="px-4 py-2.5 rounded-xl border border-[#B5B1C8] bg-white hover:bg-[#F5F4F9] text-[#242038] text-sm font-medium transition-colors"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors border border-[#524A75]"
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
