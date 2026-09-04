import { getApiUrl } from "../api/endpoint";
import { ENABLE_MAIL_SENDING } from "../config";

/*
  Apps Script 웹앱을 통한 실제 발송.

  아티팩트가 아닌 일반 웹(GitHub Pages 등)에는 메일을 보낼 수단이 없다. 그래서 이미 업체
  목록을 읽어오고 있는 Apps Script에 doPost를 붙여 그 스크립트 소유자의 Gmail로 실제
  발송한다. 브라우저 → Apps Script → Gmail 순으로 나가므로 별도 서버가 필요 없다.

  주의 — 이 웹앱 URL을 아는 사람은 누구나 호출할 수 있다. 그래서 발송에는 발송 키를
  요구하고, 키는 번들에 넣지 않고 사용자가 화면에서 입력해 이 브라우저에만 저장한다.
*/

const SEND_KEY_LS = "aerovolt.outreach.sendkey";

/** 한 번의 요청에 담는 메일 수. Apps Script 호출 왕복 비용과 진행률 표시 사이의 절충. */
export const MAIL_BATCH_SIZE = 5;

export function isMailApiConfigured() {
  return ENABLE_MAIL_SENDING && getApiUrl().length > 0;
}

export function loadSendKey() {
  try {
    return localStorage.getItem(SEND_KEY_LS) || "";
  } catch {
    return "";
  }
}

export function saveSendKey(key) {
  try {
    if (key) localStorage.setItem(SEND_KEY_LS, key);
    else localStorage.removeItem(SEND_KEY_LS);
  } catch {
    /* 시크릿 창 등 저장이 막힌 환경 — 이번 세션에서만 쓰고 만다 */
  }
}

async function callMailApi(payload) {
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
    // CORS 차단도, 스크립트가 예외로 죽어 HTML 오류 페이지를 돌려준 경우도 모두 여기로 떨어진다
    // (브라우저가 이유를 구분해주지 않는다).
    // 실제로 가장 많이 겪은 원인은 ①번이다 — 권한을 나중에 승인하면 이미 만들어진 배포 버전은
    // 예전 권한으로 실행돼서, Gmail을 건드리는 순간 죽는다.
    return {
      ok: false,
      code: "network",
      message:
        "발송 서버에 연결하지 못했습니다. ① Apps Script에서 권한을 승인한 뒤 '배포 > 배포 관리 > 편집 > 버전 새 버전'으로 다시 배포했는지 (권한 승인만으로는 기존 배포에 적용되지 않습니다) ② 최신 Code.gs를 붙여넣었는지 ③ 액세스 권한이 '모든 사용자', 실행 계정이 '나'인지 확인해주세요.",
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
        "배포된 스크립트에 발송 기능(doPost)이 없습니다. apps-script/Code.gs의 최신 내용을 Apps Script 편집기에 붙여넣고, 배포 > 배포 관리 > 편집 > 버전 '새 버전'으로 다시 배포해주세요.",
    };
  }
  if (/accounts\.google\.com|ServiceLogin|로그인/i.test(text)) {
    return {
      code: "not_public",
      message:
        "발송 서버가 로그인을 요구하고 있습니다. Apps Script 배포 설정에서 '액세스 권한'을 '모든 사용자'로 바꾸고 새 버전으로 다시 배포해주세요.",
    };
  }
  return {
    code: "bad_response",
    message:
      "발송 서버가 JSON 대신 다른 응답을 돌려줬습니다. Apps Script 배포 상태(실행 계정 '나', 액세스 권한 '모든 사용자')를 확인하고 새 버전으로 다시 배포해주세요.",
  };
}

/** 연결·키·할당량 확인. 발송 전에 한 번 눌러보게 한다. */
export function pingMailApi(key) {
  return callMailApi({ action: "ping", key });
}

/**
 * 메일 묶음 발송. mode는 "send"(실제 발송) 또는 "draft"(초안 생성).
 * 응답의 results는 요청한 messages와 같은 id를 달고 돌아온다.
 */
export function sendMailBatch(key, mode, messages) {
  return callMailApi({ action: mode, key, messages });
}
