// Test-only screenshot helper (puppeteer-core from $PPTR_DIR, system Chrome).
// Usage: PPTR_DIR=/tmp/pptr node tests/preview/capture.mjs <baseUrl> <outDir> <specs.json>
// spec: { name, w, h, path, full?, scroll?, click?, wait? }
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(join(process.env.PPTR_DIR ?? '.', 'package.json'));
const puppeteer = require('puppeteer-core');
const [base, out, specFile] = process.argv.slice(2);
const specs = JSON.parse(readFileSync(specFile, 'utf8'));
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
for (const s of specs) {
  const page = await browser.newPage();
  await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1, isMobile: s.w < 600, hasTouch: s.w < 600 });
  if (s.reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(base + s.path, { waitUntil: 'networkidle0' });
  if (s.noFcta) {
    await page.evaluate(() => sessionStorage.setItem('ttw-fcta-hidden', '1'));
    await page.reload({ waitUntil: 'networkidle0' });
  }
  if (s.full) {
    // load lazy images by stepping through the page
    const hgt = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < hgt; y += s.h / 2) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await new Promise((r) => setTimeout(r, 120));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  if (s.scroll) await page.evaluate((y) => window.scrollTo(0, y), s.scroll);
  if (s.click) await page.click(s.click);
  await new Promise((r) => setTimeout(r, s.wait ?? 1800));
  await page.screenshot({ path: join(out, `${s.name}.png`), fullPage: !!s.full });
  await page.close();
  console.log('shot', s.name);
}
await browser.close();
