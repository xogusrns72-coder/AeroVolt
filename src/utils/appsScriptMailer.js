import { getApiUrl } from "../api/endpoint";
import { postToAppsScript } from "./appsScript";
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

const callMailApi = postToAppsScript;

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
