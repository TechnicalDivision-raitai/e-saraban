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
    <header className="no-print bg-white border-b-2 border-[#C7D2FE] h-16 shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 sticky top-0 z-30">
      {/* Zone 1: Page Title Highlight Frame */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="เปิดเมนู"
          className="md:hidden w-9 h-9 rounded-xl border-2 border-[#C7D2FE] bg-[#EEF2FF] text-[#312E81] flex items-center justify-center shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          title="ย่อ/ขยายเมนูข้าง"
          className="hidden md:inline-flex w-9 h-9 rounded-xl border-2 border-[#C7D2FE] bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#312E81] items-center justify-center transition-colors shrink-0"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="px-3.5 py-1.5 rounded-xl border-2 border-[#4F46E5] bg-[#EEF2FF] text-[#1E1B4B] flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm sm:text-base font-bold truncate whitespace-nowrap">
            {tabMeta.title}
          </h1>
        </div>
      </div>

      {/* Zone 2 & 3: Sync Status + Primary Action + Role Highlight Badge */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          title="ซิงค์ข้อมูลล่าสุดจาก Google Drive"
          className={`px-3 py-2 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            syncError
              ? 'border-[#DC2626] bg-[#FEE2E2] text-[#7F1D1D] hover:bg-[#FECACA]'
              : 'border-[#C7D2FE] bg-white hover:bg-[#EEF2FF] text-[#312E81]'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#4338CA]' : ''}`} />
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
            className="bg-[#4338CA] hover:bg-[#3730A3] border-2 border-[#312E81] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ลงทะเบียนหนังสือใหม่</span>
            <span className="sm:hidden">เพิ่มใหม่</span>
          </button>
        )}

        <div
          className={`px-3 py-1.5 rounded-xl border-2 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 ${
            isAdmin
              ? 'border-[#16A34A] bg-[#DCFCE7] text-[#14532D]'
              : 'border-[#D97706] bg-[#FEF3C7] text-[#78350F]'
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
