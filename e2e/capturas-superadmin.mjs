// Capturas del panel SUPERADMIN (escritorio y móvil) contra datos de demostración.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('./shots/', import.meta.url).pathname;
const PAGES = ['dashboard', 'usuarios', 'estudiantes', 'representantes', 'inconsistencias', 'solicitudes', 'plazos', 'auditoria', 'errores', 'configuracion'];
const browser = await chromium.launch();
for (const [tag, vp] of [['desk', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'es-EC', timezoneId: 'America/Guayaquil' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/ingresar`);
  await page.fill('#usuario', 'superadmin@uets.edu.ec');
  await page.fill('#password', process.env.SA_PASS ?? 'Demo-SuperAdmin-2026');
  await page.click('button[type=submit]');
  await page.waitForURL('**/superadmin/**');
  for (const p of PAGES) {
    await page.goto(`${BASE}/superadmin/${p}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}sa-${p}-${tag}.png`, fullPage: tag === 'desk' });
  }
  // detalle de una solicitud y ficha de estudiante
  await page.goto(`${BASE}/superadmin/solicitudes`); await page.waitForLoadState('networkidle');
  await page.locator('table.dtable tbody tr').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}sa-solicitud-detalle-${tag}.png`, fullPage: tag === 'desk' });
  await page.goto(`${BASE}/superadmin/estudiantes`); await page.waitForLoadState('networkidle');
  await page.locator('table.dtable tbody tr').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}sa-estudiante-ficha-${tag}.png`, fullPage: tag === 'desk' });
  await page.goto(`${BASE}/superadmin/usuarios`); await page.waitForLoadState('networkidle');
  await page.locator('table.dtable tbody tr').first().click(); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}sa-usuario-hoja-${tag}.png` });
  if (tag === 'movil') { await page.keyboard.press('Escape'); await page.click('button[aria-label="Abrir menú"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}sa-menu-movil.png` }); }
  console.log(tag, 'errores de consola:', errors.length ? errors.slice(0, 5) : 'ninguno');
  await ctx.close();
}
await browser.close();
