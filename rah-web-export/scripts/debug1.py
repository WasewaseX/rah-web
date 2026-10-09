#!/usr/bin/env python3
import asyncio, pathlib
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        msgs = []
        page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: msgs.append(f"PAGEERROR: {e}"))
        await page.goto("http://127.0.0.1:8877/?fresh=1", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        print("URL:", page.url)
        print("HASH content head:", await page.locator("#main").inner_html())
        for m in msgs[:20]:
            print(m)
        await b.close()

asyncio.run(main())
