/*
  2차 항목 데스크 추정 채점

  2차 5개 항목(34점)은 원래 업체에서 자료를 받아야 확인되는 항목이라 119개사 전부 0점이었다.
  전부 비워두면 등급이 1차 점수만으로 갈리는데, 그렇다고 근거 없이 숫자를 채우면 심사표가
  거짓이 된다. 그래서 "지금 가진 텍스트에서 실제로 읽어낼 수 있는 신호"만 규칙으로 만들고,
  점수마다 왜 그 점수인지를 근거로 남긴다.

  원칙
  - 추정으로 만점(5)을 주지 않는다. 항목마다 상한을 둔다.
  - 근거를 못 찾으면 0으로 두고 "무엇을 확인해야 하는지"를 근거에 적는다.
  - 모든 근거 문구는 [추정]으로 시작한다. 실사로 확인된 값과 섞이지 않게.
  - 이미 점수가 있는 항목(1차 5개)은 건드리지 않는다.

  실행: node scripts/score-phase2.mjs [--write]
*/

import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../src/data/mockPartners.json", import.meta.url);
const partners = JSON.parse(readFileSync(FILE, "utf8"));
const write = process.argv.includes("--write");

const text = (p) => [p.business_scope, p.parent_company, p.company_name, p.founded].join(" ");
const has = (p, re) => re.test(text(p));

/** 설립연도를 뽑아 업력(년)을 계산한다. "1998 (현지)" 같은 표기 대응. */
function yearsInBusiness(p) {
  const m = String(p.founded || "").match(/(19|20)\d{2}/);
  return m ? 2026 - Number(m[0]) : null;
}

const LISTED = /HOSE:|SET:|PSE:|SGX:|Bursa|상장/;
const GLOBAL_PARENT = /\((일본|스웨덴|미국|독일|대만|스페인|이탈리아|프랑스|영국|중국)[,)]|일본\)|스웨덴\)|미국\)|독일\)|대만\)/;

/* ── 항목별 규칙 ──────────────────────────────────────────────
   각 규칙은 [점수, 근거] 를 돌려준다. 위에서부터 먼저 걸리는 규칙을 쓴다.
─────────────────────────────────────────────────────────────── */

const RULES = {
  // ③ 재무 건전성 (가중치 8) — 상한 4. 감사 재무제표 확인 전에는 만점 불가.
  financial_health: [
    [(p) => LISTED.test(text(p)), 4, "상장사로 재무 공시 의무가 있어 매출·부채비율을 외부에서 검증할 수 있음"],
    [(p) => (p.parent_company || "-") !== "-" && GLOBAL_PARENT.test(p.parent_company || ""), 3, "해외 본사를 둔 현지법인 — 그룹 재무 신용에 기대어 자금 조달 가능"],
    [(p) => (p.parent_company || "-") !== "-", 2, "모회사·그룹 보유 — 단독 중소기업보다 자금 여력 있음"],
    [(p) => (yearsInBusiness(p) || 0) >= 20, 2, "업력 20년 이상 — 장기간 사업을 유지해온 점을 간접 지표로 봄"],
    [(p) => (yearsInBusiness(p) || 0) >= 10, 1, "업력 10년 이상"],
  ],

  // ⑤ Performance Bond (가중치 6) — 상한 3. 실제 보증 한도는 계약 협상에서만 확인 가능.
  performance_bond: [
    [(p) => has(p, /EPC|턴키|일괄|원청|BOO/) && has(p, /발전소|공항|인프라|데이터센터|지역냉방|반도체|웨이퍼|플랜트/), 3, "대형 산업·인프라 프로젝트를 원청/턴키로 수행 — 이행보증을 요구받는 계약 경험이 있음"],
    [(p) => has(p, /EPC|턴키|일괄|원청|BOO/), 2, "EPC·턴키 일괄 수행 명시 — 이행보증이 통상 수반되는 계약 형태"],
    [(p) => has(p, /발전소|공항|인프라|데이터센터|지역냉방|반도체|웨이퍼|클린룸/), 1, "대형 산업 프로젝트 참여 실적"],
  ],

  // ⑧ 유자격 기술인력 (가중치 6) — 상한 4. 자격증 보유 명부 확인 전에는 만점 불가.
  qualified_technicians: [
    [(p) => has(p, /ISO 14644|GMP|밸리데이션|인증/), 4, "클린룸 밸리데이션·인증 업무 수행 — 규격 검증에는 유자격 기술인력이 필수"],
    [(p) => has(p, /설계|엔지니어링/) && has(p, /제조|공장|생산|제작/), 3, "자체 설계와 제조를 함께 수행 — 엔지니어링 조직을 갖춘 것으로 판단"],
    [(p) => has(p, /설계|엔지니어링|EPC|턴키/), 2, "설계·엔지니어링 자체 수행 명시"],
    [(p) => has(p, /정비|유지보수|서비스|AS/), 1, "설치·정비 서비스 조직 보유"],
  ],

  // ⑨ 풍량·정압 측정 역량 (가중치 6) — 상한 4. 장비 보유·측정 성적서 확인 전에는 만점 불가.
  airflow_measurement: [
    [(p) => has(p, /밸런싱|balanc|TAB\b/i), 4, "시험·밸런싱(TAB)을 서비스로 명시 — 풍량·정압 측정 장비와 절차를 갖춤"],
    [(p) => has(p, /시운전|커미셔닝|commissioning/i), 3, "시운전(커미셔닝) 수행 — 인계 전 풍량·정압 확인 절차를 포함"],
    [(p) => has(p, /밸리데이션|ISO 14644|GMP/), 3, "클린룸 밸리데이션 수행 — 차압·기류 측정이 필수 과정"],
    [(p) => has(p, /시험|측정|제어|BMS|BAS|모니터링/), 1, "계측·제어 역량 언급 — 측정 장비 보유 여부는 직접 확인 필요"],
  ],
};

