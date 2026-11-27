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
import type { RegisterFilterPreset, RegisterTabId } from './components/RegisterTableView';
import { RegisterTableView } from './components/RegisterTableView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { VouchersSummaryView } from './components/VouchersSummaryView';
import {
  callDriveApi,
  fetchDocumentsFromDrive,
  loadDocsCache,
  saveDocsCache,
  uploadFileToDrive,
} from './services/driveApi';
import type {
  ProcurementSyncSelection,
  SarabanProcurementSyncRecord,
} from './services/procurementSyncApi';
import {
  deleteProcurementQueue,
  fetchProcurementOptions,
  fetchProcurementQueueStatuses,
  formatProcurementDisplayTitle,
  getProcurementQueueStatusMeta,
  getProcurementSyncRevision,
  incrementProcurementSyncRevision,
  loadProcurementSyncMap,
  markProcurementQueueAsDeleted,
  pushProcurementQueue,
  reconcileProcurementSyncMap,
  removeProcurementSyncRecord,
  saveProcurementSyncRecord,
} from './services/procurementSyncApi';
import type {
  ProjectSyncSelection,
  SarabanAttachmentMeta,
  SarabanProjectSyncRecord,
} from './services/projectSyncApi';
import {
  deleteSarabanQueue,
  fetchProjectOptions,
  fetchSarabanQueueStatuses,
  getProjectSyncRevision,
  getQueueStatusMeta,
  incrementProjectSyncRevision,
  inferMimeTypeFromFileName,
  loadProjectSyncMap,
  markQueueAsDeleted,
  pushSarabanQueue,
  reconcileProjectSyncMap,
  removeProjectSyncRecord,
  saveProjectSyncRecord,
} from './services/projectSyncApi';
import type { DocAttachment, DocType, RawSarabanRecord, SarabanDoc, TabId, ToastMessage, UserSession } from './types/saraban';
import { ADMIN_USER, STAFF_USER, TAB_TITLES } from './types/saraban';
import {
  downloadExcelImportTemplate,
  exportRegisterCSV,
  formatThaiDateTime,
  getDocAttachments,
  getNextMemoDocNumber,
  getNextRegNoForYear,
  getTodayISO,
  getUniqueNormalizedSuggestions,
  isOverdueDoc,
  mapRawRecordToDoc,
  mergeDocAttachments,
  parseExcelToImportRecords,
  resolveManualAttachmentName,
  serializeDocAttachments,
  validateAttachmentUrl,
} from './utils/sarabanUtils';

const AUTH_SESSION_STORAGE_KEY = 'esaraban_auth_session_v1';
const ACTIVE_TAB_STORAGE_KEY = 'esaraban_active_tab_v1';

function loadSavedAuthSession(): { user: UserSession; isAuthenticated: boolean } {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return { user: ADMIN_USER, isAuthenticated: false };
    const parsed = JSON.parse(raw) as { role?: string };
    if (parsed?.role === 'admin') {
      return { user: ADMIN_USER, isAuthenticated: true };
    }
    if (parsed?.role === 'staff') {
      return { user: STAFF_USER, isAuthenticated: true };
    }
  } catch {}
  return { user: ADMIN_USER, isAuthenticated: false };
}

function loadSavedActiveTab(isAdminSession: boolean): TabId {
  try {
    // Clean up legacy localStorage key so reopening after closing the browser always starts on dashboard
    localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    const saved = sessionStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as TabId | null;
    if (saved && Object.prototype.hasOwnProperty.call(TAB_TITLES, saved)) {
      if (saved === 'myInbox' && !isAdminSession) {
        return 'dashboard';
      }
      return saved;
    }
  } catch {}
  return 'dashboard';
}

