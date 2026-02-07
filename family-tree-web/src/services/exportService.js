/**
 * Export service — single responsibility: PDF and share-link export.
 * Depends on ontology (URL_PARAM, defaultViewport) and buildSharePayload from persistence.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { URL_PARAM } from '../ontology';
import { buildSharePayload } from './persistenceService';

const PAGE_INNER_MM = {
  a4: { w: 297 - 20, h: 210 - 20 },
  a1: { w: 841 - 20, h: 594 - 20 },
  a0: { w: 1189 - 20, h: 841 - 20 },
};

export async function exportToPdf(containerRef, paperSize = 'a1') {
  if (!containerRef?.current) return;
  const el = containerRef.current;
  el.classList.add('pdf-exporting');
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const pageInner = PAGE_INNER_MM[paperSize] ?? PAGE_INNER_MM.a1;
  const canvas = await html2canvas(el, { scale: 2 });
  el.classList.remove('pdf-exporting');
  const scale = Math.min(pageInner.w / canvas.width, pageInner.h / canvas.height);
  const fitW = canvas.width * scale;
  const fitH = canvas.height * scale;
  const pdf = new jsPDF({
    unit: 'mm',
    format: paperSize,
    orientation: 'landscape',
  });
  pdf.addImage(
    canvas.toDataURL('image/jpeg', 0.95),
    'JPEG',
    10,
    10,
    fitW,
    fitH,
  );
  pdf.save('family-tree.pdf');
}

export function copyShareLinkToClipboard(nodes, edges, viewport) {
  const payload = buildSharePayload(nodes, edges, viewport);
  const url = `${window.location.origin}${window.location.pathname}?${URL_PARAM}=${encodeURIComponent(JSON.stringify(payload))}`;
  return navigator.clipboard.writeText(url);
}
