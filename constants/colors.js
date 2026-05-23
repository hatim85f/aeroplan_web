export const defaultColors = {
  backgroundColor: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceSoft: '#F3F7FF',

  primary: '#0F6FFF',
  primaryDark: '#0757D7',
  primaryLight: '#DBEAFF',

  secondary: '#6B46FF',
  success: '#18C287',
  warning: '#F6A900',
  danger: '#EF4444',

  textPrimary: '#07122F',
  textSecondary: '#536179',
  textMuted: '#8B97AA',

  border: '#DFE7F3',
  inputBackground: '#FFFFFF',

  shadow: '#0B2B66',
  white: '#FFFFFF',
  black: '#000000',
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
