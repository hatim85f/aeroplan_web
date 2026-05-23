import { createStackNavigator } from '@react-navigation/stack';

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

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: 'Account Detail' }} />
      <Stack.Screen name="AccountForm" component={AccountFormScreen} options={{ title: 'Account Form' }} />
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
    </Stack.Navigator>
  );
}
