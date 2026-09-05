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

/**
 * 배포된 코드가 최신인지 즉시 확인하기 위한 표식.
 * 브라우저에서 웹앱 URL 뒤에 ?action=version 을 붙여 열면 이 값이 보인다.
 * 편집기에서 코드를 고쳐도 "새 버전"으로 배포하지 않으면 옛 값이 그대로 나온다.
 */
var SCRIPT_VERSION = "2026-09-05-edit-open";

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

/*
  연락처 열 — 메일 발송 화면이 이 값을 초기값으로 쓴다.

  헤더 이름으로 먼저 찾고(아래 후보 중 아무거나), 못 찾으면 M열(13번째)을 본다.
  다만 M열을 쓸 때는 실제로 이메일처럼 생긴 값이 있는지 확인한 뒤에만 채택한다 —
  헤더 없이 엉뚱한 열을 이메일로 읽어들이는 사고를 막기 위해서다.
*/
var EMAIL_HEADERS = ["이메일", "메일", "이메일 주소", "메일주소", "email", "e-mail", "mail"];
var PERSON_HEADERS = ["담당자", "담당자명", "담당자 이름", "contact", "contact person"];
var EMAIL_FALLBACK_COL = 12; // 0부터 세어 12 = M열

function findColumn(headers, candidates) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").trim().toLowerCase();
    if (!h) continue;
    for (var c = 0; c < candidates.length; c++) {
      if (h === candidates[c].toLowerCase()) return i;
    }
  }
  return -1;
}

function looksLikeEmailColumn(data, headerRowIndex, col) {
  var checked = 0;
  for (var r = headerRowIndex + 1; r < data.length && checked < 20; r++) {
    var v = String((data[r] || [])[col] || "").trim();
    if (!v) continue;
    checked++;
    if (v.indexOf("@") !== -1) return true;
  }
  return false;
}

/** 한 번의 요청으로 처리할 수 있는 최대 메일 수 (Apps Script 실행 시간 6분 제한 대비) */
var MAX_BATCH = 20;

/* ── 최초 1회 설정 ─────────────────────────────────────────────── */

/**
 * 발송 키와 보내는 사람 정보를 스크립트 속성에 저장한다.
 * 값을 고친 뒤 편집기에서 이 함수를 한 번만 실행하면 된다.
 */
/** 아래 SEND_KEY를 이 값에서 바꾸지 않으면 저장하지 않는다 (실수로 예시가 키가 되는 것 방지) */
var SEND_KEY_PLACEHOLDER = "여기에-아무도-모를-키를-적으세요";

