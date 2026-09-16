// Theme catalogue used by the switcher UI. IDs match the CSS blocks in themes.css.
// Light-only, contrasty palettes (no dark mode).
export interface ThemeDef {
  id: string;
  name: string;
  swatch: string; // primary colour for the picker
  accent: string; // secondary colour for the picker swatches
}

export const THEMES: ThemeDef[] = [
  { id: 'indigo', name: 'Indigo Pop', swatch: '#5b53e0', accent: '#ff7aa8' },
  { id: 'teal', name: 'Teal Punch', swatch: '#129d8e', accent: '#ff6f61' },
  { id: 'ocean', name: 'Ocean Crisp', swatch: '#2f6fed', accent: '#12b5c9' },
  { id: 'berry', name: 'Berry Bold', swatch: '#d6337f', accent: '#7b61ff' },
  { id: 'forest', name: 'Forest Clean', swatch: '#2e8b57', accent: '#e0a020' },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const DEFAULT_THEME = 'indigo';

/** Return a valid theme id, falling back to the default for unknown/legacy values. */
export function normalizeTheme(id?: string | null): string {
  return id && THEME_IDS.includes(id) ? id : DEFAULT_THEME;
}
