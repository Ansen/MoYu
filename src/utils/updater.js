import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Check for updates using the official Tauri updater
 * @returns {Promise<{ hasUpdate: boolean, updateInfo: any }>}
 */
export async function checkForUpdates() {
  try {
    const update = await check();
    
    if (update) {
      return {
        hasUpdate: true,
        updateInfo: update
      };
    }
    
    return { hasUpdate: false, updateInfo: null };
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
