import { useState } from "react";
import {
  CRITERIA,
  CATEGORY_ORDER,
  computeCategorySubtotal,
  computeTotalScore,
  computeGrade,
  computeDisplayGrade,
  withComputedFields,
} from "../utils/scoring";
import { CATEGORIES } from "../data/criteria";
import { CONTACT_STATUSES } from "../data/constants";
import TierChip from "./TierChip";

// 부모(App)에서 partner.id를 key로 넘겨 새로운 업체 선택 시 이 컴포넌트가
// 새로 마운트되도록 한다 — draft를 partner로부터 안전하게 초기화하기 위함.
export default function DetailPanel({ partner, onClose, onSave }) {
  const [draft, setDraft] = useState(partner);

  const totalScore = computeTotalScore(draft);
  const grade = computeGrade(totalScore);
  const displayGrade = computeDisplayGrade(draft, totalScore, grade);

  const updateScore = (key) => (e) => {
    const value = Math.min(5, Math.max(0, Number(e.target.value)));
    setDraft({ ...draft, scores: { ...draft.scores, [key]: value } });
  };

  const handleSave = () => {
    onSave(withComputedFields(draft));
  };

  return (
    <div className="detail-panel-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-panel-header">
          <div>
            <div className="detail-panel-company">{draft.company_name}</div>
            <div className="detail-panel-sub">
              {draft.country} · {draft.region} · {draft.type}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="detail-panel-summary">
          <div className="detail-panel-total">{Math.round(totalScore * 10) / 10}점 / 75</div>
          <TierChip grade={displayGrade} />
        </div>

        <div className="detail-panel-section">
          <div className="detail-panel-section-title">1차 필터링 결과</div>
          <div className="detail-panel-row">
            <span className={`chip ${draft.screening_status === "제외" ? "chip-slate" : "chip-teal"}`}>
              1차 필터 {draft.screening_status}
            </span>
            <span className="detail-panel-scored-note">
              {draft.scored ? "→ 5개 기준 채점 완료" : "→ 아직 채점 전"}
            </span>
          </div>
          {draft.screening_reason && (
            <div className="callout callout-warning">필터 제외 사유: {draft.screening_reason}</div>
          )}
        </div>

        <div className="detail-panel-section">
          <div className="detail-panel-section-title">업체 정보</div>
          <div className="detail-panel-row">{draft.business_scope}</div>
          <div className="detail-panel-row">설립 {draft.founded} · 모회사/외국계 {draft.parent_company}</div>
          <div className="detail-panel-row">
            <a href={draft.website} target="_blank" rel="noreferrer">{draft.website}</a>
          </div>
          <div className="detail-panel-row detail-panel-source">출처: {draft.source}</div>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const items = CRITERIA.filter((c) => c.category === cat);
          const subtotal = computeCategorySubtotal(draft, cat);
          return (
            <div key={cat} className="detail-panel-section">
              <div className="detail-panel-section-title">
                {CATEGORIES[cat].label} ({Math.round(subtotal * 10) / 10} / {CATEGORIES[cat].weight}점)
              </div>
              {items.map((c) => (
                <div key={c.key} className="score-row">
                  <div className="score-row-label">
                    <span>{c.label}</span>
                    <span className="score-row-badges">
                      <span className="badge badge-weight">{c.weight}점</span>
                      <span className={`badge badge-phase-${c.phase === "1차" ? "one" : "two"}`}>{c.phase}</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={draft.scores[c.key]}
                    onChange={updateScore(c.key)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={draft.scores[c.key]}
                    onChange={updateScore(c.key)}
                  />
                  {draft.basis?.[c.key] && (
                    <div className="score-row-basis">판단 근거: {draft.basis[c.key]}</div>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {draft.scored && (draft.warning || draft.expected) && (
          <div className="detail-panel-section">
            <div className="detail-panel-section-title">판정 주의사항</div>
            {draft.warning && <div className="callout callout-warning">{draft.warning}</div>}
            {draft.expected && <div className="callout callout-info">2차 확인 후 예상 변동: {draft.expected}</div>}
          </div>
        )}

        {draft.action && (
          <div className="detail-panel-section">
            <div className="detail-panel-section-title">검증 실행 액션</div>
            <div className="action-row"><span className="action-label">포털 조회</span>{draft.action.portal_check}</div>
            <div className="action-row"><span className="action-label">협회 확인</span>{draft.action.association_check}</div>
            <div className="action-row"><span className="action-label">업체 직접 문의</span>{draft.action.direct_contact}</div>
            <div className="action-row"><span className="action-label">연락처</span>{draft.action.association_contact}</div>
          </div>
        )}

        <div className="detail-panel-section">
          <div className="detail-panel-section-title">컨택 상태</div>
          <select
            value={draft.contact_status}
            onChange={(e) => setDraft({ ...draft, contact_status: e.target.value })}
          >
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="detail-panel-section">
          <div className="detail-panel-section-title">비고</div>
          <textarea
            rows={3}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </div>

        <div className="detail-panel-actions">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
