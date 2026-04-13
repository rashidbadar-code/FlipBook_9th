/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import React from 'react';
import logoUrl from './logo.png';
import { createPortal } from 'react-dom';
import {
  Pencil,
  Eraser,
  Trash2,
  Brush,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Square,
  Menu,
  X,
  BookOpen,
  PenLine,
  Spotlight,
  Lock,
  LockOpen,
  ZoomIn,
  Hand,
  Layers,
  Volume2,
  VolumeX,
  FileText,
  Info,
  ImageIcon,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Maximize,
  Network,
  Images,
  FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tool = 'none' | 'pen' | 'eraser' | 'brush' | 'spotlight' | 'frame' | 'plain' | 'zoom' | 'hand';
type BackgroundType = 'none' | 'single' | 'four' | 'math';

interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp?: number;
}

// Returns the px height to reserve at the bottom for the toolbar.
// Toolbar content is ~72px tall; it scales between 0.75x and 1.7x.
// We add 16px bottom breathing room (bottom-2 = 8px + 8px gap).
function getToolbarReservedH(): number {
  const scale = Math.max(0.75, Math.min(1.7,
    Math.min(window.innerWidth / 1366, window.innerHeight / 768)
  ));
  return Math.ceil(72 * scale) + 16;
}

// Dynamically load all page images from book_pages/ or any subfolder inside it.
// Files must be named 0.png, 1.png, 2.png … where 0.png is the title/cover page.
const _pageModules = import.meta.glob<{ default: string }>('../book_pages/**/*.png', { eager: true });

// Detect the subfolder name inside book_pages/ — injected at build time by Vite
declare const __BOOK_TITLE__: string;
const bookTitle: string = __BOOK_TITLE__;
declare const __CONCEPT_FOLDERS__: string[];
const conceptFolders: string[] = __CONCEPT_FOLDERS__;
declare const __CONCEPT_ASSETS__: Record<string, {
  images: string[];
  audio: string[];
  audioImages: string[];
  videos: string[];
  info: string[];
  glossary: string[];
}>;
const conceptAssets = __CONCEPT_ASSETS__;
const pageImages: string[] = Object.keys(_pageModules)
  .map((key) => {
    const match = key.match(/\/(\d+)\.png$/);
    return match ? { url: _pageModules[key].default, num: parseInt(match[1], 10) } : null;
  })
  .filter((x): x is { url: string; num: number } => x !== null)
  .sort((a, b) => a.num - b.num)
  .map((x) => x.url);

