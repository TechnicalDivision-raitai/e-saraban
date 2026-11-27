export type DocType = 'incoming' | 'outgoing' | 'orders' | 'memos' | 'forms' | 'vouchers';

export type DocStatus =
  | 'รอรับทราบ'
  | 'ลงรับแล้ว'
  | 'ออกเอกสาร'
  | 'เสนอเซนต์'
  | 'กำลังดำเนินการ'
  | 'ดำเนินการแล้ว'
  | 'เสร็จสิ้น';

export type UrgencyLevel = 'ปกติ' | 'ด่วน' | 'ด่วนมาก' | 'ด่วนที่สุด';

export type TabId =
  | 'dashboard'
  | 'vouchersSummary'
  | 'myInbox'
  | 'incoming'
  | 'outgoing'
  | 'orders'
  | 'memos'
  | 'vouchers'
  | 'forms'
  | 'allDocs'
  | 'overdue';

export type UserRole = 'admin' | 'staff';

export interface UserSession {
  username: string;
  name: string;
  role: UserRole;
  roleName: string;
}

export interface DocAttachment {
  fileName: string;
  fileUrl: string;
}

export interface SarabanDoc {
  id: string | number;
  type: DocType | string;
  regNo: string | number;
  yearStr: string;
  centralRegNo: string;
  receiveDate: string;
  sender: string;
  urgency: UrgencyLevel | string;
  docNumber: string;
  docDate: string;
  subject: string;
  status: DocStatus | string;
  assignee: string;
  dueDate: string;
  ackStatus: string;
  ackTime: string;
  fileName: string;
  fileData: string;
  attachments?: DocAttachment[];
  memoWork: string;
  formCode: string;
  formName: string;
  voucherDate: string;
  voucherMaker: string;
  voucherNo: string;
  voucherCategory: string;
  voucherPayee: string;
  voucherAmount: number;
  voucherProject: string;
}

export interface RawSarabanRecord {
  id: string | number;
  type?: string;
  reg_no?: string | number;
  year_str?: string | number;
  central_reg_no?: string;
  receive_date?: string;
  sender?: string;
  urgency?: string;
  doc_number?: string;
  doc_date?: string;
  subject?: string;
  status?: string;
  assignee?: string;
  due_date?: string;
  ack_status?: string;
  ack_time?: string;
  file_name?: string;
  file_url?: string;
  memo_work?: string;
  form_code?: string;
  form_name?: string;
  voucher_date?: string;
  voucher_maker?: string;
  voucher_no?: string;
  voucher_category?: string;
  voucher_payee?: string;
  voucher_amount?: string | number;
  voucher_project?: string;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
}

export const ADMIN_PASSWORD = '12345';

export const ADMIN_USER: UserSession = {
  username: 'admin',
  name: 'นิศาชล คงดี',
  role: 'admin',
  roleName: 'ผู้ดูแลระบบ',
};

export const STAFF_USER: UserSession = {
  username: 'staff',
  name: 'บุคลากรทั่วไป',
  role: 'staff',
  roleName: 'บุคลากร / เจ้าหน้าที่',
};

export const WORKFLOW_STATUSES: DocStatus[] = [
  'รอรับทราบ',
  'ลงรับแล้ว',
  'ออกเอกสาร',
  'เสนอเซนต์',
  'กำลังดำเนินการ',
  'ดำเนินการแล้ว',
  'เสร็จสิ้น',
];

export const URGENCY_LEVELS: UrgencyLevel[] = ['ปกติ', 'ด่วน', 'ด่วนมาก', 'ด่วนที่สุด'];

export const BASE_YEARS = ['2569', '2570', '2571', '2572', '2573', '2574', '2575'];

export const DOC_TYPE_META: Record<
  DocType,
  {
    label: string;
    shortLabel: string;
    description: string;
    yearKind: 'calendar' | 'fiscal' | 'none';
    badgeClass: string;
  }