function setUpMailer() {
  // ↓ 이 값을 원하는 발송 키로 바꾸세요. 대시보드에 똑같이 입력합니다.
  var sendKey = "여기에-아무도-모를-키를-적으세요";

  // ↓ 시트 수정용 키. 발송 키와 따로 둔다 — 이 키가 새어나가도 메일은 못 보낸다.
  //   시트를 외부에서 고칠 일이 없으면 빈 문자열로 두세요(수정 기능이 잠깁니다).
  var editKey = "";

  var senderName = "";   // 보내는 사람 표시 이름 (비우면 Gmail 기본값)
  var replyTo = "";      // 회신 받을 주소 (비우면 Gmail 계정 주소)
  var dailyCap = "0";    // 하루 발송 상한 (0 = Gmail 자체 할당량만 적용)

  var props = PropertiesService.getScriptProperties();
  var lines = [];

  // 값을 안 고친 채로 실행하면 예시 문자열이 키가 돼버려서, 대시보드에서 계속
  // "발송 키가 맞지 않습니다"가 뜬다. 그래서 안 고쳤으면 기존 키를 그대로 둔다.
  if (sendKey === SEND_KEY_PLACEHOLDER) {
    var existing = props.getProperty("SEND_KEY");
    lines.push("[건너뜀] SEND_KEY를 아직 고치지 않아 저장하지 않았습니다.");
    lines.push(
      existing
        ? "현재 저장된 발송 키: " + existing + "   ← 대시보드에 이 값을 그대로 입력하세요"
        : "저장된 발송 키가 없습니다. 위 sendKey 값을 고치고 다시 실행하세요."
    );
  } else {
    props.setProperty("SEND_KEY", sendKey);
    lines.push("[OK] 발송 키를 저장했습니다: " + sendKey);
  }

  props.setProperties({ SENDER_NAME: senderName, REPLY_TO: replyTo, DAILY_CAP: dailyCap });

  if (editKey) {
    props.setProperty("EDIT_KEY", editKey);
    lines.push("[OK] 시트 수정 키를 저장했습니다: " + editKey);
  } else {
    var existingEdit = props.getProperty("EDIT_KEY");
    lines.push(
      existingEdit
        ? "[유지] 시트 수정 키: " + existingEdit
        : "[꺼짐] 시트 수정 키가 없습니다 — 외부에서 시트를 고칠 수 없습니다(기본값)."
    );
  }

  // 여기서 Gmail을 한 번 건드려야 승인 창에 "Gmail 관련 권한"이 포함된다.
  // (속성 저장만 하면 구글이 메일 권한을 아예 요청하지 않아서, 나중에 웹앱이 죽는다)
  try {
    lines.push("[OK] 오늘 남은 Gmail 발송 할당량: " + MailApp.getRemainingDailyQuota() + "건");
  } catch (err) {
    lines.push("[참고] 할당량 조회 실패 — " + (err && err.message ? err.message : err));
    lines.push("       할당량은 참고용이라 이게 실패해도 발송 자체는 됩니다.");
  }

  lines.push("코드를 고쳤다면 배포 > 배포 관리 > 편집(연필) > 버전 '새 버전' > 배포 를 하세요.");
  lines.push("(발송 키만 바꿨다면 재배포 없이 즉시 적용됩니다)");

  Logger.log(lines.join("\n"));
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

  lines.push(
    "[주의] 이 결과는 '편집기에서 실행할 때'의 권한 기준입니다. 배포된 웹앱은 별도로," +
      " 배포 버전을 만들 당시의 권한으로 실행됩니다. 권한을 방금 승인했다면" +
      " 배포 > 배포 관리 > 편집 > 버전 '새 버전' > 배포 를 한 번 해주세요."
  );

  var out = lines.join("\n");
  Logger.log(out);
  return out;
}

/* ── 읽기 (대시보드 업체 목록) ─────────────────────────────────── */

