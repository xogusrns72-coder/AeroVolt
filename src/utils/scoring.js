import { CRITERIA, CATEGORY_ORDER, GRADES, GRADE_ORDER } from "../data/criteria";

export { CRITERIA, CATEGORY_ORDER };

function itemPoints(rawScore, weight) {
  return (Number(rawScore) || 0) / 5 * weight;
}

export function computeCategorySubtotal(partner, category) {
  return CRITERIA.filter((c) => c.category === category).reduce(
    (sum, c) => sum + itemPoints(partner.scores?.[c.key], c.weight),
    0
  );
}

export function computeTotalScore(partner) {
  return CATEGORY_ORDER.reduce((sum, cat) => sum + computeCategorySubtotal(partner, cat), 0);
}

export function computeGrade(totalScore) {
  for (const g of GRADE_ORDER) {
    if (totalScore >= GRADES[g].min) return g;
  }
  return "D";
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// 표시용 등급: 아직 채점되지 않은(총점 0) 업체는 A~D로 판정하지 않고
// 1차 필터링 결과(통과 대기/제외)를 그대로 보여준다. 실제 점수를 입력하는 순간
// (총점이 0을 넘는 순간) 정상적인 A~D 판정으로 자연스럽게 넘어간다.
export function computeDisplayGrade(partner, totalScore, grade) {
  if (totalScore > 0) return grade;
  return partner.screening_status === "제외" ? "EXCLUDED" : "PENDING";
}

export function withComputedFields(partner) {
  const trust_subtotal = round1(computeCategorySubtotal(partner, "trust"));
  const tech_subtotal = round1(computeCategorySubtotal(partner, "tech"));
  const korean_subtotal = round1(computeCategorySubtotal(partner, "korean"));
  const total_score = round1(trust_subtotal + tech_subtotal + korean_subtotal);
  const grade = computeGrade(total_score);
  return {
    ...partner,
    trust_subtotal,
    tech_subtotal,
    korean_subtotal,
    total_score,
    grade,
    display_grade: computeDisplayGrade(partner, total_score, grade),
  };
}
