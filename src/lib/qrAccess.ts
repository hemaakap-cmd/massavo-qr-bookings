const KEY = "massavo_qr_access_v1";

type Scope = "gym" | "hotel" | "any";

export function grantQRAccess(scope: "gym" | "hotel") {
  try {
    const raw = sessionStorage.getItem(KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(scope);
    sessionStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function hasQRAccess(scope: Scope = "any"): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const arr: string[] = JSON.parse(raw);
    if (scope === "any") return arr.length > 0;
    return arr.includes(scope);
  } catch {
    return false;
  }
}

export function clearQRAccess() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}