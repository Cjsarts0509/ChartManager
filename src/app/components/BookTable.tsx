import React, { useState } from 'react';
import { BookWithTrend } from '../lib/types';
import { Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { BookCoverModal } from './BookCoverModal';
import { KioskModal } from './KioskModal';

interface BookTableProps {
  books: BookWithTrend[];
  storeCode?: string;
  storeName?: string;
}

export const BookTable: React.FC<BookTableProps> = ({ books, storeCode, storeName }) => {
  const [selectedBookForCover, setSelectedBookForCover] = useState<BookWithTrend | null>(null);
  const [selectedBookForKiosk, setSelectedBookForKiosk] = useState<BookWithTrend | null>(null);

  // 비율: 순위(4.63) : ISBN(14.13) : 도서명(30.63) : 변동(5)
  const gridTemplate = "4.63fr 14.13fr 30.63fr 5fr";

  const handleTitleClick = (book: BookWithTrend) => {
    if (storeCode) {
      setSelectedBookForKiosk(book);
    }
  };

  return (
    <>
      <div className="w-full text-[10px] font-sans">
        {/* Header */}
        <div 
          className="grid bg-[#F2F2F2] border-t-2 border-b border-black font-bold text-center items-center"
          style={{ gridTemplateColumns: gridTemplate, height: '25px' }}
        >
          <div>순위</div>
          <div>ISBN</div>
          <div>도서명</div>
          <div>변동</div>
        </div>

        {/* Rows */}
        {books.map((book) => {
          const isNew = book.trend === 'new';
          const isOut = book.trend === 'out';
          
          return (
            <div 
              key={`${book.isbn}-${book.trend}`}
              className={clsx(
                "grid border-b border-[#E1E1E1] items-center",
                isNew ? "bg-blue-600 text-white" : "", 
                isOut ? "bg-red-600 text-white" : "",
                (!isNew && !isOut) ? "text-black" : ""
              )}
              style={{ gridTemplateColumns: gridTemplate, height: '25px' }}
            >
              {/* Rank */}
              <div className="text-center font-bold">
                {book.rank > 0 ? book.rank : ''}
              </div>

              {/* ISBN - 클릭 → 표지 이미지 */}
              <div 
                className={clsx(
                  "text-center tracking-tighter cursor-pointer transition-opacity active:opacity-60",
                  (isOut || isNew) ? "text-white underline decoration-white/50" : "text-[#555] underline decoration-gray-300 hover:text-blue-600 hover:decoration-blue-400"
                )}
                onClick={() => setSelectedBookForCover(book)}
              >
                {book.isbn}
              </div>

              {/* Title - 클릭 → 키오스크 (영업점 선택 시만) */}
              <div 
                className={clsx(
                  "px-2 leading-tight truncate font-semibold text-left",
                  storeCode ? "cursor-pointer active:opacity-60" : "",
                  storeCode && !isNew && !isOut ? "hover:text-emerald-700" : ""
                )}
                onClick={() => handleTitleClick(book)}
              >
                {book.title}
              </div>

              {/* Trend */}
              <div className="flex justify-center items-center h-full font-bold">
                {book.trend === 'same' && <Minus size={10} className={(isOut || isNew) ? "text-white" : "text-gray-400"} />}
                
                {book.trend === 'up' && (
                  <div className={clsx("flex items-center", isNew ? "text-white" : "text-red-600")}>
                    <span className="text-[8px] mr-0.5">▲</span>
                    <span>{book.trendValue}</span>
                  </div>
                )}
                
                {book.trend === 'down' && (
                  <div className={clsx("flex items-center", isNew ? "text-white" : "text-blue-600")}>
                    <span className="text-[8px] mr-0.5">▼</span>
                    <span>{book.trendValue}</span>
                  </div>
                )}
                
                {book.trend === 'new' && (
                  <span className="text-white text-[9px]">NEW</span>
                )}
                
                {book.trend === 'out' && (
                  <span className="text-white text-[9px]">OUT</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Book Cover Modal (ISBN 클릭) */}
      {selectedBookForCover && (
        <BookCoverModal
          isbn={selectedBookForCover.isbn}
          bookTitle={selectedBookForCover.title}
          onClose={() => setSelectedBookForCover(null)}
        />
      )}

      {/* Kiosk Modal (도서명 클릭) */}
      {selectedBookForKiosk && storeCode && (
        <KioskModal
          isbn={selectedBookForKiosk.isbn}
          bookTitle={selectedBookForKiosk.title}
          storeCode={storeCode}
          storeName={storeName || storeCode}
          onClose={() => setSelectedBookForKiosk(null)}
        />
      )}
    </>
  );
};
