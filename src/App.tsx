import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteDocModal, StatusUpdateModal } from './components/ActionModals';
import { DashboardView } from './components/DashboardView';
import type { QuickDetailSavePayload } from './components/DocumentDetailModal';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import type { DocumentFormPayload } from './components/DocumentWizardModal';
import { DocumentWizardModal } from './components/DocumentWizardModal';
import { LoginScreen } from './components/LoginScreen';
import { CoverSheetPrintModal, RegisterReportPrintModal } from './components/PrintViews';
import type { RegisterTabId } from './components/RegisterTableView';
import { RegisterTableView } from './components/RegisterTableView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { VouchersSummaryView } from './components/VouchersSummaryView';
import {
  callDriveApi,
  fetchDocumentsFromDrive,
  loadDocsCache,
  saveDocsCache,
} from './services/driveApi';
import type { DocType, RawSarabanRecord, SarabanDoc, TabId, ToastMessage, UserSession } from './types/saraban';
import { ADMIN_USER, STAFF_USER } from './types/saraban';
import {
  exportRegisterCSV,
  fileToBase64Data,
  formatThaiDateTime,
  getNextMemoDocNumber,
  getNextRegNoForYear,
  getUniqueNormalizedSuggestions,
  isOverdueDoc,
  mapRawRecordToDoc,
  parseExcelToImportRecords,
} from './utils/sarabanUtils';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession>(ADMIN_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('esaraban_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [documents, setDocuments] = useState<SarabanDoc[]>(() => loadDocsCache());
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(() => loadDocsCache().length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingWriteCount, setPendingWriteCount] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | number | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SarabanDoc | null>(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [uploadPhaseLabel, setUploadPhaseLabel] = useState('');

  const [detailDoc, setDetailDoc] = useState<SarabanDoc | null>(null);
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<SarabanDoc | null>(null);
  const [statusTargetDoc, setStatusTargetDoc] = useState<SarabanDoc | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const [coverSheetDoc, setCoverSheetDoc] = useState<SarabanDoc | null>(null);
  const [registerReport, setRegisterReport] = useState<{
    title: string;
    rows: SarabanDoc[];
    filterLabel: string;
  } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWriteCountRef = useRef<number>(0);

  const pushToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const cancelInFlightRead = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
      abortRef.current = null;
    }
    lastLoadTimeRef.current = Date.now();
  }, []);

  const enqueueBackgroundWrite = useCallback(
    (
      writeFn: () => Promise<void>,
      onRollback: () => void,
      errorTitle: string
    ) => {
      cancelInFlightRead();
      pendingWriteCountRef.current += 1;
      setPendingWriteCount(pendingWriteCountRef.current);
      setSyncError('');

      writeQueueRef.current = writeQueueRef.current
        .catch(() => {})
        .then(async () => {
          try {
            await writeFn();
            lastLoadTimeRef.current = Date.now();
          } catch (err) {
            onRollback();
            const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive';
            setSyncError(msg);
            pushToast('error', errorTitle, msg);
          } finally {
            pendingWriteCountRef.current = Math.max(0, pendingWriteCountRef.current - 1);
            setPendingWriteCount(pendingWriteCountRef.current);
          }
        });
    },
    [cancelInFlightRead, pushToast]
  );

  const syncFromDrive = useCallback(
    async (options: { force?: boolean; silent?: boolean } = {}) => {
      const { force = false, silent = false } = options;
      if (!force && pendingWriteCountRef.current > 0) {
        return;
      }
      if (
        !force &&
        documents.length > 0 &&
        lastLoadTimeRef.current > 0 &&
        Date.now() - lastLoadTimeRef.current < 15000
      ) {
        return;
      }

      if (force && abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsSyncing(true);
      setSyncError('');
      if (documents.length === 0) setIsLoadingDocs(true);

      try {
        if (pendingWriteCountRef.current > 0) {
          await writeQueueRef.current;
        }
        const fetched = await fetchDocumentsFromDrive(controller.signal);
        if (controller.signal.aborted) return;
        setDocuments(fetched);
        saveDocsCache(fetched);
        lastLoadTimeRef.current = Date.now();
        setIsLoadingDocs(false);
        setSyncError('');
        if (force && !silent) {
          pushToast('success', 'ซิงค์ข้อมูลสำเร็จ', `อัปเดตเอกสารทั้งหมด ${fetched.length} รายการ`);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ Google Drive ได้';
        setIsLoadingDocs(false);
        setSyncError(msg);
        if (!silent || documents.length === 0) {
          pushToast('error', 'ไม่สามารถเชื่อมต่อ Google Drive ได้', msg);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsSyncing(false);
      }
    },
    [documents.length, pushToast]
  );

  useEffect(() => {
    const cached = loadDocsCache();
    if (cached.length > 0) {
      setDocuments(cached);
      setIsLoadingDocs(false);
    }
    syncFromDrive({ silent: cached.length > 0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = currentUser.role === 'admin' && currentUser.name === 'นิศาชล คงดี';

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('esaraban_sidebar_collapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleViewportChange = () => {
      setMobileMenuOpen(false);
    };
    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  const handleLoginAdmin = () => {
    setCurrentUser(ADMIN_USER);
    setIsAuthenticated(true);
    setShowRoleModal(false);
    syncFromDrive({ silent: documents.length > 0 });
    pushToast('success', 'เข้าสู่ระบบสำเร็จ', 'สิทธิ์ผู้ดูแลระบบ (นส. นิศาชล คงดี)');
  };

  const handleLoginStaff = () => {
    setCurrentUser(STAFF_USER);
    setIsAuthenticated(true);
    setShowRoleModal(false);
    if (activeTab === 'myInbox') setActiveTab('dashboard');
    syncFromDrive({ silent: documents.length > 0 });
    pushToast('info', 'เข้าสู่ระบบสำเร็จ', 'สิทธิ์บุคลากร / เจ้าหน้าที่');
  };

  const handleSelectTab = (tab: TabId) => {
    if (tab === 'myInbox' && !isAdmin) {
      setActiveTab('dashboard');
      return;
    }
    setActiveTab(tab);
  };

  const myInboxCount = useMemo(() => {
    return documents.filter(
      (d) =>
        String(d.assignee || '').trim() === currentUser.name &&
        String(d.status || '').trim() !== 'เสร็จสิ้น'
    ).length;
  }, [documents, currentUser.name]);

  const assigneeSuggestions = useMemo(
    () => getUniqueNormalizedSuggestions(['นิศาชล คงดี', ...documents.map((d) => d.assignee)]),
    [documents]
  );

  const overdueCount = useMemo(
    () => documents.filter((d) => isOverdueDoc(d)).length,
    [documents]
  );

  const handleOpenNewDoc = () => {
    if (!isAdmin) {
      pushToast('warning', 'ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ลงทะเบียนหนังสือใหม่');
      return;
    }
    setEditingDoc(null);
    setWizardOpen(true);
  };

  const handleEditDoc = (doc: SarabanDoc) => {
    if (!isAdmin) {
      pushToast('warning', 'ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์แก้ไขข้อมูล');
      return;
    }
    setEditingDoc(doc);
    setWizardOpen(true);
  };

  const handleSaveDocument = async (payload: DocumentFormPayload) => {
    if (!isAdmin) return;

    let uploadedFileName = '';
    let uploadedFileUrl = '';

    if (payload.selectedFile) {
      setIsSubmittingDoc(true);
      setUploadPhaseLabel('กำลังอัปโหลดไฟล์ขึ้น Drive...');
      try {
        const base64Data = await fileToBase64Data(payload.selectedFile);
        const uploadRes = await callDriveApi({
          action: 'uploadFile',
          fileData: base64Data,
          mimeType: payload.selectedFile.type || 'application/octet-stream',
          fileName: payload.selectedFile.name,
        });
        if (!uploadRes.fileUrl) {
          throw new Error(uploadRes.message || 'อัปโหลดไฟล์ไปยัง Google Drive ไม่สำเร็จ');
        }
        uploadedFileName = payload.selectedFile.name;
        uploadedFileUrl = uploadRes.fileUrl;
      } catch (err) {
        setIsSubmittingDoc(false);
        setUploadPhaseLabel('');
        pushToast(
          'error',
          'อัปโหลดไฟล์ไม่สำเร็จ',
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive'
        );
        return;
      } finally {
        setIsSubmittingDoc(false);
        setUploadPhaseLabel('');
      }
    }

    const previousDocs = documents;

    if (payload.editId !== null) {
      const existingDoc = documents.find((d) => String(d.id) === String(payload.editId));
      const statusChanged = Boolean(existingDoc && existingDoc.status !== payload.status);
      const statusUpdateTime = statusChanged ? formatThaiDateTime(new Date()) : '';

      const updates: Record<string, unknown> = {
        type: payload.type,
        doc_number: payload.docNumber,
        doc_date: payload.docDate,
        subject: payload.subject,
        sender: payload.sender,
        status: payload.status,
        assignee: payload.assignee,
        due_date: payload.dueDate,
        year_str: payload.yearStr,
        central_reg_no: payload.type === 'incoming' ? payload.centralRegNo || '-' : '-',
        receive_date: payload.type === 'incoming' ? payload.receiveDate || '-' : '-',
        urgency: payload.type === 'incoming' ? payload.urgency : 'ปกติ',
        memo_work: payload.memoWork,
        form_code: payload.formCode,
        form_name: payload.formName,
        voucher_date: payload.voucherDate,
        voucher_maker: payload.voucherMaker,
        voucher_no: payload.voucherNo,
        voucher_category: payload.voucherCategory,
        voucher_payee: payload.voucherPayee,
        voucher_amount: payload.voucherAmount,
        voucher_project: payload.voucherProject,
      };

      if (statusChanged) {
        updates.ack_status = 'รับทราบแล้ว';
        updates.ack_time = statusUpdateTime;
      }
      if (payload.removeExistingAttachment) {
        updates.file_name = '';
        updates.file_url = '';
      }
      if (uploadedFileName && uploadedFileUrl) {
        updates.file_name = uploadedFileName;
        updates.file_url = uploadedFileUrl;
      }

      const nextDocs = documents.map((d) => {
        if (String(d.id) !== String(payload.editId)) return d;
        const nextFileName = uploadedFileName
          ? uploadedFileName
          : payload.removeExistingAttachment
          ? ''
          : d.fileName;
        const nextFileData = uploadedFileUrl
          ? uploadedFileUrl
          : payload.removeExistingAttachment
          ? ''
          : d.fileData;

        return mapRawRecordToDoc({
          id: d.id,
          type: payload.type,
          reg_no: payload.type === 'incoming' ? d.regNo : '-',
          year_str: payload.yearStr,
          central_reg_no: payload.type === 'incoming' ? payload.centralRegNo || '-' : '-',
          receive_date: payload.type === 'incoming' ? payload.receiveDate || '-' : '-',
          sender: payload.sender,
          urgency: payload.type === 'incoming' ? payload.urgency : 'ปกติ',
          doc_number: payload.docNumber,
          doc_date: payload.docDate,
          subject: payload.subject,
          status: payload.status,
          assignee: payload.assignee,
          due_date: payload.dueDate,
          ack_status: statusChanged ? 'รับทราบแล้ว' : d.ackStatus,
          ack_time: statusChanged ? statusUpdateTime : d.ackTime,
          file_name: nextFileName,
          file_url: nextFileData,
          memo_work: payload.memoWork,
          form_code: payload.formCode,
          form_name: payload.formName,
          voucher_date: payload.voucherDate,
          voucher_maker: payload.voucherMaker,
          voucher_no: payload.voucherNo,
          voucher_category: payload.voucherCategory,
          voucher_payee: payload.voucherPayee,
          voucher_amount: payload.voucherAmount,
          voucher_project: payload.voucherProject,
        });
      });

      setDocuments(nextDocs);
      saveDocsCache(nextDocs);
      setWizardOpen(false);
      setEditingDoc(null);
      pushToast('success', 'อัปเดตข้อมูลสำเร็จ', 'บันทึกการแก้ไขเรียบร้อยแล้ว');

      enqueueBackgroundWrite(
        async () => {
          await callDriveApi({
            action: 'update',
            id: payload.editId,
            type: existingDoc?.type || payload.type,
            updates,
          });
        },
        () => {
          setDocuments(previousDocs);
          saveDocsCache(previousDocs);
        },
        'บันทึกการแก้ไขลง Google Drive ไม่สำเร็จ'
      );
    } else {
      const nextRegNo =
        payload.type === 'incoming'
          ? getNextRegNoForYear(documents, 'incoming', payload.yearStr)
          : '-';
      const enforcedDocNumber =
        payload.type === 'memos'
          ? getNextMemoDocNumber(documents, payload.docDate)
          : payload.docNumber;
      const newId = Date.now();

      const rawRecord: RawSarabanRecord = {
        id: newId,
        type: payload.type,
        reg_no: nextRegNo,
        year_str: payload.yearStr,
        central_reg_no: payload.type === 'incoming' ? payload.centralRegNo || '-' : '-',
        receive_date: payload.type === 'incoming' ? payload.receiveDate || '-' : '-',
        sender: payload.sender,
        urgency: payload.type === 'incoming' ? payload.urgency : 'ปกติ',
        doc_number: enforcedDocNumber,
        doc_date: payload.docDate,
        subject: payload.subject,
        status: payload.status,
        assignee: payload.assignee,
        due_date: payload.dueDate,
        ack_status: 'รอรับทราบ',
        ack_time: '-',
        file_name: uploadedFileName,
        file_url: uploadedFileUrl,
        memo_work: payload.memoWork,
        form_code: payload.formCode,
        form_name: payload.formName,
        voucher_date: payload.voucherDate,
        voucher_maker: payload.voucherMaker,
        voucher_no: payload.voucherNo,
        voucher_category: payload.voucherCategory,
        voucher_payee: payload.voucherPayee,
        voucher_amount: payload.voucherAmount,
        voucher_project: payload.voucherProject,
      };

      const optimisticDoc = mapRawRecordToDoc(rawRecord);
      const nextDocs = [optimisticDoc, ...documents];
      setDocuments(nextDocs);
      saveDocsCache(nextDocs);
      setSelectedDocId(newId);
      setWizardOpen(false);
      setEditingDoc(null);
      pushToast('success', 'ลงทะเบียนสำเร็จ', 'เพิ่มรายการหนังสือใหม่เรียบร้อยแล้ว');

      enqueueBackgroundWrite(
        async () => {
          await callDriveApi({
            action: 'insert',
            record: rawRecord as unknown as Record<string, unknown>,
          });
        },
        () => {
          setDocuments(previousDocs);
          saveDocsCache(previousDocs);
        },
        'บันทึกข้อมูลลง Google Drive ไม่สำเร็จ'
      );
    }
  };

  const handleConfirmDelete = async (mode: 'attachment' | 'record') => {
    if (!deleteTargetDoc || !isAdmin) return;
    const targetDoc = deleteTargetDoc;
    const previousDocs = documents;

    if (mode === 'attachment') {
      const nextDocs = documents.map((d) =>
        String(d.id) === String(targetDoc.id) ? { ...d, fileName: '', fileData: '' } : d
      );
      setDocuments(nextDocs);
      saveDocsCache(nextDocs);
      setDeleteTargetDoc(null);
      setIsActionBusy(false);
      pushToast('success', 'นำไฟล์แนบออกแล้ว', 'เก็บข้อมูลรายการหนังสือไว้ตามเดิม');

      enqueueBackgroundWrite(
        async () => {
          await callDriveApi({
            action: 'update',
            id: targetDoc.id,
            type: targetDoc.type,
            updates: { file_name: '', file_url: '' },
          });
        },
        () => {
          setDocuments(previousDocs);
          saveDocsCache(previousDocs);
        },
        'นำไฟล์แนบออกใน Google Drive ไม่สำเร็จ'
      );
    } else {
      const nextDocs = documents.filter((d) => String(d.id) !== String(targetDoc.id));
      setDocuments(nextDocs);
      saveDocsCache(nextDocs);
      setDeleteTargetDoc(null);
      setIsActionBusy(false);
      pushToast('success', 'ลบรายการสำเร็จ', 'ลบรายการเอกสารเรียบร้อยแล้ว');

      enqueueBackgroundWrite(
        async () => {
          await callDriveApi({
            action: 'delete',
            id: targetDoc.id,
            type: targetDoc.type,
          });
        },
        () => {
          setDocuments(previousDocs);
          saveDocsCache(previousDocs);
        },
        'ลบรายการจาก Google Drive ไม่สำเร็จ'
      );
    }
  };

  const handleAcknowledgeDoc = (doc: SarabanDoc) => {
    const ackTimeStr = formatThaiDateTime(new Date());
    const previousDocs = documents;
    const nextDocs = documents.map((d) =>
      String(d.id) === String(doc.id)
        ? { ...d, ackStatus: 'รับทราบแล้ว', ackTime: ackTimeStr }
        : d
    );
    setDocuments(nextDocs);
    saveDocsCache(nextDocs);
    pushToast('success', 'รับทราบงานแล้ว', `บันทึกเวลารับทราบ: ${ackTimeStr}`);

    enqueueBackgroundWrite(
      async () => {
        await callDriveApi({
          action: 'update',
          id: doc.id,
          type: doc.type,
          updates: {
            ack_status: 'รับทราบแล้ว',
            ack_time: ackTimeStr,
          },
        });
      },
      () => {
        setDocuments(previousDocs);
        saveDocsCache(previousDocs);
      },
      'บันทึกการรับทราบงานลง Google Drive ไม่สำเร็จ'
    );
  };

  const handleConfirmStatusUpdate = async (newStatus: string) => {
    if (!statusTargetDoc) return;
    const targetDoc = statusTargetDoc;
    const previousDocs = documents;
    const updateTimeStr = formatThaiDateTime(new Date());

    const nextDocs = documents.map((d) =>
      String(d.id) === String(targetDoc.id)
        ? {
            ...d,
            status: newStatus,
            ackStatus: 'รับทราบแล้ว',
            ackTime: updateTimeStr,
          }
        : d
    );
    setDocuments(nextDocs);
    saveDocsCache(nextDocs);
    setStatusTargetDoc(null);
    setIsActionBusy(false);
    pushToast('success', 'อัปเดตสถานะแล้ว', `สถานะใหม่: ${newStatus} (${updateTimeStr})`);

    enqueueBackgroundWrite(
      async () => {
        await callDriveApi({
          action: 'update',
          id: targetDoc.id,
          type: targetDoc.type,
          updates: {
            status: newStatus,
            ack_status: 'รับทราบแล้ว',
            ack_time: updateTimeStr,
          },
        });
      },
      () => {
        setDocuments(previousDocs);
        saveDocsCache(previousDocs);
      },
      'อัปเดตสถานะใน Google Drive ไม่สำเร็จ'
    );
  };

  const handleQuickDetailSave = async (payload: QuickDetailSavePayload) => {
    if (!isAdmin) return;

    let uploadedFileName = '';
    let uploadedFileUrl = '';

    if (payload.selectedFile) {
      setIsSubmittingDoc(true);
      setUploadPhaseLabel('กำลังอัปโหลดไฟล์ขึ้น Drive...');
      try {
        const base64Data = await fileToBase64Data(payload.selectedFile);
        const uploadRes = await callDriveApi({
          action: 'uploadFile',
          fileData: base64Data,
          mimeType: payload.selectedFile.type || 'application/octet-stream',
          fileName: payload.selectedFile.name,
        });
        if (!uploadRes.fileUrl) {
          throw new Error(uploadRes.message || 'อัปโหลดไฟล์ไปยัง Google Drive ไม่สำเร็จ');
        }
        uploadedFileName = payload.selectedFile.name;
        uploadedFileUrl = uploadRes.fileUrl;
      } catch (err) {
        setIsSubmittingDoc(false);
        setUploadPhaseLabel('');
        pushToast(
          'error',
          'อัปโหลดไฟล์ไม่สำเร็จ',
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive'
        );
        return;
      } finally {
        setIsSubmittingDoc(false);
        setUploadPhaseLabel('');
      }
    }

    const previousDocs = documents;
    const previousDetail = detailDoc;
    const existingDoc = documents.find((d) => String(d.id) === String(payload.id));
    const statusChanged = Boolean(existingDoc && existingDoc.status !== payload.status);
    const statusUpdateTime = statusChanged ? formatThaiDateTime(new Date()) : '';

    const updates: Record<string, unknown> = {
      assignee: payload.assignee,
      status: payload.status,
      due_date: payload.dueDate,
    };

    if (statusChanged) {
      updates.ack_status = 'รับทราบแล้ว';
      updates.ack_time = statusUpdateTime;
    }

    if (payload.removeExistingAttachment) {
      updates.file_name = '';
      updates.file_url = '';
    }
    if (uploadedFileName && uploadedFileUrl) {
      updates.file_name = uploadedFileName;
      updates.file_url = uploadedFileUrl;
    }

    const nextDocs = documents.map((d) => {
      if (String(d.id) !== String(payload.id)) return d;
      const updated: SarabanDoc = {
        ...d,
        assignee: payload.assignee,
        status: payload.status,
        dueDate: payload.dueDate,
      };
      if (statusChanged) {
        updated.ackStatus = 'รับทราบแล้ว';
        updated.ackTime = statusUpdateTime;
      }
      if (payload.removeExistingAttachment) {
        updated.fileName = '';
        updated.fileData = '';
      }
      if (uploadedFileName && uploadedFileUrl) {
        updated.fileName = uploadedFileName;
        updated.fileData = uploadedFileUrl;
      }
      return updated;
    });

    setDocuments(nextDocs);
    saveDocsCache(nextDocs);
    const updatedDetail = nextDocs.find((d) => String(d.id) === String(payload.id)) || null;
    setDetailDoc(updatedDetail);
    pushToast('success', 'บันทึกข้อมูลเพิ่มเติมสำเร็จ', 'อัปเดตการมอบหมายและสถานะเรียบร้อยแล้ว');

    enqueueBackgroundWrite(
      async () => {
        await callDriveApi({
          action: 'update',
          id: payload.id,
          type: existingDoc?.type,
          updates,
        });
      },
      () => {
        setDocuments(previousDocs);
        saveDocsCache(previousDocs);
        setDetailDoc(previousDetail);
      },
      'บันทึกข้อมูลเพิ่มเติมลง Google Drive ไม่สำเร็จ'
    );
  };

  const handleImportExcel = async (type: DocType, yearStr: string, file: File) => {
    if (!isAdmin) return;
    pushToast('info', 'กำลังอ่านไฟล์ Excel...', file.name);
    try {
      const records = await parseExcelToImportRecords(file, type, yearStr, documents);
      await callDriveApi({
        action: 'insertBatch',
        records,
      });
      pushToast(
        'success',
        'นำเข้าข้อมูลสำเร็จ',
        `บันทึกข้อมูลลง Google Drive จำนวน ${records.length} รายการ`
      );
      await syncFromDrive({ force: true, silent: true });
    } catch (err) {
      pushToast(
        'error',
        'นำเข้าไฟล์ Excel ไม่สำเร็จ',
        err instanceof Error ? err.message : 'กรุณาตรวจสอบรูปแบบไฟล์อีกครั้ง'
      );
    }
  };

  const handleExportCSV = (type: DocType) => {
    const ok = exportRegisterCSV(documents, type);
    if (!ok) {
      pushToast('warning', 'ไม่มีข้อมูลสำหรับส่งออก', 'ไม่พบรายการในทะเบียนนี้');
    } else {
      pushToast('success', 'ส่งออกไฟล์ CSV สำเร็จ');
    }
  };

  return (
    <div className="min-h-dvh bg-[#F8F7FB] text-[#242038]">
      {/* Initial Login Gate or Role Switch Modal */}
      {(!isAuthenticated || showRoleModal) && (
        <LoginScreen
          onLoginAdmin={handleLoginAdmin}
          onLoginStaff={handleLoginStaff}
          canDismiss={isAuthenticated}
          onDismiss={() => setShowRoleModal(false)}
        />
      )}

      {/* Main App Shell */}
      {isAuthenticated && (
        <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            currentUser={currentUser}
            collapsed={sidebarCollapsed}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            myInboxCount={myInboxCount}
            overdueCount={overdueCount}
            onOpenRoleSwitch={() => setShowRoleModal(true)}
            onLogout={() => {
              setIsAuthenticated(false);
              setShowRoleModal(false);
            }}
          />

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <TopBar
              activeTab={activeTab}
              currentUser={currentUser}
              docCount={documents.length}
              isSyncing={isSyncing || pendingWriteCount > 0}
              syncError={syncError}
              onSync={() => syncFromDrive({ force: true })}
              onOpenNewDoc={handleOpenNewDoc}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onToggleSidebar={handleToggleSidebar}
            />

            <main className="no-print flex-1 min-h-0 flex flex-col overflow-y-auto p-3.5 sm:p-4 lg:p-5 pb-20 lg:pb-5 saraban-scroll">
              {activeTab === 'dashboard' && (
                <DashboardView
                  documents={documents}
                  isLoading={isLoadingDocs}
                  isAdmin={isAdmin}
                  selectedDocId={selectedDocId}
                  onSelectDoc={(id) => setSelectedDocId(id)}
                  onViewDoc={(doc) => {
                    setSelectedDocId(doc.id);
                    setDetailDoc(doc);
                  }}
                  onEditDoc={handleEditDoc}
                  onDeleteDoc={(doc) => setDeleteTargetDoc(doc)}
                  onNavigateTab={handleSelectTab}
                />
              )}

              {activeTab === 'vouchersSummary' && (
                <VouchersSummaryView
                  documents={documents}
                  onViewDoc={(doc) => {
                    setSelectedDocId(doc.id);
                    setDetailDoc(doc);
                  }}
                />
              )}

              {activeTab !== 'dashboard' && activeTab !== 'vouchersSummary' && (
                <RegisterTableView
                  tabId={activeTab as RegisterTabId}
                  documents={documents}
                  currentUser={currentUser}
                  isLoading={isLoadingDocs}
                  loadError={syncError}
                  selectedDocId={selectedDocId}
                  onSelectDoc={(id) => setSelectedDocId(id)}
                  onViewDoc={(doc) => {
                    setSelectedDocId(doc.id);
                    setDetailDoc(doc);
                  }}
                  onEditDoc={handleEditDoc}
                  onDeleteDoc={(doc) => setDeleteTargetDoc(doc)}
                  onAcknowledgeDoc={handleAcknowledgeDoc}
                  onUpdateStatusDoc={(doc) => setStatusTargetDoc(doc)}
                  onExportCSV={handleExportCSV}
                  onImportExcel={handleImportExcel}
                  onPrintRegisterReport={(title, rows, filterLabel) =>
                    setRegisterReport({ title, rows, filterLabel })
                  }
                  onRetrySync={() => syncFromDrive({ force: true })}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Modals */}
      <DocumentWizardModal
        isOpen={wizardOpen}
        editingDoc={editingDoc}
        documents={documents}
        isSubmitting={isSubmittingDoc}
        uploadPhaseLabel={uploadPhaseLabel}
        onClose={() => {
          setWizardOpen(false);
          setEditingDoc(null);
        }}
        onSubmit={handleSaveDocument}
      />

      <DocumentDetailModal
        doc={detailDoc}
        isAdmin={isAdmin}
        assigneeSuggestions={assigneeSuggestions}
        isSavingQuickUpdate={isSubmittingDoc}
        uploadPhaseLabel={uploadPhaseLabel}
        onClose={() => setDetailDoc(null)}
        onEdit={handleEditDoc}
        onPrintCoverSheet={(doc) => {
          setDetailDoc(null);
          setCoverSheetDoc(doc);
        }}
        onQuickSave={handleQuickDetailSave}
      />

      <DeleteDocModal
        doc={deleteTargetDoc}
        isBusy={isActionBusy}
        onClose={() => setDeleteTargetDoc(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      <StatusUpdateModal
        doc={statusTargetDoc}
        isBusy={isActionBusy}
        onClose={() => setStatusTargetDoc(null)}
        onConfirmStatus={handleConfirmStatusUpdate}
      />

      <CoverSheetPrintModal
        doc={coverSheetDoc}
        onClose={() => setCoverSheetDoc(null)}
      />

      <RegisterReportPrintModal
        report={registerReport}
        onClose={() => setRegisterReport(null)}
      />

      {/* In-App Toast Notifications */}
      <div className="no-print fixed bottom-20 lg:bottom-5 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        {toasts.map((toast) => {
          const styleMap = {
            success: 'bg-[#DCFCE7] border-[#16A34A] text-[#14532D]',
            error: 'bg-[#FEE2E2] border-[#DC2626] text-[#7F1D1D]',
            warning: 'bg-[#FEF3C7] border-[#D97706] text-[#78350F]',
            info: 'bg-[#E0F2FE] border-[#0284C7] text-[#0C4A6E]',
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-2.5 ${styleMap}`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : toast.type === 'info' ? (
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">{toast.title}</div>
                {toast.description && (
                  <div className="text-[11px] mt-0.5 opacity-90">{toast.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="opacity-70 hover:opacity-100 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
