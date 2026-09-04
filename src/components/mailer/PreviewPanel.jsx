import { fillTemplate } from "../../utils/localize";

// 행별 템플릿을 지정했다면 그 업체에 실제로 적용될 템플릿으로 미리 보여준다.
export default function PreviewPanel({ rows, partner, previewId, onChange, contacts, template }) {
  const contact = (partner && contacts[partner.id]) || {};

  return (
    <div className="mx-panel">
      <div className="mx-ph">
        <span>미리보기</span>
        <select
          className="mx-sel"
          value={previewId}
          onChange={(e) => onChange(e.target.value)}
          aria-label="미리보기 업체"
        >
          {rows.length === 0 ? (
            <option value="">선택된 업체 없음</option>
          ) : (
            rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.company_name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="mx-prev">
        {partner && template ? (
          <>
            <div className="mx-prev-meta">
              To: {contact.email || "(메일 주소 없음)"} · 템플릿 {template.no}. {template.name}
            </div>
            <div className="mx-prev-s">{fillTemplate(template.subject, partner, contact)}</div>
            <div className="mx-prev-b">{fillTemplate(template.body, partner, contact)}</div>
          </>
        ) : (
          <div className="mx-prev-b">발송 대상을 선택하면 치환 결과가 표시됩니다.</div>
        )}
      </div>
    </div>
  );
}
