import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";

import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import DownloadAppScreen from "../screens/DownloadAppScreen";
import { linking } from "./linking";
import { colors } from "../constants/colors";
import { defaultAppMetadata } from "../constants/metadataDefaults";
import {
  clearUserDetails,
  getCurrentUser,
  getSavedUserDetails,
  saveUserDetails,
} from "../store/auth/authActions";
import { loadAppMetadata } from "../store/appMainDetails/appMainDetailsActions";

export default function AppNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [appMetadata, setAppMetadata] = useState(defaultAppMetadata);
  const { width } = useWindowDimensions();
  const isMobile = width > 0 && width < 768;

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
          "";

        if (token) {
          try {
            const user = await getCurrentUser(token);
            const merged = { ...savedUserDetails, token, user };
            await saveUserDetails(merged);
            setUserDetails(merged);
          } catch {
            // Network failure — keep saved session, show cached data
            setUserDetails({ ...savedUserDetails, token });
          }
        } else {
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

  // On mobile viewports the web app redirects to the "get the app" page —
  // except the public legal URLs, which must stay reachable for store review.
  const pathname = (typeof window !== "undefined" && window.location && window.location.pathname) || "";
  const isLegalRoute = /privacy-policy|terms/i.test(pathname);
  if (isReady && isMobile && !isLegalRoute) {
    return <DownloadAppScreen appMetadata={appMetadata} />;
  }

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <NavigationContainer
        linking={linking}
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        }
      >
        {userDetails ? (
          <MainNavigator
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={handleSignOut}
          />
        ) : (
          <AuthNavigator
            appMetadata={appMetadata}
            onAuthenticated={handleAuthenticated}
          />
        )}
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundColor,
  },
});
