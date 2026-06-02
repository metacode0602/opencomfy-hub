import { websiteConfig } from "./config/website"

/**
 * The routes for the application
 */
export enum Routes {
  Root = '/',

  // marketing pages
  FAQ = '/#faq',
  Features = '/#features',
  Pricing = '/pricing', // change to /#pricing if you want to use the pricing section in homepage
  Models = '/models',
  Rankings = '/rankings',
  Blog = '/blog',
  Docs = '/docs',
  About = '/about',
  Contact = '/contact',
  Waitlist = '/waitlist',
  Changelog = '/changelog',
  Roadmap = '/blog/roadmap',
  CookiePolicy = '/cookie',
  PrivacyPolicy = '/privacy',
  TermsOfService = '/terms',

  // auth routes
  /** @deprecated 使用 /signin */
  Login = '/signin',
  /** @deprecated 公开注册已关闭 */
  Register = '/signin',
  AuthError = '/auth/error',
  ForgotPassword = '/auth/forgot-password',
  ResetPassword = '/auth/reset-password',
  Welcome = '/auth/welcome',
  UsageList = '/dashboard/usage-list',
  // dashboard routes
  Dashboard = '/dashboard',
  Settings = '/settings',
  SettingsProfile = '/settings/profile',
  SettingsBilling = '/settings/billing',
  SettingsSecurity = '/settings/security',
  SettingsNotifications = '/settings/notifications',
  SettingsPlatforms = '/settings/platforms',
  SettingsInvite = '/settings/invite',
  SettingsLogout = '/settings/logout',
}

/**
 * The routes that can not be accessed by logged in users
 */
export const routesNotAllowedByLoggedInUsers = [Routes.Login, Routes.Register]
