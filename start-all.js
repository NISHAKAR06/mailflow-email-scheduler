const { spawn, execSync } = require('child_process');
const path = require('path');

// Port assignments
const backendPort = process.env.BACKEND_PORT || '4000';
const frontendPort = process.env.PORT || '3000'; // Render assigns PORT to the public service

console.log(`===========================================`);
console.log(`[MailFlow Unified Service Runner]`);
console.log(`- Frontend Port (Public): ${frontendPort}`);
console.log(`- Backend Port (Internal): ${backendPort}`);
console.log(`===========================================`);

// 1. Sync database schema with PostgreSQL
if (process.env.DATABASE_URL) {
  try {
    console.log('[Runner] Syncing PostgreSQL schema with Prisma...');
    execSync('npx prisma db push --skip-generate', {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[Runner] Database schema synced successfully.');
  } catch (err) {
    console.warn('[Runner] Warning: Prisma db push encountered an issue, proceeding to start server:', err.message);
  }
}

// 2. Spawn Backend (Express API & BullMQ Worker)
const backendEnv = {
  ...process.env,
  PORT: backendPort,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

const backend = spawn(
  'node',
  ['dist/server.js'],
  {
    cwd: path.join(__dirname, 'backend'),
    env: backendEnv,
    stdio: 'inherit',
    shell: true,
  }
);

backend.on('error', (err) => {
  console.error('[Backend Process Error]:', err);
});

backend.on('exit', (code, signal) => {
  console.warn(`[Backend Process Exited] code=${code} signal=${signal}`);
});

// 3. Spawn Frontend (Next.js)
const frontendEnv = {
  ...process.env,
  PORT: frontendPort,
  INTERNAL_BACKEND_URL: process.env.INTERNAL_BACKEND_URL || `http://127.0.0.1:${backendPort}`,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

const frontend = spawn(
  'npm',
  ['run', 'start'],
  {
    cwd: path.join(__dirname, 'frontend'),
    env: frontendEnv,
    stdio: 'inherit',
    shell: true,
  }
);

frontend.on('error', (err) => {
  console.error('[Frontend Process Error]:', err);
});

frontend.on('exit', (code, signal) => {
  console.warn(`[Frontend Process Exited] code=${code} signal=${signal}`);
});

// Graceful shutdown
const handleShutdown = () => {
  console.log('[Runner] Shutting down services...');
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
