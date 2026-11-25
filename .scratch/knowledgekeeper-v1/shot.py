import asyncio, sys, os
from playwright.async_api import async_playwright

# usage: shot.py <html> <outdir> <view1,view2,...> [width] [height]
html = os.path.abspath(sys.argv[1])
outdir = sys.argv[2]
views = sys.argv[3].split(',')
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1440
H = int(sys.argv[5]) if len(sys.argv) > 5 else 900
os.makedirs(outdir, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        for v in views:
            await pg.goto(f'file:///{html.replace(os.sep, "/")}#{v}')
            await pg.wait_for_timeout(450)
            path = os.path.join(outdir, f'{v}.png')
            await pg.screenshot(path=path)
            print('✓', path)
        if errs:
            print('CONSOLE ERRORS:', errs)
        else:
            print('console clean')
        await b.close()

asyncio.run(main())
