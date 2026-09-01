import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

const CDN_LATEST_URL = 'https://moyu-dl.wjzhx.com/Ansen/MoYu/releases/latest/download/latest-cdn.json';
const GITHUB_LATEST_URL = 'https://github.com/Ansen/MoYu/releases/latest/download/latest.json';

function compareSemver(v1, v2) {
  const p1 = (v1 || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Check for updates using the official Tauri updater or custom fetch for Android
 * @returns {Promise<{ hasUpdate: boolean, isAndroid?: boolean, updateInfo: any }>}
 */
export async function checkForUpdates() {
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

  // Android: Fetch latest.json directly and compare semantic version
  if (isAndroid) {
    try {
      const currentVersion = await getVersion().catch(() => '0.0.0');
      let response = null;
      try {
        response = await fetch(CDN_LATEST_URL);
      } catch {
        response = await fetch(GITHUB_LATEST_URL);
      }

      if (response && response.ok) {
        const latestData = await response.json();
        const hasUpdate = compareSemver(latestData.version, currentVersion) > 0;
        return {
          hasUpdate,
          isAndroid: true,
          updateInfo: {
            version: latestData.version,
            notes: latestData.notes,
            body: latestData.notes,
            isAndroid: true,
            downloadUrl: 'https://moyu-dl.wjzhx.com/Ansen/MoYu/releases/latest'
          }
        };
      }
      return { hasUpdate: false, isAndroid: true, updateInfo: null };
    } catch (error) {
      console.error('Failed to check for Android updates:', error);
      throw error;
    }
  }

  // Desktop (Windows / macOS / Linux): Use official Tauri plugin-updater
  try {
    const update = await check();
    
    if (update) {
      return {
        hasUpdate: true,
        isAndroid: false,
        updateInfo: update
      };
    }
    
    return { hasUpdate: false, isAndroid: false, updateInfo: null };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    throw error;
  }
}

/**
 * Download and install the update, then relaunch the app.
 * @param {any} update - The update object returned from check()
 * @param {function} onProgress - Callback for download progress (chunkLength, contentLength)
 */
export async function installUpdate(update, onProgress) {
  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength || 0;
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        if (onProgress && contentLength > 0) {
          onProgress(downloaded, contentLength);
        }
        break;
      case 'Finished':
        console.log('Update downloaded successfully');
        break;
    }
  });

  await relaunch();
}
