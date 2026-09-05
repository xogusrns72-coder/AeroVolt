import { useEffect, useMemo, useState } from "react";
import { loadPartners, updatePartner } from "./api/dataService";
import { withComputedFields } from "./utils/scoring";
import FilterBar from "./components/FilterBar";
import ScreeningSummary from "./components/ScreeningSummary";
import SummaryCards from "./components/SummaryCards";
import PartnerTable from "./components/PartnerTable";
import DetailPanel from "./components/DetailPanel";
import ContactView from "./components/ContactView";
import ConnectionBanner from "./components/ConnectionBanner";
import MailerModal from "./components/mailer/MailerModal";
import { DEFAULT_GRADE_FILTER, DEFAULT_MIN_SCORE } from "./data/outreachFilters";
import useOutreachStore from "./hooks/useOutreachStore";
import "./App.css";

const EMPTY_FILTERS = {
  search: "",
  country: [],
  type: [],
  screening: [],
  grade: [],
  contactStatus: [],
};

export default function App() {
  const [partners, setPartners] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "contact"
  const [loading, setLoading] = useState(true);
  const [mailerOpen, setMailerOpen] = useState(false);

  // 발송 콘솔의 저장소(연락처·발송기록·템플릿)는 모달 밖에서 관리한다 —
  // 모달을 닫아도 값이 유지되고, 버튼 배지도 이 값을 참조한다.
  const outreachStore = useOutreachStore();

  const [dataError, setDataError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [retrying, setRetrying] = useState(false);

  // 다시 시도할 때는 화면을 "불러오는 중..."으로 비우지 않는다 — 이미 보고 있던 표를 유지한 채
  // 배너의 버튼만 진행 중 상태로 바꾼다.
  useEffect(() => {
    let alive = true;
    loadPartners()
      .then(({ rows, error }) => {
        if (!alive) return;
        setPartners(rows.map(withComputedFields));
        setDataError(error);
      })
      .catch((e) => {
        if (!alive) return;
        setDataError(e?.message || String(e));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRetrying(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  const countries = useMemo(() => Array.from(new Set(partners.map((p) => p.country))).sort(), [partners]);
  const types = useMemo(() => Array.from(new Set(partners.map((p) => p.type))).sort(), [partners]);

  const matchesScreening = (p, value) => {
    if (value === "scored") return p.scored;
    if (value === "pending") return !p.scored && p.screening_status === "통과";
    if (value === "excluded") return p.screening_status === "제외";
    return false;
  };

  const filteredPartners = useMemo(() => {
    return partners
      .filter((p) => (filters.country.length === 0 ? true : filters.country.includes(p.country)))
      .filter((p) => (filters.type.length === 0 ? true : filters.type.includes(p.type)))
      .filter((p) =>
        filters.screening.length === 0 ? true : filters.screening.some((v) => matchesScreening(p, v))
      )
      .filter((p) => (filters.grade.length === 0 ? true : filters.grade.includes(p.display_grade)))
      .filter((p) =>
        filters.contactStatus.length === 0 ? true : filters.contactStatus.includes(p.contact_status)
      )
      .filter((p) =>
        filters.search ? p.company_name.toLowerCase().includes(filters.search.toLowerCase()) : true
      )
      .sort((a, b) => {
        if (b.total_score !== a.total_score) return b.total_score - a.total_score;
        const excludedRank = (p) => (p.screening_status === "제외" ? 1 : 0);
        if (excludedRank(a) !== excludedRank(b)) return excludedRank(a) - excludedRank(b);
        return a.company_name.localeCompare(b.company_name);
      });
  }, [partners, filters]);

  const selectedPartner = partners.find((p) => p.id === selectedId) || null;

  // 발송 버튼 배지 = 발송 콘솔 기본 필터(A·B 등급 + 15점 이상)에서 아직 발송하지 않은 곳.
  const sentRecords = outreachStore.data.sent;
  const mailCandidateCount = useMemo(
    () =>
      partners.filter(
        (p) =>
          DEFAULT_GRADE_FILTER[p.display_grade] &&
          p.total_score >= DEFAULT_MIN_SCORE &&
          sentRecords[p.id]?.status !== "sent"
      ).length,
    [partners, sentRecords]
  );

  const handleSavePartner = async (updated) => {
    setPartners((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await updatePartner(updated);
    setSelectedId(null);
  };

  const handleUpdateStatus = async (id, status) => {
    const target = partners.find((p) => p.id === id);
    if (!target) return;
    const updated = { ...target, contact_status: status };
    setPartners((prev) => prev.map((p) => (p.id === id ? updated : p)));
    await updatePartner(updated);
  };

  if (loading) {
    return <div className="app-loading">불러오는 중...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">AeroVolt × 패브릭덕트</div>
        <div className="app-subtitle">동남아 파트너 발굴·검증 대시보드</div>
      </header>

      {dataError && (
        <ConnectionBanner
          error={dataError}
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            setReloadTick((n) => n + 1);
          }}
        />
      )}

      <FilterBar filters={filters} onChange={setFilters} countries={countries} types={types} />

      <ScreeningSummary partners={filteredPartners} />

      <SummaryCards partners={filteredPartners} />

      <div className="tabs">
        <button
          className={activeTab === "all" ? "tab tab-active" : "tab"}
          onClick={() => setActiveTab("all")}
        >
          전체 후보 ({filteredPartners.length})
        </button>
        <button
          className={activeTab === "contact" ? "tab tab-active" : "tab"}
          onClick={() => setActiveTab("contact")}
        >
          컨택 실행 뷰 (A·B 등급)
        </button>
        <button className="mailer-open-btn" onClick={() => setMailerOpen(true)}>
          메일 발송
          <span className="mailer-open-badge">{mailCandidateCount}</span>
        </button>
      </div>

      {activeTab === "all" ? (
        <PartnerTable
          partners={filteredPartners}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
      ) : (
        <ContactView
          partners={filteredPartners}
          onUpdateStatus={handleUpdateStatus}
          onSelect={setSelectedId}
        />
      )}

      {selectedPartner && (
        <DetailPanel
          key={selectedPartner.id}
          partner={selectedPartner}
          onClose={() => setSelectedId(null)}
          onSave={handleSavePartner}
        />
      )}

      <MailerModal
        open={mailerOpen}
        onClose={() => setMailerOpen(false)}
        partners={partners}
        store={outreachStore}
      />
    </div>
  );
}
