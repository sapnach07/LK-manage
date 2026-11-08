import { LenderProfile } from '../types/contract';

const LENDER_PROFILE_KEY = 'lk_manage_lender_profile';

const DEFAULT_LENDER_PROFILE: LenderProfile = {
  fullName: '',
  address: '',
  phone: '',
  city: 'Kinshasa',
  signature: '',
  defaultNoticeDays: 7,
  defaultJurisdiction: 'Kinshasa',
  minReadingTimeSeconds: 20,
};

export function getLenderProfile(): LenderProfile {
  if (typeof window === 'undefined') return DEFAULT_LENDER_PROFILE;
  try {
    const raw = localStorage.getItem(LENDER_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_LENDER_PROFILE,
        ...parsed,
        defaultNoticeDays: parsed.defaultNoticeDays ?? 7,
        defaultJurisdiction: parsed.defaultJurisdiction || 'Kinshasa',
        city: parsed.city || 'Kinshasa',
        minReadingTimeSeconds: parsed.minReadingTimeSeconds !== undefined ? Number(parsed.minReadingTimeSeconds) : 20,
      };
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_LENDER_PROFILE;
}

export function saveLenderProfile(profile: Partial<LenderProfile>): LenderProfile {
  const current = getLenderProfile();
  const updated: LenderProfile = {
    ...current,
    ...profile,
    defaultNoticeDays: profile.defaultNoticeDays ?? current.defaultNoticeDays ?? 7,
    defaultJurisdiction: profile.defaultJurisdiction || current.defaultJurisdiction || 'Kinshasa',
    city: profile.city || current.city || 'Kinshasa',
    minReadingTimeSeconds: profile.minReadingTimeSeconds !== undefined ? Number(profile.minReadingTimeSeconds) : (current.minReadingTimeSeconds ?? 20),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(LENDER_PROFILE_KEY, JSON.stringify(updated));
  }

  return updated;
}

export function isLenderProfileConfigured(profile: LenderProfile = getLenderProfile()): boolean {
  return (
    !!profile.fullName.trim() &&
    !!profile.phone.trim() &&
    !!profile.address.trim() &&
    !!profile.signature.trim()
  );
}