// ② 등록증 유효성·위반이력 — 채점하지 않는다.
// ①(감독기관 등록 등급)과 근거가 겹쳐 이중계산이 되고, 위반이력은 각국 등록부(싱가포르 BCA,
// 말레이시아 CIDB, 필리핀 PCAB 등)를 조회해야만 알 수 있다. 추정으로 채우면 안 되는 항목.
const NOT_SCORED = {
  registration_validity:
    "미채점 — 등록증 사본과 각국 등록부(BCA·CIDB·PCAB) 조회가 필요합니다. 웹 정보로는 판단 불가.",
};

/* ── 적용 ─────────────────────────────────────────────────────── */

const stats = {};
let changed = 0;

for (const p of partners) {
  // 1차 필터에서 제외된 곳(유형에 '시공' 미포함)은 채점하지 않는다.
  // 점수를 주면 총점이 0을 넘어 "제외"가 아니라 A~D로 표시돼 필터 결과가 무너진다.
  if (p.screening_status === "제외") continue;

  p.scores = p.scores || {};
  p.basis = p.basis || {};

  for (const [key, rules] of Object.entries(RULES)) {
    if ((p.scores[key] || 0) > 0) continue; // 이미 채점된 항목은 손대지 않는다

    let score = 0;
    let why = "근거를 찾지 못했습니다 — 업체에 자료를 요청해 확인이 필요합니다.";
    for (const [test, value, reason] of rules) {
      if (test(p)) { score = value; why = reason; break; }
    }

    p.scores[key] = score;
    p.basis[key] = `[추정] ${why}`;
    stats[key] = stats[key] || {};
    stats[key][score] = (stats[key][score] || 0) + 1;
    changed++;
  }

  for (const [key, note] of Object.entries(NOT_SCORED)) {
    if ((p.scores[key] || 0) > 0) continue;
    p.scores[key] = 0;
    p.basis[key] = `[추정] ${note}`;
  }
}

/* ── 결과 요약 ────────────────────────────────────────────────── */

const CRIT = [
  ["gov_grade", 10], ["registration_validity", 8], ["financial_health", 8],
  ["completed_references", 8], ["performance_bond", 6], ["duct_expertise", 10],
  ["fabric_duct_experience", 8], ["qualified_technicians", 6],
  ["airflow_measurement", 6], ["drawing_bim", 5],
];
const r1 = (n) => Math.round(n * 10) / 10;
const total = (p) => r1(CRIT.reduce((s, [k, w]) => s + ((Number(p.scores?.[k]) || 0) / 5) * w, 0));
const grade = (t, p) => (t === 0 ? (p.screening_status === "제외" ? "EXCLUDED" : "PENDING") : t >= 24 ? "A" : t >= 15 ? "B" : t >= 8 ? "C" : "D");

console.log(`채점한 칸: ${changed}\n`);
for (const [key, dist] of Object.entries(stats)) {
  const line = Object.entries(dist).sort((a, b) => b[0] - a[0]).map(([s, n]) => `${s}점 ${n}곳`).join(" · ");
  console.log(`  ${key.padEnd(24)} ${line}`);
}

const dist = {};
let max = 0;
partners.forEach((p) => {
  const t = total(p);
  max = Math.max(max, t);
  const g = grade(t, p);
  dist[g] = (dist[g] || 0) + 1;
});
console.log(`\n현재 임계값(A24/B15/C8) 기준 등급: ${JSON.stringify(dist)}`);
console.log(`최고점: ${max} / 75`);

/*
  임계값 재조정 제안.

  기존 임계값은 "2차 항목이 전부 비어 있던" 1차 전용 분포에 맞춰 잡은 값이다.
  2차를 채우면 총점이 전반적으로 올라가서 그대로 두면 A가 과하게 늘어난다.
  원래 잡았던 비율(상위 11% / 43% / 39% / 7%)을 새 분포에 다시 적용한 값을 제안한다.
*/
const scored = partners.filter((p) => p.screening_status !== "제외").map(total).sort((a, b) => b - a);
const at = (ratio) => scored[Math.min(scored.length - 1, Math.round(scored.length * ratio))];
const proposed = { A: at(0.11), B: at(0.54), C: at(0.93) };
console.log(`\n채점 대상 ${scored.length}개사 · 최고 ${scored[0]} / 최저 ${scored[scored.length - 1]}`);
console.log(`임계값 재조정 제안: A ≥ ${proposed.A} · B ≥ ${proposed.B} · C ≥ ${proposed.C}`);

const dist2 = {};
partners.forEach((p) => {
  const t = total(p);
  const g = p.screening_status === "제외" ? "EXCLUDED"
    : t >= proposed.A ? "A" : t >= proposed.B ? "B" : t >= proposed.C ? "C" : t > 0 ? "D" : "PENDING";
  dist2[g] = (dist2[g] || 0) + 1;
});
console.log(`재조정 시 등급: ${JSON.stringify(dist2)}`);
console.log(`  → A·B 합계: ${(dist2.A || 0) + (dist2.B || 0)}개사`);

if (write) {
  writeFileSync(FILE, JSON.stringify(partners, null, 2) + "\n", "utf8");
  console.log("\n→ mockPartners.json 저장 완료");
} else {
  console.log("\n(미리보기입니다. 반영하려면 --write)");
}
