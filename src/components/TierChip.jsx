import { DISPLAY_GRADE_META } from "../data/constants";

export default function TierChip({ grade }) {
  const meta = DISPLAY_GRADE_META[grade] || { label: grade, color: "gray" };
  return <span className={`chip chip-${meta.color}`}>{meta.label}</span>;
}
