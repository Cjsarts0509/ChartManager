import React, { useRef } from 'react';
import { Upload, Plus, Printer, ExternalLink, RefreshCw, Cloud } from 'lucide-react';
import { CloudFilesResponse } from '../../lib/cloud';

interface TopBarProps {
  titleThisWeek: string;
  titleLastWeek: string;
  onUploadFile: (file: File) => void;
  onAddList: () => void;
  onPrint: () => void;
  cloudInfo: CloudFilesResponse | null;
  cloudLoading: boolean;
  onRefreshCloud: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  titleThisWeek,
  titleLastWeek,
  onUploadFile,
  onAddList,
  onPrint,
  cloudInfo,
  cloudLoading,
  onRefreshCloud
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const BOARD_URL = "https://link.kyobobook.co.kr/po/board?MENUID=316&SYSID=14&_t=1772194249235";

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const thisWeekCloud = cloudInfo?.thisWeek;
  const lastWeekCloud = cloudInfo?.lastWeek;

  return (
    <div className="bg-white border-b border-gray-300 p-3 shadow-sm print:hidden">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Left: File Upload + Cloud Status */}
        <div className="flex flex-1 gap-3 w-full md:w-auto items-stretch">

          {/* Upload Button Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 cursor-pointer transition-colors min-w-[140px]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} className="text-gray-500" />
            <span className="text-xs font-bold text-gray-600">엑셀 파일 업로드</span>
            <span className="text-[10px] text-gray-400">주차 자동 인식</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
            />
          </div>

          {/* Cloud File Status */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {/* This Week */}
            <div className="border rounded-md px-3 py-1.5 bg-white flex items-center gap-2 min-h-[32px]">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">최신</span>
              {thisWeekCloud?.exists ? (
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-800 truncate">{thisWeekCloud.title || thisWeekCloud.filename}</span>
                  <span className="text-[10px] text-gray-400 shrink-0 font-mono">{thisWeekCloud.weekKey}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatDate(thisWeekCloud.uploadedAt)}</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400 truncate">{titleThisWeek || "파일 없음"}</span>
              )}
            </div>

            {/* Last Week */}
            <div className="border rounded-md px-3 py-1.5 bg-white flex items-center gap-2 min-h-[32px]">
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">이전</span>
              {lastWeekCloud?.exists ? (
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-800 truncate">{lastWeekCloud.title || lastWeekCloud.filename}</span>
                  <span className="text-[10px] text-gray-400 shrink-0 font-mono">{lastWeekCloud.weekKey}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatDate(lastWeekCloud.uploadedAt)}</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400 truncate">{titleLastWeek || "파일 없음"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex gap-2 w-full md:w-auto justify-end shrink-0">
          <button 
            onClick={onRefreshCloud}
            disabled={cloudLoading}
            className="flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 w-[70px] h-14 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={`mb-0.5 ${cloudLoading ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-bold">{cloudLoading ? '동기화중' : '클라우드'}</span>
          </button>

          <a
            href={BOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 w-[70px] h-14 rounded-md transition-colors"
          >
            <ExternalLink size={20} className="mb-0.5" />
            <span className="text-[10px] font-bold">게시판</span>
          </a>

          <button 
            onClick={onAddList}
            className="flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 w-[70px] h-14 rounded-md transition-colors"
          >
            <Plus size={20} className="mb-0.5" />
            <span className="text-[10px] font-bold">페이지추가</span>
          </button>

          <button 
            onClick={onPrint}
            className="flex flex-col items-center justify-center bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 w-[70px] h-14 rounded-md transition-colors"
          >
            <Printer size={20} className="mb-0.5" />
            <span className="text-[10px] font-bold">전체인쇄</span>
          </button>
        </div>

      </div>
    </div>
  );
};
