import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Book, BookWithTrend } from '../../lib/types';
import { getComparison } from '../../lib/compare';
import { CATEGORIES, STORES, Store } from '../../lib/constants';
import { fetchStorePartConfig, getDefaultParts, PartConfig } from '../../lib/cloud';
import { BookTable } from './BookTable';
import { BookTableRef } from './BookTable';
import { ChevronDown, FileSpreadsheet, MapPin, X, Search, RefreshCw, Cloud, Layers, BookOpen } from 'lucide-react';
import { CloudFilesResponse } from '../../lib/cloud';

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
  thisWeekBooks,
  lastWeekBooks,
  title,
  lastWeekTitle,
  cloudLoading,
  cloudInfo,
  onRefreshCloud
}) => {
  const [groupCode, setGroupCode] = useState("종합베스트");
  const [limit, setLimit] = useState(20);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Part state
  const [storeParts, setStoreParts] = useState<PartConfig[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);

  const storePanelRef = useRef<HTMLDivElement>(null);
  const partPanelRef = useRef<HTMLDivElement>(null);
  const bookTableRef = useRef<BookTableRef>(null);
  const [showPartPanel, setShowPartPanel] = useState(false);

  // 영업점 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!showStorePanel && !showPartPanel) return;
    const handler = (e: MouseEvent) => {
      if (showStorePanel && storePanelRef.current && !storePanelRef.current.contains(e.target as Node)) {
        setShowStorePanel(false);
        setStoreSearch("");
      }
      if (showPartPanel && partPanelRef.current && !partPanelRef.current.contains(e.target as Node)) {
        setShowPartPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStorePanel, showPartPanel]);

  // 영업점 변경 시 파트 설정 불러오기
  useEffect(() => {
    if (!selectedStore) {
      setStoreParts([]);
      setSelectedPartId(null);
      return;
    }
    let cancelled = false;
    setPartsLoading(true);
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      if (config && config.length > 0) {
        setStoreParts(config);
        setSelectedPartId(config[0].id);
      } else {
        const defaults = getDefaultParts();
        setStoreParts(defaults);
        setSelectedPartId(defaults[0].id);
      }
    }).finally(() => {
      if (!cancelled) setPartsLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedStore]);

  // 파트 변경 시 → 해당 파트의 첫 번째 조코드로 자동 전환
  const selectedPart = storeParts.find(p => p.id === selectedPartId) || null;
  useEffect(() => {
    if (selectedPart && selectedPart.categories.length > 0) {
      setGroupCode(selectedPart.categories[0].code);
      setLimit(selectedPart.categories[0].rank);
    }
  }, [selectedPartId]);

  const hasData = thisWeekBooks.length > 0 || lastWeekBooks.length > 0;

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return STORES;
    const q = storeSearch.trim().toLowerCase();
    return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  const availableCategories = useMemo(() => {
    if (selectedPart) return selectedPart.categories.map(c => c.code);
    return CATEGORIES;
  }, [selectedPart]);

  const categoryRanks = useMemo(() => {
    if (!selectedPart) return undefined;
    return Object.fromEntries(selectedPart.categories.map(c => [c.code, c.rank]));
  }, [selectedPart]);

  const handleGroupCodeChange = (code: string) => {
    setGroupCode(code);
    if (categoryRanks && categoryRanks[code]) {
      setLimit(categoryRanks[code]);
    }
  };

  const currentList = useMemo(() => {
    return getComparison(thisWeekBooks, lastWeekBooks, groupCode, limit);
  }, [thisWeekBooks, lastWeekBooks, groupCode, limit]);

  const pastList = useMemo(() => {
    const prevGroupSlice = lastWeekBooks
      .filter(b => b.groupCode === groupCode)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);

    const currentGroupSlice = thisWeekBooks
      .filter(b => b.groupCode === groupCode)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);

    return prevGroupSlice.map(prevBook => {
      const existsInCurrentTopN = currentGroupSlice.some(curr => curr.isbn === prevBook.isbn);
      return {
        ...prevBook,
        prevRank: null,
        trend: existsInCurrentTopN ? 'same' : 'out',
        trendValue: 0
      } as BookWithTrend;
    });
  }, [lastWeekBooks, thisWeekBooks, groupCode, limit]);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setShowStorePanel(false);
    setStoreSearch("");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        {/* 2행 2열 그리드: 영업점|클라우드 / 파트|서가 — 열 폭 통일 */}
        <div className="grid px-3 pt-2 pb-1 gap-x-2 gap-y-1" style={{ gridTemplateColumns: '1fr auto' }}>
          {/* Row 1 Left: 영업점 드롭다운 */}
          <div className="relative min-w-0" ref={storePanelRef}>
            <button
              onClick={() => { setShowStorePanel(prev => !prev); setShowPartPanel(false); }}
              className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                selectedStore
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-gray-100 border border-gray-300 text-gray-600'
              }`}
            >
              <MapPin size={13} className={selectedStore ? 'text-emerald-600' : 'text-gray-400'} />
              {selectedStore ? (
                <span className="font-semibold flex-1 text-left truncate">
                  <span className="text-emerald-500 font-mono mr-1.5">{selectedStore.code}</span>
                  {selectedStore.name}
                </span>
              ) : (
                <span className="flex-1 text-left text-gray-400">영업점을 선택하세요</span>
              )}
              <ChevronDown size={12} className={`transition-transform shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
            </button>

            {/* 영업점 드롭다운 패널 */}
            {showStorePanel && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-[60] overflow-hidden" style={{ width: 'calc(100vw - 24px)', maxWidth: 'calc(100vw - 24px)' }}>
                <div className="p-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <Search size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      placeholder="코드 또는 영업점명 검색"
                      className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                      autoFocus
                    />
                    {storeSearch && (
                      <button onClick={() => setStoreSearch("")} className="p-0.5">
                        <X size={12} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {filteredStores.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-xs">검색 결과가 없습니다</div>
                  ) : (
                    filteredStores.map(store => {
                      const isSelected = selectedStore?.code === store.code;
                      return (
                        <button
                          key={store.code}
                          onClick={() => handleSelectStore(store)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-gray-100 ${
                            isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`font-mono text-xs w-8 shrink-0 ${isSelected ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
                            {store.code}
                          </span>
                          <span className={`text-sm flex-1 ${isSelected ? 'text-emerald-800 font-semibold' : 'text-gray-700'}`}>
                            {store.name}
                          </span>
                          {isSelected && <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Row 1 Right: 클라우드 버튼 */}
          <button
            onClick={onRefreshCloud}
            disabled={cloudLoading}
            className={`flex items-center justify-center gap-1 w-[52px] py-1.5 rounded-lg text-xs border transition-colors ${
              cloudLoading
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-gray-50 border-gray-300 text-gray-600 active:bg-emerald-50'
            }`}
          >
            <RefreshCw size={13} className={cloudLoading ? 'animate-spin text-emerald-500' : ''} />
            <Cloud size={13} className={cloudLoading ? 'text-emerald-500' : 'text-gray-400'} />
          </button>

          {/* Row 2 Left: 파트 드롭다운 */}
          <div className="relative min-w-0" ref={partPanelRef}>
            <button
              onClick={() => {
                if (!selectedStore || partsLoading || storeParts.length === 0) return;
                setShowPartPanel(prev => !prev);
                setShowStorePanel(false);
              }}
              className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                selectedPart
                  ? 'bg-blue-50 border border-blue-200 text-blue-800'
                  : selectedStore && storeParts.length > 0
                    ? 'bg-gray-100 border border-gray-300 text-gray-600'
                    : 'bg-gray-50 border border-gray-200 text-gray-400 cursor-default'
              }`}
            >
              <Layers size={13} className={selectedPart ? 'text-blue-600' : 'text-gray-400'} />
              {!selectedStore ? (
                <span className="flex-1 text-left text-gray-400 truncate">영업점을 먼저 선택</span>
              ) : partsLoading ? (
                <span className="flex-1 text-left text-gray-400 truncate">불러오는 중...</span>
              ) : storeParts.length === 0 ? (
                <span className="flex-1 text-left text-gray-400 truncate">설정된 파트 없음</span>
              ) : selectedPart ? (
                <span className="font-semibold flex-1 text-left truncate">
                  {selectedPart.name}
                  <span className="text-blue-400 ml-1.5 text-[10px]">{selectedPart.categories.length}개 조코드</span>
                </span>
              ) : (
                <span className="flex-1 text-left text-gray-400 truncate">파트를 선택하세요</span>
              )}
              {selectedPart && (
                <span
                  onClick={(e) => { e.stopPropagation(); setSelectedPartId(null); setShowPartPanel(false); }}
                  className="p-0.5 rounded-full active:bg-blue-200 transition-colors"
                >
                  <X size={12} className="text-blue-600" />
                </span>
              )}
              {selectedStore && storeParts.length > 0 && (
                <ChevronDown size={12} className={`transition-transform shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* 파트 드롭다운 패널 */}
            {showPartPanel && storeParts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-[60] overflow-hidden" style={{ width: 'calc(100vw - 24px)', maxWidth: 'calc(100vw - 24px)' }}>
                <div className="max-h-[300px] overflow-y-auto">
                  {storeParts.map((part, idx) => {
                    const isSelected = selectedPartId === part.id;
                    return (
                      <button
                        key={part.id}
                        onClick={() => { setSelectedPartId(part.id); setShowPartPanel(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-gray-100 ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Layers size={12} className={isSelected ? 'text-blue-500' : 'text-gray-300'} />
                        <span className={`font-mono text-xs w-7 shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                          {String(idx + 1).padStart(3, '0')}
                        </span>
                        <span className={`text-sm flex-1 ${isSelected ? 'text-blue-800 font-semibold' : 'text-gray-700'}`}>
                          {part.name}
                        </span>
                        <span className={`text-[10px] shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                          {part.categories.length}개
                        </span>
                        {isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Row 2 Right: 서가 버튼 (항상 표시, 비활성화 가능) */}
          <button
            onClick={() => { if (selectedStore && hasData) bookTableRef.current?.fetchAllShelves(); }}
            disabled={!selectedStore || !hasData}
            className={`flex items-center justify-center gap-1 w-[52px] py-1.5 rounded-lg text-xs border transition-colors ${
              selectedStore && hasData
                ? 'bg-amber-50 border-amber-200 text-amber-700 active:bg-amber-100'
                : 'bg-gray-50 border-gray-200 text-gray-300 cursor-default'
            }`}
          >
            <BookOpen size={13} />
            <span className="text-[10px] font-bold">서가</span>
          </button>
        </div>

        {/* Row 3: 조코드 + 순위상한 */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <select
            value={groupCode}
            onChange={(e) => handleGroupCodeChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white min-w-0"
          >
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-gray-500">Top</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-gray-300 rounded-md w-12 text-center py-1.5 text-sm"
              min={1}
              max={50}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {cloudLoading && !hasData ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
              <RefreshCw size={28} className="text-emerald-500 animate-spin" />
            </div>
            <p className="text-gray-600 text-sm mb-1 font-semibold">클라우드에서 불러오는 중...</p>
            <p className="text-gray-400 text-xs">최신 베스트셀러 데이터를 가져오고 있습니다</p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
              <FileSpreadsheet size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm mb-1">클라우드에 업로드된 파일이 없습니다</p>
            <p className="text-gray-400 text-xs mb-4">PC에서 엑셀 파일을 업로드하면 자동으로 반영됩니다</p>
            <button
              onClick={onRefreshCloud}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold active:bg-emerald-700 transition-colors"
            >
              <RefreshCw size={14} />
              다시 시도
            </button>
          </div>
        ) : (
          <div className="px-3 py-3">
            {/* 이번주 — 서가 조회 가능 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
              <div className="text-center border-b-2 border-black py-2 bg-white">
                <h3 className="text-sm font-bold text-gray-900">{title || '이번주 데이터 없음'}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5 font-semibold">
                  {selectedPart && selectedPart.name !== '기본' && (
                    <span className="text-emerald-600 mr-1">[{selectedPart.name}]</span>
                  )}
                  {groupCode} 분야
                </p>
              </div>
              {currentList.length > 0 ? (
                <BookTable ref={bookTableRef} books={currentList} storeCode={selectedStore?.code} storeName={selectedStore?.name} showShelfRow />
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs">해당 분야에 데이터가 없습니다</div>
              )}
            </div>

            {/* 이전주 — 서가 없음 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="text-center border-b border-black py-2 bg-white">
                <h3 className="text-sm font-bold text-gray-900">{lastWeekTitle || '지난주 데이터 없음'}</h3>
              </div>
              {pastList.length > 0 ? (
                <BookTable books={pastList} storeCode={selectedStore?.code} storeName={selectedStore?.name} />
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs">해당 분야에 데이터가 없습니다</div>
              )}
            </div>

            <div className="h-6" />
          </div>
        )}
      </div>
    </div>
  );
};