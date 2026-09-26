import { Injectable } from "@nestjs/common";
import { CitationSchema, type Citation } from "@koreamate/contracts";

type ExternalProvider = Exclude<Citation["provider"], "koreamate">;

const providerDetails: Record<ExternalProvider, { name: string; domains: string[]; status: "verified" | "live_reference" }> = {
  kakao: { name: "Kakao", domains: ["kakao.com"], status: "verified" },
  "korea-tourism": { name: "韩国旅游数据", domains: ["visitkorea.or.kr", "data.go.kr"], status: "verified" },
  "open-meteo": { name: "Open-Meteo", domains: ["open-meteo.com"], status: "live_reference" },
  frankfurter: { name: "Frankfurter", domains: ["frankfurter.app"], status: "live_reference" },
  "rollinggo-hotel": { name: "RollingGo", domains: ["rollinggo.com", "rollinggo.cn"], status: "live_reference" },
  variflight: { name: "Variflight", domains: ["variflight.com"], status: "live_reference" },
};

@Injectable()
export class CitationFactory {
  external(input: { provider: ExternalProvider; sourceUrl?: string | null; fetchedAt: Date | string; expiresAt?: Date | string | null; now?: Date }): Citation {
    const details = providerDetails[input.provider];
    const fetchedAt = this.iso(input.fetchedAt);
    const expiresAt = input.expiresAt ? this.iso(input.expiresAt) : null;
    return CitationSchema.parse({ status: details.status, provider: input.provider, label: `${details.status === "verified" ? "已核验" : "实时参考"} · ${details.name}`, sourceUrl: this.safeUrl(input.sourceUrl, details.domains), fetchedAt, expiresAt, stale: expiresAt ? new Date(expiresAt).getTime() <= (input.now ?? new Date()).getTime() : false });
  }

  assistant(): Citation {
    return CitationSchema.parse({ status: "assistant_suggestion", provider: "koreamate", label: "小助理建议", sourceUrl: null, fetchedAt: null, expiresAt: null, stale: false });
  }

  private safeUrl(value: string | null | undefined, domains: string[]): string | null {
    if (!value) return null;
    try { const url = new URL(value); return url.protocol === "https:" && domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.toString() : null; } catch { return null; }
  }

  private iso(value: Date | string): string { return (value instanceof Date ? value : new Date(value)).toISOString(); }
}
