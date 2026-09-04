import { useState } from "react";
import { checkApiUrl, getApiUrl, isApiUrlOverridden, setApiUrl } from "../api/endpoint";

/*
  시트 연결이 끊겼을 때 원인과 다음 할 일을 보여준다.
  배포를 다시 하면 URL이 바뀌는 경우가 많아서, 새 주소를 여기서 바로 붙여넣을 수 있게 했다.
*/
export default function ConnectionBanner({ error, retrying, onRetry }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getApiUrl);
  const [warn, setWarn] = useState("");

  const apply = () => {
    const problem = checkApiUrl(url);
    if (problem) {
      setWarn(problem);
      return;
    }
    setApiUrl(url);
    onRetry();
  };

  const reset = () => {
    setApiUrl("");
    setUrl(getApiUrl());
    setWarn("");
    onRetry();
  };

  return (
    <div className="conn-banner">
      <div className="conn-banner-main">
        <div>
          <div className="conn-banner-title">
            구글 시트에 연결하지 못해 <b>내장 데이터</b>로 표시 중입니다
          </div>
          <div className="conn-banner-msg">{error}</div>
          <div className="conn-banner-note">
            채점·등급·메일 발송 기능은 그대로 쓸 수 있습니다. 시트에서 새로 추가·수정한 업체 정보만
            반영되지 않습니다.
          </div>
        </div>
        <div className="conn-banner-actions">
          <button className="btn-secondary" onClick={onRetry} disabled={retrying}>
            {retrying ? "확인 중..." : "다시 시도"}
          </button>
          <button className="btn-secondary" onClick={() => setOpen((v) => !v)}>
            {open ? "닫기" : "주소 바꾸기"}
          </button>
        </div>
      </div>

      {open && (
        <div className="conn-banner-form">
          <p className="conn-banner-help">
            Apps Script에서 <b>배포 &gt; 배포 관리</b>를 열고 웹 앱 URL을 복사해 붙여넣으세요.
            <code>/exec</code>로 끝나야 합니다. 이 주소는 이 브라우저에만 저장됩니다 — 확정되면{" "}
            <code>src/config.js</code>의 <code>SHEETS_API_URL</code>에도 넣어두세요.
          </p>
          <div className="conn-banner-row">
            <input
              className="conn-banner-input"
              type="url"
              value={url}
              spellCheck="false"
              placeholder="https://script.google.com/macros/s/.../exec"
              onChange={(e) => {
                setUrl(e.target.value);
                setWarn("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
            />
            <button className="btn-primary" onClick={apply}>
              적용
            </button>
          </div>
          {warn && <p className="conn-banner-warn">{warn}</p>}
          {isApiUrlOverridden() && (
            <button className="conn-banner-reset" onClick={reset}>
              코드에 저장된 기본 주소로 되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
