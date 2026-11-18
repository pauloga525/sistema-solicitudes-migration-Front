// Prueba de extremo a extremo (navegador real): estudiante → ADMIN → SUPERADMIN, con sesión por cookie HttpOnly + CSRF.
// Requisitos: backend FastAPI en marcha (replica set recomendado), frontend en BASE con el proxy /api,
// cuentas admin/admin123 y el SUPERADMIN con la contraseña de E2E_SA_PASS. Usar SIEMPRE una base de pruebas.
// Uso: node e2e/flujo-completo.mjs [carpeta_capturas]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
const SA_EMAIL = process.env.E2E_SA_EMAIL ?? 'superadmin@uets.edu.ec';
const SA_PASS = process.env.E2E_SA_PASS ?? 'Demo-SuperAdmin-2026';
const OUT = process.argv[2] ?? 'e2e/capturas';
mkdirSync(OUT, { recursive: true });
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false, error: String(e).slice(0, 500) }); console.log('✘', name, '\n  ', String(e).slice(0, 500)); }
};

/** Cédula ecuatoriana válida (módulo 10) a partir de una semilla. */
function cedula(seed) {
  // provincia 01 y tercer dígito < 6 (persona natural), como exige el algoritmo del Registro Civil
  const base = `01${seed % 6}${String(seed).padStart(6, '0').slice(-6)}`;
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const sum = coef.reduce((acc, c, i) => { const v = Number(base[i]) * c; return acc + (v >= 10 ? v - 9 : v); }, 0);
  return base + ((10 - (sum % 10)) % 10);
}
const stamp = Date.now() % 10_000_000;
const EMAIL = `e2e${stamp}.est@uets.edu.ec`;
const DNI = cedula(stamp);
const REP_DNI = cedula(stamp + 4321);
const PW = 'Clave-de-prueba-2026';
const y = new Date().getFullYear();

const browser = await chromium.launch();
const errors = [];
async function newCtx(label) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, locale: 'es-EC', timezoneId: 'America/Guayaquil' });
  ctx.setDefaultTimeout(12_000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  return { ctx, page };
}
/** Llamada a la API desde el contexto del navegador (cookie de sesión + token CSRF). */
async function api(ctx, method, path, data) {
  const csrf = (await ctx.cookies()).find((c) => c.name === 'uets_csrf')?.value ?? '';
  return ctx.request.fetch(`${BASE}/api${path}`, { method, data, headers: { 'X-CSRF-Token': csrf } });
}

const st = await newCtx('estudiante');
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
let requestNumber = '';

// ── Estudiante ────────────────────────────────────────────────────────────────
await step('Iniciar solicitud sin sesión lleva a ingresar (formulario cerrado al público)', async () => {
  await st.page.goto(BASE);
  await st.page.getByRole('button', { name: 'Iniciar Solicitud' }).first().click();
  await st.page.waitForURL('**/ingresar?next=%2Fsolicitud');
  await st.page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
  // Solo Google; el acceso con contraseña (cuentas de prueba) está plegado y aparece solo si el servidor lo permite.
  await st.page.getByText('nombreapellido.est@uets.edu.ec').waitFor();
  await st.page.getByText('Ingresar con usuario y contraseña (cuentas de prueba)').click();
});

