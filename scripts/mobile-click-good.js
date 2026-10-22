(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").toUpperCase().indexOf("GOOD") === 0);
  if (!b) return JSON.stringify({ err: "no GOOD button" });
  b.click();
  return JSON.stringify({ clicked: true });
})()
