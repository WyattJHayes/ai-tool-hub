import fs from 'node:fs';

const failures = [];
const utils = fs.readFileSync('js/utils.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

if (!utils.includes('isLocalDevHost')) {
  failures.push('js/utils.js: registerServiceWorker should detect local dev hosts');
}

if (!utils.includes('registration.unregister()')) {
  failures.push('js/utils.js: local dev service workers should be unregistered');
}

if (sw.includes("ai-tool-hub-v6.1.0")) {
  failures.push('sw.js: cache name still uses stale v6.1.0');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('dev cache guard passed');
