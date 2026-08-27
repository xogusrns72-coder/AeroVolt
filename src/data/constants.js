import { GRADES, GRADE_ORDER } from "./criteria";

export const CONTACT_STATUSES = ["미컨택", "컨택함", "응답 대기", "성사", "거절"];

export { GRADES, GRADE_ORDER };

export const GRADE_COLORS = Object.fromEntries(
  GRADE_ORDER.map((g) => [g, GRADES[g].color])
);

// 표시용 등급(A~D 외에 "미채점"/"제외" 포함) → 칩 라벨·색상
export const DISPLAY_GRADE_META = {
  ...Object.fromEntries(
    GRADE_ORDER.map((g) => [g, { label: GRADES[g].label, color: GRADES[g].color }])
  ),
  PENDING: { label: "미채점", color: "gray" },
  EXCLUDED: { label: "제외", color: "slate" },
};

export const SCREENING_STATUSES = ["통과", "제외"];
