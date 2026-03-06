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

// Custom hook for responsive breakpoint
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

  // Upload confirm dialog state
  const [uploadConfirm, setUploadConfirm] = useState<{
    file: File;
    weekKey: string;
    title: string;
    existingTitle?: string;
    fileHash?: string;
  } | null>(null);

  // Cloud state
  const [cloudInfo, setCloudInfo] = useState<CloudFilesResponse | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);

  // Store state (PC: 전체 공유)
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Part Config state (영업점별 파트/조코드 설정)
  const [showCategoryConfig, setShowCategoryConfig] = useState(false);
  const [storeParts, setStoreParts] = useState<PartConfig[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  // Derived: 선택된 파트에서 카테고리 목록 + 순위 맵
  const selectedPart = storeParts.find(p => p.id === selectedPartId) || null;
  const activeCategories = selectedPart ? selectedPart.categories.map(c => c.code) : null;
  const categoryRanks = selectedPart
    ? Object.fromEntries(selectedPart.categories.map(c => [c.code, c.rank]))
    : undefined;

  // Canvas State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // 전역 에러 핸들러 설치 (1회)
  useEffect(() => {
    installGlobalErrorLogger();
  }, []);

  // 영업점 변경 시 파트 설정 불러오기 + 리스트 초기화
  useEffect(() => {
    if (!selectedStore) {
      setStoreParts([]);
      setSelectedPartId(null);
      return;
    }
    // 영업점 변경 시 리스트를 초기 상태로 리셋
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

  // 파트의 조코드별 ListCard 수동 불러오기
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

  // ============================
  // Cloud: Fetch & Download (자동 정렬)
  // ============================
  const loadFromCloud = useCallback(async (silent = false) => {
    setCloudLoading(true);
    try {
      const info = await fetchCloudFiles();
      setCloudInfo(info);

      let loaded = 0;

      // thisWeek = 가장 최근 주차 (서버에서 weekKey desc 정렬)
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

      // lastWeek = 두 번째 최근 주차
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
      // Edge Function 미배포 또는 네트워크 단절 시 조용히 처리
      // (silent=true인 초기 로딩에서는 사용자에게 노출 안 됨)
      console.warn('Cloud fetch warning:', e instanceof Error ? e.message : e);
      writeErrorLog('cloud_fetch', e);
      if (!silent) toast.error('클라우드 연결 실패');
    } finally {
      setCloudLoading(false);
    }
  }, []);

  // Auto-load from cloud on mount
  useEffect(() => {
    loadFromCloud(true);
  }, [loadFromCloud]);

  // Reset printMode after print dialog closes (cancel or print)
  useEffect(() => {
    const handler = () => setPrintMode(null);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  // ============================
  // File Upload Handler (단일 버튼)
  // 1. 용량 검증 (3MB 제한)
  // 2. 로컬 파싱 → weekKey 추출
  // 3. 파일 해시 계산 (SHA-256, <1ms for 70KB)
  // 4. 중복 체크 → 확인 다이얼로그
  // 5. 클라우드 업로드 (weekKey 기반 저장)
  // 6. 클라우드에서 최신 2개 다시 불러오기
  // ============================
  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

  const handleFileUpload = async (file: File) => {
    try {
      // 1. 용량 검증
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`파일 용량 초과: ${(file.size / 1024 / 1024).toFixed(1)}MB\n최대 3MB까지 업로드 가능합니다`);
        return;
      }

      // 2. 로컬 파싱
      const data = await parseExcel(file);

      // 3. weekKey 추출
      const weekKey = extractWeekKey(data.title);
      if (!weekKey) {
        toast.error(`주차 정보를 찾을 수 없습니다: "${data.title}"\n파일 타이틀에 "YYYY년 NN주" 형식이 필요합니다`);
        return;
      }

      // 4. 파일 해시 계산 (SHA-256, <1ms for 70KB)
      const fileHash = await computeFileHash(file);

      toast.success(`${data.title} (${weekKey}) 파싱 완료`);

      // 5. 중복 체크: 클라우드에 같은 weekKey가 이미 있는지 확인
      const existingFile = [cloudInfo?.thisWeek, cloudInfo?.lastWeek].find(
        (f) => f?.exists && f.weekKey === weekKey
      );

      if (existingFile) {
        // 5a. 해시 비교: 완전히 동일한 파일이면 업로드 스킵
        if (existingFile.fileHash && existingFile.fileHash === fileHash) {
          toast.info('동일한 파일이 이미 클라우드에 있습니다.\n업로드를 건너뜁니다.');
          return;
        }

        // 5b. weekKey 같지만 내용 다름 → 덮어쓰기 확인
        setUploadConfirm({
          file,
          weekKey,
          title: data.title,
          existingTitle: existingFile.title || existingFile.filename,
          fileHash,
        });
        return;
      }

      // 6. 중복 없으면 바로 업로드
      await doUpload(file, weekKey, data.title, fileHash);

    } catch (e) {
      console.error(e);
      writeErrorLog('file_parse', e);
      toast.error("파일 처리 실패");
    }
  };

  // 실제 업로드 실행
  const doUpload = async (file: File, weekKey: string, title: string, fileHash?: string) => {
    try {
      await uploadToCloud(file, weekKey, title, fileHash);
      toast.success(`${weekKey} 클라우드 업로드 완료`);
    } catch (e) {
      console.error('Cloud upload error:', e);
      writeErrorLog('cloud_upload', e);
      toast.error('클라우드 업로드 실패');
    }
    // 클라우드에서 최신 2개 다시 불러와서 this/last 자동 배치
    await loadFromCloud(true);
  };

  // 덮어쓰기 확인 핸들러
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

  // List Handlers
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

  // Canvas Interaction Handlers - use native event for preventDefault on passive wheel
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

  /** 드래그 시작 — 인터랙티브 요소(링크, 버튼 등) 위에서는 무시 */
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
    <div className="h-screen w-screen bg-[#e5e5e5] overflow-hidden flex flex-col font-sans main-desktop-wrapper">
      <Toaster position="top-center" />
      
      {/* Fixed Top Bar */}
      <div className="z-50 relative shadow-md topbar-wrapper">
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

      {/* Canvas Area */}
      <div 
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden canvas-area"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute top-4 left-4 z-40 bg-black/70 text-white px-3 py-1 rounded-full text-xs pointer-events-none canvas-hint">
          휠: 상하 이동 | Ctrl + 휠: 확대/축소 | 드래그: 자유 이동
        </div>

        {/* Scalable Content Container */}
        <div 
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            display: 'flex',
            gap: '40px',
            alignItems: 'flex-start',
            position: 'absolute'
          }}
          className={`canvas-content ${printingId ? "print:transform-none print:static" : ""}`}
        >
          {lists.map(list => (
            <div 
              key={list.id} 
              className={`list-wrapper ${printingId && printingId !== list.id ? "print:hidden" : "print:block"}`}
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
            </div>
          ))}
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
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
          }
          .topbar-wrapper { display: none !important; }
          .canvas-area {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
          }
          .canvas-hint { display: none !important; }

          ${printMode === 'a4' ? `
            /* ===== A4 모드: 리스트 2개를 A4 1장에 나란히 ===== */
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
            /* ===== 일반 모드: 리스트 1개당 1페이지 ===== */
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

      {/* Upload Confirm Dialog */}
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

      {/* Category Config Dialog */}
      {showCategoryConfig && (
        <CategoryConfigDialog
          open={showCategoryConfig}
          onClose={() => setShowCategoryConfig(false)}
          initialStore={selectedStore}
          onSaved={(storeCode, parts) => {
            // 현재 선택된 영업점과 같으면 바로 반영
            if (selectedStore && selectedStore.code === storeCode) {
              setStoreParts(parts);
              if (parts.length > 0) {
                // 기존 선택 파트가 있으면 유지, 없으면 첫 번째
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