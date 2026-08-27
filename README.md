# AeroVolt × 패브릭덕트

동남아시아 HVAC 시공업체를 발굴·검증하고, 검증 워크북 기준으로 채점·등급화해서
컨택 우선순위를 정하는 대시보드입니다. 2026 아임인부산 임팩트 해커톤 팀 AeroVolt,
담당 기업 패브릭덕트를 위해 만들었습니다.

## 실행 방법

```bash
npm install
npm run dev
```

## 데이터 소스

`src/config.js`의 `DATA_SOURCE`로 전환합니다.

- `"mock"` — 내장 샘플 데이터(오프라인에서도 동작)
- `"sheets"` — Google Sheets(업체 기본정보)를 실시간으로 불러와서, 이미 채점된 업체는
  `src/data/mockPartners.json`의 점수·등급과 자동으로 매칭합니다. 시트 연동에 필요한
  Apps Script는 `apps-script/Code.gs`를 참고하세요.

검증 점수·컨택 상태·비고는 항상 대시보드 안에서만 관리되며(새로고침 시 초기화),
Google Sheets에는 쓰지 않습니다.

## 배포

```bash
npm run build           # 일반 배포용(GitHub Pages 등)
npm run build:artifact  # 공유용 단일 HTML 파일 번들(dist-artifact/)
```
