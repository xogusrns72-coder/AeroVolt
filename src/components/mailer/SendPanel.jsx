// 발송 실행 패널.
// 버튼을 이유 없이 disabled로 두지 않는다 — 왜 잠겼는지, 무엇을 하면 열리는지를 항상 위에 쓴다.
export default function SendPanel({
  selectedCount,
  sendableCount,
  withMailCount,
  busy,
  progress,
  log,
  notice,
  confirmMode,
  templateSummary,
  bracketWarning,
  route,
  sendKey,
  connection,
  onSendKeyChange,
  onTestConnection,
  testAddress,
  testState,
  onTestAddressChange,
  onSendTestMail,
  onCsv,
  onCopy,
  onDraft,
  onAskSend,
  onCancelSend,
  onConfirmSend,
}) {
  const canSendMail = route === "mcp" || route === "script";
  const needsKey = route === "script" && !String(sendKey || "").trim();

  let why;
  let ready = false;
  if (busy) {
    why = "발송 중입니다. 끝날 때까지 기다려주세요. 창은 발송이 끝난 뒤에 닫을 수 있습니다.";
  } else if (selectedCount === 0 && withMailCount === 0) {
    why = "① 표의 이메일 칸에 주소를 넣고 ② 보낼 업체를 체크하면 버튼이 열립니다. 아직 입력된 주소가 없습니다.";
  } else if (selectedCount === 0) {
    why = `보낼 업체를 아직 안 고르셨습니다. 표 왼쪽 체크박스를 누르거나 “메일 주소 있는 곳 전체 선택”을 누르세요. (주소가 입력된 곳 ${withMailCount}개사)`;
  } else if (sendableCount === 0) {
    why = `선택한 ${selectedCount}개사에 유효한 메일 주소가 없습니다. 표의 이메일 칸을 채워주세요.`;
  } else if (needsKey) {
    why = `${sendableCount}개사 준비됨. 아래 발송 키를 입력하고 “연결 확인”을 누르면 발송 버튼이 열립니다. (CSV 저장은 지금도 됩니다)`;
  } else if (sendableCount < selectedCount) {
    why = `선택 ${selectedCount}개사 중 ${sendableCount}개사만 발송됩니다. 나머지 ${selectedCount - sendableCount}개사는 메일 주소가 비었거나 형식이 틀렸습니다.`;
  } else {
    why = `${sendableCount}개사 발송 준비 완료.`;
    ready = true;
  }

  const csvDisabled = busy || sendableCount === 0;
  const mailDisabled = csvDisabled || needsKey;

  return (
    <div className="mx-panel">
      <div className="mx-ph">발송 실행</div>

      {route === "script" && (
        <div className="mx-sendcfg">
          <div className="mx-sendcfg-head">
            발송 계정 연결
            <span className="mx-sendcfg-sub">Apps Script 웹앱 → Gmail</span>
          </div>
          <div className="mx-sendcfg-row">
            <input
              className="mx-search"
              type="password"
              value={sendKey}
              placeholder="발송 키"
              autoComplete="off"
              onChange={(e) => onSendKeyChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onTestConnection();
              }}
            />
            <button
              type="button"
              className="mx-btn mx-btn-sm"
              disabled={connection.state === "checking"}
              onClick={onTestConnection}
            >
              {connection.state === "checking" ? "확인 중..." : "연결 확인"}
            </button>
          </div>
          {connection.state === "ok" && (
            <>
              <p className="mx-sendcfg-ok">
                {connection.sender} 계정으로 발송됩니다 · 오늘 남은 Gmail 할당량 {connection.remaining}건
                {connection.sentToday ? ` (오늘 ${connection.sentToday}건 발송)` : ""}
              </p>
              <div className="mx-sendcfg-row" style={{ marginTop: 8, marginBottom: 0 }}>
                <input
                  className="mx-search"
                  type="email"
                  value={testAddress}
                  placeholder="테스트로 받을 내 주소"
                  spellCheck="false"
                  onChange={(e) => onTestAddressChange(e.target.value)}
                />
                <button
                  type="button"
                  className="mx-btn mx-btn-sm"
                  disabled={busy || testState.state === "sending"}
                  onClick={onSendTestMail}
                >
                  {testState.state === "sending" ? "보내는 중..." : "테스트 1건"}
                </button>
              </div>
              {testState.state === "ok" && <p className="mx-sendcfg-ok">{testState.message}</p>}
              {testState.state === "error" && <p className="mx-sendcfg-bad">{testState.message}</p>}
              {testState.state === "idle" && (
                <p className="mx-hint" style={{ margin: 0 }}>
                  전체 발송 전에 본인 주소로 1건 보내 치환·서명·수신 상태를 확인하세요. 이 건은 발송 기록에
                  남지 않습니다.
                </p>
              )}
            </>
          )}
          {connection.state === "error" && <p className="mx-sendcfg-bad">{connection.message}</p>}
          {connection.state === "idle" && (
            <p className="mx-hint" style={{ margin: 0 }}>
              발송 키는 Apps Script의 <code>setUpMailer()</code>에서 정한 값입니다. 이 브라우저에만
              저장되고 코드나 서버에는 남지 않습니다.
            </p>
          )}
        </div>
      )}

      <div className="mx-btns">
        <div className="mx-btn-row">
          <button type="button" className="mx-btn" disabled={csvDisabled} onClick={onCsv}>
            CSV 저장
          </button>
          <button type="button" className="mx-btn" disabled={csvDisabled} onClick={onCopy}>
            클립보드 복사
          </button>
        </div>
        {canSendMail && (
          <>
            <button type="button" className="mx-btn mx-btn-primary" disabled={mailDisabled} onClick={onDraft}>
              {sendableCount ? `초안 ${sendableCount}건 만들기` : "초안 만들기"}
            </button>
            <button type="button" className="mx-btn mx-btn-danger" disabled={mailDisabled} onClick={onAskSend}>
              {sendableCount ? `${sendableCount}건 바로 발송` : "바로 발송"}
            </button>
          </>
        )}
      </div>

      <p className={`mx-why${ready ? " ready" : ""}`}>{why}</p>

      {ready && templateSummary && <p className="mx-hint">템플릿별 건수 — {templateSummary}</p>}

      {bracketWarning && (
        <div className="mx-warnbox">
          본문에 아직 채우지 않은 대괄호가 남아 있습니다 ({bracketWarning}). 보내기 전에 이름·회사명 등을
          직접 채워주세요. (그대로 보낼 수도 있습니다)
        </div>
      )}

      {confirmMode && (
        <div className="mx-confirm">
          <p>{sendableCount}개사에 실제로 메일을 보냅니다. 보낸 메일은 되돌릴 수 없습니다.</p>
          {connection.state === "ok" && (
            <p className="mx-confirm-detail">보내는 계정 — {connection.sender}</p>
          )}
          {templateSummary && <p className="mx-confirm-detail">템플릿별 건수 — {templateSummary}</p>}
          <div className="mx-btn-row">
            <button type="button" className="mx-btn mx-btn-sm" onClick={onCancelSend}>
              취소
            </button>
            <button type="button" className="mx-btn mx-btn-sm mx-btn-danger" onClick={onConfirmSend}>
              {sendableCount}건 발송
            </button>
          </div>
        </div>
      )}

      {progress.total > 0 && (
        <div className="mx-bar">
          <i style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
        </div>
      )}

      {log.length > 0 && (
        <div className="mx-log">
          {log.map((entry, i) => (
            <div className="mx-log-row" key={`${entry.name}-${i}`}>
              <span className="mx-log-n">{entry.name}</span>
              <span className={`mx-chip ${entry.cls}`}>{entry.label}</span>
            </div>
          ))}
        </div>
      )}

      {notice && <div className="mx-warnbox">{notice}</div>}

      <p className="mx-note">
        {route === "script" && (
          <>
            메일은 <b>Apps Script 웹앱을 통해 그 스크립트 소유자의 Gmail로 실제 발송</b>됩니다. 받는 쪽
            회신도 그 계정으로 옵니다. <b>초안 만들기</b>로 먼저 한 건 확인한 뒤 발송하는 순서를 권합니다.{" "}
          </>
        )}
        {route === "mcp" && (
          <>
            메일은 연결된 <b>Gmail 커넥터</b>로 발송됩니다. <b>초안 만들기</b>를 먼저 돌려 Gmail에서 한 번
            확인한 뒤 발송하는 순서를 권합니다.{" "}
          </>
        )}
        {route === "none" && (
          <>
            이 화면에서는 메일을 직접 보낼 수 없습니다(발송 엔드포인트 미설정). CSV로 내보내 Apps Script
            메일머지로 발송해주세요.{" "}
          </>
        )}
        <b>CSV</b>는 시트 메일머지용입니다. 국가·지역·유형은 <b>영문으로 저장</b>되므로 시트에서 보내도
        메일에 한글이 섞이지 않습니다 (참고용 <code>국가(한글)</code> 열은 별도).
      </p>
    </div>
  );
}
