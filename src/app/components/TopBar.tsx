import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, Plus, Printer, ExternalLink, RefreshCw, FileText, MapPin, Search, X, ChevronDown } from 'lucide-react';
import { CloudFilesResponse } from '../../lib/cloud';
import { STORES, Store } from '../../lib/constants';

interface TopBarProps {
  titleThisWeek: string;
  titleLastWeek: string;
  onUploadFile: (file: File) => void;
  onAddList: () => void;
  onPrint: () => void;
  onPrintA4: () => void;
  cloudInfo: CloudFilesResponse | null;
  cloudLoading: boolean;
  onRefreshCloud: () => void;
  selectedStore: Store | null;
  onSelectStore: (store: Store | null) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  titleThisWeek,
  titleLastWeek,
  onUploadFile,
  onAddList,
  onPrint,
  onPrintA4,
  cloudInfo,
  cloudLoading,
  onRefreshCloud,
  selectedStore,
  onSelectStore
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
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

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return STORES;
    const q = storeSearch.trim().toLowerCase();
    return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleSelectStore = (store: Store) => {
    onSelectStore(store);
    setShowStorePanel(false);
    setStoreSearch("");
  };

  const handleClearStore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectStore(null);
  };

  const BOARD_URL = "https://link.kyobobook.co.kr/po/board?MENUID=316&SYSID=14&_t=1772194249235";

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const thisWeekCloud = cloudInfo?.thisWeek;
  const lastWeekCloud = cloudInfo?.lastWeek;

  return (
    <div className="bg-white border-b border-gray-300 shadow-sm print:hidden">
      {/* Row 1: Upload + Cloud Status + Buttons - 높이 통일 */}
      <div className="px-3 pt-3 pb-2">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row gap-3 items-stretch justify-between">
          
          {/* Left: File Upload + Cloud Status */}
          <div className="flex flex-1 gap-3 w-full md:w-auto items-stretch">

            {/* Upload Button Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg px-4 flex flex-col items-center justify-center gap-0.5 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 cursor-pointer transition-colors min-w-[130px] h-[60px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} className="text-gray-500" />
              <span className="text-[11px] font-bold text-gray-600">엑셀 파일 업로드</span>
              <span className="text-[9px] text-gray-400">주차 자동 인식 · 최대 3MB</span>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>

            {/* Cloud File Status - 높이 맞춤 */}
            <div className="flex flex-col gap-1 flex-1 min-w-0 justify-center h-[60px]">
              {/* This Week */}
              <div className="border rounded-md px-3 py-1 bg-white flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">최신</span>
                {thisWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800 truncate">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 font-mono">{thisWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatDate(thisWeekCloud.uploadedAt)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 truncate">{titleThisWeek || "파일 없음"}</span>
                )}
              </div>

              {/* Last Week */}
              <div className="border rounded-md px-3 py-1 bg-white flex items-center gap-2">
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">이전</span>
                {lastWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800 truncate">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 font-mono">{lastWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatDate(lastWeekCloud.uploadedAt)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 truncate">{titleLastWeek || "파일 없음"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons - 높이 맞춤 */}
          <div className="flex gap-2 w-full md:w-auto justify-end shrink-0 h-[60px]">
            <button 
              onClick={onRefreshCloud}
              disabled={cloudLoading}
              className="flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 w-[64px] rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={`mb-0.5 ${cloudLoading ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-bold">{cloudLoading ? '동기화중' : '클라우드'}</span>
            </button>

            <a
              href={BOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 w-[64px] rounded-md transition-colors"
            >
              <ExternalLink size={18} className="mb-0.5" />
              <span className="text-[9px] font-bold">게시판</span>
            </a>

            <button 
              onClick={onAddList}
              className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 w-[64px] rounded-md transition-colors"
            >
              <Plus size={18} className="mb-0.5" />
              <span className="text-[9px] font-bold">페이지추가</span>
            </button>

            <button 
              onClick={onPrint}
              className="flex flex-col items-center justify-center bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 w-[64px] rounded-md transition-colors"
            >
              <Printer size={18} className="mb-0.5" />
              <span className="text-[9px] font-bold">전체인쇄</span>
            </button>

            <button 
              onClick={onPrintA4}
              className="flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 w-[64px] rounded-md transition-colors"
            >
              <FileText size={18} className="mb-0.5" />
              <span className="text-[9px] font-bold">A4인쇄</span>
            </button>
          </div>

        </div>
      </div>

      {/* Row 2: 영업점 선택 */}
      <div className="px-3 pb-2">
        <div className="max-w-[1400px] mx-auto relative" ref={storePanelRef}>
          <button
            onClick={() => setShowStorePanel(prev => !prev)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all border ${
              selectedStore
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
            }`}
          >
            <MapPin size={13} className={selectedStore ? 'text-emerald-600' : 'text-gray-400'} />
            {selectedStore ? (
              <span className="font-semibold flex-1 text-left">
                <span className="text-emerald-500 font-mono mr-1.5">{selectedStore.code}</span>
                {selectedStore.name}
              </span>
            ) : (
              <span className="flex-1 text-left text-gray-400">영업점을 선택하면 도서명 클릭 시 키오스크 재고를 확인할 수 있습니다</span>
            )}
            {selectedStore && (
              <span
                onClick={handleClearStore}
                className="p-0.5 rounded-full hover:bg-emerald-200 transition-colors"
              >
                <X size={12} className="text-emerald-600" />
              </span>
            )}
            <ChevronDown size={12} className={`transition-transform shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
          </button>

          {/* Store Dropdown */}
          {showStorePanel && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-[60] overflow-hidden">
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
              <div className="max-h-[300px] overflow-y-auto">
                {filteredStores.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">검색 결과가 없습니다</div>
                ) : (
                  filteredStores.map(store => {
                    const isSelected = selectedStore?.code === store.code;
                    return (
                      <button
                        key={store.code}
                        onClick={() => handleSelectStore(store)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
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
      </div>
    </div>
  );
};
