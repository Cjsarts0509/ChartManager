import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface UploadConfirmDialogProps {
  weekKey: string;
  title: string;
  existingTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const UploadConfirmDialog: React.FC<UploadConfirmDialogProps> = ({
  weekKey,
  title,
  existingTitle,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-[90%] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-100 p-2.5 rounded-full shrink-0">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">동일 주차 파일 존재</h3>
            <p className="text-sm text-gray-500 mt-0.5">덮어쓰시겠습니까?</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">주차 키</span>
            <span className="font-mono font-bold text-gray-800">{weekKey}</span>
          </div>
          {existingTitle && (
            <div className="flex justify-between">
              <span className="text-gray-500">기존 파일</span>
              <span className="text-gray-700 text-right max-w-[200px] truncate">{existingTitle}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">새 파일</span>
            <span className="text-gray-700 text-right max-w-[200px] truncate">{title}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-bold"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm font-bold"
          >
            덮어쓰기
          </button>
        </div>
      </div>
    </div>
  );
};
