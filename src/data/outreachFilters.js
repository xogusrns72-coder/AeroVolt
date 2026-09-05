import { GRADES } from "./criteria";

// 발송 콘솔의 기본 필터 — 상단 "메일 발송" 버튼의 후보 배지도 같은 기준을 쓴다.
// (A·B 등급 + B 임계값 이상 = 바로 컨택할 만한 곳. 임계값은 criteria.js에서 한 곳으로 관리)
export const DEFAULT_GRADE_FILTER = {
  A: true,
  B: true,
  C: false,
  D: false,
  PENDING: false,
  EXCLUDED: false,
};

export const DEFAULT_MIN_SCORE = GRADES.B.min;

// 등급 칩 색은 심사표와 동일하다: A=teal, B=blue, C=amber, D=red, 제외=slate, 미채점=gray2.
export const GRADE_CHIPS = [
  { key: "A", label: "A 등급", cls: "" },
  { key: "B", label: "B 등급", cls: "mx-t-blue" },
  { key: "C", label: "C 등급", cls: "mx-t-amber" },
  { key: "D", label: "D 등급", cls: "mx-t-red" },
  { key: "PENDING", label: "미채점", cls: "mx-t-gray" },
  { key: "EXCLUDED", label: "필터 제외", cls: "mx-t-slate" },
];
