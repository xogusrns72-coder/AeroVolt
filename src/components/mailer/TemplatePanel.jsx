import { useRef, useState } from "react";
import { TOKENS } from "../../data/mailTemplates";

// 템플릿 하나를 그 자리에서 편집한다. 입력 즉시 해당 템플릿에 저장되고, 번호(no)는 순서대로 자동 부여된다.
export default function TemplatePanel({
  templates,
  activeId,
  onSelect,
  onPatch,
  onAdd,
  onRemove,
  onMove,
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const lastFocusedRef = useRef("body");

  const active = templates.find((t) => t.id === activeId) || templates[0];
  const index = templates.findIndex((t) => t.id === active.id);

  const insertToken = (token) => {
    const target = lastFocusedRef.current === "subject" ? subjectRef.current : bodyRef.current;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);
    onPatch(active.id, { [lastFocusedRef.current === "subject" ? "subject" : "body"]: next });
    requestAnimationFrame(() => {
      target.focus();
      target.selectionStart = start + token.length;
      target.selectionEnd = start + token.length;
    });
  };

  const duplicate = () => {
    onAdd({ name: `${active.name} (사본)`, subject: active.subject, body: active.body });
    setConfirmDelete(false);
  };

  return (
    <div className="mx-panel">
      <div className="mx-ph">
        <span>메일 템플릿</span>
        <span className="mx-hint" style={{ margin: 0 }}>
          {templates.length}개 저장됨
        </span>
      </div>

      <div className="mx-tpl-tabs">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mx-tpl-tab${t.id === active.id ? " on" : ""}`}
            onClick={() => {
              onSelect(t.id);
              setRenaming(false);
              setConfirmDelete(false);
            }}
          >
            <span className="mx-tpl-no">{t.no}.</span>
            <span className="mx-tpl-name">{t.name}</span>
          </button>
        ))}
      </div>

      <div className="mx-tpl-tools">
        <button type="button" className="mx-mini" onClick={() => onAdd({ name: "새 템플릿" })}>
          새 템플릿
        </button>
        <button type="button" className="mx-mini" onClick={duplicate}>
          복제
        </button>
        <button type="button" className="mx-mini" onClick={() => setRenaming((v) => !v)}>
          이름 변경
        </button>
        <button
          type="button"
          className="mx-mini"
          disabled={index <= 0}
          onClick={() => onMove(active.id, -1)}
          aria-label="위로"
        >
          ↑
        </button>
        <button
          type="button"
          className="mx-mini"
          disabled={index === templates.length - 1}
          onClick={() => onMove(active.id, 1)}
          aria-label="아래로"
        >
          ↓
        </button>
        <button
          type="button"
          className="mx-mini mx-mini-danger"
          disabled={templates.length <= 1}
          onClick={() => setConfirmDelete(true)}
        >
          삭제
        </button>
      </div>

      {templates.length <= 1 && (
        <p className="mx-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          템플릿은 최소 1개가 있어야 해서 마지막 하나는 지울 수 없습니다.
        </p>
      )}

      {confirmDelete && (
        <div className="mx-confirm">
          <p>
            {active.no}. {active.name} 템플릿을 지웁니다. 이 템플릿으로 지정해둔 행은 “현재 선택”으로
            돌아갑니다.
          </p>
          <div className="mx-btn-row">
            <button type="button" className="mx-btn mx-btn-sm" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
            <button
              type="button"
              className="mx-btn mx-btn-sm mx-btn-danger"
              onClick={() => {
                onRemove(active.id);
                setConfirmDelete(false);
              }}
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {renaming && (
        <input
          className="mx-namein"
          autoFocus
          value={active.name}
          onChange={(e) => onPatch(active.id, { name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setRenaming(false);
          }}
          onBlur={() => setRenaming(false)}
          placeholder="템플릿 이름"
        />
      )}

      <input
        ref={subjectRef}
        className="mx-subj"
        value={active.subject}
        placeholder="제목"
        onFocus={() => {
          lastFocusedRef.current = "subject";
        }}
        onChange={(e) => onPatch(active.id, { subject: e.target.value })}
      />

      <div className="mx-tokens">
        {TOKENS.map((token) => (
          <button key={token} type="button" className="mx-token" onClick={() => insertToken(token)}>
            {token}
          </button>
        ))}
      </div>

      <textarea
        ref={bodyRef}
        className="mx-ta"
        spellCheck="false"
        value={active.body}
        placeholder="본문"
        onFocus={() => {
          lastFocusedRef.current = "body";
        }}
        onChange={(e) => onPatch(active.id, { body: e.target.value })}
      />

      <p className="mx-hint">
        자리표시자를 클릭하면 커서 위치에 삽입됩니다. 국가·지역·유형은 <b>영문으로 치환</b>됩니다
        (베트남 → Vietnam, 하노이 → Hanoi). 대괄호 <b>[ ]</b> 부분은 보내기 전에 직접 채워주세요.
      </p>
    </div>
  );
}
