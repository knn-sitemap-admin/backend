const KEY_PATTERNS = [
  /password/i,
  /newPassword/i,
  /oldPassword/i,
  /token/i,
  /accessToken/i,
  /refreshToken/i,
  /authorization/i,
];

function shouldMaskKey(key: string): boolean {
  return KEY_PATTERNS.some((re) => re.test(key));
}

function maskValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return '***';
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  return '***';
}

export function maskSensitiveJson(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((x) => maskSensitiveJson(x));
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = shouldMaskKey(k) ? maskValue(v) : maskSensitiveJson(v);
    }
    return out;
  }
  return input;
}
