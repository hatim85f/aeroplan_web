import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet } from 'react-native';

const Stack = createStackNavigator();

// Friendly browser-tab titles (instead of raw route names like "PlanningDashboard").
const TITLE_OVERRIDES = {
  Home: 'Dashboard',
  MyTasks: 'My Tasks',
  TeamTasks: 'Team Tasks',
  TaskDashboard: 'Task',
  TaskReports: 'Task Reports',
  FocLookup: 'FOC Lookup',
  FocOverridesList: 'FOC Overrides',
  FocOverrideForm: 'FOC Override',
  FocOverrideDetails: 'FOC Override',
  RepCoverage: 'Rep Coverage',
  SharedSalesRules: 'Shared Sales Rules',
  ManualSalesEntry: 'Manual Sales Entry',
  ProductSalesRecords: 'Product Sales',
  SalesChannelBreakdown: 'Sales by Channel',
  ForecastMatching: 'Forecast vs Sales',
  MyTargetDashboard: 'My Targets',
  TargetDashboard: 'Target Dashboard',
  PrivacyPolicy: 'Privacy Policy',
  Terms: 'Terms & Conditions',
  ChangePassword: 'Change Password',
  Feedback: 'Feedback',
};

const prettyTitle = (name) => {
  const label = TITLE_OVERRIDES[name] || String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // PlanningDashboard -> Planning Dashboard
    .replace(/\bFoc\b/g, 'FOC')
    .trim();
  return label || 'AeroPlan';
};

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

  const SalesOverviewScreen    = require('../screens/sales/SalesOverviewScreen').default;
  const SalesUploadScreen      = require('../screens/sales/SalesUploadScreen').default;
  const SalesRecordsScreen     = require('../screens/sales/SalesRecordsScreen').default;
  const SalesRecordDetailScreen= require('../screens/sales/SalesRecordDetailScreen').default;
  const SalesBatchesScreen     = require('../screens/sales/SalesBatchesScreen').default;
  const SalesBatchDetailScreen = require('../screens/sales/SalesBatchDetailScreen').default;
  const SalesMappingsScreen    = require('../screens/sales/SalesMappingsScreen').default;
  const SalesAreasScreen       = require('../screens/sales/SalesAreasScreen').default;
  const SharedSalesRulesScreen = require('../screens/sales/SharedSalesRulesScreen').default;
  const ManualSalesEntryScreen           = require('../screens/sales/ManualSalesEntryScreen').default;
  const SalesChannelBreakdownScreen      = require('../screens/sales/SalesChannelBreakdownScreen').default;
  const SalesTableScreen                 = require('../screens/sales/SalesTableScreen').default;
  const ProductSalesRecordsScreen        = require('../screens/sales/ProductSalesRecordsScreen').default;

  const TargetDashboardScreen         = require('../screens/targets/TargetDashboardScreen').default;
  const MyTargetDashboardScreen       = require('../screens/targets/MyTargetDashboardScreen').default;
  const MyProductsScreen              = require('../screens/targets/MyProductsScreen').default;
  const TargetAssignmentsScreen       = require('../screens/targets/TargetAssignmentsScreen').default;
  const TargetAssignmentFormScreen    = require('../screens/targets/TargetAssignmentFormScreen').default;
  const TargetAssignmentDetailsScreen = require('../screens/targets/TargetAssignmentDetailsScreen').default;
  const TargetPhasingScreen           = require('../screens/targets/TargetPhasingScreen').default;
  const TargetPhasingFormScreen       = require('../screens/targets/TargetPhasingFormScreen').default;
  const TargetBulkImportScreen        = require('../screens/targets/TargetBulkImportScreen').default;

  const ForecastTeamScreen    = require('../screens/forecasts/ForecastTeamScreen').default;
  const ForecastDetailsScreen = require('../screens/forecasts/ForecastDetailsScreen').default;
  const MyForecastScreen      = require('../screens/forecasts/MyForecastScreen').default;
  const ForecastMatchingScreen = require('../screens/forecasts/ForecastMatchingScreen').default;
  const AchievementScreen      = require('../screens/achievements/AchievementScreen').default;
  const RepCoverageScreen      = require('../screens/management/RepCoverageScreen').default;
  const StockAccountsScreen        = require('../screens/stockAccounts/StockAccountsScreen').default;
  const StockAccountDetailsScreen  = require('../screens/stockAccounts/StockAccountDetailsScreen').default;
  const PlanningAccountsScreen     = require('../screens/planning/PlanningAccountsScreen').default;
  const PlanningCalendarScreen     = require('../screens/planning/PlanningCalendarScreen').default;
  const PlanningDashboardScreen    = require('../screens/planning/PlanningDashboardScreen').default;
  const PlanningReportsScreen      = require('../screens/planning/PlanningReportsScreen').default;
  const TasksScreen                = require('../screens/tasks/TasksScreen').default;
  const TaskDashboardScreen        = require('../screens/tasks/TaskDashboardScreen').default;
  const TaskReportsScreen          = require('../screens/tasks/TaskReportsScreen').default;
  const NotificationsScreen        = require('../screens/notifications/NotificationsScreen').default;

  const SettingsScreen             = require('../screens/settings/SettingsScreen').default;
  const PrivacyPolicyScreen        = require('../screens/settings/PrivacyPolicyScreen').default;
  const TermsScreen                = require('../screens/settings/TermsScreen').default;
  const ChangePasswordScreen       = require('../screens/settings/ChangePasswordScreen').default;
  const FeedbackScreen             = require('../screens/settings/FeedbackScreen').default;

  return (
    <Stack.Navigator screenOptions={({ route }) => ({ headerShown: false, cardStyle: styles.card, title: prettyTitle(route.name) })}>
      <Stack.Screen name="Home">
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

      {/* ── Sales ───────────────────────────────────────────────────── */}
      <Stack.Screen name="SalesOverview">
        {(props) => <SalesOverviewScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesUpload">
        {(props) => <SalesUploadScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesRecords">
        {(props) => <SalesRecordsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesRecordDetail">
        {(props) => <SalesRecordDetailScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesBatches">
        {(props) => <SalesBatchesScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesBatchDetail">
        {(props) => <SalesBatchDetailScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesMappings">
        {(props) => <SalesMappingsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesAreas">
        {(props) => <SalesAreasScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SharedSalesRules">
        {(props) => <SharedSalesRulesScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="ManualSalesEntry">
        {(props) => <ManualSalesEntryScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesChannelBreakdown">
        {(props) => <SalesChannelBreakdownScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="SalesTable">
        {(props) => <SalesTableScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="ProductSalesRecords">
        {(props) => <ProductSalesRecordsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>

      {/* ── Targeting & Forecast ─────────────────────────────────────── */}
      <Stack.Screen name="TargetDashboard">
        {(props) => <TargetDashboardScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="MyTargetDashboard">
        {(props) => <MyTargetDashboardScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="MyProducts">
        {(props) => <MyProductsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
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
      <Stack.Screen name="ForecastTeam">
        {(props) => <ForecastTeamScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="ForecastDetails">
        {(props) => <ForecastDetailsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="MyForecast">
        {(props) => <MyForecastScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="ForecastMatching">
        {(props) => <ForecastMatchingScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="Achievement">
        {(props) => <AchievementScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="RepCoverage">
        {(props) => <RepCoverageScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="StockAccounts">
        {(props) => <StockAccountsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="StockAccountDetails">
        {(props) => <StockAccountDetailsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="PlanningCalendar">
        {(props) => <PlanningCalendarScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="PlanningAccounts">
        {(props) => <PlanningAccountsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="PlanningDashboard">
        {(props) => <PlanningDashboardScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="PlanningReports">
        {(props) => <PlanningReportsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>

      {/* ── Tasks ────────────────────────────────────────────────────── */}
      <Stack.Screen name="MyTasks">
        {(props) => <TasksScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TeamTasks">
        {(props) => <TasksScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TaskDashboard">
        {(props) => <TaskDashboardScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="TaskReports">
        {(props) => <TaskReportsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>

      {/* ── Notifications ────────────────────────────────────────────── */}
      <Stack.Screen name="Notifications">
        {(props) => <NotificationsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>

      {/* ── Settings & Legal ─────────────────────────────────────────── */}
      <Stack.Screen name="Settings">
        {(props) => <SettingsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="PrivacyPolicy">
        {(props) => <PrivacyPolicyScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="Terms">
        {(props) => <TermsScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="ChangePassword">
        {(props) => <ChangePasswordScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
      <Stack.Screen name="Feedback">
        {(props) => <FeedbackScreen {...props} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 0 },
});
