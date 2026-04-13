import { useCallback } from 'react';
import Flipbook from './Flipbook';

// Import book pages
import page1 from '../book_pages/1.png';
import page2 from '../book_pages/2.png';
import page3 from '../book_pages/3.png';
import page4 from '../book_pages/4.png';
import page5 from '../book_pages/5.png';

export default function AppFlipbook() {
  const pageImages = [page1, page2, page3, page4, page5];

  const navigateCaptivateSlide = useCallback((direction: 'next' | 'previous') => {
    const targets: any[] = [];
    if (typeof window !== 'undefined') {
      targets.push(window);
      try {
        if (window.parent && window.parent !== window) targets.push(window.parent);
      } catch {
        // Ignore cross-origin parent access errors.
      }
      try {
        if (window.top && window.top !== window.parent) targets.push(window.top);
      } catch {
        // Ignore cross-origin top access errors.
      }
    }

    const commandName = direction === 'next' ? 'cpCmndNextSlide' : 'cpCmndPreviousSlide';
    const gotoDelta = direction === 'next' ? 1 : -1;

    const tryCall = (owner: any, fn: unknown) => {
      if (typeof fn === 'function') {
        fn.call(owner);
        return true;
      }
      return false;
    };

    for (const target of targets) {
      try {
        const cp = target?.cpAPIInterface;
        if (cp && typeof cp === 'object') {
          if (direction === 'next' && (tryCall(cp, cp.next) || tryCall(cp, cp.Next))) return;
          if (direction === 'previous' && (tryCall(cp, cp.previous) || tryCall(cp, cp.prev) || tryCall(cp, cp.Previous))) return;

          if (typeof cp.getVariableValue === 'function' && typeof cp.setVariableValue === 'function') {
            const current = Number(cp.getVariableValue('cpInfoCurrentSlide'));
            if (!Number.isNaN(current)) {
              cp.setVariableValue('cpCmndGotoSlide', current + gotoDelta);
              return;
            }

            cp.setVariableValue(commandName, 1);
          }
        }

        if (typeof target?.cpAPISetVariableValue === 'function') {
          target.cpAPISetVariableValue(commandName, 1);
          return;
        }

        const movie = target?.cp?.movie;
        if (movie && typeof movie === 'object') {
          if (direction === 'next' && (tryCall(movie, movie.jumpToNextSlide) || tryCall(movie, movie.next) || tryCall(movie, movie.nextSlide))) return;
          if (direction === 'previous' && (tryCall(movie, movie.jumpToPreviousSlide) || tryCall(movie, movie.previous) || tryCall(movie, movie.prev) || tryCall(movie, movie.previousSlide))) return;
        }

        if (commandName in target) {
          target[commandName] = 1;
          return;
        }
      } catch {
        // Try next target.
      }
    }

    console.warn(`Captivate slide API not found for ${direction} navigation.`);
  }, []);

  return (
    <Flipbook
      pageImages={pageImages}
      onNext={() => navigateCaptivateSlide('next')}
      onPrevious={() => navigateCaptivateSlide('previous')}
    />
  );
}
