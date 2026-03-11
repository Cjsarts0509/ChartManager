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

  const [uploadConfirm, setUploadConfirm] = useState<{
    file: File;
    weekKey: string;
    title: string;
    existingTitle?: string;
    fileHash?: string;
  } | null>(null);

  const [cloudInfo, setCloudInfo] = useState<CloudFilesResponse | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showCategoryConfig, setShowCategoryConfig] = useState(false);
  const [storeParts, setStoreParts] = useState<PartConfig[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const selectedPart = storeParts.find(p => p.id === selectedPartId) || null;
  const activeCategories = selectedPart ? selectedPart.categories.map(c => c.code) : null;
  const categoryRanks = selectedPart
    ? Object.fromEntries(selectedPart.categories.map(c => [c.code, c.rank]))
    : undefined;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { installGlobalErrorLogger(); }, []);

  useEffect(() => {
    if (!selectedStore) {
      setStoreParts([]); setSelectedPartId(null); return;
    }
    setLists([{ id: 'init-1' }]);
    setPosition({ x: 50, y: 50 });

    let cancelled = false;
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      if (config && config.length > 0) {
        setStoreParts(config); setSelectedPartId(config[0].id);
      } else {
        setStoreParts(getDefaultParts()); setSelectedPartId(getDefaultParts()[0].id);
      }
    });
    return () => { cancelled = true; };
  }, [selectedStore]);

  const handleLoadPartLists = useCallback(() => {
    if (selectedPart && selectedPart.categories.length > 0) {
      const autoLists = selectedPart.categories.map((cat, idx) => ({
        id: `part-${selectedPart.id}-cat-${idx}`,
        defaultGroupCode: cat.code,
        defaultLimit: cat.rank,
      }));
      setLists(autoLists); setPosition({ x: 50, y: 50 });
      toast.success(`${selectedPart.name} 파트의 ${selectedPart.categories.length}개 리스트를 불러왔습니다`);
    } else { toast.info('선택된 파트에 등록된 조코드가 없습니다'); }
  }, [selectedPart]);

  const handleClearLists = useCallback(() => {
    setLists([{ id: 'init-1' }]); setPosition({ x: 50, y: 50 }); toast.success('리스트가 초기화되었습니다');
  }, []);

  const isMobile = useIsMobile();

  const loadFromCloud = useCallback(async (silent = false) => {
    setCloudLoading(true);
    try {
      const info = await fetchCloudFiles();
      setCloudInfo(info);
      let loaded = 0;
      if (info.thisWeek?.exists && info.thisWeek.url) {
        try {
          const buffer = await downloadFileAsBuffer(info.thisWeek.url);
          setThisWeekData(parseExcelFromBuffer(buffer)); loaded++;
        } catch (e) { console.error(e); }
      }
      if (info.lastWeek?.exists && info.lastWeek.url) {
        try {
          const buffer = await downloadFileAsBuffer(info.lastWeek.url);
          setLastWeekData(parseExcelFromBuffer(buffer)); loaded++;
        } catch (e) { console.error(e); }
      }
      if (!silent) {
        if (loaded > 0) toast.success(`클라우드에서 ${loaded}개 파일을 불러왔습니다`);
        else toast.info('클라우드에 업로드된 파일이 없습니다');
      }
    } catch (e) {
      writeErrorLog('cloud_fetch', e);
      if (!silent) toast.error('클라우드 연결 실패');
    } finally { setCloudLoading(false); }
  }, []);

  useEffect(() => { loadFromCloud(true); }, [loadFromCloud]);

  useEffect(() => {
    const handler = () => setPrintMode(null);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const MAX_FILE_SIZE = 3 * 1024 * 1024;

  const handleFileUpload = async (file: File) => {
    try {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`용량 초과: 최대 3MB`); return;
      }
      const data = await parseExcel(file);
      const weekKey = extractWeekKey(data.title);
      if (!weekKey) { toast.error(`주차 정보(YYYY년 NN주) 누락`); return; }
      const fileHash = await computeFileHash(file);
      toast.success(`${data.title} 파싱 완료`);

      const existingFile = [cloudInfo?.thisWeek, cloudInfo?.lastWeek].find(f => f?.exists && f.weekKey === weekKey);
      if (existingFile) {
        if (existingFile.fileHash && existingFile.fileHash === fileHash) { toast.info('동일한 파일이 클라우드에 존재합니다.'); return; }
        setUploadConfirm({ file, weekKey, title: data.title, existingTitle: existingFile.title || existingFile.filename, fileHash });
        return;
      }
      await doUpload(file, weekKey, data.title, fileHash);
    } catch (e) { writeErrorLog('file_parse', e); toast.error("파일 처리 실패"); }
  };

  const doUpload = async (file: File, weekKey: string, title: string, fileHash?: string) => {
    try {
      await uploadToCloud(file, weekKey, title, fileHash);
      toast.success(`${weekKey} 업로드 완료`);
    } catch (e) { writeErrorLog('cloud_upload', e); toast.error('업로드 실패'); }
    await loadFromCloud(true);
  };

  const handleUploadConfirm = async () => {
    if (!uploadConfirm) return;
    await doUpload(uploadConfirm.file, uploadConfirm.weekKey, uploadConfirm.title, uploadConfirm.fileHash);
    setUploadConfirm(null);
  };

  const handleAddList = () => setLists(prev => [...prev, { id: `list-${Date.now()}` }]);
  const handleDeleteList = (id: string) => setLists(prev => prev.filter(l => l.id !== id));
  
  const handleGlobalPrint = () => window.print();
  const handleGlobalPrintA4 = () => { setPrintMode('a4'); setTimeout(() => { window.print(); setPrintMode(null); }, 100); };
  const handlePrintCard = (id: string) => { setPrintingId(id); setTimeout(() => { window.print(); setPrintingId(null); }, 100); };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        setScale(prev => Math.min(Math.max(0.1, prev - e.deltaY * 0.001), 3));
      } else {
        setPosition(prev => ({ x: prev.x - (e.shiftKey ? e.deltaY : e.deltaX) * 1.5, y: prev.y - (e.shiftKey ? 0 : e.deltaY) * 1.5 }));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isMobile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).closest('a, button, input, select, textarea, [role="button"], [data-no-drag]');
    if (tag) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) { e.preventDefault(); setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); }
  };
  const handleMouseUp = () => setIsDragging(false);

  if (isMobile) {
    return (
      <ErrorBoundary>
        <Toaster position="top-center" />
        <MobileView thisWeekBooks={thisWeekData.books} lastWeekBooks={lastWeekData.books} title={thisWeekData.title} lastWeekTitle={lastWeekData.title} cloudLoading={cloudLoading} cloudInfo={cloudInfo} onRefreshCloud={() => loadFromCloud(false)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    {/* 2026 트렌드: 만질 수 있을 것 같은 Skeuomorphism 배경 */}
    <div className="h-screen w-screen bg-skeuo overflow-hidden flex flex-col font-sans main-desktop-wrapper text-slate-800">
      <Toaster position="top-center" />
      
      <div className="z-50 relative topbar-wrapper">
        <TopBar 
          titleThisWeek={thisWeekData.title} titleLastWeek={lastWeekData.title}
          onUploadFile={handleFileUpload} onAddList={handleAddList}
          onPrint={handleGlobalPrint} onPrintA4={handleGlobalPrintA4}
          cloudInfo={cloudInfo} cloudLoading={cloudLoading} onRefreshCloud={() => loadFromCloud(false)}
          selectedStore={selectedStore} onSelectStore={setSelectedStore}
          onOpenCategoryConfig={() => setShowCategoryConfig(true)}
          storeParts={storeParts} selectedPartId={selectedPartId} onSelectPart={setSelectedPartId}
          onLoadPartLists={handleLoadPartLists} onClearLists={handleClearLists}
        />
      </div>

      <div 
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden canvas-area"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(15, 23, 42, 0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }}
        ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        <div className="absolute top-5 left-5 z-40 skeuo-btn text-slate-500 px-4 py-2 rounded-2xl text-xs font-medium pointer-events-none canvas-hint">
          ✨ 휠: 상하 이동 | Ctrl + 휠: 확대/축소 | 드래그: 자유 이동
        </div>

        <div 
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0', display: 'flex', gap: '48px', alignItems: 'flex-start', position: 'absolute' }}
          className={`canvas-content ${printingId ? "print:transform-none print:static" : ""}`}
        >
          {lists.map((list, index) => (
            // 스태거링 애니메이션(순차적 등장) + 융기된 Skeuomorphic 카드
            <div 
              key={list.id} 
              className={`list-wrapper opacity-0 animate-skeuo-enter skeuo-card p-2 group ${printingId && printingId !== list.id ? "print:hidden" : "print:block"}`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <ListCard 
                id={list.id} thisWeekBooks={thisWeekData.books} lastWeekBooks={lastWeekData.books} title={thisWeekData.title} lastWeekTitle={lastWeekData.title}
                onDelete={() => handleDeleteList(list.id)} onPrint={handlePrintCard} storeCode={selectedStore?.code} storeName={selectedStore?.name}
                availableCategories={activeCategories || undefined} categoryRanks={categoryRanks} defaultGroupCode={list.defaultGroupCode} defaultLimit={list.defaultLimit}
              />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 5mm; }
          body, html { -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible !important; height: auto !important; width: auto !important; }
          .main-desktop-wrapper { height: auto !important; overflow: visible !important; display: block !important; background: white !important; }
          .topbar-wrapper { display: none !important; }
          .canvas-area { overflow: visible !important; height: auto !important; position: static !important; background: none !important; }
          .canvas-hint { display: none !important; }
          .list-wrapper { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; animation: none !important; opacity: 1 !important;}
          ${printMode === 'a4' ? `
            @page { size: A4 portrait; margin: 5mm; }
            .canvas-content { transform: none !important; position: static !important; display: flex !important; flex-wrap: wrap !important; flex-direction: row !important; gap: 0 !important; width: 100% !important; }
            .list-wrapper { display: block !important; width: 50% !important; box-sizing: border-box !important; padding: 0 2mm !important; page-break-after: auto !important; break-after: auto !important; page-break-inside: avoid !important; break-inside: avoid !important; }
            .list-wrapper:nth-child(2n) { page-break-after: always !important; break-after: page !important; }
            .list-wrapper:last-child { page-break-after: auto !important; break-after: auto !important; }
            .list-card-print { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 2px !important; box-shadow: none !important; border: none !important; }
          ` : `
            .canvas-content { transform: none !important; position: static !important; display: block !important; gap: 0 !important; }
            .list-wrapper { display: block !important; page-break-after: always !important; break-after: page !important; }
            .list-wrapper:last-child { page-break-after: auto !important; break-after: auto !important; }
            .list-card-print { width: 400px !important; max-width: 400px !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
          `}
        }
      `}</style>

      {uploadConfirm && (
        <UploadConfirmDialog weekKey={uploadConfirm.weekKey} title={uploadConfirm.title} existingTitle={uploadConfirm.existingTitle} contentChanged={true} onConfirm={handleUploadConfirm} onCancel={() => setUploadConfirm(null)} />
      )}
      {showCategoryConfig && (
        <CategoryConfigDialog open={showCategoryConfig} onClose={() => setShowCategoryConfig(false)} initialStore={selectedStore} onSaved={(storeCode, parts) => {
            if (selectedStore && selectedStore.code === storeCode) {
              setStoreParts(parts);
              if (parts.length > 0) {
                if (!parts.find(p => p.id === selectedPartId)) setSelectedPartId(parts[0].id);
              } else { setSelectedPartId(null); }
            }
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}