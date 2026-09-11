export const RANDOM_VIDEO_MIN_AGE = 18;
export const MAX_VIDEO_CHAT_MESSAGE_LENGTH = 500;

export type SafetyReason = 'length' | 'link' | 'contact' | 'phone' | 'address' | 'spam';

export type SafetyCheck = {
  allowed: boolean;
  reason?: SafetyReason;
  message?: string;
};

const externalLinkPattern = /(?:https?:\/\/|www\.|(?:t\.me|discord(?:app)?\.com|open\.kakao\.com|wa\.me|line\.me|bit\.ly|tinyurl\.com)\b)/i;
const contactPattern = /(?:카카오톡|카톡|텔레그램|telegram|whatsapp|왓츠앱|discord|디스코드|wechat|위챗|line\s*(?:id|아이디)?|스냅챗|snapchat|인스타|instagram|kakao|tg\s*[:@]|dm\s*me|연락처|아이디|아이디는|아이디\s*[:=]|@)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d|01[016789][\s.-]?\d{3,4}[\s.-]?\d{4})/;
const addressPattern = /(?:\d{1,5}\s*(?:번지|번|호|층)|(?:대로|로|길)\s*\d+|아파트|apt\.?|street|avenue|road|rd\.?|st\.?|주소|우편번호|zip\s*code)/i;

export function inspectSafetyText(value: string): SafetyCheck {
  const text = value.trim();
  if (!text) return { allowed: false, reason: 'length', message: '메시지를 입력해주세요.' };
  if (text.length > MAX_VIDEO_CHAT_MESSAGE_LENGTH) {
    return { allowed: false, reason: 'length', message: `메시지는 ${MAX_VIDEO_CHAT_MESSAGE_LENGTH}자 이내로 입력해주세요.` };
  }
  if (externalLinkPattern.test(text)) {
    return { allowed: false, reason: 'link', message: '외부 링크는 안전을 위해 화상채팅에서 보낼 수 없습니다.' };
  }
  if (emailPattern.test(text)) {
    return { allowed: false, reason: 'contact', message: '이메일·외부 연락처 공유는 화상채팅에서 제한됩니다.' };
  }
  if (phonePattern.test(text)) {
    return { allowed: false, reason: 'phone', message: '전화번호 공유는 안전을 위해 제한됩니다.' };
  }
  if (addressPattern.test(text)) {
    return { allowed: false, reason: 'address', message: '주소·거주지 정보 공유는 안전을 위해 제한됩니다.' };
  }
  if (contactPattern.test(text)) {
    return { allowed: false, reason: 'spam', message: '외부 연락처 도배와 개인 연락 유도는 화상채팅에서 제한됩니다.' };
  }
  return { allowed: true };
}

export function getVideoAlias(userId: string, name?: string, random = true): string {
  if (!random && name?.trim()) return name.trim().slice(0, 40);
  const suffix = userId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'USER';
  return `익명-${suffix}`;
}

export function allowClientAction(key: string, limit: number, windowMs: number): boolean {
  if (typeof window === 'undefined') return true;
  const storageKey = `gyopo-safety-rate:${key}`;
  const now = Date.now();
  try {
    const previous = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]') as unknown;
    const timestamps = Array.isArray(previous) ? previous.filter((item): item is number => typeof item === 'number' && now - item < windowMs) : [];
    if (timestamps.length >= limit) return false;
    timestamps.push(now);
    window.sessionStorage.setItem(storageKey, JSON.stringify(timestamps));
    return true;
  } catch {
    return true;
  }
}
