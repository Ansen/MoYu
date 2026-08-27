import { useState, useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { generatePracticeText } from '../utils/morse/structuredRandom';
import ePub from 'epubjs';

function extractTextFromEpubDoc(doc, chapterLabel = '') {
  if (!doc) return '';
  const body = doc.body || (doc.querySelector && doc.querySelector('body')) || doc.documentElement;
  if (!body) return '';

  const clone = body.cloneNode(true);
  const scripts = clone.querySelectorAll('script, style, noscript, svg');
  scripts.forEach(s => s.remove());

  // 移除所有标题与章节名元素
  const titleElements = clone.querySelectorAll('h1, h2, h3, h4, h5, h6, .title, .chapter-title, .chaptertitle, .chapter_title, .chap-title, .heading, [class*="title"], [class*="chapter-name"], [id*="title"]');
  titleElements.forEach(el => el.remove());

  const blockTags = clone.querySelectorAll('p, div, li, tr, blockquote, dt, dd, section, article, header, footer');
  blockTags.forEach(el => {
    el.insertAdjacentText('afterend', '\n');
  });

  const brs = clone.querySelectorAll('br');
  brs.forEach(br => br.replaceWith('\n'));

  const text = clone.textContent || clone.innerText || '';
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // 如果首行依然带有章节名或与 chapterLabel 一致，则剔除首行
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    const cleanLabel = chapterLabel.trim().toLowerCase();
    if (
      (cleanLabel && (firstLine === cleanLabel || firstLine.includes(cleanLabel) || cleanLabel.includes(firstLine))) ||
      /^第\s*[\d一二三四五六七八九十百千万]+\s*[章节回卷集篇部]/.test(lines[0]) ||
      /^chapter\s*\d+/i.test(lines[0]) ||
      /^p\d+$/i.test(lines[0])
    ) {
      lines.shift();
    }
  }

  return lines.join('\n\n');
}

