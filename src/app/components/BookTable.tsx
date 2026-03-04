import React, { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // 비율: 순위(4.63) : ISBN(14.13) : 도서명(30.63) : 변동(5)
  const gridTemplate = "4.63fr 14.13fr 30.63fr 5fr";

  const openKioskWindow = (book: BookWithTrend) => {
    if (!storeCode) return;
    const cleanIsbn = book.isbn.replace(/[-\s]/g, '');
    const kioskUrl = `https://kiosk.kyobobook.co.kr/bookInfoInk?site=${storeCode}&barcode=${cleanIsbn}&ejkGb=KOR`;
    const popupW = 540;
    const popupH = Math.min(window.screen.availHeight - 100, 900);
    const left = window.screenX + Math.round((window.outerWidth - popupW) / 2);
    const top = window.screenY + 50;

    const newWin = window.open('', `kiosk_${cleanIsbn}`, `width=${popupW},height=${popupH},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    if (!newWin) {
      alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${book.title} - 키오스크</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#fff}
    iframe{width:100%;height:100%;border:none;display:block}
    .print-btn{position:fixed;bottom:12px;right:12px;z-index:999;width:36px;height:36px;border-radius:50%;border:none;background:#2563eb;color:#fff;font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.2s}
    .print-btn:hover{opacity:1}
    @media print{.print-btn{display:none}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()" title="인쇄">&#x1F5A8;</button>
  <iframe src="${kioskUrl}" title="${book.title}" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
</body>
</html>`;

    newWin.document.write(html);
    newWin.document.close();
  };

  const handleTitleClick = (book: BookWithTrend) => {
    if (!storeCode) return;
    if (isMobile) {
      setSelectedBookForKiosk(book);
    } else {
      openKioskWindow(book);
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