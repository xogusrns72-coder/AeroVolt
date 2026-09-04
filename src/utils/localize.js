// 메일 본문이 영문이므로 한글 데이터(국가·지역·유형)를 영문으로 바꿔서 치환한다.
// 한글이 그대로 나가면 수신자가 읽을 수 없고, CSV를 구글시트 메일머지에 붙였을 때도
// 시트 값이 그대로 메일에 들어가므로 이 변환은 발송 경로 전체에서 동일하게 적용한다.

export const COUNTRY_EN = {
  베트남: "Vietnam",
  태국: "Thailand",
  말레이시아: "Malaysia",
  인도네시아: "Indonesia",
  싱가포르: "Singapore",
  // "in the Philippines"가 자연스러워서 관사를 포함시켰다.
  필리핀: "the Philippines",
};

// 지역 문자열은 "호치민 (하노이 지점)"처럼 본사 뒤에 지점이 붙는다.
// 배열 순서가 아니라 "문자열에서 가장 먼저 등장하는 도시"를 골라야 본사가 잡힌다.
export const CITY_EN = [
  ["쿠알라룸푸르", "Kuala Lumpur"], ["페탈링자야", "Petaling Jaya"], ["수방자야", "Subang Jaya"],
  ["세리켐방안", "Seri Kembangan"], ["숭아이불로", "Sungai Buloh"], ["숭아이자와", "Sungai Jawi"],
  ["샤알람", "Shah Alam"], ["스름반", "Seremban"], ["이스칸다르푸테리", "Iskandar Puteri"],
  ["조호르바루", "Johor Bahru"], ["바얀르파스", "Bayan Lepas"], ["프라이", "Prai"],
  ["푸총", "Puchong"], ["라왕", "Rawang"], ["페낭", "Penang"], ["슬랑오르", "Selangor"],
  ["방콕", "Bangkok"], ["논타부리", "Nonthaburi"], ["빠툼타니", "Pathum Thani"],
  ["사뭇프라칸", "Samut Prakan"], ["사뭇사콘", "Samut Sakhon"], ["촌부리", "Chonburi"],
  ["랏끄라방", "Lat Krabang"],
  ["메트로 마닐라", "Metro Manila"], ["마닐라", "Manila"], ["마카티", "Makati"],
  ["무인틀루빠", "Muntinlupa"], ["케손시티", "Quezon City"], ["파라냐케", "Parañaque"],
  ["파시그", "Pasig"], ["타이타이", "Taytay"], ["산타로사", "Santa Rosa"],
  ["산페드로", "San Pedro"], ["라구나", "Laguna"], ["세부", "Cebu"],
  ["북자카르타", "North Jakarta"], ["서자카르타", "West Jakarta"], ["자카르타", "Jakarta"],
  ["브카시", "Bekasi"], ["카라왕", "Karawang"], ["푸르와카르타", "Purwakarta"],
  ["수라바야", "Surabaya"], ["센툴", "Sentul"], ["보고르", "Bogor"], ["찌카랑", "Cikarang"],
  ["하노이", "Hanoi"], ["호치민", "Ho Chi Minh City"], ["다낭", "Da Nang"],
  ["쭈라이", "Chu Lai"], ["빈즈엉", "Binh Duong"],
  ["싱가포르", "Singapore"],
];

export const TYPE_EN = {
  시공: "installation", 유통: "distribution", 제조: "manufacturing",
  제작: "fabrication", 서비스: "service", 엔지니어링: "engineering",
  운영: "operations", 제어: "controls", 성과보증: "performance contracting",
};

export function countryEn(country) {
  return COUNTRY_EN[country] || country || "";
}

export function regionEn(region, country) {
  const text = String(region || "");
  let bestAt = -1;
  let bestKo = "";
  let bestEn = "";
  for (const [ko, en] of CITY_EN) {
    const at = text.indexOf(ko);
    if (at === -1) continue;
    // 더 앞에 있으면 교체하고, 같은 자리에서 겹치면 더 긴 이름을 택한다 (마닐라 vs 메트로 마닐라).
    if (bestAt === -1 || at < bestAt || (at === bestAt && ko.length > bestKo.length)) {
      bestAt = at;
      bestKo = ko;
      bestEn = en;
    }
  }
  return bestAt === -1 ? countryEn(country) : bestEn;
}

export function typeEn(type) {
  const parts = String(type || "")
    .split(/[+·]/)
    .map((x) => x.replace(/\(.*\)/, "").trim())
    .filter(Boolean);
  const out = [];
  parts.forEach((part) => {
    const en = TYPE_EN[part];
    if (en && !out.includes(en)) out.push(en);
  });
  if (out.length === 0) return "HVAC";
  if (out.length === 1) return out[0];
  return `${out.slice(0, -1).join(", ")} and ${out[out.length - 1]}`;
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

const GRADE_TOKEN_LABEL = { PENDING: "unrated", EXCLUDED: "excluded" };

// 치환에 쓰이는 값 묶음 — 미리보기·발송·CSV가 모두 같은 함수를 거치게 해서
// "화면은 영문인데 CSV만 한글" 같은 어긋남이 생기지 않도록 한다.
export function tokenValues(partner, contact = {}) {
  return {
    상호: partner.company_name || "",
    담당자: String(contact.person || "").trim() || "Sir or Madam",
    국가: countryEn(partner.country),
    지역: regionEn(partner.region, partner.country),
    유형: typeEn(partner.type),
    총점: Number(partner.total_score || 0).toFixed(1),
    등급: GRADE_TOKEN_LABEL[partner.display_grade] || partner.display_grade || "",
    "국가(한글)": partner.country || "",
    "지역(한글)": partner.region || partner.country || "",
  };
}

// 매칭되지 않는 토큰은 원문 그대로 남긴다 — 오타를 조용히 지워버리지 않기 위해서.
export function fillTemplate(text, partner, contact) {
  const map = tokenValues(partner, contact);
  return String(text || "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : whole
  );
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toHtmlBody(text) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">' +
    escapeHtml(text).replace(/\n/g, "<br>") +
    "</div>"
  );
}
