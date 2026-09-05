import { getApiUrl } from "../api/endpoint";

/*
  Apps Script 웹앱 POST 호출 공통부.
  메일 발송과 시트 쓰기가 같은 엔드포인트를 쓰므로 요청·오류 해석을 한 곳에 둔다.
*/

export async function postToAppsScript(payload) {
  let res;
  try {
    res = await fetch(getApiUrl(), {
      method: "POST",
      // text/plain이어야 CORS 프리플라이트가 걸리지 않는다.
      // Apps Script는 OPTIONS 요청에 응답하지 못해서 application/json으로 보내면 막힌다.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch {
    // CORS 차단도, 스크립트가 예외로 죽어 HTML 오류 페이지를 돌려준 경우도 모두 여기로 떨어진다.
    return {
      ok: false,
      code: "network",
      message:
        "서버에 연결하지 못했습니다. ① Apps Script에서 권한을 승인한 뒤 '배포 > 배포 관리 > 편집 > 버전 새 버전'으로 다시 배포했는지 (권한 승인만으로는 기존 배포에 적용되지 않습니다) ② 최신 Code.gs를 붙여넣었는지 ③ 액세스 권한이 '모든 사용자', 실행 계정이 '나'인지 확인해주세요.",
    };
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, ...diagnoseHtml(text) };
  }
}

// JSON이 아닌 응답이 오는 경우는 대부분 배포 상태 문제다. 원인을 구분해서 알려준다.
function diagnoseHtml(text) {
  if (/Script function not found|함수를 찾을 수 없습니다/i.test(text)) {
    return {
      code: "no_dopost",
      message:
        "배포된 스크립트에 해당 기능이 없습니다. apps-script/Code.gs의 최신 내용을 붙여넣고, 배포 > 배포 관리 > 편집 > 버전 '새 버전'으로 다시 배포해주세요.",
    };
  }
  if (/accounts\.google\.com|ServiceLogin|로그인/i.test(text)) {
    return {
      code: "not_public",
      message:
        "서버가 로그인을 요구하고 있습니다. Apps Script 배포 설정에서 '액세스 권한'을 '모든 사용자'로 바꾸고 새 버전으로 다시 배포해주세요.",
    };
  }
  return {
    code: "bad_response",
    message:
      "서버가 JSON 대신 다른 응답을 돌려줬습니다. Apps Script 배포 상태(실행 계정 '나', 액세스 권한 '모든 사용자')를 확인하고 새 버전으로 다시 배포해주세요.",
  };
}
