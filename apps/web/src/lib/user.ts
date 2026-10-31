import type { UserProfile } from "@disha/core";

const KEY = "disha.user";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "u" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getUser(): UserProfile | null {
  try {
    const u = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return u?.id ? u : null;
  } catch {
    return null;
  }
}

export function saveUserName(name: string): UserProfile {
  const existing = getUser();
  const user = { id: existing?.id ?? uuid(), name: name.trim() };
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}
