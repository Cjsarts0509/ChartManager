import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, Plus, Printer, ExternalLink, RefreshCw, FileText, MapPin, Search, X, ChevronDown, Settings, Layers, Download, Trash2 } from 'lucide-react';
import { CloudFilesResponse } from '../../lib/cloud';
import { STORES, Store } from '../../lib/constants';
import { PartConfig } from '../../lib/cloud';
import { InlineNoticePanel } from './NoticeBoard';

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
  onOpenCategoryConfig: () => void;
  storeParts?: PartConfig[];
  selectedPartId?: string | null;
  onSelectPart?: (partId: string | null) => void;
  onLoadPartLists?: () => void;
  onClearLists?: () => void;
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
  onSelectStore,
  onOpenCategoryConfig,
  storeParts,
  selectedPartId,
  onSelectPart,
  onLoadPartLists,
  onClearLists
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [showPartPanel, setShowPartPanel] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const storePanelRef = useRef<HTMLDivElement>(null);
  const partPanelRef = useRef<HTMLDivElement>(null);

  // 영업점/파트 패널 외부 클릭 시 닫기
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

  const selectedPart = storeParts?.find(p => p.id === selectedPartId) || null;

  const BOARD_URL = "https://link.kyobobook.co.kr/po/board?MENUID=316&SYSID=14&_t=1772194249235";

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const thisWeekCloud = cloudInfo?.thisWeek;
  const lastWeekCloud = cloudInfo?.lastWeek;

  const hasParts = storeParts && storeParts.length > 0;

  return (
    <div className="bg-white border-b border-gray-300 shadow-sm print:hidden">
      {/* Single Row: Notice + Controls, centered */}
      <div className="px-3 py-2 flex justify-center">
        <div className="flex items-stretch gap-2">

          {/* ===== Notice Panel (leftmost) ===== */}
          <InlineNoticePanel className="w-[280px] shrink-0 h-[60px]" />

          {/* Divider */}
          <div className="w-px bg-gray-200 shrink-0 my-1" />

          {/* ===== Controls ===== */}

            {/* Upload Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg px-5 flex flex-col items-center justify-center gap-0.5 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 cursor-pointer transition-colors min-w-[150px] h-[60px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} className="text-gray-500" />
              <span className="text-[11px] font-bold text-gray-600 text-center">엑셀 파일 업로드</span>
              <span className="text-[8px] text-gray-400 text-center">주간 베스트셀러 (xlsx, xls) · 3MB</span>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>

            {/* Cloud File Status */}
            <div className="flex flex-col gap-1 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 380px' }}>
              {/* This Week */}
              <div className="border rounded-md px-3 py-1 bg-white flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">최신</span>
                {thisWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800 truncate flex-1">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 font-mono text-center w-[72px]">{thisWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 text-center w-[68px]">{formatDate(thisWeekCloud.uploadedAt)}</span>
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
                    <span className="text-xs font-semibold text-gray-800 truncate flex-1">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 font-mono text-center w-[72px]">{lastWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 text-center w-[68px]">{formatDate(lastWeekCloud.uploadedAt)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 truncate">{titleLastWeek || "파일 없음"}</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1.5 shrink-0 h-[60px]">
              <button 
                onClick={onRefreshCloud}
                disabled={cloudLoading}
                className="flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 w-[68px] rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={`mb-0.5 ${cloudLoading ? 'animate-spin' : ''}`} />
                <span className="text-[8px] font-bold">{cloudLoading ? '동기화중' : '클라우드'}</span>
              </button>

              <a
                href={BOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 w-[68px] rounded-md transition-colors"
              >
                <ExternalLink size={16} className="mb-0.5" />
                <span className="text-[8px] font-bold">게시판</span>
              </a>

              <button 
                onClick={onAddList}
                className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 w-[68px] rounded-md transition-colors"
              >
                <Plus size={16} className="mb-0.5" />
                <span className="text-[8px] font-bold">페이지추가</span>
              </button>

              <button 
                onClick={onPrint}
                className="flex flex-col items-center justify-center bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 w-[68px] rounded-md transition-colors"
              >
                <Printer size={16} className="mb-0.5" />
                <span className="text-[8px] font-bold">전체인쇄</span>
              </button>

              <button 
                onClick={onPrintA4}
                className="flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 w-[68px] rounded-md transition-colors"
              >
                <FileText size={16} className="mb-0.5" />
                <span className="text-[8px] font-bold">A4인쇄</span>
              </button>

              <button 
                onClick={onOpenCategoryConfig}
                className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 w-[68px] rounded-md transition-colors"
              >
                <Settings size={16} className="mb-0.5" />
                <span className="text-[8px] font-bold leading-tight text-center">설정</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-200 shrink-0 my-1" />

            {/* Store + Part + Actions (compact inline) */}
            <div className="flex flex-col gap-0.5 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 360px' }}>
              {/* Store selector row */}
              <div className="relative" ref={storePanelRef}>
                <button
                  onClick={() => { setShowStorePanel(prev => !prev); setShowPartPanel(false); }}
                  className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-all border ${
                    selectedStore
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <MapPin size={11} className={selectedStore ? 'text-emerald-600' : 'text-gray-400'} />
                  {selectedStore ? (
                    <span className="font-semibold flex-1 text-left truncate">
                      <span className="text-emerald-500 font-mono mr-1">{selectedStore.code}</span>
                      {selectedStore.name}
                    </span>
                  ) : (
                    <span className="flex-1 text-left text-gray-400 text-[10px]">영업점 선택</span>
                  )}
                  {selectedStore && (
                    <span
                      onClick={handleClearStore}
                      className="p-0.5 rounded-full hover:bg-emerald-200 transition-colors"
                    >
                      <X size={10} className="text-emerald-600" />
                    </span>
                  )}
                  <ChevronDown size={10} className={`transition-transform shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
                </button>

                {/* Store Dropdown */}
                {showStorePanel && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-[60] overflow-hidden">
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

              {/* Part selector + action buttons row */}
              <div className="flex items-center gap-1">
                <div className="flex-1 relative min-w-0" ref={partPanelRef}>
                  <button
                    onClick={() => { if (hasParts) { setShowPartPanel(prev => !prev); setShowStorePanel(false); } }}
                    className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-all border ${
                      selectedPart
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : hasParts
                          ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
                          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-default'
                    }`}
                  >
                    <Layers size={11} className={selectedPart ? 'text-blue-600' : 'text-gray-400'} />
                    {selectedPart ? (
                      <span className="font-semibold flex-1 text-left truncate">
                        {selectedPart.name}
                        <span className="text-blue-400 ml-1 text-[9px]">{selectedPart.categories.length}개</span>
                      </span>
                    ) : (
                      <span className="flex-1 text-left text-gray-400 text-[10px] truncate">
                        {!selectedStore ? '영업점 먼저 선택' : hasParts ? '파트 선택' : '파트 없음'}
                      </span>
                    )}
                    {selectedPart && (
                      <span
                        onClick={(e) => { e.stopPropagation(); onSelectPart?.(null); }}
                        className="p-0.5 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        <X size={10} className="text-blue-600" />
                      </span>
                    )}
                    {hasParts && (
                      <ChevronDown size={10} className={`transition-transform shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {/* Part Dropdown */}
                  {showPartPanel && hasParts && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-[60] overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto">
                        {storeParts!.map((part, idx) => {
                          const isSelected = selectedPartId === part.id;
                          return (
                            <button
                              key={part.id}
                              onClick={() => { onSelectPart?.(part.id); setShowPartPanel(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
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
                              {isSelected && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Load + Clear buttons */}
                <button
                  onClick={onLoadPartLists}
                  disabled={!selectedPart}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all border whitespace-nowrap ${
                    selectedPart
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <Download size={10} />
                  <span className="font-semibold">불러오기</span>
                </button>
                <button
                  onClick={onClearLists}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] transition-all border bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 border-gray-200 hover:border-red-200 whitespace-nowrap"
                >
                  <Trash2 size={10} />
                  <span className="font-semibold">초기화</span>
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};