import { CONTACT_STATUSES, GRADE_ORDER, GRADES } from "../data/constants";
import MultiSelect from "./MultiSelect";

const SCREENING_OPTIONS = [
  { value: "scored", label: "채점 완료" },
  { value: "pending", label: "통과 · 채점 대기" },
  { value: "excluded", label: "필터 제외" },
];

export default function FilterBar({ filters, onChange, countries, types }) {
  const updateMulti = (key) => (values) => onChange({ ...filters, [key]: values });

  const countryOptions = countries.map((c) => ({ value: c, label: c }));
  const typeOptions = types.map((t) => ({ value: t, label: t }));
  const gradeOptions = GRADE_ORDER.map((g) => ({ value: g, label: `${GRADES[g].label} (${GRADES[g].desc})` }));
  const contactStatusOptions = CONTACT_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    <div className="filter-bar">
      <div className="filter-bar-title">조건 입력 (복수 선택 가능)</div>
      <div className="filter-bar-controls">
        <input
          className="filter-search"
          type="text"
          placeholder="업체명 검색"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
        <MultiSelect label="국가" options={countryOptions} selected={filters.country} onChange={updateMulti("country")} />
        <MultiSelect label="유형" options={typeOptions} selected={filters.type} onChange={updateMulti("type")} />
        <MultiSelect label="1차 필터링" options={SCREENING_OPTIONS} selected={filters.screening} onChange={updateMulti("screening")} />
        <MultiSelect label="등급" options={gradeOptions} selected={filters.grade} onChange={updateMulti("grade")} />
        <MultiSelect label="컨택 상태" options={contactStatusOptions} selected={filters.contactStatus} onChange={updateMulti("contactStatus")} />
      </div>
    </div>
  );
}
