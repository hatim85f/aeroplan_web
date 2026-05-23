import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import { colors } from '../constants/colors';

const logoWhite = require('../assets/images/logo_white.png');
const authImage = require('../assets/images/auth_image.png');

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  contentPosition = 'center',
  onBack,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const alignTop = contentPosition === 'top';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={[styles.card, isCompact && styles.compactCard]}>
        <View style={[styles.brandPanel, isCompact && styles.compactBrandPanel]}>
          <ImageBackground source={authImage} style={styles.brandBackground} resizeMode="cover">
            <View style={styles.brandOverlay}>
              <View>
                <Image source={logoWhite} style={styles.logo} resizeMode="contain" />
                <View style={styles.brandCopy}>
                  <Text style={styles.brandTitle}>Welcome to AeroPlan</Text>
                  <Text style={styles.brandText}>
                    A smarter way to manage your sales operations and drive performance.
                  </Text>
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View
          style={[
            styles.formPanel,
            alignTop && styles.formPanelTop,
            isCompact && styles.compactFormPanel,
          ]}
        >
          <View style={styles.formContent}>
            {!!onBack && (
              <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.textButtonPressed]}>
                <Text style={styles.backButtonText}>{'< Back'}</Text>
              </Pressable>
            )}
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <View style={styles.body}>{children}</View>
            {!!footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  onSubmitEditing,
  returnKeyType,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = Boolean(secureTextEntry);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={isPasswordField && !isPasswordVisible}
          keyboardType={keyboardType}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoCapitalize="none"
          style={[styles.input, isPasswordField && styles.passwordInput]}
          placeholderTextColor="#98a2b3"
        />
        {isPasswordField && (
          <Pressable
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={({ pressed }) => [styles.eyeButton, pressed && styles.textButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.textButtonPressed}>
      <Text style={styles.textButton}>{title}</Text>
    </Pressable>
  );
}

export function FormMessage({ type = 'error', children }) {
  if (!children) {
    return null;
  }

  return (
    <Text style={[styles.message, type === 'success' && styles.successMessage]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.backgroundColor,
  },
  page: {
    flexGrow: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    backgroundColor: colors.backgroundColor,
  },
  card: {
    width: '100%',
    minHeight: '100vh',
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  compactCard: {
    flexDirection: 'column',
  },
  brandPanel: {
    width: '42%',
    minWidth: 380,
    backgroundColor: colors.primaryDark,
  },
  compactBrandPanel: {
    width: '100%',
    minHeight: 420,
    minWidth: 0,
  },
  brandBackground: {
    flex: 1,
    minHeight: '100vh',
  },
  brandOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 54,
    paddingVertical: 44,
    backgroundColor: 'rgba(0, 18, 82, 0.2)',
  },
  logo: {
    width: 142,
    height: 44,
    alignSelf: 'flex-start',
  },
  brandCopy: {
    marginTop: 42,
    maxWidth: 390,
  },
  brandTitle: {
    color: colors.white,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
  },
  brandText: {
    color: '#dce8ff',
    marginTop: 18,
    fontSize: 16,
    lineHeight: 24,
  },
  formPanel: {
    flex: 1,
    minWidth: 460,
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 56,
    paddingVertical: 56,
  },
  formPanelTop: {
    justifyContent: 'flex-start',
    paddingTop: 64,
  },
  formContent: {
    width: '100%',
    maxWidth: 420,
  },
  compactFormPanel: {
    minWidth: 0,
    minHeight: 0,
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  body: {
    marginTop: 28,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    height: 46,
    minWidth: 0,
    borderWidth: 0,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    backgroundColor: 'transparent',
  },
  inputWrap: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.inputBackground,
  },
  passwordInput: {
    paddingRight: 4,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressedButton: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  textButton: {
    color: colors.primary,
    fontWeight: '800',
  },
  textButtonPressed: {
    opacity: 0.65,
  },
  footer: {
    alignItems: 'center',
    marginTop: 22,
  },
  message: {
    color: colors.danger,
    fontWeight: '700',
  },
  successMessage: {
    color: colors.success,
  },
});
