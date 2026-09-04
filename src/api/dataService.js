import { DATA_SOURCE } from "../config";
import * as mockApi from "./mockApi";
import * as sheetsApi from "./sheetsApi";

const impl = DATA_SOURCE === "sheets" ? sheetsApi : mockApi;

export const fetchPartners = impl.fetchPartners;
export const updatePartner = impl.updatePartner;

// 시트 연결이 끊겨도 대시보드가 "불러오는 중..."에서 멈추지 않게 한다.
// 점수·근거·판정은 어차피 내장 데이터(mockPartners.json)에 들어 있으므로, 시트를 못 읽으면
// 그걸로 내려앉고 화면 상단에 이유를 띄운다. 업체 기본정보만 시트 기준으로 최신이 아니게 된다.
export async function loadPartners() {
  try {
    return { rows: await impl.fetchPartners(), error: null };
  } catch (e) {
    if (impl === mockApi) throw e;
    return { rows: await mockApi.fetchPartners(), error: e?.message || String(e) };
  }
}
