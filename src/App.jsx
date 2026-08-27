import { useEffect, useMemo, useState } from "react";
import { fetchPartners, updatePartner } from "./api/dataService";
import { withComputedFields } from "./utils/scoring";
import FilterBar from "./components/FilterBar";
import ScreeningSummary from "./components/ScreeningSummary";
import SummaryCards from "./components/SummaryCards";
import PartnerTable from "./components/PartnerTable";
import DetailPanel from "./components/DetailPanel";
import ContactView from "./components/ContactView";
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

  useEffect(() => {
    fetchPartners().then((rows) => {
      setPartners(rows.map(withComputedFields));
      setLoading(false);
    });
  }, []);

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
        <div className="app-subtitle">
          동남아 파트너 발굴·검증 대시보드 — 검증 기준 10개 (신뢰도40 · 기술력35, 75점 만점)
          <span className="app-subtitle-note">
            · 1차 필터는 "시공 유형 포함" 하나로 완화, 한인 연계 기준은 후보 전체에서 해당 사례가 없어 채점에서 제외했습니다
            · 등급 임계값은 2차 검증(등록증·재무 등)이 끝나기 전 1차 조사 점수 분포에 맞춰 조정한 임시 기준입니다
          </span>
        </div>
      </header>

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
    </div>
  );
}
