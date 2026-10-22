(() => {
  // 1. Reveal: fill the input and click Check (all via JS, no coordinates).
  const inp = document.querySelector("textarea, input[type=text], input[placeholder]");
  if (!inp) return JSON.stringify({ err: "no input" });
  const proto = inp.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(inp, "garner");
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  const check = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim().toLowerCase() === "check");
  if (!check) return JSON.stringify({ err: "no check button" });
  check.click();
  return JSON.stringify({ clickedCheck: true });
})()
