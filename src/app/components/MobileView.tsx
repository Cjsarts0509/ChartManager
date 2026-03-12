import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Book, BookWithTrend } from '../../lib/types';
import { getComparison } from '../../lib/compare';
import { CATEGORIES, STORES, Store } from '../../lib/constants';
import { fetchStorePartConfig, getDefaultParts, PartConfig } from '../../lib/cloud';
import { BookTable } from './BookTable';
import { BookTableRef } from './BookTable';
import { ChevronDown, FileSpreadsheet, MapPin, X, Search, RefreshCw, Cloud, Layers, BookOpen } from 'lucide-react';
import { CloudFilesResponse } from '../../lib/cloud';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileViewProps {
  thisWeekBooks: Book[];
  lastWeekBooks: Book[];
  title: string;
  lastWeekTitle: string;
  cloudLoading: boolean;
  cloudInfo: CloudFilesResponse | null;
  onRefreshCloud: () => void;
}

export const MobileView: React.FC<MobileViewProps> = ({
  thisWeekBooks, lastWeekBooks, title, lastWeekTitle, cloudLoading, cloudInfo, onRefreshCloud
}) => {
  const [groupCode, setGroupCode] = useState("종합베스트");
  const [limit, setLimit] = useState(20);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  const [storeParts, setStoreParts] = useState<PartConfig[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);

  const storePanelRef = useRef<HTMLDivElement>(null);
  const partPanelRef = useRef<HTMLDivElement>(null);
  const bookTableRef = useRef<BookTableRef>(null);
  const prevTableRef = useRef<BookTableRef>(null); 
  const [showPartPanel, setShowPartPanel] = useState(false);

  useEffect(() => {
    if (!showStorePanel && !showPartPanel) return;
    const handler = (e: MouseEvent) => {
      if (showStorePanel && storePanelRef.current && !storePanelRef.current.contains(e.target as Node)) {
        setShowStorePanel(false); setStoreSearch("");
      }
      if (showPartPanel && partPanelRef.current && !partPanelRef.current.contains(e.target as Node)) {
        setShowPartPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStorePanel, showPartPanel]);

  useEffect(() => {
    if (!selectedStore) { setStoreParts([]); setSelectedPartId(null); return; }
    let cancelled = false; setPartsLoading(true);
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      if (config && config.length > 0) { setStoreParts(config); setSelectedPartId(config[0].id); } 
      else { const defaults = getDefaultParts(); setStoreParts(defaults); setSelectedPartId(defaults[0].id); }
    }).finally(() => { if (!cancelled) setPartsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedStore]);

  const selectedPart = storeParts.find(p => p.id === selectedPartId) || null;
  useEffect(() => {
    if (selectedPart && selectedPart.categories.length > 0) {
      setGroupCode(selectedPart.categories[0].code); setLimit(selectedPart.categories[0].rank);
    }
  }, [selectedPartId]);

  const hasData = thisWeekBooks.length > 0 || lastWeekBooks.length > 0;
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return STORES;
    const q = storeSearch.trim().toLowerCase();
    return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  const availableCategories = useMemo(() => selectedPart ? selectedPart.categories.map(c => c.code) : CATEGORIES, [selectedPart]);
  const categoryRanks = useMemo(() => selectedPart ? Object.fromEntries(selectedPart.categories.map(c => [c.code, c.rank])) : undefined, [selectedPart]);

  const handleGroupCodeChange = (code: string) => {
    setGroupCode(code); if (categoryRanks && categoryRanks[code]) setLimit(categoryRanks[code]);
  };

  const currentList = useMemo(() => getComparison(thisWeekBooks, lastWeekBooks, groupCode, limit), [thisWeekBooks, lastWeekBooks, groupCode, limit]);
  const pastList = useMemo(() => {
    const prevGroupSlice = lastWeekBooks.filter(b => b.groupCode === groupCode).sort((a, b) => a.rank - b.rank).slice(0, limit);
    const currentGroupSlice = thisWeekBooks.filter(b => b.groupCode === groupCode).sort((a, b) => a.rank - b.rank).slice(0, limit);
    return prevGroupSlice.map(prevBook => {
      const existsInCurrentTopN = currentGroupSlice.some(curr => curr.isbn === prevBook.isbn);
      return { ...prevBook, prevRank: null, trend: existsInCurrentTopN ? 'same' : 'out', trendValue: 0 } as BookWithTrend;
    });
  }, [lastWeekBooks, thisWeekBooks, groupCode, limit]);

  const handleSelectStore = (store: Store) => { setSelectedStore(store); setShowStorePanel(false); setStoreSearch(""); };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-400/15 blur-[100px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-400/15 blur-[100px]" />
      </div>

      <div className="sticky top-0 z-[100] bg-white/60 backdrop-blur-2xl border-b border-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="grid px-3 pt-2 pb-1 gap-x-2 gap-y-1" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="relative min-w-0" ref={storePanelRef}>
            <button onClick={() => { setShowStorePanel(prev => !prev); setShowPartPanel(false); }} className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold smooth-transition active:scale-[0.98] border backdrop-blur-xl ${selectedStore ? 'bg-gradient-to-b from-emerald-50 to-white/80 border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] text-emerald-800' : 'bg-gradient-to-b from-white to-slate-50 border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] text-slate-600'}`}>
              <MapPin size={13} className={selectedStore ? "text-emerald-500" : "text-slate-400"} />
              {selectedStore ? <span className="flex-1 text-left truncate"><span className="text-emerald-500 font-mono mr-1.5">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 text-left">영업점 선택</span>}
              <ChevronDown size={12} className={`transition-transform shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showStorePanel && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 bg-white/90 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white rounded-2xl z-[150] overflow-hidden" style={{ width: 'calc(100vw - 24px)', maxWidth: 'calc(100vw - 24px)' }}>
                  <div className="p-3 border-b border-slate-100/50 bg-white/50">
                    <div className="flex items-center gap-2 bg-slate-50/80 rounded-xl px-3 py-2 border border-slate-200/50 shadow-inner">
                      <Search size={14} className="text-slate-400 shrink-0" />
                      <input type="text" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="코드 또는 영업점명 검색" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-slate-400 text-slate-800" autoFocus />
                      {storeSearch && <button onClick={() => setStoreSearch("")} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={12} className="text-slate-500" /></button>}
                    </div>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto">
                    {filteredStores.map(store => {
                      const isSelected = selectedStore?.code === store.code;
                      return (
                        <button key={store.code} onClick={() => handleSelectStore(store)} className={`w-full flex items-center gap-3 px-4 py-3 text-left smooth-transition font-bold ${isSelected ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                          <span className={`font-mono text-xs w-8 shrink-0 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`}>{store.code}</span><span className="text-sm flex-1">{store.name}</span>{isSelected && <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 shadow-sm" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button onClick={onRefreshCloud} disabled={cloudLoading} className={`flex items-center justify-center gap-1 w-[52px] py-1.5 rounded-xl text-xs font-bold border backdrop-blur-md smooth-transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-b from-white to-slate-50 border-white text-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]`}><RefreshCw size={13} className={cloudLoading ? 'animate-spin text-teal-600' : ''} /><Cloud size={13} className="text-teal-600" /></button>

          <div className="relative min-w-0" ref={partPanelRef}>
            <button disabled={!selectedStore || partsLoading || storeParts.length === 0} onClick={() => { setShowPartPanel(prev => !prev); setShowStorePanel(false); }} className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border smooth-transition active:scale-[0.98] backdrop-blur-xl disabled:opacity-60 disabled:pointer-events-none ${selectedPart ? 'bg-gradient-to-b from-blue-50 to-white/80 border-white text-blue-800 shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-gradient-to-b from-white to-slate-50 border-white text-slate-600 shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'}`}>
              <Layers size={13} className={selectedPart ? 'text-blue-500' : 'text-slate-400'} />
              {!selectedStore ? <span className="flex-1 text-left truncate">영업점 먼저 선택</span> : partsLoading ? <span className="flex-1 text-left truncate">불러오는 중...</span> : storeParts.length === 0 ? <span className="flex-1 text-left truncate">설정된 파트 없음</span> : selectedPart ? <span className="flex-1 text-left truncate">{selectedPart.name}<span className="text-blue-600 ml-1.5 text-[9px] bg-blue-100/80 px-1 py-0.5 rounded-md border border-blue-200/50">{selectedPart.categories.length}개 조코드</span></span> : <span className="flex-1 text-left truncate">파트를 선택하세요</span>}
              {selectedPart && <span onClick={(e) => { e.stopPropagation(); setSelectedPartId(null); setShowPartPanel(false); }} className="p-0.5 rounded-full hover:bg-blue-100 smooth-transition"><X size={12} className="text-blue-600" /></span>}
              {selectedStore && storeParts.length > 0 && <ChevronDown size={12} className={`transition-transform shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />}
            </button>
            <AnimatePresence>
              {showPartPanel && storeParts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 bg-white/90 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white rounded-2xl z-[150] overflow-hidden" style={{ width: 'calc(100vw - 24px)', maxWidth: 'calc(100vw - 24px)' }}>
                  <div className="max-h-[300px] overflow-y-auto py-2 custom-scrollbar">
                    {storeParts.map((part, idx) => {
                      const isSelected = selectedPartId === part.id;
                      return (
                        <button key={part.id} onClick={() => { setSelectedPartId(part.id); setShowPartPanel(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold smooth-transition ${isSelected ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                          <Layers size={12} className={isSelected ? 'text-blue-500' : 'text-slate-400'} /><span className={`font-mono text-xs w-7 shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{String(idx + 1).padStart(3, '0')}</span><span className="text-sm flex-1">{part.name}</span><span className={`text-[10px] shrink-0 border rounded-md px-1.5 py-0.5 ${isSelected ? 'border-blue-200/50 bg-blue-100/80 text-blue-600' : 'border-slate-200/50 bg-slate-50/80 text-slate-500'}`}>{part.categories.length}개</span>{isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 shadow-sm" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={async () => {
              if (selectedStore && hasData) {
                if (bookTableRef.current) await bookTableRef.current.fetchAllShelves();
                if (prevTableRef.current) await prevTableRef.current.fetchAllShelves();
              }
            }}
            disabled={!selectedStore || !hasData}
            className={`flex items-center justify-center gap-1 w-[52px] py-1.5 rounded-xl text-xs font-bold border backdrop-blur-md smooth-transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${selectedStore && hasData ? 'bg-gradient-to-b from-amber-50 to-white/80 border-white text-amber-800 shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-white/30 border-white/50 text-slate-400'}`}
          >
            <BookOpen size={13} className={selectedStore && hasData ? 'text-amber-600' : ''} />
            <span className="text-[10px]">서가</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5">
          <select value={groupCode} onChange={(e) => handleGroupCodeChange(e.target.value)} className="flex-1 bg-white/60 border border-white rounded-xl px-2 py-1.5 text-sm font-bold text-slate-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] min-w-0 smooth-transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] outline-none backdrop-blur-md">
            {availableCategories.map(cat => <option key={cat} value={cat} className="bg-white text-slate-800">{cat}</option>)}
          </select>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-slate-500 font-bold">Top</span>
            <input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="bg-white/60 border border-white rounded-xl w-12 text-center py-1.5 text-sm font-bold text-slate-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] smooth-transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] outline-none backdrop-blur-md" min={1} max={50} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 relative z-10">
        {cloudLoading && !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-white/60 backdrop-blur-xl border border-white rounded-2xl flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(0,0,0,0.05)]"><RefreshCw size={28} className="text-teal-500 animate-spin" /></div><p className="text-teal-700 text-sm mb-1 font-bold">클라우드에서 불러오는 중...</p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-white/60 backdrop-blur-xl border border-white rounded-2xl flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(0,0,0,0.05)]"><FileSpreadsheet size={28} className="text-slate-400" /></div><p className="text-slate-500 text-sm mb-1 font-bold">클라우드에 업로드된 파일이 없습니다</p><button onClick={onRefreshCloud} className="mt-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 border border-blue-600 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] rounded-xl text-sm font-bold smooth-transition active:scale-95"><RefreshCw size={14} /> 다시 시도</button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-white">
              <div className="text-center border-b-2 border-blue-400/50 py-2 bg-white/50">
                <h3 className="text-sm font-bold text-slate-800">{title || '이번주 데이터 없음'}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-bold">{selectedPart && selectedPart.name !== '기본' && <span className="text-blue-600 mr-1">[{selectedPart.name}]</span>}{groupCode} 분야</p>
              </div>
              {currentList.length > 0 ? <BookTable ref={bookTableRef} books={currentList} storeCode={selectedStore?.code} storeName={selectedStore?.name} showShelfRow /> : <div className="py-8 text-center text-slate-400 font-bold text-xs">데이터 없음</div>}
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-white">
              <div className="text-center border-b border-slate-300/50 py-2 bg-white/50">
                <h3 className="text-sm font-bold text-slate-800">{lastWeekTitle || '지난주 데이터 없음'}</h3>
              </div>
              {pastList.length > 0 ? <BookTable ref={prevTableRef} books={pastList} storeCode={selectedStore?.code} storeName={selectedStore?.name} showShelfRow /> : <div className="py-8 text-center text-slate-400 font-bold text-xs">데이터 없음</div>}
            </div>
            <div className="h-4" />
          </motion.div>
        )}
      </div>
    </div>
  );
};
