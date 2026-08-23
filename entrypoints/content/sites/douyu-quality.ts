export function getQualityItems(rateEl: Element): HTMLLIElement[] {
  return Array.from(rateEl.querySelectorAll<HTMLLIElement>('li')).filter((li) =>
    Boolean(li.textContent?.trim()),
  );
}

export function is1080p60Quality(label: string): boolean {
  return /1080p?60/i.test(label.replace(/\s+/g, ''));
}

export function getPreferredQualityItem(rateEl: Element): HTMLLIElement | undefined {
  return getQualityItems(rateEl).find((item) =>
    is1080p60Quality(item.textContent?.trim() || ''),
  );
}

export function getDefaultQualityItem(rateEl: Element): HTMLLIElement | undefined {
  return getPreferredQualityItem(rateEl) || getQualityItems(rateEl)[0];
}
