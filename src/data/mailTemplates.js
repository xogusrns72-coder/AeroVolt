// 메일 템플릿 라이브러리 — 여러 개를 번호로 저장해두고 발송할 때 고른다.
// 시공사와 유통사에 다른 내용을 한 번에 보낼 수 있어야 하므로 행별 지정도 지원한다.

export const TOKENS = [
  "{{상호}}", "{{담당자}}", "{{국가}}", "{{지역}}",
  "{{유형}}", "{{총점}}", "{{등급}}", "{{국가(한글)}}",
];

// 대괄호 [ ] 부분은 사용자가 직접 채우는 자리다 — 남아 있으면 발송 전에 경고한다.
export const BRACKET_PATTERN = /\[[^\]\n]{1,30}\]/;

export const DEFAULT_TEMPLATE = {
  name: "시공사 제안",
  subject: "Fabric duct partnership in Southeast Asia — {{상호}}",
  body: [
    "Dear {{담당자}},",
    "",
    "My name is [이름] and I write from [회사명], a Korean manufacturer of fabric (textile) air duct systems for industrial and commercial HVAC.",
    "",
    "We are building a partner network across Southeast Asia, and {{상호}} came up in our review of HVAC contractors in {{국가}}.",
    "",
    "Fabric duct is a lightweight alternative to sheet metal: it ships flat, installs in a fraction of the time, needs no external insulation, and avoids the condensation and dust problems that metal duct runs into in humid climates. For a contractor it sits naturally alongside the work your teams already do.",
    "",
    "If this is of interest, I would be glad to send our catalogue and reference projects, or set up a short online call at a time that suits you.",
    "",
    "If you would rather not receive further messages from us, simply reply to this email and we will remove your address.",
    "",
    "Best regards,",
    "",
    "[이름]",
    "[직함] · [회사명]",
    "[전화] · [웹사이트]",
  ].join("\n"),
};

let templateSeq = 0;

export function newTemplateId() {
  templateSeq += 1;
  return `tpl_${Date.now().toString(36)}_${templateSeq}`;
}

export function createTemplate(patch = {}) {
  return {
    id: newTemplateId(),
    no: 1,
    name: "새 템플릿",
    subject: "",
    body: "",
    ...patch,
  };
}

// no는 표시용 번호일 뿐이므로 순서가 바뀌면 항상 1부터 다시 매긴다.
export function renumber(templates) {
  return templates.map((t, i) => (t.no === i + 1 ? t : { ...t, no: i + 1 }));
}

export function initialTemplates() {
  return renumber([createTemplate(DEFAULT_TEMPLATE)]);
}
