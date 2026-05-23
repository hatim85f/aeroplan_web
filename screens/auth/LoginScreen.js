import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
});
