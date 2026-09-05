import { postToAppsScript } from "./appsScript";

/*
  표에서 고친 연락처를 구글 시트로 되돌려 쓴다.

  기본 흐름은 시트 → 대시보드 단방향이고, 표에서 고친 값은 그 브라우저에만 남는다.
  그래서 팀이 공유해야 할 주소는 시트에 직접 적어야 했는데, 이 기능이 그 왕복을 없앤다.

  시트 값과 다른 항목만 골라 보낸다. 값이 같으면 요청 자체를 만들지 않는다.
*/

const EMAIL_COLUMN = "이메일";
const PERSON_COLUMN = "담당자";

/** 시트 값과 화면 값이 다른 항목만 추린다. */
export function collectSheetEdits(partners, contacts) {
  const edits = [];
  partners.forEach((p) => {
    const c = contacts[p.id] || {};
    const email = String(c.email ?? "").trim();
    const person = String(c.person ?? "").trim();
    const sheetEmail = String(p.sheet_email || "").trim();
    const sheetPerson = String(p.sheet_person || "").trim();

    if (email !== sheetEmail) {
      edits.push({ company: p.company_name, country: p.country, column: EMAIL_COLUMN, value: email, _label: `${p.company_name} · 이메일`, _before: sheetEmail, _after: email });
    }
    if (person !== sheetPerson) {
      edits.push({ company: p.company_name, country: p.country, column: PERSON_COLUMN, value: person, _label: `${p.company_name} · 담당자`, _before: sheetPerson, _after: person });
    }
  });
  return edits;
}

/** 내부 표시용 필드(_로 시작)는 서버로 보내지 않는다. */
function clean(edits) {
  return edits.map((e) => ({ company: e.company, country: e.country, column: e.column, value: e.value }));
}

/*
  쓰기 기능이 없는 예전 배포에 요청하면, 스크립트가 이 action을 몰라 발송 경로로 빠져
  "발송 키가 맞지 않습니다"라는 엉뚱한 답을 준다. 그대로 보여주면 원인을 못 찾으므로
  시트 쓰기 맥락에 맞는 문구로 바꾼다.
*/
function explain(res) {
  if (res.ok) return res;
  if (res.code === "bad_key" || res.code === "not_configured") {
    return {
      ...res,
      code: "needs_deploy",
      message:
        "배포된 Apps Script에 시트 쓰기 기능이 없습니다. apps-script/Code.gs의 최신 내용을 붙여넣고 '배포 > 배포 관리 > 편집 > 버전 새 버전'으로 다시 배포해주세요. (배포 확인: 웹앱 주소 뒤에 ?action=version)",
    };
  }
  return res;
}

export async function previewSheetEdits(edits) {
  return explain(await postToAppsScript({ action: "updateCells", dryRun: true, edits: clean(edits) }));
}

export async function applySheetEdits(edits) {
  return explain(await postToAppsScript({ action: "updateCells", edits: clean(edits) }));
}
