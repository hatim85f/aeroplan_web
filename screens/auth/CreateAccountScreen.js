import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout, Field, FormMessage, PrimaryButton, TextButton } from '../../components/AuthLayout';
import { colors } from '../../constants/colors';
import { registerUser } from '../../store/auth/authActions';

const accountRoles = [
  {
    label: 'Admin',
    value: 'admin',
    description: 'Manage users, settings, and organization data.',
  },
  {
    label: 'Manager',
    value: 'manager',
    description: 'Manage your team, reports, and performance.',
  },
  {
    label: 'Representative',
    value: 'representative',
    description: 'Access accounts, update activities, and view performance.',
  },
];

export default function CreateAccountScreen({ navigation }) {
  const [form, setForm] = useState({
    fullName: '',
    userName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'representative',
  });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleRegister = async () => {
    setMessage('');

    if (form.password !== form.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser(form);
      navigation.navigate('VerifyAccount', { email: form.email });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Fill in your details to get started."
      contentPosition="top"
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TextButton title="Sign in" onPress={() => navigation.navigate('Login')} />
        </View>
      }
    >
      <Field label="Full name" value={form.fullName} onChangeText={(value) => updateField('fullName', value)} placeholder="Enter your full name" />
      <Field label="Username" value={form.userName} onChangeText={(value) => updateField('userName', value)} placeholder="Choose a username" />
      <Field label="Email" value={form.email} onChangeText={(value) => updateField('email', value)} placeholder="you@company.com" keyboardType="email-address" />
      <Field label="Phone number" value={form.phone} onChangeText={(value) => updateField('phone', value)} placeholder="(555) 123-4567" keyboardType="phone-pad" />
      <View style={styles.roles}>
        {accountRoles.map((role) => (
          <Pressable
            key={role.value}
            onPress={() => updateField('role', role.value)}
            style={[styles.roleCard, form.role === role.value && styles.selectedRole]}
          >
            <Text style={styles.roleTitle}>{role.label}</Text>
            <Text style={styles.roleDescription}>{role.description}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Password" value={form.password} onChangeText={(value) => updateField('password', value)} placeholder="Create a password" secureTextEntry />
      <Field label="Confirm password" value={form.confirmPassword} onChangeText={(value) => updateField('confirmPassword', value)} placeholder="Confirm your password" secureTextEntry />
      <FormMessage>{message}</FormMessage>
      <PrimaryButton title={isSubmitting ? 'Creating account...' : 'Create account'} onPress={handleRegister} disabled={isSubmitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  roles: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  selectedRole: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft,
  },
  roleTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  roleDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
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
