import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { colors } from '../constants/colors';
import { defaultAppMetadata } from '../constants/metadataDefaults';
import {
  clearUserDetails,
  getCurrentUser,
  getSavedUserDetails,
  saveUserDetails,
} from '../store/auth/authActions';
import { loadAppMetadata } from '../store/appMainDetails/appMainDetailsActions';

export default function AppNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [appMetadata, setAppMetadata] = useState(defaultAppMetadata);

  useEffect(() => {
    const bootstrap = async () => {
      const metadata = await loadAppMetadata();
      setAppMetadata(metadata);

      const savedUserDetails = await getSavedUserDetails();

      if (savedUserDetails) {
        const token =
          savedUserDetails.token ||
          savedUserDetails.data?.token ||
          savedUserDetails.accessToken ||
          '';

        if (token) {
          try {
            const user = await getCurrentUser(token);
            setUserDetails({ ...savedUserDetails, token, user });
          } catch {
            await clearUserDetails();
            setUserDetails(null);
          }
        } else {
          // No token found — force re-login
          await clearUserDetails();
          setUserDetails(null);
        }
      } else {
        setUserDetails(null);
      }

      setIsReady(true);
    };

    bootstrap();
  }, []);

  const handleAuthenticated = async (payload) => {
    const saved = await saveUserDetails(payload);
    setUserDetails(saved);
  };

  const handleSignOut = async () => {
    await clearUserDetails();
    setUserDetails(null);
  };

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {userDetails ? (
        <MainNavigator
          userDetails={userDetails}
          appMetadata={appMetadata}
          onSignOut={handleSignOut}
        />
      ) : (
        <AuthNavigator appMetadata={appMetadata} onAuthenticated={handleAuthenticated} />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundColor,
  },
});
