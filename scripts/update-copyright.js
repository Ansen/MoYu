const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
try {
  let configStr = fs.readFileSync(configPath, 'utf8');
  const currentYear = new Date().getFullYear();
  
  // Use regex to replace the copyright year to preserve formatting
  configStr = configStr.replace(
    /"copyright":\s*"Copyright\s*©\s*\d{4}\s*BA8BAK"/,
    `"copyright": "Copyright © ${currentYear} BA8BAK"`
  );
  
  fs.writeFileSync(configPath, configStr);
  console.log(`[Build] Automatically updated copyright year to ${currentYear}`);
} catch (e) {
  console.error('[Build] Failed to update copyright year:', e);
}
