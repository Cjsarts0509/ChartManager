import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, Plus, Printer, ExternalLink, RefreshCw, FileText, MapPin, Search, X, ChevronDown, Settings, Layers, Download, Trash2, DownloadCloud } from 'lucide-react';
import { CloudFilesResponse } from '../../lib/cloud';
import { STORES, Store } from '../../lib/constants';
import { PartConfig } from '../../lib/cloud';
import { InlineNoticePanel } from './NoticeBoard';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="liquid-panel bg-white/40 print:hidden relative z-50">
      <div className="px-3 py-2 flex justify-center">
        <div className="flex items-stretch gap-2">
            <div className="liquid-btn flex flex-col items-center justify-center gap-1 bg-fuchsia-100/50 hover:bg-fuchsia-200/80 text-fuchsia-800 cursor-pointer w-[120px] h-[60px] rounded-2xl" onClick={() => fileInputRef.current?.click()}>
              <Upload size={22} className="transition-transform duration-300 group-hover:scale-110" />
              <span className="text-[11px] font-bold text-center whitespace-nowrap">엑셀 파일 업로드</span>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 380px' }}>
              <div onClick={() => handleDownloadCloudFile(thisWeekCloud?.url, thisWeekCloud?.filename)} className={`liquid-panel rounded-xl px-3 py-1 flex items-center gap-2 ${thisWeekCloud?.exists ? 'hover:bg-white/80 hover:scale-[1.02] cursor-pointer' : 'cursor-default bg-white/50'}`} title={thisWeekCloud?.exists ? "클릭하여 원본 엑셀 다운로드" : ""}>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/60 px-1.5 py-0.5 rounded-md shrink-0">최신</span>
                {thisWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate flex-1">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                    <span className="text-[10px] text-slate-600 font-bold shrink-0 font-mono text-center w-[72px]">{thisWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-slate-600 font-bold shrink-0 text-center w-[68px]">{formatDate(thisWeekCloud.uploadedAt)}</span>
                    <DownloadCloud size={14} className="text-emerald-600" />
                  </div>
                ) : <span className="text-xs text-slate-500 font-bold truncate">{titleThisWeek || "파일 없음"}</span>}
              </div>

              <div onClick={() => handleDownloadCloudFile(lastWeekCloud?.url, lastWeekCloud?.filename)} className={`liquid-panel rounded-xl px-3 py-1 flex items-center gap-2 ${lastWeekCloud?.exists ? 'hover:bg-white/80 hover:scale-[1.02] cursor-pointer' : 'cursor-default bg-white/50'}`} title={lastWeekCloud?.exists ? "클릭하여 원본 엑셀 다운로드" : ""}>
                <span className="text-[10px] font-bold text-orange-700 bg-orange-200/60 px-1.5 py-0.5 rounded-md shrink-0">이전</span>
                {lastWeekCloud?.exists ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate flex-1">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                    <span className="text-[10px] text-slate-600 font-bold shrink-0 font-mono text-center w-[72px]">{lastWeekCloud.weekKey}</span>
                    <span className="text-[10px] text-slate-600 font-bold shrink-0 text-center w-[68px]">{formatDate(lastWeekCloud.uploadedAt)}</span>
                    <DownloadCloud size={14} className="text-orange-600" />
                  </div>
                ) : <span className="text-xs text-slate-500 font-bold truncate">{titleLastWeek || "파일 없음"}</span>}
              </div>
            </div>

            <div className="flex gap-1.5 shrink-0 h-[60px]">
              <InlineNoticePanel />
              <button onClick={onRefreshCloud} disabled={cloudLoading} className="liquid-btn flex flex-col items-center justify-center bg-emerald-100/60 hover:bg-emerald-200 text-emerald-800 w-[72px] rounded-xl disabled:opacity-50"><RefreshCw size={22} className={`mb-1 ${cloudLoading ? 'animate-spin' : ''}`} /><span className="text-[11px] font-bold whitespace-nowrap">{cloudLoading ? '동기화중' : '클라우드'}</span></button>
              <a href={BOARD_URL} target="_blank" rel="noopener noreferrer" className="liquid-btn flex flex-col items-center justify-center bg-sky-100/60 hover:bg-sky-200 text-sky-800 w-[72px] rounded-xl"><ExternalLink size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">게시판</span></a>
              <button onClick={onAddList} className="liquid-btn flex flex-col items-center justify-center bg-indigo-100/60 hover:bg-indigo-200 text-indigo-800 w-[72px] rounded-xl"><Plus size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">페이지추가</span></button>
              <button onClick={onPrint} className="liquid-btn flex flex-col items-center justify-center bg-violet-100/60 hover:bg-violet-200 text-violet-800 w-[72px] rounded-xl"><Printer size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">전체인쇄</span></button>
              <button onClick={onPrintA4} className="liquid-btn flex flex-col items-center justify-center bg-amber-100/60 hover:bg-amber-200 text-amber-800 w-[72px] rounded-xl"><FileText size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap">A4인쇄</span></button>
              <button onClick={onOpenCategoryConfig} className="liquid-btn flex flex-col items-center justify-center bg-cyan-100/60 hover:bg-cyan-200 text-cyan-800 w-[72px] rounded-xl"><Settings size={22} className="mb-1" /><span className="text-[11px] font-bold whitespace-nowrap text-center">설정</span></button>
            </div>

            <div className="w-px bg-white/50 shrink-0 my-1 rounded-full ml-1" />

            <div className="flex flex-col gap-1 min-w-0 justify-center h-[60px]" style={{ flex: '0 1 360px' }}>
              <div className="relative" ref={storePanelRef}>
                <button onClick={() => { setShowStorePanel(prev => !prev); setShowPartPanel(false); }} className={`w-full flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] liquid-btn ${selectedStore ? 'bg-emerald-100/80 text-emerald-900' : 'bg-white/60 text-slate-700'}`}>
                  <MapPin size={12} className={selectedStore ? 'text-emerald-700' : 'text-slate-500'} />
                  {selectedStore ? <span className="font-bold flex-1 text-left truncate"><span className="text-emerald-700 font-mono mr-1.5">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 font-bold text-left text-slate-600 text-[10px]">영업점 선택</span>}
                  {selectedStore && <span onClick={handleClearStore} className="p-1 rounded-full hover:bg-emerald-200/80 smooth-transition"><X size={10} className="text-emerald-700" /></span>}
                  <ChevronDown size={12} className={`transition-transform duration-300 shrink-0 ${showStorePanel ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showStorePanel && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 liquid-panel bg-white/95 rounded-2xl z-[60] overflow-hidden origin-top">
                      <div className="p-2 border-b border-gray-200/50">
                        <div className="flex items-center gap-2 bg-indigo-50/50 rounded-xl px-3 py-2 border border-indigo-100"><Search size={14} className="text-indigo-500 shrink-0" /><input type="text" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="코드/영업점명 검색" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-indigo-400 text-indigo-900" autoFocus />{storeSearch && <button onClick={() => setStoreSearch("")} className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors"><X size={12} className="text-indigo-600" /></button>}</div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-white/50">
                        {filteredStores.map(store => {
                          const isSelected = selectedStore?.code === store.code;
                          return (
                            <button key={store.code} onClick={() => handleSelectStore(store)} className={`w-full flex items-center gap-3 px-4 py-3 text-left smooth-transition ${isSelected ? 'bg-emerald-100/80' : 'hover:bg-indigo-50/60'}`}>
                              <span className={`font-mono text-xs w-8 shrink-0 ${isSelected ? 'text-emerald-700 font-bold' : 'text-indigo-500 font-bold'}`}>{store.code}</span><span className={`text-sm flex-1 ${isSelected ? 'text-emerald-900 font-bold' : 'text-indigo-900 font-bold'}`}>{store.name}</span>{isSelected && <div className="w-2 h-2 bg-emerald-600 rounded-full shrink-0 shadow-sm" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex-1 relative min-w-0" ref={partPanelRef}>
                  <button onClick={() => { if (hasParts) { setShowPartPanel(prev => !prev); setShowStorePanel(false); } }} className={`w-full flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] liquid-btn ${selectedPart ? 'bg-blue-100/80 text-blue-900' : hasParts ? 'bg-white/60 text-slate-700' : 'bg-white/30 text-slate-500 cursor-default'}`}>
                    <Layers size={12} className={selectedPart ? 'text-blue-700' : 'text-slate-500'} />
                    {selectedPart ? <span className="font-bold flex-1 text-left truncate">{selectedPart.name}<span className="text-blue-700 ml-1.5 text-[9px] bg-blue-200/60 px-1 py-0.5 rounded-md font-bold">{selectedPart.categories.length}개</span></span> : <span className="flex-1 font-bold text-left text-slate-600 text-[10px] truncate">{!selectedStore ? '영업점 먼저 선택' : hasParts ? '파트 선택' : '파트 없음'}</span>}
                    {selectedPart && <span onClick={(e) => { e.stopPropagation(); onSelectPart?.(null); }} className="p-1 rounded-full hover:bg-blue-200/80 transition-colors"><X size={10} className="text-blue-700" /></span>}
                    {hasParts && <ChevronDown size={12} className={`transition-transform duration-300 shrink-0 ${showPartPanel ? 'rotate-180' : ''}`} />}
                  </button>
                  <AnimatePresence>
                    {showPartPanel && hasParts && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 liquid-panel bg-white/95 rounded-2xl z-[60] overflow-hidden origin-top">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1 bg-white/50">
                          {storeParts!.map((part, idx) => {
                            const isSelected = selectedPartId === part.id;
                            return (
                              <button key={part.id} onClick={() => { onSelectPart?.(part.id); setShowPartPanel(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left smooth-transition ${isSelected ? 'bg-blue-100/80' : 'hover:bg-indigo-50/60'}`}>
                                <Layers size={14} className={isSelected ? 'text-blue-700' : 'text-indigo-400'} /><span className={`font-mono text-xs w-7 shrink-0 ${isSelected ? 'text-blue-700 font-bold' : 'text-indigo-500 font-bold'}`}>{String(idx + 1).padStart(3, '0')}</span><span className={`text-sm flex-1 ${isSelected ? 'text-blue-900 font-bold' : 'text-indigo-900 font-bold'}`}>{part.name}</span><span className={`text-[10px] shrink-0 font-bold ${isSelected ? 'text-blue-700 bg-blue-200/60 px-1.5 py-0.5 rounded-md' : 'text-indigo-500'}`}>{part.categories.length}개</span>{isSelected && <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0 shadow-sm" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={onLoadPartLists} disabled={!selectedPart} className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] liquid-btn font-bold whitespace-nowrap ${selectedPart ? 'bg-sky-100/80 text-sky-800' : 'bg-white/30 text-slate-500 cursor-not-allowed'}`}><Download size={12} /><span>불러오기</span></button>
                <button onClick={onClearLists} className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] liquid-btn font-bold bg-rose-100/60 text-rose-800 whitespace-nowrap"><Trash2 size={12} /><span>초기화</span></button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};