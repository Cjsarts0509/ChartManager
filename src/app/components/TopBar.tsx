import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, Plus, Printer, ExternalLink, RefreshCw, FileText, MapPin, Search, X, ChevronDown, Settings, Layers, Download, Trash2, DownloadCloud } from 'lucide-react';
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
  titleThisWeek, titleLastWeek, onUploadFile, onAddList, onPrint, onPrintA4, cloudInfo, cloudLoading, onRefreshCloud, selectedStore, onSelectStore, onOpenCategoryConfig, storeParts, selectedPartId, onSelectPart, onLoadPartLists, onClearLists
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
    const q = storeSearch.trim().toLowerCase(); return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) onUploadFile(e.target.files[0]); e.target.value = ''; };
  const handleSelectStore = (store: Store) => { onSelectStore(store); setShowStorePanel(false); setStoreSearch(""); };
  const handleClearStore = (e: React.MouseEvent) => { e.stopPropagation(); onSelectStore(null); };

  const handleDownloadCloudFile = async (url?: string, filename?: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const selectedPart = storeParts?.find(p => p.id === selectedPartId) || null;
  const BOARD_URL = "https://link.kyobobook.co.kr/po/board?MENUID=316&SYSID=14&_t=1772194249235";
  const formatDate = (iso?: string) => {
    if (!iso) return ''; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const thisWeekCloud = cloudInfo?.thisWeek;
  const lastWeekCloud = cloudInfo?.lastWeek;
  const hasParts = storeParts && storeParts.length > 0;

  return (
    <div className="glass-panel print:hidden relative z-50">
      <div className="px-3 py-2 flex justify-center">
        <div className="flex items-stretch gap-2">
            {/* 업로드 버튼 (이전 디자인 복구 및 호버 애니메이션 유지) */}
            <div 
              className="border-2 border-dashed border-slate-300/80 rounded-2xl px-5 flex flex-col items-center justify-center gap-0.5 bg-white/50 hover:bg-white hover:border-slate-400 smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-md cursor-pointer min-w-[140px] h-[60px]" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} className="text-slate-500 mb-0.5" />
              <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">엑셀 파일 업로드</span>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 380px' }}>
              <div onClick={() => handleDownloadCloudFile(thisWeekCloud?.url, thisWeekCloud?.filename)} className={`border shadow-sm rounded-xl px-3 py-1 bg-white/80 backdrop-blur-sm flex items-center gap-2 smooth-transition ${thisWeekCloud?.exists ? 'border-emerald-200 hover:bg-emerald-50 hover:scale-[1.02] cursor-pointer hover:shadow-md' : 'border-gray-200 cursor-default'}`} title={thisWeekCloud?.exists ? "클릭하여 원본 엑셀 다운로드" : ""}>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md shrink-0">최신</span>
                {thisWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 truncate flex-1">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                    <span className="text-[10px] text-emerald-600 shrink-0 font-mono font-bold text-center w-[72px]">{thisWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-emerald-500 shrink-0 font-bold text-center w-[68px]">{formatDate(thisWeekCloud.uploadedAt)}</span>
                    <DownloadCloud size={14} className="text-emerald-500" />
                  </div>
                ) : <span className="text-xs font-bold text-gray-400 truncate">{titleThisWeek || "파일 없음"}</span>}
              </div>

              <div onClick={() => handleDownloadCloudFile(lastWeekCloud?.url, lastWeekCloud?.filename)} className={`border shadow-sm rounded-xl px-3 py-1 bg-white/80 backdrop-blur-sm flex items-center gap-2 smooth-transition ${lastWeekCloud?.exists ? 'border-orange-200 hover:bg-orange-50 hover:scale-[1.02] cursor-pointer hover:shadow-md' : 'border-gray-200 cursor-default'}`} title={lastWeekCloud?.exists ? "클릭하여 원본 엑셀 다운로드" : ""}>
                <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-md shrink-0">이전</span>
                {lastWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-900 truncate flex-1">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                    <span className="text-[10px] text-orange-600 shrink-0 font-mono font-bold text-center w-[72px]">{lastWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-orange-500 shrink-0 font-bold text-center w-[68px]">{formatDate(lastWeekCloud.uploadedAt)}</span>
                    <DownloadCloud size={14} className="text-orange-500" />
                  </div>
                ) : <span className="text-xs font-bold text-gray-400 truncate">{titleLastWeek || "파일 없음"}</span>}
              </div>
            </div>

            <div className="flex gap-1.5 shrink-0 h-[60px]">
              <InlineNoticePanel />
              <button onClick={onRefreshCloud} disabled={cloudLoading} className="flex flex-col items-center justify-center bg-teal-600 hover:bg-teal-700 text-white w-[72px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-lg shadow-md disabled:opacity-50"><RefreshCw size={22} className={`mb-1 ${cloudLoading ? 'animate-spin' : ''}`} /><span className="text-[11px] font-bold whitespace-nowrap">{cloudLoading ? '동기화중' : '클라우드'}</span></button>
              <a href={BOARD_URL} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center bg-sky-600 hover:bg-sky-700 text-white w-[72px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-lg shadow-md"><ExternalLink size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">게시판</span></a>
              <button onClick={onAddList} className="flex flex-col items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white w-[72px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-lg shadow-md"><Plus size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">페이지추가</span></button>
              <button onClick={onPrint} className="flex flex-col items-center justify-center bg-violet-600 hover:bg-violet-700 text-white w-[72px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-lg shadow-md"><Printer size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">전체인쇄</span></button>
              <button onClick={onPrintA4} className="flex flex-col items-center justify-center bg-amber-600 hover:bg-amber-700 text-white w-[72px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-lg shadow-md"><FileText size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">A4인쇄</span></button>
              {/* 설정 버튼 차콜 그레이 색상 적용 */}
              <button onClick={onOpenCategoryConfig} className="flex flex-col items-center justify-center bg-slate-700 hover:bg-slate-800 text-white w-[72px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-lg shadow-md"><Settings size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap text-center">설정</span></button>
            </div>

            <div className="w-px bg-slate-300/60 shrink-0 my-1 rounded-full ml-1" />

            <div className="flex flex-col gap-1 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 360px' }}>
              <div className="relative h-[28px]" ref={storePanelRef}>
                {/* 영업점, 파트선택 버튼 높이 고정 및 통일된 폰트 볼드 적용하여 UI 흔들림 방지 */}
                <button onClick={() => { setShowStorePanel(prev => !prev); setShowPartPanel(false); }} className={`w-full h-full flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-bold smooth-transition active:scale-[0.98] shadow-sm ${selectedStore ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white'}`}>
                  <MapPin size={12} className="text-white/80" />
                  {selectedStore ? <span className="flex-1 text-left truncate font-bold"><span className="text-emerald-200 font-mono mr-1.5">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 text-left font-bold">영업점 선택</span>}
                  {selectedStore && <span onClick={handleClearStore} className="p-1 rounded-full hover:bg-emerald-800/50 smooth-transition"><X size={10} className="text-white" /></span>}
                  <ChevronDown size={12} className={`transition-transform duration-300 shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
                </button>
                {showStorePanel && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-[40px] shadow-[0_16px_40px_rgba(0,0,0,0.3)] border border-gray-200 rounded-2xl z-[80] overflow-hidden origin-top animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-gray-200/50">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 border border-gray-200"><Search size={14} className="text-gray-500 shrink-0" /><input type="text" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="코드/영업점명 검색" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-gray-400 text-gray-900" autoFocus />{storeSearch && <button onClick={() => setStoreSearch("")} className="p-0.5 hover:bg-gray-300 rounded-full transition-colors"><X size={12} className="text-gray-600" /></button>}</div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {filteredStores.map(store => {
                        const isSelected = selectedStore?.code === store.code;
                        return (
                          <button key={store.code} onClick={() => handleSelectStore(store)} className={`w-full flex items-center gap-3 px-4 py-3 text-left smooth-transition font-bold ${isSelected ? 'bg-emerald-100 text-emerald-900' : 'hover:bg-gray-100 text-gray-800'}`}>
                            <span className={`font-mono text-xs w-8 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`}>{store.code}</span><span className="text-sm flex-1">{store.name}</span>{isSelected && <div className="w-2 h-2 bg-emerald-600 rounded-full shrink-0 shadow-sm" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 h-[28px]">
                <div className="flex-1 relative min-w-0 h-full" ref={partPanelRef}>
                  <button onClick={() => { if (hasParts) { setShowPartPanel(prev => !prev); setShowStorePanel(false); } }} className={`w-full h-full flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-bold smooth-transition active:scale-[0.98] shadow-sm ${selectedPart ? 'bg-blue-600 hover:bg-blue-700 text-white' : hasParts ? 'bg-slate-500 hover:bg-slate-600 text-white' : 'bg-slate-300 text-slate-500 cursor-default shadow-none'}`}>
                    <Layers size={12} className={selectedPart || hasParts ? 'text-white/80' : 'text-slate-400'} />
                    {selectedPart ? <span className="flex-1 text-left truncate font-bold">{selectedPart.name}<span className="text-blue-100 ml-1.5 text-[9px] bg-blue-800/50 px-1 py-0.5 rounded-md">{selectedPart.categories.length}개</span></span> : <span className="flex-1 text-left truncate font-bold">{!selectedStore ? '영업점 먼저 선택' : hasParts ? '파트 선택' : '파트 없음'}</span>}
                    {selectedPart && <span onClick={(e) => { e.stopPropagation(); onSelectPart?.(null); }} className="p-1 rounded-full hover:bg-blue-800/50 transition-colors"><X size={10} className="text-white" /></span>}
                    {hasParts && <ChevronDown size={12} className={`transition-transform duration-300 shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />}
                  </button>
                  {showPartPanel && hasParts && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-[40px] shadow-[0_16px_40px_rgba(0,0,0,0.3)] border border-gray-200 rounded-2xl z-[80] overflow-hidden origin-top animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1">
                        {storeParts!.map((part, idx) => {
                          const isSelected = selectedPartId === part.id;
                          return (
                            <button key={part.id} onClick={() => { onSelectPart?.(part.id); setShowPartPanel(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold smooth-transition ${isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100 text-gray-800'}`}>
                              <Layers size={14} className={isSelected ? 'text-blue-600' : 'text-gray-400'} /><span className={`font-mono text-xs w-7 shrink-0 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>{String(idx + 1).padStart(3, '0')}</span><span className="text-sm flex-1">{part.name}</span><span className={`text-[10px] shrink-0 ${isSelected ? 'text-blue-700 bg-blue-200 px-1.5 py-0.5 rounded-md' : 'text-gray-500'}`}>{part.categories.length}개</span>{isSelected && <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0 shadow-sm" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {/* 불러오기, 초기화 버튼도 솔리드 컬러 톤으로 변경 */}
                <button onClick={onLoadPartLists} disabled={!selectedPart} className={`flex items-center gap-1 px-2.5 h-full rounded-xl text-[10px] smooth-transition active:scale-95 whitespace-nowrap shadow-sm font-bold ${selectedPart ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}`}><Download size={12} /><span>불러오기</span></button>
                <button onClick={onClearLists} className="flex items-center gap-1 px-2.5 h-full rounded-xl text-[10px] smooth-transition active:scale-95 whitespace-nowrap shadow-sm font-bold bg-lime-600 hover:bg-lime-700 text-white"><Trash2 size={12} /><span>초기화</span></button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};