/**
 * AeroVolt × 패브릭덕트 대시보드 — Google Sheets 연동 + 메일 발송용 Apps Script
 *
 * 이 스크립트를 "동남아_공조업체_리스트"를 변환한 구글 시트의
 * 확장 프로그램 > Apps Script 에 붙여넣고 웹 앱으로 배포한다.
 *
 *  doGet  — "업체리스트" 탭에서 국가/회사명/유형/웹사이트 등 기본정보를 읽어 반환한다.
 *  doPost — 대시보드의 "메일 발송" 모달에서 넘어온 메일을 이 스크립트 소유자의
 *           Gmail 계정으로 실제 발송하거나 초안으로 만든다.
 *
 * 점수·컨택상태·비고는 대시보드 안에서만 관리되므로 시트에 쓰지는 않는다.
 *
 * ── 배포 전에 반드시 할 일 ──────────────────────────────────────────
 * 이 웹 앱 URL을 아는 사람은 누구나 doPost를 호출할 수 있다. 그래서 발송에는
 * 발송 키를 요구한다. Apps Script 편집기에서 아래를 한 번 실행해 키를 정한다.
 *
 *   1) setUpMailer() 안의 값을 원하는 값으로 고친 뒤 한 번 실행
 *   2) 실행하면 권한 승인 창이 뜬다 — 본인 계정으로 승인
 *   3) 배포 > 배포 관리 > 편집(연필) > 버전 "새 버전" > 배포
 *      (같은 URL이 유지된다. 새로 "배포"하면 URL이 바뀌므로 주의)
 *   4) 대시보드 발송 패널에 같은 키를 입력
 *
 * 키는 코드에 남기지 말고 스크립트 속성에만 저장한다.
 * ────────────────────────────────────────────────────────────────
 */

var SHEET_NAME = "업체리스트";

/**
 * 읽어올 스프레드시트 ID.
 *
 * 비워두면 이 스크립트가 붙어 있는 시트를 씁니다(시트 > 확장 프로그램 > Apps Script로 만든 경우).
 *
 * 학교·회사 계정에서는 관리자 정책 때문에 웹 앱 배포에 "모든 사용자" 옵션이 아예 안 뜨는
 * 경우가 있습니다. 그럴 때는 개인 Gmail 계정에서 **독립 실행형 스크립트**를 새로 만들고
 * (script.google.com > 새 프로젝트), 팀 시트를 그 개인 계정에 공유한 뒤 여기에 시트 ID를
 * 적으면 됩니다. 시트 주소에서 가져옵니다:
 *   https://docs.google.com/spreadsheets/d/[여기가 ID]/edit
 * 읽기만 하므로 공유 권한은 "뷰어"로 충분합니다.
 */
var SPREADSHEET_ID = "";

function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      "시트를 찾을 수 없습니다. 독립 실행형 스크립트라면 SPREADSHEET_ID에 시트 ID를 적어주세요."
    );
  }
  return active;
}

var FIELD_MAP = {
  country: "국가",
  company_name: "회사명",
  region: "본사 위치",
  type: "유형",
  business_scope: "주요 사업영역",
  founded: "설립",
  parent_company: "모회사 / 외국계",
  website: "웹사이트",
};

/** 한 번의 요청으로 처리할 수 있는 최대 메일 수 (Apps Script 실행 시간 6분 제한 대비) */
var MAX_BATCH = 20;

/* ── 최초 1회 설정 ─────────────────────────────────────────────── */

/**
 * 발송 키와 보내는 사람 정보를 스크립트 속성에 저장한다.
 * 값을 고친 뒤 편집기에서 이 함수를 한 번만 실행하면 된다.
 */
function setUpMailer() {
  PropertiesService.getScriptProperties().setProperties({
    SEND_KEY: "여기에-아무도-모를-키를-적으세요",  // 대시보드에 입력할 발송 키
    SENDER_NAME: "",       // 보내는 사람 표시 이름 (비우면 Gmail 기본값)
    REPLY_TO: "",          // 회신 받을 주소 (비우면 Gmail 계정 주소)
    DAILY_CAP: "0",        // 하루 발송 상한 (0 = Gmail 자체 할당량만 적용)
  });
  Logger.log("설정 완료. 배포 > 배포 관리에서 새 버전으로 다시 배포하세요.");
}

