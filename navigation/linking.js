// React Navigation web URL routing. Maps every route to a clean browser path so
// each page is shareable/refreshable (e.g. /privacy-policy, /settings, /orders).
// Detail/form screens that receive object params keep their params in navigation
// state; the path still updates so the URL reflects the current page.

const screens = {
  // Auth (public)
  Landing: 'welcome',
  Login: 'login',
  CreateAccount: 'create-account',
  VerifyAccount: 'verify-account',
  ForgotPassword: 'forgot-password',

  // Legal / public (registered in both Auth and Main navigators)
  PrivacyPolicy: 'privacy-policy',
  Terms: 'terms',

  // Main
  Home: '',
  Profile: 'profile',
  Notifications: 'notifications',
  Settings: 'settings',
  ChangePassword: 'change-password',
  Feedback: 'feedback',
  Placeholder: 'placeholder',

  // Accounts
  Accounts: 'accounts',
  AccountDetail: 'accounts/detail',
  AccountForm: 'accounts/form',

  // Teams & Lines
  Teams: 'teams',
  CreateTeam: 'teams/new',
  TeamDetail: 'teams/detail',
  TeamMemberDetail: 'teams/member',
  TeamInvitations: 'team-invitations',
  Lines: 'lines',
  CreateLine: 'lines/new',
  LineDetail: 'lines/detail',

  // Products & channels
  Products: 'products',
  ProductDetail: 'products/detail',
  ProductForm: 'products/form',
  ProductBulkImport: 'products/import',
  SalesChannels: 'sales-channels',
  SalesChannelForm: 'sales-channels/form',

  // Sales team
  SalesTeam: 'sales-team',
  SalesTeamForm: 'sales-team/form',
  SalesTeamDetails: 'sales-team/detail',

  // FOC
  FocOverridesList: 'foc-overrides',
  FocOverrideForm: 'foc-overrides/form',
  FocOverrideDetails: 'foc-overrides/detail',
  FocLookup: 'foc-lookup',

  // Orders
  Orders: 'orders',
  CreateOrder: 'orders/new',
  OrderDetails: 'orders/detail',
  OrderHistory: 'orders/history',

  // Sales
  SalesOverview: 'sales',
  SalesUpload: 'sales/upload',
  SalesRecords: 'sales/records',
  SalesRecordDetail: 'sales/records/detail',
  SalesBatches: 'sales/batches',
  SalesBatchDetail: 'sales/batches/detail',
  SalesMappings: 'sales/mappings',
  SalesAreas: 'sales/areas',
  SharedSalesRules: 'sales/shared-rules',
  ManualSalesEntry: 'sales/manual-entry',
  SalesChannelBreakdown: 'sales/by-channel',
  SalesTable: 'sales/table',
  ProductSalesRecords: 'sales/product-records',

  // Targets & forecast
  TargetDashboard: 'targets/dashboard',
  MyTargetDashboard: 'targets/my',
  MyProducts: 'targets/my-products',
  TargetAssignments: 'targets/assignments',
  TargetAssignmentForm: 'targets/assignments/form',
  TargetAssignmentDetails: 'targets/assignments/detail',
  TargetPhasing: 'targets/phasing',
  TargetPhasingForm: 'targets/phasing/form',
  TargetBulkImport: 'targets/import',
  ForecastTeam: 'forecasts/team',
  ForecastDetails: 'forecasts/detail',
  MyForecast: 'forecasts/my',
  ForecastMatching: 'forecasts/vs-sales',
  Achievement: 'achievement',
  RepCoverage: 'rep-coverage',

  // Stock
  StockAccounts: 'stock-accounts',
  StockAccountDetails: 'stock-accounts/detail',

  // Planning
  PlanningCalendar: 'planning/calendar',
  PlanningAccounts: 'planning/accounts',
  PlanningDashboard: 'planning/dashboard',
  PlanningReports: 'planning/reports',

  // Tasks
  MyTasks: 'tasks',
  TeamTasks: 'tasks/team',
  TaskDashboard: 'tasks/detail',
  TaskReports: 'tasks/reports',
};

export const linking = {
  prefixes: [typeof window !== 'undefined' && window.location ? window.location.origin : 'https://aeroplan.app'],
  config: { screens },
};

export default linking;
