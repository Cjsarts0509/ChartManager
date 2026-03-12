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
  showShelfRow?: boolean;
}

export interface BookTableRef {
  fetchAllShelves: () => Promise<void>;
}

export const BookTable = forwardRef<BookTableRef, BookTableProps>(({ books, storeCode, storeName, showShelfRow }, ref) => {
  const [selectedBookForCover, setSelectedBookForCover] = useState<BookWithTrend | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [copiedIsbn, setCopiedIsbn] = useState<{ isbn: string; x: number; y: number } | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isbnToastPortal = copiedIsbn ? createPortal(
    <>
      <div className="fixed z-[9999] pointer-events-none" style={{ left: copiedIsbn.x, top: copiedIsbn.y - 40 }}>
        <div className="px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-cyan-400 text-cyan-400 text-[11px] font-bold shadow-[0_0_20px_rgba(34,211,238,0.5)] whitespace-nowrap -translate-x-1/2" style={{ animation: 'isbnToastFade 0.8s ease-in-out forwards' }}>
          <span className="font-mono mr-1">{copiedIsbn.isbn}</span>복사완료!
        </div>
      </div>
      <style>{`@keyframes isbnToastFade { 0% { opacity: 0; transform: translateX(-50%) translateY(4px); } 15%, 70% { opacity: 1; transform: translateX(-50%) translateY(0); } 100% { opacity: 0; transform: translateX(-50%) translateY(-6px); } }`}</style>
    </>,
    document.body
  ) : null;

  const handleIsbnClick = useCallback((book: BookWithTrend, e: React.MouseEvent) => {
    if (isMobile) { setSelectedBookForCover(book); return; }
    const clean = book.isbn.replace(/[-\s]/g, '');
    navigator.clipboard.writeText(clean).catch(() => {
      const ta = document.createElement('textarea'); ta.value = clean; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    });
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    setCopiedIsbn({ isbn: clean, x: e.clientX, y: e.clientY });
    copiedTimerRef.current = setTimeout(() => setCopiedIsbn(null), 800);
  }, [isMobile]);

  const [shelfInfo, setShelfInfo] = useState<ShelfInfoMap>({});
  const [loadingIsbns, setLoadingIsbns] = useState<Set<string>>(new Set());
  const [expandedIsbns, setExpandedIsbns] = useState<Set<string>>(new Set());
  const prevStoreRef = useRef(storeCode);

  useEffect(() => {
    if (prevStoreRef.current !== storeCode) {
      prevStoreRef.current = storeCode; setShelfInfo({}); setExpandedIsbns(new Set()); setLoadingIsbns(new Set()); clearShelfCache();
    }
  }, [storeCode]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler); return () => window.removeEventListener('resize', handler);
  }, []);

  const desktopGridTemplate = "4.63fr 14.13fr 30.63fr 5fr";
  const showShelf = isMobile && !!storeCode && !!showShelfRow;

  const fetchSingleShelf = useCallback(async (isbn: string) => {
    if (!storeCode || shelfInfo[isbn] !== undefined) return;
    setLoadingIsbns(prev => new Set([...prev, isbn]));
    try { const result = await fetchShelfInfo(storeCode, [isbn]); setShelfInfo(prev => ({ ...prev, ...result })); } 
    catch (e) { setShelfInfo(prev => ({ ...prev, [isbn]: null })); } 
    finally { setLoadingIsbns(prev => { const next = new Set(prev); next.delete(isbn); return next; }); }
  }, [storeCode, shelfInfo]);

  const handleTitleClick = useCallback(async (book: BookWithTrend) => {
    if (!storeCode) return;
    if (!isMobile) { openKioskWindow(book); return; }
    if (!showShelfRow) return;
    if (expandedIsbns.has(book.isbn)) { openKioskWindow(book); return; }
    setExpandedIsbns(prev => new Set([...prev, book.isbn])); fetchSingleShelf(book.isbn);
  }, [storeCode, isMobile, showShelfRow, expandedIsbns, fetchSingleShelf]);

  useImperativeHandle(ref, () => ({
    fetchAllShelves: async () => {
      if (!storeCode || !showShelfRow) return;
      const isbns = books.map(b => b.isbn);
      setExpandedIsbns(new Set(isbns));
      const uncached = isbns.filter(isbn => shelfInfo[isbn] === undefined);
      if (uncached.length === 0) return;
      const sc = storeCode;

      for (let i = 0; i < uncached.length; i++) {
        await fetchSingleShelf(uncached[i]);
        if (i < uncached.length - 1) await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
      }
      const failed = uncached.filter(isbn => getShelfFromCache(sc, isbn) === null);
      if (failed.length === 0) return;
      
      for (let i = 0; i < failed.length; i++) {
        clearShelfCacheForIsbn(sc, failed[i]);
        setShelfInfo(prev => { const next = { ...prev }; delete next[failed[i]]; return next; });
        await fetchSingleShelf(failed[i]);
        if (i < failed.length - 1) await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
      }
    },
  }), [storeCode, showShelfRow, books, shelfInfo, fetchSingleShelf]);

  const openKioskWindow = (book: BookWithTrend) => {
    if (!storeCode) return;
    const cleanIsbn = book.isbn.replace(/[-\s]/g, '');
    const kioskUrl = `https://kiosk.kyobobook.co.kr/bookInfoInk?site=${storeCode}&barcode=${cleanIsbn}&ejkGb=${getEjkGb(cleanIsbn)}`;
    const newWin = window.open('', `kiosk_${cleanIsbn}`, `width=540,height=${Math.min(window.screen.availHeight - 100, 900)},left=${window.screenX + Math.round((window.outerWidth - 540) / 2)},top=${window.screenY + 50},scrollbars=yes,resizable=yes`);
    if (!newWin) return alert('팝업이 차단되었습니다.');
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${book.title}</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#fff}iframe{width:100%;height:100%;border:none;display:block}.print-btn{position:fixed;bottom:12px;right:12px;z-index:999;width:36px;height:36px;border-radius:50%;border:none;background:#2563eb;color:#fff;font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.2s}.print-btn:hover{opacity:1}@media print{.print-btn{display:none}}</style></head><body><button class="print-btn" onclick="window.print()" title="인쇄">&#x1F5A8;</button><iframe src="${kioskUrl}" sandbox="allow-scripts allow-same-origin allow-popups"></iframe></body></html>`;
    newWin.document.write(html); newWin.document.close();
  };

  const renderShelfCard = (shelf: ShelfResult | null | undefined, index: number, trend: string, isLoading: boolean) => {
    const isNew = trend === 'new';
    const isOut = trend === 'out';
    const isHighlight = isNew || isOut;

    if (isLoading) return <div className={clsx("flex items-center justify-center h-full gap-1", isHighlight ? "text-cyan-200/60" : "text-slate-500")}><Loader2 size={10} className="animate-spin" /><span className="text-[8px]">조회중</span></div>;
    const loc = shelf?.locations?.[index];
    if (!loc) return <span className={clsx("text-[8px]", isHighlight ? "text-white/20" : "text-slate-600")}>-</span>;

    return (
      <div className={clsx("rounded-lg px-1.5 py-1 text-[8px] leading-tight border w-full smooth-transition shadow-sm",
        isNew ? "bg-cyan-900/50 border-cyan-400/50 text-cyan-100" : 
        isOut ? "bg-rose-900/50 border-rose-400/50 text-rose-100" : 
        "bg-[#0f172a]/80 border-white/10 text-slate-300"
      )}>
        <div className="font-bold whitespace-normal break-words">{loc.location}</div>
        {loc.category && <div className={clsx("whitespace-normal break-words mt-px", isNew ? "text-cyan-400" : isOut ? "text-rose-400" : "text-slate-400")}>{loc.category}</div>}
      </div>
    );
  };

  if (showShelf) {
    return (
      <>
        <div className="w-full text-[10px] font-sans">
          <div className="bg-slate-900/80 backdrop-blur-md border-t-2 border-b border-cyan-500/50 font-bold text-center text-cyan-50">
            <div className="grid items-center" style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', height: '20px' }}>
              <div className="border-r border-white/10">순위</div><div className="border-r border-white/10">ISBN</div><div>도서명</div>
            </div>
          </div>
          {books.map((book) => {
            const isNew = book.trend === 'new'; const isOut = book.trend === 'out'; const isHighlight = isNew || isOut;
            const isExpanded = expandedIsbns.has(book.isbn); const isThisLoading = loadingIsbns.has(book.isbn); const bookShelf = shelfInfo[book.isbn];

            return (
              <div key={`${book.isbn}-${book.trend}`}>
                <div className={clsx("border-b smooth-transition", isExpanded && !isHighlight ? "border-cyan-400/50" : "border-white/5", isNew && "bg-cyan-950/40 text-cyan-100", isOut && "bg-rose-950/40 text-rose-100", !isHighlight && "text-slate-300 bg-black/20 hover:bg-white/5")}>
                  <div className="grid items-center" style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', minHeight: '24px' }}>
                    <div className={clsx("flex flex-col items-center justify-center border-r py-0.5", "border-white/10")}>
                      <span className="font-bold text-slate-200">{book.rank > 0 ? book.rank : ''}</span>
                      {book.trend === 'same' && <Minus size={8} className="text-slate-600" />}
                      {book.trend === 'up' && <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-emerald-400")}>▲{book.trendValue}</span>}
                      {book.trend === 'down' && <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-blue-400")}>▼{book.trendValue}</span>}
                      {book.trend === 'new' && <span className="text-[8px] leading-none text-cyan-400">NEW</span>}
                      {book.trend === 'out' && <span className="text-[8px] leading-none text-rose-400">OUT</span>}
                    </div>
                    <div className={clsx("text-center border-r cursor-pointer active:scale-95 text-[9px] tracking-tighter py-0.5 smooth-transition border-white/10 text-slate-400 hover:text-cyan-400")} onClick={(e) => handleIsbnClick(book, e)}>{book.isbn}</div>
                    <div className={clsx("flex items-center px-1.5 py-0.5 cursor-pointer active:scale-95 min-w-0 smooth-transition", isExpanded && !isHighlight ? "text-cyan-300 font-bold" : "hover:text-cyan-300", isThisLoading && "animate-pulse")} onClick={() => handleTitleClick(book)}>
                      <span className="truncate font-semibold text-left flex-1 min-w-0">{book.title}</span>
                      {isThisLoading && <Loader2 size={8} className="shrink-0 ml-1 animate-spin text-cyan-400" />}
                      {!isThisLoading && bookShelf?.stock && <span className={clsx("shrink-0 ml-1 text-[7px] px-1 py-px rounded-md font-bold whitespace-nowrap shadow-[0_0_10px_rgba(0,0,0,0.5)] border", isNew ? "bg-cyan-950 text-cyan-300 border-cyan-400/30" : isOut ? "bg-rose-950 text-rose-300 border-rose-400/30" : "bg-slate-800 text-slate-300 border-white/10")}>{bookShelf.stock}부</span>}
                    </div>
                  </div>
                </div>
                {isExpanded && (() => {
                  const shelfLoaded = !isThisLoading && bookShelf !== undefined;
                  return (
                  <div className={clsx("grid border-b-2 overflow-hidden smooth-transition", shelfLoaded ? isNew ? "border-cyan-500/50 bg-cyan-950/20" : isOut ? "border-rose-500/50 bg-rose-950/20" : "border-slate-700 bg-[#0B0F19]/50" : "border-white/5 bg-black/20")} style={{ gridTemplateColumns: '1fr 1fr', minHeight: '28px' }}>
                    <div className={clsx("px-1 py-1 flex items-start border-r border-white/10")}>{renderShelfCard(bookShelf, 0, book.trend, isThisLoading)}</div>
                    <div className="px-1 py-1 flex items-start">{renderShelfCard(bookShelf, 1, book.trend, isThisLoading)}</div>
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        {selectedBookForCover && <BookCoverModal isbn={selectedBookForCover.isbn} bookTitle={selectedBookForCover.title} onClose={() => setSelectedBookForCover(null)} />}
        {isbnToastPortal}
      </>
    );
  }

  if (isMobile) {
    return (
      <>
        <div className="w-full text-[10px] font-sans">
          <div className="bg-slate-900/80 backdrop-blur-md border-t-2 border-b border-cyan-500/50 font-bold text-center text-cyan-50">
            <div className="grid items-center" style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', height: '20px' }}>
              <div className="border-r border-white/10">순위</div><div className="border-r border-white/10">ISBN</div><div>도서명</div>
            </div>
          </div>
          {books.map((book) => {
            const isNew = book.trend === 'new'; const isOut = book.trend === 'out'; const isHighlight = isNew || isOut;
            return (
              <div key={`${book.isbn}-${book.trend}`} className={clsx("border-b border-white/5 smooth-transition", isNew && "bg-cyan-950/40 text-cyan-100 border-l-2 border-cyan-400", isOut && "bg-rose-950/40 text-rose-100 border-l-2 border-rose-400", !isHighlight && "text-slate-300 bg-black/20 hover:bg-white/5")}>
                <div className="grid items-center" style={{ gridTemplateColumns: '2.2rem 5.5rem minmax(0,1fr)', minHeight: '24px' }}>
                  <div className={clsx("flex flex-col items-center justify-center border-r py-0.5 border-white/10")}>
                    <span className="font-bold text-slate-200">{book.rank > 0 ? book.rank : ''}</span>
                    {book.trend === 'same' && <Minus size={8} className="text-slate-600" />}
                    {book.trend === 'up' && <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-emerald-400")}>▲{book.trendValue}</span>}
                    {book.trend === 'down' && <span className={clsx("text-[8px] leading-none", isHighlight ? "text-white/80" : "text-blue-400")}>▼{book.trendValue}</span>}
                    {book.trend === 'new' && <span className="text-[8px] leading-none text-cyan-400">NEW</span>}
                    {book.trend === 'out' && <span className="text-[8px] leading-none text-rose-400">OUT</span>}
                  </div>
                  <div className={clsx("text-center border-r cursor-pointer active:scale-95 text-[9px] tracking-tighter py-0.5 smooth-transition border-white/10 text-slate-400 hover:text-cyan-400")} onClick={() => setSelectedBookForCover(book)}>{book.isbn}</div>
                  <div className="px-1.5 py-0.5 truncate font-semibold text-left">{book.title}</div>
                </div>
              </div>
            );
          })}
        </div>
        {selectedBookForCover && <BookCoverModal isbn={selectedBookForCover.isbn} bookTitle={selectedBookForCover.title} onClose={() => setSelectedBookForCover(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="w-full text-[10px] font-sans">
        <div className="grid bg-slate-900/80 backdrop-blur-md border-t-2 border-b border-cyan-500/50 font-bold text-center items-center text-cyan-50" style={{ gridTemplateColumns: desktopGridTemplate, height: '25px' }}>
          <div>순위</div><div>ISBN</div><div>도서명</div><div>변동</div>
        </div>
        {books.map((book) => {
          const isNew = book.trend === 'new'; const isOut = book.trend === 'out';
          return (
            <div key={`${book.isbn}-${book.trend}`} className={clsx("grid border-b border-white/5 items-center smooth-transition", isNew ? "bg-cyan-950/40 text-cyan-100 border-l-2 border-l-cyan-400" : isOut ? "bg-rose-950/40 text-rose-100 border-l-2 border-l-rose-400" : "text-slate-300 bg-black/20 hover:bg-white/5")} style={{ gridTemplateColumns: desktopGridTemplate, height: '25px' }}>
              <div className="text-center font-bold text-slate-200">{book.rank > 0 ? book.rank : ''}</div>
              <div className={clsx("text-center tracking-tighter cursor-pointer transition-all active:scale-95 text-slate-400 hover:text-cyan-400")} onClick={(e) => handleIsbnClick(book, e)}>{book.isbn}</div>
              <div className={clsx("px-2 leading-tight truncate font-semibold text-left smooth-transition", storeCode ? "cursor-pointer active:scale-95" : "", storeCode && !isNew && !isOut ? "hover:text-cyan-300" : "")} onClick={() => handleTitleClick(book)}>{book.title}</div>
              <div className="flex justify-center items-center h-full font-bold">
                {book.trend === 'same' && <Minus size={10} className="text-slate-600" />}
                {book.trend === 'up' && <div className={clsx("flex items-center", isNew ? "text-cyan-300" : "text-emerald-400")}><span className="text-[8px] mr-0.5">▲</span><span>{book.trendValue}</span></div>}
                {book.trend === 'down' && <div className={clsx("flex items-center", isNew ? "text-cyan-300" : "text-blue-400")}><span className="text-[8px] mr-0.5">▼</span><span>{book.trendValue}</span></div>}
                {book.trend === 'new' && <span className="text-cyan-400 text-[9px] drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">NEW</span>}
                {book.trend === 'out' && <span className="text-rose-400 text-[9px] drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]">OUT</span>}
              </div>
            </div>
          );
        })}
      </div>
      {selectedBookForCover && <BookCoverModal isbn={selectedBookForCover.isbn} bookTitle={selectedBookForCover.title} onClose={() => setSelectedBookForCover(null)} />}
      {isbnToastPortal}
    </>
  );
});
BookTable.displayName = 'BookTable';
