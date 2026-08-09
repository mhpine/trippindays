export const UNLOCKED_STAMPS_KEY = "trippindays-unlocked-stamps";

export function readUnlockedStamps(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(UNLOCKED_STAMPS_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function unlockStamp(slug: string) {
  const current = readUnlockedStamps();
  const updated = Array.from(new Set([...current, slug]));
  localStorage.setItem(UNLOCKED_STAMPS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("trippindays-stamps-updated"));
}
