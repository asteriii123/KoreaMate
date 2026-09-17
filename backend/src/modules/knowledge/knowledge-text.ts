import { createHash } from "node:crypto";

export type PublicPlaceKnowledge = {
  name: string;
  nameZh: string | null;
  address: string | null;
  category: string | null;
  provider: string;
};

export function publicPlaceText(place: PublicPlaceKnowledge): string {
  return [
    `地点：${place.name}`,
    place.nameZh && place.nameZh !== place.name ? `中文名：${place.nameZh}` : null,
    place.address ? `地址：${place.address}` : null,
    place.category ? `类别：${place.category}` : null,
    `来源：${place.provider}`,
  ].filter((value): value is string => Boolean(value)).join("\n");
}

export function knowledgeHash(content: string): string {
  return createHash("sha256").update(content.normalize("NFKC")).digest("hex");
}

export function secureKnowledgeSourceUrl(value: string | null): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol === "http:" && url.hostname === "place.map.kakao.com") url.protocol = "https:";
  return url.protocol === "https:" ? url.toString() : null;
}
