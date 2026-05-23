import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout, Field, FormMessage, PrimaryButton, TextButton } from '../../components/AuthLayout';
import { loginUser } from '../../store/auth/authActions';
import { colors } from '../../constants/colors';

export default function LoginScreen({ navigation, onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setMessage('');
    setIsSubmitting(true);

    try {
      const result = await loginUser({ email, password });
      const base = result.data || result;
      const token = result.token || base.token || result.data?.token || '';
      await onAuthenticated({ ...base, token });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Access your workspace and continue planning."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>New to AeroPlan?</Text>
          <TextButton title="Create account" onPress={() => navigation.navigate('CreateAccount')} />
        </View>
      }
    >
      <Field label="Email or App ID" value={email} onChangeText={setEmail} placeholder="you@company.com" keyboardType="email-address" />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />
      <View style={styles.row}>
        <Text style={styles.remember}>Remember me</Text>
        <TextButton title="Forgot password?" onPress={() => navigation.navigate('ForgotPassword')} />
      </View>
      <FormMessage>{message}</FormMessage>
      <PrimaryButton title={isSubmitting ? 'Signing in...' : 'Sign in'} onPress={handleLogin} disabled={isSubmitting} />
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>
      <Pressable style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}>
        <Text style={styles.googleMark}>G</Text>
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remember: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: colors.textMuted,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  googleButton: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
  },
  googleButtonPressed: {
    opacity: 0.75,
  },
  googleMark: {
    color: '#4285F4',
    fontSize: 18,
    fontWeight: '800',
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
});
