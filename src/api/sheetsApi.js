import { SHEETS_API_URL } from "../config";
import scoreSeed from "../data/mockPartners.json";

// "sheets" 모드: 업체 기본정보(국가·업체명·유형·웹사이트 등)는 Google Sheets에서 실시간으로
// 가져오고, 검증 점수·컨택 상태·비고는 지금(mock 모드)과 동일하게 대시보드 안에서만 관리한다.
// → 시트에는 쓰지 않는다(updatePartner는 mock 모드처럼 아무 동작도 하지 않음).
//
// 이미 채점을 마친 119개사는 src/data/mockPartners.json에 들어있는 점수·근거·판정 데이터를
// "시드"로 그대로 재사용한다(업체명+국가로 매칭). 시트에 새로 추가된 업체는 시드에 없으므로
// 미채점 상태(0점)로 시작해서 상세 패널에서 바로 채점할 수 있다.

function assertConfigured() {
  if (!SHEETS_API_URL) {
    throw new Error(
      "SHEETS_API_URL이 설정되지 않았습니다. src/config.js에서 Apps Script Web App URL을 입력하세요."
    );
  }
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.,()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findSeed(companyName, country) {
  const pool = scoreSeed.filter((s) => s.country === country);
  let hit = pool.find((s) => norm(s.company_name) === norm(companyName));
  if (hit) return hit;
  hit = pool.find(
    (s) => norm(s.company_name).includes(norm(companyName)) || norm(companyName).includes(norm(s.company_name))
  );
  return hit;
}

const EMPTY_SCORES = {
  gov_grade: 0, registration_validity: 0, financial_health: 0, completed_references: 0, performance_bond: 0,
  duct_expertise: 0, fabric_duct_experience: 0, qualified_technicians: 0, airflow_measurement: 0, drawing_bim: 0,
};

// 원본 필터 규칙과 동일: 유형에 "시공"이 포함되면 통과, 아니면 제외.
function buildFresh(row, idx) {
  const isConstruction = String(row.type || "").includes("시공");
  const screening_status = isConstruction ? "통과" : "제외";
  const screening_reason = isConstruction ? "" : "유형에 '시공' 미포함 (유통/제조 전용)";
  return {
    id: `S${String(idx + 1).padStart(3, "0")}`,
    rank: null,
    company_name: row.company_name,
    country: row.country,
    region: row.region,
    type: row.type,
    business_scope: row.business_scope,
    founded: row.founded,
    parent_company: row.parent_company,
    website: row.website,
    screening_status,
    screening_reason,
    scored: false,
    source: "Google Sheets 실시간 연동 · 신규 업체(시드에 없음) — 아직 채점 전",
    scores: { ...EMPTY_SCORES },
    basis: {},
    action: null,
    warning: isConstruction ? "" : `필터 제외 사유: ${screening_reason}`,
    expected: "",
    contact_status: "미컨택",
    note: "",
  };
}

function mergeRow(row, idx) {
  const seed = findSeed(row.company_name, row.country);
  if (!seed) return buildFresh(row, idx);
  return {
    ...seed,
    id: `S${String(idx + 1).padStart(3, "0")}`,
    // 기본정보는 시트가 최신 소스이므로 시트 값으로 덮어쓴다(사용자가 시트에서 고쳤을 수 있음).
    company_name: row.company_name,
    country: row.country,
    region: row.region,
    type: row.type,
    business_scope: row.business_scope,
    founded: row.founded,
    parent_company: row.parent_company,
    website: row.website,
  };
}

// Apps Script doGet(e) → "업체리스트" 시트를 12개 컬럼 그대로 JSON 배열로 반환한다고 가정.
// 응답 형식: [{ country, company_name, region, type, business_scope, founded, parent_company, website }, ...]
export async function fetchPartners() {
  assertConfigured();
  const res = await fetch(SHEETS_API_URL, { method: "GET" });
  if (!res.ok) throw new Error(`시트 데이터 조회 실패: ${res.status}`);
  const rows = await res.json();
  return rows.map(mergeRow);
}

// 이 모드에서는 점수·컨택상태·비고를 시트에 쓰지 않는다 — mock 모드와 동일하게
// App의 React state 갱신만으로 저장이 끝난다.
export async function updatePartner(_updatedPartner) {
  return { ok: true };
}