await step('Registro con correo institucional', async () => {
  await st.page.getByRole('link', { name: 'Crea tu cuenta' }).click();
  await st.page.waitForURL('**/registro');
  await st.page.getByLabel('Correo institucional').fill('alguien@gmail.com');
  await st.page.getByLabel('Contraseña', { exact: true }).fill(PW);
  await st.page.getByLabel('Repite la contraseña').fill(PW);
  await st.page.getByRole('button', { name: /Crear cuenta/ }).click();
  await st.page.getByText('Usa tu correo institucional').waitFor();
  // correo de personal (sin .est): no crea cuenta de estudiante
  await st.page.getByLabel('Correo institucional').fill(`docente${stamp}@uets.edu.ec`);
  await st.page.getByRole('button', { name: /Crear cuenta/ }).click();
  await st.page.getByText('de estudiante (.est@uets.edu.ec)').waitFor();
  await st.page.getByLabel('Correo institucional').fill(EMAIL);
  await st.page.getByRole('button', { name: /Crear cuenta/ }).click();
  await st.page.waitForURL('**/estudiante/perfil');
  const cookie = (await st.ctx.cookies()).find((c) => c.name === 'uets_session');
  assert.ok(cookie?.httpOnly, 'la sesión va en cookie HttpOnly');
  assert.equal(await st.page.evaluate(() => sessionStorage.length + localStorage.length), 0, 'nada en el almacenamiento del navegador');
});

