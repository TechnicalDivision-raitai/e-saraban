import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookMarked,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderTree,
  Gavel,
  Inbox,
  LayoutDashboard,
  Power,
  Receipt,
  X,
} from 'lucide-react';
import type { TabId, UserSession } from '../types/saraban';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  currentUser: UserSession;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  myInboxCount: number;
  overdueCount: number;
  onOpenRoleSwitch: () => void;
  onLogout: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'indigo' | 'red';
  adminOnly?: boolean;
}

interface NavGlowStyle {
  idle: string;
  active: string;
  iconIdle: string;
  iconActive: string;
}

const DEFAULT_NAV_GLOW: NavGlowStyle = {
  idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
  active:
    'bg-gradient-to-r from-white via-[#F6F4FB] to-[#EAE6F5] border-[3px] border-double border-[#DDD6FE] text-[#362E57] font-bold shadow-[0_0_16px_rgba(255,255,255,0.68),inset_0_0_6px_rgba(196,181,253,0.45)]',
  iconIdle: 'text-white/80',
  iconActive: 'text-[#574F7D]',
};

const TAB_NAV_GLOW_STYLES: Partial<Record<TabId, NavGlowStyle>> = {
  allDocs: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#EDE9FE] border-[3px] border-double border-[#7C3AED] text-[#4C1D95] font-bold shadow-[0_0_16px_rgba(167,139,250,0.82),inset_0_0_6px_rgba(196,181,253,0.55)]',
    iconIdle: 'text-[#DDD6FE]',
    iconActive: 'text-[#5B21B6]',
  },
  incoming: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#DBEAFE] border-[3px] border-double border-[#3B82F6] text-[#1E40AF] font-bold shadow-[0_0_16px_rgba(59,130,246,0.85),inset_0_0_6px_rgba(147,197,253,0.55)]',
    iconIdle: 'text-[#93C5FD]',
    iconActive: 'text-[#1D4ED8]',
  },
  outgoing: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#D1FAE5] border-[3px] border-double border-[#10B981] text-[#065F46] font-bold shadow-[0_0_16px_rgba(16,185,129,0.85),inset_0_0_6px_rgba(110,231,183,0.55)]',
    iconIdle: 'text-[#6EE7B7]',
    iconActive: 'text-[#047857]',
  },
  orders: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#FEF3C7] border-[3px] border-double border-[#F59E0B] text-[#92400E] font-bold shadow-[0_0_16px_rgba(245,158,11,0.85),inset_0_0_6px_rgba(252,211,77,0.55)]',
    iconIdle: 'text-[#FCD34D]',
    iconActive: 'text-[#B45309]',
  },
  memos: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#E0F2FE] border-[3px] border-double border-[#0EA5E9] text-[#0369A1] font-bold shadow-[0_0_16px_rgba(14,165,233,0.85),inset_0_0_6px_rgba(125,211,252,0.55)]',
    iconIdle: 'text-[#7DD3FC]',
    iconActive: 'text-[#0284C7]',
  },
  vouchers: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#FFE4E6] border-[3px] border-double border-[#F43F5E] text-[#BE123C] font-bold shadow-[0_0_16px_rgba(244,63,94,0.85),inset_0_0_6px_rgba(253,164,175,0.55)]',
    iconIdle: 'text-[#FDA4AF]',
    iconActive: 'text-[#E11D48]',
  },
  forms: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#CCFBF1] border-[3px] border-double border-[#14B8A6] text-[#0F766E] font-bold shadow-[0_0_16px_rgba(20,184,166,0.85),inset_0_0_6px_rgba(94,234,212,0.55)]',
    iconIdle: 'text-[#5EEAD4]',
    iconActive: 'text-[#0D9488]',
  },
  overdue: {
    idle: 'bg-transparent border-[3px] border-transparent text-white/88 font-medium hover:bg-white/10 hover:text-white',
    active:
      'bg-[#FEE2E2] border-[3px] border-double border-[#EF4444] text-[#991B1B] font-bold shadow-[0_0_16px_rgba(239,68,68,0.85),inset_0_0_6px_rgba(252,165,165,0.55)]',
    iconIdle: 'text-[#FCA5A5]',
    iconActive: 'text-[#DC2626]',
  },
};

