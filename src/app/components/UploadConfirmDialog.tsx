import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface UploadConfirmDialogProps {
  weekKey: string;
  title: string;
  existingTitle?: string;
  contentChanged?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const UploadConfirmDialog: React.FC<UploadConfirmDialogProps> = ({
  weekKey,
  title,
  existingTitle,
  contentChanged = false,
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
          <div className={`p-2.5 rounded-full shrink-0 ${contentChanged ? 'bg-red-100' : 'bg-amber-100'}`}>
            {contentChanged 
              ? <ShieldAlert size={24} className="text-red-600" />
              : <AlertTriangle size={24} className="text-amber-600" />
            }
          </div>
          <div>
            <h3 className="font-bold text-gray-900">동일 주차 파일 존재</h3>
            <p className="text-sm text-gray-500 mt-0.5">덮어쓰시겠습니까?</p>
          </div>
        </div>

        {/* Content Changed Warning */}
        {contentChanged && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-700 font-bold">파일 내용이 다릅니다</p>
              <p className="text-red-600 mt-0.5">
                같은 주차이지만 기존 파일과 내용이 일치하지 않습니다.
                의도된 수정인지 확인 후 덮어쓰기하세요.
              </p>
            </div>
          </div>
        )}

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
            className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors text-sm font-bold ${
              contentChanged 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            덮어쓰기
          </button>
        </div>
      </div>
    </div>
  );
};