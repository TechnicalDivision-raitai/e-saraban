import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Paperclip,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DocStatus, DocType, SarabanDoc, UrgencyLevel } from '../types/saraban';
import {
  DOC_TYPE_META,
  URGENCY_LEVELS,
  WORKFLOW_STATUSES,
} from '../types/saraban';
import {
  getAvailableYears,
  getCurrentYearForType,
  getNextRegNoForYear,
  getUniqueNormalizedSuggestions,
  normalizeWhitespace,
} from '../utils/sarabanUtils';
import { SmartAutocompleteInput } from './SmartAutocompleteInput';

export interface DocumentFormPayload {
  editId: string | number | null;
  type: DocType;
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
  selectedFile: File | null;
  removeExistingAttachment: boolean;
}

interface DocumentWizardModalProps {
  isOpen: boolean;
  editingDoc: SarabanDoc | null;
  documents: SarabanDoc[];
  isSubmitting: boolean;
  uploadPhaseLabel: string;
  onClose: () => void;
  onSubmit: (payload: DocumentFormPayload) => Promise<void>;
}

const DOC_TYPES_ORDER: DocType[] = [
  'incoming',
  'outgoing',
  'orders',
  'memos',
  'vouchers',
  'forms',
];

export function DocumentWizardModal({
  isOpen,
  editingDoc,
  documents,
  isSubmitting,
  uploadPhaseLabel,
  onClose,
  onSubmit,
}: DocumentWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stepError, setStepError] = useState('');

  const [docType, setDocType] = useState<DocType>('incoming');
  const [yearStr, setYearStr] = useState(() => getCurrentYearForType('incoming'));
  const [centralRegNo, setCentralRegNo] = useState('');
  const [receiveDate, setReceiveDate] = useState('');
  const [sender, setSender] = useState('');
  const [urgency, setUrgency] = useState<string>('ปกติ');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<string>('ลงรับแล้ว');
  const [assignee, setAssignee] = useState('นิศาชล คงดี');
  const [dueDate, setDueDate] = useState('');
  const [memoWork, setMemoWork] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [voucherDate, setVoucherDate] = useState('');
  const [voucherMaker, setVoucherMaker] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherCategory, setVoucherCategory] = useState('');
  const [voucherPayee, setVoucherPayee] = useState('');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherProject, setVoucherProject] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStepError('');
    setSelectedFile(null);
    setRemoveExistingAttachment(false);

    if (editingDoc) {
      const t = (editingDoc.type as DocType) || 'incoming';
      setStep(2);
      setDocType(t);
      setYearStr(editingDoc.yearStr || getCurrentYearForType(t));
      setCentralRegNo(editingDoc.centralRegNo === '-' ? '' : editingDoc.centralRegNo || '');
      setReceiveDate(editingDoc.receiveDate === '-' ? '' : editingDoc.receiveDate || '');
      setSender(editingDoc.sender || '');
      setUrgency(editingDoc.urgency || 'ปกติ');
      setDocNumber(editingDoc.docNumber || '');
      setDocDate(editingDoc.docDate || '');
      setSubject(editingDoc.subject || '');
      setStatus(editingDoc.status || 'ลงรับแล้ว');
      setAssignee(editingDoc.assignee || 'นิศาชล คงดี');
      setDueDate(editingDoc.dueDate || '');
      setMemoWork(editingDoc.memoWork || '');
      setFormCode(editingDoc.formCode || '');
      setFormName(editingDoc.formName || '');
      setVoucherDate(editingDoc.voucherDate || '');
      setVoucherMaker(editingDoc.voucherMaker || '');
      setVoucherNo(editingDoc.voucherNo || '');
      setVoucherCategory(editingDoc.voucherCategory || '');
      setVoucherPayee(editingDoc.voucherPayee || '');
      setVoucherAmount(editingDoc.voucherAmount ? String(editingDoc.voucherAmount) : '');
      setVoucherProject(editingDoc.voucherProject || '');
    } else {
      setStep(1);
      setDocType('incoming');
      setYearStr(getCurrentYearForType('incoming'));
      setCentralRegNo('');
      setReceiveDate('');
      setSender('');
      setUrgency('ปกติ');
      setDocNumber('');
      setDocDate('');
      setSubject('');
      setStatus('ลงรับแล้ว');
      setAssignee('นิศาชล คงดี');
      setDueDate('');
      setMemoWork('');
      setFormCode('');
      setFormName('');
      setVoucherDate('');
      setVoucherMaker('');
      setVoucherNo('');
      setVoucherCategory('');
      setVoucherPayee('');
      setVoucherAmount('');
      setVoucherProject('');
    }
  }, [isOpen, editingDoc]);

  const currentYearForDocType = getCurrentYearForType(docType);

  const yearOptions = useMemo(() => {
    const list = getAvailableYears(documents, true, currentYearForDocType);
    if (yearStr && !list.includes(yearStr)) {
      return [yearStr, ...list];
    }
    return list;
  }, [documents, currentYearForDocType, yearStr]);

  const suggestions = useMemo(() => {
    return {
      incomingSenders: getUniqueNormalizedSuggestions(
        documents.filter((d) => d.type === 'incoming').map((d) => d.sender)
      ),
      outgoingRecipients: getUniqueNormalizedSuggestions(
        documents.filter((d) => d.type === 'outgoing').map((d) => d.sender)
      ),
      memoAddressees: getUniqueNormalizedSuggestions(
        documents.filter((d) => d.type === 'memos').map((d) => d.sender)
      ),
      voucherMakers: getUniqueNormalizedSuggestions(
        documents.filter((d) => d.type === 'vouchers').map((d) => d.voucherMaker)
      ),
      voucherCategories: getUniqueNormalizedSuggestions(
        documents.filter((d) => d.type === 'vouchers').map((d) => d.voucherCategory)
      ),
      voucherPayees: getUniqueNormalizedSuggestions(
        documents.filter((d) => d.type === 'vouchers').map((d) => d.voucherPayee)
      ),
      assignees: getUniqueNormalizedSuggestions([
        'นิศาชล คงดี',
        ...documents.map((d) => d.assignee),
      ]),
    };
  }, [documents]);

  const previewRegNo = useMemo(() => {
    if (docType !== 'incoming') return '-';
    if (editingDoc) return `${editingDoc.regNo} - ${yearStr}`;
    const next = getNextRegNoForYear(documents, 'incoming', yearStr);
    return `${next} - ${yearStr}`;
  }, [docType, editingDoc, documents, yearStr]);

  if (!isOpen) return null;

  const handleSelectType = (nextType: DocType) => {
    setDocType(nextType);
    if (!editingDoc) {
      setStatus(['outgoing', 'orders', 'memos'].includes(nextType) ? 'ออกเอกสาร' : 'ลงรับแล้ว');
      if (DOC_TYPE_META[nextType].yearKind !== 'none') {
        setYearStr(getCurrentYearForType(nextType));
      }
    }
  };

  const validateStep2 = (): string | null => {
    if (docType === 'incoming') {
      if (!centralRegNo.trim()) return 'กรุณาระบุเลขที่รับส่วนกลาง';
      if (!receiveDate) return 'กรุณาระบุวันที่ลงรับ';
      if (!sender.trim()) return 'กรุณาระบุผู้ส่ง / หน่วยงานต้นสังกัด';
      if (!docNumber.trim()) return 'กรุณาระบุเลขที่หนังสือ';
      if (!docDate) return 'กรุณาระบุลงวันที่';
      if (!subject.trim()) return 'กรุณาระบุเรื่องหนังสือ';
    } else if (docType === 'outgoing') {
      if (!docNumber.trim()) return 'กรุณาระบุเลขที่หนังสือส่ง';
      if (!docDate) return 'กรุณาระบุลงวันที่';
      if (!subject.trim()) return 'กรุณาระบุเรื่องหนังสือส่ง';
      if (!sender.trim()) return 'กรุณาระบุผู้รับ / หน่วยงานรับ';
    } else if (docType === 'orders') {
      if (!docNumber.trim()) return 'กรุณาระบุเลขที่คำสั่ง';
      if (!docDate) return 'กรุณาระบุลงวันที่';
      if (!subject.trim()) return 'กรุณาระบุเรื่องคำสั่ง';
    } else if (docType === 'memos') {
      if (!memoWork.trim()) return 'กรุณาระบุประเภทงาน';
      if (!docNumber.trim()) return 'กรุณาระบุเลขที่บันทึก';
      if (!docDate) return 'กรุณาระบุลงวันที่';
      if (!sender.trim()) return 'กรุณาระบุช่องเรียน';
      if (!subject.trim()) return 'กรุณาระบุเรื่องบันทึกข้อความ';
    } else if (docType === 'forms') {
      if (!memoWork.trim()) return 'กรุณาระบุงาน';
      if (!formCode.trim()) return 'กรุณาระบุเลขที่แบบ';
      if (!formName.trim()) return 'กรุณาระบุชื่อแบบฟอร์ม';
    } else if (docType === 'vouchers') {
      if (!voucherDate) return 'กรุณาระบุวันที่จัดทำ';
      if (!voucherMaker.trim()) return 'กรุณาระบุผู้จัดทำฎีกา';
      if (!voucherNo.trim()) return 'กรุณาระบุเลขที่ผู้เบิก';
      if (!voucherCategory.trim()) return 'กรุณาระบุประเภทฎีกา';
      if (!voucherPayee.trim()) return 'กรุณาระบุผู้รับเงิน';
      if (!voucherAmount || Number.isNaN(Number(voucherAmount))) return 'กรุณาระบุจำนวนเงินขอเบิก';
      if (!voucherProject.trim()) return 'กรุณาระบุชื่อโครงการ';
    }
    return null;
  };

  const handleNextStep = () => {
    setStepError('');
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) {
        setStepError(err);
        return;
      }
      setStep(3);
    }
  };

  const buildPayload = (): DocumentFormPayload => ({
    editId: editingDoc ? editingDoc.id : null,
    type: docType,
    yearStr,
    centralRegNo: centralRegNo.trim(),
    receiveDate,
    sender: normalizeWhitespace(sender),
    urgency,
    docNumber: docNumber.trim(),
    docDate,
    subject: subject.trim(),
    status,
    assignee: normalizeWhitespace(assignee) || 'นิศาชล คงดี',
    dueDate,
    memoWork: normalizeWhitespace(memoWork),
    formCode: formCode.trim(),
    formName: formName.trim(),
    voucherDate,
    voucherMaker: normalizeWhitespace(voucherMaker),
    voucherNo: voucherNo.trim(),
    voucherCategory: normalizeWhitespace(voucherCategory),
    voucherPayee: normalizeWhitespace(voucherPayee),
    voucherAmount: parseFloat(voucherAmount || '0') || 0,
    voucherProject: voucherProject.trim(),
    selectedFile,
    removeExistingAttachment,
  });

  const handleSaveFromStep2 = async () => {
    setStepError('');
    const err = validateStep2();
    if (err) {
      setStepError(err);
      return;
    }
    await onSubmit(buildPayload());
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNextStep();
      return;
    }
    const err = validateStep2();
    if (err) {
      setStep(2);
      setStepError(err);
      return;
    }
    await onSubmit(buildPayload());
  };

  const typeMeta = DOC_TYPE_META[docType];
  const hasExistingAttachment = Boolean(editingDoc?.fileData && editingDoc.fileData.trim());

  const stepLabels: { num: 1 | 2 | 3; title: string }[] = [
    { num: 1, title: '1. ประเภทและปี' },
    { num: 2, title: '2. รายละเอียดหนังสือ' },
    { num: 3, title: '3. มอบหมายและแนบไฟล์' },
  ];

  return (
    <div className="no-print fixed inset-0 z-50 bg-[#2F2A44]/55 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border-2 border-[#9690B0] shadow-2xl w-full max-w-3xl max-h-[93dvh] flex flex-col overflow-hidden my-auto">
        {/* Bright #B5B1C8 Signature Header */}
        <div className="bg-[#B5B1C8] px-5 sm:px-6 py-4 text-[#242038] flex items-center justify-between border-b-2 border-[#9690B0] shrink-0">
          <div>
            <h3 className="font-bold text-base sm:text-lg">
              {editingDoc ? 'แก้ไขข้อมูลทะเบียนเอกสาร' : 'ลงทะเบียนหนังสือใหม่'}
            </h3>
            <p className="text-xs text-[#3F3959]">
              ทำตามทีละขั้นตอนเพื่อความครบถ้วนและรันเลขทะเบียนอัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="ปิดหน้าต่าง"
            className="w-9 h-9 rounded-lg bg-white hover:bg-[#F5F4F9] border border-[#9690B0] text-[#242038] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Step Indicator Bar */}
        <div className="px-5 sm:px-6 py-3 bg-[#F5F4F9] border-b-2 border-[#B5B1C8] grid grid-cols-3 gap-2 shrink-0">
          {stepLabels.map((item) => {
            const isCurrent = step === item.num;
            const isDone = step > item.num;
            const clickable = Boolean(editingDoc) || item.num <= step;
            return (
              <button
                key={item.num}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) {
                    setStepError('');
                    setStep(item.num);
                  }
                }}
                className={`px-3 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap truncate ${
                  isCurrent
                    ? 'bg-[#6B6293] border-[#524A75] text-white shadow-xs'
                    : isDone
                    ? 'bg-[#DCFCE7] border-[#16A34A] text-[#14532D]'
                    : 'bg-white border-[#B5B1C8] text-slate-500'
                }`}
              >
                {isDone && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{item.title}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleFinalSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 saraban-scroll">
            {stepError && (
              <div className="px-4 py-3 rounded-xl border-2 border-[#DC2626] bg-[#FEE2E2] text-[#7F1D1D] text-sm font-semibold">
                {stepError}
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-[#242038] mb-2.5">
                    เลือกประเภทหนังสือ / ทะเบียนเอกสาร
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {DOC_TYPES_ORDER.map((t) => {
                      const meta = DOC_TYPE_META[t];
                      const active = docType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleSelectType(t)}
                          className={`p-3.5 rounded-xl border-2 text-left transition-colors flex flex-col justify-between gap-2 ${
                            active
                              ? 'border-[#6B6293] bg-[#ECEAF4] ring-2 ring-[#B5B1C8]'
                              : 'border-[#B5B1C8] bg-white hover:border-[#9690B0] hover:bg-[#F8F7FB]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-md border-2 text-xs font-bold ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                            {active && (
                              <span className="w-5 h-5 rounded-full bg-[#6B6293] text-white flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {meta.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {typeMeta.yearKind !== 'none' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-bold text-[#242038] mb-1.5">
                        {typeMeta.yearKind === 'fiscal' ? 'ปีงบประมาณ' : 'ปีปฏิทิน'}
                      </label>
                      <select
                        value={yearStr}
                        onChange={(e) => setYearStr(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#6B6293] bg-[#F5F4F9] text-[#242038] text-sm font-bold focus:outline-none"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {typeMeta.yearKind === 'fiscal' ? `ปีงบฯ ${y}` : `ปี ${y}`}
                            {y === currentYearForDocType ? ' (ปีปัจจุบัน)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {docType === 'incoming' && (
                      <div className="p-3.5 rounded-xl border-2 border-[#9690B0] bg-[#F5F4F9] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#242038]">
                            เลขรับกองช่าง (รันอัตโนมัติ)
                          </div>
                          <div className="text-[11px] text-[#574F7D]">
                            อ้างอิงลำดับตามปีปฏิทินที่เลือก
                          </div>
                        </div>
                        <div className="px-4 py-1.5 rounded-lg bg-[#6B6293] border border-[#524A75] text-white font-bold text-base tabular-nums whitespace-nowrap">
                          {previewRegNo}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl border-2 border-[#B5B1C8] bg-[#F5F4F9]">
                  <div className="text-xs font-bold text-[#242038]">
                    กำลังกรอกข้อมูล: {typeMeta.label}{' '}
                    {typeMeta.yearKind !== 'none' ? `(${yearStr})` : ''}
                  </div>
                  {docType === 'incoming' && (
                    <span className="px-2.5 py-1 rounded-lg bg-[#6B6293] text-white text-xs font-bold tabular-nums">
                      เลขรับ: {previewRegNo}
                    </span>
                  )}
                </div>

                {docType === 'incoming' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่รับส่วนกลาง *
                        </label>
                        <input
                          type="text"
                          value={centralRegNo}
                          onChange={(e) => setCentralRegNo(e.target.value)}
                          placeholder="เช่น รับกลาง-102/2569"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          วันที่ลงรับ *
                        </label>
                        <input
                          type="date"
                          value={receiveDate}
                          onChange={(e) => {
                            setReceiveDate(e.target.value);
                            if (!docDate) setDocDate(e.target.value);
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ผู้ส่ง / หน่วยงานต้นสังกัด *
                        </label>
                        <SmartAutocompleteInput
                          value={sender}
                          onChange={setSender}
                          suggestions={suggestions.incomingSenders}
                          placeholder="เช่น อำเภอพิบูลมังสาหาร"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ความเร่งด่วน
                        </label>
                        <select
                          value={urgency}
                          onChange={(e) => setUrgency(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm bg-white focus:outline-none"
                        >
                          {URGENCY_LEVELS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่หนังสือ *
                        </label>
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder="เช่น อบ 0023.23/ว 36"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ลงวันที่ *
                        </label>
                        <input
                          type="date"
                          value={docDate}
                          onChange={(e) => setDocDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        เรื่อง *
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="ระบุเรื่องหนังสือ"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {docType === 'outgoing' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่หนังสือส่ง *
                        </label>
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder="เช่น อบ 0023.23/12"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ลงวันที่ *
                        </label>
                        <input
                          type="date"
                          value={docDate}
                          onChange={(e) => setDocDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        เรื่อง *
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="ระบุเรื่องหนังสือส่ง"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        ผู้รับ / หน่วยงานรับ *
                      </label>
                      <SmartAutocompleteInput
                        value={sender}
                        onChange={setSender}
                        suggestions={suggestions.outgoingRecipients}
                        placeholder="เช่น ท้องถิ่นจังหวัดอุบลราชธานี"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {docType === 'orders' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่คำสั่ง *
                        </label>
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder="เช่น ที่ 5/2569"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ลงวันที่ *
                        </label>
                        <input
                          type="date"
                          value={docDate}
                          onChange={(e) => setDocDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        เรื่องคำสั่ง *
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="ระบุเรื่องคำสั่ง"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {docType === 'memos' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          งาน (ระบุประเภทงาน) *
                        </label>
                        <input
                          type="text"
                          value={memoWork}
                          onChange={(e) => setMemoWork(e.target.value)}
                          placeholder="เช่น งานโยธา, งานธุรการ"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่บันทึก *
                        </label>
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder="เช่น วส 001/2569"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ลงวันที่ *
                        </label>
                        <input
                          type="date"
                          value={docDate}
                          onChange={(e) => setDocDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เรียน *
                        </label>
                        <SmartAutocompleteInput
                          value={sender}
                          onChange={setSender}
                          suggestions={suggestions.memoAddressees}
                          placeholder="เช่น นายกองค์การบริหารส่วนตำบลไร่ใต้"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        เรื่อง *
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="ระบุเรื่องบันทึกข้อความ"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {docType === 'forms' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          งาน *
                        </label>
                        <input
                          type="text"
                          value={memoWork}
                          onChange={(e) => setMemoWork(e.target.value)}
                          placeholder="เช่น งานโยธา, งานประปา"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่แบบ *
                        </label>
                        <input
                          type="text"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value)}
                          placeholder="เช่น แบบ ปร.1"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        ชื่อแบบฟอร์ม *
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="ระบุชื่อแบบฟอร์มเอกสาร"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {docType === 'vouchers' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          วันที่จัดทำ *
                        </label>
                        <input
                          type="date"
                          value={voucherDate}
                          onChange={(e) => setVoucherDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ผู้จัดทำ *
                        </label>
                        <SmartAutocompleteInput
                          value={voucherMaker}
                          onChange={setVoucherMaker}
                          suggestions={suggestions.voucherMakers}
                          placeholder="ระบุชื่อผู้จัดทำฎีกา"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          เลขที่ผู้เบิก *
                        </label>
                        <input
                          type="text"
                          value={voucherNo}
                          onChange={(e) => setVoucherNo(e.target.value)}
                          placeholder="เช่น ฎีกาที่ 12/2569"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ประเภทฎีกา *
                        </label>
                        <SmartAutocompleteInput
                          value={voucherCategory}
                          onChange={setVoucherCategory}
                          suggestions={suggestions.voucherCategories}
                          placeholder="เช่น ค่าวัสดุ, ค่าจ้างเหมา"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          ผู้รับเงิน *
                        </label>
                        <SmartAutocompleteInput
                          value={voucherPayee}
                          onChange={setVoucherPayee}
                          suggestions={suggestions.voucherPayees}
                          placeholder="ระบุชื่อผู้รับเงิน"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          จำนวนเงินขอเบิก (บาท) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={voucherAmount}
                          onChange={(e) => setVoucherAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm tabular-nums focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        ชื่อโครงการ *
                      </label>
                      <input
                        type="text"
                        value={voucherProject}
                        onChange={(e) => setVoucherProject(e.target.value)}
                        placeholder="ระบุชื่อโครงการ"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] text-sm focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-5">
                {docType !== 'forms' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border-2 border-[#B5B1C8] bg-[#F8F7FB]">
                    <div>
                      <label className="block text-xs font-bold text-[#242038] mb-1.5">
                        ผู้รับผิดชอบ
                      </label>
                      <SmartAutocompleteInput
                        value={assignee}
                        onChange={setAssignee}
                        suggestions={suggestions.assignees}
                        placeholder="ระบุชื่อผู้รับผิดชอบ"
                        className="w-full px-3 py-2 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] bg-white text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#242038] mb-1.5">
                        สถานะดำเนินการ
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] bg-white text-sm font-semibold focus:outline-none"
                      >
                        {WORKFLOW_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#242038] mb-1.5">
                        กำหนดแล้วเสร็จ (ถ้ามี)
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border-2 border-[#B5B1C8] focus:border-[#6B6293] bg-white text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* File Upload Section */}
                <div className="p-4 rounded-xl border-2 border-[#9690B0] bg-[#F5F4F9] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#242038]">
                    <FileUp className="w-4 h-4 text-[#6B6293]" />
                    <span>แนบไฟล์เอกสารเพื่ออัปโหลดขึ้น Google Drive</span>
                  </div>

                  {hasExistingAttachment && !removeExistingAttachment && !selectedFile && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border-2 border-[#B5B1C8]">
                      <a
                        href={editingDoc?.fileData}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#574F7D] hover:underline flex items-center gap-2 min-w-0"
                      >
                        <Paperclip className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          ไฟล์แนบเดิม: {editingDoc?.fileName || 'เปิดดูไฟล์ใน Drive'}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setRemoveExistingAttachment(true)}
                        className="px-3 py-1.5 rounded-lg bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white border border-[#EF4444] text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>นำไฟล์ออก</span>
                      </button>
                    </div>
                  )}

                  {hasExistingAttachment && removeExistingAttachment && !selectedFile && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FEF3C7] border-2 border-[#D97706]">
                      <span className="text-xs font-semibold text-[#78350F]">
                        ไฟล์แนบเดิมจะถูกนำออกจากรายการเมื่อกดบันทึก
                      </span>
                      <button
                        type="button"
                        onClick={() => setRemoveExistingAttachment(false)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#D97706] text-[#78350F] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ยกเลิก</span>
                      </button>
                    </div>
                  )}

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                    className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#6B6293] file:text-white hover:file:bg-[#574F7D] bg-white rounded-xl border-2 border-[#B5B1C8] p-1.5"
                  />

                  {selectedFile ? (
                    <div className="text-xs font-semibold text-[#14532D] bg-[#DCFCE7] border border-[#16A34A] px-3 py-2 rounded-lg flex items-center justify-between">
                      <span className="truncate">
                        ไฟล์ที่เลือก: {selectedFile.name} (
                        {(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-[#7F1D1D] underline ml-2 shrink-0"
                      >
                        ล้างไฟล์
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[#574F7D]">
                      รองรับไฟล์ PDF, Word, Excel หรือรูปภาพ (หากไม่เลือกไฟล์ ระบบจะเว้นช่องไฟล์แนบไว้)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="px-5 sm:px-6 py-4 bg-[#F8F7FB] border-t-2 border-[#E2DFEE] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setStepError('');
                    setStep((prev) => (prev === 3 ? 2 : 1));
                  }}
                  className="px-4 py-2.5 rounded-xl border-2 border-[#B5B1C8] bg-white hover:bg-[#ECEAF4] text-[#242038] text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>ย้อนกลับ</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#B5B1C8] bg-white hover:bg-[#F5F4F9] text-[#242038] text-sm font-medium transition-colors"
              >
                ยกเลิก
              </button>

              {step === 1 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2.5 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] border-2 border-[#524A75] text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>ถัดไป</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 2 && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleNextStep}
                    className="px-4 py-2.5 rounded-xl border-2 border-[#6B6293] bg-[#ECEAF4] hover:bg-[#E2DFEE] text-[#242038] text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                  >
                    <span>ถัดไป</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveFromStep2}
                    className="px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] border-2 border-[#14532D] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{uploadPhaseLabel || 'กำลังบันทึก...'}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{editingDoc ? 'บันทึกการแก้ไข' : 'บันทึกหนังสือ'}</span>
                      </>
                    )}
                  </button>
                </>
              )}

              {step === 3 && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#6B6293] hover:bg-[#574F7D] border-2 border-[#524A75] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadPhaseLabel || 'กำลังบันทึก...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingDoc ? 'บันทึกการแก้ไข' : 'บันทึกหนังสือ'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