export function Sidebar({
  activeTab,
  onSelectTab,
  currentUser,
  collapsed,
  mobileOpen,
  onCloseMobile,
  myInboxCount,
  overdueCount,
  onOpenRoleSwitch,
  onLogout,
}: SidebarProps) {
  const isAdmin = currentUser.role === 'admin' && currentUser.name === 'นิศาชล คงดี';

  const overviewItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'สรุปผลงานสารบรรณ',
      mobileLabel: 'หน้าแรก',
      icon: LayoutDashboard,
    },
    {
      id: 'vouchersSummary',
      label: 'สรุปงานฎีกา',
      mobileLabel: 'สรุปฎีกา',
      icon: BarChart3,
    },
    {
      id: 'myInbox',
      label: 'กล่องงานของฉัน',
      mobileLabel: 'งานของฉัน',
      icon: Inbox,
      badge: myInboxCount,
      badgeVariant: 'indigo',
      adminOnly: true,
    },
  ];

  const registerItems: NavItem[] = [
    { id: 'allDocs', label: 'รวมทะเบียนทั้งหมด', mobileLabel: 'ทั้งหมด', icon: FolderTree },
    { id: 'incoming', label: 'หนังสือรับ', mobileLabel: 'รับ', icon: FileDown },
    { id: 'outgoing', label: 'หนังสือส่ง', mobileLabel: 'ส่ง', icon: FileUp },
    { id: 'orders', label: 'คำสั่ง', mobileLabel: 'คำสั่ง', icon: Gavel },
    { id: 'memos', label: 'บันทึกข้อความ (ปีงบฯ)', mobileLabel: 'บันทึก', icon: FileText },
    { id: 'vouchers', label: 'งานฎีกา (ปีงบฯ)', mobileLabel: 'ฎีกา', icon: Receipt },
    { id: 'forms', label: 'แบบฟอร์ม', mobileLabel: 'แบบฟอร์ม', icon: FileSpreadsheet },
  ];

  const trackingItems: NavItem[] = [
    {
      id: 'overdue',
      label: 'งานเกินกำหนด',
      mobileLabel: 'เกินกำหนด',
      icon: AlertTriangle,
      badge: overdueCount,
      badgeVariant: 'red',
    },
  ];

  const renderNavLink = (item: NavItem, isMobile = false) => {
    if (item.adminOnly && !isAdmin) return null;
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const glowStyle = TAB_NAV_GLOW_STYLES[item.id] || DEFAULT_NAV_GLOW;

    return (
      <button
        key={item.id}
        type="button"
        title={item.label}
        onClick={() => {
          onSelectTab(item.id);
          if (isMobile) onCloseMobile();
        }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all duration-150 relative ${
          collapsed && !isMobile ? 'justify-center px-2' : ''
        } ${isActive ? glowStyle.active : glowStyle.idle}`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 ${isActive ? glowStyle.iconActive : glowStyle.iconIdle}`}
        />
        {(!collapsed || isMobile) && (
          <span className="truncate text-left">{item.label}</span>
        )}
        {typeof item.badge === 'number' && (
          <span
            className={`${
              collapsed && !isMobile
                ? 'absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px]'
                : 'ml-auto px-2 py-0.5 text-[11px]'
            } rounded-md font-bold tabular-nums border ${
              item.badgeVariant === 'red'
                ? 'bg-[#EF4444] border-[#FCA5A5]/70 text-white shadow-xs'
                : isActive
                  ? 'bg-[#574F7D] border-[#6B6293] text-white'
                  : 'bg-white/15 border-white/25 text-white'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Desktop Vertical Theme-Gradient Sidebar */}
      <aside
        className={`no-print hidden lg:flex flex-col bg-gradient-to-b from-[#6B6293] via-[#534A7A] to-[#3B335C] text-white border-r border-white/10 shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[76px]' : 'w-[258px]'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 px-4 border-b border-white/10 flex items-center gap-2 shrink-0 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <BookMarked className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="font-bold text-sm leading-tight truncate text-white tracking-wide">
                  E-Saraban กองช่าง
                </h2>
                <span className="text-[11px] font-medium text-white/75 block truncate">
                  อบต.ไร่ใต้
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Translucent User Info Frame */}
        <div
          className={`mx-2.5 my-3 p-2.5 rounded-xl bg-white/10 border border-white/45 shadow-[0_0_12px_rgba(233,229,248,0.24),inset_0_0_8px_rgba(255,255,255,0.14)] flex items-center gap-2.5 shrink-0 ${
            collapsed ? 'justify-center px-1.5' : ''
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center font-bold text-sm shrink-0 text-white">
            {currentUser.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate text-white">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-white/75 truncate">
                {currentUser.roleName}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-2.5 py-1 space-y-3.5 overflow-y-auto saraban-scroll">
          <div className="space-y-1.5">
            {!collapsed && (
              <div className="px-3 pb-0.5 text-[11px] font-semibold text-white/65">
                ภาพรวมและกล่องงาน
              </div>
            )}
            {overviewItems.map((item) => renderNavLink(item))}
          </div>

          <div className="space-y-1.5 pt-2.5 border-t border-white/15">
            {!collapsed && (
              <div className="px-3 pb-0.5 text-[11px] font-semibold text-white/65">
                ทะเบียนแยกประเภท
              </div>
            )}
            {registerItems.map((item) => renderNavLink(item))}
          </div>

          <div className="space-y-1.5 pt-2.5 border-t border-white/15">
            {!collapsed && (
              <div className="px-3 pb-0.5 text-[11px] font-semibold text-white/65">
                ติดตามและเร่งรัด
              </div>
            )}
            {trackingItems.map((item) => renderNavLink(item))}
          </div>
        </nav>

        {/* Translucent Footer Controls */}
        <div className="p-2.5 border-t border-white/10 space-y-1.5 shrink-0 bg-black/10">
          <button
            type="button"
            onClick={onOpenRoleSwitch}
            title="สลับสิทธิ์การใช้งาน"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold transition-colors whitespace-nowrap ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0 text-white/85" />
            {!collapsed && <span>สลับสิทธิ์การใช้งาน</span>}
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="ออกจากระบบ"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-rose-500/90 border border-white/10 hover:border-rose-400 text-rose-100 hover:text-white text-xs font-semibold transition-colors whitespace-nowrap ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <Power className="w-4 h-4 shrink-0" />
            {!collapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>
      </aside>

      {/* Mobile & Tablet Drawer (matching vertical theme gradient) */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 bg-[#242038]/55 lg:hidden flex">
          <div className="w-72 bg-gradient-to-b from-[#6B6293] via-[#534A7A] to-[#3B335C] text-white h-full flex flex-col p-4 space-y-3 border-r border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <BookMarked className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">E-Saraban กองช่าง</div>
                  <div className="text-[11px] text-white/75">อบต.ไร่ใต้</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="ปิดเมนู"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/20 border border-white/25 flex items-center justify-center font-bold text-sm shrink-0 text-white">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate text-white">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-white/75 truncate">
                  {currentUser.roleName}
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-3 overflow-y-auto py-1 saraban-scroll">
              <div className="space-y-1">{overviewItems.map((item) => renderNavLink(item, true))}</div>
              <div className="space-y-1 pt-2 border-t border-white/10">
                {registerItems.map((item) => renderNavLink(item, true))}
              </div>
              <div className="space-y-1 pt-2 border-t border-white/10">
                {trackingItems.map((item) => renderNavLink(item, true))}
              </div>
            </nav>

            <div className="pt-3 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenRoleSwitch();
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold transition-colors"
              >
                สลับสิทธิ์การใช้งาน
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onLogout();
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-rose-500/90 border border-white/10 text-rose-100 hover:text-white text-xs font-semibold transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}

      {/* Mobile & Tablet Bottom Nav */}
      <div className="no-print lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E5E2F0] h-16 flex items-center justify-around px-1 z-40">
        {(
          [
            overviewItems[0],
            ...(isAdmin ? [overviewItems[2]] : []),
            registerItems[0],
            registerItems[1],
            registerItems[2],
          ] as NavItem[]
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 mx-0.5 rounded-xl transition-colors border ${
                isActive
                  ? 'bg-[#F1EFF7] border-[#B5B1C8] text-[#3F3668] font-semibold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
