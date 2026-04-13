import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FlipbookProps {
  pageImages: string[];
  onNext: () => void;
  onPrevious: () => void;
}

export default function Flipbook({ pageImages, onNext, onPrevious }: FlipbookProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  const handleNext = () => {
    if (currentPage + 2 < pageImages.length && !isFlipping) {
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage((prev) => prev + 2);
        setIsFlipping(false);
      }, 300);
      onNext();
    }
  };

  const handlePrevious = () => {
    if (currentPage - 2 >= 0 && !isFlipping) {
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage((prev) => prev - 2);
        setIsFlipping(false);
      }, 300);
      onPrevious();
    }
  };

  const leftPageIndex = currentPage;
  const rightPageIndex = currentPage + 1;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100">
      {/* Book Container */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="relative w-full max-w-6xl h-full max-h-screen bg-white rounded-lg shadow-2xl" style={{ perspective: '1200px' }}>
          {/* Book Spine */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-200 to-amber-300 transform -translate-x-1/2" />

          {/* Left Page */}
          <motion.div
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 left-0 right-1/2 flex items-center justify-center pr-2 pl-4 py-8"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: 'right center',
            }}
          >
            {leftPageIndex < pageImages.length ? (
              <img
                src={pageImages[leftPageIndex]}
                alt={`Page ${leftPageIndex + 1}`}
                className="h-full w-full object-contain rounded-sm"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-lg font-semibold">
                End of Book
              </div>
            )}
          </motion.div>

          {/* Right Page */}
          <motion.div
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 left-1/2 right-0 flex items-center justify-center pl-2 pr-4 py-8"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: 'left center',
            }}
          >
            {rightPageIndex < pageImages.length ? (
              <img
                src={pageImages[rightPageIndex]}
                alt={`Page ${rightPageIndex + 1}`}
                className="h-full w-full object-contain rounded-sm"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-lg font-semibold">
                End of Book
              </div>
            )}
          </motion.div>

          {/* Page Counter */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm font-semibold text-gray-600 bg-white px-4 py-2 rounded-full shadow-md">
            Pages {leftPageIndex + 1}–{rightPageIndex + 1} of {pageImages.length}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center px-8 py-4 bg-gradient-to-r from-amber-100 to-orange-100">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handlePrevious}
          disabled={currentPage === 0 || isFlipping}
          className="h-14 w-14 rounded-2xl border-[3px] border-amber-400 bg-white text-amber-700 shadow-lg transition-all hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title="Previous Pages"
        >
          <ChevronLeft className="mx-auto h-7 w-7" />
        </motion.button>

        <div className="text-center text-amber-900 font-semibold">
          {pageImages.length > 0 ? (
            <>
              <p className="text-lg">Flipbook Ready</p>
              <p className="text-sm text-amber-700">{pageImages.length} pages loaded</p>
            </>
          ) : (
            <p>No pages available</p>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleNext}
          disabled={currentPage + 2 >= pageImages.length || isFlipping}
          className="h-14 w-14 rounded-2xl border-[3px] border-amber-400 bg-white text-amber-700 shadow-lg transition-all hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title="Next Pages"
        >
          <ChevronRight className="mx-auto h-7 w-7" />
        </motion.button>
      </div>
    </div>
  );
}
