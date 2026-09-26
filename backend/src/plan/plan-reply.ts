import type { PendingField, TripRequirements } from "./plan-provider.js";

const chineseDigits: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 俩: 2, 三: 3, 仨: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseNumber(text: string): number | null {
  const arabic = text.match(/\d+(?:\.\d+)?/);
  if (arabic) return Number(arabic[0]);
  const compact = text.replace(/\s/g, "");
  for (const [character, value] of Object.entries(chineseDigits)) {
    if (compact.includes(character)) return value;
  }
  return null;
}

export function applyContextAnswer(
  requirements: TripRequirements | null,
  pendingField: PendingField | null,
  text: string,
): TripRequirements | null {
  if (!requirements || !pendingField) return requirements;
  const value = parseNumber(text);
  if (value === null) return requirements;
  if (pendingField === "travelers" && Number.isInteger(value) && value >= 1 && value <= 20) {
    return { ...requirements, travelers: value };
  }
  if (pendingField === "days" && Number.isInteger(value) && value >= 1 && value <= 30) {
    return { ...requirements, days: value };
  }
  if (pendingField === "budget" && value > 0) {
    return { ...requirements, budget: value };
  }
  if (pendingField === "flightBudget" && value > 0) {
    return { ...requirements, flightBudget: value };
  }
  if (pendingField === "hotelBudget" && value > 0) {
    return { ...requirements, hotelBudget: value };
  }
  return requirements;
}

export function inferPendingField(question: string, requirements: TripRequirements): PendingField {
  if (/几(个|位)?人|同行|出行人数/.test(question)) return "travelers";
  if (/几天|多久/.test(question)) return "days";
  if (/机票.*(预算|多少钱|费用)/.test(question)) return "flightBudget";
  if (/(酒店|住宿).*(预算|多少钱|费用)/.test(question)) return "hotelBudget";
  if (/含.*(机票|机酒|酒店)|纯玩|预算.*(含|包含)/.test(question)) return "budgetScope";
  if (/从哪|出发地|出发城市|哪个城市出发|哪里出发/.test(question)) return "departureCity";
  if (/预算|多少钱/.test(question)) return "budget";
  if (/什么时候|日期|几月/.test(question)) return "startDate";
  if (/哪里|哪座城市|目的地/.test(question)) return "destination";
  if (!requirements.destination) return "destination";
  if (!requirements.departureCity) return "departureCity";
  if (!requirements.days) return "days";
  if (!requirements.travelers) return "travelers";
  if (!requirements.budgetScope) return "budgetScope";
  if (requirements.budgetScope === "all_inclusive" && !requirements.flightBudget) return "flightBudget";
  if (requirements.budgetScope === "all_inclusive" && !requirements.hotelBudget) return "hotelBudget";
  return "budget";
}
