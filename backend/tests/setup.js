/**
 * Test environment defaults.
 *
 * Set before any application module is imported, because config/index.js reads
 * process.env once at module scope. Without these, importing anything that
 * touches config would either throw on the required-secret check or — worse —
 * pick up a real .env and point the suite at the production cluster.
 */
process.env.NODE_ENV = "test";
process.env.MONGO_DB_URI ??= "mongodb://127.0.0.1:27017/famlink-test";
process.env.JWT_SECRET ??= "test_jwt_secret";
process.env.REFRESH_TOKEN_SECRET ??= "test_refresh_secret";
process.env.STRIPE_SECRET_KEY ??= "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test_placeholder";
