// Maps an uploaded bank statement's file name to a real logo asset (sourced
// from the Bank Logos folder) so the dashboard can show recognizable brand
// marks instead of a generic icon wherever the counterparty is a bank we
// have artwork for. Banks in the reconciliation universe without artwork
// (Standard Chartered, Steward) fall back to a labelled generic mark.

export interface BankIdentity {
  key: string;
  label: string;
  /** Public path to a transparent-background logo PNG, or null when no
   * artwork is available for this bank yet. */
  logo: string | null;
}

const BANK_PATTERNS: Array<{
  key: string;
  label: string;
  pattern: RegExp;
  hasLogo: boolean;
}> = [
  { key: 'cabs', label: 'CABS', pattern: /\bcabs\b/i, hasLogo: true },
  { key: 'cbz', label: 'CBZ', pattern: /\bcbz\b/i, hasLogo: true },
  { key: 'nmb', label: 'NMB', pattern: /\bnmb\b/i, hasLogo: true },
  {
    key: 'stanchart',
    label: 'Standard Chartered',
    pattern: /stan(dard)?[\s._-]*chart|\bscb\b/i,
    hasLogo: false,
  },
  { key: 'stanbic', label: 'Stanbic', pattern: /stanbic/i, hasLogo: true },
  {
    key: 'bancabc',
    label: 'BancABC',
    pattern: /banc[\s._-]*abc/i,
    hasLogo: true,
  },
  { key: 'ecocash', label: 'Ecocash', pattern: /ecocash/i, hasLogo: true },
  {
    key: 'steward',
    label: 'Steward Bank',
    pattern: /steward/i,
    hasLogo: false,
  },
  { key: 'fbc', label: 'FBC', pattern: /\bfbc\b/i, hasLogo: true },
  { key: 'afc', label: 'AFC', pattern: /\bafc\b/i, hasLogo: true },
  {
    key: 'metbank',
    label: 'MetBank',
    pattern: /met[\s._-]*bank/i,
    hasLogo: true,
  },
  {
    key: 'nedbank',
    label: 'NedBank',
    pattern: /ned[\s._-]*bank/i,
    hasLogo: true,
  },
  {
    key: 'zb',
    label: 'ZB Financial Holdings',
    pattern: /\bzb\b|zb[\s._-]*financial/i,
    hasLogo: true,
  },
];

export function identifyBank(fileName: string): BankIdentity {
  for (const b of BANK_PATTERNS) {
    if (b.pattern.test(fileName)) {
      return {
        key: b.key,
        label: b.label,
        logo: b.hasLogo ? `/bank-logos/${b.key}.png` : null,
      };
    }
  }
  return { key: 'unknown', label: 'Bank statement', logo: null };
}
