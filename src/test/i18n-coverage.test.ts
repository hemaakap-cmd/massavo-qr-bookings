import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import en from "../i18n/locales/en.json";
import de from "../i18n/locales/de.json";

function flatten(obj: any, prefix = "", out: Record<string, string> = {}) {
  for (const k in obj) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v as string;
  }
  return out;
}

const fEn = flatten(en);
const fDe = flatten(de);

describe("i18n English coverage", () => {
  it("EN and DE have the same number of keys", () => {
    expect(Object.keys(fEn).length).toBe(Object.keys(fDe).length);
  });

  it("Every DE key exists in EN", () => {
    const missing = Object.keys(fDe).filter((k) => !(k in fEn));
    expect(missing).toEqual([]);
  });

  it("Every EN key exists in DE", () => {
    const missing = Object.keys(fEn).filter((k) => !(k in fDe));
    expect(missing).toEqual([]);
  });

  it("EN values do not contain common German function words", () => {
    const germanWords =
      /\b(und|oder|nicht|für|über|werden|können|haben|sein|deine?|deinem?|dich|wir|unser|sich|zum|zur|nach|wenn|sind|jetzt|hier|bitte|Buchung|Termin|Auswählen|Bezahlen|Weiter|Zurück|Anmelden|Speichern|Löschen|Bearbeiten|Hinzufügen|Schließen|Abbrechen|Bestätigen)\b/;
    const offenders = Object.entries(fEn).filter(
      ([, v]) => typeof v === "string" && germanWords.test(v)
    );
    expect(offenders).toEqual([]);
  });

  it("EN values contain at most 1 string with German umlauts (ä/ö/ü/ß)", () => {
    // Currently: about.story.p2 mentions Köln/Düsseldorf as proper city names.
    const umlaut = /[äöüßÄÖÜ]/;
    const offenders = Object.entries(fEn).filter(
      ([, v]) => typeof v === "string" && umlaut.test(v)
    );
    expect(offenders.length).toBeLessThanOrEqual(1);
  });
});

describe("Hardcoded German strings regression guard", () => {
  // Baseline measured 2026-05-12. Any new hardcoded German strings should fail.
  const BASELINE = 146;

  function walk(dir: string, files: string[] = []): string[] {
    const skip = new Set([
      "node_modules",
      "dist",
      ".git",
      "test",
      "__tests__",
      "i18n",
      "locales",
    ]);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, files);
      else if (
        (p.endsWith(".tsx") || p.endsWith(".ts")) &&
        !/\.(test|spec)\.tsx?$/.test(p)
      )
        files.push(p);
    }
    return files;
  }

  it("does not exceed the baseline of hardcoded German strings", () => {
    const indicator =
      /[äöüßÄÖÜ]|\b(und|oder|nicht|mit|für|über|werden|können|haben|deine?|wir|unser|jetzt|bitte|Buchung|Termin|Auswählen|Bezahlen|Weiter|Zurück|Anmelden|Speichern|Löschen|Bearbeiten|Hinzufügen|Schließen|Abbrechen|Bestätigen|Männlich|Weiblich|Schwangerschaft|Schmerzen|Beschwerden)\b/;
    const files = walk(path.resolve(__dirname, ".."));
    let count = 0;
    for (const f of files) {
      const content = fs
        .readFileSync(f, "utf8")
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      for (const line of content.split("\n")) {
        if (
          line.includes("console.") ||
          line.trimStart().startsWith("import ")
        )
          continue;
        const re = /"([^"\\\n]{4,}?)"|'([^'\\\n]{4,}?)'|>([^<>{}\n]{4,}?)</g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
          const txt = m[1] || m[2] || m[3];
          if (!txt) continue;
          if (indicator.test(txt) && !/^[a-z_-]+$/i.test(txt)) count++;
        }
      }
    }
    // Allow small tolerance but fail if regression introduces new strings.
    expect(count).toBeLessThanOrEqual(BASELINE);
  });
});