function doGet(e) {
  // ?action=version → 배포 반영 여부 확인용. 업체 목록 응답 형식에는 영향을 주지 않는다.
  if (e && e.parameter && e.parameter.action === "version") {
    return jsonOutput({ version: SCRIPT_VERSION, sheet: SHEET_NAME });
  }

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

  var emailCol = findColumn(headers, EMAIL_HEADERS);
  if (emailCol === -1 && looksLikeEmailColumn(data, headerRowIndex, EMAIL_FALLBACK_COL)) {
    emailCol = EMAIL_FALLBACK_COL;
  }
  var personCol = findColumn(headers, PERSON_HEADERS);

  var rows = [];

  for (var r = headerRowIndex + 1; r < data.length; r++) {
    var row = data[r];
    if (companyNameCol === undefined || !row[companyNameCol]) continue; // 빈 행 건너뛰기

    var record = {};
    Object.keys(FIELD_MAP).forEach(function (key) {
      var col = colIndex[FIELD_MAP[key]];
      record[key] = col !== undefined && row[col] !== "" ? String(row[col]).trim() : "-";
    });

    // 연락처는 비어 있는 게 정상이므로 "-" 대신 빈 문자열로 둔다.
    record.email = emailCol === -1 ? "" : String(row[emailCol] || "").trim();
    record.person = personCol === -1 ? "" : String(row[personCol] || "").trim();

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
/**
 * 회사명으로 행을 찾아 지정한 열의 값을 고친다.
 *
 * 요청 형식:
 *   { action:"updateCells", key:"<EDIT_KEY>", dryRun:true,
 *     edits:[ { company:"Edwincon Engineering", country:"말레이시아",
 *               column:"이메일", value:"eet@edwincon.com.my" } ] }
 *
 * 안전장치
 *  - 회사명·국가 열은 고칠 수 없다. 이 둘이 점수 데이터와의 매칭 키라서 바꾸면 점수가 끊긴다.
 *  - 행 번호가 아니라 회사명(정규화)으로 찾고, 후보가 정확히 1개일 때만 고친다.
 *  - dryRun:true 면 쓰지 않고 무엇이 바뀔지만 돌려준다.
 *  - 행 추가·삭제는 하지 않는다. 되돌리려면 구글 시트의 버전 기록을 쓰면 된다.
 */
/**
 * 시트 수정에 키를 요구하지 않으려면 true.
 *
 * ⚠️ 이 웹앱 URL은 "모든 사용자" 접근이어야 브라우저에서 호출되고, 주소가 공개 저장소와
 *    사이트 번들에 그대로 들어 있습니다. true로 두면 URL을 아는 누구나 이 시트의 값을
 *    고칠 수 있습니다.
 *
 *    작업할 때만 true로 두고 끝나면 false로 되돌리는 것을 권합니다.
 *    false면 EDIT_KEY를 요구하고, EDIT_KEY도 비어 있으면 수정 기능 자체가 잠깁니다.
 *    어떤 경우에도 회사명·국가 열은 고칠 수 없고, 행 추가·삭제도 하지 않습니다.
 *    잘못 바뀌었다면 구글 시트의 파일 > 버전 기록에서 되돌릴 수 있습니다.
 */
var ALLOW_EDIT_WITHOUT_KEY = true;

var LOCKED_COLUMNS = ["국가", "회사명"];
var MAX_EDITS = 200;

function normalizeName(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function updateCells(req) {
  var edits = req.edits || [];
  if (!edits.length) return { ok: false, code: "bad_request", message: "수정할 내용이 없습니다." };
  if (edits.length > MAX_EDITS) {
    return { ok: false, code: "too_many", message: "한 번에 " + MAX_EDITS + "건까지만 처리합니다." };
  }

  var sheet;
  try {
    sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  } catch (err) {
    return { ok: false, code: "sheet_error", message: String(err && err.message ? err.message : err) };
  }
  if (!sheet) return { ok: false, code: "sheet_error", message: "'" + SHEET_NAME + "' 시트를 찾을 수 없습니다." };

  var data = sheet.getDataRange().getValues();

  var headerRowIndex = -1;
  for (var i = 0; i < data.length; i++) {
    if (data[i].indexOf("회사명") !== -1) { headerRowIndex = i; break; }
  }
  if (headerRowIndex === -1) return { ok: false, code: "sheet_error", message: "헤더 행을 찾지 못했습니다." };

  var headers = data[headerRowIndex];
  var nameCol = headers.indexOf("회사명");
  var countryCol = headers.indexOf("국가");

  var results = [];
  var applied = 0;

  for (var k = 0; k < edits.length; k++) {
    var ed = edits[k] || {};

    if (LOCKED_COLUMNS.indexOf(String(ed.column || "").trim()) !== -1) {
      results.push({ company: ed.company, column: ed.column, ok: false, message: "이 열은 수정할 수 없습니다(점수 매칭 키)." });
      continue;
    }

    var col = findColumn(headers, [String(ed.column || "")]);
    if (col === -1) {
      results.push({ company: ed.company, column: ed.column, ok: false, message: "그런 이름의 열이 없습니다." });
      continue;
    }

    // 회사명 정규화 매칭. 국가가 함께 오면 그것도 맞아야 한다.
    var key = normalizeName(ed.company);
    var hits = [];
    for (var r = headerRowIndex + 1; r < data.length; r++) {
      if (!data[r][nameCol]) continue;
      var n = normalizeName(data[r][nameCol]);
      if (!key || (n !== key && n.indexOf(key) === -1 && key.indexOf(n) === -1)) continue;
      if (ed.country && countryCol !== -1 && String(data[r][countryCol]).trim() !== String(ed.country).trim()) continue;
      hits.push(r);
    }

    if (hits.length !== 1) {
      results.push({
        company: ed.company, column: ed.column, ok: false,
        message: hits.length === 0 ? "일치하는 업체를 찾지 못했습니다." : hits.length + "개 업체가 걸려 모호합니다.",
      });
      continue;
    }

    var row = hits[0];
    var before = String(data[row][col] || "");
    var after = String(ed.value == null ? "" : ed.value);

    if (before === after) {
      results.push({ company: String(data[row][nameCol]), column: ed.column, ok: true, skipped: true, message: "이미 같은 값입니다." });
      continue;
    }

    if (!req.dryRun) {
      sheet.getRange(row + 1, col + 1).setValue(after);
      applied++;
    }
    results.push({ company: String(data[row][nameCol]), row: row + 1, column: ed.column, before: before, after: after, ok: true });
  }

  return { ok: true, dryRun: !!req.dryRun, applied: applied, results: results };
}

/*
  doPost 안에서 예외가 나면 Apps Script는 CORS 헤더가 없는 HTML 오류 페이지를 돌려준다.
  그러면 브라우저에는 이유 없이 "연결 실패"로만 보인다. 그래서 전체를 감싸서 무슨 일이
  있어도 JSON으로 답하게 한다.
*/
function doPost(e) {
  try {
    return handlePost(e);
  } catch (err) {
    return jsonOutput({
      ok: false,
      code: "script_error",
      message: "스크립트 실행 중 오류: " + (err && err.message ? err.message : err),
    });
  }
}

function handlePost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return jsonOutput({ ok: false, code: "bad_request", message: "요청 본문을 읽지 못했습니다." });
  }

  var props = PropertiesService.getScriptProperties();

  // 시트 수정은 메일 발송과 다른 키를 쓴다. 수정 키가 새어나가도 메일은 못 보내게 분리한다.
  var isEdit = req.action === "updateCells";

  // 수정 개방 모드 — 키 검사를 건너뛴다. 발송(send/draft/ping)에는 적용되지 않는다.
  if (isEdit && ALLOW_EDIT_WITHOUT_KEY) return jsonOutput(updateCells(req));

  var keyName = isEdit ? "EDIT_KEY" : "SEND_KEY";
  var expected = props.getProperty(keyName);

  if (!expected) {
    return jsonOutput({
      ok: false,
      code: "not_configured",
      message:
        keyName + "가 설정되지 않았습니다. Apps Script 편집기에서 setUpMailer()를 한 번 실행하세요.",
    });
  }
  if (String(req.key || "") !== String(expected)) {
    return jsonOutput({ ok: false, code: "bad_key", message: keyName + "가 맞지 않습니다." });
  }

  if (isEdit) return jsonOutput(updateCells(req));

  if (req.action === "ping") {
    var gmail = readGmailState();
    return jsonOutput({
      ok: true,
      sender: gmail.sender,
      senderName: props.getProperty("SENDER_NAME") || "",
      replyTo: props.getProperty("REPLY_TO") || "",
      remaining: gmail.remaining,
      quotaError: gmail.quotaError,
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

/**
 * Gmail 권한이 이 "배포 버전"에 실제로 적용됐는지 확인한다.
 *
 * 편집기에서 권한을 승인해도 이미 만들어진 배포 버전은 예전 권한으로 실행된다.
 * 그래서 승인 직후에는 Gmail 호출이 예외로 죽는다 — 반드시 새 버전으로 다시 배포해야 한다.
 */
/**
 * 발신 주소와 남은 할당량을 "가능한 만큼만" 읽는다.
 *
 * 둘 다 참고용이라 실패해도 발송을 막지 않는다. 특히 할당량 조회(MailApp)는
 * script.send_mail 권한을 따로 요구하는데, 실제 발송(GmailApp)은 mail.google.com 권한만
 * 있으면 된다. 참고 정보 하나 때문에 발송 전체가 막히면 안 된다.
 */
function readGmailState() {
  var state = { ok: true, sender: "", remaining: null, quotaError: "" };

  try {
    state.sender = getSenderAddress() || "";
  } catch (err) {
    state.sender = "";
  }

  try {
    state.remaining = MailApp.getRemainingDailyQuota();
  } catch (err) {
    state.remaining = null;
    state.quotaError = String(err && err.message ? err.message : err);
  }

  return state;
}

function deliver(action, messages, props) {
  var isSend = action === "send";

  var gmail = readGmailState();
  var senderName = props.getProperty("SENDER_NAME") || "";
  var replyTo = props.getProperty("REPLY_TO") || "";
  var dailyCap = Number(props.getProperty("DAILY_CAP") || 0);

  // 실제 발송만 할당량을 소모한다. 초안은 Gmail 발송 할당량과 무관하다.
  // 할당량을 못 읽는 경우(권한 범위 미포함)에는 사전 검사를 건너뛰고 바로 시도한다 —
  // 실패하면 건별 결과에 그대로 남는다.
  if (isSend && gmail.remaining !== null) {
    var remaining = gmail.remaining;
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

  // 발송 후 상태도 "읽을 수 있으면 읽는다" — 여기서 예외가 나서 결과를 잃으면 안 된다.
  var after = readGmailState();

  return {
    ok: true,
    action: action,
    results: results,
    sender: after.sender,
    remaining: after.remaining,
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
