import { useState } from "react";
import { isEmail } from "../../utils/localize";

// 업체명 매칭용 정규화 — 소문자화 + 영숫자·한글만 남긴다.
function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

export default function BulkPastePanel({ partners, onApply, onClose }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const apply = () => {
    const entries = {};
    const missed = [];
    let applied = 0;

    text.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      const parts = line
        .split(/\t|[,;]/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length === 0) return;

      // 이메일은 줄 안 어디에 있든 뽑아낸다 ("Name <a@b.com>" 형태 포함).
      let email = "";
      for (let i = 0; i < parts.length; i += 1) {
        const m = parts[i].match(/[^\s<>()"']+@[^\s<>()"',;]+/);
        if (m && isEmail(m[0])) {
          email = m[0];
          parts.splice(i, 1);
          break;
        }
      }
      if (!email) {
        missed.push(line.trim().slice(0, 40));
        return;
      }

      const key = norm(parts[0] || "");
      // 후보가 정확히 1개일 때만 적용한다 — 애매한 줄은 사용자가 직접 고치게 남긴다.
      const hits = key
        ? partners.filter((p) => {
            const n = norm(p.company_name);
            return n === key || n.includes(key) || key.includes(n);
          })
        : [];
      if (hits.length !== 1) {
        missed.push(line.trim().slice(0, 40));
        return;
      }

      const patch = { email };
      if (parts[1]) patch.person = parts[1];
      entries[hits[0].id] = { ...entries[hits[0].id], ...patch };
      applied += 1;
    });

    if (applied > 0) onApply(entries);
    setResult({ applied, missed });
  };

  return (
    <div className="mx-bulk">
      <p>
        업체명과 이메일을 한 줄에 하나씩 붙여넣으세요. 구분자는 <b>탭·쉼표·세미콜론</b> 모두 됩니다.
        업체명은 일부만 적어도 찾아갑니다 (예: <b>Edwincon, eet@edwincon.com.my</b>). 담당자까지 넣으려면{" "}
        <b>업체명, 이메일, 담당자</b> 순서로 적으세요.
      </p>
      <textarea
        autoFocus
        spellCheck="false"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Edwincon, eet@edwincon.com.my, Mr. Tan\niCents, enquiry@icentsgroup.com"}
      />
      <div className="mx-btn-row" style={{ marginTop: 9 }}>
        <button type="button" className="mx-btn mx-btn-sm" onClick={onClose}>
          닫기
        </button>
        <button type="button" className="mx-btn mx-btn-sm mx-btn-primary" onClick={apply}>
          붙여넣기 적용
        </button>
      </div>
      {result && (
        <p className="mx-hint">
          {result.applied}개 적용됨
          {result.missed.length > 0 && (
            <>
              {" · "}못 찾은 줄 {result.missed.length}개: {result.missed.slice(0, 4).join(" / ")}
              {result.missed.length > 4 ? " 외" : ""} — 업체명 철자를 표와 맞추거나 이메일 형식을
              확인해주세요
            </>
          )}
        </p>
      )}
    </div>
  );
}
