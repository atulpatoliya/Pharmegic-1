/** EU REACH manufacturer card — matches EU_REACH_SOURCE.docx (#E8EFDF / #135D3F). */
const MANUFACTURER_CARD_STYLE: Partial<CSSStyleDeclaration> = {
  backgroundColor: '#E8EFDF',
  borderLeft: '6px solid #135D3F',
  borderRadius: '4px',
  padding: '14px 16px 14px 14px',
  margin: '12px 0 16px',
  boxSizing: 'border-box',
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function styleManufacturerCardParagraph(p: HTMLElement, index: number): void {
  p.style.margin = '0';
  p.style.padding = '0';
  p.style.fontFamily = 'Verdana, Geneva, sans-serif';
  p.style.lineHeight = '1.35';

  if (index === 0) {
    p.style.fontSize = '7pt';
    p.style.fontWeight = '700';
    p.style.color = '#135D3F';
    p.style.textTransform = 'uppercase';
    p.style.letterSpacing = '0.04em';
    p.style.marginBottom = '5px';
    return;
  }

  if (index === 1) {
    p.style.fontSize = '13.5pt';
    p.style.fontWeight = '700';
    p.style.color = '#2D2D2D';
    p.style.marginBottom = '3px';
    return;
  }

  if (index === 2) {
    p.style.fontSize = '9pt';
    p.style.fontWeight = '400';
    p.style.color = '#596472';
    p.style.marginBottom = '2px';
    return;
  }

  p.style.fontSize = '9pt';
  p.style.fontWeight = '700';
  p.style.color = '#135D3F';
  p.style.marginTop = '6px';
}

function collectManufacturerCardParagraphs(
  paragraphs: HTMLParagraphElement[],
  startIndex: number
): HTMLParagraphElement[] {
  const card: HTMLParagraphElement[] = [];
  for (let j = startIndex; j < paragraphs.length && card.length < 4; j++) {
    const text = normalizeText(paragraphs[j].textContent || '');
    if (!text) continue;
    if (/^Registered Substance/i.test(text)) break;
    card.push(paragraphs[j]);
    if (/Representative/i.test(text)) break;
  }
  return card.length >= 3 ? card : [];
}

function wrapManufacturerCard(cardParagraphs: HTMLParagraphElement[]): void {
  const first = cardParagraphs[0];
  if (first.closest('[data-reach-manufacturer-card]')) return;

  const parent = first.parentElement;
  if (!parent) return;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-reach-manufacturer-card', 'true');
  Object.assign(wrapper.style, MANUFACTURER_CARD_STYLE);
  parent.insertBefore(wrapper, first);

  cardParagraphs.forEach((p, index) => {
    styleManufacturerCardParagraph(p, index);
    wrapper.appendChild(p);
  });
}

/** Rebuild manufacturer info cards when docx-preview omits Word drawing/VML shapes. */
export function applyReachDocxPreviewStyles(container: HTMLElement): void {
  const paragraphs = Array.from(container.querySelectorAll('p')).filter(
    (p): p is HTMLParagraphElement => p instanceof HTMLParagraphElement
  );

  for (let i = 0; i < paragraphs.length; i++) {
    const text = normalizeText(paragraphs[i].textContent || '');
    if (!/NON-EU\s+MANUFACTURER/i.test(text)) continue;

    const cardParagraphs = collectManufacturerCardParagraphs(paragraphs, i);
    if (cardParagraphs.length === 0) continue;

    wrapManufacturerCard(cardParagraphs);
    i += cardParagraphs.length - 1;
  }

  container.querySelectorAll('td, th').forEach((cell) => {
    if (!(cell instanceof HTMLElement)) return;
    const text = normalizeText(cell.innerText || cell.textContent || '').toLowerCase();
    if (text !== 'substance name') return;

    const nextCell = cell.nextElementSibling;
    if (!(nextCell instanceof HTMLElement)) return;

    const p = nextCell.querySelector('p');
    if (!p) return;

    const chemName = normalizeText(p.innerText || p.textContent || '');
    if (chemName.length >= 60) {
      p.style.marginTop = '-5px';
      p.style.marginBottom = '-2px';
      p.style.lineHeight = '1.1';
    }
  });
}
