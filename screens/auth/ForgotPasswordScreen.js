import { useState } from 'react';

import { AuthLayout, Field, FormMessage, PrimaryButton, TextButton } from '../../components/AuthLayout';
import { forgotPassword } from '../../store/auth/authActions';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async () => {
    setMessage('');
    setIsSubmitting(true);

    try {
      await forgotPassword({ email });
      setMessageType('success');
      setMessage('Check your email for password reset instructions.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="No worries. Enter your email or App ID and we will send you a reset link."
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
      footer={<TextButton title="Back to sign in" onPress={() => navigation.navigate('Login')} />}
    >
      <Field label="Email or App ID" value={email} onChangeText={setEmail} placeholder="you@company.com" keyboardType="email-address" />
      <FormMessage type={messageType}>{message}</FormMessage>
      <PrimaryButton title={isSubmitting ? 'Sending...' : 'Send reset link'} onPress={handleForgotPassword} disabled={isSubmitting} />
    </AuthLayout>
  );
}
