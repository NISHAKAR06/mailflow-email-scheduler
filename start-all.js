const { spawn } = require('child_process');
const path = require('path');

// Port assignments
const backendPort = process.env.BACKEND_PORT || '4000';
const frontendPort = process.env.PORT || '3000'; // Render assigns PORT to the public service

console.log(`[MailFlow Single-Service Runner]`);
console.log(`- Frontend exposed on PORT: ${frontendPort}`);
console.log(`- Backend internal on PORT: ${backendPort}`);

// 1. Run Prisma migrations then start Backend
const backendEnv = {
  ...process.env,
  PORT: backendPort,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

// Spawn Backend
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
  console.error('[Backend Error]:', err);
});

// 2. Start Frontend (Next.js)
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
  console.error('[Frontend Error]:', err);
});

// Graceful termination
const handleShutdown = () => {
  console.log('[Runner] Shutting down services...');
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
