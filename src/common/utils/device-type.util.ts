export type DeviceType = 'pc' | 'mobile';

/**
 * - 태블릿도 mobile로 처리
 * - UA가 비어있거나 알 수 없으면 pc로 처리(안전 기본값)
 */
export function detectDeviceType(
  userAgent: string | undefined | null,
): DeviceType {
  const ua = String(userAgent ?? '')
    .toLowerCase()
    .trim();
  if (!ua) return 'pc';

  // mobile 판별 키워드
  const mobileHints = [
    'mobi', // Mobile
    'android',
    'iphone',
    'ipad',
    'ipod',
    'windows phone',
    'iemobile',
    'blackberry',
    'bb10',
    'opera mini',
    'opera mobi',
    'tablet', // 일부 태블릿 UA
    'silk', // Kindle
    'kindle',
  ];

  for (const hint of mobileHints) {
    if (ua.includes(hint)) return 'mobile';
  }

  return 'pc';
}
