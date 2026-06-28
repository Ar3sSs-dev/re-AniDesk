const { spawn, execSync } = require('child_process');
const path = require('path');

// Configure PATH env to include the requested Node version
const nodePath = 'C:\\Users\\Angel\\node\\node-v20.9.0-win-x64';
const newPath = `${nodePath};${process.env.PATH}`;

console.log("Starting Electron launch verification test...");

const cmd = 'C:\\Users\\Angel\\node\\node-v20.9.0-win-x64\\node.exe';
const args = [
  'C:\\Users\\Angel\\node\\node-v20.9.0-win-x64\\node_modules\\npm\\bin\\npx-cli.js',
  'electron',
  '.'
];

const child = spawn(cmd, args, {
  cwd: path.resolve(__dirname, '../../'),
  env: {
    ...process.env,
    PATH: newPath
  }
});

let stdoutData = '';
let stderrData = '';

child.stdout.on('data', (data) => {
  const str = data.toString();
  stdoutData += str;
  process.stdout.write('[ELECTRON STDOUT] ' + str);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  stderrData += str;
  process.stderr.write('[ELECTRON STDERR] ' + str);
});

child.on('error', (err) => {
  console.error('Failed to start Electron process:', err);
  process.exit(1);
});

// Set a timeout to terminate Electron and check results
const timeoutMs = 12000;
setTimeout(() => {
  console.log(`\nTimeout of ${timeoutMs}ms reached. Terminating Electron process tree...`);
  
  // Kill the process tree on Windows using taskkill
  try {
    execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
  } catch (e) {
    console.warn('Warning: taskkill returned an error (process might have already exited):', e.message);
  }

  console.log('\n--- VERIFICATION ANALYSIS ---');
  
  // Look for the expected warning indicating fallback occurred
  const hasFallbackWarning = stdoutData.includes('Dev server not running, falling back to local files:') ||
                             stderrData.includes('Dev server not running, falling back to local files:');
                             
  const hasConnectionRefused = stdoutData.includes('ERR_CONNECTION_REFUSED') ||
                                stderrData.includes('ERR_CONNECTION_REFUSED');

  const hasAppProtocolError = stdoutData.includes('App protocol error:') ||
                               stderrData.includes('App protocol error:');

  console.log(`Fallback Warning Detected: ${hasFallbackWarning}`);
  console.log(`ERR_CONNECTION_REFUSED Detected: ${hasConnectionRefused}`);
  console.log(`App Protocol Error Detected: ${hasAppProtocolError}`);

  let success = true;
  if (!hasFallbackWarning) {
    console.error('FAIL: Expected warning "Dev server not running, falling back to local files:" was not found in Electron output.');
    success = false;
  }
  
  if (hasAppProtocolError) {
    console.error('FAIL: Encountered "App protocol error" while handling custom app:// protocol.');
    success = false;
  }

  // Check if there are other unhandled rejections or crashes
  const hasUnhandledRejection = stdoutData.includes('UnhandledPromiseRejectionWarning') ||
                                 stderrData.includes('UnhandledPromiseRejectionWarning') ||
                                 stdoutData.includes('Unhandled Promise Rejection') ||
                                 stderrData.includes('Unhandled Promise Rejection');
  if (hasUnhandledRejection) {
    console.error('FAIL: Unhandled promise rejection detected.');
    success = false;
  }

  if (success) {
    console.log('SUCCESS: Fallback succeeded, assets loaded correctly from app://-, and dev server was bypassed correctly.');
    process.exit(0);
  } else {
    console.log('FAIL: Verification checks failed.');
    process.exit(1);
  }
}, timeoutMs);
