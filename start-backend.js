const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Bazaar Backend Server...\n');

// Check if we're in the right directory
const backendPath = path.join(__dirname, 'backend');
const packageJsonPath = path.join(backendPath, 'package.json');

try {
    require(packageJsonPath);
} catch (error) {
    console.error('❌ Backend not found. Please run this from the project root directory.');
    process.exit(1);
}

// Start the backend server
const backend = spawn('node', ['server.js'], {
    cwd: backendPath,
    stdio: 'inherit',
    shell: true
});

backend.on('error', (error) => {
    console.error('❌ Failed to start backend:', error.message);
    console.log('\n💡 Make sure to:');
    console.log('1. Install dependencies: cd backend && npm install');
    console.log('2. Create .env file: cp env.example .env');
    console.log('3. Add your Telegram Bot Token to .env');
});

backend.on('close', (code) => {
    console.log(`\n🛑 Backend server exited with code ${code}`);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down backend server...');
    backend.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down backend server...');
    backend.kill('SIGTERM');
    process.exit(0);
});
