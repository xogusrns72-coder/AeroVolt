import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createTemplate, initialTemplates, renumber } from "../data/mailTemplates";

/*
  발송 콘솔의 저장소 — 입력한 이메일이 유실되지 않는 것이 이 파일의 유일한 목적이다.

  과거에 크게 데었던 지점: 자동 저장 → 저장 결과 스냅샷이 되돌아옴 → 그 값으로 상태를 덮어씀
  → 표 전체 리렌더 → 입력 중이던 필드가 새로 만들어지며 포커스와 이후 입력이 날아감.

  그래서 두 가지 규칙을 코드로 못박는다.
  ① 2중 저장 — 입력 즉시 localStorage, 0.9초 디바운스 후 아티팩트 db. 로컬이 먼저다.
  ② 로컬 우선 병합 — 서버 스냅샷은 로컬 값을 절대 덮어쓰지 않는다. 최초 1회 하이드레이션에서만
     서버 값을 통째로 채택하고, 그 뒤로는 로컬에 키가 아예 없는 항목만 채운다.
*/

const LS_KEY = "aerovolt.outreach.v1";
const DB_DOC = "outreach/state";
const DEBOUNCE_MS = 900;

function emptyData() {
  const templates = initialTemplates();
  return {
    contacts: {}, // { [partnerId]: { email, person, templateId } }
    sent: {},     // { [partnerId]: { status, at, subject } }
    templates,
    activeTemplateId: templates[0].id,
  };
}

