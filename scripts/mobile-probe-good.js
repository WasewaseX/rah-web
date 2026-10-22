(() => {
  const gradeBtns = [...document.querySelectorAll("button")].filter((b) => {
    const t = (b.textContent || "").replace(/\s+/g, "");
    return t.toUpperCase().startsWith("AGAIN") || t.toUpperCase().startsWith("HARD") || t.toUpperCase().startsWith("GOOD") || t.toUpperCase().startsWith("EASY");
  });
  return JSON.stringify(
    gradeBtns.map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const el = document.elementFromPoint(cx, cy);
      return {
        label: (b.textContent || "").replace(/\s+/g, "").toUpperCase(),
        y: Math.round(r.y),
        h: Math.round(r.height),
        bottom: Math.round(r.y + r.height),
        cover: el ? el.tagName + "." + (el.className || "").toString().slice(0, 50) : null,
        coveredByOther: el !== b && el !== null,
      };
    }),
  );
})()