export default function App() {
  const initialAuth = useMemo(() => loadSavedAuthSession(), []);
  const [currentUser, setCurrentUser] = useState<UserSession>(initialAuth.user);
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth.isAuthenticated);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>(() =>
    loadSavedActiveTab(initialAuth.user.role === 'admin')
  );
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
  const [registerFilterPreset, setRegisterFilterPreset] = useState<RegisterFilterPreset | null>(
    null
  );

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SarabanDoc | null>(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [uploadPhaseLabel, setUploadPhaseLabel] = useState('');

  const [detailDoc, setDetailDoc] = useState<SarabanDoc | null>(null);
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<SarabanDoc | null>(null);
  const [statusTargetDoc, setStatusTargetDoc] = useState<SarabanDoc | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const [projectSyncMap, setProjectSyncMap] = useState<Record<string, SarabanProjectSyncRecord>>(
    () => loadProjectSyncMap()
  );
  const [isSyncingToProject, setIsSyncingToProject] = useState(false);
  const [isDeletingProjectQueue, setIsDeletingProjectQueue] = useState(false);
  const [isRefreshingQueueStatuses, setIsRefreshingQueueStatuses] = useState(false);

  const [procurementSyncMap, setProcurementSyncMap] = useState<
    Record<string, SarabanProcurementSyncRecord>
  >(() => loadProcurementSyncMap());
  const [isSyncingToProcurement, setIsSyncingToProcurement] = useState(false);
  const [isDeletingProcurementQueue, setIsDeletingProcurementQueue] = useState(false);
  const [isRefreshingProcurementStatuses, setIsRefreshingProcurementStatuses] = useState(false);

  const [coverSheetDoc, setCoverSheetDoc] = useState<SarabanDoc | null>(null);
  const [registerReport, setRegisterReport] = useState<{
    title: string;
    rows: SarabanDoc[];
    filterLabel: string;
  } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const queueSyncAbortRef = useRef<AbortController | null>(null);
  const procurementSyncAbortRef = useRef<AbortController | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWriteCountRef = useRef<number>(0);
  const documentsRef = useRef<SarabanDoc[]>(documents);
  const projectSyncMapRef = useRef<Record<string, SarabanProjectSyncRecord>>(projectSyncMap);
  const procurementSyncMapRef = useRef<Record<string, SarabanProcurementSyncRecord>>(
    procurementSyncMap
  );

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    projectSyncMapRef.current = projectSyncMap;
  }, [projectSyncMap]);

  useEffect(() => {
    procurementSyncMapRef.current = procurementSyncMap;
  }, [procurementSyncMap]);

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

  const lastQueueSyncAtRef = useRef<number>(0);
  const lastProcurementSyncAtRef = useRef<number>(0);

  const syncProjectQueueStatuses = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      if (queueSyncAbortRef.current) {
        if (silent) return;
        try {
          queueSyncAbortRef.current.abort();
        } catch {}
      }
      const controller = new AbortController();
      queueSyncAbortRef.current = controller;
      setIsRefreshingQueueStatuses(true);
      const fetchStartedAt = Date.now();

      try {
        const remote = await fetchSarabanQueueStatuses(controller.signal);
        if (controller.signal.aborted) return;

        const existingDocIds = new Set(documentsRef.current.map((d) => String(d.id)));
        const hasMissingNames = remote.items.some((item) => {
          const existing = Object.values(projectSyncMapRef.current).find(
            (r) => r.queueId === item.queueId || r.projectId === item.projectId
          );
          return !existing || !existing.projectName || existing.projectName.startsWith('โครงการ ');
        });

        let projectNameById: Map<string, string> | undefined;
        if (hasMissingNames && remote.items.length > 0) {
          try {
            const projOptions = await fetchProjectOptions('all', controller.signal);
            projectNameById = new Map(projOptions.map((p) => [p.id, p.name]));
          } catch {}
        }

        const reconciled = reconcileProjectSyncMap(projectSyncMapRef.current, remote, {
          existingDocIds,
          projectNameById,
          fetchStartedAt,
        });
        projectSyncMapRef.current = reconciled.nextMap;
        setProjectSyncMap(reconciled.nextMap);
        lastQueueSyncAtRef.current = Date.now();

        if (reconciled.statusChanges.length === 1) {
          const change = reconciled.statusChanges[0];
          const meta = getQueueStatusMeta(change.toStatus);
          pushToast(
            meta.status === 'approved' ? 'success' : meta.status === 'rejected' ? 'error' : 'info',
            `อัปเดตสถานะคิว ${change.queueId}: ${meta.shortLabel}`,
            meta.status === 'rejected' && change.rejectReason
              ? `เหตุผล: ${change.rejectReason}`
              : `[${change.projectCode}]`
          );
        } else if (reconciled.statusChanges.length > 1) {
          pushToast(
            'success',
            'อัปเดตสถานะคิวโครงการแล้ว',
            `มีการเปลี่ยนแปลงสถานะ ${reconciled.statusChanges.length} รายการ (รอตรวจรับ ${remote.pendingCount} รายการ)`
          );
        } else if (reconciled.removedCount > 0) {
          pushToast(
            'info',
            'ซิงค์สถานะคิวโครงการแล้ว',
            `ล้างคิวที่ถูกลบจากฝั่งโครงการออก ${reconciled.removedCount} รายการ`
          );
        } else if (!silent) {
          pushToast(
            'info',
            'ตรวจสอบสถานะคิวโครงการแล้ว',
            remote.pendingCount > 0
              ? `มีรายการรอตรวจรับในระบบโครงการ ${remote.pendingCount} รายการ`
              : reconciled.hydratedCount > 0
              ? `ซิงค์ข้อมูลคิวกลับจากระบบโครงการ ${reconciled.hydratedCount} รายการ`
              : 'สถานะคิวทั้งหมดเป็นปัจจุบันแล้ว'
          );
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (!silent) {
          pushToast(
            'error',
            'ดึงสถานะคิวโครงการไม่สำเร็จ',
            err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อระบบงานโครงการได้'
          );
        }
      } finally {
        if (queueSyncAbortRef.current === controller) {
          queueSyncAbortRef.current = null;
        }
        setIsRefreshingQueueStatuses(false);
      }
    },
    [pushToast]
  );

  const syncProcurementQueueStatuses = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      if (procurementSyncAbortRef.current) {
        if (silent) return;
        try {
          procurementSyncAbortRef.current.abort();
        } catch {}
      }
      const controller = new AbortController();
      procurementSyncAbortRef.current = controller;
      setIsRefreshingProcurementStatuses(true);
      const fetchStartedAt = Date.now();

      try {
        const remote = await fetchProcurementQueueStatuses(controller.signal);
        if (controller.signal.aborted) return;

        const existingDocIds = new Set(documentsRef.current.map((d) => String(d.id)));
        const hasMissingNames = remote.items.some((item) => {
          const existing = Object.values(procurementSyncMapRef.current).find(
            (r) => r.queueId === item.queueId || r.procurementId === item.procurementId
          );
          return (
            !existing ||
            !existing.procurementName ||
            existing.procurementName.startsWith('รายการจัดซื้อฯ ')
          );
        });

        let procurementNameById: Map<string, string> | undefined;
        if (hasMissingNames && remote.items.length > 0) {
          try {
            const procOptions = await fetchProcurementOptions('all', controller.signal);
            procurementNameById = new Map(procOptions.map((p) => [p.id, p.name]));
          } catch {}
        }

        const reconciled = reconcileProcurementSyncMap(procurementSyncMapRef.current, remote, {
          existingDocIds,
          procurementNameById,
          fetchStartedAt,
        });
        procurementSyncMapRef.current = reconciled.nextMap;
        setProcurementSyncMap(reconciled.nextMap);
        lastProcurementSyncAtRef.current = Date.now();

        if (reconciled.statusChanges.length === 1) {
          const change = reconciled.statusChanges[0];
          const meta = getProcurementQueueStatusMeta(change.toStatus);
          pushToast(
            meta.status === 'approved' ? 'success' : meta.status === 'rejected' ? 'error' : 'info',
            `อัปเดตสถานะจัดซื้อฯ ${change.queueId}: ${meta.shortLabel}`,
            meta.status === 'rejected' && change.rejectReason
              ? `เหตุผล: ${change.rejectReason}`
              : `[${change.projectCode}]`
          );
        } else if (reconciled.statusChanges.length > 1) {
          pushToast(
            'success',
            'อัปเดตสถานะคิวจัดซื้อจัดจ้างแล้ว',
            `มีการเปลี่ยนแปลงสถานะ ${reconciled.statusChanges.length} รายการ (รอตรวจรับ ${remote.pendingCount} รายการ)`
          );
        } else if (reconciled.removedCount > 0) {
          pushToast(
            'info',
            'ซิงค์สถานะคิวจัดซื้อจัดจ้างแล้ว',
            `ล้างคิวที่ถูกลบจากฝั่งจัดซื้อฯ ออก ${reconciled.removedCount} รายการ`
          );
        } else if (!silent) {
          pushToast(
            'info',
            'ตรวจสอบสถานะคิวจัดซื้อจัดจ้างแล้ว',
            remote.pendingCount > 0
              ? `มีรายการรอตรวจรับในระบบจัดซื้อจัดจ้าง ${remote.pendingCount} รายการ`
              : reconciled.hydratedCount > 0
              ? `ซิงค์ข้อมูลคิวกลับจากระบบจัดซื้อฯ ${reconciled.hydratedCount} รายการ`
              : 'สถานะคิวจัดซื้อจัดจ้างทั้งหมดเป็นปัจจุบันแล้ว'
          );
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (!silent) {
          pushToast(
            'error',
            'ดึงสถานะคิวจัดซื้อจัดจ้างไม่สำเร็จ',
            err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อระบบงานจัดซื้อจัดจ้างได้'
          );
        }
      } finally {
        if (procurementSyncAbortRef.current === controller) {
          procurementSyncAbortRef.current = null;
        }
        setIsRefreshingProcurementStatuses(false);
      }
    },
    [pushToast]
  );

  const hasSyncedQueuesWithDocsRef = useRef(false);

  useEffect(() => {
    const cached = loadDocsCache();
    if (cached.length > 0) {
      setDocuments(cached);
      setIsLoadingDocs(false);
    }
    syncFromDrive({ silent: cached.length > 0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (documents.length > 0 && !hasSyncedQueuesWithDocsRef.current) {
      hasSyncedQueuesWithDocsRef.current = true;
      syncProjectQueueStatuses({ silent: true });
      syncProcurementQueueStatuses({ silent: true });
    }
  }, [documents.length, syncProjectQueueStatuses, syncProcurementQueueStatuses]);

  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'hidden') return;
      if (documentsRef.current.length === 0) return;
      if (Date.now() - lastQueueSyncAtRef.current >= 10000) {
        syncProjectQueueStatuses({ silent: true });
      }
      if (Date.now() - lastProcurementSyncAtRef.current >= 10000) {
        syncProcurementQueueStatuses({ silent: true });
      }
    };
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [syncProjectQueueStatuses, syncProcurementQueueStatuses]);

  const pendingProjectQueueCount = useMemo(
    () =>
      Object.values(projectSyncMap).filter(
        (rec) => String(rec?.queueStatus || 'pending').trim().toLowerCase() === 'pending'
      ).length,
    [projectSyncMap]
  );

  const pendingProcurementQueueCount = useMemo(
    () =>
      Object.values(procurementSyncMap).filter(
        (rec) => String(rec?.queueStatus || 'pending').trim().toLowerCase() === 'pending'
      ).length,
    [procurementSyncMap]
  );

  useEffect(() => {
    if (pendingProjectQueueCount === 0 && pendingProcurementQueueCount === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (documentsRef.current.length === 0) return;
      if (pendingProjectQueueCount > 0) {
        syncProjectQueueStatuses({ silent: true });
      }
      if (pendingProcurementQueueCount > 0) {
        syncProcurementQueueStatuses({ silent: true });
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [
    pendingProjectQueueCount,
    pendingProcurementQueueCount,
    syncProjectQueueStatuses,
    syncProcurementQueueStatuses,
  ]);

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
    const wasAuthenticated = isAuthenticated;
    setCurrentUser(ADMIN_USER);
    setIsAuthenticated(true);
    setShowRoleModal(false);
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ role: 'admin' }));
    } catch {}
    if (!wasAuthenticated) {
      setActiveTab('dashboard');
      try {
        sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'dashboard');
      } catch {}
    }
    syncFromDrive({ silent: documents.length > 0 });
    pushToast('success', 'เข้าสู่ระบบสำเร็จ', 'สิทธิ์ผู้ดูแลระบบ (นส. นิศาชล คงดี)');
  };

  const handleLoginStaff = () => {
    const wasAuthenticated = isAuthenticated;
    setCurrentUser(STAFF_USER);
    setIsAuthenticated(true);
    setShowRoleModal(false);
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ role: 'staff' }));
    } catch {}
    if (!wasAuthenticated || activeTab === 'myInbox') {
      setActiveTab('dashboard');
      try {
        sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'dashboard');
      } catch {}
    }
    syncFromDrive({ silent: documents.length > 0 });
    pushToast('info', 'เข้าสู่ระบบสำเร็จ', 'สิทธิ์บุคลากร / เจ้าหน้าที่');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowRoleModal(false);
    setActiveTab('dashboard');
    try {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    } catch {}
  };

  const handleSelectTab = (tab: TabId) => {
    const nextTab: TabId = tab === 'myInbox' && !isAdmin ? 'dashboard' : tab;
    setActiveTab(nextTab);
    try {
      sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextTab);
    } catch {}
  };

  const handleNavigateWithFilter = (preset: Omit<RegisterFilterPreset, 'nonce'>) => {
    const targetTab: RegisterTabId =
      preset.tabId === 'myInbox' && !isAdmin ? 'allDocs' : preset.tabId;
    setRegisterFilterPreset({
      ...preset,
      tabId: targetTab,
      nonce: Date.now(),
    });
    handleSelectTab(targetTab);
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

  const syncSarabanDocToProject = useCallback(
    async (params: {
      docId: string | number;
      selection: ProjectSyncSelection;
      bookNo: string;
      bookDate: string;
      subject: string;
      attachment: SarabanAttachmentMeta | null;
    }) => {
      if (!params.selection.project) {
        throw new Error('กรุณาเลือกโครงการที่ต้องการเชื่อมโยง');
      }
      if (queueSyncAbortRef.current) {
        try {
          queueSyncAbortRef.current.abort();
        } catch {}
        queueSyncAbortRef.current = null;
      }
      const prevRecord = projectSyncMapRef.current[String(params.docId)];
      if (prevRecord && String(prevRecord.queueStatus || '').toLowerCase() === 'rejected') {
        markQueueAsDeleted(prevRecord);
        incrementProjectSyncRevision(params.docId);
      }

      const res = await pushSarabanQueue({
        docId: params.docId,
        project: params.selection.project,
        docCategory: params.selection.docCategory,
        fields: params.selection.fields,
        bookNo: params.bookNo,
        bookDate: params.bookDate,
        subject: params.subject,
        attachment: params.attachment,
        submittedBy: currentUser.name,
        idempotencyRevision: getProjectSyncRevision(params.docId),
      });

      const queueId = res.queueId || `SQ-${Date.now()}`;
      const record: SarabanProjectSyncRecord = {
        docId: String(params.docId),
        queueId,
        idempotencyKey: res.idempotencyKey,
        queueStatus: (res.queueStatus || 'pending').toLowerCase(),
        projectId: params.selection.project.id,
        projectCode: params.selection.project.projectCode,
        projectName: params.selection.project.name,
        fiscalYear: params.selection.project.fiscalYear,
        docCategory: params.selection.docCategory,
        bookNo: params.bookNo,
        syncedAt: new Date().toISOString(),
        duplicated: res.duplicated,
        lastCheckedAt: new Date().toISOString(),
      };
      const updatedMap = saveProjectSyncRecord(record);
      projectSyncMapRef.current = updatedMap;
      setProjectSyncMap(updatedMap);
      pushToast(
        'success',
        res.duplicated ? 'เชื่อมโยงคิวโครงการแล้ว (ข้อมูลเดิม)' : `ส่งเข้าคิวโครงการแล้ว: ${queueId}`,
        `[${params.selection.project.projectCode}] ${params.selection.project.name}`
      );
      return record;
    },
    [currentUser.name, pushToast]
  );

  const syncSarabanDocToProcurement = useCallback(
    async (params: {
      docId: string | number;
      selection: ProcurementSyncSelection;
      bookNo: string;
      bookDate: string;
      subject: string;
      attachment: SarabanAttachmentMeta | null;
    }) => {
      if (!params.selection.procurement) {
        throw new Error('กรุณาเลือกรายการจัดซื้อจัดจ้างที่ต้องการเชื่อมโยง');
      }
      if (procurementSyncAbortRef.current) {
        try {
          procurementSyncAbortRef.current.abort();
        } catch {}
        procurementSyncAbortRef.current = null;
      }
      const prevRecord = procurementSyncMapRef.current[String(params.docId)];
      if (
        prevRecord &&
        (String(prevRecord.queueStatus || '').toLowerCase() === 'rejected' ||
          prevRecord.docCategory !== params.selection.docCategory)
      ) {
        markProcurementQueueAsDeleted(prevRecord);
        incrementProcurementSyncRevision(params.docId);
      }

      const res = await pushProcurementQueue({
        docId: params.docId,
        procurement: params.selection.procurement,
        docCategory: params.selection.docCategory,
        fields: params.selection.fields,
        bookNo: params.bookNo,
        bookDate: params.bookDate,
        subject: params.subject,
        attachment: params.attachment,
        submittedBy: currentUser.name,
        idempotencyRevision: getProcurementSyncRevision(params.docId),
      });

      const queueId = res.queueId || `PQ-${Date.now()}`;
      const record: SarabanProcurementSyncRecord = {
        docId: String(params.docId),
        queueId,
        idempotencyKey: res.idempotencyKey,
        queueStatus: (res.queueStatus || 'pending').toLowerCase(),
        procurementId: params.selection.procurement.id,
        projectCode: params.selection.procurement.projectCode,
        procurementName: params.selection.procurement.name,
        fiscalYear: params.selection.procurement.fiscalYear,
        docCategory: params.selection.docCategory,
        bookNo: params.bookNo,
        syncedAt: new Date().toISOString(),
        duplicated: res.duplicated,
        lastCheckedAt: new Date().toISOString(),
      };
      const updatedMap = saveProcurementSyncRecord(record);
      procurementSyncMapRef.current = updatedMap;
      setProcurementSyncMap(updatedMap);
      pushToast(
        'success',
        res.duplicated
          ? 'เชื่อมโยงคิวจัดซื้อจัดจ้างแล้ว (ข้อมูลเดิม)'
          : `ส่งเข้าคิวจัดซื้อจัดจ้างแล้ว: ${queueId}`,
        formatProcurementDisplayTitle({
          name: params.selection.procurement.name,
          projectCode: params.selection.procurement.projectCode,
          procurementId: params.selection.procurement.id,
          statusLabel: params.selection.procurement.statusLabel,
          fiscalYear: params.selection.procurement.fiscalYear,
        })
      );
      return record;
    },
    [currentUser.name, pushToast]
  );

  const resolveAttachmentsForSave = async (params: {
    keptExistingAttachments: DocAttachment[];
    selectedFiles: File[];
    manualAttachments: DocAttachment[];
    phaseSuffix?: string;
  }): Promise<{
    finalAttachments: DocAttachment[];
    fileName: string;
    fileData: string;
    primaryAttachmentMeta: SarabanAttachmentMeta | null;
  }> => {
    const uploadedAttachments: DocAttachment[] = [];
    let primaryUploadedMeta: SarabanAttachmentMeta | null = null;

    for (let i = 0; i < params.selectedFiles.length; i += 1) {
      const file = params.selectedFiles[i];
      const total = params.selectedFiles.length;
      const uploaded = await uploadFileToDrive(file, {
        onPhase: (label) => {
          setUploadPhaseLabel(
            total > 1 ? `ไฟล์ที่ ${i + 1}/${total}: ${label}` : label
          );
        },
        phaseSuffix: params.phaseSuffix,
      });
      uploadedAttachments.push({
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
      });
      if (!primaryUploadedMeta) {
        primaryUploadedMeta = {
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        };
      }
    }

    const normalizedManualAttachments: DocAttachment[] = [];
    for (const item of params.manualAttachments) {
      const checked = validateAttachmentUrl(item.fileUrl);
      if (!checked.valid) {
        throw new Error(
          checked.error || 'กรุณาตรวจสอบรูปแบบ URL (ต้องขึ้นต้นด้วย https:// หรือ http://)'
        );
      }
      if (checked.normalizedUrl) {
        normalizedManualAttachments.push({
          fileName: resolveManualAttachmentName(item.fileName || '', checked.normalizedUrl),
          fileUrl: checked.normalizedUrl,
        });
      }
    }

    const finalAttachments = mergeDocAttachments(params.keptExistingAttachments, [
      ...uploadedAttachments,
      ...normalizedManualAttachments,
    ]);
    const serialized = serializeDocAttachments(finalAttachments);
    const fallbackPrimary = finalAttachments[0]
      ? {
          fileName: finalAttachments[0].fileName || 'เอกสารแนบ',
          fileUrl: finalAttachments[0].fileUrl,
          mimeType: inferMimeTypeFromFileName(finalAttachments[0].fileName),
        }
      : null;

    return {
      finalAttachments,
      fileName: serialized.fileName,
      fileData: serialized.fileData,
      primaryAttachmentMeta: primaryUploadedMeta || fallbackPrimary,
    };
  };

  const filterUnreferencedFileUrls = (
    urls: string[],
    excludeDocId: string | number
  ): string[] => {
    const cleanCandidates = Array.from(
      new Set(urls.map((u) => String(u || '').trim()).filter(Boolean))
    );
    if (cleanCandidates.length === 0) return [];
    const usedElsewhere = new Set<string>();
    documents.forEach((d) => {
      if (String(d.id) === String(excludeDocId)) return;
      getDocAttachments(d).forEach((att) => {
        if (att.fileUrl) usedElsewhere.add(att.fileUrl);
      });
    });
    return cleanCandidates.filter((u) => !usedElsewhere.has(u));
  };

  const handleSaveDocument = async (payload: DocumentFormPayload) => {
    if (!isAdmin) return;

    let resolvedAttachments: {
      finalAttachments: DocAttachment[];
      fileName: string;
      fileData: string;
      primaryAttachmentMeta: SarabanAttachmentMeta | null;
    };

    if (payload.selectedFiles.length > 0) {
      setIsSubmittingDoc(true);
      setUploadPhaseLabel(
        payload.selectedFiles.length > 1
          ? `กำลังเตรียมอัปโหลด ${payload.selectedFiles.length} ไฟล์ขึ้น Drive...`
          : 'กำลังเตรียมไฟล์อัปโหลดขึ้น Drive...'
      );
    }

    try {
      resolvedAttachments = await resolveAttachmentsForSave({
        keptExistingAttachments: payload.editId !== null ? payload.keptExistingAttachments : [],
        selectedFiles: payload.selectedFiles,
        manualAttachments: payload.manualAttachments,
      });
    } catch (err) {
      pushToast(
        'error',
        payload.selectedFiles.length > 0 ? 'อัปโหลดไฟล์ไม่สำเร็จ' : 'ลิงก์ไฟล์แนบไม่ถูกต้อง',
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการจัดการไฟล์แนบ'
      );
      return;
    } finally {
      setIsSubmittingDoc(false);
      setUploadPhaseLabel('');
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
        file_name: resolvedAttachments.fileName,
        file_url: resolvedAttachments.fileData,
      };

      if (statusChanged) {
        updates.ack_status = 'รับทราบแล้ว';
        updates.ack_time = statusUpdateTime;
      }

      const nextDocs = documents.map((d) => {
        if (String(d.id) !== String(payload.editId)) return d;
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
          file_name: resolvedAttachments.fileName,
          file_url: resolvedAttachments.fileData,
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

      const originalUrls = existingDoc
        ? getDocAttachments(existingDoc).map((a) => a.fileUrl)
        : [];
      const keptAfterSaveSet = new Set(resolvedAttachments.finalAttachments.map((a) => a.fileUrl));
      const removedUrls = filterUnreferencedFileUrls(
        originalUrls.filter((u) => !keptAfterSaveSet.has(u)),
        payload.editId
      );
      const shouldTrashDriveFiles = Boolean(payload.trashRemovedDriveFiles && removedUrls.length > 0);

      enqueueBackgroundWrite(
        async () => {
          const res = await callDriveApi({
            action: 'update',
            id: payload.editId,
            type: existingDoc?.type || payload.type,
            updates,
            trashDriveFiles: shouldTrashDriveFiles,
            removedFileUrls: shouldTrashDriveFiles ? removedUrls : [],
          });
          if (shouldTrashDriveFiles) {
            if (res.driveTrash) {
              if (res.driveTrash.trashedCount > 0) {
                pushToast(
                  'info',
                  `ย้ายไฟล์ใน Drive ลงถังขยะแล้ว (${res.driveTrash.trashedCount} ไฟล์)`,
                  'กู้คืนได้จากถังขยะ Google Drive ภายใน 30 วัน'
                );
              }
            } else {
              pushToast(
                'info',
                'นำไฟล์ออกจากรายการแล้ว (ยังไม่ย้ายไฟล์ใน Drive)',
                'กรุณา Deploy โค้ด Apps Script เวอร์ชันใหม่เพื่อเปิดใช้การย้ายไฟล์ลงถังขยะอัตโนมัติ'
              );
            }
          }
        },
        () => {
          setDocuments(previousDocs);
          saveDocsCache(previousDocs);
        },
        'บันทึกการแก้ไขลง Google Drive ไม่สำเร็จ'
      );

      if (
        (payload.projectSync?.enabled && payload.projectSync.project) ||
        (payload.procurementSync?.enabled && payload.procurementSync.procurement)
      ) {
        const attachmentMeta = resolvedAttachments.primaryAttachmentMeta;
        const resolvedBookNo =
          payload.type === 'vouchers' ? payload.voucherNo || '-' : payload.docNumber || '-';
        const resolvedBookDate =
          payload.type === 'vouchers'
            ? payload.voucherDate || getTodayISO()
            : payload.docDate || getTodayISO();
        const resolvedSubject =
          payload.type === 'vouchers' ? payload.voucherProject || '-' : payload.subject || '-';

        if (payload.projectSync?.enabled && payload.projectSync.project) {
          try {
            await syncSarabanDocToProject({
              docId: payload.editId,
              selection: payload.projectSync,
              bookNo: resolvedBookNo,
              bookDate: resolvedBookDate,
              subject: resolvedSubject,
              attachment: attachmentMeta,
            });
          } catch (syncErr) {
            pushToast(
              'error',
              'ส่งข้อมูลเข้าระบบงานโครงการไม่สำเร็จ',
              syncErr instanceof Error ? syncErr.message : 'กรุณาลองส่งใหม่อีกครั้งจากหน้ารายละเอียด'
            );
          }
        }

        if (payload.procurementSync?.enabled && payload.procurementSync.procurement) {
          try {
            await syncSarabanDocToProcurement({
              docId: payload.editId,
              selection: payload.procurementSync,
              bookNo:
                payload.type === 'vouchers' ? payload.voucherNo || '' : payload.docNumber || '',
              bookDate:
                payload.type === 'vouchers' ? payload.voucherDate || '' : payload.docDate || '',
              subject:
                payload.type === 'vouchers' ? payload.voucherProject || '' : payload.subject || '',
              attachment: attachmentMeta,
            });
          } catch (syncErr) {
            pushToast(
              'error',
              'ส่งข้อมูลเข้าระบบงานจัดซื้อจัดจ้างไม่สำเร็จ',
              syncErr instanceof Error ? syncErr.message : 'กรุณาลองส่งใหม่อีกครั้งจากหน้ารายละเอียด'
            );
          }
        }
      }
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
        file_name: resolvedAttachments.fileName,
        file_url: resolvedAttachments.fileData,
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

      if (
        (payload.projectSync?.enabled && payload.projectSync.project) ||
        (payload.procurementSync?.enabled && payload.procurementSync.procurement)
      ) {
        const attachmentMeta = resolvedAttachments.primaryAttachmentMeta;
        const resolvedBookNo =
          payload.type === 'vouchers' ? payload.voucherNo || '-' : enforcedDocNumber || '-';
        const resolvedBookDate =
          payload.type === 'vouchers'
            ? payload.voucherDate || getTodayISO()
            : payload.docDate || getTodayISO();
        const resolvedSubject =
          payload.type === 'vouchers' ? payload.voucherProject || '-' : payload.subject || '-';

        if (payload.projectSync?.enabled && payload.projectSync.project) {
          try {
            await syncSarabanDocToProject({
              docId: newId,
              selection: payload.projectSync,
              bookNo: resolvedBookNo,
              bookDate: resolvedBookDate,
              subject: resolvedSubject,
              attachment: attachmentMeta,
            });
          } catch (syncErr) {
            pushToast(
              'error',
              'ส่งข้อมูลเข้าระบบงานโครงการไม่สำเร็จ',
              syncErr instanceof Error ? syncErr.message : 'กรุณาลองส่งใหม่อีกครั้งจากหน้ารายละเอียด'
            );
          }
        }

        if (payload.procurementSync?.enabled && payload.procurementSync.procurement) {
          try {
            await syncSarabanDocToProcurement({
              docId: newId,
              selection: payload.procurementSync,
              bookNo:
                payload.type === 'vouchers' ? payload.voucherNo || '' : enforcedDocNumber || '',
              bookDate:
                payload.type === 'vouchers' ? payload.voucherDate || '' : payload.docDate || '',
              subject:
                payload.type === 'vouchers' ? payload.voucherProject || '' : payload.subject || '',
              attachment: attachmentMeta,
            });
          } catch (syncErr) {
            pushToast(
              'error',
              'ส่งข้อมูลเข้าระบบงานจัดซื้อจัดจ้างไม่สำเร็จ',
              syncErr instanceof Error ? syncErr.message : 'กรุณาลองส่งใหม่อีกครั้งจากหน้ารายละเอียด'
            );
          }
        }
      }
    }
  };

  const handleConfirmDelete = async (
    mode: 'attachment' | 'record',
    options: { trashDriveFiles: boolean }
  ) => {
    if (!deleteTargetDoc || !isAdmin) return;
    const targetDoc = deleteTargetDoc;
    const previousDocs = documents;
    const removedUrls = filterUnreferencedFileUrls(
      getDocAttachments(targetDoc).map((a) => a.fileUrl),
      targetDoc.id
    );
    const shouldTrashDriveFiles = Boolean(options.trashDriveFiles && removedUrls.length > 0);

    const notifyDriveTrashOutcome = (
      driveTrash: { trashedCount: number; skippedCount: number } | null | undefined,
      actionVerb: string
    ) => {
      if (!shouldTrashDriveFiles) return;
      if (driveTrash) {
        if (driveTrash.trashedCount > 0) {
          pushToast(
            'info',
            `ย้ายไฟล์ใน Drive ลงถังขยะแล้ว (${driveTrash.trashedCount} ไฟล์)`,
            'สามารถกู้คืนได้จากถังขยะ Google Drive ภายใน 30 วัน'
          );
        }
      } else {
        pushToast(
          'info',
          `${actionVerb}ใน Sheet แล้ว (ยังไม่ย้ายไฟล์ใน Drive)`,
          'กรุณา Deploy โค้ด Apps Script เวอร์ชันใหม่เพื่อเปิดใช้การย้ายไฟล์ลงถังขยะอัตโนมัติ'
        );
      }
    };

    if (mode === 'attachment') {
      const nextDocs = documents.map((d) =>
        String(d.id) === String(targetDoc.id)
          ? { ...d, fileName: '', fileData: '', attachments: [] }
          : d
      );
      setDocuments(nextDocs);
      saveDocsCache(nextDocs);
      setDeleteTargetDoc(null);
      setIsActionBusy(false);
      pushToast('success', 'นำไฟล์แนบออกแล้ว', 'เก็บข้อมูลรายการหนังสือไว้ตามเดิม');

      enqueueBackgroundWrite(
        async () => {
          const res = await callDriveApi({
            action: 'update',
            id: targetDoc.id,
            type: targetDoc.type,
            updates: { file_name: '', file_url: '' },
            trashDriveFiles: shouldTrashDriveFiles,
            removedFileUrls: shouldTrashDriveFiles ? removedUrls : [],
          });
          notifyDriveTrashOutcome(res.driveTrash, 'นำไฟล์แนบออก');
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
          const res = await callDriveApi({
            action: 'delete',
            id: targetDoc.id,
            type: targetDoc.type,
            trashDriveFiles: shouldTrashDriveFiles,
            fileUrls: shouldTrashDriveFiles ? removedUrls : [],
          });
          notifyDriveTrashOutcome(res.driveTrash, 'ลบรายการ');
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

    let resolvedAttachments: {
      finalAttachments: DocAttachment[];
      fileName: string;
      fileData: string;
      primaryAttachmentMeta: SarabanAttachmentMeta | null;
    };

    if (payload.selectedFiles.length > 0) {
      setIsSubmittingDoc(true);
      setUploadPhaseLabel(
        payload.selectedFiles.length > 1
          ? `กำลังเตรียมอัปโหลด ${payload.selectedFiles.length} ไฟล์ขึ้น Drive...`
          : 'กำลังเตรียมไฟล์อัปโหลดขึ้น Drive...'
      );
    }

    try {
      resolvedAttachments = await resolveAttachmentsForSave({
        keptExistingAttachments: payload.keptExistingAttachments,
        selectedFiles: payload.selectedFiles,
        manualAttachments: payload.manualAttachments,
      });
    } catch (err) {
      pushToast(
        'error',
        payload.selectedFiles.length > 0 ? 'อัปโหลดไฟล์ไม่สำเร็จ' : 'ลิงก์ไฟล์แนบไม่ถูกต้อง',
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการจัดการไฟล์แนบ'
      );
      return;
    } finally {
      setIsSubmittingDoc(false);
      setUploadPhaseLabel('');
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
      file_name: resolvedAttachments.fileName,
      file_url: resolvedAttachments.fileData,
    };

    if (statusChanged) {
      updates.ack_status = 'รับทราบแล้ว';
      updates.ack_time = statusUpdateTime;
    }

    const nextDocs = documents.map((d) => {
      if (String(d.id) !== String(payload.id)) return d;
      const updated: SarabanDoc = {
        ...d,
        assignee: payload.assignee,
        status: payload.status,
        dueDate: payload.dueDate,
        fileName: resolvedAttachments.fileName,
        fileData: resolvedAttachments.fileData,
        attachments: resolvedAttachments.finalAttachments,
      };
      if (statusChanged) {
        updated.ackStatus = 'รับทราบแล้ว';
        updated.ackTime = statusUpdateTime;
      }
      return updated;
    });

    setDocuments(nextDocs);
    saveDocsCache(nextDocs);
    const updatedDetail = nextDocs.find((d) => String(d.id) === String(payload.id)) || null;
    setDetailDoc(updatedDetail);
    pushToast('success', 'บันทึกข้อมูลเพิ่มเติมสำเร็จ', 'อัปเดตการมอบหมายและไฟล์แนบเรียบร้อยแล้ว');

    const originalUrls = existingDoc
      ? getDocAttachments(existingDoc).map((a) => a.fileUrl)
      : [];
    const keptAfterSaveSet = new Set(resolvedAttachments.finalAttachments.map((a) => a.fileUrl));
    const removedUrls = filterUnreferencedFileUrls(
      originalUrls.filter((u) => !keptAfterSaveSet.has(u)),
      payload.id
    );
    const shouldTrashDriveFiles = Boolean(payload.trashRemovedDriveFiles && removedUrls.length > 0);

    enqueueBackgroundWrite(
      async () => {
        const res = await callDriveApi({
          action: 'update',
          id: payload.id,
          type: existingDoc?.type,
          updates,
          trashDriveFiles: shouldTrashDriveFiles,
          removedFileUrls: shouldTrashDriveFiles ? removedUrls : [],
        });
        if (shouldTrashDriveFiles) {
          if (res.driveTrash) {
            if (res.driveTrash.trashedCount > 0) {
              pushToast(
                'info',
                `ย้ายไฟล์ใน Drive ลงถังขยะแล้ว (${res.driveTrash.trashedCount} ไฟล์)`,
                'กู้คืนได้จากถังขยะ Google Drive ภายใน 30 วัน'
              );
            }
          } else {
            pushToast(
              'info',
              'นำไฟล์ออกจากรายการแล้ว (ยังไม่ย้ายไฟล์ใน Drive)',
              'กรุณา Deploy โค้ด Apps Script เวอร์ชันใหม่เพื่อเปิดใช้การย้ายไฟล์ลงถังขยะอัตโนมัติ'
            );
          }
        }
      },
      () => {
        setDocuments(previousDocs);
        saveDocsCache(previousDocs);
        setDetailDoc(previousDetail);
      },
      'บันทึกข้อมูลเพิ่มเติมลง Google Drive ไม่สำเร็จ'
    );
  };

  const handleSyncDocFromDetail = async (
    doc: SarabanDoc,
    selection: ProjectSyncSelection,
    quickFilePayload: QuickDetailSavePayload
  ) => {
    if (!isAdmin) return;
    setIsSyncingToProject(true);
    try {
      const resolvedAttachments = await resolveAttachmentsForSave({
        keptExistingAttachments: quickFilePayload.keptExistingAttachments,
        selectedFiles: quickFilePayload.selectedFiles,
        manualAttachments: quickFilePayload.manualAttachments,
        phaseSuffix: 'ก่อนส่งเข้าโครงการ',
      });

      const attachmentsChanged =
        resolvedAttachments.fileName !== (doc.fileName || '') ||
        resolvedAttachments.fileData !== (doc.fileData || '');

      if (
        attachmentsChanged ||
        quickFilePayload.selectedFiles.length > 0 ||
        quickFilePayload.manualAttachments.length > 0
      ) {
        const nextDocs = documents.map((d) =>
          String(d.id) === String(doc.id)
            ? {
                ...d,
                assignee: quickFilePayload.assignee,
                status: quickFilePayload.status,
                dueDate: quickFilePayload.dueDate,
                fileName: resolvedAttachments.fileName,
                fileData: resolvedAttachments.fileData,
                attachments: resolvedAttachments.finalAttachments,
              }
            : d
        );
        setDocuments(nextDocs);
        saveDocsCache(nextDocs);
        const updatedDetail = nextDocs.find((d) => String(d.id) === String(doc.id)) || null;
        setDetailDoc(updatedDetail);

        enqueueBackgroundWrite(
          async () => {
            await callDriveApi({
              action: 'update',
              id: doc.id,
              type: doc.type,
              updates: {
                assignee: quickFilePayload.assignee,
                status: quickFilePayload.status,
                due_date: quickFilePayload.dueDate,
                file_name: resolvedAttachments.fileName,
                file_url: resolvedAttachments.fileData,
              },
            });
          },
          () => {},
          'อัปเดตไฟล์แนบลง Google Drive ไม่สำเร็จ'
        );
      }

      setUploadPhaseLabel('กำลังส่งข้อมูลเข้าระบบงานโครงการ...');
      await syncSarabanDocToProject({
        docId: doc.id,
        selection,
        bookNo:
          doc.type === 'vouchers'
            ? doc.voucherNo || '-'
            : doc.docNumber || '-',
        bookDate:
          doc.type === 'vouchers'
            ? doc.voucherDate || getTodayISO()
            : doc.docDate || getTodayISO(),
        subject:
          doc.type === 'vouchers'
            ? doc.voucherProject || '-'
            : doc.subject || '-',
        attachment: resolvedAttachments.primaryAttachmentMeta,
      });
    } finally {
      setIsSyncingToProject(false);
      setUploadPhaseLabel('');
    }
  };

  const handleDeleteProjectQueue = async (record: SarabanProjectSyncRecord) => {
    if (!isAdmin) return;
    setIsDeletingProjectQueue(true);
    markQueueAsDeleted(record);
    try {
      const result = await deleteSarabanQueue(record);
      const nextMap = removeProjectSyncRecord(record.docId);
      projectSyncMapRef.current = nextMap;
      setProjectSyncMap(nextMap);
      incrementProjectSyncRevision(record.docId);

      if (result.remoteDeleted) {
        pushToast(
          'success',
          'ลบคิวส่งเข้าโครงการแล้ว',
          `ลบ ${record.queueId} ออกจากทั้งสารบรรณและระบบงานโครงการเรียบร้อย`
        );
      } else {
        pushToast(
          'info',
          'ลบคิวออกจากหน้าสารบรรณแล้ว',
          `ซ่อนคิว ${record.queueId} และปลดล็อกให้ส่งใหม่ได้แล้ว (ฝั่งระบบโครงการยังไม่รองรับคำสั่ง deleteSarabanQueue อัตโนมัติ)`
        );
      }
    } catch (err) {
      const nextMap = removeProjectSyncRecord(record.docId);
      projectSyncMapRef.current = nextMap;
      setProjectSyncMap(nextMap);
      incrementProjectSyncRevision(record.docId);
      pushToast(
        'warning',
        'ลบคิวออกจากหน้าสารบรรณแล้ว',
        err instanceof Error
          ? `ฝั่งระบบโครงการตอบกลับ: ${err.message} (ระบบสารบรรณซ่อนคิวที่ผิดให้แล้ว และสามารถส่งใหม่ได้)`
          : 'ลบคิวที่แสดงในหน้าสารบรรณแล้ว และปลดล็อกให้ส่งใหม่ได้'
      );
    } finally {
      setIsDeletingProjectQueue(false);
    }
  };

  const handleSyncDocToProcurementFromDetail = async (
    doc: SarabanDoc,
    selection: ProcurementSyncSelection,
    quickFilePayload: QuickDetailSavePayload
  ) => {
    if (!isAdmin) return;
    setIsSyncingToProcurement(true);
    try {
      const resolvedAttachments = await resolveAttachmentsForSave({
        keptExistingAttachments: quickFilePayload.keptExistingAttachments,
        selectedFiles: quickFilePayload.selectedFiles,
        manualAttachments: quickFilePayload.manualAttachments,
        phaseSuffix: 'ก่อนส่งเข้าจัดซื้อจัดจ้าง',
      });

      const attachmentsChanged =
        resolvedAttachments.fileName !== (doc.fileName || '') ||
        resolvedAttachments.fileData !== (doc.fileData || '');

      if (
        attachmentsChanged ||
        quickFilePayload.selectedFiles.length > 0 ||
        quickFilePayload.manualAttachments.length > 0
      ) {
        const nextDocs = documents.map((d) =>
          String(d.id) === String(doc.id)
            ? {
                ...d,
                assignee: quickFilePayload.assignee,
                status: quickFilePayload.status,
                dueDate: quickFilePayload.dueDate,
                fileName: resolvedAttachments.fileName,
                fileData: resolvedAttachments.fileData,
                attachments: resolvedAttachments.finalAttachments,
              }
            : d
        );
        setDocuments(nextDocs);
        saveDocsCache(nextDocs);
        const updatedDetail = nextDocs.find((d) => String(d.id) === String(doc.id)) || null;
        setDetailDoc(updatedDetail);

        enqueueBackgroundWrite(
          async () => {
            await callDriveApi({
              action: 'update',
              id: doc.id,
              type: doc.type,
              updates: {
                assignee: quickFilePayload.assignee,
                status: quickFilePayload.status,
                due_date: quickFilePayload.dueDate,
                file_name: resolvedAttachments.fileName,
                file_url: resolvedAttachments.fileData,
              },
            });
          },
          () => {},
          'อัปเดตไฟล์แนบลง Google Drive ไม่สำเร็จ'
        );
      }

      setUploadPhaseLabel('กำลังส่งข้อมูลเข้าระบบงานจัดซื้อจัดจ้าง...');
      await syncSarabanDocToProcurement({
        docId: doc.id,
        selection,
        bookNo: doc.type === 'vouchers' ? doc.voucherNo || '' : doc.docNumber || '',
        bookDate: doc.type === 'vouchers' ? doc.voucherDate || '' : doc.docDate || '',
        subject: doc.type === 'vouchers' ? doc.voucherProject || '' : doc.subject || '',
        attachment: resolvedAttachments.primaryAttachmentMeta,
      });
    } finally {
      setIsSyncingToProcurement(false);
      setUploadPhaseLabel('');
    }
  };

  const handleDeleteProcurementQueue = async (record: SarabanProcurementSyncRecord) => {
    if (!isAdmin) return;
    setIsDeletingProcurementQueue(true);
    markProcurementQueueAsDeleted(record);
    try {
      const result = await deleteProcurementQueue(record);
      const nextMap = removeProcurementSyncRecord(record.docId);
      procurementSyncMapRef.current = nextMap;
      setProcurementSyncMap(nextMap);
      incrementProcurementSyncRevision(record.docId);

      if (result.remoteDeleted) {
        pushToast(
          'success',
          'ลบคิวจัดซื้อจัดจ้างแล้ว',
          `ลบ ${record.queueId} ออกจากทั้งสารบรรณและระบบงานจัดซื้อจัดจ้างเรียบร้อย`
        );
      } else {
        pushToast(
          'info',
          'ลบคิวออกจากหน้าสารบรรณแล้ว',
          `ซ่อนคิว ${record.queueId} และปลดล็อกให้ส่งใหม่ได้แล้ว`
        );
      }
    } catch (err) {
      const nextMap = removeProcurementSyncRecord(record.docId);
      procurementSyncMapRef.current = nextMap;
      setProcurementSyncMap(nextMap);
      incrementProcurementSyncRevision(record.docId);
      pushToast(
        'warning',
        'ลบคิวออกจากหน้าสารบรรณแล้ว',
        err instanceof Error
          ? `ฝั่งจัดซื้อฯ ตอบกลับ: ${err.message} (ระบบสารบรรณซ่อนคิวที่ผิดให้แล้ว และสามารถส่งใหม่ได้)`
          : 'ลบคิวที่แสดงในหน้าสารบรรณแล้ว และปลดล็อกให้ส่งใหม่ได้'
      );
    } finally {
      setIsDeletingProcurementQueue(false);
    }
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

  const handleDownloadExcelTemplate = (type: DocType) => {
    const ok = downloadExcelImportTemplate(type);
    if (!ok) {
      pushToast('warning', 'ไม่รองรับแบบฟอร์มนี้', 'ทะเบียนนี้ไม่รองรับการนำเข้าผ่าน Excel');
    } else {
      pushToast(
        'success',
        'ดาวน์โหลดตัวอย่างแบบฟอร์ม Excel แล้ว',
        'กรุณากรอกข้อมูลในชีต "ข้อมูลนำเข้า" (ลบแถวตัวอย่างก่อนอัปโหลดจริง)'
      );
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
            onLogout={handleLogout}
          />

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <TopBar
              activeTab={activeTab}
              currentUser={currentUser}
              docCount={documents.length}
              isSyncing={isSyncing || pendingWriteCount > 0}
              syncError={syncError}
              onSync={() => {
                syncFromDrive({ force: true });
                syncProjectQueueStatuses({ silent: true });
                syncProcurementQueueStatuses({ silent: true });
              }}
              onOpenNewDoc={handleOpenNewDoc}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onToggleSidebar={handleToggleSidebar}
            />

            <main className="no-print flex-1 min-h-0 flex flex-col overflow-y-auto p-3.5 sm:p-4 lg:p-5 pb-20 lg:pb-5 saraban-scroll">
              {activeTab === 'dashboard' && (
                <DashboardView
                  documents={documents}
                  projectSyncMap={projectSyncMap}
                  procurementSyncMap={procurementSyncMap}
                  isLoading={isLoadingDocs}
                  isSyncing={isSyncing || pendingWriteCount > 0}
                  selectedDocId={selectedDocId}
                  onViewDoc={(doc) => {
                    setSelectedDocId(doc.id);
                    setDetailDoc(doc);
                  }}
                  onRefreshData={() => {
                    syncFromDrive({ force: true });
                    syncProjectQueueStatuses({ silent: true });
                    syncProcurementQueueStatuses({ silent: true });
                  }}
                  onNavigateWithFilter={handleNavigateWithFilter}
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
                  projectSyncMap={projectSyncMap}
                  procurementSyncMap={procurementSyncMap}
                  currentUser={currentUser}
                  isLoading={isLoadingDocs}
                  loadError={syncError}
                  selectedDocId={selectedDocId}
                  externalFilter={registerFilterPreset}
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
                  onDownloadExcelTemplate={handleDownloadExcelTemplate}
                  onPrintRegisterReport={(title, rows, filterLabel) =>
                    setRegisterReport({ title, rows, filterLabel })
                  }
                  onRetrySync={() => syncFromDrive({ force: true })}
                  onRefreshProjectQueues={() => {
                    syncProjectQueueStatuses({ silent: false });
                    syncProcurementQueueStatuses({ silent: false });
                  }}
                  isRefreshingProjectQueues={
                    isRefreshingQueueStatuses || isRefreshingProcurementStatuses
                  }
                  pendingProjectQueueCount={
                    pendingProjectQueueCount + pendingProcurementQueueCount
                  }
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
        projectSyncMap={projectSyncMap}
        procurementSyncMap={procurementSyncMap}
        isSubmitting={isSubmittingDoc}
        uploadPhaseLabel={uploadPhaseLabel}
        isDeletingProjectQueue={isDeletingProjectQueue}
        isRefreshingQueueStatus={isRefreshingQueueStatuses}
        isDeletingProcurementQueue={isDeletingProcurementQueue}
        isRefreshingProcurementQueueStatus={isRefreshingProcurementStatuses}
        onClose={() => {
          setWizardOpen(false);
          setEditingDoc(null);
        }}
        onSubmit={handleSaveDocument}
        onDeleteProjectQueue={handleDeleteProjectQueue}
        onRefreshQueueStatus={syncProjectQueueStatuses}
        onDeleteProcurementQueue={handleDeleteProcurementQueue}
        onRefreshProcurementQueueStatus={syncProcurementQueueStatuses}
      />

      <DocumentDetailModal
        doc={detailDoc}
        isAdmin={isAdmin}
        assigneeSuggestions={assigneeSuggestions}
        isSavingQuickUpdate={isSubmittingDoc}
        uploadPhaseLabel={uploadPhaseLabel}
        existingProjectSync={detailDoc ? projectSyncMap[String(detailDoc.id)] || null : null}
        isSyncingToProject={isSyncingToProject}
        isDeletingProjectQueue={isDeletingProjectQueue}
        isRefreshingQueueStatus={isRefreshingQueueStatuses}
        existingProcurementSync={
          detailDoc ? procurementSyncMap[String(detailDoc.id)] || null : null
        }
        isSyncingToProcurement={isSyncingToProcurement}
        isDeletingProcurementQueue={isDeletingProcurementQueue}
        isRefreshingProcurementQueueStatus={isRefreshingProcurementStatuses}
        onClose={() => setDetailDoc(null)}
        onEdit={handleEditDoc}
        onPrintCoverSheet={(doc) => {
          setDetailDoc(null);
          setCoverSheetDoc(doc);
        }}
        onQuickSave={handleQuickDetailSave}
        onSyncToProject={handleSyncDocFromDetail}
        onDeleteProjectQueue={handleDeleteProjectQueue}
        onRefreshQueueStatus={syncProjectQueueStatuses}
        onSyncToProcurement={handleSyncDocToProcurementFromDetail}
        onDeleteProcurementQueue={handleDeleteProcurementQueue}
        onRefreshProcurementQueueStatus={syncProcurementQueueStatuses}
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