/**
 * 설정이 제대로 됐는지 편집기에서 바로 확인한다.
 * 이 함수를 실행하고 하단 "실행 로그"를 보면 시트·키·발송계정·할당량을 한 번에 알 수 있다.
 */
function checkSetup() {
  var lines = [];

  try {
    var sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
    lines.push(
      sheet
        ? "[OK] 시트 '" + SHEET_NAME + "' 읽기 가능 (" + sheet.getLastRow() + "행)"
        : "[실패] '" + SHEET_NAME + "' 탭이 없습니다. 탭 이름을 확인하세요."
    );
  } catch (err) {
    lines.push("[실패] 시트 접근 불가 — " + (err && err.message ? err.message : err));
  }

  var key = PropertiesService.getScriptProperties().getProperty("SEND_KEY");
  lines.push(key ? "[OK] 발송 키 설정됨 (" + String(key).length + "자)" : "[실패] 발송 키 없음 — setUpMailer()를 실행하세요.");

  try {
    lines.push("[정보] 발송 계정: " + Session.getEffectiveUser().getEmail());
    lines.push("[정보] 오늘 남은 Gmail 발송 할당량: " + MailApp.getRemainingDailyQuota() + "건");
  } catch (err) {
    lines.push("[실패] Gmail 권한 없음 — setUpMailer()를 실행해 권한을 승인하세요.");
  }

  var out = lines.join("\n");
  Logger.log(out);
  return out;
}

/* ── 읽기 (대시보드 업체 목록) ─────────────────────────────────── */

function doGet(e) {
  var sheet;
  try {
    sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  } catch (err) {
    return jsonOutput({ error: String(err && err.message ? err.message : err) });
  }

  if (!sheet) {
    return jsonOutput({ error: "'" + SHEET_NAME + "' 시트를 찾을 수 없습니다. 탭 이름을 확인하세요." });
  }

  var data = sheet.getDataRange().getValues();

  // 헤더 행을 자동으로 찾는다("회사명" 셀이 있는 행). 원본 파일처럼 위에 제목 행이
  // 있어도 상관없다.
  var headerRowIndex = -1;
  for (var i = 0; i < data.length; i++) {
    if (data[i].indexOf("회사명") !== -1) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return jsonOutput({ error: "헤더 행('회사명' 포함)을 찾지 못했습니다." });
  }

  var headers = data[headerRowIndex];
  var colIndex = {};
  headers.forEach(function (h, idx) {
    colIndex[String(h).trim()] = idx;
  });

  var companyNameCol = colIndex[FIELD_MAP.company_name];
  var rows = [];

  for (var r = headerRowIndex + 1; r < data.length; r++) {
    var row = data[r];
    if (companyNameCol === undefined || !row[companyNameCol]) continue; // 빈 행 건너뛰기

    var record = {};
    Object.keys(FIELD_MAP).forEach(function (key) {
      var col = colIndex[FIELD_MAP[key]];
      record[key] = col !== undefined && row[col] !== "" ? String(row[col]) : "-";
    });
    rows.push(record);
  }

  return jsonOutput(rows);
}

/* ── 발송 ──────────────────────────────────────────────────────── */

/**
 * 대시보드에서 넘어오는 요청.
 *
 *   { action: "ping",  key }
 *   { action: "send",  key, messages: [{ id, to, subject, body, htmlBody }] }
 *   { action: "draft", key, messages: [...] }
 *
 * 응답은 항상 JSON이며, 부분 실패를 알 수 있도록 메일별 결과를 함께 돌려준다.
 * Content-Type을 text/plain으로 보내야 브라우저가 CORS 프리플라이트를 걸지 않는다.
 */
