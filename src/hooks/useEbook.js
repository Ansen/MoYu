import { useState, useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { generatePracticeText } from '../utils/morse/structuredRandom';
import ePub from 'epubjs';

export function useEbook() {
  const [bookData, setBookData] = useState(null); 
  // bookData: { type: 'epub'|'txt', data: Book|string, name: string, path: string, siblings: Array<{name, path, type}>, currentIndex: number }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('moyu_recent_files');
    if (saved) {
      try {
        setRecentFiles(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveRecent = (item) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(p => p.path !== item.path);
      const next = [item, ...filtered].slice(0, 10);
      localStorage.setItem('moyu_recent_files', JSON.stringify(next));
      return next;
    });
  };

  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
    localStorage.removeItem('moyu_recent_files');
  }, []);

  const removeRecentFile = useCallback((e, path) => {
    e.stopPropagation();
    setRecentFiles(prev => {
      const next = prev.filter(p => p.path !== path);
      localStorage.setItem('moyu_recent_files', JSON.stringify(next));
      return next;
    });
  }, []);

  const loadFileContent = async (filePath, fileName, siblings = [], currentIndex = 0) => {
    const isEpub = filePath.toLowerCase().endsWith('.epub');
    if (isEpub) {
      const fileData = await readFile(filePath);
      const book = ePub(fileData.buffer);
      setBookData({
        type: 'epub',
        data: book,
        name: fileName,
        path: filePath,
        siblings,
        currentIndex
      });
    } else {
      const textData = await readTextFile(filePath);
      setBookData({
        type: 'txt',
        data: textData,
        name: fileName,
        path: filePath,
        siblings,
        currentIndex
      });
    }
  };

  const openFileProgrammatically = async (filePath, fileName, isFolder = false) => {
    try {
      setLoading(true);
      setError(null);

      if (isFolder) {
        // Read directory contents
        const entries = await readDir(filePath);
        const validFiles = entries
          .filter(e => e.isFile && (e.name.toLowerCase().endsWith('.txt') || e.name.toLowerCase().endsWith('.epub')))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        
        if (validFiles.length === 0) {
          throw new Error('文件夹中没有找到 txt 或 epub 文件');
        }

        const siblings = validFiles.map(f => {
          const sep = filePath.includes('\\') ? '\\' : '/';
          return {
            name: f.name,
            path: `${filePath}${sep}${f.name}`.replace(/\\\\/g, '\\').replace(/\/\//g, '/'),
            type: f.name.toLowerCase().endsWith('.epub') ? 'epub' : 'txt'
          };
        });

        await loadFileContent(siblings[0].path, siblings[0].name, siblings, 0);
        saveRecent({ type: 'folder', name: fileName || filePath.split(/[/\\]/).pop(), path: filePath });
      } else {
        await loadFileContent(filePath, fileName, [], 0);
        saveRecent({ type: 'file', name: fileName, path: filePath });
      }
    } catch (err) {
      console.error('Failed to open file:', err);
      const msg = err.message || '读取失败';
      setError(msg);
      alert(`无法打开该文件或目录，可能是因为缺少权限。请尝试重新使用“打开文件/文件夹”按钮选取。\n\n详情: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const openBookDialog = useCallback(async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: '电子书', extensions: ['epub', 'txt'] }]
      });
      if (filePath) {
        const fileName = filePath.split(/[/\\]/).pop();
        await openFileProgrammatically(filePath, fileName, false);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const openFolderDialog = useCallback(async () => {
    try {
      const dirPath = await open({
        directory: true,
        multiple: false
      });
      if (dirPath) {
        const dirName = dirPath.split(/[/\\]/).pop();
        await openFileProgrammatically(dirPath, dirName, true);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const jumpToSibling = useCallback(async (index) => {
    if (!bookData || !bookData.siblings || !bookData.siblings[index]) return;
    try {
      setLoading(true);
      const target = bookData.siblings[index];
      // Close current book if epub
      if (bookData.type === 'epub' && bookData.data) {
        bookData.data.destroy();
      }
      await loadFileContent(target.path, target.name, bookData.siblings, index);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [bookData]);

  const loadTextDirectly = useCallback((textData, fileName) => {
    setBookData({
      type: 'txt',
      data: textData,
      name: fileName,
      path: 'internal://' + fileName,
      siblings: [],
      currentIndex: 0
    });
    setLoading(false);
    setError(null);
  }, []);

  const loadGeneratedContent = useCallback((mode) => {
    const text = generatePracticeText(mode);
    const name = mode === 'numbers' ? '随机数码报底' : '随机英语报底';
    setBookData({
      type: 'txt',
      data: text,
      name,
      path: `virtual://${mode}`,
      isGenerated: true,
      generatorMode: mode,
      siblings: [],
      currentIndex: 0
    });
  }, []);

  const closeBook = useCallback(() => {
    if (bookData?.type === 'epub' && bookData.data) {
      bookData.data.destroy();
    }
    setBookData(null);
  }, [bookData]);

  return {
    bookData,
    loading,
    error,
    recentFiles,
    openBookDialog,
    openFolderDialog,
    openFileProgrammatically,
    jumpToSibling,
    closeBook,
    clearRecentFiles,
    removeRecentFile,
    loadTextDirectly,
    loadGeneratedContent
  };
}
