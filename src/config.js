// 데이터 소스 전환 스위치
// "mock"   → src/data/mockPartners.json 내장 샘플 데이터 사용 (지금 기본값)
// "sheets" → 아래 SHEETS_API_URL(Apps Script Web App)에 연결 (나중에 전환)
export const DATA_SOURCE = "sheets";

// Google Apps Script Web App 배포 후 발급되는 URL을 여기에 넣는다.
// 예: "https://script.google.com/macros/s/AKfycb.../exec"
// 지금은 비워둔다 — DATA_SOURCE가 "sheets"로 바뀔 때만 사용된다.
export const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxVOHkPLYfz64Jmi12ArRZa4KqtILWKWqCXv1SLprw0r6asHLr_vmco2PzOkLBj5Glj/exec";
