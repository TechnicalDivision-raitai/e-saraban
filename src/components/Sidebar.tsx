import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookMarked,
  ChevronsLeft,
  ChevronsRight,
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
  onToggleCollapse: () => void;
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

export function Sidebar({
  activeTab,
  onSelectTab,
  currentUser,
  collapsed,
  onToggleCollapse,
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

    return (
      <button
        key={item.id}
        type="button"
        title={item.label}
        onClick={() => {
          onSelectTab(item.id);
          if (isMobile) onCloseMobile();
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border relative ${
          collapsed && !isMobile ? 'justify-center px-2' : ''
        } ${
          isActive
            ? 'bg-white/95 border-[#6B6293] text-[#3F3668] font-semibold shadow-[0_0_12px_rgba(107,98,147,0.35),inset_0_0_5px_rgba(181,177,200,0.45)]'
            : 'bg-transparent border-transparent text-[#242038] hover:bg-[#E2DFEE]/75 hover:border-[#C9C4DC]'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#6B6293]' : ''}`} />
        {(!collapsed || isMobile) && (
          <span className="truncate text-left">{item.label}</span>
        )}
        {typeof item.badge === 'number' && (
          <span
            className={`${
              collapsed && !isMobile
                ? 'absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px]'
                : 'ml-auto px-2 py-0.5 text-xs'
            } rounded-md font-bold tabular-nums border ${
              item.badgeVariant === 'red'
                ? 'bg-[#DC2626] border-[#FCA5A5] text-white badge-glow-urgent'
                : 'bg-[#2563EB] border-[#93C5FD] text-white shadow-[0_0_12px_rgba(59,130,246,0.7),inset_0_0_5px_rgba(191,219,254,0.5)]'
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
      {/* Desktop Bright #B5B1C8-Tinted Sidebar */}
      <aside
        className={`no-print hidden md:flex flex-col bg-[#ECEAF4] text-[#242038] border-r border-[#DCD8EB] shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[78px]' : 'w-[264px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[#A5A0BD] flex items-center justify-between gap-2 shrink-0 bg-[#B5B1C8]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/90 border border-white flex items-center justify-center shrink-0 shadow-xs">
              <BookMarked className="w-4 h-4 text-[#5A5180]" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="font-bold text-sm leading-tight truncate text-[#242038]">
                  E-Saraban กองช่าง
                </h2>
                <span className="text-[11px] font-medium text-[#3A3454] block truncate">
                  อบต.ไร่ใต้
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
            className="w-8 h-8 rounded-lg bg-white/85 hover:bg-white border border-white/90 text-[#242038] flex items-center justify-center transition-colors shrink-0"
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* User Highlight Frame */}
        <div
          className={`mx-2.5 my-3 p-2.5 rounded-xl bg-white border border-[#DCD8EB] shadow-[0_2px_8px_rgba(36,32,56,0.04)] flex items-center gap-3 shrink-0 ${
            collapsed ? 'justify-center px-1.5' : ''
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-[#6B6293] border border-[#524A75] flex items-center justify-center font-bold text-sm shrink-0 text-white">
            {currentUser.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate text-[#242038]">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-[#5A5278] truncate">
                {currentUser.roleName}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-2.5 py-1 space-y-4 overflow-y-auto saraban-scroll">
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold text-[#5A5278]">
                ภาพรวมและกล่องงาน
              </div>
            )}
            {overviewItems.map((item) => renderNavLink(item))}
          </div>

          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold text-[#5A5278]">
                ทะเบียนแยกประเภท
              </div>
            )}
            {registerItems.map((item) => renderNavLink(item))}
          </div>

          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold text-[#5A5278]">
                ติดตามและเชื่อมต่อ
              </div>
            )}
            {trackingItems.map((item) => renderNavLink(item))}
          </div>
        </nav>

        {/* Footer Controls */}
        <div className="p-2.5 border-t border-[#DCD8EB] space-y-2 shrink-0 bg-[#E5E2EE]">
          <button
            type="button"
            onClick={onOpenRoleSwitch}
            title="สลับสิทธิ์การใช้งาน"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-[#F8F7FB] border border-[#C9C4DC] text-[#242038] text-sm font-semibold transition-colors whitespace-nowrap ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0 text-[#6B6293]" />
            {!collapsed && <span>สลับสิทธิ์การใช้งาน</span>}
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="ออกจากระบบ"
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#FEE2E2] hover:bg-[#DC2626] border border-[#FCA5A5] hover:border-[#DC2626] text-[#991B1B] hover:text-white text-sm font-semibold transition-colors whitespace-nowrap ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <Power className="w-4 h-4 shrink-0" />
            {!collapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 bg-[#2F2A44]/50 md:hidden flex">
          <div className="w-72 bg-[#ECEAF4] text-[#242038] h-full flex flex-col p-4 space-y-3 border-r border-[#DCD8EB] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCD8EB]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#B5B1C8] border border-[#9690B0] flex items-center justify-center">
                  <BookMarked className="w-4 h-4 text-[#242038]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#242038]">E-Saraban กองช่าง</div>
                  <div className="text-[11px] text-[#5A5278]">อบต.ไร่ใต้</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="ปิดเมนู"
                className="w-8 h-8 rounded-lg bg-white border border-[#DCD8EB] text-[#242038] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-3 overflow-y-auto py-1">
              <div className="space-y-1">{overviewItems.map((item) => renderNavLink(item, true))}</div>
              <div className="space-y-1">{registerItems.map((item) => renderNavLink(item, true))}</div>
              <div className="space-y-1">
                {trackingItems.map((item) => renderNavLink(item, true))}
              </div>
            </nav>

            <div className="pt-3 border-t border-[#DCD8EB] space-y-2">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenRoleSwitch();
                }}
                className="w-full py-2.5 rounded-xl bg-white border border-[#C9C4DC] text-[#242038] text-sm font-semibold"
              >
                สลับสิทธิ์การใช้งาน
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onLogout();
                }}
                className="w-full py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-sm font-semibold"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <div className="no-print md:hidden fixed bottom-0 left-0 right-0 bg-[#ECEAF4] border-t border-[#DCD8EB] h-16 flex items-center justify-around px-1 z-40">
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
                  ? 'bg-white border-[#6B6293] text-[#3F3668] font-semibold shadow-[0_0_8px_rgba(107,98,147,0.3)]'
                  : 'border-transparent text-[#3A3454]'
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