await step('Pestaña 1: datos del estudiante (nombres, apellidos, cédula, curso y paralelo según el curso)', async () => {
  const p = st.page;
  assert.equal(await p.getByRole('tab', { name: /Datos del representante/ }).isDisabled(), true, 'la pestaña 2 se habilita al guardar');
  const first = p.getByLabel(/^Nombres/);
  await first.fill('maria123 jose');
  assert.equal(await first.inputValue(), 'maria jose', 'solo letras');
  await first.blur();
  assert.equal(await first.inputValue(), 'Maria Jose');
  await p.getByLabel(/^Apellidos/).fill('prueba perez');
  await p.getByLabel(/^Número de cédula/).fill('0102030405');
  await p.getByText('Revisa la cédula: no es válida.').first().waitFor();
  await p.getByLabel(/^Número de cédula/).fill(DNI);
  // 1ro de Básica: A–I · Bachillerato: especialidad y su curso
  await p.locator('select[name=course]').selectOption('1ro_Basica');
  assert.deepEqual(await p.locator('select[name=par] option:not([disabled])').allInnerTexts(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  await p.locator('select[name=course]').selectOption('2do_Bach');
  await p.locator('select[name=spec]').selectOption('Desarrollo de Software');
  assert.deepEqual(await p.locator('select[name=par] option:not([disabled])').allInnerTexts(), ['E1', 'E2']);
  await p.locator('select[name=course]').selectOption('5to');
  assert.equal(await p.locator('select[name=spec]').count(), 0);
  await p.locator('select[name=par]').selectOption('B');
  await shot(p, '01a-datos-estudiante');
  await p.getByRole('button', { name: /Guardar y continuar/ }).click();
  // aviso: una vez guardados, solo el Departamento de Sistemas habilita la corrección
  await p.getByRole('heading', { name: 'Revisa tus datos' }).waitFor();
  await p.getByRole('button', { name: 'Sí, guardar' }).click();
  await p.getByRole('heading', { name: 'Datos del representante' }).waitFor();
});

await step('Pestaña 2: representante con correo personal y celular', async () => {
  const p = st.page;
  await p.getByLabel(/^Nombres/).fill('juan carlos');
  await p.getByLabel(/^Apellidos/).fill('perez lopez');
  await p.getByLabel(/^Número de cédula/).fill(REP_DNI);
  await p.getByLabel(/^Correo personal/).fill('juan.perez-gmail.com');
  await p.getByLabel('Celular').fill('0998765432');
  await p.getByRole('button', { name: 'Guardar representante' }).click();
  await p.getByText('Revisa el correo del representante').waitFor();
  await p.getByLabel(/^Correo personal/).fill(`juan.perez.${stamp}@gmail.com`);
  await p.getByRole('button', { name: 'Guardar representante' }).click();
  await p.getByRole('button', { name: 'Sí, guardar' }).click();
  await p.getByText('Todo listo. Ya puedes enviar solicitudes.').waitFor();
  // ya registrados: solo lectura, en las dos pestañas
  await p.getByText('Departamento de Sistemas').first().waitFor();
  assert.equal(await p.locator('input[name=rfn]').count(), 0, 'el representante queda bloqueado');
  await p.getByRole('tab', { name: /Datos del estudiante/ }).click();
  assert.equal(await p.locator('input[name=fn]').count(), 0, 'los datos del estudiante quedan bloqueados');
  await shot(p, '01-perfil-estudiante');
});

await step('Formulario con identidad tomada del perfil y control de cupo', async () => {
  const p = st.page;
  await p.getByRole('button', { name: 'Nueva solicitud' }).click();
  // Sin selección de campus: 5to de Básica pertenece a Carlos Crespi / María Auxiliadora.
  await p.waitForURL('**/solicitud/tramites?campus=CC_MA');
  await p.getByText('Campus Carlos Crespi / Maria Auxiliadora').first().waitFor();
  await p.goto(`${BASE}/solicitud/tramites?campus=YANUNCAY`);
  await p.waitForURL('**/solicitud/tramites?campus=CC_MA');  // el campus sale del curso, no de la URL
  await p.getByRole('button', { name: /Evaluación de Mejora/ }).click();
  await p.getByRole('button', { name: 'Acepto, continuar' }).click();
  await p.waitForURL('**/solicitud/formulario**');
  await p.waitForFunction((d) => document.querySelector('#stDni')?.value === d, DNI);
  assert.equal(await p.locator('#stDni').isDisabled(), true, 'la cédula del estudiante no se edita en el formulario');
  assert.equal(await p.locator('#repName').inputValue(), 'Juan Carlos Perez Lopez');
  await p.getByText(/Cupo de este aporte: 0 de 4/).waitFor();
  // Solo aparecen las materias de 5to de Básica (malla por curso); las de otros cursos no se ofrecen.
  await p.getByText('Se muestran solo las materias que cursas', { exact: false }).waitFor();
  assert.equal(await p.getByLabel('Mod. Programación Estructurada', { exact: true }).count(), 0, 'materia de otro curso');
  assert.equal(await p.getByLabel('Science', { exact: true }).count(), 0, 'nombre histórico fuera de la malla');
  for (const s of ['Matemática', 'Inglés', 'Computación', 'Enseñanza Religiosa Escolar', 'Ciencias Naturales']) await p.getByLabel(s, { exact: true }).check();
  await p.getByText('Las materias seleccionadas superan el cupo disponible.', { exact: false }).waitFor();
  await p.getByLabel('Ciencias Naturales', { exact: true }).uncheck();
  await p.getByLabel(/Acepto que la información/).check();
  await p.waitForFunction(() => !document.querySelector('button[type=submit]')?.hasAttribute('disabled'));
  await shot(p, '02-formulario');
});

await step('Vista previa → enviar → comprobante', async () => {
  const p = st.page;
  await p.getByRole('button', { name: /Vista previa y enviar/ }).click();
  await p.waitForURL('**/solicitud/preview');
  await p.locator('iframe[title="Vista previa de solicitud"]').waitFor();
  await p.getByRole('button', { name: /Confirmar y Enviar/ }).click();
  await p.getByRole('heading', { name: 'Solicitud enviada correctamente' }).waitFor();
  requestNumber = (await p.locator('dd.tnum').first().innerText()).trim();
  assert.match(requestNumber, new RegExp(`^PM-${y}-\\d{4}$`));
  await shot(p, '03-exito');
});

await step('Mis solicitudes: estado, cupo y PDF propio', async () => {
  const p = st.page;
  await p.goto(`${BASE}/estudiante`);
  await p.getByText(requestNumber).waitFor();
  await p.getByText(/materias disponibles de 4/).waitFor();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Comprobante PDF/ }).first().click()]);
  assert.equal(dl.suggestedFilename(), `solicitud-${requestNumber}.pdf`);
  await shot(p, '04-mis-solicitudes');
});

