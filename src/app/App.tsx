import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { ListCard } from './components/ListCard';
import { MobileView } from './components/MobileView';
import { UploadConfirmDialog } from './components/UploadConfirmDialog';
import { CategoryConfigDialog } from './components/CategoryConfigDialog';
import { ProcessedData } from '../lib/types';
import { parseExcel, parseExcelFromBuffer, extractWeekKey } from '../lib/excel';
import { fetchCloudFiles, uploadToCloud, downloadFileAsBuffer, computeFileHash, CloudFilesResponse, fetchStorePartConfig, PartConfig, getDefaultParts, installGlobalErrorLogger, writeErrorLog } from '../lib/cloud';
import { Store } from '../lib/constants';
import { Toaster, toast } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion } from 'framer-motion';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function App() {
  const [thisWeekData, setThisWeekData] = useState<ProcessedData>({ title: "", books: [] });
  const [lastWeekData, setLastWeekData] = useState<ProcessedData>({ title: "", books: [] });
  const [lists, setLists] = useState<{ id: string; defaultGroupCode?: string; defaultLimit?: number }[]>([{ id: 'init-1' }]);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'normal' | 'a4' | null>(null);

  const [uploadConfirm, setUploadConfirm] = useState<{ file: File; weekKey: string; title: string; existingTitle?: string; fileHash?: string; } | null>(null);

  const [cloudInfo, setCloudInfo] = useState<CloudFilesResponse | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showCategoryConfig, setShowCategoryConfig] = useState(false);
  const [storeParts, setStoreParts] = useState<PartConfig[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const selectedPart = storeParts.find(p => p.id === selectedPartId) || null;
  const activeCategories = selectedPart ? selectedPart.categories.map(c => c.code) : null;
  const categoryRanks = selectedPart ? Object.fromEntries(selectedPart.categories.map(c => [c.code, c.rank])) : undefined;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { installGlobalErrorLogger(); }, []);

  useEffect(() => {
    if (!selectedStore) { setStoreParts([]); setSelectedPartId(null); return; }
    setLists([{ id: 'init-1' }]); setPosition({ x: 50, y: 50 });
    let cancelled = false;
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      if (config && config.length > 0) { setStoreParts(config); setSelectedPartId(config[0].id); } 
      else { setStoreParts(getDefaultParts()); setSelectedPartId(getDefaultParts()[0].id); }
    });
    return () => { cancelled = true; };
  }, [selectedStore]);

  const handleLoadPartLists = useCallback(() => {
    if (selectedPart && selectedPart.categories.length > 0) {
      const autoLists = selectedPart.categories.map((cat, idx) => ({ id: `part-${selectedPart.id}-cat-${idx}`, defaultGroupCode: cat.code, defaultLimit: cat.rank, }));
      setLists(autoLists); setPosition({ x: 50, y: 50 });
      toast.success(`${selectedPart.name} 파트의 ${selectedPart.categories.length}개 리스트를 불러왔습니다`);
    } else { toast.info('선택된 파트에 등록된 조코드가 없습니다'); }
  }, [selectedPart]);

  const handleClearLists = useCallback(() => {
    setLists([{ id: 'init-1' }]); setPosition({ x: 50, y: 50 });
    toast.success('리스트가 초기화되었습니다');
  }, []);

  const isMobile = useIsMobile();

  const loadFromCloud = useCallback(async (silent = false) => {
    setCloudLoading(true);
    try {
      const info = await fetchCloudFiles();
      setCloudInfo(info);
      let loaded = 0;
      if (info.thisWeek?.exists && info.thisWeek.url) {
        try { const buffer = await downloadFileAsBuffer(info.thisWeek.url); setThisWeekData(parseExcelFromBuffer(buffer)); loaded++; } catch (e) { console.error(e); }
      }
      if (info.lastWeek?.exists && info.lastWeek.url) {
        try { const buffer = await downloadFileAsBuffer(info.lastWeek.url); setLastWeekData(parseExcelFromBuffer(buffer)); loaded++; } catch (e) { console.error(e); }
      }
      if (!silent) { if (loaded > 0) toast.success(`클라우드에서 ${loaded}개 파일을 불러왔습니다`); else toast.info('클라우드에 업로드된 파일이 없습니다'); }
    } catch (e) {
      if (!silent) toast.error('클라우드 연결 실패');
    } finally { setCloudLoading(false); }
  }, []);

  useEffect(() => { loadFromCloud(true); }, [loadFromCloud]);

  useEffect(() => {
    const handler = () => setPrintMode(null);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      if (file.size > 3 * 1024 * 1024) return toast.error('파일 용량 초과: 최대 3MB');
      const data = await parseExcel(file);
      const weekKey = extractWeekKey(data.title);
      if (!weekKey) return toast.error('주차 정보를 찾을 수 없습니다.');
      const fileHash = await computeFileHash(file);
      const existingFile = [cloudInfo?.thisWeek, cloudInfo?.lastWeek].find(f => f?.exists && f.weekKey === weekKey);
      if (existingFile) {
        if (existingFile.fileHash === fileHash) return toast.info('동일한 파일이 이미 있습니다.');
        setUploadConfirm({ file, weekKey, title: data.title, existingTitle: existingFile.title || existingFile.filename, fileHash });
        return;
      }
      await doUpload(file, weekKey, data.title, fileHash);
    } catch (e) { toast.error("파일 처리 실패"); }
  };

  const doUpload = async (file: File, weekKey: string, title: string, fileHash?: string) => {
    try { await uploadToCloud(file, weekKey, title, fileHash); toast.success(`${weekKey} 업로드 완료`); } 
    catch (e) { toast.error('업로드 실패'); }
    await loadFromCloud(true);
  };

  const handleUploadConfirm = async () => {
    if (!uploadConfirm) return;
    const { file, weekKey, title, fileHash } = uploadConfirm;
    setUploadConfirm(null);
    await doUpload(file, weekKey, title, fileHash);
  };

  const handleUploadCancel = () => { setUploadConfirm(null); toast.info('업로드 취소됨'); };
  const handleAddList = () => setLists(prev => [...prev, { id: `list-${Date.now()}` }]);
  const handleDeleteList = (id: string) => setLists(prev => prev.filter(l => l.id !== id));
  
  const handleGlobalPrint = () => window.print();
  const handleGlobalPrintA4 = () => { setPrintMode('a4'); setTimeout(() => { window.print(); setPrintMode(null); }, 100); };
  const handlePrintCard = (id: string) => { setPrintingId(id); setTimeout(() => { window.print(); setPrintingId(null); }, 100); };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || isMobile) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) setScale(prev => Math.min(Math.max(0.1, prev - e.deltaY * 0.001), 3));
      else setPosition(prev => ({ x: prev.x - (e.shiftKey ? e.deltaY : e.deltaX) * 1.5, y: prev.y - (e.shiftKey ? 0 : e.deltaY) * 1.5 }));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isMobile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea, [role="button"], [data-no-drag]')) return;
    setIsDragging(true); dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) { e.preventDefault(); setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); }
  };
  const handleMouseUp = () => setIsDragging(false);

  if (isMobile) {
    return (
      <ErrorBoundary>
        <Toaster position="top-center" theme="light" />
        <MobileView
          thisWeekBooks={thisWeekData.books}
          lastWeekBooks={lastWeekData.books}
          title={thisWeekData.title}
          lastWeekTitle={lastWeekData.title}
          cloudLoading={cloudLoading}
          cloudInfo={cloudInfo}
          onRefreshCloud={() => loadFromCloud(false)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    {/* 밝은 화이트/슬레이트 기반의 배경과 은은한 유리 질감의 빛(Ambient Lights) */}
    <div className="h-screen w-screen bg-[#f8fafc] overflow-hidden flex flex-col font-sans main-desktop-wrapper text-slate-800 relative selection:bg-blue-200">
      
      {/* 감성적인 라이트 이펙트 (배경 글래스모피즘) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-400/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-400/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-emerald-400/10 blur-[100px]" />
      </div>

      <Toaster position="top-center" theme="light" />
      
      <div className="z-50 relative topbar-wrapper">
        <TopBar 
          titleThisWeek={thisWeekData.title}
          titleLastWeek={lastWeekData.title}
          onUploadFile={handleFileUpload}
          onAddList={handleAddList}
          onPrint={handleGlobalPrint}
          onPrintA4={handleGlobalPrintA4}
          cloudInfo={cloudInfo}
          cloudLoading={cloudLoading}
          onRefreshCloud={() => loadFromCloud(false)}
          selectedStore={selectedStore}
          onSelectStore={setSelectedStore}
          onOpenCategoryConfig={() => setShowCategoryConfig(true)}
          storeParts={storeParts}
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
          onLoadPartLists={handleLoadPartLists}
          onClearLists={handleClearLists}
        />
      </div>

      <div 
        className="flex-1 relative overflow-hidden canvas-area z-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0, 0, 0, 0.03) 1px, transparent 0)', backgroundSize: '32px 32px' }}
        ref={canvasRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        <div className="absolute top-5 left-5 z-40 bg-white/60 border border-white shadow-[0_8px_32px_rgba(0,0,0,0.05)] text-slate-500 font-bold backdrop-blur-xl px-4 py-2 rounded-2xl text-xs pointer-events-none canvas-hint transition-all duration-300">
          ✨ 휠: 상하 이동 | Ctrl + 휠: 확대/축소 | 드래그: 자유 이동
        </div>

        <div 
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
            transformOrigin: '0 0', 
            display: 'flex', 
            gap: '48px', 
            alignItems: 'flex-start', 
            position: 'absolute',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
          className={`canvas-content ${printingId ? "print:transform-none print:static" : ""}`}
        >
          {lists.map(list => (
            <motion.div 
              layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "tween", ease: "easeOut", duration: 0.3 }}
              key={list.id} 
              className={`list-wrapper smooth-transition hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] rounded-[2rem] p-2 ${printingId && printingId !== list.id ? "print:hidden" : "print:block"}`}
            >
              <ListCard 
                id={list.id} thisWeekBooks={thisWeekData.books} lastWeekBooks={lastWeekData.books} title={thisWeekData.title} lastWeekTitle={lastWeekData.title}
                onDelete={() => handleDeleteList(list.id)} onPrint={handlePrintCard} storeCode={selectedStore?.code} storeName={selectedStore?.name}
                availableCategories={activeCategories || undefined} categoryRanks={categoryRanks} defaultGroupCode={list.defaultGroupCode} defaultLimit={list.defaultLimit}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media screen {
          /* 글래스모피즘 기반의 리스트 카드 스타일 오버라이드 */
          .list-card-print { background: rgba(255, 255, 255, 0.7) !important; color: #1e293b !important; backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.8); border-radius: 1.5rem; padding: 1rem !important; box-shadow: 0 10px 40px rgba(0,0,0,0.04) !important; }
          .list-card-print h2, .list-card-print h3 { color: #0f172a !important; }
          .list-card-print select, .list-card-print input { background: rgba(255,255,255,0.6) !important; color: #1e293b !important; border: 1px solid rgba(255,255,255,0.5) !important; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02) !important; }
        }
        @media print {
          @page { margin: 5mm; }
          body, html { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible !important; height: auto !important; width: auto !important; }
          .main-desktop-wrapper { background: white !important; height: auto !important; overflow: visible !important; display: block !important; }
          .topbar-wrapper, .canvas-hint { display: none !important; }
          .canvas-area { overflow: visible !important; height: auto !important; position: static !important; background: none !important; }
          .list-wrapper { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .list-card-print { background: white !important; color: black !important; border: none !important; backdrop-filter: none !important; box-shadow: none !important; }
          .list-card-print h2, .list-card-print h3, .list-card-print select, .list-card-print input { color: black !important; background: white !important; border: 1px solid #ccc !important; box-shadow: none !important; }
          ${printMode === 'a4' ? `
            @page { size: A4 portrait; margin: 5mm; }
            .canvas-content { transform: none !important; position: static !important; display: flex !important; flex-wrap: wrap !important; gap: 0 !important; width: 100% !important; }
            .list-wrapper { display: block !important; width: 50% !important; box-sizing: border-box !important; padding: 0 2mm !important; page-break-after: auto !important; break-after: auto !important; page-break-inside: avoid !important; break-inside: avoid !important; }
            .list-wrapper:nth-child(2n) { page-break-after: always !important; break-after: page !important; }
            .list-card-print { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 2px !important; box-shadow: none !important; border: none !important; }
          ` : `
            .canvas-content { transform: none !important; position: static !important; display: block !important; gap: 0 !important; }
            .list-wrapper { display: block !important; page-break-after: always !important; break-after: page !important; }
            .list-card-print { width: 400px !important; max-width: 400px !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
          `}
        }
      `}</style>

      {uploadConfirm && <UploadConfirmDialog weekKey={uploadConfirm.weekKey} title={uploadConfirm.title} existingTitle={uploadConfirm.existingTitle} contentChanged={true} onConfirm={handleUploadConfirm} onCancel={handleUploadCancel} />}
      {showCategoryConfig && <CategoryConfigDialog open={showCategoryConfig} onClose={() => setShowCategoryConfig(false)} initialStore={selectedStore} onSaved={(storeCode, parts) => { if (selectedStore && selectedStore.code === storeCode) { setStoreParts(parts); if (parts.length > 0) { if (!parts.find(p => p.id === selectedPartId)) setSelectedPartId(parts[0].id); } else setSelectedPartId(null); } }} />}
    </div>
    </ErrorBoundary>
  );
}
