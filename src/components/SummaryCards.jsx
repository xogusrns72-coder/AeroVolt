import { GRADE_ORDER, GRADES } from "../data/constants";

const RANGE_TEXT = {
  A: `${GRADES.A.min}점 이상`,
  B: `${GRADES.B.min}~${GRADES.A.min - 1}점`,
  C: `${GRADES.C.min}~${GRADES.B.min - 1}점`,
  D: `${GRADES.C.min}점 미만`,
};

export default function SummaryCards({ partners }) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  partners.forEach((p) => {
    if (counts[p.display_grade] !== undefined) counts[p.display_grade] += 1;
  });

  return (
    <div className="summary-cards">
      {GRADE_ORDER.map((g) => (
        <div key={g} className={`summary-card summary-card-${GRADES[g].color}`}>
          <div className="summary-card-count">{counts[g]}</div>
          <div className="summary-card-label">{GRADES[g].label} · {GRADES[g].desc}</div>
          <div className="summary-card-desc">총점 {RANGE_TEXT[g]}</div>
        </div>
      ))}
    </div>
  );
}
