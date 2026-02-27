import React, { useState } from 'react';
import { X, Loader2, ImageOff } from 'lucide-react';

interface BookCoverModalProps {
  isbn: string;
  bookTitle: string;
  onClose: () => void;
}

export const BookCoverModal: React.FC<BookCoverModalProps> = ({ isbn, bookTitle, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ISBN에서 하이픈 제거하여 순수 숫자만 추출
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  const imageUrl = `https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/${cleanIsbn}.jpg`;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 mr-3">
            <p className="text-sm text-gray-900 truncate font-semibold">{bookTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{isbn}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors shrink-0"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Image Area */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-auto">
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 size={28} className="text-gray-400 animate-spin" />
            </div>
          )}
          
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <ImageOff size={40} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">ISBN: {isbn}</p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={bookTitle}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
              style={{ width: 'auto', height: 'auto' }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
