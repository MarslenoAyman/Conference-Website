// Lightweight Arabic <-> English translation for user-written content
// (instruction sections + instructions). Uses the free MyMemory API, and always
// falls back to the original text if translation is unavailable, so a failed or
// slow call never blocks or errors an add/edit — it just skips the translation.

const ARABIC_RE = /[؀-ۿ]/;

export function detectLang(text) {
  return ARABIC_RE.test(text) ? "ar" : "en";
}

async function translateOnce(text, from, to) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const out = data?.responseData?.translatedText;
    // MyMemory echoes an all-caps warning in translatedText on quota errors.
    if (typeof out === "string" && out.trim() && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) {
      return out.trim();
    }
  } catch {
    /* network/timeout — fall back to the original */
  }
  return null;
}

// Given text written in either language, return { ar, en }. The source language
// keeps the exact original; the other is translated (or mirrors the original if
// translation is unavailable).
export async function bilingual(text) {
  const src = String(text || "").trim();
  if (!src) return { ar: "", en: "" };
  const from = detectLang(src);
  const to = from === "ar" ? "en" : "ar";
  const translated = (await translateOnce(src, from, to)) || src;
  return from === "ar" ? { ar: src, en: translated } : { ar: translated, en: src };
}
