import { StyleSheet, Text, View } from 'react-native';

import { AuthLayout, PrimaryButton, TextButton } from '../../components/AuthLayout';
import { colors } from '../../constants/colors';

export default function LandingScreen({ navigation }) {
  return (
    <AuthLayout
      title="AeroPlan Web"
      subtitle="Secure access for sales teams, account planning, and performance tracking."
    >
      <View style={styles.actions}>
        <PrimaryButton title="Sign in" onPress={() => navigation.navigate('Login')} />
        <TextButton title="Create a new account" onPress={() => navigation.navigate('CreateAccount')} />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Secure. Simple. Seamless.</Text>
        <Text style={styles.noteText}>
          Continue with your AeroPlan account to access the web dashboard.
        </Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 14,
  },
  note: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  noteTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  noteText: {
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
});
