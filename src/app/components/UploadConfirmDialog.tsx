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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-indigo-900/30 backdrop-blur-[24px]" onClick={onCancel}>
      <div 
        className="glass-panel bg-white/60 backdrop-blur-3xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-white/60 p-6 max-w-md w-[90%] mx-4"
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
            <h3 className="font-bold text-indigo-900">동일 주차 파일 존재</h3>
            <p className="text-sm font-bold text-indigo-600 mt-0.5">덮어쓰시겠습니까?</p>
          </div>
        </div>

        {/* Content Changed Warning */}
        {contentChanged && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2.5 shadow-sm">
            <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-800 font-bold">파일 내용이 다릅니다</p>
              <p className="text-red-600 font-bold mt-0.5">
                같은 주차이지만 기존 파일과 내용이 일치하지 않습니다.
                의도된 수정인지 확인 후 덮어쓰기하세요.
              </p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-indigo-50/80 rounded-lg p-4 mb-5 space-y-2 text-sm border border-indigo-100 shadow-inner">
          <div className="flex justify-between">
            <span className="text-indigo-600 font-bold">주차 키</span>
            <span className="font-mono font-bold text-indigo-900">{weekKey}</span>
          </div>
          {existingTitle && (
            <div className="flex justify-between">
              <span className="text-indigo-600 font-bold">기존 파일</span>
              <span className="text-indigo-900 font-bold text-right max-w-[200px] truncate">{existingTitle}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-indigo-600 font-bold">새 파일</span>
            <span className="text-indigo-900 font-bold text-right max-w-[200px] truncate">{title}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-rose-100 hover:bg-rose-200 border-rose-300 rounded-xl text-rose-700 transition-colors text-sm font-bold shadow-sm"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-xl transition-colors text-sm font-bold shadow-sm ${
              contentChanged 
                ? 'bg-red-600 hover:bg-red-700' 
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