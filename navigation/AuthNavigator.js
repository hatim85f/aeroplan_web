import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

export default function AuthNavigator({ appMetadata, onAuthenticated }) {
  const LandingScreen = require('../screens/auth/LandingScreen').default;
  const LoginScreen = require('../screens/auth/LoginScreen').default;
  const CreateAccountScreen = require('../screens/auth/CreateAccountScreen').default;
  const VerifyAccountScreen = require('../screens/auth/VerifyAccountScreen').default;
  const ForgotPasswordScreen = require('../screens/auth/ForgotPasswordScreen').default;
  const PrivacyPolicyScreen = require('../screens/settings/PrivacyPolicyScreen').default;
  const TermsScreen = require('../screens/settings/TermsScreen').default;

  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing">
        {(props) => <LandingScreen {...props} appMetadata={appMetadata} />}
      </Stack.Screen>
      <Stack.Screen name="Login">
        {(props) => (
          <LoginScreen
            {...props}
            appMetadata={appMetadata}
            onAuthenticated={onAuthenticated}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateAccount">
        {(props) => <CreateAccountScreen {...props} appMetadata={appMetadata} />}
      </Stack.Screen>
      <Stack.Screen name="VerifyAccount">
        {(props) => (
          <VerifyAccountScreen
            {...props}
            appMetadata={appMetadata}
            onAuthenticated={onAuthenticated}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {(props) => <ForgotPasswordScreen {...props} appMetadata={appMetadata} />}
      </Stack.Screen>
      <Stack.Screen name="PrivacyPolicy">
        {(props) => <PrivacyPolicyScreen {...props} appMetadata={appMetadata} />}
      </Stack.Screen>
      <Stack.Screen name="Terms">
        {(props) => <TermsScreen {...props} appMetadata={appMetadata} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
