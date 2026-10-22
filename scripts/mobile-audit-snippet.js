// Task 69: real mobile-browser audit. Run per view via agent-browser eval.
// Measures: horizontal overflow, page height, sub-40px tap targets among
// visible interactive elements, and the smallest tap target found.
(() => {
  const inter = [...document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')];
  const visible = inter.filter((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.pointerEvents !== "none";
  });
  const small = visible
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { t: (el.textContent || el.getAttribute("aria-label") || "?").trim().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) };
    })
    .filter((x) => x.w < 40 || x.h < 40)
    .sort((a, b) => a.w + a.h - (b.w + b.h))
    .slice(0, 6);
  const doc = document.documentElement;
  return JSON.stringify({
    overflowX: doc.scrollWidth > window.innerWidth,
    scrollW: doc.scrollWidth,
    pageH: doc.scrollHeight,
    interactives: visible.length,
    smallTargets: small.length,
    worst: small,
  });
})()
