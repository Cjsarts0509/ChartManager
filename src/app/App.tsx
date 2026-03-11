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

// ==========================================
// Custom Cursor Component (마이크로 애니메이션)
// ==========================================
const CustomCursor = () => {
  const mainCursor = useRef<HTMLDivElement>(null);
  const ringCursor = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const mousePos = useRef({ x: 0, y: 0 });
  const mainPos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number>();

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    const onMouseDown = () => {
      setIsClicking(true);
      // 클릭 시 방사형 파티클 6개 생성
      const newParticles = Array.from({ length: 6 }).map((_, i) => ({
        id: Date.now() + i,
        x: mousePos.current.x,
        y: mousePos.current.y
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 600); // 파티클 애니메이션 후 정리
    };
    const onMouseUp = () => setIsClicking(false);

    const updateHoverState = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, button, input, select, textarea, [role="button"], .cursor-pointer')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseover', updateHoverState);

    const loop = () => {
      // Main Cursor Lerp (0.15 추적)
      mainPos.current.x += (mousePos.current.x - mainPos.current.x) * 0.15;
      mainPos.current.y += (mousePos.current.y - mainPos.current.y) * 0.15;
      
      // Ring Cursor Lerp (0.08 관성)
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.08;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.08;

      if (mainCursor.current) {
        mainCursor.current.style.transform = `translate3d(${mainPos.current.x}px, ${mainPos.current.y}px, 0) scale(${isClicking ? 0.7 : isHovering ? 1.3 : 1})`;
      }
      if (ringCursor.current) {
        ringCursor.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) scale(${isClicking ? 0.9 : isHovering ? 1.5 : 1})`;
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mouseover', updateHoverState);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isClicking, isHovering]);

  return (
    <>
      <style>{`
        body { cursor: none; }
        @media print { .custom-cursor-layer { display: none !important; } body { cursor: auto; } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 10px 2px rgba(34,197,94,0.3); } 50% { box-shadow: 0 0 20px 6px rgba(34,197,94,0.6); } }
        @keyframes particleBurst { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
      `}</style>
      <div className="custom-cursor-layer fixed inset-0 pointer-events-none z-[99999]">
        {/* Glow Ring */}
        <div ref={ringCursor} className="absolute top-0 left-0 w-8 h-8 -ml-4 -mt-4 rounded-full border border-green-400/50 mix-blend-difference transition-transform duration-100 ease-out" style={{ animation: 'glowPulse 2s infinite ease-in-out' }} />
        {/* Main Dot */}
        <div ref={mainCursor} className="absolute top-0 left-0 w-3 h-3 -ml-1.5 -mt-1.5 bg-green-500 rounded-full mix-blend-difference transition-transform duration-75 ease-out shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
        {/* Particles */}
        {particles.map((p, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const dist = 40;
          return (
            <div key={p.id} className="absolute w-2 h-2 bg-green-400 rounded-full"
                 style={{
                   left: p.x, top: p.y,
                   '--tx': `${Math.cos(angle) * dist}px`, '--ty': `${Math.sin(angle) * dist}px`,
                   animation: 'particleBurst 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
                 } as React.CSSProperties}
            />
          );
        })}
      </div>
    </>
  );
};

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

  useEffect(() => {
    installGlobalErrorLogger();
  }, []);

  useEffect(() => {
    if (!selectedStore) {
      setStoreParts([]);
      setSelectedPartId(null);
      return;
    }
    setLists([{ id: 'init-1' }]);
    setPosition({ x: 50, y: 50 });

    let cancelled = false;
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      if (config && config.length > 0) {
        setStoreParts(config);
        setSelectedPartId(config[0].id);
      } else {
        setStoreParts(getDefaultParts());
        setSelectedPartId(getDefaultParts()[0].id);
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
      setLists(autoLists);
      setPosition({ x: 50, y: 50 });
      toast.success(`${selectedPart.name} 파트의 ${selectedPart.categories.length}개 리스트를 불러왔습니다`);
    } else {
      toast.info('선택된 파트에 등록된 조코드가 없습니다');
    }
  }, [selectedPart]);

  const handleClearLists = useCallback(() => {
    setLists([{ id: 'init-1' }]);
    setPosition({ x: 50, y: 50 });
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
        try {
          const buffer = await downloadFileAsBuffer(info.thisWeek.url);
          const data = parseExcelFromBuffer(buffer);
          setThisWeekData(data);
          loaded++;
        } catch (e) {
          console.error('Failed to parse thisWeek file:', e);
        }
      }

      if (info.lastWeek?.exists && info.lastWeek.url) {
        try {
          const buffer = await downloadFileAsBuffer(info.lastWeek.url);
          const data = parseExcelFromBuffer(buffer);
          setLastWeekData(data);
          loaded++;
        } catch (e) {
          console.error('Failed to parse lastWeek file:', e);
        }
      }

      if (!silent) {
        if (loaded > 0) {
          toast.success(`클라우드에서 ${loaded}개 파일을 불러왔습니다`);
        } else {
          toast.info('클라우드에 업로드된 파일이 없습니다');
        }
      }
    } catch (e) {
      console.warn('Cloud fetch warning:', e instanceof Error ? e.message : e);
      writeErrorLog('cloud_fetch', e);
      if (!silent) toast.error('클라우드 연결 실패');
    } finally {
      setCloudLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromCloud(true);
  }, [loadFromCloud]);

  useEffect(() => {
    const handler = () => setPrintMode(null);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const MAX_FILE_SIZE = 3 * 1024 * 1024;

  const handleFileUpload = async (file: File) => {
    try {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`파일 용량 초과: ${(file.size / 1024 / 1024).toFixed(1)}MB\n최대 3MB까지 업로드 가능합니다`);
        return;
      }

      const data = await parseExcel(file);
      const weekKey = extractWeekKey(data.title);
      if (!weekKey) {
        toast.error(`주차 정보를 찾을 수 없습니다: "${data.title}"\n파일 타이틀에 "YYYY년 NN주" 형식이 필요합니다`);
        return;
      }

      const fileHash = await computeFileHash(file);
      toast.success(`${data.title} (${weekKey}) 파싱 완료`);

      const existingFile = [cloudInfo?.thisWeek, cloudInfo?.lastWeek].find(
        (f) => f?.exists && f.weekKey === weekKey
      );

      if (existingFile) {
        if (existingFile.fileHash && existingFile.fileHash === fileHash) {
          toast.info('동일한 파일이 이미 클라우드에 있습니다.\n업로드를 건너뜁니다.');
          return;
        }

        setUploadConfirm({
          file,
          weekKey,
          title: data.title,
          existingTitle: existingFile.title || existingFile.filename,
          fileHash,
        });
        return;
      }

      await doUpload(file, weekKey, data.title, fileHash);

    } catch (e) {
      console.error(e);
      writeErrorLog('file_parse', e);
      toast.error("파일 처리 실패");
    }
  };

  const doUpload = async (file: File, weekKey: string, title: string, fileHash?: string) => {
    try {
      await uploadToCloud(file, weekKey, title, fileHash);
      toast.success(`${weekKey} 클라우드 업로드 완료`);
    } catch (e) {
      console.error('Cloud upload error:', e);
      writeErrorLog('cloud_upload', e);
      toast.error('클라우드 업로드 실패');
    }
    await loadFromCloud(true);
  };

  const handleUploadConfirm = async () => {
    if (!uploadConfirm) return;
    const { file, weekKey, title, fileHash } = uploadConfirm;
    setUploadConfirm(null);
    await doUpload(file, weekKey, title, fileHash);
  };

  const handleUploadCancel = () => {
    setUploadConfirm(null);
    toast.info('업로드 취소됨');
  };

  const handleAddList = () => setLists(prev => [...prev, { id: `list-${Date.now()}` }]);
  const handleDeleteList = (id: string) => setLists(prev => prev.filter(l => l.id !== id));
  
  const handleGlobalPrint = () => window.print();
  const handleGlobalPrintA4 = () => {
    setPrintMode('a4');
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };
  const handlePrintCard = (id: string) => {
    setPrintingId(id);
    setTimeout(() => { window.print(); setPrintingId(null); }, 100);
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const zoomSensitivity = 0.001;
        setScale(prev => Math.min(Math.max(0.1, prev - e.deltaY * zoomSensitivity), 3));
      } else {
        const scrollSpeed = 1.5;
        setPosition(prev => ({
          x: prev.x - (e.shiftKey ? e.deltaY : e.deltaX) * scrollSpeed,
          y: prev.y - (e.shiftKey ? 0 : e.deltaY) * scrollSpeed
        }));
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
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (isMobile) {
    return (
      <ErrorBoundary>
        <Toaster position="top-center" />
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
    <div className="h-screen w-screen bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-blue-50/50 overflow-hidden flex flex-col font-sans main-desktop-wrapper text-slate-800 relative">
      {!isMobile && <CustomCursor />}
      <Toaster position="top-center" />
      
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
        className="flex-1 relative overflow-hidden canvas-area"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(15, 23, 42, 0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute top-5 left-5 z-40 glass-panel shadow-sm text-slate-700 px-4 py-2 rounded-2xl text-xs font-medium pointer-events-none canvas-hint transition-all duration-300">
          ✨ 휠: 상하 이동 | Ctrl + 휠: 확대/축소 | 드래그: 자유 이동
        </div>

        <div 
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            display: 'flex',
            gap: '48px',
            alignItems: 'flex-start',
            position: 'absolute'
          }}
          className={`canvas-content ${printingId ? "print:transform-none print:static" : ""}`}
        >
          {lists.map(list => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              key={list.id} 
              className={`list-wrapper smooth-transition hover:-translate-y-2 hover:shadow-2xl rounded-[2rem] p-2 ${printingId && printingId !== list.id ? "print:hidden" : "print:block"}`}
            >
              <ListCard 
                id={list.id}
                thisWeekBooks={thisWeekData.books}
                lastWeekBooks={lastWeekData.books}
                title={thisWeekData.title}
                lastWeekTitle={lastWeekData.title}
                onDelete={() => handleDeleteList(list.id)}
                onPrint={handlePrintCard}
                storeCode={selectedStore?.code}
                storeName={selectedStore?.name}
                availableCategories={activeCategories || undefined}
                categoryRanks={categoryRanks}
                defaultGroupCode={list.defaultGroupCode}
                defaultLimit={list.defaultLimit}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        /* 인쇄 스타일은 기능이므로 손대지 않음 */
        @media print {
          @page { margin: 5mm; }
          body, html {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: visible !important;
            height: auto !important;
            width: auto !important;
          }
          .main-desktop-wrapper {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
          }
          .topbar-wrapper { display: none !important; }
          .canvas-area {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
            background: none !important;
          }
          .canvas-hint { display: none !important; }
          .list-wrapper { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; }

          ${printMode === 'a4' ? `
            @page { size: A4 portrait; margin: 5mm; }
            .canvas-content {
              transform: none !important;
              position: static !important;
              display: flex !important;
              flex-wrap: wrap !important;
              flex-direction: row !important;
              gap: 0 !important;
              width: 100% !important;
            }
            .list-wrapper {
              display: block !important;
              width: 50% !important;
              box-sizing: border-box !important;
              padding: 0 2mm !important;
              page-break-after: auto !important;
              break-after: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .list-wrapper:nth-child(2n) {
              page-break-after: always !important;
              break-after: page !important;
            }
            .list-wrapper:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .list-card-print {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 2px !important;
              box-shadow: none !important;
              border: none !important;
            }
          ` : `
            .canvas-content {
              transform: none !important;
              position: static !important;
              display: block !important;
              gap: 0 !important;
            }
            .list-wrapper {
              display: block !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            .list-wrapper:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .list-card-print {
              width: 400px !important;
              max-width: 400px !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
          `}
        }
      `}</style>

      {uploadConfirm && (
        <UploadConfirmDialog
          weekKey={uploadConfirm.weekKey}
          title={uploadConfirm.title}
          existingTitle={uploadConfirm.existingTitle}
          contentChanged={true}
          onConfirm={handleUploadConfirm}
          onCancel={handleUploadCancel}
        />
      )}

      {showCategoryConfig && (
        <CategoryConfigDialog
          open={showCategoryConfig}
          onClose={() => setShowCategoryConfig(false)}
          initialStore={selectedStore}
          onSaved={(storeCode, parts) => {
            if (selectedStore && selectedStore.code === storeCode) {
              setStoreParts(parts);
              if (parts.length > 0) {
                const stillExists = parts.find(p => p.id === selectedPartId);
                if (!stillExists) setSelectedPartId(parts[0].id);
              } else {
                setSelectedPartId(null);
              }
            }
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}