import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { ListCard } from './components/ListCard';
import { MobileView } from './components/MobileView';
import { ProcessedData } from '../lib/types';
import { parseExcel, parseExcelFromBuffer, extractWeekKey } from '../lib/excel';
import { fetchCloudFiles, uploadToCloud, downloadFileAsBuffer, CloudFilesResponse } from '../lib/cloud';
import { Toaster, toast } from 'sonner';

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
  const [lists, setLists] = useState<{ id: string }[]>([{ id: 'init-1' }]);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Cloud state
  const [cloudInfo, setCloudInfo] = useState<CloudFilesResponse | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);

  // Canvas State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

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
      console.error('Cloud fetch error:', e);
      if (!silent) toast.error('클라우드 연결 실패');
    } finally {
      setCloudLoading(false);
    }
  }, []);

  // Auto-load from cloud on mount
  useEffect(() => {
    loadFromCloud(true);
  }, [loadFromCloud]);

  // ============================
  // File Upload Handler (단일 버튼)
  // 1. 로컬 파싱 → weekKey 추출
  // 2. 클라우드 업로드 (weekKey 기반 저장)
  // 3. 클라우드에서 최신 2개 다시 불러오기
  // ============================
  const handleFileUpload = async (file: File) => {
    try {
      // 1. 로컬 파싱
      const data = await parseExcel(file);

      // 2. weekKey 추출
      const weekKey = extractWeekKey(data.title);
      if (!weekKey) {
        toast.error(`주차 정보를 찾을 수 없습니다: "${data.title}"\n파일 타이틀에 "YYYY년 NN주" 형식이 필요합니다`);
        return;
      }

      toast.success(`${data.title} (${weekKey}) 파싱 완료`);

      // 3. 클라우드 업로드
      try {
        await uploadToCloud(file, weekKey, data.title);
        toast.success(`${weekKey} 클라우드 업로드 완료`);
      } catch (e) {
        console.error('Cloud upload error:', e);
        toast.error('클라우드 업로드 실패');
      }

      // 4. 클라우드에서 최신 2개 다시 불러와서 this/last 자동 배치
      await loadFromCloud(true);

    } catch (e) {
      console.error(e);
      toast.error("파일 처리 실패");
    }
  };

  // List Handlers
  const handleAddList = () => setLists(prev => [...prev, { id: `list-${Date.now()}` }]);
  const handleDeleteList = (id: string) => setLists(prev => prev.filter(l => l.id !== id));
  
  const handleGlobalPrint = () => window.print();
  const handlePrintCard = (id: string) => {
    setPrintingId(id);
    setTimeout(() => { window.print(); setPrintingId(null); }, 100);
  };

  // Canvas Interaction Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3);
      setScale(newScale);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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
      <>
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
      </>
    );
  }

  return (
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
          cloudInfo={cloudInfo}
          cloudLoading={cloudLoading}
          onRefreshCloud={() => loadFromCloud(false)}
        />
      </div>

      {/* Canvas Area */}
      <div 
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden canvas-area"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute top-4 left-4 z-40 bg-black/70 text-white px-3 py-1 rounded-full text-xs pointer-events-none canvas-hint">
          Ctrl + 휠: 확대/축소 | 드래그: 이동
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
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ListCard 
                id={list.id}
                thisWeekBooks={thisWeekData.books}
                lastWeekBooks={lastWeekData.books}
                title={thisWeekData.title}
                lastWeekTitle={lastWeekData.title}
                onDelete={() => handleDeleteList(list.id)}
                onPrint={handlePrintCard}
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
        }
      `}</style>
    </div>
  );
}
