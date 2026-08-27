import TierChip from "./TierChip";

function websiteDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function PartnerTable({ partners, onSelect, selectedId }) {
  if (partners.length === 0) {
    return <div className="table-empty">조건에 맞는 후보 업체가 없습니다.</div>;
  }

  return (
    <table className="partner-table">
      <thead>
        <tr>
          <th>업체명</th>
          <th>국가·지역</th>
          <th>유형</th>
          <th>웹사이트</th>
          <th>총점</th>
          <th>등급</th>
          <th>컨택 상태</th>
        </tr>
      </thead>
      <tbody>
        {partners.map((p) => (
          <tr
            key={p.id}
            className={p.id === selectedId ? "row-selected" : ""}
            onClick={() => onSelect(p.id)}
          >
            <td className="cell-company">
              {p.company_name}
              {p.screening_status === "제외" && (
                <div className="cell-reason">{p.screening_reason}</div>
              )}
            </td>
            <td>{p.country} · {p.region}</td>
            <td>{p.type}</td>
            <td>{websiteDomain(p.website)}</td>
            <td className="cell-score">{p.total_score}</td>
            <td><TierChip grade={p.display_grade} /></td>
            <td>{p.contact_status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
