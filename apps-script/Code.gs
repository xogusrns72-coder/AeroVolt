/**
 * AeroVolt × 패브릭덕트 대시보드 — Google Sheets 연동용 Apps Script
 *
 * 이 스크립트를 "동남아_공조업체_리스트"를 변환한 구글 시트의
 * 확장 프로그램 > Apps Script 에 붙여넣고 웹 앱으로 배포한다.
 *
 * "업체리스트" 탭에서 국가/회사명/유형/웹사이트 등 기본정보만 읽어서 반환한다.
 * 점수·컨택상태·비고는 대시보드 안에서만 관리되므로 이 스크립트는 쓰기(doPost)는 하지 않는다.
 */

var SHEET_NAME = "업체리스트";

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

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

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

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
