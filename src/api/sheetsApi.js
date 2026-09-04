import { getApiUrl } from "./endpoint";
import scoreSeed from "../data/mockPartners.json";

// "sheets" 모드: 업체 기본정보(국가·업체명·유형·웹사이트 등)는 Google Sheets에서 실시간으로
// 가져오고, 검증 점수·컨택 상태·비고는 지금(mock 모드)과 동일하게 대시보드 안에서만 관리한다.
// → 시트에는 쓰지 않는다(updatePartner는 mock 모드처럼 아무 동작도 하지 않음).
//
// 이미 채점을 마친 119개사는 src/data/mockPartners.json에 들어있는 점수·근거·판정 데이터를
// "시드"로 그대로 재사용한다(업체명+국가로 매칭). 시트에 새로 추가된 업체는 시드에 없으므로
// 미채점 상태(0점)로 시작해서 상세 패널에서 바로 채점할 수 있다.

// 실패했을 때 "무엇을 확인해야 하는지"까지 알려준다 — 배포를 다시 하면 가장 자주 깨지는 지점이다.
function connectionError(reason) {
  const err = new Error(reason);
  err.isConnectionError = true;
  return err;
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
    // 시트 M열(또는 "이메일" 헤더) 값 — 발송 화면의 초기값으로 쓴다.
    sheet_email: row.email || "",
    sheet_person: row.person || "",
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
    sheet_email: row.email || "",
    sheet_person: row.person || "",
  };
}

// Apps Script doGet(e) → "업체리스트" 시트를 12개 컬럼 그대로 JSON 배열로 반환한다고 가정.
// 응답 형식: [{ country, company_name, region, type, business_scope, founded, parent_company, website }, ...]
export async function fetchPartners() {
  const url = getApiUrl();
  if (!url) {
    throw connectionError(
      "Apps Script 웹앱 주소가 설정되지 않았습니다. 배포 URL(/exec)을 입력해주세요."
    );
  }

  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch {
    // 네트워크 오류와 CORS 차단이 모두 여기로 떨어진다(브라우저가 이유를 구분해주지 않는다).
    throw connectionError(
      "웹앱에 연결하지 못했습니다. 배포가 삭제됐거나 URL이 바뀌었거나, 액세스 권한이 '모든 사용자'가 아닐 수 있습니다."
    );
  }

  if (!res.ok) {
    throw connectionError(`웹앱이 ${res.status} 오류를 돌려줬습니다. 배포 상태를 확인해주세요.`);
  }

  const text = await res.text();
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    // 로그인 페이지나 스크립트 오류 페이지가 HTML로 돌아오는 경우.
    throw connectionError(
      /accounts\.google\.com|ServiceLogin/i.test(text)
        ? "웹앱이 로그인을 요구하고 있습니다. 배포 설정에서 액세스 권한을 '모든 사용자'로 바꿔주세요."
        : "웹앱이 JSON 대신 오류 페이지를 돌려줬습니다. Apps Script 편집기에서 doGet 실행 오류가 없는지 확인해주세요."
    );
  }

  if (rows && rows.error) throw connectionError(rows.error);
  if (!Array.isArray(rows)) {
    throw connectionError("웹앱 응답이 업체 목록 배열이 아닙니다. 시트 탭 이름('업체리스트')을 확인해주세요.");
  }

  return rows.map(mergeRow);
}

// 이 모드에서는 점수·컨택상태·비고를 시트에 쓰지 않는다 — mock 모드와 동일하게
// App의 React state 갱신만으로 저장이 끝난다.
export async function updatePartner(_updatedPartner) {
  return { ok: true };
}