await step('El servidor rechaza una identidad ajena y el cupo excedido', async () => {
  const foreign = await api(st.ctx, 'POST', '/requests', { requestType: 'proceso_mejora', representativeName: 'Juan Carlos Perez Lopez',
    representativeDni: REP_DNI, studentName: 'Otra Persona Distinta', studentDni: '0105566772', course: '5to', paralelo: 'B', payload: { subjects: ['Inglés'] } });
  assert.equal(foreign.status(), 403);
  const over = await api(st.ctx, 'POST', '/requests', { requestType: 'proceso_mejora', representativeName: 'Juan Carlos Perez Lopez',
    representativeDni: REP_DNI, studentName: 'Maria Jose Prueba Perez', studentDni: DNI, course: '5to', paralelo: 'B', payload: { subjects: ['Estudios Sociales', 'Lengua y Literatura'] } });
  assert.equal(over.status(), 400, 'cupo de 4 materias');
  const foreignSubject = await api(st.ctx, 'POST', '/requests', { requestType: 'proceso_mejora', representativeName: 'Juan Carlos Perez Lopez',
    representativeDni: REP_DNI, studentName: 'Maria Jose Prueba Perez', studentDni: DNI, course: '5to', paralelo: 'B', payload: { subjects: ['Mod. Servomecanismos'] } });
  assert.equal(foreignSubject.status(), 400, 'materia de otro curso');
  assert.match((await foreignSubject.json()).message, /no corresponden a tu curso/);
  const noCsrf = await st.ctx.request.post(`${BASE}/api/requests`, { data: {} });
  assert.equal(noCsrf.status(), 403, 'sin token CSRF');
});

// ── ADMIN ────────────────────────────────────────────────────────────────────
const ad = await newCtx('admin');
await step('Rutas del panel protegidas y estudiante sin acceso', async () => {
  await ad.page.goto(`${BASE}/admin/dashboard`);
  await ad.page.waitForURL('**/ingresar**');
  await st.page.goto(`${BASE}/admin/dashboard`);
  await st.page.waitForURL('**/estudiante');
  assert.equal((await api(st.ctx, 'GET', '/requests')).status(), 403);
});

await step('Ingreso del ADMIN (error y correcto) con cookie HttpOnly', async () => {
  const p = ad.page;
  if (!(await p.getByLabel('Correo o usuario').isVisible())) await p.getByText('Ingresar con usuario y contraseña (cuentas de prueba)').click();
  await p.getByLabel('Correo o usuario').fill('admin');
  await p.getByLabel('Contraseña', { exact: true }).fill('mala');
  await p.getByRole('button', { name: /^Ingresar/ }).click();
  await p.getByText('Usuario o contraseña incorrectos').waitFor();
  await p.getByLabel('Contraseña', { exact: true }).fill('admin123');
  await p.getByRole('button', { name: /^Ingresar/ }).click();
  await p.waitForURL('**/admin/dashboard');
  assert.ok((await ad.ctx.cookies()).find((c) => c.name === 'uets_session')?.httpOnly);
});

await step('Bandeja: franja de estados, filtros y exportación a Excel', async () => {
  const p = ad.page;
  await p.getByRole('cell', { name: requestNumber }).waitFor();
  await p.getByRole('group', { name: /Solicitudes por estado/ }).waitFor();
  const excel = p.getByRole('button', { name: /Excel/ });
  assert.equal(await excel.isDisabled(), true);
  await p.getByLabel('Curso', { exact: true }).selectOption('5to');
  await p.getByLabel('Materia', { exact: true }).selectOption('Inglés');
  await p.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await p.getByRole('cell', { name: requestNumber }).waitFor();
  await shot(p, '05-bandeja');
  const [download] = await Promise.all([p.waitForEvent('download'), excel.click()]);
  await download.saveAs(`${OUT}/export.xlsx`);
  const { execFileSync } = await import('node:child_process');
  const info = JSON.parse(execFileSync('python3', ['-c', `import openpyxl,json,sys; wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.active; print(json.dumps({'sheet': ws.title, 'rows': [list(r) for r in ws.iter_rows(values_only=True)]}))`, `${OUT}/export.xlsx`]).toString());
  assert.equal(info.sheet, 'Inglés');
  assert.ok(info.rows.some((r) => r[0] === requestNumber));
  await p.getByRole('searchbox').fill('no-existe-xyz');
  await p.getByText('No se encontraron solicitudes').waitFor({ timeout: 4000 });
  await p.getByRole('button', { name: 'Limpiar búsqueda' }).click();
});

