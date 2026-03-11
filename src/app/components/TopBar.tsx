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
  titleThisWeek, titleLastWeek, onUploadFile, onAddList, onPrint, onPrintA4, cloudInfo, cloudLoading, onRefreshCloud,
  selectedStore, onSelectStore, onOpenCategoryConfig, storeParts, selectedPartId, onSelectPart, onLoadPartLists, onClearLists
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [showPartPanel, setShowPartPanel] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const storePanelRef = useRef<HTMLDivElement>(null);
  const partPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStorePanel && !showPartPanel) return;
    const handler = (e: MouseEvent) => {
      if (showStorePanel && storePanelRef.current && !storePanelRef.current.contains(e.target as Node)) { setShowStorePanel(false); setStoreSearch(""); }
      if (showPartPanel && partPanelRef.current && !partPanelRef.current.contains(e.target as Node)) { setShowPartPanel(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStorePanel, showPartPanel]);

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return STORES;
    const q = storeSearch.trim().toLowerCase();
    return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  const handleSelectStore = (store: Store) => { onSelectStore(store); setShowStorePanel(false); setStoreSearch(""); };
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
    <div className="bg-skeuo border-b border-white/60 shadow-[0_10px_30px_-10px_rgba(209,217,230,0.8)] print:hidden relative z-50">
      <div className="px-3 py-3 flex justify-center">
        <div className="flex items-stretch gap-3">

            {/* Upload Button: 안으로 파인 듯한 Inset 처리로 Drop Zone 연출 */}
            <div className="skeuo-inset rounded-2xl px-5 flex flex-col items-center justify-center gap-0.5 cursor-pointer min-w-[158px] h-[64px] group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} className="text-slate-500 transition-transform duration-300 group-hover:scale-110 group-hover:text-blue-500 mb-0.5" />
              <span className="text-[11px] font-bold text-slate-700 text-center whitespace-nowrap">엑셀 파일 업로드</span>
              <span className="text-[8px] text-slate-400 text-center">주간 베스트셀러 (xlsx)</span>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) onUploadFile(e.target.files[0]); e.target.value = ''; }} />
            </div>

            {/* Cloud File Status */}
            <div className="flex flex-col gap-2 min-w-0 justify-center h-[64px]" style={{ flex: '0 1 380px' }}>
              <div className="skeuo-inset rounded-xl px-3 py-1 flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded-md shrink-0 shadow-sm">최신</span>
                {thisWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 truncate flex-1">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono text-center w-[72px]">{thisWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 text-center w-[68px]">{formatDate(thisWeekCloud.uploadedAt)}</span>
                  </div>
                ) : <span className="text-xs text-slate-400 truncate">{titleThisWeek || "파일 없음"}</span>}
              </div>
              <div className="skeuo-inset rounded-xl px-3 py-1 flex items-center gap-2">
                <span className="text-[10px] font-bold text-orange-600 bg-orange-100/80 px-1.5 py-0.5 rounded-md shrink-0 shadow-sm">이전</span>
                {lastWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 truncate flex-1">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono text-center w-[72px]">{lastWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 text-center w-[68px]">{formatDate(lastWeekCloud.uploadedAt)}</span>
                  </div>
                ) : <span className="text-xs text-slate-400 truncate">{titleLastWeek || "파일 없음"}</span>}
              </div>
            </div>

            {/* Action Buttons: 만질 수 있을 듯한 물리적 스큐오 버튼 */}
            <div className="flex gap-2 shrink-0 h-[64px]">
              
              <InlineNoticePanel />

              <button onClick={onRefreshCloud} disabled={cloudLoading} className="skeuo-btn flex flex-col items-center justify-center text-emerald-600 w-[72px] rounded-2xl group disabled:opacity-50">
                <RefreshCw size={22} className={`mb-1 transition-transform group-active:scale-90 ${cloudLoading ? 'animate-spin' : ''}`} />
                <span className="text-[11px] font-bold whitespace-nowrap">{cloudLoading ? '동기화중' : '클라우드'}</span>
              </button>

              <a href={BOARD_URL} target="_blank" rel="noopener noreferrer" className="skeuo-btn flex flex-col items-center justify-center text-blue-600 w-[72px] rounded-2xl group">
                <ExternalLink size={22} className="mb-1 transition-transform group-active:scale-90" />
                <span className="text-[11px] font-bold whitespace-nowrap">게시판</span>
              </a>

              <button onClick={onAddList} className="skeuo-btn flex flex-col items-center justify-center text-slate-600 w-[72px] rounded-2xl group">
                <Plus size={22} className="mb-1 transition-transform group-active:scale-90" />
                <span className="text-[11px] font-bold whitespace-nowrap">페이지추가</span>
              </button>

              <button onClick={onPrint} className="skeuo-btn flex flex-col items-center justify-center text-slate-700 w-[72px] rounded-2xl group">
                <Printer size={22} className="mb-1 transition-transform group-active:scale-90" />
                <span className="text-[11px] font-bold whitespace-nowrap">전체인쇄</span>
              </button>

              <button onClick={onPrintA4} className="skeuo-btn flex flex-col items-center justify-center text-amber-600 w-[72px] rounded-2xl group">
                <FileText size={22} className="mb-1 transition-transform group-active:scale-90" />
                <span className="text-[11px] font-bold whitespace-nowrap">A4인쇄</span>
              </button>

              <button onClick={onOpenCategoryConfig} className="skeuo-btn flex flex-col items-center justify-center text-slate-600 w-[72px] rounded-2xl group">
                <Settings size={22} className="mb-1 transition-transform group-active:scale-90" />
                <span className="text-[11px] font-bold whitespace-nowrap">설정</span>
              </button>
            </div>

            <div className="w-px bg-white/50 shrink-0 my-1 rounded-full ml-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.8)]" />

            {/* Store & Part Selector */}
            <div className="flex flex-col gap-2 min-w-0 justify-center h-[64px]" style={{ flex: '0 1 360px' }}>
              <div className="relative" ref={storePanelRef}>
                <button onClick={() => { setShowStorePanel(!showStorePanel); setShowPartPanel(false); }}
                  className="w-full skeuo-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] group"
                >
                  <MapPin size={12} className={selectedStore ? 'text-emerald-500' : 'text-slate-400'} />
                  {selectedStore ? (
                    <span className="font-semibold flex-1 text-left truncate text-slate-700">
                      <span className="text-emerald-500 font-mono mr-1.5">{selectedStore.code}</span>{selectedStore.name}
                    </span>
                  ) : <span className="flex-1 text-left text-slate-400 text-[10px]">영업점 선택</span>}
                  <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
                </button>
                {showStorePanel && (
                  <div className="absolute left-0 right-0 top-[110%] skeuo-card p-1 z-[60] overflow-hidden origin-top animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-white/50">
                      <div className="flex items-center gap-2 skeuo-input rounded-xl px-3 py-2">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input type="text" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="검색" className="flex-1 bg-transparent text-sm outline-none text-slate-700" autoFocus />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                      {filteredStores.map(store => (
                        <button key={store.code} onClick={() => handleSelectStore(store)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-white/50 transition-colors">
                          <span className="font-mono text-xs w-8 text-slate-400">{store.code}</span>
                          <span className="text-sm flex-1 text-slate-700 font-medium">{store.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 relative min-w-0" ref={partPanelRef}>
                  <button onClick={() => { if (hasParts) { setShowPartPanel(!showPartPanel); setShowStorePanel(false); } }}
                    className={`w-full skeuo-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] ${!hasParts && 'opacity-50'}`}
                  >
                    <Layers size={12} className={selectedPart ? 'text-blue-500' : 'text-slate-400'} />
                    {selectedPart ? (
                      <span className="font-semibold flex-1 text-left truncate text-slate-700">{selectedPart.name}</span>
                    ) : <span className="flex-1 text-left text-slate-400 text-[10px] truncate">{!selectedStore ? '영업점 먼저 선택' : hasParts ? '파트 선택' : '파트 없음'}</span>}
                    {hasParts && <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />}
                  </button>
                  {showPartPanel && hasParts && (
                    <div className="absolute left-0 right-0 top-[110%] skeuo-card p-1 z-[60] overflow-hidden origin-top animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                        {storeParts!.map((part, idx) => (
                          <button key={part.id} onClick={() => { onSelectPart?.(part.id); setShowPartPanel(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-white/50 transition-colors">
                            <span className="font-mono text-xs w-6 text-slate-400">{String(idx + 1).padStart(2, '0')}</span>
                            <span className="text-sm flex-1 text-slate-700 font-medium">{part.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={onLoadPartLists} disabled={!selectedPart} className="skeuo-btn text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
                  <Download size={14} /> 불러오기
                </button>
                <button onClick={onClearLists} className="skeuo-btn text-red-500 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1">
                  <Trash2 size={14} /> 초기화
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};