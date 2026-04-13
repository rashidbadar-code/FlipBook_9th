import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Read the first subfolder name inside book_pages/ at build time
function getBookTitle(): string {
  const dir = path.resolve(__dirname, 'book_pages');
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const sub = entries.find(e => e.isDirectory());
    return sub ? sub.name : 'book_pages';
  } catch {
    return 'book_pages';
  }
}

// Read subfolder names inside public/Concepts/ at build time
function getConceptFolders(): string[] {
  const dir = path.resolve(__dirname, 'public', 'Concepts');
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  } catch {
    return [];
  }
}

// Read file listings inside each concept subfolder at build time
function getConceptAssets(): Record<string, {
  images: string[];
  audio: string[];
  audioImages: string[];
  info: string[];
  glossary: string[];
}> {
  const conceptDir = path.resolve(__dirname, 'public', 'Concepts');
  const result: Record<string, { images: string[]; audio: string[]; audioImages: string[]; videos: string[]; info: string[]; glossary: string[] }> = {};
  const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
  const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a']);
  const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
  const DOC_EXTS   = new Set(['.html', '.htm', '.txt']);

  function listFiles(dir: string, exts: Set<string>): string[] {
    try {
      return fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isFile() && exts.has(path.extname(e.name).toLowerCase()))
        .map(e => e.name)
        .sort();
    } catch { return []; }
  }

  try {
    fs.readdirSync(conceptDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(folder => {
        const base = path.join(conceptDir, folder.name);
        result[folder.name] = {
          images:      listFiles(path.join(base, 'image'),    IMAGE_EXTS),
          audio:       listFiles(path.join(base, 'audio'),    AUDIO_EXTS),
          audioImages: listFiles(path.join(base, 'audio'),    IMAGE_EXTS),
          videos:      listFiles(path.join(base, 'audio'),    VIDEO_EXTS),
          info:        listFiles(path.join(base, 'info'),     DOC_EXTS),
          glossary:    listFiles(path.join(base, 'glossary'), DOC_EXTS),
        };
      });
  } catch { /* no concepts dir */ }

  return result;
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isCaptivateMode = mode === 'captivate';

  const plugins = [react(), tailwindcss()];
  if (isCaptivateMode) {
    plugins.push(
      legacy({
        targets: ['defaults', 'chrome >= 58'],
      }),
    );
  }

  return {
    base: './',
    plugins,
    build: {
      emptyOutDir: false,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__BOOK_TITLE__': JSON.stringify(getBookTitle()),
      '__CONCEPT_FOLDERS__': JSON.stringify(getConceptFolders()),
      '__CONCEPT_ASSETS__': JSON.stringify(getConceptAssets()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
