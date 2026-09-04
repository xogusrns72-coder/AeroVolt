import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRACKET_PATTERN } from "../../data/mailTemplates";
import { fillTemplate, isEmail, toHtmlBody } from "../../utils/localize";
import { buildCsv, copyText, csvFilename, saveCsv } from "../../utils/outreachCsv";
import { getMcp, gmailErrorMessage, isFatalGmailError, sendViaGmail } from "../../utils/gmailClient";
import {
  MAIL_BATCH_SIZE,
  isMailApiConfigured,
  loadSendKey,
  pingMailApi,
  saveSendKey,
  sendMailBatch,
} from "../../utils/appsScriptMailer";
import { TOTAL_MAX } from "../../data/criteria";
import { DEFAULT_GRADE_FILTER, DEFAULT_MIN_SCORE, GRADE_CHIPS } from "../../data/outreachFilters";
import TargetTable from "./TargetTable";
import TemplatePanel from "./TemplatePanel";
import PreviewPanel from "./PreviewPanel";
import SendPanel from "./SendPanel";
import BulkPastePanel from "./BulkPastePanel";
import "./Mailer.css";

const SEND_DELAY_MS = 1500;
const DRAFT_DELAY_MS = 600;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function timeStamp(at) {
  if (!at) return "";
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MailerModal({ open, onClose, partners, store }) {
  const { data, actions, saveState, lastSavedAt, dbOn, flushSave } = store;
  const { contacts, sent, templates, activeTemplateId } = data;

  const [grades, setGrades] = useState(DEFAULT_GRADE_FILTER);
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
  const [countryOff, setCountryOff] = useState({});
  const [query, setQuery] = useState("");
  const [onlyMail, setOnlyMail] = useState(false);
  const [onlyUnsent, setOnlyUnsent] = useState(true);
  const [selected, setSelected] = useState({});
  const [previewId, setPreviewId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState([]);
  const [notice, setNotice] = useState("");
  const [confirmMode, setConfirmMode] = useState(false);

  // 발송 경로 — "mcp"(아티팩트 + Gmail 커넥터) / "script"(Apps Script 웹앱) / "none"(CSV만)
  const [route, setRoute] = useState("none");
  const [sendKey, setSendKey] = useState(loadSendKey);
  const [connection, setConnection] = useState({ state: "idle" });
  const [testAddress, setTestAddress] = useState("");
  const [testState, setTestState] = useState({ state: "idle" });

  const modalRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const countries = useMemo(
    () => Array.from(new Set(partners.map((p) => p.country))).sort(),
    [partners]
  );
  const maxScore = useMemo(
    () => Math.max(10, Math.ceil(partners.reduce((m, p) => Math.max(m, p.total_score || 0), 0))),
    [partners]
  );

  const liveRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return partners
      .filter((p) => {
        if (!grades[p.display_grade]) return false;
        if ((p.total_score || 0) < minScore) return false;
        if (countryOff[p.country]) return false;
        if (q && !p.company_name.toLowerCase().includes(q)) return false;
        if (onlyMail && !String(contacts[p.id]?.email || "").trim()) return false;
        if (onlyUnsent && sent[p.id]?.status === "sent") return false;
        return true;
      })
      // 심사표와 같은 순서(총점 높은 순)로 보여준다 — 위에서부터 채우면 우선순위대로 컨택하게 된다.
      .sort((a, b) =>
        b.total_score !== a.total_score
          ? b.total_score - a.total_score
          : a.company_name.localeCompare(b.company_name)
      );
  }, [partners, grades, minScore, countryOff, query, onlyMail, onlyUnsent, contacts, sent]);

  // 표 안 입력 필드에 포커스가 들어오는 순간의 목록을 얼려두고, 포커스가 빠지면 푼다.
  // (주소를 치는 도중 그 행이 필터에서 빠져 입력창이 통째로 사라지는 것을 막는다)
  const liveRowsRef = useRef(liveRows);
  useEffect(() => {
    liveRowsRef.current = liveRows;
  }, [liveRows]);
  const [frozenRows, setFrozenRows] = useState(null);
  const rows = frozenRows || liveRows;

  const handleTypingChange = useCallback((isTyping) => {
    setFrozenRows(isTyping ? liveRowsRef.current : null);
  }, []);

  // 표와 같은 순서(총점 높은 순)로 둔다 — 미리보기 목록과 발송 순서가 표와 어긋나지 않게.
  const selectedRows = useMemo(
    () =>
      partners
        .filter((p) => selected[p.id])
        .sort((a, b) =>
          b.total_score !== a.total_score
            ? b.total_score - a.total_score
            : a.company_name.localeCompare(b.company_name)
        ),
    [partners, selected]
  );
  const sendableRows = useMemo(
    () => selectedRows.filter((p) => isEmail(contacts[p.id]?.email) && sent[p.id]?.status !== "sent"),
    [selectedRows, contacts, sent]
  );
  const withMailCount = useMemo(
    () => partners.filter((p) => isEmail(contacts[p.id]?.email)).length,
    [partners, contacts]
  );
  const sentCount = useMemo(
    () => Object.values(sent).filter((s) => s?.status === "sent").length,
    [sent]
  );

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) || templates[0],
    [templates, activeTemplateId]
  );

  const templateFor = useCallback(
    (partnerId) => templates.find((t) => t.id === contacts[partnerId]?.templateId) || activeTemplate,
    [templates, contacts, activeTemplate]
  );

  const templateSummary = useMemo(() => {
    const counts = new Map();
    sendableRows.forEach((p) => {
      const t = templateFor(p.id);
      counts.set(t.no, (counts.get(t.no) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([no, n]) => `${no}번 ${n}건`)
      .join(" · ");
  }, [sendableRows, templateFor]);

  // 대괄호가 남아 있으면 막지는 않고 경고만 띄운다.
  const bracketWarning = useMemo(() => {
    const nos = new Set();
    sendableRows.forEach((p) => {
      const t = templateFor(p.id);
      if (BRACKET_PATTERN.test(t.subject) || BRACKET_PATTERN.test(t.body)) nos.add(t.no);
    });
    return nos.size > 0 ? `${Array.from(nos).sort((a, b) => a - b).join("번, ")}번` : "";
  }, [sendableRows, templateFor]);

  const previewPartner =
    selectedRows.find((p) => p.id === previewId) || selectedRows[0] || null;

  // 아티팩트의 Gmail 커넥터가 있으면 그걸 쓰고, 없으면 Apps Script 웹앱으로 보낸다.
  useEffect(() => {
    getMcp().then((mcp) => {
      if (mcp) setRoute("mcp");
      else setRoute(isMailApiConfigured() ? "script" : "none");
    });
  }, []);

  // 모달 열림/닫힘 — 포커스 이동·복귀, 배경 스크롤 잠금.
  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => modalRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      if (restoreFocusRef.current instanceof HTMLElement) restoreFocusRef.current.focus();
    };
  }, [open]);

  const requestClose = useCallback(() => {
    if (busy) {
      setNotice("발송 중입니다. 끝날 때까지 창을 닫을 수 없습니다.");
      return;
    }
    flushSave();
    onClose();
  }, [busy, flushSave, onClose]);

  // ESC는 문서 레벨에서 받는다 — 포커스가 모달 밖(body 등)에 있어도 닫히도록.
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, requestClose]);

  // 모달 안에서는 Tab이 밖으로 나가지 않게 가둔다.
  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const nodes = Array.from(modalRef.current?.querySelectorAll(FOCUSABLE) || []).filter(
      (n) => n.offsetParent !== null
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const toggleRow = useCallback((id) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const handleContactChange = useCallback(
    (id, patch) => {
      actions.setContact(id, patch);
    },
    [actions]
  );

  const handleCommit = useCallback(() => {
    flushSave();
  }, [flushSave]);

  const applyBulk = (entries) => {
    actions.setContacts(entries);
    // 외부에서 값이 바뀌었으므로 표의 입력칸을 저장값으로 다시 맞춘다.
    setSyncKey((k) => k + 1);
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = { ...prev };
      rows.forEach((p) => {
        next[p.id] = true;
      });
      return next;
    });
  };

  const selectVisibleWithMail = () => {
    setSelected((prev) => {
      const next = { ...prev };
      rows.forEach((p) => {
        if (isEmail(contacts[p.id]?.email)) next[p.id] = true;
      });
      return next;
    });
  };

  const buildMessage = (partner) => {
    const template = templateFor(partner.id);
    const contact = contacts[partner.id] || {};
    const subject = fillTemplate(template.subject, partner, contact);
    const body = fillTemplate(template.body, partner, contact);
    return { subject, body, to: String(contact.email).trim() };
  };

  const handleCsv = async () => {
    const csv = buildCsv(sendableRows, { contacts, sent });
    const res = await saveCsv(csv, csvFilename());
    if (res.how === "download") setNotice(`${sendableRows.length}개사를 CSV로 저장했습니다.`);
    else if (res.how === "clipboard") setNotice("다운로드를 쓸 수 없어 클립보드에 복사했습니다.");
    else if (res.how === "declined") setNotice("");
    else setNotice("CSV 저장에 실패했습니다. 클립보드 복사를 눌러주세요.");
  };

  const handleCopy = async () => {
    const ok = await copyText(buildCsv(sendableRows, { contacts, sent }));
    setNotice(ok ? "시트에 붙여넣을 수 있게 복사했습니다." : "클립보드 복사에 실패했습니다.");
  };

  // 성공·실패를 한 곳에서 기록한다 — 발송 경로가 둘이어도 상태·로그는 같은 모양으로 남는다.
  const recordSuccess = (partner, mode, subject) => {
    actions.setSent(partner.id, {
      status: mode === "send" ? "sent" : "draft",
      at: Date.now(),
      subject,
    });
    // 실제로 보낸 건은 선택에서 빼서 다시 실행해도 중복 발송되지 않게 한다.
    if (mode === "send") {
      setSelected((prev) => {
        const next = { ...prev };
        delete next[partner.id];
        return next;
      });
    }
    setLog((prev) => [
      ...prev,
      {
        name: partner.company_name,
        cls: mode === "send" ? "mx-c-sent" : "mx-c-draft",
        label: mode === "send" ? "발송" : "초안",
      },
    ]);
  };

  const recordFailure = (partner, code) => {
    actions.setSent(partner.id, { status: "fail", at: Date.now(), error: code || "error" });
    setLog((prev) => [...prev, { name: partner.company_name, cls: "mx-c-fail", label: "실패" }]);
  };

  const finishRun = (ok, total, stopped) => {
    setLog((prev) => [
      ...prev,
      {
        name: stopped
          ? `중단됨 — ${ok}건 처리 후 멈췄습니다. 원인을 고치고 다시 실행하면 남은 건부터 이어집니다.`
          : `완료 — ${ok} / ${total}건`,
        cls: ok === total && !stopped ? "mx-c-sent" : "mx-c-done",
        label: stopped ? "중단" : "완료",
      },
    ]);
    setBusy(false);
    flushSave();
  };

  // ① 아티팩트 경로 — Claude의 Gmail 커넥터를 건별로 호출한다.
  const runViaMcp = async (mode, targets) => {
    const mcp = await getMcp();
    if (!mcp) {
      setRoute(isMailApiConfigured() ? "script" : "none");
      setNotice("Gmail 커넥터를 쓸 수 없습니다. 발송 방식을 다시 확인해주세요.");
      setBusy(false);
      return;
    }

    let ok = 0;
    let stopped = false;

    for (let i = 0; i < targets.length; i += 1) {
      const partner = targets[i];
      const { subject, body, to } = buildMessage(partner);
      try {
        await sendViaGmail(mcp, mode, { to, subject, body, htmlBody: toHtmlBody(body) });
        ok += 1;
        recordSuccess(partner, mode, subject);
      } catch (e) {
        const code = e?.code;
        recordFailure(partner, code);
        setNotice(gmailErrorMessage(code, e?.message));
        if (isFatalGmailError(code)) stopped = true;
      }
      setProgress({ done: i + 1, total: targets.length });
      if (stopped) break;
      if (i < targets.length - 1) await sleep(mode === "send" ? SEND_DELAY_MS : DRAFT_DELAY_MS);
    }

    finishRun(ok, targets.length, stopped);
  };

  // ② 일반 웹 경로 — Apps Script 웹앱이 스크립트 소유자의 Gmail로 실제 발송한다.
  const runViaScript = async (mode, targets) => {
    let ok = 0;
    let stopped = false;
    let done = 0;

    for (let i = 0; i < targets.length; i += MAIL_BATCH_SIZE) {
      const chunk = targets.slice(i, i + MAIL_BATCH_SIZE);
      const byId = new Map(chunk.map((p) => [p.id, p]));
      const messages = chunk.map((p) => {
        const { subject, body, to } = buildMessage(p);
        return { id: p.id, to, subject, body, htmlBody: toHtmlBody(body) };
      });
      const subjects = new Map(messages.map((m) => [m.id, m.subject]));

      const res = await sendMailBatch(sendKey, mode, messages);

      if (!res.ok) {
        // 키·할당량·배포 문제는 남은 건을 반복해도 같은 이유로 실패한다 → 멈춘다.
        setNotice(res.message || "발송에 실패했습니다.");
        stopped = true;
        break;
      }

      (res.results || []).forEach((r) => {
        const partner = byId.get(r.id);
        if (!partner) return;
        if (r.ok) {
          ok += 1;
          recordSuccess(partner, mode, subjects.get(r.id));
        } else {
          recordFailure(partner, r.code);
          if (r.message) setNotice(r.message);
        }
      });

      done += chunk.length;
      setProgress({ done, total: targets.length });
      if (typeof res.remaining === "number") {
        setConnection((prev) => ({ ...prev, remaining: res.remaining, sentToday: res.sentToday }));
      }
      if (i + MAIL_BATCH_SIZE < targets.length) await sleep(mode === "send" ? SEND_DELAY_MS : DRAFT_DELAY_MS);
    }

    finishRun(ok, targets.length, stopped);
  };

  const runSend = async (mode) => {
    const targets = sendableRows;
    if (targets.length === 0) return;
    if (route === "script" && !sendKey.trim()) {
      setNotice("발송 키를 먼저 입력하고 “연결 확인”을 눌러주세요.");
      return;
    }

    setNotice("");
    setBusy(true);
    setLog([]);
    setProgress({ done: 0, total: targets.length });

    if (route === "mcp") await runViaMcp(mode, targets);
    else await runViaScript(mode, targets);
  };

  const testConnection = async () => {
    if (!sendKey.trim()) {
      setConnection({ state: "error", message: "발송 키를 입력해주세요." });
      return;
    }
    setConnection({ state: "checking" });
    const res = await pingMailApi(sendKey.trim());
    if (res.ok) {
      saveSendKey(sendKey.trim());
      setConnection({
        state: "ok",
        sender: res.sender,
        remaining: res.remaining,
        sentToday: res.sentToday,
      });
      setTestAddress((prev) => prev || res.sender || "");
    } else {
      setConnection({ state: "error", message: res.message || "확인에 실패했습니다." });
    }
  };

  // 43개사에 뿌리기 전에 본인 주소로 1건 보내보는 단계. 발송 기록에는 남기지 않는다.
  const sendTestMail = async () => {
    const to = testAddress.trim();
    if (!isEmail(to)) {
      setTestState({ state: "error", message: "테스트로 받을 주소를 올바르게 입력해주세요." });
      return;
    }
    const sample = sendableRows[0] || rows[0];
    if (!sample) {
      setTestState({ state: "error", message: "치환에 쓸 업체가 없습니다. 필터를 넓혀주세요." });
      return;
    }

    setTestState({ state: "sending" });
    const { subject, body } = buildMessage(sample);
    const res = await sendMailBatch(sendKey.trim(), "send", [
      { id: "test", to, subject: `[테스트] ${subject}`, body, htmlBody: toHtmlBody(body) },
    ]);
    const first = res.results?.[0];
    if (res.ok && first?.ok) {
      setTestState({
        state: "ok",
        message: `${to}로 테스트 1건을 보냈습니다 (${sample.company_name} 기준으로 치환). 받은편지함을 확인해주세요.`,
      });
    } else {
      setTestState({ state: "error", message: first?.message || res.message || "테스트 발송에 실패했습니다." });
    }
  };

  if (!open) return null;

  const syncClass =
    saveState === "dirty" || saveState === "saving" ? "off" : saveState === "error" ? "bad" : "ok";
  const syncText =
    saveState === "dirty"
      ? "저장 안 된 변경사항 있음"
      : saveState === "saving"
        ? "저장 중..."
        : saveState === "error"
          ? "서버 저장 실패 — 이 브라우저에는 남아 있음"
          : `${dbOn ? "저장됨" : "이 브라우저에 저장됨"}${lastSavedAt ? ` · ${timeStamp(lastSavedAt)}` : ""}`;

  const stats = [
    { v: rows.length, l: "필터 결과" },
    { v: selectedRows.length, l: "선택함", hi: true },
    { v: sendableRows.length, l: "발송 가능" },
    { v: `${withMailCount} / ${partners.length}`, l: "메일 주소 입력" },
    { v: sentCount, l: "발송 완료" },
  ];

  return (
    <div
      className="mx-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className="mx-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="파트너 발굴 메일 발송"
        onKeyDown={handleKeyDown}
      >
        <div className="mx-modal-head">
          <div>
            <div className="mx-eyebrow">2단계 · 컨택 실행</div>
            <h2 className="mx-h1">파트너 발굴 메일 발송</h2>
            <p className="mx-lede">
              심사표의 점수·등급을 그대로 이어받아 발송 대상을 고릅니다. 이메일과 담당자는 표에서 바로
              입력할 수 있고, 입력한 값·템플릿·발송 기록은 자동 저장되어 다음에 열 때도 남아 있습니다.
            </p>
          </div>
          <div className="mx-head-right">
            {busy ? (
              <span className="mx-syncdot off">
                발송 중 ({progress.done}/{progress.total}) — 끝날 때까지 닫을 수 없습니다
              </span>
            ) : (
              <span className={`mx-syncdot ${syncClass}`}>{syncText}</span>
            )}
            <button
              type="button"
              className={`mx-mini${saveState === "dirty" || saveState === "error" ? " mx-btn-primary" : ""}`}
              disabled={saveState === "saving"}
              onClick={flushSave}
            >
              {saveState === "dirty" || saveState === "error" ? "지금 저장" : "저장됨"}
            </button>
            <button type="button" className="mx-close" onClick={requestClose} aria-label="닫기">
              ×
            </button>
          </div>
        </div>

        <div className="mx-body">
          <div className="mx-stats">
            {stats.map((s) => (
              <div className={`mx-stat${s.hi ? " mx-stat-hi" : ""}`} key={s.l}>
                <div className="mx-stat-v">{s.v}</div>
                <div className="mx-stat-l">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mx-cols">
            <div>
              <div className="mx-panel">
                <div className="mx-ph">발송 대상 고르기</div>

                <div className="mx-fieldrow">
                  <span className="mx-lbl">등급</span>
                  {GRADE_CHIPS.map((g) => (
                    <label key={g.key} className={`mx-toggle ${g.cls}${grades[g.key] ? " on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={!!grades[g.key]}
                        onChange={(e) => setGrades((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                      />
                      {g.label}
                    </label>
                  ))}
                </div>

                <div className="mx-fieldrow">
                  <span className="mx-lbl">최소 점수</span>
                  <div className="mx-slider">
                    <input
                      type="range"
                      min="0"
                      max={maxScore}
                      step="0.5"
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                      aria-label="최소 총점"
                    />
                    <span className="mx-scoreval">
                      {minScore}점 <span>이상 / {TOTAL_MAX}점 만점</span>
                    </span>
                  </div>
                </div>

                <div className="mx-fieldrow">
                  <span className="mx-lbl">국가</span>
                  {countries.map((c) => (
                    <label key={c} className={`mx-toggle${countryOff[c] ? "" : " on"}`}>
                      <input
                        type="checkbox"
                        checked={!countryOff[c]}
                        onChange={(e) =>
                          setCountryOff((prev) => ({ ...prev, [c]: !e.target.checked }))
                        }
                      />
                      {c}
                    </label>
                  ))}
                </div>

                <div className="mx-fieldrow">
                  <input
                    className="mx-search"
                    type="search"
                    placeholder="업체명 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <label className={`mx-toggle${onlyMail ? " on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={onlyMail}
                      onChange={(e) => setOnlyMail(e.target.checked)}
                    />
                    메일 주소 입력된 곳만
                  </label>
                  <label className={`mx-toggle${onlyUnsent ? " on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={onlyUnsent}
                      onChange={(e) => setOnlyUnsent(e.target.checked)}
                    />
                    미발송만
                  </label>
                </div>

                <div className="mx-fieldrow" style={{ marginBottom: 10 }}>
                  <button type="button" className="mx-btn mx-btn-sm" onClick={selectAllVisible}>
                    필터 결과 전체 선택
                  </button>
                  <button type="button" className="mx-btn mx-btn-sm" onClick={selectVisibleWithMail}>
                    메일 주소 있는 곳 전체 선택
                  </button>
                  <button type="button" className="mx-btn mx-btn-sm" onClick={() => setSelected({})}>
                    선택 해제
                  </button>
                  <button
                    type="button"
                    className="mx-btn mx-btn-sm"
                    onClick={() => setBulkOpen((v) => !v)}
                  >
                    이메일 일괄 붙여넣기
                  </button>
                </div>

                {bulkOpen && (
                  <BulkPastePanel
                    partners={partners}
                    onApply={applyBulk}
                    onClose={() => setBulkOpen(false)}
                  />
                )}

                <p className="mx-hint" style={{ margin: "0 0 8px" }}>
                  표의 <b>이메일</b> 칸을 클릭해 바로 입력하세요. <b>엔터</b>를 치면 저장되고 다음 줄로
                  넘어갑니다. 엔터를 안 눌러도 잠시 뒤 자동 저장됩니다. 여러 개를 한 번에 넣으려면 위의 일괄
                  붙여넣기를 쓰세요.
                </p>

                <TargetTable
                  rows={rows}
                  contacts={contacts}
                  sent={sent}
                  selected={selected}
                  templates={templates}
                  syncKey={syncKey}
                  onToggle={toggleRow}
                  onChange={handleContactChange}
                  onCommit={handleCommit}
                  onTypingChange={handleTypingChange}
                />

                <p className="mx-hint">
                  {rows.length}개사 표시 · 선택 {selectedRows.length}개사 중 {sendableRows.length}개사에
                  유효한 메일 주소가 있습니다
                  {selectedRows.length > sendableRows.length ? " (나머지는 주소를 채워야 발송됩니다)" : ""}
                </p>
              </div>
            </div>

            <div className="mx-side">
              <TemplatePanel
                templates={templates}
                activeId={activeTemplate.id}
                onSelect={actions.selectTemplate}
                onPatch={actions.patchTemplate}
                onAdd={actions.addTemplate}
                onRemove={actions.removeTemplate}
                onMove={actions.moveTemplate}
              />

              <PreviewPanel
                rows={selectedRows}
                partner={previewPartner}
                previewId={previewPartner?.id || ""}
                onChange={setPreviewId}
                contacts={contacts}
                template={previewPartner ? templateFor(previewPartner.id) : null}
              />

              <SendPanel
                selectedCount={selectedRows.length}
                sendableCount={sendableRows.length}
                withMailCount={withMailCount}
                busy={busy}
                progress={progress}
                log={log}
                notice={notice}
                confirmMode={confirmMode}
                templateSummary={templateSummary}
                bracketWarning={bracketWarning}
                route={route}
                sendKey={sendKey}
                connection={connection}
                onSendKeyChange={(v) => {
                  setSendKey(v);
                  setConnection({ state: "idle" });
                }}
                onTestConnection={testConnection}
                testAddress={testAddress}
                testState={testState}
                onTestAddressChange={(v) => {
                  setTestAddress(v);
                  setTestState({ state: "idle" });
                }}
                onSendTestMail={sendTestMail}
                onCsv={handleCsv}
                onCopy={handleCopy}
                onDraft={() => runSend("draft")}
                onAskSend={() => setConfirmMode(true)}
                onCancelSend={() => setConfirmMode(false)}
                onConfirmSend={() => {
                  setConfirmMode(false);
                  runSend("send");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
