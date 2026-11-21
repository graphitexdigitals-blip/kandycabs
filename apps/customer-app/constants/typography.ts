import { StyleSheet, Platform } from 'react-native';

/**
 * Universal Typography for Kandy Cabs Customer App
 * Restored to exact native system font settings (Mi Sans / OnePlus Sans / System Sans)
 * with full native font weights ('700', '800', 'bold') and sizing.
 */
export const APP_FONT = undefined;
export const APP_FONT_MEDIUM = undefined;
export const APP_FONT_BOLD = undefined;

/**
 * No-op resolver to preserve exact original StyleSheet font sizes, weights, and styling.
 */
export function resolveRobotoStyle(style: any) {
  return undefined;
}

/**
 * Formats names into clean Title Case (First letter of each word capitalized, rest lowercase).
 * Handles:
 * "RRaakshith" -> "Rrakshith"
 * "rakshith shetty" -> "Rakshith Shetty"
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
