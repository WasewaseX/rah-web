(() => {
  const btns = [...document.querySelectorAll("button")];
  const good = btns.find((b) => (b.textContent || "").replace(/\s+/g, "").startsWith("GOOD"));
  const fixed = [...document.querySelectorAll("div, nav, aside, header")].filter((el) => getComputedStyle(el).position === "fixed");
  return JSON.stringify({
    goodFound: !!good,
    goodRect: good ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(good.getBoundingClientRect()) : null,
    fixedEls: fixed.map((el) => ({
      cls: (el.className || "").toString().slice(0, 70),
      tag: el.tagName,
      rect: (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()),
      z: getComputedStyle(el).zIndex,
    })),
    vh: window.innerHeight,
  });
})()
