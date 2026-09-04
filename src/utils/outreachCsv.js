import { countryEn, regionEn, typeEn } from "./localize";

const HEADER = [
  "이메일", "상호", "담당자", "국가", "지역", "유형",
  "등급", "총점", "국가(한글)", "맞춤문구", "발송상태", "발송일시",
];

const GRADE_CSV_LABEL = { PENDING: "미채점", EXCLUDED: "제외" };

function cell(value) {
  const v = String(value == null ? "" : value);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function sentLabel(status) {
  if (status === "sent") return "발송";
  if (status === "draft") return "초안";
  if (status === "fail") return "실패";
  return "";
}

function stamp(at) {
  if (!at) return "";
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 이 CSV를 구글시트에 붙여 Apps Script 메일머지로 보내면 시트 값이 그대로 메일에 들어간다.
// 그래서 국가·지역·유형은 반드시 영문으로 내보내고, 한글 국가명은 사람이 훑어볼 참고 열로만 남긴다.
export function buildCsv(rows, { contacts = {}, sent = {} } = {}) {
  const lines = [HEADER.join(",")];
  rows.forEach((p) => {
    const c = contacts[p.id] || {};
    const s = sent[p.id] || {};
    lines.push(
      [
        String(c.email || "").trim(),
        p.company_name,
        String(c.person || "").trim() || "Sir or Madam",
        countryEn(p.country),
        regionEn(p.region, p.country),
        typeEn(p.type),
        GRADE_CSV_LABEL[p.display_grade] || p.display_grade,
        Number(p.total_score || 0).toFixed(1),
        p.country,
        "",
        sentLabel(s.status),
        stamp(s.at),
      ]
        .map(cell)
        .join(",")
    );
  });
  // UTF-8 BOM — 없으면 엑셀·구글시트에서 한글이 깨진다. 줄바꿈은 CRLF.
  return `\uFEFF${lines.join("\r\n")}`;
}

export function csvFilename() {
  return `발송대상_${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* 아래 폴백으로 넘어간다 */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

// 저장 경로는 환경에 따라 세 가지다.
// ① 아티팩트(downloads capability) ② 일반 브라우저(Blob 다운로드) ③ 둘 다 안 되면 클립보드.
export async function saveCsv(text, filename) {
  if (typeof window !== "undefined" && typeof window.claude?.use === "function") {
    try {
      const downloads = await window.claude.use("downloads");
      if (downloads) {
        try {
          await downloads.save({ filename, data: text });
          return { ok: true, how: "download" };
        } catch (e) {
          if (e?.code === "declined") return { ok: false, how: "declined" };
        }
      }
    } catch {
      /* 폴백으로 넘어간다 */
    }
  }
  try {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, how: "download" };
  } catch {
    const copied = await copyText(text);
    return { ok: copied, how: copied ? "clipboard" : "failed" };
  }
}
