// Web light palette — aligned with the mobile app's lightColors so the website
// shares the same light theme identity (primary blue, surfaces, accents,
// elevation). Admin overrides via applyRemoteColors still apply to flat keys.

const accents = {
  blue: { bg: '#E6F1FB', border: '#BBD8F6', chip: '#0F6FFF', value: '#0C447C', label: '#185FA5' },
  teal: { bg: '#E1F5EE', border: '#A9E2CE', chip: '#1D9E75', value: '#0F6E56', label: '#0F6E56' },
  rose: { bg: '#FBEAF0', border: '#F2C4D6', chip: '#CC6699', value: '#72243E', label: '#993556' },
  amber: { bg: '#FDF0D6', border: '#F7E3B8', chip: '#C98A06', value: '#7A4A06', label: '#C98A06' },
  purple: { bg: '#EEEDFE', border: '#D2CFF7', chip: '#6B46FF', value: '#3C3489', label: '#534AB7' },
  gray: { bg: '#EEF1F5', border: '#DCE2EA', chip: '#6B7280', value: '#374151', label: '#5F6B7A' },
};

const elev = {
  card: { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 },
  cardSm: { shadowColor: '#11224A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  hero: { shadowColor: '#0F6FFF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 8 },
};

export const defaultColors = {
  backgroundColor: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF4FF',
  inset: '#F2F6FC',

  primary: '#0F6FFF',
  primaryDark: '#0757D7',
  primaryLight: '#DBEAFF',

  secondary: '#6B46FF',
  secondaryLight: '#ECE6FF',
  success: '#18C287',
  successLight: '#E1F5EE',
  warning: '#F6A900',
  warningLight: '#FDF0D6',
  danger: '#EF4444',
  dangerLight: '#FDE2E2',
  accent: '#CC6699',

  textPrimary: '#07122F',
  textSecondary: '#536179',
  textMuted: '#8B97AA',

  border: '#EAF0F7',
  inputBackground: '#FFFFFF',

  shadow: '#0B2B66',
  white: '#FFFFFF',
  black: '#000000',

  accents,
  elev,
};

export const colors = { ...defaultColors };

export const applyRemoteColors = (remoteColors = {}) => {
  if (!remoteColors || typeof remoteColors !== 'object') {
    return colors;
  }

  Object.entries(remoteColors).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim() && key in colors) {
      colors[key] = value;
    }
  });

  return colors;
};
