import { StyleSheet, Platform } from 'react-native';

/**
 * Universal Brand Typography for Kandy Cabs Customer App
 * Explicitly forces clean Google Roboto (straight, clean letterforms WITHOUT tails / serifs)
 * across all Android & iOS devices, preventing OEM system font themes (such as OnePlus Serif themes)
 * from distorting the app UI.
 */
export const APP_FONT = 'Roboto-Regular';
export const APP_FONT_MEDIUM = 'Roboto-Medium';
export const APP_FONT_BOLD = 'Roboto-Bold';

/**
 * Maps fontWeight to the matching bundled Roboto .ttf file.
 * Preserves vector icons (Ionicons, MaterialIcons, etc.) and custom non-Roboto fonts completely.
 * On Android, clears the raw 'fontWeight' property when a specific font family
 * like 'Roboto-Bold' is set, preventing Android's native font engine from failing the match
 * and falling back to OEM custom fonts (like OnePlus serif themes).
 */
export function resolveRobotoStyle(style: any) {
  const flat = StyleSheet.flatten(style) || {};
  const currentFamily = flat.fontFamily;

  // If a font family is already specified and it's NOT Roboto or System (e.g., Ionicons, MaterialIcons, etc.),
  // do NOT touch it — preserve the icon font.
  if (
    currentFamily &&
    currentFamily !== 'Roboto' &&
    currentFamily !== 'Roboto-Regular' &&
    currentFamily !== 'System'
  ) {
    // If it's already an exact Roboto weight family, ensure Android doesn't fail weight match
    if (currentFamily === 'Roboto-Bold' || currentFamily === 'Roboto-Medium') {
      if (Platform.OS === 'android' && flat.fontWeight != null) {
        return { fontWeight: undefined };
      }
      return undefined;
    }
    // Icon font or other custom family: leave completely untouched
    return undefined;
  }

  const weight = flat.fontWeight;
  let family = APP_FONT;

  if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
    family = APP_FONT_BOLD;
  } else if (weight === '500' || weight === '600') {
    family = APP_FONT_MEDIUM;
  }

  if (Platform.OS === 'android') {
    return { fontFamily: family, fontWeight: undefined };
  }
  return { fontFamily: family };
}

/**
 * Formats names into clean Title Case (First letter of each word capitalized, rest lowercase).
 * Handles:
 * "RRaakshith" -> "Rrakshith"
 * "mukesh rao" -> "Mukesh Rao"
 * "RAMESH KUMAR (TEST DRIVER)" -> "Ramesh Kumar (Test Driver)"
 */
export function formatTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      const match = word.match(/^([^a-zA-Z]*)([a-zA-Z])(.*)$/);
      if (match) {
        const [, prefix, firstLetter, rest] = match;
        return prefix + firstLetter.toUpperCase() + rest.toLowerCase();
      }
      return word;
    })
    .join(' ');
}
