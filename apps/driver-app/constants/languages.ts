export interface LanguageOption {
  id: string;
  label: string;
  native: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { id: 'Kannada', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'English', label: 'English', native: 'English' },
  { id: 'Hindi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'Tulu', label: 'Tulu', native: 'ತುಳು' },
  { id: 'Tamil', label: 'Tamil', native: 'தமிழ்' },
  { id: 'Telugu', label: 'Telugu', native: 'తెలుగు' },
  { id: 'Malayalam', label: 'Malayalam', native: 'മലയാളം' },
  { id: 'Konkani', label: 'Konkani', native: 'ಕೊಂಕಣಿ' },
  { id: 'Marathi', label: 'Marathi', native: 'मराठी' },
];
