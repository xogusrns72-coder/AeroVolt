// 검증 워크북("동남아_HVAC_시공업체_검증_워크북")의 채점 기준 — 신뢰도 40 + 기술력 35 = 총 75점.
//
// 원본 워크북은 "한인 연계"(대표 한인 여부·한국어 인력·한국계 발주처 실적·한인 상공회, 25점)를
// 세 번째 카테고리로 포함했지만, 업로드된 119개사 전수를 확인한 결과 한인·교포 경영 시공사가
// 단 한 곳도 없어 이 카테고리는 어떤 후보에게도 점수를 줄 수 없는 죽은 기준이었다(0% 변별력).
// 그 결과 모든 후보의 총점이 25점만큼 구조적으로 깎여 등급 판정이 왜곡됐으므로, 이번 재분류에서
// 채점 기준에서 제외했다. 코참/OKTA 명부로 한인계 후보를 별도 발굴하게 되면 이 카테고리를
// 가점 기준으로 다시 추가할 수 있다.
export const CRITERIA = [
  { no: 1, key: "gov_grade", label: "감독기관 등록 등급", weight: 10, phase: "1차", category: "trust" },
  { no: 2, key: "registration_validity", label: "등록증 유효성·위반이력", weight: 8, phase: "2차", category: "trust" },
  { no: 3, key: "financial_health", label: "재무 건전성", weight: 8, phase: "2차", category: "trust" },
  { no: 4, key: "completed_references", label: "완공 레퍼런스", weight: 8, phase: "1차", category: "trust" },
  { no: 5, key: "performance_bond", label: "Performance Bond", weight: 6, phase: "2차", category: "trust" },
  { no: 6, key: "duct_expertise", label: "덕트 시공 전문성", weight: 10, phase: "1차", category: "tech" },
  { no: 7, key: "fabric_duct_experience", label: "패브릭덕트·텐션 경험", weight: 8, phase: "1차", category: "tech" },
  { no: 8, key: "qualified_technicians", label: "유자격 기술인력", weight: 6, phase: "2차", category: "tech" },
  { no: 9, key: "airflow_measurement", label: "풍량·정압 측정 역량", weight: 6, phase: "2차", category: "tech" },
  { no: 10, key: "drawing_bim", label: "도면·BIM 대응", weight: 5, phase: "1차", category: "tech" },
];

export const CATEGORIES = {
  trust: { label: "신뢰도", weight: 40, color: "teal" },
  tech: { label: "기술력", weight: 35, color: "blue" },
};

export const CATEGORY_ORDER = ["trust", "tech"];

export const TOTAL_MAX = 75;

// 판정 — 원본 워크북의 A80/B65/C50(100점 만점 기준 80%/65%/50%)을 75점 만점에 그대로 적용하면
// 2차 항목(34점)이 전 업체 미확인 상태인 지금 단계에서는 1차 조사만으로 최고점을 받아도 C 문턱에도
// 못 미친다(실측 최고점 29.6점). 즉 원래 배점의 절대 기준은 "2차 검증까지 끝난 최종 판정"에만
// 의미가 있고, 지금 같은 1차 전용 단계에는 쓸 수 없다.
// 그래서 이번 재분류는 실제 80개사 1차 점수 분포(4~29.6점)를 근거로 임계값을 다시 잡았다 —
// 상위 약 11%/다음 43%/다음 39%/하위 7%로 나뉘는 지점(24 / 15 / 8점)을 기준으로 삼았다.
// 2차 항목을 채워 넣기 시작하면 총점이 올라가며 등급도 자연스럽게 재평가된다.
export const GRADES = {
  A: { min: 24, label: "A 등급", desc: "1차 조사 우수 — 2차 검증 즉시 착수", color: "teal" },
  B: { min: 15, label: "B 등급", desc: "검토 대상 — 2차 확인 필요", color: "blue" },
  C: { min: 8, label: "C 등급", desc: "보류", color: "amber" },
  D: { min: 0, label: "D 등급", desc: "미달·제외", color: "red" },
};

export const GRADE_ORDER = ["A", "B", "C", "D"];
