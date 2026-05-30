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
  const TeamMemberDetailScreen = require('../screens/teams/TeamMemberDetailScreen').default;
  const TeamInvitationsScreen = require('../screens/teamInvitations/TeamInvitationsScreen').default;
  const ProfileScreen = require('../screens/profile/ProfileScreen').default;
  const ProductsScreen = require('../screens/products/ProductsScreen').default;
  const ProductDetailScreen = require('../screens/products/ProductDetailScreen').default;
  const ProductFormScreen = require('../screens/products/ProductFormScreen').default;
  const ProductBulkImportScreen = require('../screens/products/ProductBulkImportScreen').default;
  const SalesChannelsScreen = require('../screens/salesChannels/SalesChannelsScreen').default;
  const SalesChannelFormScreen = require('../screens/salesChannels/SalesChannelFormScreen').default;
  const SalesTeamScreen        = require('../screens/salesTeam/SalesTeamScreen').default;
  const SalesTeamFormScreen    = require('../screens/salesTeam/SalesTeamFormScreen').default;
  const SalesTeamDetailsScreen = require('../screens/salesTeam/SalesTeamDetailsScreen').default;
  const FocOverridesListScreen = require('../screens/orders/FocOverridesListScreen').default;
  const FocOverrideFormScreen = require('../screens/orders/FocOverrideFormScreen').default;
  const FocOverrideDetailsScreen = require('../screens/orders/FocOverrideDetailsScreen').default;
  const FocLookupScreen = require('../screens/orders/FocLookupScreen').default;
  const OrdersScreen       = require('../screens/orders/OrdersScreen').default;
  const CreateOrderScreen  = require('../screens/orders/CreateOrderScreen').default;
  const OrderDetailsScreen = require('../screens/orders/OrderDetailsScreen').default;
  const OrderHistoryScreen = require('../screens/orders/OrderHistoryScreen').default;

  const TargetDashboardScreen         = require('../screens/targets/TargetDashboardScreen').default;
  const MyTargetDashboardScreen       = require('../screens/targets/MyTargetDashboardScreen').default;
  const TargetAssignmentsScreen       = require('../screens/targets/TargetAssignmentsScreen').default;
  const TargetAssignmentFormScreen    = require('../screens/targets/TargetAssignmentFormScreen').default;
  const TargetAssignmentDetailsScreen = require('../screens/targets/TargetAssignmentDetailsScreen').default;
  const TargetPhasingScreen           = require('../screens/targets/TargetPhasingScreen').default;
  const TargetPhasingFormScreen       = require('../screens/targets/TargetPhasingFormScreen').default;
  const TargetBulkImportScreen        = require('../screens/targets/TargetBulkImportScreen').default;

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
      <Stack.Screen name="TeamMemberDetail">
        {(props) => (
          <TeamMemberDetailScreen
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
      <Stack.Screen name="SalesChannels">
        {(props) => (
          <SalesChannelsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SalesChannelForm">
        {(props) => (
          <SalesChannelFormScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SalesTeam">
        {(props) => (
          <SalesTeamScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />
        )}
      </Stack.Screen>
      <Stack.Screen name="SalesTeamForm">
        {(props) => (
          <SalesTeamFormScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />
        )}
      </Stack.Screen>
      <Stack.Screen name="SalesTeamDetails">
        {(props) => (
          <SalesTeamDetailsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />
        )}
      </Stack.Screen>
      <Stack.Screen name="FocOverridesList">
        {(props) => (
          <FocOverridesListScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FocOverrideForm">
        {(props) => (
          <FocOverrideFormScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FocOverrideDetails">
        {(props) => (
          <FocOverrideDetailsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FocLookup">
        {(props) => (
          <FocLookupScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Orders">
        {(props) => (
          <OrdersScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateOrder">
        {(props) => (
          <CreateOrderScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OrderDetails">
        {(props) => (
          <OrderDetailsScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OrderHistory">
        {(props) => (
          <OrderHistoryScreen
            {...props}
            userDetails={userDetails}
            appMetadata={appMetadata}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>

      {/* ── Targeting & Forecast ─────────────────────────────────────── */}
      <Stack.Screen name="TargetDashboard">
        {(props) => <TargetDashboardScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="MyTargetDashboard">
        {(props) => <MyTargetDashboardScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TargetAssignments">
        {(props) => <TargetAssignmentsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TargetAssignmentForm">
        {(props) => <TargetAssignmentFormScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TargetAssignmentDetails">
        {(props) => <TargetAssignmentDetailsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TargetPhasing">
        {(props) => <TargetPhasingScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TargetPhasingForm">
        {(props) => <TargetPhasingFormScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TargetBulkImport">
        {(props) => <TargetBulkImportScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 0 },
});
