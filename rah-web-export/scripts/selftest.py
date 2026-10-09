#!/usr/bin/env python3
"""Self-test Rah in a headless browser: click through every view, exercise
the flows, capture console errors, and take screenshots."""
import asyncio
import json
import pathlib
import sys

from playwright.async_api import async_playwright

DIST = pathlib.Path("/home/z/my-project/rah-repo/dist")
SHOTS = pathlib.Path("/home/z/my-project/download/screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)

BASE = "http://127.0.0.1:8877"
errors: list[str] = []
console_msgs: list[str] = []


async def new_page(ctx, fresh=False):
    page = await ctx.new_page()
    page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    await page.goto(f"{BASE}/{'?fresh=1' if fresh else ''}", wait_until="networkidle")
    return page


async def shot(page, name, wait=500):
    await page.wait_for_timeout(wait)
    await page.screenshot(path=str(SHOTS / f"{name}.png"))
    print(f"shot: {name}")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)

        # fresh session: onboarding placement flow
        page = await new_page(ctx, fresh=True)
        await page.evaluate("localStorage.clear()")
        await page.goto(f"{BASE}/?fresh=1", wait_until="networkidle")
        await page.wait_for_timeout(600)
        await shot(page, "01-placement-start")
        await page.click("#pl-start")
        await page.wait_for_timeout(500)
        await shot(page, "02-placement-question")
        # answer a few items
        for i in range(3):
            choices = page.locator("#pl-choices .choice")
            if await choices.count() == 0:
                break
            await choices.first.click()
            await page.wait_for_timeout(650)
        # skip writing -> result
        skip = page.locator("#plw-skip")
        if await skip.count():
            # jump to writing step by answering remaining items quickly
            for _ in range(40):
                if await page.locator("#plw-skip").count():
                    break
                ch = page.locator("#pl-choices .choice")
                if not await ch.count():
                    break
                await ch.first.click()
                await page.wait_for_timeout(560)
            if await page.locator("#plw-skip").count():
                await page.click("#plw-skip")
                await page.wait_for_timeout(500)
                await shot(page, "03-placement-result")
        await close_ctx(ctx, browser)

        # seeded session: full tour
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        page = await new_page(ctx)
        await page.evaluate("localStorage.clear()")
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(900)
        await shot(page, "10-dashboard")

        # review flow
        await page.goto(f"{BASE}/#/review", wait_until="networkidle")
        await page.wait_for_timeout(700)
        await shot(page, "11-review-card")
        # answer: type or MCQ or show answer
        typ = page.locator("#rv-type")
        check = page.locator("#rv-check")
        gapc = page.locator("#rv-choices .choice")
        if await typ.count():
            # find the real answer via demo deck lookup (cheat: evaluate demo data)
            answer = await page.evaluate(
                "async () => { const r = await (window.__demoLookup ? window.__demoLookup() : null); return r; }")
            # type something plausible; wrong answers also exercise the miss UI
            await typ.fill("decision")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(600)
            await shot(page, "12-review-miss-or-hit")
            # grade Good with keyboard 3
            await page.keyboard.press("3")
            await page.wait_for_timeout(600)
        elif await gapc.count():
            await gapc.first.click()
            await page.wait_for_timeout(600)
            await shot(page, "12-review-gap-feedback")
            await page.click("#rv-grade-2")
            await page.wait_for_timeout(500)
        elif await check.count():
            await check.click()
            await page.wait_for_timeout(600)
            await shot(page, "12-review-selfgraded")
            await page.click("#rv-grade-4")
            await page.wait_for_timeout(500)
        # one more card to show the session progress
        for _ in range(2):
            typ = page.locator("#rv-type")
            gapc = page.locator("#rv-choices .choice")
            chk = page.locator("#rv-check")
            if await typ.count():
                await typ.fill("test")
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(500)
                await page.click("#rv-grade-3")
            elif await gapc.count():
                await gapc.first.click()
                await page.wait_for_timeout(500)
            elif await chk.count():
                await chk.click()
                await page.wait_for_timeout(500)
                await page.click("#rv-grade-3")
            else:
                break
            await page.wait_for_timeout(500)
        await shot(page, "13-review-second")

        # chat flow
        await page.goto(f"{BASE}/#/chat", wait_until="networkidle")
        await page.wait_for_timeout(500)
        await page.fill("#ch-input", "I have seen him yesterday at the park. It was crowded.")
        await page.click("#ch-send")
        await page.wait_for_timeout(800)
        await shot(page, "14-chat-corrections")

        # writing lab
        await page.goto(f"{BASE}/#/writing", wait_until="networkidle")
        await page.wait_for_timeout(400)
        essay = ("In my opinion, remote work has changed how companies operate. "
                 "Many employees have more freedom now, but some managers believe it "
                 "reduces cooperation. I have seen this in my own team last year. "
                 "We solved it with two short meetings per week and shared documents.")
        await page.fill("#wr-prompt", "Does remote work help or hurt teams?")
        await page.fill("#wr-text", essay)
        await page.click("#wr-submit")
        await page.wait_for_timeout(900)
        await shot(page, "15-writing-feedback")

        # quiz
        await page.goto(f"{BASE}/#/quiz", wait_until="networkidle")
        await page.wait_for_timeout(400)
        text = ("The company decided to carry out a thorough review of its policy after "
                "the scandal broke out. Managers had to put up with intense scrutiny from "
                "the press, and several executives came under pressure to resign. "
                "Despite the backlash, the board stood by its decision, arguing that the "
                "measures would mitigate the damage in the long run. Analysts noted that "
                "the firm had been on the verge of bankruptcy two years earlier, so the "
                "turnaround was remarkable by any standard.")
        await page.fill("#qz-text", text)
        await page.click("#qz-go")
        await page.wait_for_timeout(900)
        await shot(page, "16-quiz")
        # answer first two items
        opts = page.locator(".qblock")
        n = await opts.count()
        if n:
            first_block = opts.nth(0)
            inp = first_block.locator(".qin")
            opt = first_block.locator(".qopt")
            if await opt.count():
                await opt.first.click()
            elif await inp.count():
                await inp.fill("make")
                await first_block.locator(".qcheck").click()
            await page.wait_for_timeout(500)
            await shot(page, "17-quiz-answered")

        # readings
        await page.goto(f"{BASE}/#/readings", wait_until="networkidle")
        await page.wait_for_timeout(600)
        await shot(page, "18-readings")
        await page.locator(".readcard").first.click()
        await page.wait_for_timeout(700)
        await shot(page, "19-reading-open")
        rq = page.locator(".rq")
        if await rq.count():
            await rq.first.click()
            await page.wait_for_timeout(300)

        # deck
        await page.goto(f"{BASE}/#/deck", wait_until="networkidle")
        await page.wait_for_timeout(700)
        await shot(page, "20-deck")

        # stats
        await page.goto(f"{BASE}/#/stats", wait_until="networkidle")
        await page.wait_for_timeout(700)
        await shot(page, "21-stats")

        # settings
        await page.goto(f"{BASE}/#/settings", wait_until="networkidle")
        await page.wait_for_timeout(700)
        await shot(page, "22-settings")

        await close_ctx(ctx, browser)
        await browser.close()

    print("\n--- console errors/warnings ---")
    for m in console_msgs[:30]:
        print(m)
    print("--- page errors ---")
    for e in errors[:20]:
        print(e)
    if not errors and not console_msgs:
        print("none")


async def close_ctx(ctx, browser):
    await ctx.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()) or 0)
