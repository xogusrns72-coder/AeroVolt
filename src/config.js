// 데이터 소스 전환 스위치
// "mock"   → src/data/mockPartners.json 내장 샘플 데이터 사용
// "sheets" → 아래 SHEETS_API_URL(Apps Script Web App)에 연결 (지금 기본값)
export const DATA_SOURCE = "sheets";

// Apps Script를 "웹 앱"으로 배포하면 나오는 URL. 업체 목록 조회(doGet)와 메일 발송(doPost)이
// 이 주소 하나를 같이 쓴다. 반드시 /exec로 끝나야 한다 (/dev는 본인만 접근 가능).
//
// 배포를 다시 하면 URL이 바뀐다 — "배포 관리 > 편집 > 새 버전"은 URL이 유지되고,
// "새 배포"는 항상 새 URL이 발급된다. URL이 바뀌면 이 값을 고치거나, 화면 상단 연결 배너의
// "주소 바꾸기"에 붙여넣으면 된다(그쪽은 그 브라우저에만 저장된다).
//
// ※ Apps Script의 "라이브러리" URL(.../macros/library/d/...)은 여기에 넣으면 안 된다.
//    다른 스크립트가 이 코드를 함수로 가져다 쓸 때 필요한 주소일 뿐, 웹 요청을 받지 못한다.
export const SHEETS_API_URL =
  "https://script.google.com/macros/s/AKfycbx0ugTdhinHIvFcCoxjHC-bIaKqtrY_FaVO3HmRdbLn8OzSJSmN-xAfLAqsOm5Mp-hi/exec";

// 메일 발송(doPost) 사용 여부. false로 두면 발송 버튼이 사라지고 CSV 경로만 남는다.
export const ENABLE_MAIL_SENDING = true;
