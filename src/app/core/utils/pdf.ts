/** Descarga un Blob con un nombre de archivo. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre el PDF en una pestaña y lanza el diálogo de impresión (como printRequestPdf del original). */
export function printBlob(blob: Blob): void {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => setTimeout(() => { win.focus(); win.print(); }, 400));
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
  }
}
