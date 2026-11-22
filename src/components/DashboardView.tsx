import {
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import sarabanHeaderBanner from '../assets/images/saraban_header_banner_1795353322169.jpg';
import type { SarabanProcurementSyncRecord } from '../services/procurementSyncApi';
import type { SarabanProjectSyncRecord } from '../services/projectSyncApi';
import type { DocType, SarabanDoc } from '../types/saraban';
import { DOC_TYPE_META } from '../types/saraban';
import {
  CURRENT_YEAR_FILTER_KEY,
  formatRegDisplay,
  formatThaiDate,
  getAvailableYears,
  getCurrentBuddhistYear,
  getCurrentFiscalYear,
  getInboxDate,
  getInboxDateSortValue,
  getOrderedStatuses,
  getTodayISO,
  isOverdueDoc,
  matchesCurrentYearByType,
  normalizeDateToISO,
} from '../utils/sarabanUtils';
import type { RegisterFilterPreset, RegisterTabId } from './RegisterTableView';
import {
  DocTypeBadge,
  StatusHighlightBadge,
  UrgencyHighlightBadge,
} from './StatusBadges';

interface DashboardViewProps {
  documents: SarabanDoc[];
  projectSyncMap?: Record<string, SarabanProjectSyncRecord>;
  procurementSyncMap?: Record<string, SarabanProcurementSyncRecord>;
  isLoading: boolean;
  isSyncing?: boolean;
  selectedDocId: string | number | null;
  onViewDoc: (doc: SarabanDoc) => void;
  onRefreshData?: () => void;
  onNavigateWithFilter: (preset: Omit<RegisterFilterPreset, 'nonce'>) => void;
}

interface DocTypeDonutItem {
  key: DocType;
  type: DocType;
  label: string;
  color: string;
  count: number;
  pct: number;
}

interface StatusComparisonItem {
  key: string;
  label: string;
  shortLabel: string;
  statuses: string[];
  color: string;
  count: number;
  pct: number;
  urgent: number;
  overdue: number;
}

interface AccordionSubCard {
  key: string;
  subLabel: string;
  yearTag: string;
  total: number;
  done: number;
  remaining: number;
  urgent: number;
  overdue: number;
  completedPct: number;
  searchTerm?: string;
}

interface AccordionGroup {
  type: DocType;
  label: string;
  total: number;
  done: number;
  remaining: number;
  urgent: number;
  completedPct: number;
  subCards: AccordionSubCard[];
}

const DOC_TYPE_ORDER: DocType[] = [
  'incoming',
  'outgoing',
  'memos',
  'orders',
  'vouchers',
  'forms',
];

const DOC_TYPE_COLORS: Record<DocType, string> = {
  incoming: '#3B82F6',
  outgoing: '#10B981',
  memos: '#6B6293',
  orders: '#F59E0B',
  vouchers: '#F43F5E',
  forms: '#14B8A6',
};

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

interface SplinePoint {
  x: number;
  y: number;
}

function buildMonotoneSplinePath(points: SplinePoint[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    deltas.push(dx !== 0 ? (points[i + 1].y - points[i].y) / dx : 0);
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = deltas[0];
  tangents[n - 1] = deltas[n - 2];

  for (let i = 1; i < n - 1; i += 1) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (deltas[i - 1] + deltas[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    if (deltas[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / deltas[i];
      const b = tangents[i + 1] / deltas[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        tangents[i] = t * a * deltas[i];
        tangents[i + 1] = t * b * deltas[i];
      }
    }
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const cp1x = points[i].x + dx / 3;
    const cp1y = points[i].y + (tangents[i] * dx) / 3;
    const cp2x = points[i + 1].x - dx / 3;
    const cp2y = points[i + 1].y - (tangents[i + 1] * dx) / 3;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`;
  }

  return d;
}

function getNiceYAxisStep(rawMax: number): { yMax: number; ticks: number[] } {
  const safeMax = Math.max(4, rawMax);
  const candidates = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = candidates.find((s) => s * 4 >= safeMax) || Math.ceil(safeMax / 4);
  const yMax = step * 4;
  return {
    yMax,
    ticks: [0, step, step * 2, step * 3, yMax],
  };
}

function isCompletedStatus(status?: string): boolean {
  const s = String(status || '').trim();
  return s === 'เสร็จสิ้น' || s === 'ดำเนินการแล้ว';
}

function isUrgentDoc(doc: SarabanDoc): boolean {
  const u = String(doc.urgency || '').trim();
  return u === 'ด่วน' || u === 'ด่วนมาก' || u === 'ด่วนที่สุด';
}

function getDocTitle(doc: SarabanDoc): string {
  return doc.subject || doc.voucherProject || doc.formName || '-';
}

function getDocCodeDisplay(doc: SarabanDoc): string {
  if (doc.type === 'incoming') {
    const reg = formatRegDisplay(doc);
    const num = doc.docNumber && doc.docNumber !== '-' ? doc.docNumber : '';
    return num ? `รับ ${reg} · ${num}` : `รับ ${reg}`;
  }
  if (doc.type === 'vouchers') {
    return doc.voucherNo || '-';
  }
  if (doc.type === 'forms') {
    return doc.formCode || '-';
  }
  return doc.docNumber || '-';
}

function getDocSubGroupLabel(doc: SarabanDoc): string {
  if (doc.type === 'memos' || doc.type === 'forms') {
    const work = String(doc.memoWork || '').trim();
    return work && work !== '-' ? work : 'ไม่ระบุงาน';
  }
  if (doc.type === 'vouchers') {
    const cat = String(doc.voucherCategory || '').trim();
    return cat && cat !== '-' ? cat : 'ไม่ระบุประเภทฎีกา';
  }
  if (doc.type === 'incoming' || doc.type === 'outgoing') {
    const party = String(doc.sender || '').trim();
    return party && party !== '-' ? party : 'ไม่ระบุหน่วยงาน';
  }
  const assignee = String(doc.assignee || '').trim();
  return assignee && assignee !== '-' ? assignee : 'ไม่ระบุผู้รับผิดชอบ';
}

export function DashboardView({
  documents,
  projectSyncMap = {},
  procurementSyncMap = {},
  isLoading,
  isSyncing = false,
  selectedDocId,
  onViewDoc,
  onRefreshData,
  onNavigateWithFilter,
}: DashboardViewProps) {
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(CURRENT_YEAR_FILTER_KEY);
  const [hoveredDonutKey, setHoveredDonutKey] = useState<string | null>(null);
  const [hoveredTrendMonthIdx, setHoveredTrendMonthIdx] = useState<number | null>(null);
  const [hoveredTrendType, setHoveredTrendType] = useState<DocType | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const currentCalendarYear = getCurrentBuddhistYear();
  const currentFiscalYear = getCurrentFiscalYear();

  const availableYears = useMemo(
    () => getAvailableYears(documents, true, currentCalendarYear),
    [documents, currentCalendarYear]
  );

  const availableStatuses = useMemo(() => getOrderedStatuses(documents), [documents]);

  const hasActiveSubFilters = Boolean(filterType || filterStatus);

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (filterYear === CURRENT_YEAR_FILTER_KEY) {
        if (!matchesCurrentYearByType(d)) return false;
      } else if (filterYear && String(d.yearStr || '').trim() !== String(filterYear)) {
        return false;
      }
      if (filterType && d.type !== filterType) return false;
      if (filterStatus && String(d.status || '').trim() !== filterStatus) return false;
      return true;
    });
  }, [documents, filterYear, filterType, filterStatus]);

  const scopeHeaderLines = useMemo(() => {
    const typeLabel = filterType
      ? DOC_TYPE_META[filterType as DocType]?.label || filterType
      : 'ทุกทะเบียนเอกสาร';
    const yearLabel =
      filterYear === CURRENT_YEAR_FILTER_KEY
        ? `ปีปัจจุบัน (ปฏิทิน ${currentCalendarYear} / ปีงบฯ ${currentFiscalYear})`
        : filterYear
          ? `ปี พ.ศ. / ปีงบฯ ${filterYear}`
          : 'ทุกปีงบประมาณและปีปฏิทิน';
    const detailParts = [yearLabel];
    if (filterStatus) detailParts.push(`สถานะ: ${filterStatus}`);
    return {
      primaryParts: [
        'แสดงสถิติ กราฟสัดส่วนงาน และรายการหนังสือล่าสุดของกองช่าง อบต.ไร่ใต้',
        typeLabel,
      ],
      detailParts,
    };
  }, [filterType, filterYear, filterStatus, currentCalendarYear, currentFiscalYear]);

  const shortYearLabel = useMemo(() => {
    if (filterYear === CURRENT_YEAR_FILTER_KEY) return `ปี ${currentCalendarYear}`;
    if (filterYear) return `ปี ${filterYear}`;
    return 'ทุกปี';
  }, [filterYear, currentCalendarYear]);

  // Card 1: Donut chart breakdown by document type
  const docTypeDonutGroups = useMemo<DocTypeDonutItem[]>(() => {
    const total = filteredDocs.length;
    const typesToShow = filterType ? [filterType as DocType] : DOC_TYPE_ORDER;
    return typesToShow
      .map((type) => {
        const count = filteredDocs.filter((d) => d.type === type).length;
        return {
          key: type,
          type,
          label: DOC_TYPE_META[type]?.label || type,
          color: DOC_TYPE_COLORS[type] || '#6B6293',
          count,
          pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredDocs, filterType]);

  const activeDonutGroup = useMemo(
    () => docTypeDonutGroups.find((g) => g.key === hoveredDonutKey) || null,
    [docTypeDonutGroups, hoveredDonutKey]
  );

  // Card 2: Horizontal bar comparison by work status
  const statusComparisonData = useMemo<{
    items: StatusComparisonItem[];
    maxCount: number;
  }>(() => {
    const total = filteredDocs.length;
    const definitions: {
      key: string;
      label: string;
      shortLabel: string;
      statuses: string[];
      color: string;
    }[] = [
      {
        key: 'done',
        label: 'เสร็จสิ้น / ดำเนินการแล้ว',
        shortLabel: 'เสร็จสิ้นแล้ว',
        statuses: ['เสร็จสิ้น', 'ดำเนินการแล้ว'],
        color: '#16A34A',
      },
      {
        key: 'progress',
        label: 'กำลังดำเนินการ / เสนอเซนต์',
        shortLabel: 'กำลังดำเนินการ',
        statuses: ['กำลังดำเนินการ', 'เสนอเซนต์'],
        color: '#2563EB',
      },
      {
        key: 'issued',
        label: 'ออกเอกสาร',
        shortLabel: 'ออกเอกสาร',
        statuses: ['ออกเอกสาร'],
        color: '#EC4899',
      },
      {
        key: 'received',
        label: 'ลงรับแล้ว',
        shortLabel: 'ลงรับแล้ว',
        statuses: ['ลงรับแล้ว'],
        color: '#0EA5E9',
      },
      {
        key: 'pending',
        label: 'รอรับทราบ / รอดำเนินการ',
        shortLabel: 'รอรับทราบ',
        statuses: ['รอรับทราบ'],
        color: '#F59E0B',
      },
    ];

    const knownSet = new Set(definitions.flatMap((d) => d.statuses));

    const items: StatusComparisonItem[] = definitions
      .map((def) => {
        const matched = filteredDocs.filter((doc) => {
          const st = String(doc.status || '').trim();
          if (def.key === 'pending') {
            return (
              st === 'รอรับทราบ' ||
              (!st && doc.ackStatus === 'รอรับทราบ') ||
              (st !== '' && !knownSet.has(st))
            );
          }
          return def.statuses.includes(st);
        });
        const count = matched.length;
        const urgent = matched.filter((d) => isUrgentDoc(d) && !isCompletedStatus(d.status)).length;
        const overdue = matched.filter((d) => isOverdueDoc(d)).length;
        return {
          ...def,
          count,
          pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
          urgent,
          overdue,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      items,
      maxCount: items.reduce((m, i) => Math.max(m, i.count), 0),
    };
  }, [filteredDocs]);

  // Card 3: Operational progress overview
  const operationalMetrics = useMemo(() => {
    const total = filteredDocs.length;
    const completed = filteredDocs.filter((d) => isCompletedStatus(d.status)).length;
    const remaining = total - completed;
    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    let syncedDocsCount = 0;
    let pendingSyncQueuesCount = 0;

    for (const d of filteredDocs) {
      const key = String(d.id);
      const projRec = projectSyncMap[key];
      const procRec = procurementSyncMap[key];
      if (projRec || procRec) {
        syncedDocsCount += 1;
      }
      if (projRec && String(projRec.queueStatus || 'pending').toLowerCase() === 'pending') {
        pendingSyncQueuesCount += 1;
      }
      if (procRec && String(procRec.queueStatus || 'pending').toLowerCase() === 'pending') {
        pendingSyncQueuesCount += 1;
      }
    }

    const syncedPct = total > 0 ? Math.round((syncedDocsCount / total) * 100) : 0;
    const urgentTotal = filteredDocs.filter((d) => isUrgentDoc(d)).length;
    const urgentPending = filteredDocs.filter(
      (d) => isUrgentDoc(d) && !isCompletedStatus(d.status)
    ).length;
    const overdueCount = filteredDocs.filter((d) => isOverdueDoc(d)).length;

    return {
      total,
      completed,
      remaining,
      completedPct,
      syncedDocsCount,
      syncedPct,
      pendingSyncQueuesCount,
      urgentTotal,
      urgentPending,
      overdueCount,
    };
  }, [filteredDocs, projectSyncMap, procurementSyncMap]);

  // Card 3: 5-Month Document Trend by Type (real dates from filteredDocs)
  const monthlyTrendData = useMemo(() => {
    let latestYearMonth = '';
    const countsByMonthType = new Map<string, number>();

    for (const doc of filteredDocs) {
      const iso = normalizeDateToISO(getInboxDate(doc));
      if (!iso || iso.length < 7) continue;
      const ym = iso.slice(0, 7);
      if (!latestYearMonth || ym > latestYearMonth) {
        latestYearMonth = ym;
      }
      const key = `${ym}__${doc.type}`;
      countsByMonthType.set(key, (countsByMonthType.get(key) || 0) + 1);
    }

    const fallbackYM = getTodayISO().slice(0, 7);
    const anchorYM = latestYearMonth || fallbackYM;
    const [anchorY, anchorM] = anchorYM.split('-').map(Number);

    const months: { ym: string; shortLabel: string; fullLabel: string }[] = [];
    for (let offset = 4; offset >= 0; offset -= 1) {
      const d = new Date(Date.UTC(anchorY, anchorM - 1 - offset, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const ym = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
      const shortMonth = THAI_SHORT_MONTHS[m - 1] || String(m);
      const shortThaiYear = String(y + 543).slice(-2);
      months.push({
        ym,
        shortLabel: shortMonth,
        fullLabel: `${shortMonth} ${shortThaiYear}`,
      });
    }

    const candidateTypes = filterType ? [filterType as DocType] : DOC_TYPE_ORDER;
    const allSeries = candidateTypes.map((type) => {
      const values = months.map((m) => countsByMonthType.get(`${m.ym}__${type}`) || 0);
      const total5m = values.reduce((sum, v) => sum + v, 0);
      return {
        type,
        label: DOC_TYPE_META[type]?.label || type,
        shortLabel: DOC_TYPE_META[type]?.shortLabel || type,
        color: DOC_TYPE_COLORS[type] || '#6B6293',
        values,
        total5m,
      };
    });

    const activeSeries = allSeries
      .filter((s) => s.total5m > 0)
      .sort((a, b) => b.total5m - a.total5m);

    const seriesToRender =
      activeSeries.length > 0 ? activeSeries : allSeries.slice(0, filterType ? 1 : 2);

    const rawMax = seriesToRender.reduce(
      (max, s) => Math.max(max, ...s.values),
      0
    );
    const { yMax, ticks } = getNiceYAxisStep(rawMax);
    const totalIn5Months = seriesToRender.reduce((sum, s) => sum + s.total5m, 0);

    return {
      months,
      series: seriesToRender,
      yMax,
      ticks,
      totalIn5Months,
      rangeLabel: `${months[0]?.fullLabel || ''} - ${months[months.length - 1]?.fullLabel || ''}`,
    };
  }, [filteredDocs, filterType]);

  // Section 4: Collapsible Accordion by Document Category -> Sub-groups
  const accordionGroups = useMemo<AccordionGroup[]>(() => {
    const typesToInclude = filterType
      ? DOC_TYPE_ORDER.filter((t) => t === filterType)
      : DOC_TYPE_ORDER;

    const groups: AccordionGroup[] = [];

    for (const type of typesToInclude) {
      const list = filteredDocs.filter((d) => d.type === type);
      if (list.length === 0) continue;

      const done = list.filter((d) => isCompletedStatus(d.status)).length;
      const remaining = list.length - done;
      const urgent = list.filter((d) => isUrgentDoc(d)).length;
      const completedPct = Math.round((done / list.length) * 100);

      // Group sub-cards by real sub-category / agency / work
      const subMap = new Map<string, SarabanDoc[]>();
      for (const doc of list) {
        const subName = getDocSubGroupLabel(doc);
        const arr = subMap.get(subName) || [];
        arr.push(doc);
        subMap.set(subName, arr);
      }

      const sortedEntries = [...subMap.entries()].sort((a, b) => b[1].length - a[1].length);
      const topEntries = sortedEntries.slice(0, 8);
      const overflowEntries = sortedEntries.slice(8);

      const buildSubCard = (
        key: string,
        subLabel: string,
        docs: SarabanDoc[],
        searchTerm?: string
      ): AccordionSubCard => {
        const subDone = docs.filter((d) => isCompletedStatus(d.status)).length;
        const subRem = docs.length - subDone;
        const subUrgent = docs.filter((d) => isUrgentDoc(d)).length;
        const subOverdue = docs.filter((d) => isOverdueDoc(d)).length;
        const yearsSet = [...new Set(docs.map((d) => String(d.yearStr || '').trim()).filter(Boolean))];
        const yearTag =
          DOC_TYPE_META[type].yearKind === 'none'
            ? 'ทะเบียนกลาง'
            : yearsSet.length === 1
              ? `${DOC_TYPE_META[type].yearKind === 'fiscal' ? 'ปีงบฯ' : 'ปี'} ${yearsSet[0]}`
              : shortYearLabel;
        return {
          key,
          subLabel,
          yearTag,
          total: docs.length,
          done: subDone,
          remaining: subRem,
          urgent: subUrgent,
          overdue: subOverdue,
          completedPct: docs.length > 0 ? Math.round((subDone / docs.length) * 100) : 0,
          searchTerm,
        };
      };

      const subCards: AccordionSubCard[] = topEntries.map(([subName, docs]) =>
        buildSubCard(
          `${type}:${subName}`,
          subName,
          docs,
          subName.startsWith('ไม่ระบุ') ? '' : subName
        )
      );

      if (overflowEntries.length > 0) {
        const overflowDocs = overflowEntries.flatMap(([, docs]) => docs);
        subCards.push(
          buildSubCard(
            `${type}:__overflow__`,
            `หมวด/หน่วยงานอื่น ๆ (${overflowEntries.length} รายการ)`,
            overflowDocs,
            ''
          )
        );
      }

      groups.push({
        type,
        label: DOC_TYPE_META[type].label,
        total: list.length,
        done,
        remaining,
        urgent,
        completedPct,
        subCards,
      });
    }

    return groups.sort((a, b) => b.total - a.total);
  }, [filteredDocs, filterType, shortYearLabel]);

  // Section 5: Recent 5 documents (sorted by latest date then ID desc)
  const recentDocs = useMemo(() => {
    return [...filteredDocs]
      .sort((a, b) => {
        const diff =
          getInboxDateSortValue(getInboxDate(b)) - getInboxDateSortValue(getInboxDate(a));
        if (diff !== 0) return diff;
        return Number(b.id) - Number(a.id);
      })
      .slice(0, 5);
  }, [filteredDocs]);

  const toggleAccordionGroup = (typeKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(typeKey)) {
        next.delete(typeKey);
      } else {
        next.add(typeKey);
      }
      return next;
    });
  };

  const allAccordionExpanded =
    accordionGroups.length > 0 && accordionGroups.every((g) => expandedGroups.has(g.type));

  const toggleAllAccordions = () => {
    if (allAccordionExpanded) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(accordionGroups.map((g) => g.type)));
    }
  };

  const buildYearParamForTab = (targetTab: RegisterTabId): string => {
    if (targetTab === 'forms' || targetTab === 'overdue') return '';
    if (filterYear === CURRENT_YEAR_FILTER_KEY) {
      if (targetTab === 'allDocs' || targetTab === 'myInbox') return CURRENT_YEAR_FILTER_KEY;
      return targetTab === 'memos' || targetTab === 'vouchers'
        ? currentFiscalYear
        : currentCalendarYear;
    }
    return filterYear;
  };

  // SVG Donut Geometry
  const donutRadius = 56;
  const donutStroke = 18;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutSegments = useMemo(() => {
    const total = filteredDocs.length;
    if (total === 0) return [];
    let cumulativeFraction = 0;
    return docTypeDonutGroups
      .filter((g) => g.count > 0)
      .map((g) => {
        const fraction = g.count / total;
        const dashLength = fraction * donutCircumference;
        const dashOffset = -cumulativeFraction * donutCircumference;
        cumulativeFraction += fraction;
        return {
          ...g,
          dashLength,
          dashOffset,
        };
      });
  }, [docTypeDonutGroups, filteredDocs.length, donutCircumference]);

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* 1. Page Header Card */}
      <section className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_2px_14px_rgba(36,32,56,0.04)] overflow-hidden">
        <div className="relative px-5 py-5 sm:px-6 sm:py-6 min-h-[118px] sm:min-h-[134px] lg:min-h-[148px] flex items-center overflow-hidden">
          {/* Right-bottom horizontal flat-vector illustration layer (never squeezes text) */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-y-0 right-0 w-full sm:w-[74%] md:w-[64%] lg:w-[56%] xl:w-[50%] max-w-[540px] flex items-end justify-end overflow-hidden"
          >
            <img
              src={sarabanHeaderBanner}
              alt=""
              referrerPolicy="no-referrer"
              className="h-[146px] sm:h-[174px] md:h-[192px] lg:h-[208px] w-auto max-w-none -mb-2 sm:-mb-2.5 mr-1 sm:mr-3 mix-blend-multiply opacity-20 sm:opacity-55 md:opacity-85 lg:opacity-100 transition-opacity duration-200"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 sm:via-white/55 md:via-white/25 lg:via-transparent to-transparent" />
            <div className="absolute inset-y-0 left-0 w-24 sm:w-32 md:w-36 bg-gradient-to-r from-white via-white/90 to-transparent" />
          </div>

          {/* Foreground full-width text layer balanced with illustration */}
          <div className="relative z-10 w-full space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#4A4173] tracking-tight leading-snug">
              ภาพรวมงานสารบรรณ
            </h2>
            <div className="space-y-0.5 text-xs sm:text-sm text-[#574F7D] font-medium tabular-nums">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-snug">
                {scopeHeaderLines.primaryParts.map((part, idx) => (
                  <span
                    key={part}
                    className={`inline-flex items-center gap-2 ${
                      idx === 0 ? '' : 'whitespace-nowrap'
                    }`}
                  >
                    {idx > 0 && (
                      <span aria-hidden="true" className="text-[#B5B1C8]">
                        ·
                      </span>
                    )}
                    <span>{part}</span>
                  </span>
                ))}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[#6B6293] leading-snug">
                {scopeHeaderLines.detailParts.map((part, idx) => (
                  <span key={part} className="inline-flex items-center gap-2 whitespace-nowrap">
                    {idx > 0 && (
                      <span aria-hidden="true" className="text-[#B5B1C8]">
                        ·
                      </span>
                    )}
                    <span>{part}</span>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Filter Strip */}
      <section
        aria-label="ตัวกรองข้อมูลภาพรวมงานสารบรรณ"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {/* Filter 1: Document Type */}
        <div className="bg-[#F4F2FA] hover:bg-[#EFEBF8] focus-within:bg-[#EFEBF8] focus-within:border-[#6B6293] rounded-xl border border-[#E2DDF0] shadow-[0_1px_8px_rgba(36,32,56,0.03)] px-3.5 py-2.5 transition-colors">
          <label
            htmlFor="dash-filter-type"
            className="block text-[11px] font-semibold text-[#574F7D] mb-0.5"
          >
            ประเภทหนังสือ / ทะเบียน
          </label>
          <select
            id="dash-filter-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-0 py-1 rounded-md border-0 bg-transparent text-sm font-semibold text-[#242038] focus:outline-none cursor-pointer"
          >
            <option value="">ทั้งหมด (ทุกทะเบียน)</option>
            {DOC_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {DOC_TYPE_META[type].label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter 2: Status */}
        <div className="bg-[#F4F2FA] hover:bg-[#EFEBF8] focus-within:bg-[#EFEBF8] focus-within:border-[#6B6293] rounded-xl border border-[#E2DDF0] shadow-[0_1px_8px_rgba(36,32,56,0.03)] px-3.5 py-2.5 transition-colors">
          <label
            htmlFor="dash-filter-status"
            className="block text-[11px] font-semibold text-[#574F7D] mb-0.5"
          >
            สถานะการดำเนินงาน
          </label>
          <select
            id="dash-filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-0 py-1 rounded-md border-0 bg-transparent text-sm font-semibold text-[#242038] focus:outline-none cursor-pointer"
          >
            <option value="">ทุกสถานะ</option>
            {availableStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Filter 3: Year + Refresh Action */}
        <div className="bg-[#F4F2FA] hover:bg-[#EFEBF8] focus-within:bg-[#EFEBF8] focus-within:border-[#6B6293] rounded-xl border border-[#E2DDF0] shadow-[0_1px_8px_rgba(36,32,56,0.03)] px-3.5 py-2.5 transition-colors">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <label
              htmlFor="dash-filter-year"
              className="block text-[11px] font-semibold text-[#574F7D]"
            >
              ปี พ.ศ. / ปีงบประมาณ
            </label>
            {hasActiveSubFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterType('');
                  setFilterStatus('');
                }}
                className="text-[11px] font-semibold text-[#6B6293] hover:text-[#242038] inline-flex items-center gap-0.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <select
              id="dash-filter-year"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="flex-1 min-w-0 px-0 py-1 rounded-md border-0 bg-transparent text-sm font-semibold text-[#242038] focus:outline-none tabular-nums cursor-pointer"
            >
              <option value={CURRENT_YEAR_FILTER_KEY}>
                ปีปัจจุบัน ({currentCalendarYear} / งบฯ {currentFiscalYear})
              </option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
              <option value="">ทุกปี (All Years)</option>
            </select>
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isSyncing}
                title="รีเฟรชข้อมูลล่าสุดจาก Google Drive"
                aria-label="รีเฟรชข้อมูลล่าสุด"
                className="w-8 h-8 rounded-lg border border-[#D8D2E8] bg-white/80 hover:bg-[#6B6293] text-[#4A4173] hover:text-white inline-flex items-center justify-center shrink-0 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Three Balanced Executive Summary Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Card 1: Document Type Proportion Donut */}
        <article className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_2px_16px_rgba(36,32,56,0.05)] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#574F7D] via-[#6B6293] to-[#7D74A6] px-4 py-3 text-white flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-wide">สัดส่วนตามประเภทหนังสือ</h3>
            <span className="text-xs font-medium text-white/90 tabular-nums">
              {docTypeDonutGroups.filter((g) => g.count > 0).length} ประเภท
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-4">
            {/* SVG Donut by Document Type */}
            <div className="relative w-[144px] h-[144px] shrink-0 flex items-center justify-center">
              <svg
                viewBox="0 0 144 144"
                className="w-full h-full -rotate-90"
                role="img"
                aria-label={`แผนภูมิสัดส่วนหนังสือตามประเภทหนังสือ รวม ${filteredDocs.length} เรื่อง`}
              >
                <circle
                  cx="72"
                  cy="72"
                  r={donutRadius}
                  fill="none"
                  stroke="#ECEAF4"
                  strokeWidth={donutStroke}
                />
                {donutSegments.map((seg) => {
                  const isHovered = hoveredDonutKey === seg.key;
                  return (
                    <circle
                      key={seg.key}
                      cx="72"
                      cy="72"
                      r={donutRadius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isHovered ? donutStroke + 3 : donutStroke}
                      strokeDasharray={`${seg.dashLength} ${donutCircumference}`}
                      strokeDashoffset={seg.dashOffset}
                      className="cursor-pointer transition-all duration-150"
                      style={{
                        opacity: hoveredDonutKey && !isHovered ? 0.45 : 1,
                      }}
                      onMouseEnter={() => setHoveredDonutKey(seg.key)}
                      onMouseLeave={() => setHoveredDonutKey(null)}
                      onClick={() => {
                        onNavigateWithFilter({
                          tabId: seg.type,
                          year: buildYearParamForTab(seg.type),
                          statuses: filterStatus ? [filterStatus] : undefined,
                          statusLabel: filterStatus || undefined,
                        });
                      }}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
                {activeDonutGroup ? (
                  <>
                    <span
                      className="text-xl font-bold tabular-nums leading-tight"
                      style={{ color: activeDonutGroup.color }}
                    >
                      {activeDonutGroup.count.toLocaleString('th-TH')}
                    </span>
                    <span className="text-xs font-bold text-[#242038] tabular-nums">
                      {activeDonutGroup.pct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-[#574F7D] leading-tight line-clamp-1 max-w-[92px]">
                      {activeDonutGroup.label}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-[#242038] tabular-nums leading-tight">
                      {filteredDocs.length.toLocaleString('th-TH')}
                    </span>
                    <span className="text-[11px] font-medium text-[#574F7D]">เรื่องทั้งหมด</span>
                  </>
                )}
              </div>
            </div>

            {/* Interactive Document Type Legend */}
            <div className="flex-1 w-full space-y-1 min-w-0">
              {docTypeDonutGroups.map((group) => {
                const isHovered = hoveredDonutKey === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onMouseEnter={() => setHoveredDonutKey(group.key)}
                    onMouseLeave={() => setHoveredDonutKey(null)}
                    onClick={() => {
                      onNavigateWithFilter({
                        tabId: group.type,
                        year: buildYearParamForTab(group.type),
                        statuses: filterStatus ? [filterStatus] : undefined,
                        statusLabel: filterStatus || undefined,
                      });
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isHovered ? 'bg-[#F1EFF7]' : 'hover:bg-[#F8F7FB]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-xs font-medium text-[#242038] truncate">
                        {group.label}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-[#242038] tabular-nums whitespace-nowrap shrink-0">
                      {group.count.toLocaleString('th-TH')}{' '}
                      <span className="font-normal text-[#574F7D]">
                        ({Math.round(group.pct)}%)
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#FAF9FC] border-t border-[#E5E2F0] px-4 py-2.5 text-xs font-semibold text-[#3F3668] flex items-center justify-between tabular-nums">
            <span>รวมทั้งหมด</span>
            <span className="font-bold text-[#242038]">
              {filteredDocs.length.toLocaleString('th-TH')} เรื่อง
            </span>
          </div>
        </article>

        {/* Card 2: Horizontal Bar Comparison by Work Status */}
        <article className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_2px_16px_rgba(36,32,56,0.05)] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#574F7D] via-[#6B6293] to-[#7D74A6] px-4 py-3 text-white flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-wide truncate">เปรียบเทียบตามสถานะงาน</h3>
            <span className="text-xs font-medium text-white/90 tabular-nums whitespace-nowrap shrink-0">
              {statusComparisonData.items.filter((i) => i.count > 0).length} กลุ่มสถานะ
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-center">
            {filteredDocs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                ไม่พบเอกสารตามเงื่อนไขตัวกรองที่เลือก
              </div>
            ) : (
              <div className="space-y-3">
                {statusComparisonData.items.map((item) => {
                  const barScale =
                    statusComparisonData.maxCount > 0 && item.count > 0
                      ? Math.max(4, (item.count / statusComparisonData.maxCount) * 100)
                      : 0;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const targetTab: RegisterTabId = (filterType || 'allDocs') as RegisterTabId;
                        onNavigateWithFilter({
                          tabId: targetTab,
                          year: buildYearParamForTab(targetTab),
                          statuses: item.statuses,
                          statusLabel: item.shortLabel,
                        });
                      }}
                      className="w-full text-left group rounded-lg p-1 -m-1 hover:bg-[#F8F7FB] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-[#242038] group-hover:text-[#574F7D] truncate transition-colors">
                            {item.shortLabel}
                          </span>
                        </span>
                        <span className="font-bold text-[#242038] tabular-nums whitespace-nowrap shrink-0">
                          {item.count.toLocaleString('th-TH')}{' '}
                          <span className="font-normal text-[#574F7D]">
                            ({Math.round(item.pct)}%)
                          </span>
                        </span>
                      </div>

                      <div className="w-full h-2.5 rounded-full bg-[#ECEAF4] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${barScale}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>

                      {(item.urgent > 0 || item.overdue > 0) && (
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 tabular-nums">
                          {item.urgent > 0 && (
                            <span className="text-[#92400E]">
                              ด่วน {item.urgent.toLocaleString('th-TH')}
                            </span>
                          )}
                          {item.urgent > 0 && item.overdue > 0 && (
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                          )}
                          {item.overdue > 0 && (
                            <span className="text-[#B91C1C] font-semibold">
                              เกินกำหนด {item.overdue.toLocaleString('th-TH')}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[#FAF9FC] border-t border-[#E5E2F0] px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 tabular-nums">
            <span className="text-[#15803D] font-bold">
              เสร็จสิ้น {operationalMetrics.completedPct}% (
              {operationalMetrics.completed.toLocaleString('th-TH')} เรื่อง)
            </span>
            <span
              className={
                operationalMetrics.remaining > 0
                  ? 'text-[#B45309] font-bold'
                  : 'text-[#3F3668] font-bold'
              }
            >
              คงค้าง {operationalMetrics.remaining.toLocaleString('th-TH')} เรื่อง
            </span>
          </div>
        </article>

        {/* Card 3: Smooth Multi-Series Spline Area Chart (Latest 5 Months by Document Type) */}
        <article className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_2px_16px_rgba(36,32,56,0.05)] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#574F7D] via-[#6B6293] to-[#7D74A6] px-4 py-3 text-white flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-wide truncate">
              แนวโน้มหนังสือ 5 เดือนล่าสุด
            </h3>
            <span className="text-xs font-medium text-white/90 tabular-nums whitespace-nowrap shrink-0">
              {monthlyTrendData.rangeLabel}
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between gap-2">
            {/* Compact Interactive Type Legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {monthlyTrendData.series.map((s) => {
                const isDimmed = hoveredTrendType !== null && hoveredTrendType !== s.type;
                return (
                  <button
                    key={s.type}
                    type="button"
                    onMouseEnter={() => setHoveredTrendType(s.type)}
                    onMouseLeave={() => setHoveredTrendType(null)}
                    onClick={() => {
                      onNavigateWithFilter({
                        tabId: s.type,
                        year: buildYearParamForTab(s.type),
                        statuses: filterStatus ? [filterStatus] : undefined,
                        statusLabel: filterStatus || undefined,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium transition-opacity ${
                      isDimmed ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-[#242038]">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Smooth Spline Area Chart SVG */}
            {(() => {
              const svgW = 340;
              const svgH = 186;
              const padL = 32;
              const padR = 14;
              const padT = 14;
              const padB = 28;
              const plotW = svgW - padL - padR;
              const plotH = svgH - padT - padB;
              const baselineY = padT + plotH;
              const monthCount = monthlyTrendData.months.length;
              const xForIdx = (idx: number) =>
                padL + (monthCount > 1 ? (idx / (monthCount - 1)) * plotW : plotW / 2);
              const yForVal = (val: number) =>
                baselineY -
                (monthlyTrendData.yMax > 0 ? (val / monthlyTrendData.yMax) * plotH : 0);

              const activeMonth =
                hoveredTrendMonthIdx !== null
                  ? monthlyTrendData.months[hoveredTrendMonthIdx]
                  : null;

              return (
                <div className="relative w-full">
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-[182px] overflow-visible select-none"
                    role="img"
                    aria-label="กราฟเส้นแสดงจำนวนหนังสือแต่ละประเภทใน 5 เดือนล่าสุด"
                    onMouseLeave={() => setHoveredTrendMonthIdx(null)}
                  >
                    <defs>
                      {monthlyTrendData.series.map((s) => (
                        <linearGradient
                          key={`grad-${s.type}`}
                          id={`saraban-trend-grad-${s.type}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={s.color} stopOpacity="0.24" />
                          <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                        </linearGradient>
                      ))}
                    </defs>

                    {/* Clean Minimal Y-Axis Ticks (matching reference image) */}
                    {monthlyTrendData.ticks.map((tick) => {
                      const y = yForVal(tick);
                      return (
                        <g key={tick}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={svgW - padR}
                            y2={y}
                            stroke="#F1EFF7"
                            strokeWidth="1"
                          />
                          <text
                            x={padL - 8}
                            y={y + 3.5}
                            textAnchor="end"
                            className="fill-[#94A3B8] text-[10px] font-medium tabular-nums"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    {/* Hover Vertical Guide Line */}
                    {hoveredTrendMonthIdx !== null && (
                      <line
                        x1={xForIdx(hoveredTrendMonthIdx)}
                        y1={padT}
                        x2={xForIdx(hoveredTrendMonthIdx)}
                        y2={baselineY}
                        stroke="#C9C4DC"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Area Gradient Fills (drawn beneath strokes) */}
                    {monthlyTrendData.series.map((s) => {
                      const pts = s.values.map((v, idx) => ({
                        x: xForIdx(idx),
                        y: yForVal(v),
                      }));
                      const linePath = buildMonotoneSplinePath(pts);
                      if (!linePath) return null;
                      const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
                      const isDimmed = hoveredTrendType !== null && hoveredTrendType !== s.type;
                      return (
                        <path
                          key={`area-${s.type}`}
                          d={areaPath}
                          fill={`url(#saraban-trend-grad-${s.type})`}
                          style={{
                            opacity: isDimmed ? 0.18 : 1,
                            transition: 'opacity 180ms ease',
                          }}
                        />
                      );
                    })}

                    {/* Smooth Curved Line Strokes */}
                    {monthlyTrendData.series.map((s) => {
                      const pts = s.values.map((v, idx) => ({
                        x: xForIdx(idx),
                        y: yForVal(v),
                      }));
                      const linePath = buildMonotoneSplinePath(pts);
                      if (!linePath) return null;
                      const isHighlighted = hoveredTrendType === s.type;
                      const isDimmed = hoveredTrendType !== null && !isHighlighted;
                      return (
                        <path
                          key={`line-${s.type}`}
                          d={linePath}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={isHighlighted ? 3.2 : 2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            opacity: isDimmed ? 0.22 : 1,
                            transition: 'opacity 180ms ease, stroke-width 180ms ease',
                          }}
                        />
                      );
                    })}

                    {/* Active Month Data Point Markers */}
                    {hoveredTrendMonthIdx !== null &&
                      monthlyTrendData.series.map((s) => {
                        const val = s.values[hoveredTrendMonthIdx] ?? 0;
                        const isDimmed = hoveredTrendType !== null && hoveredTrendType !== s.type;
                        return (
                          <circle
                            key={`dot-${s.type}`}
                            cx={xForIdx(hoveredTrendMonthIdx)}
                            cy={yForVal(val)}
                            r={4}
                            fill="#FFFFFF"
                            stroke={s.color}
                            strokeWidth={2.5}
                            style={{ opacity: isDimmed ? 0.25 : 1 }}
                          />
                        );
                      })}

                    {/* Bottom X-Axis Month Labels */}
                    {monthlyTrendData.months.map((m, idx) => {
                      const isActive = hoveredTrendMonthIdx === idx;
                      return (
                        <text
                          key={m.ym}
                          x={xForIdx(idx)}
                          y={svgH - 6}
                          textAnchor="middle"
                          className={`text-[10.5px] transition-colors ${
                            isActive
                              ? 'fill-[#362E57] font-bold'
                              : 'fill-[#94A3B8] font-medium'
                          }`}
                        >
                          {m.shortLabel}
                        </text>
                      );
                    })}

                    {/* Invisible Column Hit Zones for Smooth Hover */}
                    {monthlyTrendData.months.map((m, idx) => {
                      const colW = plotW / Math.max(1, monthCount - 1);
                      const hitX = Math.max(padL, xForIdx(idx) - colW / 2);
                      const hitRight = Math.min(svgW - padR, xForIdx(idx) + colW / 2);
                      return (
                        <rect
                          key={`hit-${m.ym}`}
                          x={hitX}
                          y={padT}
                          width={Math.max(12, hitRight - hitX)}
                          height={plotH + padB}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredTrendMonthIdx(idx)}
                        />
                      );
                    })}
                  </svg>

                  {/* Floating Hover Readout Pill */}
                  {activeMonth && hoveredTrendMonthIdx !== null && (
                    <div className="pointer-events-none absolute top-1 right-1 bg-white/95 backdrop-blur-xs border border-[#DCD8EB] rounded-lg px-2.5 py-1.5 shadow-[0_4px_14px_rgba(36,32,56,0.1)] text-[11px] tabular-nums space-y-0.5 z-10">
                      <div className="font-bold text-[#362E57] border-b border-[#ECEAF4] pb-0.5 mb-0.5">
                        {activeMonth.fullLabel}
                      </div>
                      {monthlyTrendData.series.map((s) => (
                        <div
                          key={`tip-${s.type}`}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="inline-flex items-center gap-1.5 text-[#574F7D]">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span>{s.shortLabel}</span>
                          </span>
                          <span className="font-bold text-[#242038]">
                            {(s.values[hoveredTrendMonthIdx] ?? 0).toLocaleString('th-TH')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="bg-[#FAF9FC] border-t border-[#E5E2F0] px-4 py-2.5 text-xs font-semibold text-[#3F3668] flex items-center justify-between gap-2 tabular-nums">
            <span>รวม 5 เดือนล่าสุด</span>
            <span className="font-bold text-[#242038]">
              {monthlyTrendData.totalIn5Months.toLocaleString('th-TH')} เรื่อง
            </span>
          </div>
        </article>
      </section>

      {/* 4. Collapsible Accordion: Summary by Document Category / Department */}
      <section className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_2px_16px_rgba(36,32,56,0.05)] overflow-hidden">
        <div className="bg-[#F5F3FA] border-b border-[#E5E2F0] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#242038]">
              สรุปตามหมวดเอกสาร / หน่วยงาน
            </h3>
            <span className="text-xs font-medium text-[#574F7D] tabular-nums">
              · {accordionGroups.length} หมวด
            </span>
          </div>
          {accordionGroups.length > 0 && (
            <button
              type="button"
              onClick={toggleAllAccordions}
              className="text-xs font-semibold text-[#4A4173] hover:text-[#242038] px-2.5 py-1 rounded-lg hover:bg-[#ECEAF4] transition-colors whitespace-nowrap shrink-0"
            >
              {allAccordionExpanded ? 'หุบทั้งหมด' : 'ขยายทั้งหมด'}
            </button>
          )}
        </div>

        {accordionGroups.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            ไม่มีข้อมูลหมวดเอกสารตามตัวกรองที่เลือก
          </div>
        ) : (
          <div className="divide-y divide-[#ECEAF4]">
            {accordionGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.type);
              return (
                <div key={group.type}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleAccordionGroup(group.type)}
                    className="w-full px-4 sm:px-5 py-3.5 hover:bg-[#FAF9FC] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronRight
                        className={`w-4 h-4 text-[#6B6293] shrink-0 transition-transform duration-150 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                      <span className="font-bold text-sm text-[#242038] truncate">
                        {group.label}
                      </span>
                      <span className="text-xs font-medium text-[#574F7D] tabular-nums whitespace-nowrap">
                        ({group.total.toLocaleString('th-TH')} เรื่อง · {group.subCards.length} กลุ่มย่อย)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 pl-6 md:pl-0">
                      <div className="flex items-center gap-2">
                        <div className="w-24 sm:w-32 h-2 rounded-full bg-[#ECEAF4] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#6B6293] transition-all duration-200"
                            style={{ width: `${group.completedPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#574F7D] tabular-nums w-9 text-right">
                          {group.completedPct}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs tabular-nums">
                        <span className="text-slate-600">
                          ทั้งหมด{' '}
                          <strong className="text-[#242038]">
                            {group.total.toLocaleString('th-TH')}
                          </strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-[#15803D]">
                          เสร็จสิ้น <strong>{group.done.toLocaleString('th-TH')}</strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className={group.remaining > 0 ? 'text-[#B45309]' : 'text-slate-500'}>
                          คงค้าง <strong>{group.remaining.toLocaleString('th-TH')}</strong>
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 py-4 bg-[#FAF9FC] border-t border-[#ECEAF4]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {group.subCards.map((sub) => {
                          const doneWidth = sub.total > 0 ? (sub.done / sub.total) * 100 : 0;
                          const alertCount = Math.min(sub.remaining, sub.overdue || sub.urgent);
                          const alertWidth = sub.total > 0 ? (alertCount / sub.total) * 100 : 0;
                          const normalRemWidth = Math.max(0, 100 - doneWidth - alertWidth);

                          return (
                            <div
                              key={sub.key}
                              className="bg-white rounded-xl border border-[#E5E2F0] p-3.5 flex flex-col justify-between gap-3"
                            >
                              {/* Top Line */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-medium text-[#574F7D] tabular-nums">
                                    {sub.yearTag} · {group.label}
                                  </div>
                                  <div className="text-sm font-bold text-[#242038] mt-0.5 line-clamp-2 leading-snug">
                                    {sub.subLabel}
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-[#574F7D] tabular-nums shrink-0">
                                  {sub.completedPct}%
                                </span>
                              </div>

                              {/* Segmented Progress Bar */}
                              <div className="w-full h-2 rounded-full bg-[#ECEAF4] overflow-hidden flex">
                                {doneWidth > 0 && (
                                  <div
                                    className="h-full bg-[#6B6293]"
                                    style={{ width: `${doneWidth}%` }}
                                  />
                                )}
                                {normalRemWidth > 0 && (
                                  <div
                                    className="h-full bg-[#F59E0B]"
                                    style={{ width: `${normalRemWidth}%` }}
                                  />
                                )}
                                {alertWidth > 0 && (
                                  <div
                                    className="h-full bg-[#DC2626]"
                                    style={{ width: `${alertWidth}%` }}
                                  />
                                )}
                              </div>

                              {/* 2-Column Numbers */}
                              <div className="grid grid-cols-2 gap-2 pt-0.5">
                                <div>
                                  <div className="text-[11px] text-slate-500">เสร็จแล้ว / ทั้งหมด</div>
                                  <div className="text-sm font-bold text-[#242038] tabular-nums">
                                    {sub.done.toLocaleString('th-TH')} /{' '}
                                    {sub.total.toLocaleString('th-TH')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-slate-500">คงค้าง</div>
                                  <div
                                    className={`text-sm font-bold tabular-nums ${
                                      sub.remaining > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
                                    }`}
                                  >
                                    {sub.remaining.toLocaleString('th-TH')} เรื่อง
                                  </div>
                                </div>
                              </div>

                              {/* Card Bottom Bar */}
                              <div className="pt-2.5 border-t border-[#F0EEF6] flex items-center justify-between gap-2 text-xs">
                                <span className="text-[#574F7D] tabular-nums truncate">
                                  ทั้งหมด {sub.total.toLocaleString('th-TH')} เรื่อง
                                  {sub.urgent > 0 ? ` · ด่วน ${sub.urgent}` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigateWithFilter({
                                      tabId: group.type,
                                      year: buildYearParamForTab(group.type),
                                      statuses: filterStatus ? [filterStatus] : undefined,
                                      statusLabel: filterStatus || undefined,
                                      search: sub.searchTerm,
                                    })
                                  }
                                  className="text-[#574F7D] hover:text-[#242038] font-bold inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-colors"
                                >
                                  <span>ดูรายการ</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Recent Documents Table */}
      <section className="bg-white rounded-2xl border border-[#E5E2F0] shadow-[0_2px_16px_rgba(36,32,56,0.05)] overflow-hidden">
        <div className="bg-[#F5F3FA] border-b border-[#E5E2F0] px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-[#242038] tabular-nums">
            รายการหนังสือล่าสุด · แสดง {recentDocs.length} จาก{' '}
            {filteredDocs.length.toLocaleString('th-TH')} รายการ
          </h3>
          <button
            type="button"
            onClick={() => {
              const targetTab: RegisterTabId = (filterType || 'allDocs') as RegisterTabId;
              onNavigateWithFilter({
                tabId: targetTab,
                year: buildYearParamForTab(targetTab),
                statuses: filterStatus ? [filterStatus] : undefined,
                statusLabel: filterStatus || undefined,
              });
            }}
            className="px-3 py-1.5 rounded-lg bg-[#6B6293] hover:bg-[#574F7D] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <span>ดูทะเบียนทั้งหมด</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto saraban-scroll">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead className="bg-[#FAF9FC] text-xs font-semibold text-[#3F3668] border-b border-[#E5E2F0]">
              <tr>
                <th className="px-4 py-3">เรื่อง / เลขที่หนังสือและวันที่</th>
                <th className="px-3.5 py-3 whitespace-nowrap">ประเภทหนังสือ</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">ชั้นความเร็ว</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">สถานะ</th>
                <th className="px-4 py-3 whitespace-nowrap">วันที่ลงรับ / ผู้รับผิดชอบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EEF6] text-sm">
              {isLoading && documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-600">
                    กำลังโหลดข้อมูลทะเบียนเอกสารจาก Google Drive...
                  </td>
                </tr>
              ) : recentDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    ไม่พบรายการหนังสือตามเงื่อนไขตัวกรองที่เลือก
                  </td>
                </tr>
              ) : (
                recentDocs.map((d) => {
                  const isSelected = String(d.id) === String(selectedDocId);
                  const displayDate = formatThaiDate(getInboxDate(d));
                  const docDateText = formatThaiDate(
                    d.type === 'vouchers' ? d.voucherDate : d.docDate
                  );
                  const codeDisplay = getDocCodeDisplay(d);
                  const responsible = d.assignee || d.voucherMaker || '-';

                  return (
                    <tr
                      key={String(d.id)}
                      tabIndex={0}
                      onClick={() => onViewDoc(d)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onViewDoc(d);
                        }
                      }}
                      className={`transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#6B6293] ${
                        isSelected ? 'bg-[#ECEAF4]/70' : 'hover:bg-[#F8F7FB]'
                      }`}
                    >
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-semibold text-[#242038] truncate">
                          {getDocTitle(d)}
                        </div>
                        <div className="text-xs text-[#574F7D] mt-0.5 truncate tabular-nums">
                          {codeDisplay} · ลงวันที่ {docDateText}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <DocTypeBadge type={d.type} />
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <UrgencyHighlightBadge urgency={d.urgency} />
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <StatusHighlightBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-semibold text-[#242038] tabular-nums">
                          {displayDate}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[160px]">
                          {responsible}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
