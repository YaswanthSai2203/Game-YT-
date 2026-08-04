import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const overlay = await page.locator('#ui-overlay').innerText().catch(() => 'NO OVERLAY');
const playCount = await page.locator('text=PLAY').count();
const loadingCount = await page.locator('text=Initializing').count();

console.log('OVERLAY_SNIPPET:', overlay.slice(0, 300).replace(/\n/g, ' | '));
console.log('PLAY_BUTTONS:', playCount);
console.log('LOADING_SCREEN:', loadingCount);
console.log('ERRORS:', errors);

if (playCount > 0) {
  await page.locator('.mode-card[data-mode="endless"]').tap();
  await page.waitForTimeout(2000);
  const pause = await page.locator('#hud-pause').count();
  const tutorial = await page.locator('#tutorial-start-btn').count();
  console.log('HUD_PAUSE:', pause, 'TUTORIAL:', tutorial);
  if (tutorial > 0) {
    await page.locator('#tutorial-start-btn').tap();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(3500);
  const paused = await page.locator('text=Paused').count();
  if (pause > 0) await page.locator('#hud-pause').tap();
  await page.waitForTimeout(500);
  const pausedAfter = await page.locator('text=Paused').count();
  console.log('PAUSED_MODAL:', pausedAfter);
}

await browser.close();
