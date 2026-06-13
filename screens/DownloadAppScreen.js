import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';

const logoWhite = require('../assets/images/logo_white.png');

// Shown when the website is opened on a small/mobile viewport. The web app is
// desktop-oriented; mobile visitors are guided to install the native apps.
export default function DownloadAppScreen({ appMetadata }) {
  const appName = appMetadata?.appName || 'AeroPlan';
  const tagline = appMetadata?.appTagline || 'Medical field planning and team execution';
  const iosUrl = appMetadata?.links?.appStoreURL || appMetadata?.links?.iosUrl || '#';
  const androidUrl = appMetadata?.links?.playStoreURL || appMetadata?.links?.androidUrl || '#';

  const open = (url) => {
    if (!url || url === '#') return;
    Linking.openURL(url).catch(() => {});
  };

  const StoreButton = ({ icon, top, bottom, url }) => (
    <Pressable
      onPress={() => open(url)}
      style={({ pressed }) => [styles.store, pressed && url !== '#' && styles.storePressed]}
    >
      <Ionicons name={icon} size={26} color="#fff" />
      <View style={styles.storeText}>
        <Text style={styles.storeTop}>{top}</Text>
        <Text style={styles.storeBottom}>{bottom}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Image source={logoWhite} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>{appName}</Text>
        <Text style={styles.tagline}>{tagline}</Text>

        <View style={styles.divider} />

        <Text style={styles.heading}>Get the app</Text>
        <Text style={styles.sub}>
          {appName} is built for mobile. Download the app to plan visits, track sales, and manage your team on the go.
        </Text>

        <View style={styles.stores}>
          <StoreButton icon="logo-apple" top="Download on the" bottom="App Store" url={iosUrl} />
          <StoreButton icon="logo-google-playstore" top="GET IT ON" bottom="Google Play" url={androidUrl} />
        </View>

        <Text style={styles.note}>Available on iOS and Android</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  logo: { width: 150, height: 48 },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 18 },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6, textAlign: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'stretch', marginVertical: 26 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  stores: { alignSelf: 'stretch', gap: 12, marginTop: 24 },
  store: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#000', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  storePressed: { opacity: 0.85 },
  storeText: { gap: 1 },
  storeTop: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  storeBottom: { color: '#fff', fontSize: 17, fontWeight: '700' },
  note: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 20 },
});
