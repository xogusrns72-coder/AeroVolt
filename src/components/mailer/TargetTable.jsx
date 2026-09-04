import { memo, useCallback, useEffect, useRef, useState } from "react";
import TierChip from "../TierChip";
import { isEmail } from "../../utils/localize";

const SENT_CHIP = {
  sent: { cls: "mx-c-sent", label: "발송" },
  draft: { cls: "mx-c-draft", label: "초안" },
  fail: { cls: "mx-c-fail", label: "실패" },
};

/*
  입력 필드는 각 행이 들고 있는 로컬 draft state다.
  상위 상태(자동 저장·서버 병합·필터 재계산)가 아무리 자주 바뀌어도 타이핑 중인 값에는
  손대지 않는다. 외부에서 값이 실제로 바뀐 경우(일괄 붙여넣기 등)에만 syncKey를 올려
  저장된 값으로 다시 맞춘다.
*/
const TargetRow = memo(function TargetRow({
  partner,
  contact,
  sentRecord,
  selected,
  templates,
  syncKey,
  sheetEmail,
  sheetPerson,
  onToggle,
  onChange,
  onCommit,
  onEnter,
}) {
  const storedEmail = contact.email || "";
  const storedPerson = contact.person || "";
  const [email, setEmail] = useState(storedEmail);
  const [person, setPerson] = useState(storedPerson);
  const [flash, setFlash] = useState("");
  const flashTimer = useRef(null);

  useEffect(() => {
    setEmail(storedEmail);
    setPerson(storedPerson);
    // syncKey가 오르거나 시트 값이 바뀔 때만 저장값으로 되맞춘다.
    // (타이핑은 시트 값을 바꾸지 않으므로 입력 중에는 실행되지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, sheetEmail, sheetPerson]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const flashField = (field) => {
    setFlash(field);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 1000);
  };

  const handleKeyDown = (field) => (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onCommit();
    flashField(field);
    onEnter(e.currentTarget, field);
  };

  const chip = SENT_CHIP[sentRecord?.status];
  const emailClass = email
    ? isEmail(email)
      ? "mx-in mx-in-ok"
      : "mx-in mx-in-warn"
    : "mx-in";

  return (
    <tr className={selected ? "mx-row-sel" : ""}>
      <td>
        <input
          type="checkbox"
          className="mx-cb"
          checked={selected}
          onChange={() => onToggle(partner.id)}
          aria-label={`${partner.company_name} 선택`}
        />
      </td>
      <td>
        <div className="mx-name">
          <a href={partner.website} target="_blank" rel="noopener noreferrer">
            {partner.company_name}
          </a>
          <div className="mx-sub">
            {partner.country} · {partner.region}
          </div>
        </div>
      </td>
      <td>
        <TierChip grade={partner.display_grade} />
      </td>
      <td className="mx-score">{Number(partner.total_score || 0).toFixed(1)}</td>
      <td>
        <input
          className={`${emailClass}${flash === "email" ? " mx-in-flash" : ""}`}
          data-field="email"
          value={email}
          placeholder="name@company.com"
          inputMode="email"
          spellCheck="false"
          onChange={(e) => {
            setEmail(e.target.value);
            onChange(partner.id, { email: e.target.value });
          }}
          onKeyDown={handleKeyDown("email")}
        />
      </td>
      <td>
        <input
          className={`mx-in${flash === "person" ? " mx-in-flash" : ""}`}
          data-field="person"
          value={person}
          placeholder="Mr. / Ms. 이름"
          onChange={(e) => {
            setPerson(e.target.value);
            onChange(partner.id, { person: e.target.value });
          }}
          onKeyDown={handleKeyDown("person")}
        />
      </td>
      <td>
        <select
          className="mx-rowsel"
          value={contact.templateId || ""}
          onChange={(e) => onChange(partner.id, { templateId: e.target.value })}
          aria-label={`${partner.company_name} 템플릿`}
        >
          <option value="">현재 선택</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.no}. {t.name}
            </option>
          ))}
        </select>
      </td>
      <td>{chip ? <span className={`mx-chip ${chip.cls}`}>{chip.label}</span> : "—"}</td>
    </tr>
  );
});

const EMPTY_CONTACT = {};

export default function TargetTable({
  rows,
  contacts,
  sent,
  selected,
  templates,
  syncKey,
  onToggle,
  onChange,
  onCommit,
  onTypingChange,
}) {
  const bodyRef = useRef(null);

  // 엔터 = 저장 + 다음 행의 같은 칸으로 이동. 주소→엔터→주소→엔터로 마우스 없이 이어서 입력한다.
  const handleEnter = useCallback((node, field) => {
    const list = Array.from(bodyRef.current?.querySelectorAll(`input[data-field="${field}"]`) || []);
    const next = list[list.indexOf(node) + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      node.blur();
    }
  }, []);

  if (rows.length === 0) {
    return (
      <div className="mx-tablewrap">
        <div className="mx-empty">조건에 맞는 업체가 없습니다. 등급이나 최소 점수를 낮춰보세요.</div>
      </div>
    );
  }

  return (
    <div className="mx-tablewrap">
      <table className="mx-table">
        <thead>
          <tr>
            <th style={{ width: 32 }} />
            <th style={{ minWidth: 210 }}>업체명</th>
            <th style={{ width: 60 }}>등급</th>
            <th style={{ width: 58, textAlign: "right" }}>총점</th>
            <th style={{ width: 196 }}>이메일</th>
            <th style={{ width: 126 }}>담당자</th>
            <th style={{ width: 118 }}>템플릿</th>
            <th style={{ width: 70 }}>발송</th>
          </tr>
        </thead>
        <tbody
          ref={bodyRef}
          onFocus={(e) => {
            if (e.target.tagName === "INPUT" && e.target.type !== "checkbox") onTypingChange(true);
          }}
          onBlur={(e) => {
            if (e.target.tagName === "INPUT" && e.target.type !== "checkbox") onTypingChange(false);
          }}
        >
          {rows.map((p) => (
            <TargetRow
              key={p.id}
              partner={p}
              contact={contacts[p.id] || EMPTY_CONTACT}
              sentRecord={sent[p.id]}
              selected={!!selected[p.id]}
              templates={templates}
              syncKey={syncKey}
              sheetEmail={p.sheet_email || ""}
              sheetPerson={p.sheet_person || ""}
              onToggle={onToggle}
              onChange={onChange}
              onCommit={onCommit}
              onEnter={handleEnter}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
