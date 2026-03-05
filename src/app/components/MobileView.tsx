import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Book, BookWithTrend } from '../../lib/types';
import { getComparison } from '../../lib/compare';
import { CATEGORIES, STORES, Store } from '../../lib/constants';
import { fetchStorePartConfig, getDefaultParts, PartConfig } from '../../lib/cloud';
import { BookTable } from './BookTable';
import { ChevronDown, FileSpreadsheet, MapPin, X, Search, RefreshCw, Cloud, Layers } from 'lucide-react';
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

  // 영업점 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!showStorePanel) return;
    const handler = (e: MouseEvent) => {
      if (storePanelRef.current && !storePanelRef.current.contains(e.target as Node)) {
        setShowStorePanel(false);
        setStoreSearch("");
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStorePanel]);

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

  // 검색 필터링된 영업점
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return STORES;
    const q = storeSearch.trim().toLowerCase();
    return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  // 파트에 속한 조코드만 표시 (파트 선택 시)
  const availableCategories = useMemo(() => {
    if (selectedPart) {
      return selectedPart.categories.map(c => c.code);
    }
    return CATEGORIES;
  }, [selectedPart]);

  // 조코드별 순위 맵 (파트에서 설정한 rank)
  const categoryRanks = useMemo(() => {
    if (!selectedPart) return undefined;
    return Object.fromEntries(selectedPart.categories.map(c => [c.code, c.rank]));
  }, [selectedPart]);

  // 조코드 변경 시 해당 파트의 rank로 limit 자동 설정
  const handleGroupCodeChange = (code: string) => {
    setGroupCode(code);
    if (categoryRanks && categoryRanks[code]) {
      setLimit(categoryRanks[code]);
    }
  };

  // 이번주 리스트
  const currentList = useMemo(() => {
    return getComparison(thisWeekBooks, lastWeekBooks, groupCode, limit);
  }, [thisWeekBooks, lastWeekBooks, groupCode, limit]);

  // 지난주 리스트 (OUT 판별)
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
        {/* Row 1: 영업점 선택 */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 relative" ref={storePanelRef}>
          <button
            onClick={() => setShowStorePanel(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all flex-1 ${
              selectedStore
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-gray-100 border border-gray-300 text-gray-600'
            }`}
          >
            <MapPin size={13} className={selectedStore ? 'text-emerald-600' : 'text-gray-400'} />
            {selectedStore ? (
              <span className="font-semibold flex-1 text-left">
                <span className="text-emerald-500 font-mono mr-1.5">{selectedStore.code}</span>
                {selectedStore.name}
              </span>
            ) : (
              <span className="flex-1 text-left text-gray-400">영업점을 선택하세요</span>
            )}
            <ChevronDown size={12} className={`transition-transform ${showStorePanel ? 'rotate-180' : ''}`} />
          </button>

          {/* Cloud Refresh Button */}
          <button
            onClick={onRefreshCloud}
            disabled={cloudLoading}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors shrink-0 ${
              cloudLoading
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-gray-50 border-gray-300 text-gray-600 active:bg-emerald-50'
            }`}
          >
            <RefreshCw size={13} className={cloudLoading ? 'animate-spin text-emerald-500' : ''} />
            <Cloud size={13} className={cloudLoading ? 'text-emerald-500' : 'text-gray-400'} />
          </button>

          {/* Store Dropdown Panel */}
          {showStorePanel && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-[60] overflow-hidden">
              {/* 검색 */}
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

              {/* 목록 */}
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
                        {isSelected && (
                          <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Row 2: 파트 선택 탭 (영업점 선택 시에만 표시) */}
        {selectedStore && storeParts.length > 0 && (
          <div className="px-3 py-1">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <Layers size={12} className="text-gray-400 shrink-0" />
              {partsLoading ? (
                <span className="text-xs text-gray-400 px-2">불러오는 중...</span>
              ) : (
                storeParts.map(part => {
                  const isActive = selectedPartId === part.id;
                  return (
                    <button
                      key={part.id}
                      onClick={() => setSelectedPartId(part.id)}
                      className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                      }`}
                    >
                      {part.name}
                      <span className={`ml-1 ${isActive ? 'text-emerald-200' : 'text-gray-400'}`}>
                        {part.categories.length}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Row 3: 조코드 + 순위상한 */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          {/* 조코드 드롭다운 */}
          <select
            value={groupCode}
            onChange={(e) => handleGroupCodeChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white min-w-0"
          >
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* 순위 상한 */}
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
          /* Loading State */
          <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
              <RefreshCw size={28} className="text-emerald-500 animate-spin" />
            </div>
            <p className="text-gray-600 text-sm mb-1 font-semibold">클라우드에서 불러오는 중...</p>
            <p className="text-gray-400 text-xs">최신 베스트셀러 데이터를 가져오고 있습니다</p>
          </div>
        ) : !hasData ? (
          /* Empty State */
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
          /* Table Content */
          <div className="px-3 py-3">
            {/* This Week Table */}
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
                <BookTable books={currentList} storeCode={selectedStore?.code} storeName={selectedStore?.name} />
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs">
                  해당 분야에 데이터가 없습니다
                </div>
              )}
            </div>

            {/* Last Week Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="text-center border-b border-black py-2 bg-white">
                <h3 className="text-sm font-bold text-gray-900">{lastWeekTitle || '지난주 데이터 없음'}</h3>
              </div>
              {pastList.length > 0 ? (
                <BookTable books={pastList} storeCode={selectedStore?.code} storeName={selectedStore?.name} />
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs">
                  해당 분야에 데이터가 없습니다
                </div>
              )}
            </div>

            {/* Bottom Spacer */}
            <div className="h-6" />
          </div>
        )}
      </div>
    </div>
  );
};
