import {
  Menu,
  PanelLeft,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { TabId, UserSession } from '../types/saraban';
import { TAB_TITLES } from '../types/saraban';

interface TopBarProps {
  activeTab: TabId;
  currentUser: UserSession;
  docCount: number;
  isSyncing: boolean;
  syncError: string;
  onSync: () => void;
  onOpenNewDoc: () => void;
  onOpenMobileMenu: () => void;
  onToggleSidebar: () => void;
}

export function TopBar({
  activeTab,
  currentUser,
  docCount,
  isSyncing,
  syncError,
  onSync,
  onOpenNewDoc,
  onOpenMobileMenu,
  onToggleSidebar,
}: TopBarProps) {
  const isAdmin = currentUser.role === 'admin' && currentUser.name === 'นิศาชล คงดี';
  const tabMeta = TAB_TITLES[activeTab];

  return (
    <header className="no-print bg-white border-b border-[#E5E2F0] h-16 shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 sticky top-0 z-30">
      {/* Zone 1: Clean Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="เปิดเมนู"
          className="lg:hidden w-9 h-9 rounded-xl border border-[#DCD8EB] bg-[#F8F7FB] text-[#242038] flex items-center justify-center shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          title="ย่อ/ขยายเมนูข้าง"
          className="hidden lg:inline-flex w-9 h-9 rounded-xl border border-[#DCD8EB] bg-[#F8F7FB] hover:bg-[#ECEAF4] text-[#242038] items-center justify-center transition-colors shrink-0"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <h1 className="text-xs sm:text-[13px] flex items-center gap-2 truncate whitespace-nowrap">
          <span className="text-[#6E678A] font-normal">ระบบงานสารบรรณ</span>
          <span className="text-[#B5B1C8] font-normal">/</span>
          <span className="text-[#242038] font-semibold truncate">{tabMeta.title}</span>
        </h1>
      </div>

      {/* Zone 2 & 3: Sync Status + Primary Action + Role Highlight Badge */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          title="ซิงค์ข้อมูลล่าสุดจาก Google Drive"
          className={`px-3.5 py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            syncError
              ? 'border-[#FCA5A5] bg-[#FEE2E2] text-[#7F1D1D] hover:bg-[#FECACA]'
              : 'border-[#DCD8EB] bg-[#F8F7FB] hover:bg-[#ECEAF4] text-[#242038]'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#6B6293]' : 'text-[#6B6293]'}`} />
          <span className="hidden md:inline tabular-nums">
            {isSyncing
              ? 'กำลังซิงค์...'
              : syncError
              ? 'ซิงค์ไม่สำเร็จ'
              : `ซิงค์แล้ว (${docCount})`}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenNewDoc}
            className="bg-[#6B6293] hover:bg-[#574F7D] border border-[#524A75] text-white text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ลงทะเบียนหนังสือใหม่</span>
            <span className="sm:hidden">เพิ่มใหม่</span>
          </button>
        )}

        <div
          className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 ${
            isAdmin
              ? 'border-[#22C55E] bg-[#DCFCE7] text-[#14532D] shadow-[0_0_12px_rgba(34,197,94,0.5),inset_0_0_5px_rgba(134,239,172,0.45)]'
              : 'border-[#F59E0B] bg-[#FEF3C7] text-[#78350F] shadow-[0_0_12px_rgba(245,158,11,0.5),inset_0_0_5px_rgba(252,211,77,0.45)]'
          }`}
        >
          {isAdmin ? (
            <ShieldCheck className="w-4 h-4 shrink-0" />
          ) : (
            <UserCheck className="w-4 h-4 shrink-0" />
          )}
          <span className="hidden sm:inline">{currentUser.roleName}</span>
        </div>
      </div>
    </header>
  );
}
