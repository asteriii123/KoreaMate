import type { MemoryCandidate } from "@koreamate/contracts";

export interface MemoryExtractor {
  extract(text: string): Promise<MemoryCandidate[]>;
}
