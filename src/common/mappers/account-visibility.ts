export type VisibleAccount<T extends { isDisabled: boolean }> = T;

export function maskIfDisabled<
  T extends {
    isDisabled: boolean;
    name: string | null;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
  },
>(input: T): T {
  if (!input.isDisabled) return input;

  return {
    ...input,
    name: '탈퇴회원',
    email: null,
    phone: null,
    photoUrl: null,
  };
}
