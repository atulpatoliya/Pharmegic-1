/** A4 at 96 CSS px — matches browser print and jsPDF portrait A4 aspect ratio. */
export const REACH_CERT_A4_WIDTH_PX = 794;
export const REACH_CERT_A4_HEIGHT_PX = 1123;

export function applyReachCertificateA4Size(element: HTMLElement): void {
  element.style.width = `${REACH_CERT_A4_WIDTH_PX}px`;
  element.style.height = `${REACH_CERT_A4_HEIGHT_PX}px`;
  element.style.maxWidth = `${REACH_CERT_A4_WIDTH_PX}px`;
  element.style.minHeight = `${REACH_CERT_A4_HEIGHT_PX}px`;
  element.style.boxSizing = 'border-box';
  element.style.overflow = 'hidden';
  element.style.margin = '0';
  element.style.background = '#ffffff';
}
