export default function ScreeningSummary({ partners }) {
  const scored = partners.filter((p) => p.scored).length;
  const pending = partners.filter((p) => !p.scored && p.screening_status === "통과").length;
  const excluded = partners.filter((p) => p.screening_status === "제외").length;

  return (
    <div className="screening-summary">
      <span className="screening-summary-total">전체 업로드 리스트 {partners.length}개사</span>
      <span className="screening-summary-item">1차 필터 통과 {scored + pending}개</span>
      <span className="screening-summary-sep">·</span>
      <span className="screening-summary-item screening-summary-scored">채점 완료 {scored}개</span>
      <span className="screening-summary-item">채점 대기 {pending}개</span>
      <span className="screening-summary-sep">·</span>
      <span className="screening-summary-item screening-summary-excluded">필터 제외 {excluded}개</span>
    </div>
  );
}