export function useEbook() {
  const [bookData, setBookData] = useState(null); 
  // bookData: { type: 'epub'|'txt', data: string, name: string, path: string, siblings: Array<{name, path, type}>, currentIndex: number, toc: Array<{id, label, href, index}>, currentChapterIndex: number, currentChapterLabel: string }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('moyu_recent_files');
    if (saved) {
      try {
        setRecentFiles(JSON.parse(saved));
      } catch {}
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

  const loadFileContent = async (filePath, fileName, siblings = [], currentIndex = 0, folderName = '') => {
    const isEpub = filePath.toLowerCase().endsWith('.epub');
    const isFolder = Boolean(folderName || (siblings && siblings.length > 0));
    const effectiveFolderName = folderName || (isFolder ? filePath.split(/[/\\]/).filter(Boolean).slice(-2, -1)[0] : '');

    if (isEpub) {
      const fileData = await readFile(filePath);
      const book = ePub(fileData.buffer);
      await book.ready;

      const nav = await book.loaded.navigation;
      const spine = await book.loaded.spine;
      const spineItems = spine?.items || [];

      const toc = (nav?.toc || []).map((t, idx) => ({
        id: t.id || idx,
        label: t.label ? t.label.trim() : `第 ${idx + 1} 章`,
        href: t.href,
        index: idx
      }));

      const finalToc = toc.length > 0 ? toc : spineItems.map((item, idx) => ({
        id: idx,
        label: `第 ${idx + 1} 节`,
        href: item.href,
        index: idx
      }));

      const loadEpubChapter = async (targetIndexOrHref) => {
        let section = null;
        let chapterIndex = 0;
        if (typeof targetIndexOrHref === 'number') {
          chapterIndex = Math.max(0, Math.min(spineItems.length - 1, targetIndexOrHref));
          section = spine.get(chapterIndex);
        } else if (typeof targetIndexOrHref === 'string') {
          const cleanHref = targetIndexOrHref.split('#')[0];
          section = spine.get(targetIndexOrHref) || spine.get(cleanHref);
          chapterIndex = section ? section.index : 0;
        }
        if (!section) {
          section = spine.get(0);
          chapterIndex = 0;
        }
        if (!section) return { text: '', chapterIndex: 0, label: '' };

        const navItem = finalToc.find(t => t.href?.includes(section.href) || section.href?.includes(t.href?.split('#')[0])) || finalToc[chapterIndex];
        const label = navItem ? navItem.label : `第 ${chapterIndex + 1} 章`;

        const doc = await section.load(book.load.bind(book));
        const text = extractTextFromEpubDoc(doc, label);

        return { text, chapterIndex, label, href: section.href };
      };

      const initial = await loadEpubChapter(0);

      setBookData({
        type: 'epub',
        data: initial.text,
        name: fileName,
        path: filePath,
        bookInstance: book,
        spineItems,
        toc: finalToc,
        currentChapterIndex: initial.chapterIndex,
        currentChapterLabel: initial.label,
        loadEpubChapter,
        siblings,
        currentIndex,
        isFolder,
        folderName: effectiveFolderName
      });
    } else {
      const textData = await readTextFile(filePath);
      setBookData({
        type: 'txt',
        data: textData,
        name: fileName,
        path: filePath,
        siblings,
        currentIndex,
        isFolder,
        folderName: effectiveFolderName
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

        const folderName = fileName || filePath.split(/[/\\]/).filter(Boolean).pop();

        const siblings = validFiles.map(f => {
          const sep = filePath.includes('\\') ? '\\' : '/';
          return {
            name: f.name,
            path: `${filePath}${sep}${f.name}`.replace(/\\\\/g, '\\').replace(/\/\//g, '/'),
            type: f.name.toLowerCase().endsWith('.epub') ? 'epub' : 'txt'
          };
        });

        await loadFileContent(siblings[0].path, siblings[0].name, siblings, 0, folderName);
        saveRecent({ type: 'folder', name: folderName, path: filePath });
      } else {
        await loadFileContent(filePath, fileName, [], 0, '');
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
      // Close current book instance if epub
      if (bookData.type === 'epub' && bookData.bookInstance && typeof bookData.bookInstance.destroy === 'function') {
        try { bookData.bookInstance.destroy(); } catch {}
      }
      await loadFileContent(target.path, target.name, bookData.siblings, index, bookData.folderName);
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

  const loadGeneratedContent = useCallback((modeOrConfig) => {
    let mode = 'numbers';
    let config = null;
    let name = '随机数码报底';

    if (typeof modeOrConfig === 'string') {
      mode = modeOrConfig;
      if (mode === 'numbers') name = '随机数码报底 (4字组)';
      else if (mode === 'letters') name = '随机英文报底 (5字组)';
      else if (mode === 'mixed') name = '随机混合报底 (5字组)';
      else if (mode === 'callsigns') name = '无线电呼号报底 (100组)';
      else name = '随机报底';
    } else if (modeOrConfig && typeof modeOrConfig === 'object') {
      mode = modeOrConfig.mode || 'custom';
      config = modeOrConfig;
      if (config.title) {
        name = config.title;
      } else if (mode === 'mixed') {
        name = `随机混合报底 (${config.charsPerGroup || 5}字组)`;
      } else if (mode === 'callsigns') {
        name = `无线电呼号报底 (${config.groupCount || 100}组)`;
      } else {
        name = `自定义报底 (${config.charsPerGroup || 4}字组)`;
      }
    }

    const text = generatePracticeText(config || mode);
    setBookData({
      type: 'txt',
      data: text,
      name,
      path: `virtual://${mode}`,
      isGenerated: true,
      generatorMode: mode,
      generatorConfig: config,
      siblings: [],
      currentIndex: 0
    });
  }, []);

  const jumpToChapter = useCallback(async (target) => {
    if (!bookData || bookData.type !== 'epub' || !bookData.loadEpubChapter) return;
    try {
      setLoading(true);
      const result = await bookData.loadEpubChapter(target);
      setBookData(prev => ({
        ...prev,
        data: result.text,
        currentChapterIndex: result.chapterIndex,
        currentChapterLabel: result.label
      }));
    } catch (err) {
      console.error('Failed to jump to chapter:', err);
    } finally {
      setLoading(false);
    }
  }, [bookData]);

  const closeBook = useCallback(() => {
    if (bookData?.type === 'epub' && bookData.bookInstance && typeof bookData.bookInstance.destroy === 'function') {
      try { bookData.bookInstance.destroy(); } catch {}
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
    jumpToChapter,
    closeBook,
    clearRecentFiles,
    removeRecentFile,
    loadTextDirectly,
    loadGeneratedContent
  };
}