> = {
  incoming: {
    label: 'หนังสือรับ',
    shortLabel: 'รับ',
    description: 'หนังสือจากภายนอกเข้ากองช่าง รันเลขรับอัตโนมัติตามปีปฏิทิน',
    yearKind: 'calendar',
    badgeClass:
      'bg-[#DBEAFE] text-[#1E40AF] border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.55),inset_0_0_5px_rgba(147,197,253,0.45)]',
  },
  outgoing: {
    label: 'หนังสือส่ง',
    shortLabel: 'ส่ง',
    description: 'หนังสือราชการที่กองช่างส่งออกไปยังหน่วยงานภายนอก',
    yearKind: 'calendar',
    badgeClass:
      'bg-[#D1FAE5] text-[#065F46] border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.55),inset_0_0_5px_rgba(110,231,183,0.45)]',
  },
  orders: {
    label: 'คำสั่ง',
    shortLabel: 'คำสั่ง',
    description: 'คำสั่ง ประกาศ และมอบหมายปฏิบัติราชการภายในกองช่าง',
    yearKind: 'calendar',
    badgeClass:
      'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.55),inset_0_0_5px_rgba(252,211,77,0.45)]',
  },
  memos: {
    label: 'บันทึกข้อความ',
    shortLabel: 'บันทึก',
    description: 'บันทึกข้อความภายในและระหว่างกอง แยกตามปีงบประมาณ',
    yearKind: 'fiscal',
    badgeClass:
      'bg-[#E0F2FE] text-[#0369A1] border-[#0EA5E9] shadow-[0_0_12px_rgba(14,165,233,0.55),inset_0_0_5px_rgba(125,211,252,0.45)]',
  },
  vouchers: {
    label: 'งานฎีกา',
    shortLabel: 'ฎีกา',
    description: 'เอกสารเบิกจ่ายงบประมาณและโครงการแยกตามปีงบประมาณ',
    yearKind: 'fiscal',
    badgeClass:
      'bg-[#FFE4E6] text-[#BE123C] border-[#F43F5E] shadow-[0_0_12px_rgba(244,63,94,0.55),inset_0_0_5px_rgba(253,164,175,0.45)]',
  },
  forms: {
    label: 'แบบฟอร์ม',
    shortLabel: 'แบบฟอร์ม',
    description: 'คลังแบบฟอร์มมาตรฐานงานโยธา ประปา และงานธุรการกองช่าง',
    yearKind: 'none',
    badgeClass:
      'bg-[#CCFBF1] text-[#0F766E] border-[#14B8A6] shadow-[0_0_12px_rgba(20,184,166,0.55),inset_0_0_5px_rgba(94,234,212,0.45)]',
  },
};

export const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'สรุปผลงานสารบรรณ',
    subtitle: 'ภาพรวมสถิติเอกสาร สัดส่วนงาน และหนังสือเร่งด่วนกองช่าง อบต.ไร่ใต้',
  },
  vouchersSummary: {
    title: 'สรุปงานฎีกา',
    subtitle: 'ติดตามยอดเงินขอเบิกและสัดส่วนประเภทฎีกาแยกตามปีงบประมาณ',
  },
  myInbox: {
    title: 'กล่องงานของฉัน (My Inbox)',
    subtitle: 'รายการเอกสารที่ได้รับมอบหมาย กดรับทราบงานและปรับสถานะได้ทันที',
  },
  incoming: {
    title: 'ทะเบียนหนังสือรับ (ปีปฏิทิน)',
    subtitle: 'จัดการและตรวจสอบหนังสือรับเข้ากองช่าง เรียงตามเลขรับกองช่าง',
  },
  outgoing: {
    title: 'ทะเบียนหนังสือส่ง (ปีปฏิทิน)',
    subtitle: 'จัดการและตรวจสอบหนังสือส่งออกจากกองช่าง อบต.ไร่ใต้',
  },
  orders: {
    title: 'ทะเบียนคำสั่ง (ปีปฏิทิน)',
    subtitle: 'คำสั่งและประกาศภายในกองช่าง อบต.ไร่ใต้',
  },
  memos: {
    title: 'ทะเบียนบันทึกข้อความ (ปีงบประมาณ)',
    subtitle: 'บันทึกข้อความภายในและระหว่างกอง แยกตามปีงบประมาณ',
  },
  vouchers: {
    title: 'ทะเบียนงานฎีกา (ปีงบประมาณ)',
    subtitle: 'จัดการและตรวจสอบการเบิกจ่ายงานฎีกา โครงการ และผู้รับเงิน',
  },
  forms: {
    title: 'ทะเบียนแบบฟอร์ม',
    subtitle: 'คลังแบบฟอร์มเอกสารภายในกองช่าง',
  },
  allDocs: {
    title: 'รวมทะเบียนเอกสารทั้งหมด',
    subtitle: 'ค้นหา กรองข้อมูล และพิมพ์รายงานภาพรวมสารบรรณ อบต.ไร่ใต้',
  },
  overdue: {
    title: 'ติดตามงานเกินกำหนด (Overdue)',
    subtitle: 'รายการเอกสารที่เลยกำหนดเวลาแล้วเสร็จ ควรเร่งรัดดำเนินการ',
  },
};
