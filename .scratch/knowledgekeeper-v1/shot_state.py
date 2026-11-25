import asyncio, sys, os
from playwright.async_api import async_playwright

# usage: shot_state.py <html> <out.png> <view> [click-selector ...] [--w=1440 --h=900]
html = os.path.abspath(sys.argv[1])
out = sys.argv[2]
view = sys.argv[3]
rest = [a for a in sys.argv[4:] if not a.startswith('--')]
W, H = 1440, 900
for a in sys.argv[4:]:
    if a.startswith('--w='): W = int(a[4:])
    if a.startswith('--h='): H = int(a[4:])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'file:///{html.replace(os.sep,"/")}#{view}')
        await pg.wait_for_timeout(400)
        for sel in rest:
            await pg.click(sel)
            await pg.wait_for_timeout(350)
        await pg.screenshot(path=out)
        print('✓', out, 'errors:', errs if errs else 'none')
        await b.close()

asyncio.run(main())