function sanitize(raw, fallback) {
  if (!raw || typeof raw !== "object") return fallback;
  const next = { ...fallback };
  if (raw.contacts && typeof raw.contacts === "object") next.contacts = { ...raw.contacts };
  if (raw.sent && typeof raw.sent === "object") next.sent = { ...raw.sent };
  if (Array.isArray(raw.templates) && raw.templates.length > 0) {
    next.templates = renumber(
      raw.templates
        .filter((t) => t && typeof t === "object" && t.id)
        .map((t) => ({
          id: String(t.id),
          no: Number(t.no) || 0,
          name: String(t.name || "이름 없음"),
          subject: String(t.subject || ""),
          body: String(t.body || ""),
        }))
    );
  }
  if (next.templates.length === 0) next.templates = initialTemplates();
  const active = next.templates.find((t) => t.id === raw.activeTemplateId);
  next.activeTemplateId = active ? active.id : next.templates[0].id;
  return next;
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch {
    return null;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "contact": {
      const { id, patch } = action;
      return { ...state, contacts: { ...state.contacts, [id]: { ...state.contacts[id], ...patch } } };
    }
    case "contacts-bulk": {
      const contacts = { ...state.contacts };
      Object.entries(action.entries).forEach(([id, patch]) => {
        contacts[id] = { ...contacts[id], ...patch };
      });
      return { ...state, contacts };
    }
    case "sent":
      return { ...state, sent: { ...state.sent, [action.id]: action.record } };
    case "template-patch":
      return {
        ...state,
        templates: state.templates.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case "template-add": {
      const templates = renumber([...state.templates, action.template]);
      return { ...state, templates, activeTemplateId: action.template.id };
    }
    case "template-remove": {
      if (state.templates.length <= 1) return state;
      const index = state.templates.findIndex((t) => t.id === action.id);
      if (index === -1) return state;
      const templates = renumber(state.templates.filter((t) => t.id !== action.id));
      const activeTemplateId =
        state.activeTemplateId === action.id
          ? templates[Math.min(index, templates.length - 1)].id
          : state.activeTemplateId;
      // 지워진 템플릿을 가리키던 행별 지정은 "현재 선택 따름"으로 되돌린다.
      const contacts = {};
      Object.entries(state.contacts).forEach(([id, c]) => {
        contacts[id] = c && c.templateId === action.id ? { ...c, templateId: "" } : c;
      });
      return { ...state, templates, activeTemplateId, contacts };
    }
    case "template-move": {
      const from = state.templates.findIndex((t) => t.id === action.id);
      const to = from + action.delta;
      if (from === -1 || to < 0 || to >= state.templates.length) return state;
      const templates = [...state.templates];
      const [moved] = templates.splice(from, 1);
      templates.splice(to, 0, moved);
      return { ...state, templates: renumber(templates) };
    }
    case "template-active":
      return { ...state, activeTemplateId: action.id };
    case "hydrate":
      return sanitize(action.data, emptyData());
    case "merge-missing": {
      // 로컬에 키가 "아예 없는" 항목만 채운다 — 입력 중인 값은 절대 건드리지 않는다.
      const incoming = action.data || {};
      let changed = false;
      const next = { ...state };
      ["contacts", "sent"].forEach((key) => {
        const src = incoming[key];
        if (!src || typeof src !== "object") return;
        const merged = { ...state[key] };
        Object.keys(src).forEach((id) => {
          if (!Object.prototype.hasOwnProperty.call(merged, id)) {
            merged[id] = src[id];
            changed = true;
          }
        });
        next[key] = merged;
      });
      if (Array.isArray(incoming.templates)) {
        const have = new Set(state.templates.map((t) => t.id));
        const extra = incoming.templates.filter((t) => t && t.id && !have.has(t.id));
        if (extra.length > 0) {
          next.templates = renumber([...state.templates, ...extra]);
          changed = true;
        }
      }
      return changed ? next : state;
    }
    default:
      return state;
  }
}

function init() {
  const local = loadLocal();
  return local ? sanitize(local, emptyData()) : emptyData();
}

export default function useOutreachStore() {
  const [data, dispatch] = useReducer(reducer, undefined, init);
  const [saveState, setSaveState] = useState("saved"); // saved | dirty | saving | error
  const [lastSavedAt, setLastSavedAt] = useState(() => loadLocal()?.savedAt || null);
  const [dbOn, setDbOn] = useState(false);

  // 저장 함수들이 항상 최신 값을 보도록 미러링한다 (effect는 다음 사용자 이벤트보다 먼저 실행된다).
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const dbRef = useRef(null);
  const timerRef = useRef(null);
  const hadLocalRef = useRef(loadLocal() !== null);
  const hydratedRef = useRef(false);
  const firstRunRef = useRef(true);

  const snapshot = useCallback(() => ({ ...dataRef.current, savedAt: Date.now() }), []);

  const saveLocal = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot()));
      hadLocalRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, [snapshot]);

  const flushSave = useCallback(async () => {
    clearTimeout(timerRef.current);
    saveLocal();
    if (!dbRef.current) {
      setSaveState("saved");
      setLastSavedAt(Date.now());
      return;
    }
    setSaveState("saving");
    try {
      await dbRef.current.set(snapshot());
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch {
      setSaveState("error");
    }
  }, [saveLocal, snapshot]);

  // 데이터가 바뀌면 로컬은 즉시, 서버는 디바운스해서 저장한다.
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return undefined;
    }
    saveLocal();
    setSaveState("dirty");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushSave, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [data, saveLocal, flushSave]);

  // 아티팩트 db 연결 — 일반 웹(GitHub Pages)에는 window.claude가 없어 로컬 저장만 쓴다.
  useEffect(() => {
    let unsubscribe = null;
    let alive = true;
    if (typeof window === "undefined" || typeof window.claude?.use !== "function") return undefined;
    window.claude
      .use("db")
      .then((db) => {
        if (!alive || !db) return;
        dbRef.current = db.doc(DB_DOC);
        setDbOn(true);
        unsubscribe = dbRef.current.onSnapshot(
          (snap) => {
            if (!alive) return;
            if (!snap || !snap.exists) {
              hydratedRef.current = true;
              return;
            }
            const incoming = snap.data() || {};
            if (!hydratedRef.current && !hadLocalRef.current) {
              dispatch({ type: "hydrate", data: incoming });
            } else {
              dispatch({ type: "merge-missing", data: incoming });
            }
            hydratedRef.current = true;
          },
          () => {
            if (!alive) return;
            dbRef.current = null;
            setDbOn(false);
            setSaveState("error");
          }
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // 자리를 뜰 때 밀린 저장을 한 번 더 반영한다.
  useEffect(() => {
    const onHide = () => saveLocal();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        saveLocal();
        flushSave();
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [saveLocal, flushSave]);

  const actions = useMemo(
    () => ({
      setContact: (id, patch) => dispatch({ type: "contact", id, patch }),
      setContacts: (entries) => dispatch({ type: "contacts-bulk", entries }),
      setSent: (id, record) => dispatch({ type: "sent", id, record }),
      patchTemplate: (id, patch) => dispatch({ type: "template-patch", id, patch }),
      addTemplate: (patch) => dispatch({ type: "template-add", template: createTemplate(patch) }),
      removeTemplate: (id) => dispatch({ type: "template-remove", id }),
      moveTemplate: (id, delta) => dispatch({ type: "template-move", id, delta }),
      selectTemplate: (id) => dispatch({ type: "template-active", id }),
    }),
    []
  );

  return { data, actions, saveState, lastSavedAt, dbOn, flushSave };
}
