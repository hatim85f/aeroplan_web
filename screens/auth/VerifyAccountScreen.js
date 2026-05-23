import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AuthLayout, Field, FormMessage, PrimaryButton, TextButton } from '../../components/AuthLayout';
import { resendVerificationCode, verifyAccount } from '../../store/auth/authActions';
import { colors } from '../../constants/colors';

const verifyImage = require('../../assets/images/verify_image.png');

export default function VerifyAccountScreen({ navigation, route, onAuthenticated }) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async () => {
    setMessage('');
    setIsSubmitting(true);

    try {
      const result = await verifyAccount({ email, code });
      const base = result.data || result;
      const token = result.token || base.token || result.data?.token || '';
      await onAuthenticated({ ...base, token });
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setMessage('');

    try {
      await resendVerificationCode({ email });
      setMessageType('success');
      setMessage('Verification code sent.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code sent to your email address."
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
    >
      <Image source={verifyImage} style={styles.verifyImage} resizeMode="contain" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@company.com" keyboardType="email-address" />
      <Field label="Verification code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" />
      <FormMessage type={messageType}>{message}</FormMessage>
      <PrimaryButton title={isSubmitting ? 'Verifying...' : 'Verify code'} onPress={handleVerify} disabled={isSubmitting} />
      <View style={styles.row}>
        <Text style={styles.helper}>Didn't receive the code?</Text>
        <TextButton title="Resend" onPress={handleResend} />
      </View>
      <TextButton title="Change email" onPress={() => navigation.navigate('CreateAccount')} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  verifyImage: {
    width: '100%',
    height: 180,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  helper: {
    color: colors.textMuted,
  },
});
