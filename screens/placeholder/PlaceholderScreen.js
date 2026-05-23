import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/colors';

export default function PlaceholderScreen({ route, title: titleProp, description = 'This area is ready for the next web workflow.' }) {
  const title = route?.params?.title || titleProp || 'Coming Soon';
  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.backgroundColor,
    padding: 32,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 24,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
});
