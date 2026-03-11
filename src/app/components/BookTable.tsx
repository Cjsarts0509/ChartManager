import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { BookWithTrend } from '../lib/types';
import { ShelfInfoMap, ShelfResult, fetchShelfInfo, clearShelfCache, getShelfFromCache, clearShelfCacheForIsbn, getEjkGb } from '../../lib/cloud';
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

  // ISBN 복사 토스트 (PC 전용)
  const [copiedIsbn, setCopiedIsbn] = useState<{ isbn: string; x: number; y: number } | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ISBN 복사 토스트 — createPortal로 body에 렌더 (transform 컨테이너 회피)
  const isbnToastPortal = copiedIsbn ? createPortal(
    <>
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{ left: copiedIsbn.x, top: copiedIsbn.y - 40 }}
      >
        <div
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg whitespace-nowrap -translate-x-1/2"
          style={{ animation: 'isbnToastFade 0.8s ease-in-out forwards' }}
        >
          {copiedIsbn.isbn} 복사됨
        </div>
      </div>
      <style>{`
        @keyframes isbnToastFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0); }
          70% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </>,
    document.body
  ) : null;

  const handleIsbnClick = useCallback((book: BookWithTrend, e: React.MouseEvent) => {
    if (isMobile) {
      setSelectedBookForCover(book);
      return;
    }
    // PC: 클립보드 복사 + 페이드 토스트
    const clean = book.isbn.replace(/[-\s]/g, '');
    navigator.clipboard.writeText(clean).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = clean;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    // 토스트 위치 (클릭 지점 근처)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    setCopiedIsbn({ isbn: clean, x: e.clientX, y: e.clientY });
    copiedTimerRef.current = setTimeout(() => setCopiedIsbn(null), 800);
  }, [isMobile]);

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

  /** 도서명 클릭 → 서가 개 조회 (모바일) 또는 팝업 (데스크톱) */
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

  /** 서가 전체 조회 — 모든 도서 1건씩 순차 fetch (2초 간격) + 전체 펼침 */
  useImperativeHandle(ref, () => ({
    fetchAllShelves: () => {
      if (!storeCode || !showShelfRow) return;
      const isbns = books.map(b => b.isbn);
      // 전체 펼침
      setExpandedIsbns(new Set(isbns));
      // 아직 캐시에 없는 것만 순차 fetch
      const uncached = isbns.filter(isbn => shelfInfo[isbn] === undefined);
      if (uncached.length === 0) return;
      
      const sc = storeCode; // 클로저에 캡처

      (async () => {
        // 1차 순회: 전체 ISBN 순차 fetch
        for (let i = 0; i < uncached.length; i++) {
          await fetchSingleShelf(uncached[i]);
          if (i < uncached.length - 1) {
            await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
          }
        }

        // 1차 완료 후 메모리 캐시에서 실패한 ISBN 수집 (null = 조회했으나 서가 없음/프록시 실패)
        const failed = uncached.filter(isbn => {
          const cached = getShelfFromCache(sc, isbn);
          return cached === null; // null이면 실패, undefined면 아직 미조회(있을 수 없지만 방어)
        });

        if (failed.length === 0) {
          console.log(`[shelf] 1차 전체 성공 — 재시도 없음`);
          return;
        }

        console.log(`[shelf] 1차 완료 — 실패 ${failed.length}건 재시도 시작:`, failed);

        // 2차 재시도: 실패한 ISBN의 캐시를 지우고 다시 fetch
        for (let i = 0; i < failed.length; i++) {
          // 캐시 삭제 → fetchSingleShelf가 "이미 있음" 스킵하지 않도록
          clearShelfCacheForIsbn(sc, failed[i]);
          setShelfInfo(prev => {
            const next = { ...prev };
            delete next[failed[i]];
            return next;
          });
          await fetchSingleShelf(failed[i]);
          if (i < failed.length - 1) {
            await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
          }
        }
        console.log(`[shelf] 2차 재시도 완료`);
      })();
    },
  }), [storeCode, showShelfRow, books, shelfInfo, fetchSingleShelf]);

  const openKioskWindow = (book: BookWithTrend) => {
    if (!storeCode) return;
    const cleanIsbn = book.isbn.replace(/[-\s]/g, '');
    const kioskUrl = `https://kiosk.kyobobook.co.kr/bookInfoInk?site=${storeCode}&barcode=${cleanIsbn}&ejkGb=${getEjkGb(cleanIsbn)}`;
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
        <div className={clsx("flex items-center justify-center h-full gap-1", isHighlight ? "text-white/60" : "text-gray-400")}>
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
        "rounded-lg px-1.5 py-1 text-[8px] leading-tight border w-full",
        isHighlight
          ? "bg-[#c8d8eb] border-[#a3bcd8] text-[#1a3a5c]"
          : "bg-white border-[#d5cfc6] text-[#4a3f35]"
      )}>
        {/* 1행: location */}
        <div className="font-bold whitespace-normal break-words">{loc.location}</div>
        {/* 2행: category */}
        {loc.category && (
          <div className={clsx(
            "whitespace-normal break-words mt-px",
            isHighlight ? "text-[#3a6494]" : "text-[#8a7e72]"
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
              <div>도서명</div>
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
                      onClick={(e) => handleIsbnClick(book, e)}
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
                            ? "bg-[#0000CD]/25 text-[#FFF79B] border border-[#FFF79B]/30"
                            : "bg-[#f5f0e8] text-[#7a6e5f] border border-[#d5cfc6]"
                        )}>
                          {bookShelf.stock}부
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2행: 서가①카드 | 서가②카드 (클릭해서 펼친 경우만) */}
                {isExpanded && (() => {
                  const shelfLoaded = !isThisLoading && bookShelf !== undefined;
                  return (
                  <div className={clsx(
                    "grid border-b-2",
                    shelfLoaded
                      ? isHighlight
                        ? "border-[#7eaad4] bg-[#3b6fa0]"
                        : "border-[#d5cfc6] bg-[#f5f0e8]"
                      : "border-gray-200 bg-white"
                  )}
                    style={{ gridTemplateColumns: '1fr 1fr', minHeight: '28px' }}
                  >
                    <div className={clsx("px-1 py-1 flex items-start border-r",
                      shelfLoaded
                        ? isHighlight ? "border-[#7eaad4]/50" : "border-[#d5cfc6]"
                        : "border-gray-200"
                    )}>
                      {renderShelfCard(bookShelf, 0, isHighlight, isThisLoading)}
                    </div>
                    <div className="px-1 py-1 flex items-start">
                      {renderShelfCard(bookShelf, 1, isHighlight, isThisLoading)}
                    </div>
                  </div>
                  );
                })()}
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

        {/* ISBN 복사 토스트 (PC) */}
        {isbnToastPortal}
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
                onClick={(e) => handleIsbnClick(book, e)}
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

      {/* ISBN 복사 토스트 (PC) */}
      {isbnToastPortal}
    </>
  );
});

BookTable.displayName = 'BookTable';