await step('Detalle: auto-aprobación al abrir y PDF', async () => {
  const p = ad.page;
  await p.getByRole('cell', { name: requestNumber }).click();
  await p.waitForURL('**/admin/solicitudes/**');
  await p.getByText('Aprobado').first().waitFor();
  await shot(p, '06-detalle');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Descargar PDF/ }).click()]);
  assert.equal(dl.suggestedFilename(), `solicitud-${requestNumber}.pdf`);
});

await step('Cursos y materias: activar/desactivar y restaurar', async () => {
  const p = ad.page;
  await p.getByRole('link', { name: 'Cursos y materias' }).click();
  await p.getByRole('link', { name: /Proceso de Mejora/ }).click();
  const sw = p.getByRole('switch', { name: '3ro de Bachillerato' });
  const before = await sw.getAttribute('aria-checked');
  await sw.click();
  await p.waitForFunction((b) => document.querySelector('[aria-labelledby="courses-12"]')?.getAttribute('aria-checked') !== b, before);
  await shot(p, '07-editor');
  await sw.click();
  await p.waitForFunction((b) => document.querySelector('[aria-labelledby="courses-12"]')?.getAttribute('aria-checked') === b, before);
  // Materias separadas por curso (y especialidad en bachillerato)
  await p.getByLabel('Curso', { exact: true }).selectOption('3ro_Bach');
  await p.getByLabel('Especialidad', { exact: true }).selectOption('Mecatrónica');
  await p.getByRole('heading', { name: 'Materias de 3ro de Bachillerato' }).waitFor();
  const subj = p.getByRole('switch', { name: 'Mod. Servomecanismos' });
  assert.equal(await subj.getAttribute('aria-checked'), 'true');
  await subj.click();
  await p.waitForFunction(() => [...document.querySelectorAll('[role=switch]')].some((e) => e.getAttribute('aria-labelledby')?.startsWith('subjects-') && e.getAttribute('aria-checked') === 'false'));
  await shot(p, '07-editor-materias');
  await subj.click();
  await p.waitForFunction(() => ![...document.querySelectorAll('[role=switch]')].some((e) => e.getAttribute('aria-labelledby')?.startsWith('subjects-') && e.getAttribute('aria-checked') === 'false'));
  await p.getByLabel('Curso', { exact: true }).selectOption('5to');
  assert.equal(await p.getByRole('switch', { name: 'Mod. Servomecanismos' }).count(), 0, 'cada curso muestra solo sus materias');
});