export default function App() {
  const [startPageIndex, setStartPageIndex] = useState(0);
  const [toolbarScale, setToolbarScale] = useState(1);
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [isHandMode, setIsHandMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [spotlightHintDismissed, setSpotlightHintDismissed] = useState(false);
  const [zoomHintDismissed, setZoomHintDismissed] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(20);
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('none');
  const [lineSpacingByType, setLineSpacingByType] = useState<Record<BackgroundType, number>>({ none: 40, single: 40, four: 60, math: 40 });
  const lineSpacing = lineSpacingByType[backgroundType];
  const setLineSpacing = (val: number) => setLineSpacingByType(prev => ({ ...prev, [backgroundType]: val }));
  const [intensity, setIntensity] = useState(0.5);
  const [boardColor, setBoardColor] = useState('transparent');
  const [showSubToolbar, setShowSubToolbar] = useState<{ id: Tool; side: 'left' | 'right' } | null>(null);
  const [showPagePicker, setShowPagePicker] = useState<'left' | 'right' | false>(false);
  const [showConceptsToolbar, setShowConceptsToolbar] = useState<'left' | 'right' | false>(false);
  const [activeConceptPopup, setActiveConceptPopup] = useState<string | null>(null);
  const [conceptPopupPos, setConceptPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [conceptPopupSize, setConceptPopupSize] = useState<{ w: number; h: number } | null>(null);
  const [showFlashcardsPopup, setShowFlashcardsPopup] = useState(false);
  const [flashcardsPopupPos, setFlashcardsPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [flashcardsPopupSize, setFlashcardsPopupSize] = useState<{ w: number; h: number } | null>(null);
  const [showMcqsPopup, setShowMcqsPopup] = useState(false);
  const [mcqsPopupPos, setMcqsPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [mcqsPopupSize, setMcqsPopupSize] = useState<{ w: number; h: number } | null>(null);
  const [showMindmapPopup, setShowMindmapPopup] = useState(false);
  const [mindmapPopupPos, setMindmapPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [mindmapPopupSize, setMindmapPopupSize] = useState<{ w: number; h: number } | null>(null);
  const [showInfographicPopup, setShowInfographicPopup] = useState(false);
  const [infographicPopupPos, setInfographicPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [infographicPopupSize, setInfographicPopupSize] = useState<{ w: number; h: number } | null>(null);
  const [infographicIndex, setInfographicIndex] = useState(0);
  const [infographicImgOffset, setInfographicImgOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const infographicPanRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [videoPopupPos, setVideoPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [videoPopupSize, setVideoPopupSize] = useState<{ w: number; h: number } | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showResources, setShowResources] = useState(false);
  const [conceptSection, setConceptSection] = useState<'image' | 'audio' | 'info' | 'glossary'>('image');
  const [conceptImgIndex, setConceptImgIndex] = useState(0);
  const [conceptIsPlaying, setConceptIsPlaying] = useState(false);
  const [conceptAudioIndex, setConceptAudioIndex] = useState(0);
  const [conceptAudioSpeed, setConceptAudioSpeed] = useState(1);
  const conceptAudioRef = useRef<HTMLAudioElement | null>(null);
  const conceptVideoRef = useRef<HTMLVideoElement | null>(null);
  const [conceptVideoPlaying, setConceptVideoPlaying] = useState(false);
  const [conceptVideoDuration, setConceptVideoDuration] = useState(0);
  const [conceptVideoCurrentTime, setConceptVideoCurrentTime] = useState(0);
  const [conceptVideoControlsVisible, setConceptVideoControlsVisible] = useState(true);
  const [conceptVideoEnded, setConceptVideoEnded] = useState(false);
  const [conceptAudioDuration, setConceptAudioDuration] = useState(0);
  const [conceptAudioCurrentTime, setConceptAudioCurrentTime] = useState(0);
  const conceptAudioImgContainerRef = useRef<HTMLDivElement | null>(null);
  const [pagePickerOffset, setPagePickerOffset] = useState(0);
  const [singlePageMode, setSinglePageMode] = useState(false);
  const [singlePageAlign, setSinglePageAlign] = useState<'left' | 'center' | 'right'>('center');
  const [boardOverlayPage, setBoardOverlayPage] = useState<number | null>(null);
  const [boardOverlayAlign, setBoardOverlayAlign] = useState<'left' | 'center' | 'right'>('center');
  const [boardOverlayPickerOffset, setBoardOverlayPickerOffset] = useState(0);
  const [boardOverlayOpacity, setBoardOverlayOpacity] = useState(1);
  const [spotlightRect, setSpotlightRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const spotlightDragStart = useRef<{ x: number; y: number } | null>(null);
  const spotlightResizingRef = useRef<{
    handle: string;
    startRect: { x: number; y: number; w: number; h: number };
    startX: number; startY: number;
  } | null>(null);
  const spotlightMoveRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Zoom tool state
  const [zoomSelectMode, setZoomSelectMode] = useState(false);     // rubber-band drawing mode
  const [zoomRect, setZoomRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoomTransform, setZoomTransform] = useState<{ s: number; tx: number; ty: number } | null>(null);
  const zoomSelectStartRef = useRef<{ x: number; y: number } | null>(null);
  const zoomMoveRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const zoomResizingRef = useRef<{
    handle: string;
    startRect: { x: number; y: number; w: number; h: number };
    startX: number; startY: number;
  } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [imgAspectRatio, setImgAspectRatio] = useState<number | null>(null);
  const [pairDims, setPairDims] = useState<{ w: number; h: number } | null>(null);
  const [singleDims, setSingleDims] = useState<{ w: number; h: number } | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState<'next' | 'prev'>('next');
  // pendingIndex: the targetIndex committed during flip, displayed once flip completes
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  // toolbarSide removed — both sides now always render
  const [showLeftNav, setShowLeftNav] = useState(true);
  const [showRightNav, setShowRightNav] = useState(true);
  const [leftNavLocked, setLeftNavLocked] = useState(false);
  const [rightNavLocked, setRightNavLocked] = useState(false);
  const [toolbarLocked, setToolbarLocked] = useState(false);
  const leftNavLockedRef = useRef(false);
  const rightNavLockedRef = useRef(false);
  const toolbarLockedRef = useRef(false);
  leftNavLockedRef.current = leftNavLocked;
  rightNavLockedRef.current = rightNavLocked;
  toolbarLockedRef.current = toolbarLocked;
  // Wide virtual board: N_BOARD_PAGES screen-widths of canvas
  const N_BOARD_PAGES = 20;
  // How many vw each Next/Prev click advances (smaller = shorter hop)
  const BOARD_STEP_VW = 20;
  const [boardPage, setBoardPage] = useState(0);
  const [boardSliding, setBoardSliding] = useState(false);
  // Mutable refs so event handlers (initCanvas on resize) can read latest values without stale closures
  const boardColorRef = useRef<string>('transparent');
  const boardPageRef = useRef<number>(0);
  const subToolbarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toolbarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conceptDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const conceptResizeRef = useRef<{ edge: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  const flashcardsDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const mcqsDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const mindmapDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const infographicDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const videoDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const conceptVideoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conceptVideoAutoPlayRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const draftCanvasRef = useRef<HTMLCanvasElement>(null);
  const draftContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const lastVelocityRef = useRef<number>(0);
  const strokePointCountRef = useRef<number>(0); // for stroke-start taper
  // ── Popup overlay canvas refs ─────────────────────────────────────────────
  const popupCanvasRef = useRef<HTMLCanvasElement>(null);
  const popupContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const popupDraftCanvasRef = useRef<HTMLCanvasElement>(null);
  const popupDraftContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const popupIsDrawingRef = useRef(false);
  const popupPointsRef = useRef<Point[]>([]);
  const popupLastPointRef = useRef<Point | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleIdRef = useRef(0);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDraggedRef = useRef(false);
  const fakeCursorRef = useRef<HTMLDivElement>(null);
  const boardIsDarkRef = useRef<boolean>(false);  // chalk vs marker mode
  const useSmoothing = true;
  // Separate canvas pixel data for write mode vs read mode
  const writeModeCanvasDataRef = useRef<ImageData | null>(null);
  const readModeCanvasDataRef  = useRef<ImageData | null>(null);
  // Stores canvas pixel data per background type so switching frames preserves drawings
  const savedCanvasDataRef = useRef<Record<BackgroundType, ImageData | null>>({
    none: null, single: null, four: null, math: null,
  });

  const getToolbarScale = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const baseWidth = 1366;
    const baseHeight = 768;
    const rawScale = Math.min(width / baseWidth, height / baseHeight);
    return Math.max(0.75, Math.min(1.7, rawScale));
  }, []);

  // Compute page pair pixel dimensions: width fills screen first;
  // if height would exceed available area, scale both dimensions down proportionally.
  const computePairDims = useCallback((ar: number) => {
    const vw = window.innerWidth;
    const availH = window.innerHeight;
    const pairAR = 2 * ar;                   // combined width/height ratio of two pages
    // Width-first: leave 40px padding on each side
    let pairW = vw - 80;
    let pairH = pairW / pairAR;
    // If height exceeds available, clamp to height and shrink width
    if (pairH > availH) {
      pairH = availH;
      pairW = pairH * pairAR;
    }
    return { w: pairW, h: pairH };
  }, []);

  // Compute single page (cover) pixel dimensions.
  // Use vw/2 as starting width so the cover height matches one spread-page height.
  const computeSingleDims = useCallback((ar: number) => {
    const vw = window.innerWidth;
    const availH = window.innerHeight;
    let w = vw / 2;
    let h = w / ar;
    if (h > availH) {
      h = availH;
      w = h * ar;
    }
    return { w, h };
  }, []);

  const resetSubToolbarTimer = useCallback(() => {
    if (subToolbarTimerRef.current) clearTimeout(subToolbarTimerRef.current);
    subToolbarTimerRef.current = setTimeout(() => {
      setShowSubToolbar(null);
    }, 10000);
  }, []);

  // Auto-hiding disabled — toolbar stays visible permanently
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const resetToolbarTimer = useCallback(() => {}, []);

  // Keep mutable refs in sync with state so resize handlers read latest values
  useEffect(() => { boardColorRef.current = boardColor; }, [boardColor]);
  useEffect(() => { boardPageRef.current = boardPage; }, [boardPage]);

  // Centre the concept popup whenever a new one is opened
  // Helper: compute popup size/pos from pairDims + window size (same responsive logic as the book)
  const computeConceptPopupRect = useCallback((dims: { w: number; h: number } | null) => {
    const TOP_OFFSET = 46;
    const SIDE_PAD   = 60;
    const avW = window.innerWidth  - SIDE_PAD * 2;
    const avH = window.innerHeight - TOP_OFFSET;
    let popW: number, popH: number;
    if (dims && dims.h > 0) {
      const pairAR = dims.w / dims.h;
      popW = avW;
      popH = popW / pairAR;
      if (popH > avH) { popH = avH; popW = popH * pairAR; }
    } else {
      popW = avW; popH = avH;
    }
    return {
      pos:  { x: Math.round((window.innerWidth  - popW) / 2), y: Math.round(TOP_OFFSET + (avH - popH) / 2) },
      size: { w: Math.round(popW), h: Math.round(popH) },
    };
  }, []);

  // Initialise popup state when a concept is opened
  useEffect(() => {
    if (activeConceptPopup) {
      const { pos, size } = computeConceptPopupRect(pairDims);
      setConceptPopupPos(pos);
      setConceptPopupSize(size);
      setConceptSection('image');
      setConceptImgIndex(0);
      setConceptAudioIndex(0);
      setConceptAudioSpeed(1);
      setConceptIsPlaying(false);
      setConceptAudioDuration(0);
      setConceptAudioCurrentTime(0);
      setConceptVideoPlaying(false);
      setConceptVideoDuration(0);
      setConceptVideoCurrentTime(0);
      setConceptVideoControlsVisible(true);
      setConceptVideoEnded(false);
      if (conceptVideoHideTimerRef.current) clearTimeout(conceptVideoHideTimerRef.current);
      if (conceptAudioRef.current) { conceptAudioRef.current.pause(); conceptAudioRef.current = null; }
    } else {
      if (conceptAudioRef.current) { conceptAudioRef.current.pause(); conceptAudioRef.current = null; }
      setConceptIsPlaying(false);
      setConceptAudioDuration(0);
      setConceptAudioCurrentTime(0);
      setConceptVideoPlaying(false);
      setConceptVideoDuration(0);
      setConceptVideoCurrentTime(0);
      setConceptVideoControlsVisible(true);
      setConceptVideoEnded(false);
      if (conceptVideoHideTimerRef.current) clearTimeout(conceptVideoHideTimerRef.current);
    }
  }, [activeConceptPopup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-resize: update popup size/pos whenever pairDims changes (window resize)
  useEffect(() => {
    if (!activeConceptPopup) return;
    const { pos, size } = computeConceptPopupRect(pairDims);
    setConceptPopupPos(pos);
    setConceptPopupSize(size);
  }, [pairDims, activeConceptPopup, computeConceptPopupRect]);

  // Direct resize listener — updates popup instantly on every window resize while it is open
  useEffect(() => {
    if (!activeConceptPopup) return;
    const onResize = () => {
      // Recompute pairDims inline (same logic as computePairDims) so we don't wait for state)
      const ar = imgAspectRatio;
      let dims: { w: number; h: number } | null = null;
      if (ar !== null) {
        const vw = window.innerWidth;
        const avH = window.innerHeight;
        const pairAR = 2 * ar;
        let pairW = vw - 80;
        let pairH = pairW / pairAR;
        if (pairH > avH) { pairH = avH; pairW = pairH * pairAR; }
        dims = { w: pairW, h: pairH };
      }
      const { pos, size } = computeConceptPopupRect(dims);
      setConceptPopupPos(pos);
      setConceptPopupSize(size);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeConceptPopup, imgAspectRatio, computeConceptPopupRect]);

  // Centre flashcards popup when opened; keep it in bounds on resize
  useEffect(() => {
    const compute = () => {
      const w = Math.min(window.innerWidth - 80, 1000);
      const h = Math.min(window.innerHeight - 60, 700);
      setFlashcardsPopupPos({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) });
      setFlashcardsPopupSize({ w, h });
    };
    if (showFlashcardsPopup) {
      compute();
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }
  }, [showFlashcardsPopup]);

  // Centre MCQs popup when opened; keep it in bounds on resize
  useEffect(() => {
    const compute = () => {
      const w = Math.min(window.innerWidth - 80, 1000);
      const h = Math.min(window.innerHeight - 60, 700);
      setMcqsPopupPos({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) });
      setMcqsPopupSize({ w, h });
    };
    if (showMcqsPopup) {
      compute();
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }
  }, [showMcqsPopup]);

  // Centre MindMap popup when opened; keep it in bounds on resize
  useEffect(() => {
    const compute = () => {
      const w = Math.min(window.innerWidth - 80, 1100);
      const h = Math.min(window.innerHeight - 60, 750);
      setMindmapPopupPos({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) });
      setMindmapPopupSize({ w, h });
    };
    if (showMindmapPopup) {
      compute();
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }
  }, [showMindmapPopup]);

  // Centre Infographic popup when opened; keep it in bounds on resize
  useEffect(() => {
    const compute = () => {
      const w = Math.min(window.innerWidth - 80, 1100);
      const h = Math.min(window.innerHeight - 60, 750);
      setInfographicPopupPos({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) });
      setInfographicPopupSize({ w, h });
    };
    if (showInfographicPopup) {
      compute();
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }
  }, [showInfographicPopup]);

  // Centre Video Overview popup when opened; keep it in bounds on resize
  useEffect(() => {
    const compute = () => {
      const w = Math.min(window.innerWidth - 80, 1100);
      const h = Math.min(window.innerHeight - 60, 750);
      setVideoPopupPos({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) });
      setVideoPopupSize({ w, h });
    };
    if (showVideoPopup) {
      compute();
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }
  }, [showVideoPopup]);

  // Fake cursor: hide native cursor and drive a DOM img with document.mousemove (no re-renders)
  useEffect(() => {
    const styleId = 'hand-cursor-override';
    const fake = fakeCursorRef.current;

    if (!isHandMode) {
      document.getElementById(styleId)?.remove();
      if (fake) fake.style.display = 'none';
      return () => {
        document.getElementById(styleId)?.remove();
        if (fakeCursorRef.current) fakeCursorRef.current.style.display = 'none';
      };
    }

    // Hide the native cursor on every element
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = styleId; document.head.appendChild(el); }
    el.textContent = `html, body, *, *::before, *::after { cursor: none !important; }`;

    // Show the fake cursor and track mouse directly via DOM (avoids React state re-renders)
    if (fake) fake.style.display = 'block';

    // Scale formula: ratio × 3 — at base 1366×768, ratio=1 so scale=1×3=3, size=32×3=96px
    const applySize = () => {
      const img = fakeCursorRef.current?.querySelector('img') as HTMLImageElement | null;
      if (!img) return;
      const ratio = Math.min(window.innerWidth / 1366, window.innerHeight / 768);
      const scale = Math.max(1, Math.min(4, ratio * 3));
      const size = Math.round(32 * scale);
      img.style.width  = size + 'px';
      img.style.height = size + 'px';
    };
    applySize();
    window.addEventListener('resize', applySize);

    const onMove = (e: PointerEvent) => {
      if (fakeCursorRef.current) {
        fakeCursorRef.current.style.left = e.clientX + 'px';
        fakeCursorRef.current.style.top  = e.clientY + 'px';
      }
    };
    document.addEventListener('pointermove', onMove);

    return () => {
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', applySize);
      document.getElementById(styleId)?.remove();
      if (fakeCursorRef.current) fakeCursorRef.current.style.display = 'none';
    };
  }, [isHandMode]);

  // Track whether the board is dark (chalk mode) or light (marker mode)
  useEffect(() => {
    if (boardColor === 'transparent') { boardIsDarkRef.current = false; return; }
    const hex = boardColor.length === 4
      ? `#${boardColor[1]}${boardColor[1]}${boardColor[2]}${boardColor[2]}${boardColor[3]}${boardColor[3]}`
      : boardColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    boardIsDarkRef.current = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
  }, [boardColor]);

  // Close Write sub-toolbar immediately when switching to Read mode
  useEffect(() => {
    if (boardColor === 'transparent') {
      setShowSubToolbar(prev => prev?.id === 'plain' ? null : prev);
    }
  }, [boardColor]);

  useEffect(() => {
    const applyScales = () => {
      setToolbarScale(getToolbarScale());
      if (imgAspectRatio !== null) {
        setPairDims(computePairDims(imgAspectRatio));
        setSingleDims(computeSingleDims(imgAspectRatio));
      }
    };
    applyScales();
    window.addEventListener('resize', applyScales);
    return () => window.removeEventListener('resize', applyScales);
  }, [getToolbarScale, computePairDims, computeSingleDims, imgAspectRatio]);

  // ── Canvas init ──────────────────────────────────────────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture current pixels BEFORE resize clears them (both write and read modes)
    const isWrite = boardColorRef.current !== 'transparent';
    let priorData: ImageData | null = null;
    const ctx0 = contextRef.current;
    if (ctx0) {
      try { priorData = ctx0.getImageData(0, 0, canvas.width, canvas.height); } catch { priorData = null; }
    }
    if (!isWrite && priorData) readModeCanvasDataRef.current = priorData;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Wide canvas: N_BOARD_PAGES screen-widths wide, one screen tall
    canvas.width  = N_BOARD_PAGES * window.innerWidth * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    contextRef.current = ctx;

    // Draft canvas for brush strokes (drawn at full opacity, composited with alpha on commit)
    const draftCanvas = draftCanvasRef.current;
    if (draftCanvas) {
      draftCanvas.width  = N_BOARD_PAGES * window.innerWidth * dpr;
      draftCanvas.height = rect.height * dpr;
      const draftCtx = draftCanvas.getContext('2d', { alpha: true });
      if (draftCtx) {
        draftCtx.scale(dpr, dpr);
        draftCtx.lineCap = 'round';
        draftCtx.lineJoin = 'round';
        draftContextRef.current = draftCtx;
      }
    }

    // Restore pixels after canvas was reset by resize
    if (priorData) {
      try { ctx.putImageData(priorData, 0, 0); } catch { /* size changed too much — ignore */ }
    }
  }, []);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  // ── Popup overlay canvas init ─────────────────────────────────────────────
  const initPopupCanvas = useCallback(() => {
    const canvas = popupCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Preserve existing drawings across resize
    let prior: ImageData | null = null;
    const ctx0 = popupContextRef.current;
    if (ctx0) { try { prior = ctx0.getImageData(0, 0, canvas.width, canvas.height); } catch { prior = null; } }
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    popupContextRef.current = ctx;
    if (prior) { try { ctx.putImageData(prior, 0, 0); } catch { /* size changed */ } }
    const draft = popupDraftCanvasRef.current;
    if (draft) {
      draft.width  = rect.width  * dpr;
      draft.height = rect.height * dpr;
      const dc = draft.getContext('2d', { alpha: true });
      if (dc) { dc.scale(dpr, dpr); dc.lineCap = 'round'; dc.lineJoin = 'round'; popupDraftContextRef.current = dc; }
    }
  }, []);

  // Re-init popup canvas whenever popup size changes
  useEffect(() => {
    if (!activeConceptPopup || !conceptPopupSize) return;
    // RAF ensures the canvas DOM element has been sized by the browser before we read getBoundingClientRect
    const id = requestAnimationFrame(() => initPopupCanvas());
    return () => cancelAnimationFrame(id);
  }, [activeConceptPopup, conceptPopupSize, initPopupCanvas]);

  // ── Drawing helpers ───────────────────────────────────────────────────────
  const applyToolSettings = useCallback(
    (ctx: CanvasRenderingContext2D, pressure: number) => {
      const PEN_MULT = 1.5;
      const BRUSH_MULT = 1.5;
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = eraserSize;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        const base =
          activeTool === 'brush'
            ? brushSize * 1.8 * BRUSH_MULT
            : brushSize * PEN_MULT;
        const refined = Math.pow(pressure, 0.8);
        const rawWidth = base * refined * 1.2;

        ctx.lineWidth = rawWidth;

        if (activeTool === 'pen' && boardIsDarkRef.current) {
          // ── Chalk effect: soft dusty edges, slightly translucent ──
          ctx.shadowColor = color;
          ctx.shadowBlur = brushSize * 2.5;
          ctx.globalAlpha = 0.82;
        } else if (activeTool === 'pen') {
          // ── Marker effect: clean hard edge, fully opaque ──
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
        } else {
          // brush — intensity applied at composite time
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
        }
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    },
    [activeTool, brushSize, eraserSize, color],
  );

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setShowSubToolbar(null);
    if (activeTool === 'frame' || activeTool === 'plain') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zs = zoomTransform?.s ?? 1;
    const x = (e.clientX - rect.left) / zs;
    const y = (e.clientY - rect.top) / zs;
    const pressure = e.pressure || 0.5;
    const point: Point = { x, y, pressure, timestamp: Date.now() };
    pointsRef.current = [point];
    lastPointRef.current = point;
    lastVelocityRef.current = 0;
    strokePointCountRef.current = 0;
    if (activeTool === 'brush') {
      // Clear draft canvas and begin brush stroke on it at full opacity
      const draftCanvas = draftCanvasRef.current;
      const draftCtx = draftContextRef.current;
      if (draftCanvas && draftCtx) {
        const dpr = window.devicePixelRatio || 1;
        draftCtx.clearRect(0, 0, draftCanvas.width / dpr, draftCanvas.height / dpr);
        draftCtx.save();
        if (spotlightRect) {
          draftCtx.beginPath();
          draftCtx.rect((spotlightRect.x - rect.left) / zs, (spotlightRect.y - rect.top) / zs, spotlightRect.w / zs, spotlightRect.h / zs);
          draftCtx.clip();
        }
        applyToolSettings(draftCtx, pressure);
        draftCtx.beginPath();
        draftCtx.moveTo(x, y);
      }
    } else {
      const ctx = contextRef.current;
      if (ctx) {
        ctx.save();
        if (spotlightRect) {
          ctx.beginPath();
          ctx.rect((spotlightRect.x - rect.left) / zs, (spotlightRect.y - rect.top) / zs, spotlightRect.w / zs, spotlightRect.h / zs);
          ctx.clip();
        }
        applyToolSettings(ctx, pressure);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    isDrawingRef.current = true;
    setIsDrawing(true);
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const drawPoint = (x: number, y: number, pressure: number, timestamp: number) => {
    // Brush strokes go to the draft canvas at full opacity to prevent
    // semi-transparent round-cap overlap dots; other tools use the main canvas.
    const ctx = activeTool === 'brush' ? draftContextRef.current : contextRef.current;
    if (!ctx || !lastPointRef.current) return;
    strokePointCountRef.current++;
    applyToolSettings(ctx, pressure);
    if (useSmoothing) {
      pointsRef.current.push({ x, y, pressure, timestamp });
      if (pointsRef.current.length > 3) {
        const pts = pointsRef.current.slice(-3);
        const xc = (pts[1].x + pts[2].x) / 2;
        const yc = (pts[1].y + pts[2].y) / 2;
        ctx.quadraticCurveTo(pts[1].x, pts[1].y, xc, yc);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xc, yc);
      }
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    lastPointRef.current = { x, y, pressure, timestamp };
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zs = zoomTransform?.s ?? 1;
    // Only update mousePos state for the eraser cursor — avoids re-renders during pen/brush drawing
    if (activeTool === 'eraser') setMousePos({ x: e.clientX, y: e.clientY });
    if (!isDrawingRef.current) return;
    const events: PointerEvent[] = (e.nativeEvent as any).getCoalescedEvents
      ? (e.nativeEvent as any).getCoalescedEvents()
      : [e.nativeEvent];
    for (const ev of events) {
      drawPoint(
        (ev.clientX - rect.left) / zs,
        (ev.clientY - rect.top) / zs,
        ev.pressure || 0.5,
        ev.timeStamp || Date.now(),
      );
    }
    if (contextRef.current) {
      contextRef.current.globalAlpha = 1.0;
      if (activeTool !== 'eraser') {
        contextRef.current.globalCompositeOperation = 'source-over';
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (activeTool === 'brush') {
      const draftCtx = draftContextRef.current;
      const draftCanvas = draftCanvasRef.current;
      const mainCtx = contextRef.current;
      // Finish the in-progress path on the draft canvas
      if (draftCtx && useSmoothing && pointsRef.current.length > 1) {
        const last = pointsRef.current[pointsRef.current.length - 1];
        draftCtx.lineTo(last.x, last.y);
        draftCtx.stroke();
      }
      draftCtx?.closePath();
      // Composite the draft canvas onto the main canvas at the chosen intensity
      if (draftCanvas && mainCtx) {
        const dpr = window.devicePixelRatio || 1;
        const cssW = draftCanvas.width / dpr;
        const cssH = draftCanvas.height / dpr;
        // Clip main canvas to spotlight rect when compositing
        mainCtx.save();
        if (spotlightRect) {
          const cr = canvasRef.current?.getBoundingClientRect();
          const zs = zoomTransform?.s ?? 1;
          if (cr) { mainCtx.beginPath(); mainCtx.rect((spotlightRect.x - cr.left) / zs, (spotlightRect.y - cr.top) / zs, spotlightRect.w / zs, spotlightRect.h / zs); mainCtx.clip(); }
        }
        mainCtx.globalAlpha = intensity;
        mainCtx.globalCompositeOperation = 'source-over';
        mainCtx.drawImage(draftCanvas, 0, 0, cssW, cssH);
        mainCtx.globalAlpha = 1.0;
        mainCtx.restore();
        // Clear draft (restore draft clip first so clearRect covers full canvas)
        draftCtx?.restore();
        if (draftCtx) draftCtx.clearRect(0, 0, cssW, cssH);
      }
    } else {
      const ctx = contextRef.current;
      if (ctx) {
        if (useSmoothing && pointsRef.current.length > 1) {
          const last = pointsRef.current[pointsRef.current.length - 1];
          applyToolSettings(ctx, last.pressure);
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
        ctx.closePath();
        ctx.restore(); // remove spotlight clip
      }
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    pointsRef.current = [];
    lastPointRef.current = null;
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const vw  = window.innerWidth;
    const vh  = canvas.height / dpr;
    const stepPx = (BOARD_STEP_VW / 100) * vw;  // CSS px width of one board step
    const px  = boardPageRef.current * stepPx;  // CSS x offset of current page
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(px, 0, stepPx, vh);           // clear only current page section
    const draftCanvas = draftCanvasRef.current;
    const draftCtx = draftContextRef.current;
    if (draftCanvas && draftCtx) {
      draftCtx.clearRect(px, 0, stepPx, vh);
    }
    savedCanvasDataRef.current[backgroundType] = null;
  };

  // Wipe the entire canvas plus all saved mode data
  // Clear only the write-mode canvas (does not affect read-mode pixels)
  const clearWriteCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const draftCanvas = draftCanvasRef.current;
    const draftCtx = draftContextRef.current;
    const dpr = window.devicePixelRatio || 1;
    if (canvas && ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    if (draftCanvas && draftCtx) {
      draftCtx.clearRect(0, 0, draftCanvas.width / dpr, draftCanvas.height / dpr);
    }
    writeModeCanvasDataRef.current = null;
    savedCanvasDataRef.current = { none: null, single: null, four: null, math: null };
  };

  // Clear only the read-mode canvas (does not affect write-mode pixels)
  const clearReadCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const draftCanvas = draftCanvasRef.current;
    const draftCtx = draftContextRef.current;
    const dpr = window.devicePixelRatio || 1;
    if (canvas && ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    if (draftCanvas && draftCtx) {
      draftCtx.clearRect(0, 0, draftCanvas.width / dpr, draftCanvas.height / dpr);
    }
    readModeCanvasDataRef.current = null;
    savedCanvasDataRef.current = { none: null, single: null, four: null, math: null };
  };

  // ── Popup overlay drawing handlers ───────────────────────────────────────
  const startPopupDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = popupCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;
    const point: Point = { x, y, pressure, timestamp: Date.now() };
    popupPointsRef.current = [point];
    popupLastPointRef.current = point;
    if (activeTool === 'brush') {
      const dc = popupDraftContextRef.current;
      const draft = popupDraftCanvasRef.current;
      if (draft && dc) {
        const dpr = window.devicePixelRatio || 1;
        dc.clearRect(0, 0, draft.width / dpr, draft.height / dpr);
        dc.save();
        applyToolSettings(dc, pressure);
        dc.beginPath();
        dc.moveTo(x, y);
      }
    } else {
      const ctx = popupContextRef.current;
      if (ctx) {
        ctx.save();
        applyToolSettings(ctx, pressure);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    popupIsDrawingRef.current = true;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }, [activeTool, applyToolSettings]);

  const drawPopupPoint = useCallback((x: number, y: number, pressure: number, timestamp: number) => {
    const ctx = activeTool === 'brush' ? popupDraftContextRef.current : popupContextRef.current;
    if (!ctx || !popupLastPointRef.current) return;
    applyToolSettings(ctx, pressure);
    popupPointsRef.current.push({ x, y, pressure, timestamp });
    if (popupPointsRef.current.length > 3) {
      const pts = popupPointsRef.current.slice(-3);
      const xc = (pts[1].x + pts[2].x) / 2;
      const yc = (pts[1].y + pts[2].y) / 2;
      ctx.quadraticCurveTo(pts[1].x, pts[1].y, xc, yc);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xc, yc);
    }
    popupLastPointRef.current = { x, y, pressure, timestamp };
  }, [activeTool, applyToolSettings]);

  const movePopupDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!popupIsDrawingRef.current) return;
    const canvas = popupCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const events: PointerEvent[] = (e.nativeEvent as any).getCoalescedEvents
      ? (e.nativeEvent as any).getCoalescedEvents()
      : [e.nativeEvent];
    for (const ev of events) {
      drawPopupPoint(ev.clientX - rect.left, ev.clientY - rect.top, ev.pressure || 0.5, ev.timeStamp || Date.now());
    }
  }, [drawPopupPoint]);

  const stopPopupDrawing = useCallback(() => {
    if (!popupIsDrawingRef.current) return;
    popupIsDrawingRef.current = false;
    if (activeTool === 'brush') {
      const dc = popupDraftContextRef.current;
      const draft = popupDraftCanvasRef.current;
      const mainCtx = popupContextRef.current;
      if (dc && popupPointsRef.current.length > 1) {
        const last = popupPointsRef.current[popupPointsRef.current.length - 1];
        dc.lineTo(last.x, last.y);
        dc.stroke();
      }
      dc?.closePath();
      if (draft && mainCtx) {
        const dpr = window.devicePixelRatio || 1;
        mainCtx.save();
        mainCtx.globalAlpha = intensity;
        mainCtx.globalCompositeOperation = 'source-over';
        mainCtx.drawImage(draft, 0, 0, draft.width / dpr, draft.height / dpr);
        mainCtx.globalAlpha = 1.0;
        mainCtx.restore();
        dc?.restore();
        if (dc) dc.clearRect(0, 0, draft.width / (window.devicePixelRatio || 1), draft.height / (window.devicePixelRatio || 1));
      }
    } else {
      const ctx = popupContextRef.current;
      if (ctx) {
        if (popupPointsRef.current.length > 1) {
          const last = popupPointsRef.current[popupPointsRef.current.length - 1];
          applyToolSettings(ctx, last.pressure);
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
        ctx.closePath();
        ctx.restore();
      }
    }
    popupPointsRef.current = [];
    popupLastPointRef.current = null;
  }, [activeTool, applyToolSettings, intensity]);

  // Save current canvas pixels for the given background type (current page section only)
  const saveCanvasForType = useCallback((type: BackgroundType) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    const dpr      = window.devicePixelRatio || 1;
    const stepPx   = (BOARD_STEP_VW / 100) * window.innerWidth;
    const pageRawX = boardPageRef.current * stepPx * dpr;
    const pageRawW = stepPx * dpr;
    try {
      savedCanvasDataRef.current[type] = ctx.getImageData(pageRawX, 0, pageRawW, canvas.height);
    } catch { savedCanvasDataRef.current[type] = null; }
  }, []);

  // Restore canvas pixels for the given background type (current page section only)
  const restoreCanvasForType = useCallback((type: BackgroundType) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    const dpr      = window.devicePixelRatio || 1;
    const stepPx   = (BOARD_STEP_VW / 100) * window.innerWidth;
    const pageRawX = boardPageRef.current * stepPx * dpr;
    const vh       = canvas.height / dpr;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(boardPageRef.current * stepPx, 0, stepPx, vh);
    const saved = savedCanvasDataRef.current[type];
    if (saved) {
      try { ctx.putImageData(saved, pageRawX, 0); } catch { /* mismatched size — ignore */ }
    }
  }, []);

  // Switch background type: save current canvas then restore the new type's canvas
  const switchBackgroundType = useCallback((newType: BackgroundType) => {
    if (boardColor !== 'transparent') {
      // Write mode: background lines are a visual overlay only — don't clear canvas
      setBackgroundType(newType);
      return;
    }
    saveCanvasForType(backgroundType);
    setBackgroundType(newType);
    // putImageData must run after React re-renders the canvas with matching dimensions.
    // Use rAF to defer until after paint.
    requestAnimationFrame(() => restoreCanvasForType(newType));
  }, [boardColor, backgroundType, saveCanvasForType, restoreCanvasForType]);

  const flipTo = useCallback((dir: 'next' | 'prev') => {
    if (isFlipping) return;
    let next: number;
    if (singlePageMode) {
      if (dir === 'next') {
        next = startPageIndex + 1;
        if (next >= pageImages.length) return;
      } else {
        if (startPageIndex === 0) return;
        next = startPageIndex - 1;
      }
    } else {
      // Pages 0 and 1 are always single; pairs start at 2: 2&3, 4&5, 6&7...
      if (dir === 'next') {
        if (startPageIndex === 0) next = 1;
        else if (startPageIndex === 1) next = 2;
        else next = startPageIndex + 2;
        if (next >= pageImages.length) return;
      } else {
        if (startPageIndex === 0) return;
        if (startPageIndex === 1) next = 0;
        else if (startPageIndex === 2) next = 1;
        else next = startPageIndex - 2;
      }
    }
    setFlipDir(dir);
    setPendingIndex(next);
    setIsFlipping(true);
    const target = next;
    setTimeout(() => {
      setStartPageIndex(target);
      setIsFlipping(false);
      setPendingIndex(null);
      resetCanvas();
    }, 730);
  }, [isFlipping, startPageIndex, pageImages.length, singlePageMode]);

  const handleNextPages = () => {
    if (boardColor !== 'transparent' && !boardSliding) {
      // Write mode: slide entire wide canvas left to reveal next virtual page
      setBoardPage(prev => prev + 1);
      setBoardSliding(true);
    } else {
      flipTo('next');
    }
  };
  const handlePreviousPages = () => {
    if (boardColor !== 'transparent' && !boardSliding) {
      if (boardPage === 0) return;
      // Write mode: slide entire wide canvas right to reveal previous virtual page
      setBoardPage(prev => prev - 1);
      setBoardSliding(true);
    } else {
      flipTo('prev');
    }
  };

  // Jump directly to a page index without flip animation
  const goToPage = useCallback((pageIdx: number) => {
    let target: number;
    if (singlePageMode || pageIdx <= 1) {
      target = pageIdx;
    } else {
      // Snap to even start of pair: 2&3→2, 4&5→4, etc.
      target = pageIdx % 2 === 0 ? pageIdx : pageIdx - 1;
    }
    setStartPageIndex(target);
    // In write mode the board is independent of book pages — preserve ink
    if (boardColor === 'transparent') resetCanvas();
    setShowPagePicker(false);
  }, [singlePageMode, boardColor]);

  // When a color is selected → entering write mode stays on current board page.
  // When transparent is selected → go to cover page.
  const selectBoardColor = useCallback((c: string) => {
    // Save current canvas pixels into the outgoing mode's store,
    // then restore the incoming mode's pixels onto the canvas.
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const draftCanvas = draftCanvasRef.current;
    const draftCtx = draftContextRef.current;
    const dpr = window.devicePixelRatio || 1;
    const isCurrentlyWrite = boardColorRef.current !== 'transparent';
    const isEnteringWrite = c !== 'transparent';

    if (canvas && ctx) {
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      try {
        // Save outgoing mode
        if (isCurrentlyWrite) {
          writeModeCanvasDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else {
          readModeCanvasDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        // Clear then restore incoming mode
        ctx.clearRect(0, 0, cssW, cssH);
        if (draftCanvas && draftCtx) draftCtx.clearRect(0, 0, draftCanvas.width / dpr, draftCanvas.height / dpr);
        const incoming = isEnteringWrite ? writeModeCanvasDataRef.current : readModeCanvasDataRef.current;
        if (incoming) ctx.putImageData(incoming, 0, 0);
      } catch { /* ignore */ }
    }

    setBoardColor(c);
    if (c === 'transparent') {
      // Exit write mode: reset board to page 0 smoothly
      setBoardOverlayPage(null);
      setBoardPage(0);
      if (startPageIndex !== 0 && !isFlipping) {
        setFlipDir('prev');
        setPendingIndex(0);
        setIsFlipping(true);
        setTimeout(() => {
          setStartPageIndex(0);
          setIsFlipping(false);
          setPendingIndex(null);
          resetCanvas();
        }, 730);
      }
    }
  }, [startPageIndex, isFlipping]);

  const lineOverlayStyle = useMemo(() => {
    const normalizeHex = (value: string) => {
      if (!value.startsWith('#')) return '#f8fafc';
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      }
      return value;
    };

    const hex = boardColor === 'transparent' ? '#f8fafc' : normalizeHex(boardColor);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const isDarkBoard = luminance < 0.45;
    const lineColor = isDarkBoard ? 'rgba(248, 250, 252, 0.96)' : 'rgba(15, 23, 42, 0.92)';
    const guideColor = isDarkBoard ? 'rgba(226, 232, 240, 0.96)' : 'rgba(30, 41, 59, 0.92)';
    const accentColor = isDarkBoard ? 'rgba(254, 202, 202, 0.98)' : 'rgba(153, 27, 27, 0.92)';

    return {
      '--line-spacing': `${lineSpacing}px`,
      '--line-thickness': '2px',
      '--line-color': lineColor,
      '--guide-color': guideColor,
      '--accent-line-color': accentColor,
    } as React.CSSProperties & Record<string, string>;
  }, [boardColor, lineSpacing, backgroundType]);

  return (
    <>
    <div className="fixed inset-0 font-sans select-none bg-white" onContextMenu={(e) => e.preventDefault()}>
      {/* Logo — fixed top-right, vertically centered in the 46px header strip */}
      <motion.img
        src={logoUrl}
        alt="Logo"
        className="fixed z-50 pointer-events-none"
        style={{ width: 36, height: 36, objectFit: 'contain', top: 5, right: 50 }}
        animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 5 }}
      />
      {/* Title — fixed top-center, vertically centered in the 46px header strip */}
      <span
        className="fixed z-50 pointer-events-none text-center font-semibold leading-none text-slate-600 whitespace-nowrap"
        style={{ fontSize: 20, left: '50%', transform: 'translateX(-50%)', top: 13 }}
      >
        {bookTitle}
      </span>
      <main
        className="absolute inset-x-0 overflow-hidden"
        style={{
          top: 46,
          height: 'calc(100% - 46px)',
          padding: '0 60px 0 60px',
          touchAction: 'none',
          cursor: isHandMode ? 'inherit' : zoomSelectMode ? 'crosshair' : 'default',
          transform: zoomTransform ? `translate(${zoomTransform.tx}px,${zoomTransform.ty}px) scale(${zoomTransform.s})` : undefined,
          transformOrigin: 'center center',
          transition: zoomTransform ? 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' : undefined,
        }}
        onClick={(e) => {
          // If click originated from the toolbar or its children, ignore
          if ((e.target as HTMLElement).closest('[data-toolbar]')) return;
          if (isHandMode && !pointerDraggedRef.current) {
            const id = ++rippleIdRef.current;
            setRipples(prev => [...prev, { id, x: e.clientX, y: e.clientY }]);
            setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 750);
          }
          if (showSubToolbar !== null) setShowSubToolbar(null);
          if (showPagePicker) setShowPagePicker(false);
          if (showToolbar) setShowToolbar(false);
          if (showConceptsToolbar) setShowConceptsToolbar(false);
          // Stage click counts as inactivity — restart timer at 0
          resetToolbarTimer();
        }}
        onPointerDown={(e) => {
          pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
          pointerDraggedRef.current = false;
          if (!zoomSelectMode) return;
          if ((e.target as HTMLElement).closest('[data-toolbar]')) return;
          setZoomHintDismissed(true);
          zoomSelectStartRef.current = { x: e.clientX, y: e.clientY };
          setZoomRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pointerDownPosRef.current) {
            const dx = e.clientX - pointerDownPosRef.current.x;
            const dy = e.clientY - pointerDownPosRef.current.y;
            if (Math.hypot(dx, dy) > 8) pointerDraggedRef.current = true;
          }
          if (!zoomSelectMode || !zoomSelectStartRef.current) return;
          const sx = zoomSelectStartRef.current.x;
          const sy = zoomSelectStartRef.current.y;
          const x = Math.min(sx, e.clientX);
          const y = Math.min(sy, e.clientY);
          const w = Math.abs(e.clientX - sx);
          const h = Math.abs(e.clientY - sy);
          setZoomRect({ x, y, w, h });
        }}
        onPointerUp={(e) => {
          if (!zoomSelectMode || !zoomSelectStartRef.current) return;
          const start = zoomSelectStartRef.current;
          zoomSelectStartRef.current = null;
          setZoomSelectMode(false);
          // If the drag was tiny (a tap/click), place a default box centred on the click point
          const dragDist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
          if (dragDist < 10) {
            const bw = Math.round(window.innerWidth * 0.25);
            const bh = Math.round(window.innerHeight * 0.2);
            setZoomRect({
              x: Math.round(e.clientX - bw / 2),
              y: Math.round(e.clientY - bh / 2),
              w: bw,
              h: bh,
            });
          }
          // else: keep the rubber-band rect — user can adjust with handles
        }}
        onPointerCancel={() => {
          zoomSelectStartRef.current = null;
          setZoomSelectMode(false);
        }}
      >

        {/* ── Full-screen board background & line overlay (write mode only) ── */}
        {boardColor !== 'transparent' && (
          <div
            className="absolute inset-0 z-10"
            style={{ backgroundColor: boardColor, pointerEvents: 'none' }}
          />
        )}
        {backgroundType !== 'none' && boardColor !== 'transparent' && (
          <div
            className={`${
              backgroundType === 'single' ? 'single-line-bg' :
              backgroundType === 'four'   ? 'four-line-bg'   :
              backgroundType === 'math'   ? 'math-box-bg'    : ''
            }`}
            style={{
              position: 'absolute', inset: 0, zIndex: 15,
              pointerEvents: 'none',
              ...lineOverlayStyle,
            }}
          />
        )}

        {/* ── Board page overlay ── */}
        {boardColor !== 'transparent' && boardOverlayPage !== null && pageImages[boardOverlayPage] !== undefined && (
          <div
            className={`absolute inset-0 z-[25] flex items-center pointer-events-none ${
              boardOverlayAlign === 'left' ? 'justify-start' :
              boardOverlayAlign === 'right' ? 'justify-end' : 'justify-center'
            }`}
            style={{ opacity: boardOverlayOpacity, paddingLeft: '40px', paddingRight: '40px' }}
          >
            <img
              src={pageImages[boardOverlayPage]}
              alt="overlay"
              style={{ height: '100%', width: 'auto', display: 'block', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* ── Wide board canvas track ──────────────────────────────────────
             The canvas is N_BOARD_PAGES screen-widths wide.
             CSS translateX slides it left/right to reveal the current page.
             Writing is preserved permanently on the wide canvas. ────────── */}
        <div
          className="absolute inset-0 z-20 overflow-hidden"
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: `${N_BOARD_PAGES * 100}vw`,
              height: '100%',
              transform: `translateX(${-boardPage * BOARD_STEP_VW}vw)`,
              transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onTransitionEnd={() => setBoardSliding(false)}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={() => { setMousePos(null); stopDrawing(); }}
              className="absolute inset-0 w-full h-full"
              style={{
                touchAction: 'none',
                cursor: isHandMode ? 'inherit' : activeTool === 'eraser' ? 'none' : (activeTool === 'pen' || activeTool === 'brush') ? 'crosshair' : 'inherit',
                pointerEvents: (!boardSliding && (activeTool === 'pen' || activeTool === 'brush' || activeTool === 'eraser')) ? 'auto' : 'none',
                opacity: boardColor === 'transparent' ? 0.99 : 1,
              }}
            />
            {/* Draft canvas — shows in-progress brush stroke at the chosen intensity */}
            <canvas
              ref={draftCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                touchAction: 'none',
                opacity: isDrawing && activeTool === 'brush' ? intensity : 1,
              }}
            />
          </div>
        </div>

        {/* Custom eraser cursor — rendered via portal in ZoomPortal section below */}

        {/* Spotlight dark overlay — portaled to body in root JSX below (z-[550]) */}

        {/* Spotlight box — portaled to body in root JSX below (z-[551]) */}

        {/* ── Zoom selection rubber-band rect — portaled to body in root JSX below ── */}
        {/* ── Zoom adjust box — portaled to body in root JSX below ── */}

        {/* Book stage — centred, with spine shadow and page-curl flip */}
        {(() => {
          const isWriteMode = boardColor !== 'transparent';
          const effectivelySingle = isWriteMode ? false : (startPageIndex <= 1 || singlePageMode);
          const dims      = effectivelySingle ? singleDims : pairDims;
          const pageW     = dims ? (effectivelySingle ? dims.w : dims.w / 2) : 0;
          const pageH     = dims ? dims.h : 0;
          const totalW    = effectivelySingle ? pageW : pageW * 2;

          // RTL: right side = lower index (first in reading order), left = higher index
          const shownRight = pageImages[startPageIndex];
          const shownLeft  = effectivelySingle ? null : (pageImages[startPageIndex + 1] ?? null);

          // For the flipping leaf: what page is turning
          const flipLeft  = pendingIndex !== null ? pageImages[pendingIndex]   : null;
          const flipRight = (pendingIndex !== null && !effectivelySingle) ? (pageImages[pendingIndex + 1] ?? null) : null;

          // Perspective origin is the spine (centre of the book)
          const justifyClass = effectivelySingle && singlePageMode
            ? singlePageAlign === 'left' ? 'justify-start' : singlePageAlign === 'right' ? 'justify-end' : 'justify-center'
            : 'justify-center';
          const alignPadding = effectivelySingle && singlePageMode
            ? singlePageAlign === 'left' ? { paddingLeft: '3vw' }
            : singlePageAlign === 'right' ? { paddingRight: '3vw' }
            : {}
            : {};
          return (
            <div
              className={`absolute inset-0 flex items-center ${justifyClass} overflow-hidden`}
              style={{ perspective: '2400px', perspectiveOrigin: '50% 50%', ...alignPadding }}
            >
              <div style={{ position: 'relative', width: totalW, height: pageH }}>

                {/* ── Arriving spread — fades in from underneath during flip ── */}
                {isFlipping && pendingIndex !== null && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', zIndex: 1,
                    animation: 'arrivingFadeIn 0.56s 0.15s ease-out both',
                  }}>
                    {effectivelySingle ? (
                      /* arriving single/cover page */
                      <img src={pageImages[pendingIndex]} draggable={false}
                        style={{ width: totalW, height: pageH, display: 'block', objectFit: 'fill' }} />
                    ) : (
                      <>
                        {pageImages[pendingIndex + 1]
                          ? <img src={pageImages[pendingIndex + 1]} draggable={false}
                              style={{ width: pageW, height: pageH, display: 'block', flexShrink: 0 }} />
                          : <div style={{ width: pageW, height: pageH, background: '#fff', flexShrink: 0 }} />
                        }
                        <img src={pageImages[pendingIndex]}   draggable={false}
                          style={{ width: pageW, height: pageH, display: 'block', flexShrink: 0 }} />
                      </>
                    )}
                  </div>
                )}

                {/* ── Current spread — fades out as flip plays ── */}
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', zIndex: 2,
                  clipPath: isFlipping
                    ? flipDir === 'next'
                      ? 'polygon(0 0, 100% 0, 100% 100%, 102px 100%, 0 calc(100% - 102px))'
                      : 'polygon(0 0, 100% 0, 100% calc(100% - 102px), calc(100% - 102px) 100%, 0 100%)'
                    : undefined,
                  animation: isFlipping ? 'currentFadeOut 0.56s 0.15s ease-in forwards' : undefined,
                }}>
                  {effectivelySingle ? (
                    <img src={shownRight ?? shownLeft} draggable={false}
                      onLoad={(e) => {
                        if (imgAspectRatio === null) {
                          const img = e.currentTarget;
                          const ar  = img.naturalWidth / img.naturalHeight;
                          setImgAspectRatio(ar);
                          setPairDims(computePairDims(ar));
                          setSingleDims(computeSingleDims(ar));
                        }
                      }}
                      style={{ width: totalW, height: pageH, display: 'block', objectFit: 'fill' }} />
                  ) : (
                    <>
                      {shownLeft
                        ? <img src={shownLeft} draggable={false}
                            style={{ width: pageW, height: pageH, display: 'block', flexShrink: 0 }} />
                        : <div style={{ width: pageW, height: pageH, background: '#fff', flexShrink: 0 }} />
                      }
                      <img src={shownRight} draggable={false}
                        onLoad={(e) => {
                          if (imgAspectRatio === null) {
                            const img = e.currentTarget;
                            const ar  = img.naturalWidth / img.naturalHeight;
                            setImgAspectRatio(ar);
                            setPairDims(computePairDims(ar));
                            setSingleDims(computeSingleDims(ar));
                          }
                        }}
                        style={{ width: pageW, height: pageH, display: 'block', flexShrink: 0 }} />
                    </>
                  )}
                </div>

                {/* ── Corner fold peel — bottom corner lifts before main flip ── */}
                {isFlipping && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right:  flipDir !== 'next' ? 0 : 'auto',
                    left:   flipDir === 'next' ? 0 : 'auto',
                    width: 102, height: 102,
                    zIndex: 14,
                    pointerEvents: 'none',
                    transformOrigin: flipDir === 'next' ? '0% 100%' : '100% 100%',
                    transform: 'scale(0)',
                    animation: 'cornerFoldGrow 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
                  }}>
                    <svg width="102" height="102" style={{ display: 'block', overflow: 'visible' }}>
                      <defs>
                        <filter id="pf" x="-30%" y="-30%" width="180%" height="180%">
                          <feDropShadow dx="-2" dy="-3" stdDeviation="4" floodColor="rgba(0,0,0,0.30)" />
                        </filter>
                      </defs>
                      {/* next: triangle at bottom-left (RTL); prev: bottom-right */}
                      {flipDir === 'next'
                        ? <polygon points="0,102 102,102 0,0"  fill="#e9e9e9" filter="url(#pf)" />
                        : <polygon points="102,102 0,102 102,0" fill="#e9e9e9" filter="url(#pf)" />
                      }
                      {/* subtle paper sheen on the fold face */}
                      {flipDir === 'next'
                        ? <polygon points="0,102 102,102 0,0"  fill="url(#sheenPrev)" />
                        : <polygon points="102,102 0,102 102,0" fill="url(#sheenNext)" />
                      }
                      <defs>
                        <linearGradient id="sheenNext" x1="1" y1="1" x2="0" y2="0">
                          <stop offset="0%"  stopColor="rgba(255,255,255,0.0)" />
                          <stop offset="60%" stopColor="rgba(255,255,255,0.2)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                        </linearGradient>
                        <linearGradient id="sheenPrev" x1="0" y1="1" x2="1" y2="0">
                          <stop offset="0%"  stopColor="rgba(255,255,255,0.0)" />
                          <stop offset="60%" stopColor="rgba(255,255,255,0.2)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                )}

                {/* ── Flipping leaf (CSS 3-D rotateY, starts after corner lift) ── */}
                {isFlipping && (flipLeft || flipRight) && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: flipDir === 'next' ? 0 : pageW,
                    width: pageW,
                    height: pageH,
                    zIndex: 10,
                    transformStyle: 'preserve-3d',
                    transformOrigin: flipDir === 'next' ? 'right center' : 'left center',
                    animation: flipDir === 'next'
                      ? 'bookFlipPrev 0.56s 0.15s cubic-bezier(0.4,0,0.2,1) forwards'
                      : 'bookFlipNext 0.56s 0.15s cubic-bezier(0.4,0,0.2,1) forwards',
                  }}>
                    {/* Front face — outgoing page */}
                    <div style={{
                      position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                      overflow: 'hidden',
                    }}>
                      <img
                        src={flipDir === 'next' ? shownLeft ?? shownRight : shownRight ?? shownLeft}
                        draggable={false}
                        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }}
                      />
                      {/* Curl shadow — deepens toward the leading fold edge */}
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: flipDir === 'next'
                          ? 'linear-gradient(to right, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.08) 25%, transparent 50%)'
                          : 'linear-gradient(to left,  rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.08) 25%, transparent 50%)',
                      }} />
                    </div>

                    {/* Back face — arriving page */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      overflow: 'hidden',
                    }}>
                      <img
                        src={flipDir === 'next'
                          ? (flipLeft ?? shownRight ?? shownLeft)
                          : (flipRight ?? shownLeft ?? shownRight)}
                        draggable={false}
                        style={{
                          width: '100%', height: '100%', display: 'block', objectFit: 'fill',
                          transform: 'scaleX(-1)',
                        }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: flipDir === 'next'
                          ? 'linear-gradient(to left,  rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 25%, transparent 50%)'
                          : 'linear-gradient(to right, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 25%, transparent 50%)',
                      }} />
                    </div>
                  </div>
                )}

                {/* ── Harmony shadow: casts over arriving pages as leaf turns ── */}
                {isFlipping && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 5,
                    pointerEvents: 'none',
                    background: flipDir === 'next'
                      ? 'linear-gradient(to right, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.06) 45%, transparent 70%)'
                      : 'linear-gradient(to left,  rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.06) 45%, transparent 70%)',
                    animation: 'sweepShadowFade 0.56s 0.15s ease-out forwards',
                  }} />
                )}

                {/* ── Spine gutter shadow ── */}
                {!effectivelySingle && !isWriteMode && (
                  <div style={{
                    position: 'absolute',
                    left: pageW - 6, top: 0,
                    width: 12, height: pageH,
                    zIndex: 15, pointerEvents: 'none',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.22) 0%, transparent 50%, rgba(0,0,0,0.10) 100%)',
                  }} />
                )}

                {/* ── Board colour overlay — tints the pages when a colour is chosen ── */}
                {boardColor !== 'transparent' && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 16,
                    backgroundColor: boardColor,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Line frame hidden when board color is transparent */}
                {backgroundType !== 'none' && boardColor !== 'transparent' && (
                  <div
                    className={`${
                      backgroundType === 'single' ? 'single-line-bg' :
                      backgroundType === 'four'   ? 'four-line-bg'   :
                      backgroundType === 'math'   ? 'math-box-bg'    : ''
                    }`}
                    style={{
                      position: 'absolute', inset: 0, zIndex: 17,
                      pointerEvents: 'none',
                      ...lineOverlayStyle,
                    }}
                  />
                )}

                {/* ── Book drop-shadow (outside the book) ── */}
                {!isWriteMode && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 0,
                  boxShadow: '0 8px 48px 0 rgba(0,0,0,0.28), 0 2px 8px 0 rgba(0,0,0,0.16)',
                  pointerEvents: 'none',
                }} />
                )}
              </div>
            </div>
          );
        })()}


      </main>

      {/* Nav columns — portaled to body so backdrop-filter inside root div never affects them */}
      {createPortal(
        <>
        {([          { side: 'left'  as const, pos: 'left-0',  show: showLeftNav,  xOff: -72, origin: 'left center'  },
          { side: 'right' as const, pos: 'right-0', show: showRightNav, xOff:  72, origin: 'right center' },
        ]).map(({ side, pos, show, xOff, origin }) => (
        <motion.div
          key={side}
          data-toolbar
          className={`fixed ${pos} top-1/2 -translate-y-1/2 z-[99999]`}
          animate={{ x: show ? 0 : xOff * toolbarScale, scale: toolbarScale }}
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          style={{ transformOrigin: origin }}
        >
        {/* Buttons column */}
        <div className="flex flex-col gap-2 px-1">

        {/* Toolbar buttons — always visible */}
        <div
          data-toolbar
          className="flex flex-col gap-8"
          onPointerMove={() => { resetSubToolbarTimer(); resetToolbarTimer(); }}
          onClick={() => { resetSubToolbarTimer(); resetToolbarTimer(); }}
        >
                {/* Group 1: Read + Write */}
                <div className="flex flex-col gap-2">
                {/* Read button — top of toolbar, applies transparent background */}
                <div className={`relative flex items-stretch gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => {
                      if (boardColor === 'transparent') {
                        // Already in read mode → toggle page picker for this side
                        setShowPagePicker(showPagePicker === side ? false : side);
                        setShowSubToolbar(null);
                      } else {
                        // Activate read mode and open page picker immediately
                        selectBoardColor('transparent');
                        setShowSubToolbar(null);
                        setSpotlightRect(null);
                        setActiveTool('none');
                        setShowPagePicker(side);
                      }
                    }}
                    title="Read Mode — show page"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all ${
                      boardColor === 'transparent'
                        ? 'bg-blue-700 text-white border-blue-800 shadow-lg scale-110'
                        : 'bg-white text-blue-400 border-blue-200 hover:border-blue-500 hover:text-blue-600 shadow-sm'
                    }`}
                  >
                    <BookOpen className="mx-auto h-6 w-6" />
                  </button>

                  {/* Page picker sub-toolbar */}
                  <AnimatePresence>
                    {showPagePicker === side && (
                      <motion.div
                        initial={{ x: side === 'left' ? -8 : 8, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: side === 'left' ? -8 : 8, opacity: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className={`absolute ${side === 'left' ? 'left-full ml-2' : 'right-full mr-2'} top-0 bg-white/95 backdrop-blur-xl border-[3px] border-slate-200 rounded-2xl shadow-2xl z-50`}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="flex flex-col">
                          {/* Header */}
                          <div className="bg-blue-700 px-4 py-1.5 flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">Go to Page</span>
                            <button onClick={() => setShowPagePicker(false)} className="text-white/70 hover:text-white transition-colors flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* View mode toggle */}
                          <div className="px-3 pt-2 pb-0 flex gap-1.5">
                            <button
                              onClick={() => setSinglePageMode(false)}
                              className={`flex-1 py-1 rounded-lg border-[2px] text-[9px] font-black uppercase tracking-wider transition-all ${
                                !singlePageMode ? 'bg-blue-700 text-white border-blue-800' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                              }`}
                            >Double</button>
                            <button
                              onClick={() => setSinglePageMode(true)}
                              className={`flex-1 py-1 rounded-lg border-[2px] text-[9px] font-black uppercase tracking-wider transition-all ${
                                singlePageMode ? 'bg-blue-700 text-white border-blue-800' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                              }`}
                            >Single</button>
                          </div>
                          {/* Alignment buttons — only in single mode */}
                          {singlePageMode && (
                            <div className="px-3 pt-1.5 pb-0 flex gap-1.5">
                              {([
                                { id: 'left',   icon: AlignLeft,   title: 'Left'   },
                                { id: 'center', icon: AlignCenter, title: 'Center' },
                                { id: 'right',  icon: AlignRight,  title: 'Right'  },
                              ] as const).map(({ id, icon: Icon, title }) => (
                                <button
                                  key={id}
                                  onClick={() => setSinglePageAlign(id)}
                                  title={title}
                                  className={`flex-1 flex items-center justify-center py-1 rounded-lg border-[2px] transition-all ${
                                    singlePageAlign === id
                                      ? 'bg-blue-700 text-white border-blue-800'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Page grid */}
                          <div className="p-3 flex items-center gap-2">
                            {(() => {
                              // Build selectable items list
                              // Single mode: every page index [0,1,2,3...]
                              // Double mode: 0, 1 (both single), then pairs starting at even: 2,4,6...
                              const allItems: number[] = singlePageMode
                                ? Array.from({ length: pageImages.length }, (_, i) => i)
                                : [
                                    0,
                                    ...(pageImages.length > 1 ? [1] : []),
                                    ...Array.from(
                                      { length: Math.ceil((pageImages.length - 2) / 2) },
                                      (_, i) => i * 2 + 2
                                    ).filter(n => n < pageImages.length),
                                  ];
                              const offset5 = pagePickerOffset * 3;
                              const visibleItems = allItems.slice(offset5, offset5 + 3);
                              return (<>
                                {/* Prev 5 */}
                                <button
                                  onClick={() => setPagePickerOffset(v => Math.max(0, v - 1))}
                                  disabled={pagePickerOffset === 0}
                                  className="flex items-center justify-center w-7 h-7 rounded-lg border-2 border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>

                                {/* Page buttons */}
                                <div className="flex gap-1.5">
                                  {visibleItems.map((pageIdx) => {
                                    const isActive = startPageIndex === pageIdx;
                                    const isPair = !singlePageMode && pageIdx >= 2;
                                    const pairRight = pageIdx + 1;
                                    return (
                                      <button
                                        key={pageIdx}
                                        onClick={() => goToPage(pageIdx)}
                                        className={`min-w-[2.25rem] px-1 rounded-xl border-[2px] transition-all flex flex-col items-center justify-center leading-none ${
                                          isPair ? 'h-11' : 'h-9'
                                        } ${
                                          isActive
                                            ? 'bg-blue-700 text-white border-blue-800 scale-110 shadow-md'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                        }`}
                                      >
                                        {pageIdx === 0 ? (
                                          <span className="text-[10px] font-black">⌂</span>
                                        ) : isPair ? (
                                          <>
                                            <span className="text-[9px] font-black">{pageIdx}</span>
                                            {pairRight < pageImages.length && (
                                              <span className="text-[9px] font-black">{pairRight}</span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-[10px] font-black">{pageIdx}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Next 5 */}
                                <button
                                  onClick={() => setPagePickerOffset(v => Math.min(Math.ceil(allItems.length / 3) - 1, v + 1))}
                                  disabled={offset5 + 3 >= allItems.length}
                                  className="flex items-center justify-center w-7 h-7 rounded-lg border-2 border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </>);
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Resources toggle button */}
                <div className={`relative flex items-stretch gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => setShowResources(v => !v)}
                    title="Resources"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all flex flex-col items-center justify-center gap-0 ${
                      showResources
                        ? 'bg-orange-500 text-white border-orange-600 shadow-lg scale-110'
                        : 'bg-white text-orange-400 border-orange-200 hover:border-orange-500 hover:text-orange-600 shadow-sm'
                    }`}
                  >
                    <FolderOpen className="h-5 w-5" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none mt-0.5">Res</span>
                  </button>
                </div>
                {showResources && (<>
                  <div className={`relative flex items-stretch gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}` }>
                    <button
                      data-toolbar
                      onClick={() => {
                        setShowConceptsToolbar(showConceptsToolbar === side ? false : side);
                        setShowSubToolbar(null);
                        setShowPagePicker(false);
                      }}
                      title="Concepts"
                      className={`h-12 w-12 rounded-2xl border-[3px] transition-all ${
                        showConceptsToolbar === side
                          ? 'bg-purple-600 text-white border-purple-700 shadow-lg scale-110'
                          : 'bg-white text-purple-400 border-purple-200 hover:border-purple-500 hover:text-purple-600 shadow-sm'
                      }`}
                    >
                      <Layers className="mx-auto h-6 w-6" />
                    </button>
                    <AnimatePresence>
                      {showConceptsToolbar === side && (
                        <motion.div
                          data-toolbar
                          initial={{ x: side === 'left' ? -8 : 8, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: side === 'left' ? -8 : 8, opacity: 0 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className={`absolute ${side === 'left' ? 'left-full ml-2' : 'right-full mr-2'} top-0 bg-white/95 backdrop-blur-xl border-[3px] border-slate-200 rounded-2xl shadow-2xl z-50`}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="flex flex-col">
                            <div className="bg-purple-600 px-4 py-1.5 flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">Concepts</span>
                              <button data-toolbar onClick={() => setShowConceptsToolbar(false)} className="text-white/70 hover:text-white transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="p-2 flex flex-col gap-1.5" style={{ minWidth: 140 }}>
                              {conceptFolders.map((folder) => (
                                <button
                                  key={folder}
                                  data-toolbar
                                  onClick={() => {
                                    setActiveConceptPopup(folder);
                                    setShowConceptsToolbar(false);
                                  }}
                                  className="px-3 py-2 rounded-xl border-[2px] border-purple-200 text-purple-700 text-[10px] font-black uppercase tracking-wider hover:bg-purple-600 hover:text-white hover:border-purple-700 transition-all text-left whitespace-nowrap"
                                >
                                  {folder.replace(/_/g, ' ')}
                                </button>
                              ))}
                              {conceptFolders.length === 0 && (
                                <span className="text-[9px] text-slate-400 px-1 py-1">No concepts found</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    data-toolbar
                    onClick={() => {
                      setShowFlashcardsPopup(true);
                      setShowConceptsToolbar(false);
                      setShowSubToolbar(null);
                      setShowPagePicker(false);
                    }}
                    title="Short Questions"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all flex flex-col items-center justify-center gap-0 ${
                      showFlashcardsPopup
                        ? 'bg-teal-600 text-white border-teal-700 shadow-lg scale-110'
                        : 'bg-white text-teal-500 border-teal-200 hover:border-teal-500 hover:text-teal-600 shadow-sm'
                    }`}
                  >
                    <BookOpen className="h-5 w-5" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none mt-0.5">Qs</span>
                  </button>
                  <button
                    data-toolbar
                    onClick={() => {
                      setShowMcqsPopup(true);
                      setShowConceptsToolbar(false);
                      setShowSubToolbar(null);
                      setShowPagePicker(false);
                    }}
                    title="MCQs"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all flex flex-col items-center justify-center gap-0 ${
                      showMcqsPopup
                        ? 'bg-violet-600 text-white border-violet-700 shadow-lg scale-110'
                        : 'bg-white text-violet-500 border-violet-200 hover:border-violet-500 hover:text-violet-600 shadow-sm'
                    }`}
                  >
                    <List className="h-5 w-5" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none mt-0.5">MCQs</span>
                  </button>
                  <button
                    data-toolbar
                    onClick={() => {
                      setShowMindmapPopup(true);
                      setShowConceptsToolbar(false);
                      setShowSubToolbar(null);
                      setShowPagePicker(false);
                    }}
                    title="Mind Map"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all flex flex-col items-center justify-center gap-0 ${
                      showMindmapPopup
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg scale-110'
                        : 'bg-white text-indigo-500 border-indigo-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm'
                    }`}
                  >
                    <Network className="h-5 w-5" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none mt-0.5">Map</span>
                  </button>
                  <button
                    data-toolbar
                    onClick={() => {
                      setShowInfographicPopup(true);
                      setShowConceptsToolbar(false);
                      setShowSubToolbar(null);
                      setShowPagePicker(false);
                    }}
                    title="Infographic"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all flex flex-col items-center justify-center gap-0 ${
                      showInfographicPopup
                        ? 'bg-amber-500 text-white border-amber-600 shadow-lg scale-110'
                        : 'bg-white text-amber-500 border-amber-200 hover:border-amber-500 hover:text-amber-600 shadow-sm'
                    }`}
                  >
                    <Images className="h-5 w-5" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none mt-0.5">Info</span>
                  </button>
                  <button
                    data-toolbar
                    onClick={() => {
                      setShowVideoPopup(true);
                      setShowConceptsToolbar(false);
                      setShowSubToolbar(null);
                      setShowPagePicker(false);
                    }}
                    title="Video Overview"
                    className={`h-12 w-12 rounded-2xl border-[3px] transition-all flex flex-col items-center justify-center gap-0 ${
                      showVideoPopup
                        ? 'bg-rose-600 text-white border-rose-700 shadow-lg scale-110'
                        : 'bg-white text-rose-500 border-rose-200 hover:border-rose-500 hover:text-rose-600 shadow-sm'
                    }`}
                  >
                    <Play className="h-5 w-5" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none mt-0.5">Video</span>
                  </button>
                </>)}
                </div>{/* end Group 1 */}

                {/* Group 2: Navigation */}
                {!showResources && (<div className="flex flex-col gap-2">
                <button
                  onClick={() => { handleNextPages(); setShowSubToolbar(null); setShowPagePicker(false); resetToolbarTimer(); }}
                  disabled={(boardColor !== 'transparent' ? (boardPage >= N_BOARD_PAGES - 1 || boardSliding) : (isFlipping || (singlePageMode ? startPageIndex + 1 >= pageImages.length : (startPageIndex === 0 ? pageImages.length < 2 : startPageIndex + 2 >= pageImages.length)))) || (activeTool === 'spotlight' || spotlightRect !== null) || (activeTool === 'zoom' || zoomTransform !== null)}
                  title="Next Pages"
                  className={`group h-12 w-12 rounded-2xl border-[3px] shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    boardColor === 'transparent'
                      ? 'border-blue-300 bg-blue-50 hover:bg-blue-700 hover:border-blue-800'
                      : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-600 hover:border-emerald-700'
                  }`}
                >
                  <ChevronLeft className="mx-auto h-7 w-7 text-amber-500 group-hover:text-white transition-colors" />
                </button>
                <button
                  onClick={() => { handlePreviousPages(); setShowSubToolbar(null); setShowPagePicker(false); resetToolbarTimer(); }}
                  disabled={(boardColor !== 'transparent' ? (boardPage === 0 || boardSliding) : (startPageIndex === 0 || isFlipping)) || (activeTool === 'spotlight' || spotlightRect !== null) || (activeTool === 'zoom' || zoomTransform !== null)}
                  title="Previous Pages"
                  className={`group h-12 w-12 rounded-2xl border-[3px] shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    boardColor === 'transparent'
                      ? 'border-blue-300 bg-blue-50 hover:bg-blue-700 hover:border-blue-800'
                      : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-600 hover:border-emerald-700'
                  }`}
                >
                  <ChevronRight className="mx-auto h-7 w-7 text-amber-500 group-hover:text-white transition-colors" />
                </button>
                </div>)}{/* end Group 2 */}

                {(() => {
                  const isRead = boardColor === 'transparent';
                  const modeAc       = isRead ? 'bg-blue-700 border-blue-800'     : 'bg-emerald-600 border-emerald-700';
                  const modeIc       = isRead ? 'border-blue-200 hover:border-blue-500 hover:text-blue-700' : 'border-emerald-200 hover:border-emerald-500 hover:text-emerald-700';
                  const modeBdr      = isRead ? 'border-blue-200' : 'border-emerald-200';
                  const modeHeader   = isRead ? 'bg-blue-700' : 'bg-emerald-600';
                  const modeAccentHex = isRead ? '#1d4ed8' : '#059669';
                  const renderToolBtn = (t: { id: string; icon: React.ComponentType<{ className?: string }>; label: string; title: string }) => (
                  <div key={t.id} className={`relative flex items-stretch gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
                    <button
                      disabled={((activeTool === 'spotlight' || spotlightRect !== null) || (activeTool === 'zoom' || zoomTransform !== null)) && t.id === 'reset'}
                      onClick={() => {
                        setShowPagePicker(false);
                        if (t.id === 'reset') {
                          setShowResetConfirm(true);
                          return;
                        } else if (t.id === 'spotlight') {
                          // Always clear zoom when spotlight is touched
                          setZoomSelectMode(false);
                          setZoomRect(null);
                          setZoomTransform(null);
                          if (spotlightRect !== null) {
                            // Deactivate: clear rect and return to none
                            setSpotlightRect(null);
                            setActiveTool('none');
                          } else {
                            // Activate: create a default centered box immediately
                            const w = Math.round(window.innerWidth * 0.25);
                            const h = Math.round(window.innerHeight * 0.2);
                            setSpotlightRect({
                              x: Math.round((window.innerWidth - w) / 2),
                              y: Math.round((window.innerHeight - h) / 2),
                              w, h,
                            });
                            setActiveTool('spotlight');
                            setSpotlightHintDismissed(false);
                          }
                          setShowSubToolbar(null);
                        } else if (t.id === 'zoom') {
                          if (activeTool === 'zoom' || zoomTransform !== null) {
                            // Deactivate: clear all zoom state
                            setZoomSelectMode(false);
                            setZoomRect(null);
                            setZoomTransform(null);
                            setActiveTool('none');
                          } else {
                            // Activate: clear spotlight, enter rubber-band select mode
                            setSpotlightRect(null);
                            setActiveTool('zoom');
                            setZoomSelectMode(true);
                            setZoomRect(null);
                            setZoomTransform(null);
                            setZoomHintDismissed(false);
                          }
                          setShowSubToolbar(null);
                          resetToolbarTimer();
                        } else {
                          // Toggle off if already active, otherwise activate
                          if (activeTool === t.id) {
                            setActiveTool('none');
                            setShowSubToolbar(null);
                          } else {
                            setActiveTool(t.id as Tool);
                            setZoomSelectMode(false);
                            // Keep zoom active — pen/brush/eraser can draw on the zoomed area
                            setShowSubToolbar(showSubToolbar?.id === t.id && showSubToolbar.side === side ? null : { id: t.id as Tool, side });
                            resetSubToolbarTimer();
                          }
                        }
                      }}
                      title={t.title}
                      className={`h-12 w-12 rounded-2xl border-[3px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 ${
                        t.id === 'reset'
                          ? `bg-red-50 text-red-500 border-red-400 hover:bg-red-500 hover:text-white hover:border-red-600 shadow-sm`
                          : (activeTool === t.id || (t.id === 'spotlight' && spotlightRect !== null) || (t.id === 'zoom' && zoomTransform !== null))
                            ? `${modeAc} text-white shadow-lg scale-110`
                            : `bg-white text-slate-500 ${modeIc} shadow-sm`
                      }`}
                    >
                      {(() => {
                        let iconColor: string | undefined;
                        if (t.id === 'pen') iconColor = activeTool === 'pen' ? '#ffffff' : '#3b82f6';
                        else if (t.id === 'brush') iconColor = activeTool === 'brush' ? '#ffffff' : '#f59e0b';
                        else if (t.id === 'eraser') iconColor = activeTool === 'eraser' ? '#ffffff' : '#ec4899';
                        return <span style={iconColor ? { color: iconColor, display: 'flex', justifyContent: 'center' } : { display: 'flex', justifyContent: 'center' }}><t.icon className="h-6 w-6" /></span>;
                      })()}
                    </button>

                    {/* Sub-toolbar for pen/brush/eraser */}
                    <AnimatePresence>
                      {showSubToolbar?.id === t.id && showSubToolbar.side === side && (
                        <motion.div
                          initial={{ x: side === 'left' ? -8 : 8, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: side === 'left' ? -8 : 8, opacity: 0 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className={`absolute ${side === 'left' ? 'left-full ml-2' : 'right-full mr-2'} top-0 bg-white/95 backdrop-blur-xl border-[3px] border-slate-200 rounded-2xl shadow-2xl z-50`}
                          style={{ overflow: 'hidden' }}
                          onPointerMove={resetSubToolbarTimer}
                        >
                          <div className="flex flex-col">
                            <div className={`${t.id === 'pen' ? 'bg-sky-600' : t.id === 'brush' ? 'bg-indigo-600' : t.id === 'eraser' ? 'bg-rose-500' : modeHeader} px-4 py-1.5 flex items-center justify-between gap-4`}>
                              <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">
                                {t.id === 'pen'    && 'Pen Settings'}
                                {t.id === 'brush'  && 'Brush Settings'}
                                {t.id === 'eraser' && 'Eraser Settings'}
                              </span>
                              <button onClick={() => setShowSubToolbar(null)} className="text-white/70 hover:text-white transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="p-3 flex items-center gap-4">
                              {t.id === 'pen' && (
                                <div className="flex flex-col gap-2" style={{ minWidth: 130 }}>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Size — {brushSize}px</span>
                                    <input type="range" min="1" max="20" value={brushSize}
                                      onChange={(e) => { setBrushSize(parseInt(e.target.value)); resetSubToolbarTimer(); }}
                                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none"
                                      style={{ accentColor: modeAccentHex }} />
                                  </div>
                                  <div className="h-px bg-slate-200" />
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Color</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1.75rem)', gap: '0.375rem' }}>
                                      {['#111827','#dc2626','#1d4ed8','#15803d','#ea580c','#7c3aed','#db2777','#ffffff'].map((c) => (
                                        <button key={c} onClick={() => { setColor(c); resetSubToolbarTimer(); }}
                                          className="w-7 h-7 rounded-full flex-shrink-0 transition-all ring-1 ring-slate-200 hover:scale-105"
                                          style={{ backgroundColor: c, ...(color === c ? { boxShadow: `0 0 0 3px ${modeAccentHex}`, transform: 'scale(1.1)' } : {}) }} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {t.id === 'brush' && (
                                <div className="flex flex-col gap-2" style={{ minWidth: 130 }}>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Size — {brushSize}px</span>
                                    <input type="range" min="5" max="150" value={brushSize}
                                      onChange={(e) => { setBrushSize(parseInt(e.target.value)); resetSubToolbarTimer(); }}
                                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none"
                                      style={{ accentColor: modeAccentHex }} />
                                  </div>
                                  <div className="h-px bg-slate-200" />
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opacity — {Math.round(intensity * 100)}%</span>
                                    <input type="range" min="0.1" max="1" step="0.1" value={intensity}
                                      onChange={(e) => { setIntensity(parseFloat(e.target.value)); resetSubToolbarTimer(); }}
                                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none"
                                      style={{ accentColor: modeAccentHex }} />
                                  </div>
                                  <div className="h-px bg-slate-200" />
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Color</span>
                                    <input type="color" value={color}
                                      onChange={(e) => { setColor(e.target.value); resetSubToolbarTimer(); }}
                                      className="w-8 h-8 rounded-lg border-2 border-slate-200 cursor-pointer shadow-sm" />
                                  </div>
                                </div>
                              )}
                              {t.id === 'eraser' && (
                                <div className="flex flex-col gap-2" style={{ minWidth: 130 }}>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Size — {eraserSize}px</span>
                                    <input type="range" min="5" max="150" value={eraserSize}
                                      onChange={(e) => { setEraserSize(parseInt(e.target.value)); resetSubToolbarTimer(); }}
                                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none"
                                      style={{ accentColor: modeAccentHex }} />
                                  </div>
                                  <div className="h-px bg-slate-200" />
                                  <button
                                    onClick={() => { boardColor !== 'transparent' ? clearWriteCanvas() : clearReadCanvas(); resetSubToolbarTimer(); }}
                                    className="w-full py-1.5 rounded-xl border-2 border-red-200 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:border-red-400 transition-all"
                                  >
                                    Clear All
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  );
                  return (
                    <>
                      {/* Group 3: Pen + Brush + Eraser */}
                      <div className="flex flex-col gap-2">
                        {[
                          ...(!showResources ? [{ id: 'plain', icon: Square, label: 'Write', title: 'Board Color & Lines' }] : []),
                          { id: 'pen',    icon: Pencil, label: 'Pen',    title: 'Pen Tool' },
                          ...(!showResources ? [{ id: 'brush', icon: Brush, label: 'Brush', title: 'Brush Tool' }] : []),
                          { id: 'eraser', icon: Eraser, label: 'Eraser', title: 'Eraser Tool' },
                        ].map(renderToolBtn)}
                      </div>
                      {/* Group 4: Spotlight + Zoom */}
                      <div className="flex flex-col gap-2">
                        <button
                          disabled={(activeTool === 'zoom' || zoomTransform !== null)}
                          onClick={() => {
                            setZoomSelectMode(false); setZoomRect(null); setZoomTransform(null);
                            if (spotlightRect !== null) { setSpotlightRect(null); setActiveTool('none'); }
                            else { const w = Math.round(window.innerWidth * 0.25); const h = Math.round(window.innerHeight * 0.2); setSpotlightRect({ x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2), w, h }); setActiveTool('spotlight'); setSpotlightHintDismissed(false); }
                            setShowSubToolbar(null);
                          }}
                          title="Spotlight"
                          className={`h-12 w-12 rounded-2xl border-[3px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 ${
                            activeTool === 'spotlight' || spotlightRect !== null
                              ? 'bg-amber-500 text-white border-amber-600 shadow-lg scale-110'
                              : 'bg-white text-amber-400 border-amber-200 hover:border-amber-500 hover:text-amber-600 shadow-sm'
                          }`}
                        >
                          <Spotlight className="mx-auto h-6 w-6" />
                        </button>
                        <button
                          disabled={activeTool === 'spotlight' || spotlightRect !== null}
                          onClick={() => {
                            if (activeTool === 'zoom' || zoomTransform !== null) { setZoomSelectMode(false); setZoomRect(null); setZoomTransform(null); setActiveTool('none'); }
                            else { setSpotlightRect(null); setActiveTool('zoom'); setZoomSelectMode(true); setZoomRect(null); setZoomTransform(null); setZoomHintDismissed(false); }
                            setShowSubToolbar(null);
                          }}
                          title="Zoom"
                          className={`h-12 w-12 rounded-2xl border-[3px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 ${
                            activeTool === 'zoom' || zoomTransform !== null
                              ? 'bg-violet-600 text-white border-violet-700 shadow-lg scale-110'
                              : 'bg-white text-violet-400 border-violet-200 hover:border-violet-500 hover:text-violet-600 shadow-sm'
                          }`}
                        >
                          <ZoomIn className="mx-auto h-6 w-6" />
                        </button>
                      </div>
                      {/* Group 5: Hand + Reset */}
                      {!showResources && (<div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setIsHandMode(v => !v);
                          }}
                          title="Hand Cursor"
                          className={`h-12 w-12 rounded-2xl border-[3px] transition-all select-none ${
                            isHandMode
                              ? 'bg-[#e8b49a] text-white border-[#c8855a] shadow-lg scale-110'
                              : 'bg-white border-[#e8c9b5] hover:border-[#c8855a] shadow-sm'
                          }`}
                          style={!isHandMode ? { color: '#c8855a' } : {}}
                        >
                          <Hand className="mx-auto h-6 w-6" />
                        </button>
                        {[
                          { id: 'reset', icon: Trash2, label: 'Reset', title: 'Reset Canvas' },
                        ].map(renderToolBtn)}
                      </div>)}
                    </>
                  );
                })()}

            </div>

        </div>{/* end buttons column */}
        </motion.div>
        ))}
        </>,
        document.body
      )}
      {/* end nav columns */}

      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background-color: transparent !important; }
        :root {
          --line-spacing: 40px;
          --line-thickness: 2px;
          --line-color: #1e293b;
          --guide-color: #0f172a;
          --accent-line-color: #991b1b;
        }
        /* ── Book page-flip keyframes ──────────────────────────── */
        @keyframes bookFlipNext {
          0%   { transform: rotateY(0deg);    }
          100% { transform: rotateY(-180deg); }
        }
        @keyframes bookFlipPrev {
          0%   { transform: rotateY(0deg);   }
          100% { transform: rotateY(180deg); }
        }
        /* Corner fold grows from 0 at the bottom corner */
        @keyframes cornerFoldGrow {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
        /* Current page fades away as flip plays */
        @keyframes currentFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        /* Arriving page fades in from underneath */
        @keyframes arrivingFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* Harmony shadow fades as arriving page is revealed */
        @keyframes sweepShadowFade {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .math-box-bg {
          background-image:
            repeating-linear-gradient(to right, var(--line-color) 0, var(--line-color) var(--line-thickness), transparent var(--line-thickness), transparent var(--line-spacing)),
            repeating-linear-gradient(to bottom, var(--line-color) 0, var(--line-color) var(--line-thickness), transparent var(--line-thickness), transparent var(--line-spacing));
        }
        .single-line-bg {
          background-image: repeating-linear-gradient(to bottom, var(--guide-color) 0, var(--guide-color) var(--line-thickness), transparent var(--line-thickness), transparent var(--line-spacing));
        }
        .four-line-bg {
          background-image:
            linear-gradient(to bottom, var(--accent-line-color) var(--line-thickness), transparent var(--line-thickness)),
            linear-gradient(to bottom, transparent calc(var(--line-spacing) - var(--line-thickness)), var(--guide-color) calc(var(--line-spacing) - var(--line-thickness)), var(--guide-color) var(--line-spacing), transparent var(--line-spacing)),
            linear-gradient(to bottom, transparent calc(var(--line-spacing) * 2 - var(--line-thickness)), var(--guide-color) calc(var(--line-spacing) * 2 - var(--line-thickness)), var(--guide-color) calc(var(--line-spacing) * 2), transparent calc(var(--line-spacing) * 2)),
            linear-gradient(to bottom, transparent calc(var(--line-spacing) * 3 - var(--line-thickness)), var(--accent-line-color) calc(var(--line-spacing) * 3 - var(--line-thickness)), var(--accent-line-color) calc(var(--line-spacing) * 3), transparent calc(var(--line-spacing) * 3));
          background-size: 100% calc(var(--line-spacing) * 5);
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px; width: 20px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(99,102,241,0.5);
          border: 2px solid white;
        }
      `}} />
    </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && createPortal(
        <div className="fixed inset-0 z-[99997] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <div
            className="bg-white shadow-2xl border-2 border-red-200 flex flex-col items-center justify-between"
            style={{
              width: 'min(46vmin, 420px)',
              height: 'min(46vmin, 420px)',
              borderRadius: 'min(4vmin, 32px)',
              padding: 'min(5vmin, 44px)',
              gap: 'min(3vmin, 24px)',
            }}
          >
            {/* Icon */}
            <div
              className="rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"
              style={{ width: 'min(10vmin, 72px)', height: 'min(10vmin, 72px)' }}
            >
              <Trash2 style={{ width: 'min(5vmin, 36px)', height: 'min(5vmin, 36px)' }} className="text-red-500" />
            </div>
            {/* Text */}
            <div className="text-center flex-1 flex flex-col justify-center gap-2">
              <p style={{ fontSize: 'min(2.4vmin, 18px)' }} className="font-black text-slate-800">Reset Application?</p>
              <p style={{ fontSize: 'min(1.7vmin, 13px)', lineHeight: 1.6 }} className="text-slate-500">
                Every drawing, annotation and setting<br />will be permanently deleted.<br />
                The application will return to its<br />initial start state.
              </p>
            </div>
            {/* Buttons */}
            <div className="flex w-full" style={{ gap: 'min(2vmin, 14px)' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{ fontSize: 'min(1.6vmin, 12px)', borderRadius: 'min(2vmin, 16px)', padding: 'min(1.5vmin, 12px) 0' }}
                className="flex-1 border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              >Cancel</button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  const canvas = canvasRef.current;
                  const ctx = contextRef.current;
                  if (canvas && ctx) { const dpr = window.devicePixelRatio || 1; ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr); }
                  const draftCanvas = draftCanvasRef.current;
                  const draftCtx = draftContextRef.current;
                  if (draftCanvas && draftCtx) { const dpr = window.devicePixelRatio || 1; draftCtx.clearRect(0, 0, draftCanvas.width / dpr, draftCanvas.height / dpr); }
                  const pc = popupCanvasRef.current; const pCtx = popupContextRef.current;
                  if (pc && pCtx) { const dpr = window.devicePixelRatio || 1; pCtx.clearRect(0, 0, pc.width / dpr, pc.height / dpr); }
                  const pd = popupDraftCanvasRef.current; const pdCtx = popupDraftContextRef.current;
                  if (pd && pdCtx) { const dpr = window.devicePixelRatio || 1; pdCtx.clearRect(0, 0, pd.width / dpr, pd.height / dpr); }
                  savedCanvasDataRef.current = { none: null, single: null, four: null, math: null };
                  setBoardPage(0); setBoardSliding(false); setStartPageIndex(0);
                  setActiveTool('none'); setColor('#000000'); setBrushSize(4); setEraserSize(20);
                  setBackgroundType('none'); setIntensity(0.5); setBoardColor('transparent');
                  setSpotlightRect(null); setZoomSelectMode(false); setZoomRect(null); setZoomTransform(null);
                  setSinglePageMode(false); setSinglePageAlign('center'); setPagePickerOffset(0);
                  setShowPagePicker(false); setShowSubToolbar(null);
                }}
                style={{ fontSize: 'min(1.6vmin, 12px)', borderRadius: 'min(2vmin, 16px)', padding: 'min(1.5vmin, 12px) 0' }}
                className="flex-1 bg-red-500 border-2 border-red-600 text-white font-black uppercase tracking-widest hover:bg-red-600 transition-all"
              >Confirm Reset</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Concept Popup — draggable + resizable */}
      {activeConceptPopup && conceptPopupPos && conceptPopupSize && (
        <div
          className="absolute inset-0 z-[500]"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            transform: zoomTransform ? `translate(${zoomTransform.tx}px,${zoomTransform.ty}px) scale(${zoomTransform.s})` : undefined,
            transformOrigin: '50% calc(50% + 23px)',
            transition: zoomTransform ? 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' : undefined,
          }}
          onClick={() => setActiveConceptPopup(null)}
        >
          <div
            className="absolute bg-white shadow-2xl flex flex-col"
            style={{
              left: conceptPopupPos.x,
              top:  conceptPopupPos.y,
              width: conceptPopupSize.w,
              height: conceptPopupSize.h,
              borderRadius: 20,
              border: '2.5px solid #a855f7',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — drag handle */}
            <div
              className="bg-purple-600 px-5 py-3 flex items-center justify-between flex-shrink-0 select-none"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                conceptDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: conceptPopupPos.x,
                  origY: conceptPopupPos.y,
                };
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing';
              }}
              onPointerMove={(e) => {
                const d = conceptDragRef.current;
                if (!d) return;
                const newX = Math.max(0, Math.min(window.innerWidth  - conceptPopupSize.w, d.origX + (e.clientX - d.startX)));
                const newY = Math.max(0, Math.min(window.innerHeight - conceptPopupSize.h, d.origY + (e.clientY - d.startY)));
                setConceptPopupPos({ x: newX, y: newY });
              }}
              onPointerUp={(e) => {
                conceptDragRef.current = null;
                (e.currentTarget as HTMLDivElement).style.cursor = 'grab';
              }}
              onPointerCancel={() => { conceptDragRef.current = null; }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Layers className="w-4 h-4 text-white/80" />
                <span className="text-white font-black uppercase tracking-widest text-sm">
                  {activeConceptPopup.replace(/_/g, ' ')}
                </span>
                <span className="text-white/40 text-[10px] font-normal ml-1">drag to move</span>
              </div>
              <button
                onClick={() => setActiveConceptPopup(null)}
                className="text-white/70 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Body: left nav + content ── */}
            <div className="flex flex-row flex-1 min-h-0">
            {/* ── Left navigation bar ── */}
            <div className="flex-shrink-0 flex flex-col items-center justify-start border-r-2 border-purple-100 bg-white px-2 py-3 gap-1">
              {([
                { id: 'image',    icon: ImageIcon, label: 'Image'    },
                { id: 'audio',    icon: Volume2,   label: 'Audio'    },
                { id: 'info',     icon: Info,      label: 'Info'     },
                { id: 'glossary', icon: FileText,  label: 'Glossary' },
              ] as { id: 'image' | 'audio' | 'info' | 'glossary'; icon: React.ComponentType<{ className?: string }>; label: string }[]).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id !== 'audio' && conceptAudioRef.current) {
                      conceptAudioRef.current.pause();
                      conceptAudioRef.current = null;
                      setConceptIsPlaying(false);
                    }
                    if (id === 'audio') {
                      conceptVideoAutoPlayRef.current = true;
                    }
                    setConceptSection(id);
                  }}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all w-full ${
                    conceptSection === id
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                </button>
              ))}
            </div>
            {/* ── Section content + drawing overlay ── */}
            <div className="flex-1 min-h-0 relative" style={{ overflow: 'hidden' }}>
              {/* Scrollable content underneath */}
              <div className="absolute inset-0 overflow-auto bg-slate-50" style={{ padding: 12 }}>
              {(() => {
                const assets = conceptAssets[activeConceptPopup] ?? { images: [], audio: [], info: [], glossary: [] };

                /* ── IMAGE ── */
                if (conceptSection === 'image') {
                  if (assets.images.length === 0) return (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                      <span style={{ fontSize: 44 }}>🖼️</span>
                      <span className="text-xs font-black uppercase tracking-widest">No images available</span>
                    </div>
                  );
                  const file = assets.images[conceptImgIndex] ?? assets.images[0];
                  return (
                    <div className="flex flex-col h-full gap-2">
                      {/* image fills available space */}
                      <div className="flex-1 min-h-0 flex items-center justify-center">
                        <img
                          src={`./Concepts/${activeConceptPopup}/image/${file}`}
                          alt={file}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 10, display: 'block' }}
                        />
                      </div>
                      {/* prev / next + counter */}
                      {assets.images.length > 1 && (
                        <div className="flex items-center justify-center gap-3 flex-shrink-0 pb-1">
                          <button
                            onClick={() => setConceptImgIndex(i => Math.max(0, i - 1))}
                            disabled={conceptImgIndex === 0}
                            className="w-8 h-8 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-600 hover:bg-purple-100 disabled:opacity-30 transition-all"
                          ><ChevronLeft className="w-4 h-4" /></button>
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            {conceptImgIndex + 1} / {assets.images.length}
                          </span>
                          <button
                            onClick={() => setConceptImgIndex(i => Math.min(assets.images.length - 1, i + 1))}
                            disabled={conceptImgIndex === assets.images.length - 1}
                            className="w-8 h-8 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-600 hover:bg-purple-100 disabled:opacity-30 transition-all"
                          ><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  );
                }

                /* ── AUDIO / VIDEO ── */
                if (conceptSection === 'audio') {
                  const hasVideos = (assets.videos?.length ?? 0) > 0;

                  /* ── VIDEO path ── */
                  if (hasVideos) {
                    const videos = assets.videos!;
                    const videoFile = videos[conceptAudioIndex] ?? videos[0];
                    const videoSrc  = `./Concepts/${activeConceptPopup}/audio/${videoFile}`;
                    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
                    const showVideoControls = () => {
                      setConceptVideoControlsVisible(true);
                      if (conceptVideoHideTimerRef.current) clearTimeout(conceptVideoHideTimerRef.current);
                      conceptVideoHideTimerRef.current = setTimeout(() => setConceptVideoControlsVisible(false), 3000);
                    };
                    return (
                      <div className="flex flex-col h-full gap-0">
                        {/* video + overlay controls wrapper */}
                        <div
                          className="flex-1 min-h-0 relative bg-white rounded-xl overflow-hidden flex items-center justify-center"
                          onMouseMove={showVideoControls}
                          onMouseEnter={showVideoControls}
                          onMouseLeave={() => {
                            if (conceptVideoHideTimerRef.current) clearTimeout(conceptVideoHideTimerRef.current);
                            conceptVideoHideTimerRef.current = setTimeout(() => setConceptVideoControlsVisible(false), 800);
                          }}
                        >
                          <video
                            key={videoSrc}
                            ref={conceptVideoRef}
                            src={videoSrc}
                            disablePictureInPicture
                            onLoadedMetadata={() => setConceptVideoDuration(conceptVideoRef.current?.duration ?? 0)}
                            onCanPlay={() => {
                              if (conceptVideoAutoPlayRef.current && conceptVideoRef.current) {
                                conceptVideoAutoPlayRef.current = false;
                                conceptVideoRef.current.play();
                              }
                            }}
                            onTimeUpdate={() => setConceptVideoCurrentTime(conceptVideoRef.current?.currentTime ?? 0)}
                            onPlay={() => { setConceptVideoPlaying(true); setConceptVideoEnded(false); }}
                            onPause={() => setConceptVideoPlaying(false)}
                            onEnded={() => { setConceptVideoPlaying(false); setConceptVideoEnded(true); setConceptVideoControlsVisible(true); if (conceptVideoHideTimerRef.current) clearTimeout(conceptVideoHideTimerRef.current); }}
                            onClick={() => {
                              if (!conceptVideoRef.current) return;
                              if (conceptVideoPlaying) conceptVideoRef.current.pause();
                              else { conceptVideoRef.current.play(); setConceptVideoEnded(false); }
                              showVideoControls();
                            }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: conceptVideoControlsVisible ? 'default' : 'none' }}
                          />
                          {/* overlay controls bar — fades in/out */}
                          <div
                            className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 pt-3 pb-1.5 transition-opacity duration-300"
                            style={{
                              opacity: conceptVideoControlsVisible ? 1 : 0,
                              pointerEvents: conceptVideoControlsVisible ? 'auto' : 'none',
                            }}
                          >
                            {/* rewind 10s */}
                            <button
                              onClick={() => { if (conceptVideoRef.current) conceptVideoRef.current.currentTime = Math.max(0, conceptVideoRef.current.currentTime - 10); }}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                              title="Rewind 10s"
                            ><SkipBack className="w-3.5 h-3.5" /></button>
                            {/* play / pause */}
                            <button
                              onClick={() => {
                                if (!conceptVideoRef.current) return;
                                if (conceptVideoPlaying) conceptVideoRef.current.pause();
                                else conceptVideoRef.current.play();
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                              title={conceptVideoPlaying ? 'Pause' : 'Play'}
                            >{conceptVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}</button>
                            {/* forward 10s */}
                            <button
                              onClick={() => { if (conceptVideoRef.current) conceptVideoRef.current.currentTime = conceptVideoRef.current.currentTime + 10; }}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                              title="Forward 10s"
                            ><SkipForward className="w-3.5 h-3.5" /></button>
                            {/* seek bar */}
                            <input
                              type="range" min={0} max={conceptVideoDuration || 100} step={0.5}
                              value={conceptVideoCurrentTime}
                              onChange={e => {
                                const t = parseFloat(e.target.value);
                                if (conceptVideoRef.current) conceptVideoRef.current.currentTime = t;
                                setConceptVideoCurrentTime(t);
                              }}
                              className="flex-1 h-1 accent-purple-400 cursor-pointer"
                            />
                            {/* time */}
                            <span className="text-[9px] text-slate-500 font-semibold tabular-nums whitespace-nowrap">
                              {fmtTime(conceptVideoCurrentTime)}/{fmtTime(conceptVideoDuration)}
                            </span>
                            {/* speed */}
                            <button
                              onClick={() => {
                                const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
                                const next = speeds[(speeds.indexOf(conceptAudioSpeed) + 1) % speeds.length];
                                setConceptAudioSpeed(next);
                                if (conceptVideoRef.current) conceptVideoRef.current.playbackRate = next;
                              }}
                              className={`h-6 px-1.5 rounded text-[10px] font-bold tabular-nums transition-all ${
                                conceptAudioSpeed !== 1 ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Playback speed"
                            >{conceptAudioSpeed === 1 ? '1×' : `${conceptAudioSpeed}×`}</button>
                            {/* fullscreen */}
                            <button
                              onClick={() => conceptVideoRef.current?.requestFullscreen()}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                              title="Fullscreen"
                            ><Maximize className="w-3.5 h-3.5" /></button>
                          </div>
                          {/* replay overlay — shown when video finishes */}
                          {conceptVideoEnded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <button
                                onClick={() => {
                                  if (!conceptVideoRef.current) return;
                                  conceptVideoRef.current.currentTime = 0;
                                  conceptVideoRef.current.play();
                                  setConceptVideoEnded(false);
                                  showVideoControls();
                                }}
                                className="flex flex-col items-center gap-2 group"
                              >
                                <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-white flex items-center justify-center group-hover:bg-white/35 transition-all">
                                  <Play className="w-7 h-7 text-white ml-1" />
                                </div>
                                <span className="text-white text-xs font-bold tracking-widest uppercase">Replay</span>
                              </button>
                            </div>
                          )}
                        </div>
                        {/* track navigation — only when multiple videos */}
                        {videos.length > 1 && (
                          <div className="flex-shrink-0 flex items-center justify-center gap-2 pt-1 pb-0.5">
                            <button
                              onClick={() => { setConceptAudioIndex(i => Math.max(0, i - 1)); setConceptVideoPlaying(false); setConceptVideoCurrentTime(0); setConceptVideoDuration(0); setConceptVideoEnded(false); }}
                              disabled={conceptAudioIndex === 0}
                              className="w-7 h-7 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-600 hover:bg-purple-100 disabled:opacity-25 transition-all"
                              title="Previous video"
                            ><ChevronLeft className="w-3.5 h-3.5" /></button>
                            <span className="text-[10px] text-slate-400 font-semibold tabular-nums">{conceptAudioIndex + 1}/{videos.length}</span>
                            <button
                              onClick={() => { setConceptAudioIndex(i => Math.min(videos.length - 1, i + 1)); setConceptVideoPlaying(false); setConceptVideoCurrentTime(0); setConceptVideoDuration(0); setConceptVideoEnded(false); }}
                              disabled={conceptAudioIndex === videos.length - 1}
                              className="w-7 h-7 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-600 hover:bg-purple-100 disabled:opacity-25 transition-all"
                              title="Next video"
                            ><ChevronRight className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  /* ── AUDIO path (fallback) ── */
                  if (assets.audio.length === 0) return (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                      <span style={{ fontSize: 44 }}>🔊</span>
                      <span className="text-xs font-black uppercase tracking-widest">No audio available</span>
                    </div>
                  );
                  const audioFile = assets.audio[conceptAudioIndex] ?? assets.audio[0];
                  const audioSrc = `./Concepts/${activeConceptPopup}/audio/${audioFile}`;
                  const audioImgs = assets.audioImages ?? [];
                  const audioImg  = audioImgs[conceptAudioIndex] ?? audioImgs[0] ?? null;
                  return (
                    <div className="flex flex-col h-full gap-0">
                      {/* image area — fills available space */}
                      <div
                        ref={conceptAudioImgContainerRef}
                        className="flex-1 min-h-0 flex items-center justify-center bg-slate-100 rounded-t-xl overflow-hidden mx-0"
                      >
                        {audioImg ? (
                          <img
                            src={`./Concepts/${activeConceptPopup}/audio/${audioImg}`}
                            alt={audioImg}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-300">
                            <Volume2 className="w-16 h-16 opacity-30" />
                          </div>
                        )}
                      </div>

                      {/* player controls — dark bar matching video player */}
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-2 pt-1.5 pb-1 bg-slate-900 rounded-b-xl">
                        {/* rewind 10s */}
                        <button
                          onClick={() => {
                            if (conceptAudioRef.current) {
                              const t = Math.max(0, conceptAudioRef.current.currentTime - 10);
                              conceptAudioRef.current.currentTime = t;
                              setConceptAudioCurrentTime(t);
                            }
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                          title="Rewind 10s"
                        ><SkipBack className="w-3.5 h-3.5" /></button>

                        {/* play / pause */}
                        <button
                          onClick={() => {
                            if (conceptIsPlaying) {
                              conceptAudioRef.current?.pause();
                              setConceptIsPlaying(false);
                            } else {
                              if (!conceptAudioRef.current || conceptAudioRef.current.src !== new URL(audioSrc, location.href).href) {
                                if (conceptAudioRef.current) conceptAudioRef.current.pause();
                                const a = new Audio(audioSrc);
                                a.playbackRate = conceptAudioSpeed;
                                a.onloadedmetadata = () => setConceptAudioDuration(a.duration || 0);
                                a.ontimeupdate = () => setConceptAudioCurrentTime(a.currentTime);
                                a.onended = () => { setConceptIsPlaying(false); setConceptAudioCurrentTime(0); };
                                conceptAudioRef.current = a;
                              }
                              conceptAudioRef.current.play();
                              setConceptIsPlaying(true);
                            }
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/25 text-white transition-all"
                          title={conceptIsPlaying ? 'Pause' : 'Play'}
                        >{conceptIsPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}</button>

                        {/* forward 10s */}
                        <button
                          onClick={() => {
                            if (conceptAudioRef.current) {
                              const t = conceptAudioRef.current.currentTime + 10;
                              conceptAudioRef.current.currentTime = t;
                              setConceptAudioCurrentTime(t);
                            }
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                          title="Forward 10s"
                        ><SkipForward className="w-3.5 h-3.5" /></button>

                        {/* seek bar */}
                        <input
                          type="range" min={0} max={conceptAudioDuration || 100} step={0.5}
                          value={conceptAudioCurrentTime}
                          onChange={e => {
                            const t = parseFloat(e.target.value);
                            if (conceptAudioRef.current) conceptAudioRef.current.currentTime = t;
                            setConceptAudioCurrentTime(t);
                          }}
                          className="flex-1 h-1 accent-purple-400 cursor-pointer"
                        />

                        {/* time */}
                        {(() => {
                          const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
                          return (
                            <span className="text-[9px] text-slate-400 font-semibold tabular-nums whitespace-nowrap">
                              {fmt(conceptAudioCurrentTime)}/{fmt(conceptAudioDuration)}
                            </span>
                          );
                        })()}

                        {/* speed cycle */}
                        <button
                          onClick={() => {
                            const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
                            const next = speeds[(speeds.indexOf(conceptAudioSpeed) + 1) % speeds.length];
                            setConceptAudioSpeed(next);
                            if (conceptAudioRef.current) conceptAudioRef.current.playbackRate = next;
                          }}
                          className={`h-6 px-1.5 rounded text-[10px] font-bold tabular-nums transition-all ${
                            conceptAudioSpeed !== 1 ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                          title="Playback speed"
                        >{conceptAudioSpeed === 1 ? '1×' : `${conceptAudioSpeed}×`}</button>

                        {/* fullscreen (image container) */}
                        <button
                          onClick={() => conceptAudioImgContainerRef.current?.requestFullscreen()}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                          title="Fullscreen"
                        ><Maximize className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                }

                /* ── INFO / GLOSSARY ── */
                const subfolder = conceptSection;
                const files = conceptSection === 'info' ? assets.info : assets.glossary;
                const emojis = conceptSection === 'info' ? '📄' : '📖';
                if (files.length === 0) return (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                    <span style={{ fontSize: 44 }}>{emojis}</span>
                    <span className="text-xs font-black uppercase tracking-widest">No {conceptSection} available</span>
                  </div>
                );
                return (
                  <div className="flex flex-col gap-3 h-full">
                    {files.map(file => (
                      <iframe
                        key={file}
                        src={`./Concepts/${activeConceptPopup}/${subfolder}/${file}`}
                        title={file}
                        style={{ flex: 1, minHeight: 200, width: '100%', border: 'none', borderRadius: 10 }}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>{/* end scrollable content */}

              {/* ── Drawing overlay: draft canvas (brush in-progress) ── */}
              <canvas
                ref={popupDraftCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ touchAction: 'none', opacity: popupIsDrawingRef.current && activeTool === 'brush' ? intensity : 1 }}
              />
              {/* ── Drawing overlay: main canvas ── */}
              <canvas
                ref={popupCanvasRef}
                className="absolute inset-0 w-full h-full"
                style={{
                  touchAction: 'none',
                  cursor: activeTool === 'eraser' ? 'none'
                    : (activeTool === 'pen' || activeTool === 'brush') ? 'crosshair'
                    : activeTool === 'none' ? 'default' : 'default',
                  pointerEvents: (activeTool === 'pen' || activeTool === 'brush' || activeTool === 'eraser') ? 'auto' : 'none',
                }}
                onPointerDown={startPopupDrawing}
                onPointerMove={movePopupDrawing}
                onPointerUp={stopPopupDrawing}
                onPointerCancel={stopPopupDrawing}
                onPointerLeave={stopPopupDrawing}
              />
            </div>{/* end section+overlay wrapper */}
            {/* ── Right navigation bar ── */}
            <div className="flex-shrink-0 flex flex-col items-center justify-start border-l-2 border-purple-100 bg-white px-2 py-3 gap-1">
              {([
                { id: 'image',    icon: ImageIcon, label: 'Image'    },
                { id: 'audio',    icon: Volume2,   label: 'Audio'    },
                { id: 'info',     icon: Info,      label: 'Info'     },
                { id: 'glossary', icon: FileText,  label: 'Glossary' },
              ] as { id: 'image' | 'audio' | 'info' | 'glossary'; icon: React.ComponentType<{ className?: string }>; label: string }[]).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id !== 'audio' && conceptAudioRef.current) {
                      conceptAudioRef.current.pause();
                      conceptAudioRef.current = null;
                      setConceptIsPlaying(false);
                    }
                    if (id === 'audio') {
                      conceptVideoAutoPlayRef.current = true;
                    }
                    setConceptSection(id);
                  }}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all w-full ${
                    conceptSection === id
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                </button>
              ))}
            </div>
            </div> {/* end body row */}

            {/* Resize handles — 8-point (4 corners + 4 edges) */}
            {([
              { edge: 'nw', style: { top: -5,   left: -5,             cursor: 'nw-resize' } },
              { edge: 'n',  style: { top: -5,   left: 'calc(50% - 5px)', cursor: 'n-resize'  } },
              { edge: 'ne', style: { top: -5,   right: -5,            cursor: 'ne-resize' } },
              { edge: 'w',  style: { top: 'calc(50% - 5px)', left: -5, cursor: 'w-resize'  } },
              { edge: 'e',  style: { top: 'calc(50% - 5px)', right: -5, cursor: 'e-resize' } },
              { edge: 'sw', style: { bottom: -5, left: -5,            cursor: 'sw-resize' } },
              { edge: 's',  style: { bottom: -5, left: 'calc(50% - 5px)', cursor: 's-resize' } },
              { edge: 'se', style: { bottom: -5, right: -5,           cursor: 'se-resize' } },
            ] as { edge: string; style: React.CSSProperties }[]).map(({ edge, style }) => (
              <div
                key={edge}
                style={{
                  position: 'absolute',
                  width: 10, height: 10,
                  background: 'white',
                  border: '2px solid #a855f7',
                  borderRadius: 3,
                  zIndex: 10,
                  touchAction: 'none',
                  ...style,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  conceptResizeRef.current = {
                    edge,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: conceptPopupPos.x,
                    origY: conceptPopupPos.y,
                    origW: conceptPopupSize.w,
                    origH: conceptPopupSize.h,
                  };
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const r = conceptResizeRef.current;
                  if (!r) return;
                  const dx = e.clientX - r.startX;
                  const dy = e.clientY - r.startY;
                  const MIN_W = 280; const MIN_H = 200;
                  let x = r.origX, y = r.origY, w = r.origW, h = r.origH;
                  if (r.edge.includes('e')) w = Math.max(MIN_W, w + dx);
                  if (r.edge.includes('s')) h = Math.max(MIN_H, h + dy);
                  if (r.edge.includes('w')) { const nw = Math.max(MIN_W, w - dx); x += w - nw; w = nw; }
                  if (r.edge.includes('n')) { const nh = Math.max(MIN_H, h - dy); y += h - nh; h = nh; }
                  setConceptPopupPos({ x, y });
                  setConceptPopupSize({ w, h });
                }}
                onPointerUp={() => { conceptResizeRef.current = null; }}
                onPointerCancel={() => { conceptResizeRef.current = null; }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Flash Cards Popup — Short Questions */}
      {showFlashcardsPopup && flashcardsPopupPos && flashcardsPopupSize && (
        <div
          className="fixed inset-0 z-[520]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
          onClick={() => setShowFlashcardsPopup(false)}
        >
          <div
            className="absolute bg-white shadow-2xl flex flex-col"
            style={{
              left: flashcardsPopupPos.x,
              top: flashcardsPopupPos.y,
              width: flashcardsPopupSize.w,
              height: flashcardsPopupSize.h,
              borderRadius: 20,
              border: '2.5px solid #0d9488',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — drag handle */}
            <div
              className="bg-teal-600 px-5 py-3 flex items-center justify-between flex-shrink-0 select-none"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                flashcardsDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: flashcardsPopupPos.x,
                  origY: flashcardsPopupPos.y,
                };
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing';
              }}
              onPointerMove={(e) => {
                const d = flashcardsDragRef.current;
                if (!d) return;
                const newX = Math.max(0, Math.min(window.innerWidth - flashcardsPopupSize.w, d.origX + (e.clientX - d.startX)));
                const newY = Math.max(0, Math.min(window.innerHeight - flashcardsPopupSize.h, d.origY + (e.clientY - d.startY)));
                setFlashcardsPopupPos({ x: newX, y: newY });
              }}
              onPointerUp={(e) => {
                flashcardsDragRef.current = null;
                (e.currentTarget as HTMLDivElement).style.cursor = 'grab';
              }}
              onPointerCancel={() => { flashcardsDragRef.current = null; }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <BookOpen className="w-4 h-4 text-white/80" />
                <span className="text-white font-black uppercase tracking-widest text-sm">Short Questions</span>
                <span className="text-white/40 text-[10px] font-normal ml-1">drag to move</span>
              </div>
              <button
                onClick={() => setShowFlashcardsPopup(false)}
                className="text-white/70 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* iframe body */}
            <iframe
              src="/FlashCards/quiz.html"
              className="flex-1 min-h-0 w-full border-none"
              title="Short Questions Flash Cards"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* MCQs Popup */}
      {showMcqsPopup && mcqsPopupPos && mcqsPopupSize && (
        <div
          className="fixed inset-0 z-[520]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
          onClick={() => setShowMcqsPopup(false)}
        >
          <div
            className="absolute bg-white shadow-2xl flex flex-col"
            style={{
              left: mcqsPopupPos.x,
              top: mcqsPopupPos.y,
              width: mcqsPopupSize.w,
              height: mcqsPopupSize.h,
              borderRadius: 20,
              border: '2.5px solid #7c3aed',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — drag handle */}
            <div
              className="bg-violet-600 px-5 py-3 flex items-center justify-between flex-shrink-0 select-none"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                mcqsDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: mcqsPopupPos.x,
                  origY: mcqsPopupPos.y,
                };
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing';
              }}
              onPointerMove={(e) => {
                const d = mcqsDragRef.current;
                if (!d) return;
                const newX = Math.max(0, Math.min(window.innerWidth - mcqsPopupSize.w, d.origX + (e.clientX - d.startX)));
                const newY = Math.max(0, Math.min(window.innerHeight - mcqsPopupSize.h, d.origY + (e.clientY - d.startY)));
                setMcqsPopupPos({ x: newX, y: newY });
              }}
              onPointerUp={(e) => {
                mcqsDragRef.current = null;
                (e.currentTarget as HTMLDivElement).style.cursor = 'grab';
              }}
              onPointerCancel={() => { mcqsDragRef.current = null; }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <List className="w-4 h-4 text-white/80" />
                <span className="text-white font-black uppercase tracking-widest text-sm">MCQs</span>
                <span className="text-white/40 text-[10px] font-normal ml-1">drag to move</span>
              </div>
              <button
                onClick={() => setShowMcqsPopup(false)}
                className="text-white/70 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* iframe body */}
            <iframe
              src="/MCQc/mcq.html"
              className="flex-1 min-h-0 w-full border-none"
              title="MCQ Quiz"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Mind Map Popup */}
      {showMindmapPopup && mindmapPopupPos && mindmapPopupSize && (
        <div
          className="fixed inset-0 z-[520]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
          onClick={() => setShowMindmapPopup(false)}
        >
          <div
            className="absolute bg-white shadow-2xl flex flex-col"
            style={{
              left: mindmapPopupPos.x,
              top: mindmapPopupPos.y,
              width: mindmapPopupSize.w,
              height: mindmapPopupSize.h,
              borderRadius: 20,
              border: '2.5px solid #4f46e5',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — drag handle */}
            <div
              className="bg-indigo-600 px-5 py-3 flex items-center justify-between flex-shrink-0 select-none"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                mindmapDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: mindmapPopupPos.x,
                  origY: mindmapPopupPos.y,
                };
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing';
              }}
              onPointerMove={(e) => {
                const d = mindmapDragRef.current;
                if (!d) return;
                const newX = Math.max(0, Math.min(window.innerWidth - mindmapPopupSize.w, d.origX + (e.clientX - d.startX)));
                const newY = Math.max(0, Math.min(window.innerHeight - mindmapPopupSize.h, d.origY + (e.clientY - d.startY)));
                setMindmapPopupPos({ x: newX, y: newY });
              }}
              onPointerUp={(e) => {
                mindmapDragRef.current = null;
                (e.currentTarget as HTMLDivElement).style.cursor = 'grab';
              }}
              onPointerCancel={() => { mindmapDragRef.current = null; }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Network className="w-4 h-4 text-white/80" />
                <span className="text-white font-black uppercase tracking-widest text-sm">Mind Map</span>
                <span className="text-white/40 text-[10px] font-normal ml-1">drag to move</span>
              </div>
              <button
                onClick={() => setShowMindmapPopup(false)}
                className="text-white/70 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* iframe body */}
            <iframe
              src="/MindMap/mindmap.html"
              className="flex-1 min-h-0 w-full border-none"
              title="Mind Map"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Infographic Popup */}
      {showInfographicPopup && infographicPopupPos && infographicPopupSize && (() => {
        const images = [
          '/infographics/infographic 1.png',
          '/infographics/final infographic.jpg',
        ];
        const total = images.length;
        const idx = Math.max(0, Math.min(infographicIndex, total - 1));
        return (
          <div
            className="fixed inset-0 z-[520]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
            onClick={() => setShowInfographicPopup(false)}
          >
            <div
              className="absolute bg-white shadow-2xl flex flex-col"
              style={{
                left: infographicPopupPos.x,
                top: infographicPopupPos.y,
                width: infographicPopupSize.w,
                height: infographicPopupSize.h,
                borderRadius: 20,
                border: '2.5px solid #f59e0b',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header — drag handle */}
              <div
                className="bg-amber-500 px-5 py-3 flex items-center justify-between flex-shrink-0 select-none"
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  infographicDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: infographicPopupPos.x,
                    origY: infographicPopupPos.y,
                  };
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing';
                }}
                onPointerMove={(e) => {
                  const d = infographicDragRef.current;
                  if (!d) return;
                  const newX = Math.max(0, Math.min(window.innerWidth - infographicPopupSize.w, d.origX + (e.clientX - d.startX)));
                  const newY = Math.max(0, Math.min(window.innerHeight - infographicPopupSize.h, d.origY + (e.clientY - d.startY)));
                  setInfographicPopupPos({ x: newX, y: newY });
                }}
                onPointerUp={(e) => {
                  infographicDragRef.current = null;
                  (e.currentTarget as HTMLDivElement).style.cursor = 'grab';
                }}
                onPointerCancel={() => { infographicDragRef.current = null; }}
              >
                <div className="flex items-center gap-2 pointer-events-none">
                  <Images className="w-4 h-4 text-white/80" />
                  <span className="text-white font-black uppercase tracking-widest text-sm">Infographic</span>
                  <span className="text-white/50 text-[10px] font-normal ml-1">{idx + 1} / {total}</span>
                  <span className="text-white/40 text-[10px] font-normal ml-1">drag to move</span>
                </div>
                <button
                  onClick={() => setShowInfographicPopup(false)}
                  className="text-white/70 hover:text-white transition-colors pointer-events-auto"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Image area */}
              <div
                className="flex-1 min-h-0 relative bg-gray-100 overflow-hidden"
                style={{ cursor: infographicPanRef.current ? 'grabbing' : 'grab' }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  infographicPanRef.current = { startX: e.clientX, startY: e.clientY, origX: infographicImgOffset.x, origY: infographicImgOffset.y };
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const p = infographicPanRef.current;
                  if (!p) return;
                  setInfographicImgOffset({ x: p.origX + (e.clientX - p.startX), y: p.origY + (e.clientY - p.startY) });
                }}
                onPointerUp={() => { infographicPanRef.current = null; }}
                onPointerCancel={() => { infographicPanRef.current = null; }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: `translate(${infographicImgOffset.x}px, ${infographicImgOffset.y}px)` }}
                >
                  <img
                    key={idx}
                    src={images[idx]}
                    alt={`Infographic ${idx + 1}`}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                    onLoad={() => setInfographicImgOffset({ x: 0, y: 0 })}
                  />
                </div>
                {/* Prev + Next + Reset buttons — stacked on the left */}
                {total > 1 && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                    <button
                      onClick={() => { setInfographicIndex(i => (i - 1 + total) % total); setInfographicImgOffset({ x: 0, y: 0 }); }}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                      title="Previous"
                    ><ChevronLeft className="w-4 h-4" /></button>
                    <button
                      onClick={() => setInfographicImgOffset({ x: 0, y: 0 })}
                      className="w-7 h-7 rounded-full bg-black/40 hover:bg-amber-500 text-white flex items-center justify-center transition-all"
                      title="Reset position"
                    ><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
                    <button
                      onClick={() => { setInfographicIndex(i => (i + 1) % total); setInfographicImgOffset({ x: 0, y: 0 }); }}
                      disabled={idx === total - 1}
                      className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                      title="Next"
                    ><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
                {/* Prev + Next + Reset buttons — stacked on the right */}
                {total > 1 && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                    <button
                      onClick={() => { setInfographicIndex(i => (i - 1 + total) % total); setInfographicImgOffset({ x: 0, y: 0 }); }}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                      title="Previous"
                    ><ChevronLeft className="w-4 h-4" /></button>
                    <button
                      onClick={() => setInfographicImgOffset({ x: 0, y: 0 })}
                      className="w-7 h-7 rounded-full bg-black/40 hover:bg-amber-500 text-white flex items-center justify-center transition-all"
                      title="Reset position"
                    ><svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
                    <button
                      onClick={() => { setInfographicIndex(i => (i + 1) % total); setInfographicImgOffset({ x: 0, y: 0 }); }}
                      disabled={idx === total - 1}
                      className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                      title="Next"
                    ><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Video Overview Popup */}
      {showVideoPopup && videoPopupPos && videoPopupSize && (
        <div
          className="fixed inset-0 z-[520]"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }}
          onClick={() => setShowVideoPopup(false)}
        >
          <div
            className="absolute bg-black shadow-2xl flex flex-col"
            style={{
              left: videoPopupPos.x,
              top: videoPopupPos.y,
              width: videoPopupSize.w,
              height: videoPopupSize.h,
              borderRadius: 20,
              border: '2.5px solid #e11d48',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — drag handle */}
            <div
              className="bg-rose-600 px-5 py-3 flex items-center justify-between flex-shrink-0 select-none"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                videoDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: videoPopupPos.x,
                  origY: videoPopupPos.y,
                };
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing';
              }}
              onPointerMove={(e) => {
                const d = videoDragRef.current;
                if (!d) return;
                const newX = Math.max(0, Math.min(window.innerWidth - videoPopupSize.w, d.origX + (e.clientX - d.startX)));
                const newY = Math.max(0, Math.min(window.innerHeight - videoPopupSize.h, d.origY + (e.clientY - d.startY)));
                setVideoPopupPos({ x: newX, y: newY });
              }}
              onPointerUp={(e) => {
                videoDragRef.current = null;
                (e.currentTarget as HTMLDivElement).style.cursor = 'grab';
              }}
              onPointerCancel={() => { videoDragRef.current = null; }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Play className="w-4 h-4 text-white/80" />
                <span className="text-white font-black uppercase tracking-widest text-sm">Video Overview</span>
                <span className="text-white/40 text-[10px] font-normal ml-1">drag to move</span>
              </div>
              <button
                onClick={() => {
                  setShowVideoPopup(false);
                  setVideoPlaying(false);
                  setVideoCurrentTime(0);
                  setVideoDuration(0);
                  setVideoEnded(false);
                  setVideoSpeed(1);
                  if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
                }}
                className="text-white/70 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Video body */}
            <div className="flex-1 min-h-0 flex flex-col bg-black overflow-hidden">
              {/* Video area */}
              <div className="flex-1 min-h-0 relative bg-black">
                <video
                  key={showVideoPopup ? 'open' : 'closed'}
                  ref={videoRef}
                  src="/Video Overview/atomic model.webm"
                  disablePictureInPicture
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  onLoadedMetadata={() => setVideoDuration(videoRef.current?.duration ?? 0)}
                  onCanPlay={() => { if (videoRef.current) videoRef.current.play(); }}
                  onTimeUpdate={() => setVideoCurrentTime(videoRef.current?.currentTime ?? 0)}
                  onPlay={() => { setVideoPlaying(true); setVideoEnded(false); }}
                  onPause={() => setVideoPlaying(false)}
                  onEnded={() => { setVideoPlaying(false); setVideoEnded(true); }}
                  onClick={() => {
                    if (!videoRef.current) return;
                    if (videoPlaying) videoRef.current.pause();
                    else { videoRef.current.play(); setVideoEnded(false); }
                  }}
                />
                {videoEnded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <button
                      onClick={() => { if (!videoRef.current) return; videoRef.current.currentTime = 0; videoRef.current.play(); setVideoEnded(false); }}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-white flex items-center justify-center group-hover:bg-white/35 transition-all">
                        <Play className="w-7 h-7 text-white ml-1" />
                      </div>
                      <span className="text-white text-xs font-bold tracking-widest uppercase">Replay</span>
                    </button>
                  </div>
                )}
              </div>
              {/* Always-visible controls bar */}
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-900">
                <button
                  onClick={() => { if (!videoRef.current) return; if (videoPlaying) videoRef.current.pause(); else { videoRef.current.play(); setVideoEnded(false); } }}
                  className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/30 text-white transition-all"
                  title={videoPlaying ? 'Pause' : 'Play'}
                >{videoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}</button>
                <input
                  type="range" min={0} max={videoDuration || 100} step={0.5} value={videoCurrentTime}
                  onChange={e => { const t = parseFloat(e.target.value); if (videoRef.current) videoRef.current.currentTime = t; setVideoCurrentTime(t); }}
                  className="flex-1 h-1.5 cursor-pointer"
                  style={{ accentColor: '#fb7185' }}
                />
                <span className="flex-shrink-0 text-[10px] text-white/70 font-semibold tabular-nums whitespace-nowrap">
                  {Math.floor(videoCurrentTime/60)}:{String(Math.floor(videoCurrentTime%60)).padStart(2,'0')} / {Math.floor(videoDuration/60)}:{String(Math.floor(videoDuration%60)).padStart(2,'0')}
                </span>
                <button
                  onClick={() => { const speeds=[0.5,0.75,1,1.25,1.5,2]; const next=speeds[(speeds.indexOf(videoSpeed)+1)%speeds.length]; setVideoSpeed(next); if(videoRef.current) videoRef.current.playbackRate=next; }}
                  className={`flex-shrink-0 h-6 px-2 rounded text-[10px] font-bold tabular-nums transition-all ${videoSpeed!==1?'bg-rose-500 text-white':'bg-white/15 text-white/80 hover:bg-white/30'}`}
                  title="Playback speed"
                >{videoSpeed===1?'1x':`${videoSpeed}x`}</button>
                <button
                  onClick={() => videoRef.current?.requestFullscreen()}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:bg-white/20 transition-all"
                  title="Fullscreen"
                ><Maximize className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Spotlight overlay — portaled above popup (z-[550]+) ── */}
      {spotlightRect && createPortal(
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 550,
            left: spotlightRect.x, top: spotlightRect.y,
            width: spotlightRect.w, height: spotlightRect.h,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.82), 0 0 60px 40px rgba(0,0,0,0.7), 0 0 120px 80px rgba(0,0,0,0.45)',
            borderRadius: 8,
          }}
        />,
        document.body
      )}
      {activeTool === 'spotlight' && spotlightRect && createPortal((() => {
        const r = spotlightRect;
        const H = 13; const hh = H / 2;
        const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
        const onBoxDown = (e: React.PointerEvent<HTMLDivElement>) => {
          if (spotlightResizingRef.current) return;
          e.stopPropagation();
          spotlightMoveRef.current = { offsetX: e.clientX - r.x, offsetY: e.clientY - r.y };
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        };
        const onBoxMove = (e: React.PointerEvent<HTMLDivElement>) => {
          const mv = spotlightMoveRef.current;
          if (!mv || spotlightResizingRef.current) return;
          setSpotlightRect(prev => prev ? { ...prev, x: e.clientX - mv.offsetX, y: e.clientY - mv.offsetY } : prev);
        };
        const onBoxUp = () => { spotlightMoveRef.current = null; };
        const handles: { id: string; left: number; top: number; cursor: string }[] = [
          { id: 'nw', left: r.x - hh,       top: r.y - hh,       cursor: 'nw-resize' },
          { id: 'n',  left: cx - hh,        top: r.y - hh,       cursor: 'n-resize'  },
          { id: 'ne', left: r.x + r.w - hh, top: r.y - hh,       cursor: 'ne-resize' },
          { id: 'w',  left: r.x - hh,       top: cy - hh,        cursor: 'w-resize'  },
          { id: 'e',  left: r.x + r.w - hh, top: cy - hh,        cursor: 'e-resize'  },
          { id: 'sw', left: r.x - hh,       top: r.y + r.h - hh, cursor: 'sw-resize' },
          { id: 's',  left: cx - hh,        top: r.y + r.h - hh, cursor: 's-resize'  },
          { id: 'se', left: r.x + r.w - hh, top: r.y + r.h - hh, cursor: 'se-resize' },
        ];
        return (
          <>
            <div className="fixed" style={{ zIndex: 551, left: r.x, top: r.y, width: r.w, height: r.h, cursor: 'move', touchAction: 'none' }}
              onPointerDown={onBoxDown} onPointerMove={onBoxMove} onPointerUp={onBoxUp} onPointerCancel={onBoxUp} />
            {handles.map((h) => (
              <div key={h.id} className="fixed"
                style={{ zIndex: 552, left: h.left, top: h.top, width: H, height: H, background: 'white',
                  border: '2px solid rgba(255,220,50,0.95)', borderRadius: 3, cursor: h.cursor,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)', touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSpotlightHintDismissed(true);
                  spotlightResizingRef.current = { handle: h.id, startRect: { ...r }, startX: e.clientX, startY: e.clientY };
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const res = spotlightResizingRef.current;
                  if (!res) return;
                  const dx = e.clientX - res.startX; const dy = e.clientY - res.startY;
                  let { x, y, w, h: rh } = res.startRect;
                  if (res.handle.includes('e')) w  = Math.max(40, w + dx);
                  if (res.handle.includes('s')) rh = Math.max(40, rh + dy);
                  if (res.handle.includes('w')) { x += dx; w  = Math.max(40, w - dx); }
                  if (res.handle.includes('n')) { y += dy; rh = Math.max(40, rh - dy); }
                  setSpotlightRect({ x, y, w, h: rh });
                }}
                onPointerUp={() => { spotlightResizingRef.current = null; }}
                onPointerCancel={() => { spotlightResizingRef.current = null; }}
              />
            ))}
          </>
        );
      })(), document.body)}

      {/* ── Zoom capture overlay — sits above popup during rubber-band selection ── */}
      {zoomSelectMode && createPortal(
        <div
          className="fixed inset-0"
          style={{ zIndex: 549, cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-toolbar]')) return;
            setZoomHintDismissed(true);
            zoomSelectStartRef.current = { x: e.clientX, y: e.clientY };
            setZoomRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!zoomSelectStartRef.current) return;
            const sx = zoomSelectStartRef.current.x;
            const sy = zoomSelectStartRef.current.y;
            const x = Math.min(sx, e.clientX);
            const y = Math.min(sy, e.clientY);
            const w = Math.abs(e.clientX - sx);
            const h = Math.abs(e.clientY - sy);
            setZoomRect({ x, y, w, h });
          }}
          onPointerUp={(e) => {
            const start = zoomSelectStartRef.current;
            if (!start) return;
            zoomSelectStartRef.current = null;
            setZoomSelectMode(false);
            const dragDist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
            if (dragDist < 10) {
              const bw = Math.round(window.innerWidth * 0.25);
              const bh = Math.round(window.innerHeight * 0.2);
              setZoomRect({ x: Math.round(e.clientX - bw / 2), y: Math.round(e.clientY - bh / 2), w: bw, h: bh });
            }
          }}
          onPointerCancel={() => { zoomSelectStartRef.current = null; setZoomSelectMode(false); }}
        />,
        document.body
      )}

      {/* ── Zoom rubber-band rect — portaled above popup ── */}
      {zoomSelectMode && zoomRect && zoomRect.w > 4 && zoomRect.h > 4 && createPortal(
        <div className="fixed pointer-events-none"
          style={{ zIndex: 550, left: zoomRect.x, top: zoomRect.y, width: zoomRect.w, height: zoomRect.h,
            border: '2px dashed #3b82f6', background: 'rgba(59,130,246,0.10)', boxSizing: 'border-box' }}
        />,
        document.body
      )}

      {/* ── Zoom adjust box — portaled above popup ── */}
      {!zoomSelectMode && !zoomTransform && zoomRect && zoomRect.w > 20 && zoomRect.h > 20 && createPortal((() => {
        const r = zoomRect;
        const H = 13; const hh = H / 2;
        const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
        const onBoxUp = () => { zoomMoveRef.current = null; };
        const handles: { id: string; left: number; top: number; cursor: string }[] = [
          { id: 'nw', left: r.x - hh,       top: r.y - hh,       cursor: 'nw-resize' },
          { id: 'n',  left: cx - hh,        top: r.y - hh,       cursor: 'n-resize'  },
          { id: 'ne', left: r.x + r.w - hh, top: r.y - hh,       cursor: 'ne-resize' },
          { id: 'w',  left: r.x - hh,       top: cy - hh,        cursor: 'w-resize'  },
          { id: 'e',  left: r.x + r.w - hh, top: cy - hh,        cursor: 'e-resize'  },
          { id: 'sw', left: r.x - hh,       top: r.y + r.h - hh, cursor: 'sw-resize' },
          { id: 's',  left: cx - hh,        top: r.y + r.h - hh, cursor: 's-resize'  },
          { id: 'se', left: r.x + r.w - hh, top: r.y + r.h - hh, cursor: 'se-resize' },
        ];
        const sc = Math.max(0.45, Math.min(r.w / 320, r.h / 180, 1));
        const btnFs = Math.round(10 * sc); const iconSz = Math.round(13 * sc);
        const btnPx = Math.round(14 * sc); const btnPy = Math.round(7 * sc);
        const cancelPx = Math.round(11 * sc); const pill = Math.round(14 * sc);
        const pillPx = Math.round(14 * sc); const pillPy = Math.round(5 * sc);
        const gap = Math.round(8 * sc); const btnGap = Math.round(9 * sc);
        const showHint = r.w >= 180 && r.h >= 90;
        return (
          <>
            {/* Border outline */}
            <div className="fixed pointer-events-none"
              style={{ zIndex: 550, left: r.x, top: r.y, width: r.w, height: r.h,
                border: '2.5px solid #3b82f6', borderRadius: 4, boxSizing: 'border-box' }} />
            {/* Hint + zoom/cancel buttons */}
            <div data-toolbar className="fixed flex flex-col items-center"
              style={{ zIndex: 552, left: cx, top: r.y + Math.round(10 * sc), transform: 'translateX(-50%)', pointerEvents: 'auto', gap }}
            >
              {showHint && (
                <div style={{ color: '#e2e8f0', fontSize: Math.round(12 * sc), fontWeight: 900,
                  letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(15,23,42,0.85)',
                  borderRadius: pill, padding: `${pillPy}px ${pillPx}px`,
                  border: '1.5px solid rgba(59,130,246,0.45)', backdropFilter: 'blur(6px)',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: Math.round(7 * sc) }}>
                  <ZoomIn style={{ width: iconSz, height: iconSz, color: '#60a5fa', flexShrink: 0 }} />
                  Resize or drag to adjust, then tap Zoom
                </div>
              )}
              <div className="flex items-center" style={{ gap: btnGap }}>
                <button data-toolbar
                  onClick={() => {
                    if (!zoomRect) return;
                    const W = window.innerWidth; const vH = window.innerHeight;
                    const s = Math.min(W / zoomRect.w, vH / zoomRect.h);
                    const cx2 = zoomRect.x + zoomRect.w / 2; const cy2 = zoomRect.y + zoomRect.h / 2;
                    setZoomTransform({ s, tx: (W / 2 - cx2) * s, ty: (vH / 2 - cy2) * s });
                    setZoomRect(null); setActiveTool('none');
                  }}
                  style={{ fontSize: btnFs, padding: `${btnPy}px ${btnPx}px`, gap: Math.round(5 * sc), borderRadius: 9999 }}
                  className="flex items-center bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all border-2 border-blue-500"
                ><ZoomIn style={{ width: iconSz, height: iconSz }} /> Zoom</button>
                <button data-toolbar
                  onClick={() => { setZoomRect(null); setActiveTool('none'); }}
                  style={{ fontSize: Math.round(9 * sc), padding: `${btnPy}px ${cancelPx}px`, borderRadius: 9999,
                    background: 'rgba(30,41,59,0.75)', backdropFilter: 'blur(6px)' }}
                  className="flex items-center text-white/80 font-bold uppercase tracking-widest hover:text-white transition-all border border-slate-500 hover:border-slate-300"
                >Cancel</button>
              </div>
            </div>
            {/* Resize handles */}
            {handles.map((h) => (
              <div key={h.id} className="fixed"
                style={{ zIndex: 552, left: h.left, top: h.top, width: H, height: H,
                  background: 'white', border: '2px solid #3b82f6', borderRadius: 3,
                  cursor: h.cursor, boxShadow: '0 1px 4px rgba(0,0,0,0.4)', touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  zoomResizingRef.current = { handle: h.id, startRect: { ...r }, startX: e.clientX, startY: e.clientY };
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const res = zoomResizingRef.current;
                  if (!res) return;
                  const dx = e.clientX - res.startX; const dy = e.clientY - res.startY;
                  let { x, y, w, h: rh } = res.startRect;
                  if (res.handle.includes('e')) w  = Math.max(40, w + dx);
                  if (res.handle.includes('s')) rh = Math.max(40, rh + dy);
                  if (res.handle.includes('w')) { x += dx; w  = Math.max(40, w - dx); }
                  if (res.handle.includes('n')) { y += dy; rh = Math.max(40, rh - dy); }
                  setZoomRect({ x, y, w, h: rh });
                }}
                onPointerUp={onBoxUp} onPointerCancel={onBoxUp}
              />
            ))}
          </>
        );
      })(), document.body)}

      {/* Exit Spotlight button — portal to body */}
      {spotlightRect && createPortal(
        <button
          data-toolbar
          onClick={() => { setSpotlightRect(null); setActiveTool('none'); }}
          className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/90 text-white text-[11px] font-black uppercase tracking-widest shadow-2xl border-2 border-slate-600 hover:bg-slate-700 active:scale-95 transition-all backdrop-blur"
        >
          <Spotlight className="w-4 h-4 opacity-70" /> Exit Spotlight
        </button>,
        document.body
      )}

      {/* Touch spark effect for hand tool */}
      {ripples.map(r => (
        <div key={r.id} className="pointer-events-none">
          {/* Center flash glow */}
          <div className="fixed z-[9997]" style={{
            left: r.x, top: r.y,
            width: 20, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,245,130,1) 0%, rgba(255,180,30,0.9) 50%, transparent 100%)',
            boxShadow: '0 0 14px 5px rgba(255,200,40,0.6)',
            animation: 'hand-flash 0.4s ease-out forwards',
          }} />
          {/* Shockwave ring */}
          <div className="fixed z-[9997]" style={{
            left: r.x, top: r.y,
            width: 44, height: 44,
            borderRadius: '50%',
            border: '2px solid rgba(255,190,40,0.85)',
            animation: 'hand-shockwave 0.38s cubic-bezier(0.1,0.6,0.2,1) forwards',
          }} />
          {/* 8 sparks radiating outward */}
          {([0, 45, 90, 135, 180, 225, 270, 315] as number[]).map(angle => (
            <div key={angle} className="fixed z-[9997]" style={{
              left: r.x, top: r.y,
              width: 1, height: 1,
              overflow: 'visible',
              transform: `rotate(${angle}deg)`,
            }}>
              <div style={{
                position: 'absolute',
                top: -1.5, left: 0,
                height: 3,
                borderRadius: 2,
                background: angle % 90 === 0
                  ? 'linear-gradient(to right, rgba(255,230,60,1), rgba(255,140,20,0))'
                  : 'linear-gradient(to right, rgba(255,200,80,0.9), rgba(255,120,20,0))',
                animation: 'hand-spark 0.52s ease-out forwards',
              }} />
            </div>
          ))}
        </div>
      ))}

      {/* Fake hand cursor — rendered outside <main> so transforms/overflow never clip it */}
      {createPortal(
        <div
          ref={fakeCursorRef}
          className="pointer-events-none"
          style={{
            display: 'none',
            position: 'fixed',
            left: -200,
            top: -200,
            zIndex: 99999,
            transform: 'translate(-3px, -3px)', // hotspot: fingertip near top-left of image
            willChange: 'left, top',
          }}
        >
          <img src="./hand_cursor.png" style={{ width: 64, height: 64, display: 'block' }} />
        </div>,
        document.body
      )}

      {/* Spotlight hint — portal so it sits outside transformed <main> */}
      {activeTool === 'spotlight' && spotlightRect !== null && !spotlightHintDismissed && createPortal(
        <div
          className="fixed left-1/2 pointer-events-none"
          style={{
            top: 'min(4vmin, 32px)',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            background: 'rgba(15,23,42,0.82)',
            backdropFilter: 'blur(8px)',
            borderRadius: 'min(3vmin, 24px)',
            padding: 'min(1.5vmin, 12px) min(3.5vmin, 28px)',
            border: '2px solid rgba(245,158,11,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'min(1.5vmin, 10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          <Spotlight style={{ width: 'min(2.4vmin, 18px)', height: 'min(2.4vmin, 18px)', color: '#fbbf24', flexShrink: 0 }} />
          <span style={{ color: '#e2e8f0', fontSize: 'min(1.8vmin, 13px)', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Drag the border handles to resize the spotlight area
          </span>
        </div>,
        document.body
      )}

      {/* Zoom hint — portal so it sits outside transformed <main> */}
      {activeTool === 'zoom' && zoomSelectMode && !zoomHintDismissed && createPortal(
        <div
          className="fixed left-1/2 pointer-events-none"
          style={{
            top: 'min(4vmin, 32px)',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            background: 'rgba(15,23,42,0.82)',
            backdropFilter: 'blur(8px)',
            borderRadius: 'min(3vmin, 24px)',
            padding: 'min(1.5vmin, 12px) min(3.5vmin, 28px)',
            border: '2px solid rgba(139,92,246,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'min(1.5vmin, 10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          <ZoomIn style={{ width: 'min(2.4vmin, 18px)', height: 'min(2.4vmin, 18px)', color: '#a78bfa', flexShrink: 0 }} />
          <span style={{ color: '#e2e8f0', fontSize: 'min(1.8vmin, 13px)', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Drag to select the area you want to zoom
          </span>
        </div>,
        document.body
      )}

      {/* Eraser cursor — portal to body so fixed pos is not affected by <main>'s CSS transform */}
      {activeTool === 'eraser' && mousePos && createPortal(
        <div
          className="pointer-events-none border-2 border-slate-400 rounded-full bg-white/30 shadow-sm"
          style={{
            position: 'fixed',
            left: mousePos.x,
            top: mousePos.y,
            width: eraserSize * (zoomTransform?.s ?? 1),
            height: eraserSize * (zoomTransform?.s ?? 1),
            transform: 'translate(-50%, -50%)',
            zIndex: 99999,
          }}
        />,
        document.body
      )}

      {/* Exit Zoom button — portal to body so it's outside the transformed <main> */}
      {zoomTransform && createPortal(
        <button
          data-toolbar
          onClick={() => { setZoomTransform(null); setZoomSelectMode(false); setZoomRect(null); setActiveTool('none'); }}
          className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/90 text-white text-[11px] font-black uppercase tracking-widest shadow-2xl border-2 border-slate-600 hover:bg-slate-700 active:scale-95 transition-all backdrop-blur"
        >
          <ZoomIn className="w-4 h-4 rotate-180" /> Exit Zoom
        </button>,
        document.body
      )}
    </>
  );
}
