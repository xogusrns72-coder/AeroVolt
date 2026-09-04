import { SHEETS_API_URL } from "../config";

/*
  Apps Script 웹앱 주소를 한 곳에서 정한다. 업체 목록 조회(doGet)와 메일 발송(doPost)이
  같은 배포를 쓰므로 주소도 하나만 관리한다.

  배포를 다시 하면 URL이 바뀌는데(특히 "새 배포"를 누르면 항상 바뀐다), 그때마다 코드를 고쳐
  다시 빌드·푸시하는 건 번거롭다. 그래서 화면에서 새 주소를 붙여넣으면 이 브라우저에 저장해
  코드 기본값 대신 쓰도록 했다. 확정된 주소는 src/config.js에도 반영해두면 다른 기기에서도
  바로 동작한다.
*/

const LS_KEY = "aerovolt.apiUrl";

function readOverride() {
  try {
    return localStorage.getItem(LS_KEY) || "";
  } catch {
    return "";
  }
}

export function getApiUrl() {
  return readOverride() || SHEETS_API_URL || "";
}

export function isApiUrlOverridden() {
  return readOverride().length > 0;
}

/** 화면에서 붙여넣은 주소를 저장한다. 빈 값이면 코드 기본값으로 되돌린다. */
export function setApiUrl(url) {
  const trimmed = String(url || "").trim();
  try {
    if (trimmed) localStorage.setItem(LS_KEY, trimmed);
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* 저장이 막힌 환경이면 이번 세션에서만 쓰고 만다 */
  }
}

/** 배포 URL 형태인지 가볍게 확인 — /exec로 끝나지 않는 실수가 잦다. */
export function checkApiUrl(url) {
  const v = String(url || "").trim();
  if (!v) return "주소를 입력해주세요.";
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(v)) {
    return "https://script.google.com/macros/s/.../exec 형태여야 합니다. 마지막이 /exec인지, /dev가 아닌지 확인해주세요.";
  }
  return "";
}
