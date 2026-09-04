// 아티팩트 mcp capability를 통해 사용자의 Gmail 커넥터를 호출한다.
// 일반 웹(GitHub Pages 등)에는 window.claude가 없으므로 getMcp()는 null을 돌려주고,
// 화면은 Gmail 버튼을 감춘 채 CSV 경로만 안내한다.

let cached = null;
let checked = false;

export async function getMcp() {
  if (checked) return cached;
  checked = true;
  if (typeof window === "undefined" || typeof window.claude?.use !== "function") {
    cached = null;
    return null;
  }
  try {
    cached = await window.claude.use("mcp");
  } catch {
    cached = null;
  }
  return cached;
}

// 인증·권한 계열 오류는 남은 건을 반복 시도해봐야 전부 같은 이유로 실패한다 → 루프를 멈춘다.
const FATAL_CODES = new Set([
  "needs_reauth",
  "server_not_connected",
  "selection_required",
  "not_granted",
  "capability_disabled",
  "capability_removed",
  "not_in_manifest",
  "blocked_by_policy",
  "approval_required",
]);

export function isFatalGmailError(code) {
  return FATAL_CODES.has(code);
}

// 하나의 뭉뚱그린 배너 대신 code별로 "무엇을 하면 되는지"를 알려준다.
export function gmailErrorMessage(code, message) {
  switch (code) {
    case "needs_reauth":
      return "Gmail 연결이 만료됐습니다. claude.ai 설정 → 커넥터에서 Gmail을 다시 연결해주세요.";
    case "server_not_connected":
      return "Gmail 커넥터가 연결돼 있지 않습니다. claude.ai 설정 → 커넥터에서 Gmail을 추가해주세요.";
    case "selection_required":
      return "연결된 Gmail 계정이 둘 이상입니다. 화면에 뜬 계정 선택 창에서 보낼 계정을 골라주세요.";
    case "not_in_manifest":
    case "blocked_by_policy":
      return "조직 정책이 이 페이지의 Gmail 사용을 막고 있습니다. CSV로 내보내 Apps Script로 발송해주세요.";
    case "approval_required":
      return "조직 정책상 이 작업에는 별도 승인이 필요합니다.";
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return "이 화면에서는 Gmail을 쓸 수 없습니다. CSV로 내보내 Apps Script로 발송해주세요.";
    case "rate_limited":
    case "server_unavailable":
      return "Gmail 서버 응답이 없습니다. 잠시 후 남은 건만 다시 실행해주세요.";
    case "tool_error":
      return `Gmail이 요청을 거부했습니다: ${message || "사유 미상"}`;
    default:
      return `발송 중 오류가 발생했습니다: ${message || code || "사유 미상"}`;
  }
}

// create_draft / send_message 인자 형태는 동일하다. to는 배열.
export async function sendViaGmail(mcp, mode, { to, subject, body, htmlBody }) {
  const tool = mode === "send" ? "send_message" : "create_draft";
  return mcp.callTool("Gmail", tool, { to: [to], subject, body, htmlBody });
}
