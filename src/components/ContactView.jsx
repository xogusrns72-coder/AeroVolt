import { CONTACT_STATUSES } from "../data/constants";
import TierChip from "./TierChip";

export default function ContactView({ partners, onUpdateStatus, onSelect }) {
  const readyPartners = partners
    .filter((p) => p.display_grade === "A" || p.display_grade === "B")
    .sort((a, b) => b.total_score - a.total_score);

  if (readyPartners.length === 0) {
    return (
      <div className="table-empty">
        현재 조건에 맞는 A·B 등급 업체가 없습니다.<br />
        필터를 넓혀 보거나, 업체 상세 패널에서 2차 항목(등록증·재무·인증 등)을 실제로 확인해
        점수를 입력하면 등급이 올라갈 수 있습니다.
      </div>
    );
  }

  return (
    <div className="contact-view-grid">
      {readyPartners.map((p) => (
        <div key={p.id} className="contact-card">
          <div className="contact-card-header">
            <div>
              <div className="contact-card-company" onClick={() => onSelect(p.id)}>
                {p.company_name}
              </div>
              <div className="contact-card-sub">
                {p.country} · {p.region} · {p.type} · {p.total_score}점
              </div>
            </div>
            <TierChip grade={p.display_grade} />
          </div>

          <div className="contact-card-body">
            <div className="contact-card-row">
              <span className="contact-card-label">웹사이트</span>
              <a href={p.website} target="_blank" rel="noreferrer">{p.website}</a>
            </div>
            {p.action && (
              <div className="contact-card-row">
                <span className="contact-card-label">우선 조회</span>
                <span>{p.action.portal_check}</span>
              </div>
            )}
          </div>

          <div className="contact-card-footer">
            <select
              value={p.contact_status}
              onChange={(e) => onUpdateStatus(p.id, e.target.value)}
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
