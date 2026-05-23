import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet } from 'react-native';

const Stack = createStackNavigator();

export default function MainNavigator({ userDetails, appMetadata, onSignOut }) {
  const HomeScreen = require('../screens/home/HomeScreen').default;
  const AccountsScreen = require('../screens/accounts/AccountsScreen').default;
  const AccountDetailScreen = require('../screens/accounts/AccountDetailScreen').default;
  const AccountFormScreen = require('../screens/accounts/AccountFormScreen').default;
  const PlaceholderScreen = require('../screens/placeholder/PlaceholderScreen').default;

  const LinesScreen = require('../screens/lines/LinesScreen').default;
  const CreateLineScreen = require('../screens/lines/CreateLineScreen').default;
  const LineDetailScreen = require('../screens/lines/LineDetailScreen').default;
  const TeamsScreen = require('../screens/teams/TeamsScreen').default;
  const CreateTeamScreen = require('../screens/teams/CreateTeamScreen').default;
  const TeamDetailScreen = require('../screens/teams/TeamDetailScreen').default;
  const TeamInvitationsScreen = require('../screens/teamInvitations/TeamInvitationsScreen').default;
  const ProfileScreen = require('../screens/profile/ProfileScreen').default;
  const ProductsScreen = require('../screens/products/ProductsScreen').default;
  const ProductDetailScreen = require('../screens/products/ProductDetailScreen').default;
  const ProductFormScreen = require('../screens/products/ProductFormScreen').default;
  const ProductBulkImportScreen = require('../screens/products/ProductBulkImportScreen').default;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: styles.card }}>
      <Stack.Screen name="Home" options={{ title: 'AeroPlan' }}>
        {(props) => (
          <HomeScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Accounts">
        {(props) => (
          <AccountsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AccountDetail">
        {(props) => (
          <AccountDetailScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AccountForm">
        {(props) => (
          <AccountFormScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Placeholder" component={PlaceholderScreen} />
      <Stack.Screen name="Lines">
        {(props) => (
          <LinesScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateLine">
        {(props) => (
          <CreateLineScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="LineDetail">
        {(props) => (
          <LineDetailScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Teams">
        {(props) => (
          <TeamsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateTeam">
        {(props) => (
          <CreateTeamScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="TeamDetail">
        {(props) => (
          <TeamDetailScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="TeamInvitations">
        {(props) => (
          <TeamInvitationsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Profile">
        {(props) => (
          <ProfileScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Products">
        {(props) => (
          <ProductsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ProductDetail">
        {(props) => (
          <ProductDetailScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ProductForm">
        {(props) => (
          <ProductFormScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ProductBulkImport">
        {(props) => (
          <ProductBulkImportScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 0 },
});
