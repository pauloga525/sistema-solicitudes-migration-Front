// Capturas del panel ADMIN rediseñado (escritorio y móvil).
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch();
for (const [tag, vp] of [['desk', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'es-EC', timezoneId: 'America/Guayaquil' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/ingresar`);
  await page.fill('#usuario', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/**');
  for (const p of ['dashboard', 'editor', 'editor/proceso_mejora', 'plazos', 'padron']) {
    await page.goto(`${BASE}/admin/${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}ad-${p.replace('/', '-')}-${tag}.png`, fullPage: tag === 'desk' });
  }
  await page.goto(`${BASE}/admin/dashboard`); await page.waitForLoadState('networkidle');
  await page.locator('table.dtable tbody tr').nth(2).click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}ad-detalle-${tag}.png`, fullPage: tag === 'desk' });
  console.log(tag, 'errores:', errors.length ? errors.slice(0, 4) : 'ninguno');
  await ctx.close();
}
await browser.close();
