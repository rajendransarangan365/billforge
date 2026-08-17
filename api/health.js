// Vercel Serverless Health Check Endpoint
// Used by Vercel Deployment Checks to verify the deployment is healthy
const { connectToDatabase } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const startTime = Date.now();

  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    environment: process.env.VERCEL_ENV || 'development',
    uptime: process.uptime(),
    checks: {},
  };

  // 1. Database connectivity check
  try {
    const db = await connectToDatabase();
    checks.checks.database = {
      status: db ? 'ok' : 'degraded',
      message: db ? 'MongoDB connected' : 'No MONGODB_URI set — running in offline mode',
    };
  } catch (e) {
    checks.checks.database = { status: 'error', message: e.message };
  }

  // 2. Environment variables check
  const requiredEnvVars = ['MONGODB_URI', 'PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(k => !process.env[k]);
  checks.checks.env = {
    status: missingEnvVars.length === 0 ? 'ok' : 'warning',
    message: missingEnvVars.length === 0
      ? 'All environment variables set'
      : `Missing: ${missingEnvVars.join(', ')} — some features may be limited`,
    configured: requiredEnvVars.filter(k => !!process.env[k]),
    missing: missingEnvVars,
  };

  // 3. Runtime check
  checks.checks.runtime = {
    status: 'ok',
    nodeVersion: process.version,
    responseTimeMs: Date.now() - startTime,
  };

  // Overall status: 'ok' if all critical checks pass, 'degraded' otherwise
  const hasCriticalFailure = checks.checks.database?.status === 'error';
  checks.status = hasCriticalFailure ? 'error' : 'ok';

  const httpStatus = hasCriticalFailure ? 503 : 200;
  return res.status(httpStatus).json(checks);
};
