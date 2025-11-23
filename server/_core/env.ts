export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Google OAuth credentials
  googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
  googleCallbackUrl: process.env.GOOGLE_OAUTH_CALLBACK_URL ?? "",
  sessionSecret: process.env.APP_SESSION_SECRET ?? "hotel-price-monitor-secret-change-in-production",
};
