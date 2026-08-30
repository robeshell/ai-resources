/**
 * Editorial copy limits and helpers shared by the ingest draft form.
 * Field-level issue auditing lives in the Curator server (contentIssueCount).
 */
export const COPY_LIMITS = {
  verdictZh: 16,
  verdictEn: 8,
  summaryZh: 32,
  summaryEn: 22,
};

export function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
