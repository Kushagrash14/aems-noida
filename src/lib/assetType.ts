/** Best-effort asset type detection from free text (name, model, tag). */
export function inferItCategoryName(...texts: (string | null | undefined)[]): 'LAPTOP' | 'DESKTOP' | null {
  const text = texts.filter(Boolean).join(' ').toUpperCase();
  if (!text) return null;
  if (
    /-LPT-/.test(text) ||
    /\b(LAPTOP|NOTEBOOK|LATITUDE|THINKPAD|IDEAPAD|MACBOOK|PROBOOK|ELITEBOOK|ZENBOOK|VIVOBOOK|INSPIRON|VOSTRO|PAVILION)\b/.test(text)
  ) {
    return 'LAPTOP';
  }
  if (
    /-DSK-/.test(text) ||
    /\b(DESKTOP|OPTIPLEX|THINKCENTRE|PRODESK|ELITEDESK|WORKSTATION|ALL-IN-ONE|AIO)\b/.test(text)
  ) {
    return 'DESKTOP';
  }
  return null;
}

/** Categories that only say "IT" and don't tell which device it is. */
export function isGenericItCategory(name?: string | null): boolean {
  const n = (name || '').trim().toUpperCase();
  return !n || n === 'IT' || n === 'IT ASSETS' || n.includes('INFORMATION TECHNOLOGY');
}

/** Specific asset type for display, e.g. "LAPTOP" instead of the generic "IT" bucket. */
export function displayAssetType(asset: {
  asset_tag?: string | null;
  name?: string | null;
  model?: string | null;
  category?: { name?: string | null } | null;
}): string {
  const catName = asset.category?.name || '';
  if (isGenericItCategory(catName)) {
    const inferred = inferItCategoryName(asset.asset_tag, asset.name, asset.model);
    if (inferred) return inferred;
  }
  return catName || 'Equipment';
}
