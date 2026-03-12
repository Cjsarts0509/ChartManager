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

  // Gamer Theme Base Button (블랙 유리에 1px 테두리, Hover시 네온 발광)
  const gamerBtnBase = "flex flex-col items-center justify-center bg-black/40 border border-white/10 text-slate-400 w-[72px] rounded-xl smooth-transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none backdrop-blur-md group";

  return (
    <div className="bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/10 print:hidden relative z-50">
      <div className="px-3 py-2 flex justify-center">
        <div className="flex items-stretch gap-2">
            <div 
              className="border-2 border-dashed border-white/20 rounded-2xl px-5 flex flex-col items-center justify-center gap-0.5 bg-black/40 hover:bg-black/60 hover:border-sky-400 smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(56,189,248,0.3),inset_0_0_10px_rgba(56,189,248,0.1)] cursor-pointer min-w-[140px] h-[60px] group" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} className="text-slate-400 group-hover:text-sky-400 smooth-transition mb-0.5" />
              <span className="text-[12px] font-bold text-slate-400 group-hover:text-sky-400 smooth-transition whitespace-nowrap">엑셀 파일 업로드</span>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 380px' }}>
              <div onClick={() => handleDownloadCloudFile(thisWeekCloud?.url, thisWeekCloud?.filename)} className={`border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)] rounded-xl px-3 py-1 bg-black/40 backdrop-blur-sm flex items-center gap-2 smooth-transition ${thisWeekCloud?.exists ? 'hover:border-emerald-400/50 hover:bg-emerald-950/30 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)] cursor-pointer' : 'cursor-default'}`} title={thisWeekCloud?.exists ? "클릭하여 원본 엑셀 다운로드" : ""}>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-md shrink-0">최신</span>
                {thisWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-100 truncate flex-1">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                    <span className="text-[10px] text-emerald-400 shrink-0 font-mono font-bold text-center w-[72px]">{thisWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-emerald-500 shrink-0 font-bold text-center w-[68px]">{formatDate(thisWeekCloud.uploadedAt)}</span>
                    <DownloadCloud size={14} className="text-emerald-500" />
                  </div>
                ) : <span className="text-xs font-bold text-slate-500 truncate">{titleThisWeek || "파일 없음"}</span>}
              </div>

              <div onClick={() => handleDownloadCloudFile(lastWeekCloud?.url, lastWeekCloud?.filename)} className={`border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)] rounded-xl px-3 py-1 bg-black/40 backdrop-blur-sm flex items-center gap-2 smooth-transition ${lastWeekCloud?.exists ? 'hover:border-orange-400/50 hover:bg-orange-950/30 hover:shadow-[0_0_15px_rgba(251,146,60,0.2)] cursor-pointer' : 'cursor-default'}`} title={lastWeekCloud?.exists ? "클릭하여 원본 엑셀 다운로드" : ""}>
                <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-md shrink-0">이전</span>
                {lastWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-100 truncate flex-1">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                    <span className="text-[10px] text-orange-400 shrink-0 font-mono font-bold text-center w-[72px]">{lastWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-orange-500 shrink-0 font-bold text-center w-[68px]">{formatDate(lastWeekCloud.uploadedAt)}</span>
                    <DownloadCloud size={14} className="text-orange-500" />
                  </div>
                ) : <span className="text-xs font-bold text-slate-500 truncate">{titleLastWeek || "파일 없음"}</span>}
              </div>
            </div>

            <div className="flex gap-1.5 shrink-0 h-[60px]">
              <InlineNoticePanel />
              <button onClick={onRefreshCloud} disabled={cloudLoading} className={`${gamerBtnBase} hover:bg-black/60 hover:border-teal-400 hover:text-teal-400 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(45,212,191,0.4),inset_0_0_10px_rgba(45,212,191,0.1)]`}><RefreshCw size={22} className={`mb-1 ${cloudLoading ? 'animate-spin text-teal-400' : ''}`} /><span className="text-[11px] font-bold whitespace-nowrap">{cloudLoading ? '동기화중' : '클라우드'}</span></button>
              <a href={BOARD_URL} target="_blank" rel="noopener noreferrer" className={`${gamerBtnBase} hover:bg-black/60 hover:border-sky-400 hover:text-sky-400 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(56,189,248,0.4),inset_0_0_10px_rgba(56,189,248,0.1)]`}><ExternalLink size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">게시판</span></a>
              <button onClick={onAddList} className={`${gamerBtnBase} hover:bg-black/60 hover:border-indigo-400 hover:text-indigo-400 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(129,140,248,0.4),inset_0_0_10px_rgba(129,140,248,0.1)]`}><Plus size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">페이지추가</span></button>
              <button onClick={onPrint} className={`${gamerBtnBase} hover:bg-black/60 hover:border-violet-400 hover:text-violet-400 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(167,139,250,0.4),inset_0_0_10px_rgba(167,139,250,0.1)]`}><Printer size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">전체인쇄</span></button>
              <button onClick={onPrintA4} className={`${gamerBtnBase} hover:bg-black/60 hover:border-amber-400 hover:text-amber-400 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(251,191,36,0.4),inset_0_0_10px_rgba(251,191,36,0.1)]`}><FileText size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">A4인쇄</span></button>
              <button onClick={onOpenCategoryConfig} className={`${gamerBtnBase} hover:bg-black/60 hover:border-slate-300 hover:text-white hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(203,213,225,0.4),inset_0_0_10px_rgba(203,213,225,0.1)]`}><Settings size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap text-center">설정</span></button>
            </div>

            <div className="w-px bg-white/10 shrink-0 my-1 rounded-full ml-1" />

            <div className="flex flex-col gap-1 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 360px' }}>
              <div className="relative h-[28px]" ref={storePanelRef}>
                <button onClick={() => { setShowStorePanel(prev => !prev); setShowPartPanel(false); }} className={`w-full h-full flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-bold smooth-transition active:scale-[0.98] border backdrop-blur-md ${selectedStore ? 'border-emerald-400 bg-emerald-950/40 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3),inset_0_0_10px_rgba(52,211,153,0.1)]' : 'border-white/10 bg-black/40 text-slate-400 hover:border-emerald-400/50 hover:text-emerald-300 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]'}`}>
                  <MapPin size={12} className={selectedStore ? 'text-emerald-400' : 'text-slate-400'} />
                  {selectedStore ? <span className="flex-1 text-left truncate font-bold"><span className="text-emerald-200 font-mono mr-1.5">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 text-left font-bold">영업점 선택</span>}
                  {selectedStore && <span onClick={handleClearStore} className="p-1 rounded-full hover:bg-emerald-400/20 smooth-transition"><X size={10} className="text-emerald-400" /></span>}
                  <ChevronDown size={12} className={`transition-transform duration-300 shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
                </button>
                {showStorePanel && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#0B0F19]/95 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(52,211,153,0.1)] border border-white/10 rounded-2xl z-[80] overflow-hidden origin-top animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-white/10 bg-white/5">
                      <div className="flex items-center gap-2 bg-black/50 rounded-xl px-3 py-2 border border-white/10"><Search size={14} className="text-slate-400 shrink-0" /><input type="text" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="코드/영업점명 검색" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-slate-500 text-white" autoFocus />{storeSearch && <button onClick={() => setStoreSearch("")} className="p-0.5 hover:bg-white/10 rounded-full transition-colors"><X size={12} className="text-slate-400" /></button>}</div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {filteredStores.map(store => {
                        const isSelected = selectedStore?.code === store.code;
                        return (
                          <button key={store.code} onClick={() => handleSelectStore(store)} className={`w-full flex items-center gap-3 px-4 py-3 text-left smooth-transition font-bold ${isSelected ? 'bg-emerald-950/50 text-emerald-300' : 'hover:bg-white/5 text-slate-300'}`}>
                            <span className={`font-mono text-xs w-8 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>{store.code}</span><span className="text-sm flex-1">{store.name}</span>{isSelected && <div className="w-2 h-2 bg-emerald-400 rounded-full shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 h-[28px]">
                <div className="flex-1 relative min-w-0 h-full" ref={partPanelRef}>
                  <button disabled={!hasParts} onClick={() => { setShowPartPanel(prev => !prev); setShowStorePanel(false); }} className={`w-full h-full flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-bold smooth-transition active:scale-[0.98] border backdrop-blur-md disabled:opacity-50 disabled:pointer-events-none ${selectedPart ? 'border-blue-400 bg-blue-950/40 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.3),inset_0_0_10px_rgba(96,165,250,0.1)]' : hasParts ? 'border-white/10 bg-black/40 text-slate-400 hover:border-blue-400/50 hover:text-blue-300 hover:shadow-[0_0_15px_rgba(96,165,250,0.2)]' : 'border-white/5 bg-white/5 text-slate-600'}`}>
                    <Layers size={12} className={selectedPart ? 'text-blue-400' : hasParts ? 'text-slate-400' : 'text-slate-600'} />
                    {selectedPart ? <span className="flex-1 text-left truncate font-bold">{selectedPart.name}<span className="text-blue-200 ml-1.5 text-[9px] bg-blue-900/50 px-1 py-0.5 rounded-md border border-blue-400/30">{selectedPart.categories.length}개</span></span> : <span className="flex-1 text-left truncate font-bold">{!selectedStore ? '영업점 먼저 선택' : hasParts ? '파트 선택' : '파트 없음'}</span>}
                    {selectedPart && <span onClick={(e) => { e.stopPropagation(); onSelectPart?.(null); }} className="p-1 rounded-full hover:bg-blue-400/20 transition-colors"><X size={10} className="text-blue-400" /></span>}
                    {hasParts && <ChevronDown size={12} className={`transition-transform duration-300 shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />}
                  </button>
                  {showPartPanel && hasParts && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-[#0B0F19]/95 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(96,165,250,0.1)] border border-white/10 rounded-2xl z-[80] overflow-hidden origin-top animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1">
                        {storeParts!.map((part, idx) => {
                          const isSelected = selectedPartId === part.id;
                          return (
                            <button key={part.id} onClick={() => { onSelectPart?.(part.id); setShowPartPanel(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold smooth-transition ${isSelected ? 'bg-blue-950/50 text-blue-300' : 'hover:bg-white/5 text-slate-300'}`}>
                              <Layers size={14} className={isSelected ? 'text-blue-400' : 'text-slate-500'} /><span className={`font-mono text-xs w-7 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`}>{String(idx + 1).padStart(3, '0')}</span><span className="text-sm flex-1">{part.name}</span><span className={`text-[10px] shrink-0 border rounded-md px-1.5 py-0.5 ${isSelected ? 'border-blue-400/30 bg-blue-900/50 text-blue-200' : 'border-white/10 bg-black/40 text-slate-500'}`}>{part.categories.length}개</span>{isSelected && <div className="w-2 h-2 bg-blue-400 rounded-full shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={onLoadPartLists} disabled={!selectedPart} className={`flex items-center gap-1 px-2.5 h-full rounded-xl text-[10px] smooth-transition active:scale-95 whitespace-nowrap border backdrop-blur-md font-bold disabled:opacity-50 disabled:pointer-events-none ${selectedPart ? 'bg-black/40 border-white/10 text-slate-300 hover:border-white/70 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3),inset_0_0_10px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/5 text-slate-600 shadow-none'}`}><Download size={12} /><span>불러오기</span></button>
                <button onClick={onClearLists} className="flex items-center gap-1 px-2.5 h-full rounded-xl text-[10px] smooth-transition active:scale-95 whitespace-nowrap border bg-black/40 border-white/10 text-slate-300 backdrop-blur-md font-bold hover:border-lime-400 hover:text-lime-400 hover:shadow-[0_0_15px_rgba(163,230,53,0.4),inset_0_0_10px_rgba(163,230,53,0.1)]"><Trash2 size={12} /><span>초기화</span></button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};
