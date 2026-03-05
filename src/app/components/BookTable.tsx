import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { BookWithTrend } from '../lib/types';
import { ShelfInfoMap, ShelfResult, fetchShelfInfo, clearShelfCache } from '../../lib/cloud';
import { Minus, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { BookCoverModal } from './BookCoverModal';

interface BookTableProps {
  books: BookWithTrend[];
  storeCode?: string;
  storeName?: string;
  /** true면 서가 행 표시 (이번주만), false/없으면 서가 없음 (이전주) */
  showShelfRow?: boolean;
}

export interface BookTableRef {
  fetchAllShelves: () => void;
}

export const BookTable = forwardRef<BookTableRef, BookTableProps>(({ books, storeCode, storeName, showShelfRow }, ref) => {
  const [selectedBookForCover, setSelectedBookForCover] = useState<BookWithTrend | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // 개별 도서 서가 조회 상태
  const [shelfInfo, setShelfInfo] = useState<ShelfInfoMap>({});
  const [loadingIsbns, setLoadingIsbns] = useState<Set<string>>(new Set());
  const [expandedIsbns, setExpandedIsbns] = useState<Set<string>>(new Set());

  // 영업점 변경 시 서가 데이터 + 펼침 상태 초기화
  const prevStoreRef = useRef(storeCode);
  useEffect(() => {
    if (prevStoreRef.current !== storeCode) {
      prevStoreRef.current = storeCode;
      setShelfInfo({});
      setExpandedIsbns(new Set());
      setLoadingIsbns(new Set());
      clearShelfCache(); // 메모리 캐시도 초기화
    }
  }, [storeCode]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const desktopGridTemplate = "4.63fr 14.13fr 30.63fr 5fr";
  const showShelf = isMobile && !!storeCode && !!showShelfRow;

  /** 단일 ISBN 서가 fetch (개별 클릭 & 일괄 조회 공용) */
  const fetchSingleShelf = useCallback(async (isbn: string) => {
    if (!storeCode) return;
    if (shelfInfo[isbn] !== undefined) return; // 이미 캐시에 있으면 스킵

    setLoadingIsbns(prev => new Set([...prev, isbn]));
    try {
      const result = await fetchShelfInfo(storeCode, [isbn]);
      setShelfInfo(prev => ({ ...prev, ...result }));
    } catch (e) {
      console.error('[shelf] 개별 조회 실패:', e);
      setShelfInfo(prev => ({ ...prev, [isbn]: null }));
    } finally {
      setLoadingIsbns(prev => { const next = new Set(prev); next.delete(isbn); return next; });
    }
  }, [storeCode, shelfInfo]);

  /** 도서명 클릭 → 서가 개별 조회 (모바일) 또는 팝업 (데스크톱) */
  const handleTitleClick = useCallback(async (book: BookWithTrend) => {
    if (!storeCode) return;

    if (!isMobile) {
      openKioskWindow(book);
      return;
    }

    if (!showShelfRow) return;

    // 이미 펼쳐진 상태에서 다시 클릭 → 팝업 띄우기 (접지 않음)
    if (expandedIsbns.has(book.isbn)) {
      openKioskWindow(book);
      return;
    }

    setExpandedIsbns(prev => new Set([...prev, book.isbn]));
    fetchSingleShelf(book.isbn);
  }, [storeCode, isMobile, showShelfRow, expandedIsbns, fetchSingleShelf]);

  /** 서가 전체 조회 — 모든 도서 일괄 fetch + 전체 펼침 */
  useImperativeHandle(ref, () => ({
    fetchAllShelves: () => {
      if (!storeCode || !showShelfRow) return;
      const isbns = books.map(b => b.isbn);
      // 전체 펼침
      setExpandedIsbns(new Set(isbns));
      // 아직 캐시에 없는 것만 fetch
      isbns.forEach(isbn => {
        if (shelfInfo[isbn] === undefined) {
          fetchSingleShelf(isbn);
        }
      });
    },
  }), [storeCode, showShelfRow, books, shelfInfo, fetchSingleShelf]);

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

  /** 서가 카드 렌더링 — location(1행) + category(2행) */
  const renderShelfCard = (
    shelf: ShelfResult | null | undefined,
    index: number,
    isHighlight: boolean,
    isLoading: boolean,
  ) => {
    if (isLoading) {
      return (
        <div className={clsx("flex items-center justify-center h-full gap-1", isHighlight ? "text-white/60" : "text-amber-400")}>
          <Loader2 size={10} className="animate-spin" />
          <span className="text-[8px]">조회중</span>
        </div>
      );
    }

    const loc = shelf?.locations?.[index];
    if (!loc) {
      return <span className={clsx("text-[8px]", isHighlight ? "text-white/40" : "text-gray-300")}>-</span>;
    }

    return (
      <div className={clsx(
        "rounded px-1 py-0.5 text-[8px] leading-tight border w-full",
        isHighlight
          ? "bg-white/90 border-white text-gray-900"
          : "bg-amber-100 border-amber-300 text-gray-900"
      )}>
        {/* 1행: location */}
        <div className="font-bold whitespace-normal break-words">{loc.location}</div>
        {/* 2행: category */}
        {loc.category && (
          <div className={clsx(
            "whitespace-normal break-words mt-px",
            isHighlight ? "text-gray-600" : "text-amber-800"
          )}>
            {loc.category}
          </div>
        )}
      </div>
    );
  };

  // ─── Mobile Layout with Shelf (이번주 + 영업점 선택됨) ───
  if (showShelf) {
    return (
      <>
        <div className="w-full text-[10px] font-sans">
          {/* Header */}
          <div className="bg-[#F2F2F2] border-t-2 border-b border-black font-bold text-center">
            <div className="grid items-center"
              style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', height: '20px' }}
            >
              <div className="border-r border-gray-300">순위</div>
              <div className="border-r border-gray-300">ISBN</div>
              <div>도서명 <span className="text-[8px] font-normal text-gray-400">탭→서가</span></div>
            </div>
          </div>

          {/* Data Rows */}
          {books.map((book) => {
            const isNew = book.trend === 'new';
            const isOut = book.trend === 'out';
            const isHighlight = isNew || isOut;
            const isExpanded = expandedIsbns.has(book.isbn);
            const isThisLoading = loadingIsbns.has(book.isbn);
            const bookShelf = shelfInfo[book.isbn];

            return (
              <div key={`${book.isbn}-${book.trend}`}>
                {/* 1행: 순위 | ISBN | 도서명 */}
                <div
                  className={clsx(
                    "border-b",
                    isExpanded && !isHighlight ? "border-amber-300" : "border-[#E1E1E1]",
                    isNew && "bg-blue-600 text-white",
                    isOut && "bg-red-600 text-white",
                    !isHighlight && "text-black"
                  )}
                >
                  <div className="grid items-center"
                    style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', minHeight: '24px' }}
                  >
                    {/* 순위 */}
                    <div className={clsx("flex flex-col items-center justify-center border-r py-0.5", isHighlight ? "border-white/20" : "border-gray-200")}>
                      <span className="font-bold">{book.rank > 0 ? book.rank : ''}</span>
                      {book.trend === 'same' && <Minus size={8} className={isHighlight ? "text-white/60" : "text-gray-300"} />}
                      {book.trend === 'up' && (
                        <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-red-500")}>▲{book.trendValue}</span>
                      )}
                      {book.trend === 'down' && (
                        <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-blue-500")}>▼{book.trendValue}</span>
                      )}
                      {book.trend === 'new' && <span className="text-[8px] leading-none text-white">NEW</span>}
                      {book.trend === 'out' && <span className="text-[8px] leading-none text-white">OUT</span>}
                    </div>

                    {/* ISBN */}
                    <div
                      className={clsx(
                        "text-center border-r cursor-pointer active:opacity-60 text-[9px] tracking-tighter py-0.5",
                        isHighlight ? "border-white/20 text-white underline decoration-white/50" : "border-gray-200 text-[#555] underline decoration-gray-300"
                      )}
                      onClick={() => setSelectedBookForCover(book)}
                    >
                      {book.isbn}
                    </div>

                    {/* 도서명 + 재고 배지 */}
                    <div
                      className={clsx(
                        "flex items-center px-1.5 py-0.5 cursor-pointer active:opacity-60 min-w-0",
                        isExpanded && !isHighlight && "text-amber-700",
                        isThisLoading && "animate-pulse"
                      )}
                      onClick={() => handleTitleClick(book)}
                    >
                      <span className="truncate font-semibold text-left flex-1 min-w-0">
                        {book.title}
                      </span>
                      {isThisLoading && <Loader2 size={8} className="shrink-0 ml-1 animate-spin" />}
                      {/* 재고 배지: 조회 완료 + 재고 있을 때 도서명 우측에 표시 */}
                      {!isThisLoading && bookShelf?.stock && (
                        <span className={clsx(
                          "shrink-0 ml-1 text-[7px] px-1 py-px rounded font-bold whitespace-nowrap",
                          isHighlight
                            ? "bg-white/20 text-white"
                            : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        )}>
                          {bookShelf.stock}부
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2행: 서가①카드 | 서가②카드 (클릭해서 펼친 경우만) */}
                {isExpanded && (
                  <div className={clsx(
                    "grid border-b-2",
                    isHighlight ? "border-white/50 bg-black/5" : "border-amber-400 bg-amber-50"
                  )}
                    style={{ gridTemplateColumns: '1fr 1fr', minHeight: '28px' }}
                  >
                    <div className={clsx("px-1 py-1 flex items-start border-r", isHighlight ? "border-white/30" : "border-amber-300")}>
                      {renderShelfCard(bookShelf, 0, isHighlight, isThisLoading)}
                    </div>
                    <div className="px-1 py-1 flex items-start">
                      {renderShelfCard(bookShelf, 1, isHighlight, isThisLoading)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedBookForCover && (
          <BookCoverModal
            isbn={selectedBookForCover.isbn}
            bookTitle={selectedBookForCover.title}
            onClose={() => setSelectedBookForCover(null)}
          />
        )}
      </>
    );
  }

  // ─── Mobile (이전주, 서가 없음) or No-store Mobile ───
  if (isMobile) {
    return (
      <>
        <div className="w-full text-[10px] font-sans">
          <div className="bg-[#F2F2F2] border-t-2 border-b border-black font-bold text-center">
            <div className="grid items-center"
              style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', height: '20px' }}
            >
              <div className="border-r border-gray-300">순위</div>
              <div className="border-r border-gray-300">ISBN</div>
              <div>도서명</div>
            </div>
          </div>

          {books.map((book) => {
            const isNew = book.trend === 'new';
            const isOut = book.trend === 'out';
            const isHighlight = isNew || isOut;

            return (
              <div
                key={`${book.isbn}-${book.trend}`}
                className={clsx(
                  "border-b border-[#E1E1E1]",
                  isNew && "bg-blue-600 text-white",
                  isOut && "bg-red-600 text-white",
                  !isHighlight && "text-black"
                )}
              >
                <div className="grid items-center"
                  style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', minHeight: '24px' }}
                >
                  <div className={clsx("flex flex-col items-center justify-center border-r py-0.5", isHighlight ? "border-white/20" : "border-gray-200")}>
                    <span className="font-bold">{book.rank > 0 ? book.rank : ''}</span>
                    {book.trend === 'same' && <Minus size={8} className={isHighlight ? "text-white/60" : "text-gray-300"} />}
                    {book.trend === 'up' && (
                      <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-red-500")}>▲{book.trendValue}</span>
                    )}
                    {book.trend === 'down' && (
                      <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-blue-500")}>▼{book.trendValue}</span>
                    )}
                    {book.trend === 'new' && <span className="text-[8px] leading-none text-white">NEW</span>}
                    {book.trend === 'out' && <span className="text-[8px] leading-none text-white">OUT</span>}
                  </div>
                  <div
                    className={clsx(
                      "text-center border-r cursor-pointer active:opacity-60 text-[9px] tracking-tighter py-0.5",
                      isHighlight ? "border-white/20 text-white underline decoration-white/50" : "border-gray-200 text-[#555] underline decoration-gray-300"
                    )}
                    onClick={() => setSelectedBookForCover(book)}
                  >
                    {book.isbn}
                  </div>
                  <div className="px-1.5 py-0.5 truncate font-semibold text-left">
                    {book.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedBookForCover && (
          <BookCoverModal
            isbn={selectedBookForCover.isbn}
            bookTitle={selectedBookForCover.title}
            onClose={() => setSelectedBookForCover(null)}
          />
        )}
      </>
    );
  }

  // ─── Desktop Layout (기존 4컬럼) ───
  return (
    <>
      <div className="w-full text-[10px] font-sans">
        <div
          className="grid bg-[#F2F2F2] border-t-2 border-b border-black font-bold text-center items-center"
          style={{ gridTemplateColumns: desktopGridTemplate, height: '25px' }}
        >
          <div>순위</div>
          <div>ISBN</div>
          <div>도서명</div>
          <div>변동</div>
        </div>

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
              style={{ gridTemplateColumns: desktopGridTemplate, height: '25px' }}
            >
              <div className="text-center font-bold">{book.rank > 0 ? book.rank : ''}</div>
              <div
                className={clsx(
                  "text-center tracking-tighter cursor-pointer transition-opacity active:opacity-60",
                  (isOut || isNew) ? "text-white underline decoration-white/50" : "text-[#555] underline decoration-gray-300 hover:text-blue-600 hover:decoration-blue-400"
                )}
                onClick={() => setSelectedBookForCover(book)}
              >
                {book.isbn}
              </div>
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
              <div className="flex justify-center items-center h-full font-bold">
                {book.trend === 'same' && <Minus size={10} className={(isOut || isNew) ? "text-white" : "text-gray-400"} />}
                {book.trend === 'up' && (
                  <div className={clsx("flex items-center", isNew ? "text-white" : "text-red-600")}>
                    <span className="text-[8px] mr-0.5">▲</span><span>{book.trendValue}</span>
                  </div>
                )}
                {book.trend === 'down' && (
                  <div className={clsx("flex items-center", isNew ? "text-white" : "text-blue-600")}>
                    <span className="text-[8px] mr-0.5">▼</span><span>{book.trendValue}</span>
                  </div>
                )}
                {book.trend === 'new' && <span className="text-white text-[9px]">NEW</span>}
                {book.trend === 'out' && <span className="text-white text-[9px]">OUT</span>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedBookForCover && (
        <BookCoverModal
          isbn={selectedBookForCover.isbn}
          bookTitle={selectedBookForCover.title}
          onClose={() => setSelectedBookForCover(null)}
        />
      )}
    </>
  );
});

BookTable.displayName = 'BookTable';