function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return jsonOutput({ ok: false, code: "bad_request", message: "요청 본문을 읽지 못했습니다." });
  }

  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty("SEND_KEY");

  if (!expected) {
    return jsonOutput({
      ok: false,
      code: "not_configured",
      message: "스크립트에 발송 키가 설정되지 않았습니다. Apps Script 편집기에서 setUpMailer()를 한 번 실행하세요.",
    });
  }
  if (String(req.key || "") !== String(expected)) {
    return jsonOutput({ ok: false, code: "bad_key", message: "발송 키가 맞지 않습니다." });
  }

  if (req.action === "ping") {
    return jsonOutput({
      ok: true,
      sender: getSenderAddress(),
      senderName: props.getProperty("SENDER_NAME") || "",
      replyTo: props.getProperty("REPLY_TO") || "",
      remaining: MailApp.getRemainingDailyQuota(),
      sentToday: getSentToday(),
      dailyCap: Number(props.getProperty("DAILY_CAP") || 0),
    });
  }

  if (req.action !== "send" && req.action !== "draft") {
    return jsonOutput({ ok: false, code: "bad_request", message: "알 수 없는 action: " + req.action });
  }

  var messages = req.messages || [];
  if (!messages.length) {
    return jsonOutput({ ok: false, code: "bad_request", message: "보낼 메일이 없습니다." });
  }
  if (messages.length > MAX_BATCH) {
    return jsonOutput({
      ok: false,
      code: "too_many",
      message: "한 번에 " + MAX_BATCH + "건까지만 처리합니다.",
    });
  }

  return jsonOutput(deliver(req.action, messages, props));
}

function deliver(action, messages, props) {
  var isSend = action === "send";
  var senderName = props.getProperty("SENDER_NAME") || "";
  var replyTo = props.getProperty("REPLY_TO") || "";
  var dailyCap = Number(props.getProperty("DAILY_CAP") || 0);

  // 실제 발송만 할당량을 소모한다. 초안은 Gmail 발송 할당량과 무관하다.
  if (isSend) {
    var remaining = MailApp.getRemainingDailyQuota();
    if (remaining < messages.length) {
      return {
        ok: false,
        code: "quota_exceeded",
        message: "오늘 남은 Gmail 발송 할당량이 " + remaining + "건입니다. 내일 다시 실행해주세요.",
        remaining: remaining,
      };
    }
    if (dailyCap > 0 && getSentToday() + messages.length > dailyCap) {
      return {
        ok: false,
        code: "cap_exceeded",
        message: "스크립트에 설정한 하루 상한(" + dailyCap + "건)을 넘습니다. 오늘 " + getSentToday() + "건 보냈습니다.",
      };
    }
  }

  var results = [];
  var sentCount = 0;

  for (var i = 0; i < messages.length; i++) {
    var m = messages[i] || {};
    var to = String(m.to || "").trim();

    if (!isValidEmail(to)) {
      results.push({ id: m.id, ok: false, code: "bad_address", message: "메일 주소 형식이 아닙니다: " + to });
      continue;
    }

    var options = { htmlBody: m.htmlBody || undefined };
    if (senderName) options.name = senderName;
    if (replyTo) options.replyTo = replyTo;

    try {
      if (isSend) {
        GmailApp.sendEmail(to, String(m.subject || ""), String(m.body || ""), options);
        sentCount++;
      } else {
        GmailApp.createDraft(to, String(m.subject || ""), String(m.body || ""), options);
      }
      results.push({ id: m.id, ok: true });
    } catch (err) {
      results.push({ id: m.id, ok: false, code: "gmail_error", message: String(err && err.message ? err.message : err) });
    }
  }

  if (sentCount > 0) addSentToday(sentCount);

  return {
    ok: true,
    action: action,
    results: results,
    sender: getSenderAddress(),
    remaining: MailApp.getRemainingDailyQuota(),
    sentToday: getSentToday(),
  };
}

function getSenderAddress() {
  // 스크립트 소유자 계정. 웹 앱을 "나로 실행"으로 배포했을 때 이 주소로 나간다.
  return Session.getEffectiveUser().getEmail();
}

function todayKey() {
  return "SENT_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
}

function getSentToday() {
  return Number(PropertiesService.getScriptProperties().getProperty(todayKey()) || 0);
}

function addSentToday(n) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(todayKey(), String(getSentToday() + n));
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