await step('Activación del sistema: fuera de fechas no se puede enviar', async () => {
  const p = ad.page;
  await p.getByRole('link', { name: 'Activación del sistema' }).click();
  await p.getByRole('heading', { name: 'Activación del sistema' }).waitFor();
  const d = (n) => new Date(Date.now() + n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await p.getByLabel('Desde').fill(d(-10));
  await p.getByLabel('Hasta').fill(d(-1));
  await p.getByRole('button', { name: 'Guardar fechas' }).click();
  await p.getByText('Cerrado', { exact: true }).waitFor();
  await shot(p, '08-activacion');
  try {
    await st.page.goto(`${BASE}/solicitud/formulario`);
    await st.page.getByRole('heading', { name: 'El envío de solicitudes no está disponible' }).waitFor();
    await st.page.getByText('El envío de solicitudes está cerrado').waitFor();
    const link = (await (await api(st.ctx, 'GET', '/me/profile')).json()).representatives[0].linkId;
    const r = await api(st.ctx, 'POST', '/me/requests', { requestType: 'proceso_mejora', representativeLinkId: link, payload: { subjects: ['Inglés'] } });
    assert.equal(r.status(), 400);
    assert.equal((await r.json()).code, 'SUBMISSION_CLOSED');
  } finally {
    await p.getByRole('button', { name: 'Quitar fechas' }).first().click();
    await p.locator('dialog.confirm').getByRole('button', { name: 'Quitar fechas' }).click();
    await p.getByText('Sin fechas', { exact: true }).waitFor();
  }
});

await step('Calendario: validación del servidor visible y creación', async () => {
  const p = ad.page;
  await p.getByRole('link', { name: 'Calendario académico' }).first().click();
  await p.getByRole('button', { name: /Nuevo año lectivo/ }).click();
  await p.getByLabel('Nombre del año').first().fill(`Prueba E2E ${stamp}`);
  await p.getByLabel('Inicio').first().fill(`${y + 5}-12-01`);
  await p.getByLabel('Fin').first().fill(`${y + 5}-01-01`);
  await p.getByRole('button', { name: 'Guardar' }).first().click();
  await p.getByText('la fecha de inicio no puede ser posterior a la de fin').waitFor();
  await p.getByLabel('Inicio').first().fill(`${y + 5}-01-01`);
  await p.getByLabel('Fin').first().fill(`${y + 5}-12-01`);
  await p.getByRole('button', { name: 'Guardar' }).first().click();
  await p.getByRole('button', { name: /Nuevo año lectivo/ }).waitFor();
  await shot(p, '08-calendario');
});

await step('Padrón: importar Excel', async () => {
  const p = ad.page;
  await p.getByRole('link', { name: 'Padrón de estudiantes' }).click();
  await p.locator('#padron-file').setInputFiles(process.env.E2E_PADRON ?? 'e2e/padron-ejemplo.xlsx');
  await p.getByRole('button', { name: /Importar/ }).click();
  await p.getByText('Resumen de la importación').waitFor();
});

await step('Recargar (F5) conserva la sesión y cerrar sesión la termina', async () => {
  const p = ad.page;
  await p.reload();
  await p.getByRole('heading', { name: 'Padrón de estudiantes' }).waitFor();
  await p.getByRole('button', { name: 'Cerrar sesión' }).click();
  await p.waitForURL('**/ingresar');
  assert.equal((await api(ad.ctx, 'GET', '/requests')).status(), 401);
});

// ── SUPERADMIN ───────────────────────────────────────────────────────────────
const sa = await newCtx('superadmin');
await step('SUPERADMIN: resumen con datos reales', async () => {
  const p = sa.page;
  await p.goto(`${BASE}/ingresar`);
  await p.getByText('Ingresar con usuario y contraseña (cuentas de prueba)').click();
  await p.getByLabel('Correo o usuario').fill(SA_EMAIL);
  await p.getByLabel('Contraseña', { exact: true }).fill(SA_PASS);
  await p.getByRole('button', { name: /^Ingresar/ }).click();
  await p.waitForURL('**/superadmin/dashboard');
  await p.getByRole('heading', { name: 'Resumen del sistema' }).waitFor();
  await p.getByText(requestNumber).first().waitFor();
  await shot(p, '09-sa-resumen');
});

await step('SUPERADMIN: corrección de estado con motivo y auditoría', async () => {
  const p = sa.page;
  await p.goto(`${BASE}/superadmin/solicitudes?search=${requestNumber}`);
  await p.getByRole('link', { name: requestNumber }).click();
  await p.getByRole('heading', { name: 'Corregir estado' }).waitFor();
  await p.getByLabel('Nuevo estado').selectOption('en_revision');
  await p.getByRole('button', { name: 'Corregir estado…' }).click();
  const confirmBtn = p.getByRole('button', { name: 'Corregir estado', exact: true });
  assert.equal(await confirmBtn.isDisabled(), true, 'sin motivo no se puede confirmar');
  await p.locator('dialog.confirm textarea').fill('Prueba E2E: reapertura controlada');
  await confirmBtn.click();
  await p.getByText('Estado corregido por SUPERADMIN').waitFor();
  await p.getByText('Prueba E2E: reapertura controlada').waitFor();
  await shot(p, '10-sa-correccion');
});

await step('SUPERADMIN: modo mantenimiento bloquea al estudiante y no al personal', async () => {
  const p = sa.page;
  await p.goto(`${BASE}/superadmin/configuracion`);
  await p.getByLabel('Mensaje para los estudiantes').fill('Prueba E2E: volvemos en un momento');
  await p.getByRole('button', { name: 'Activar mantenimiento' }).click();
  await p.getByRole('button', { name: 'Activar', exact: true }).click();
  await p.getByText('Mantenimiento activado').waitFor();
  try {
    await st.page.goto(`${BASE}/estudiante`);
    await st.page.waitForURL('**/mantenimiento');
    await st.page.getByText('Prueba E2E: volvemos en un momento').waitFor();
    await shot(st.page, '11-mantenimiento');
    assert.equal((await api(sa.ctx, 'GET', '/superadmin/dashboard')).status(), 200);
  } finally {
    await p.getByRole('button', { name: 'Desactivar mantenimiento' }).click();
    await p.getByText('Sistema abierto otra vez').waitFor();
  }
  assert.equal((await api(st.ctx, 'GET', '/me/requests')).status(), 200);
});

await step('SUPERADMIN: eliminar una cuenta (motivo y correo como confirmación)', async () => {
  const tmp = await newCtx('temporal');
  const email = `borrar${stamp}.est@uets.edu.ec`;
  await tmp.ctx.request.get(`${BASE}/api/auth/session`);
  const reg = await api(tmp.ctx, 'POST', '/auth/register', { email, password: PW, confirmPassword: PW });
  assert.equal(reg.status(), 201, await reg.text());
  await tmp.ctx.close();
  const p = sa.page;
  await p.goto(`${BASE}/superadmin/usuarios`);
  await p.getByPlaceholder('Nombre, correo o usuario').fill(email);
  await p.getByPlaceholder('Nombre, correo o usuario').press('Enter');
  await p.getByText(email).first().waitFor();
  await p.getByRole('button', { name: '(sin nombre)' }).first().click();
  await p.getByRole('heading', { name: 'Eliminar cuenta' }).waitFor();
  await p.getByRole('button', { name: 'Eliminar cuenta…' }).click();
  const ok = p.getByRole('button', { name: 'Eliminar definitivamente' });
  await p.locator('dialog.confirm textarea').fill('Prueba E2E: cuenta creada por error');
  assert.equal(await ok.isDisabled(), true, 'sin escribir el correo no se puede eliminar');
  await p.locator('dialog.confirm input').fill(email);
  await shot(p, '12-sa-eliminar');
  await ok.click();
  await p.getByText('Cuenta eliminada').waitFor();
  await p.getByText('No hay usuarios con esos filtros').waitFor();
});

await step('Inicio con sesión abierta: botón Cerrar sesión', async () => {
  const p = st.page;
  await p.goto(BASE);
  await p.getByRole('button', { name: 'Cerrar sesión' }).click();
  await p.waitForURL('**/ingresar');
  assert.equal((await api(st.ctx, 'GET', '/me/requests')).status(), 401);
  await p.goto(BASE);
  assert.equal(await p.getByRole('button', { name: 'Cerrar sesión' }).count(), 0);
});

await step('Sin errores de JavaScript en las páginas', async () => assert.deepEqual(errors, []));

await browser.close();
writeFileSync(`${OUT}/resultados.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} pasos OK`);
process.exit(failed ? 1 : 0);
