import mockPartners from "../data/mockPartners.json";

// mock 모드: 내장 JSON을 그대로 반환한다.
// 수정 사항은 App의 React state에만 저장되며 새로고침 시 초기화된다 (의도된 동작).
export async function fetchPartners() {
  return mockPartners;
}

// mock 모드에서는 실제 저장소가 없으므로 아무 동작도 하지 않는다.
// (App state 업데이트가 실질적인 "저장" 역할을 한다)
export async function updatePartner(_updatedPartner) {
  return { ok: true };
}
