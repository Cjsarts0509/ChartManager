import React, { useState } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';

interface KioskModalProps {
  isbn: string;
  bookTitle: string;
  storeCode: string;
  storeName: string;
  onClose: () => void;
}

export const KioskModal: React.FC<KioskModalProps> = ({ isbn, bookTitle, storeCode, storeName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  const kioskUrl = `https://kiosk.kyobobook.co.kr/bookInfoInk?site=${storeCode}&barcode=${cleanIsbn}&ejkGb=KOR`;

  const handleOpenExternal = () => {
    window.open(kioskUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '85vh', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
          <div className="min-w-0 mr-3 flex-1">
            <p className="text-sm text-gray-900 truncate font-semibold">{bookTitle}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-400 font-mono">{isbn}</span>
              <span className="text-[10px] text-emerald-600 font-semibold">{storeName} ({storeCode})</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleOpenExternal}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
              title="새 탭에서 열기"
            >
              <ExternalLink size={14} className="text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Iframe Content */}
        <div className="flex-1 relative min-h-0 bg-gray-50">
          {loading && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
              <Loader2 size={28} className="text-gray-400 animate-spin mb-3" />
              <p className="text-xs text-gray-400">페이지 로딩 중...</p>
            </div>
          )}

          {iframeError ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <p className="text-sm text-gray-500 mb-2">페이지를 표시할 수 없습니다</p>
              <p className="text-xs text-gray-400 mb-4">외부 사이트 정책으로 인해 내장 표시가 제한될 수 있습니다</p>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <ExternalLink size={14} />
                새 탭에서 열기
              </button>
            </div>
          ) : (
            <iframe
              src={kioskUrl}
              className="w-full h-full border-none"
              title={`${bookTitle} - 키오스크`}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setIframeError(true); }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}
        </div>
      </div>
    </div>
  );
};
