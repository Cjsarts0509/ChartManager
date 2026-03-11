import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import ImageExt from '@tiptap/extension-image';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
  X, Plus, Trash2, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Image, Table as TableIcon,
  Heading1, Heading2, Heading3, Undo2, Redo2,
  Highlighter, Loader2, ChevronLeft, Lock, Pencil
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-22196a99`;

interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Custom Extension for Font Size ──
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
          renderHTML: attributes => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ── API helpers ──
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('Non-JSON response:', res.status, text.slice(0, 200));
    throw new Error(`서버 응답 오류 (${res.status}): 라우트를 찾을 수 없습니다.`);
  }
}

async function fetchNotices(): Promise<Notice[]> {
  const res = await fetch(`${API_BASE}/notices`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to fetch notices');
  return data.notices || [];
}

async function createNotice(password: string, title: string, content: string): Promise<Notice> {
  const res = await fetch(`${API_BASE}/notices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ password, title, content }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || '등록 실패');
  return data.notice;
}

async function updateNotice(id: string, password: string, title: string, content: string): Promise<Notice> {
  const res = await fetch(`${API_BASE}/notices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ password, title, content }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || '수정 실패');
  return data.notice;
}

async function deleteNotice(id: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notices/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ password }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || '삭제 실패');
}

// ── Password Dialog ──
function PasswordDialog({ onConfirm, onCancel, title }: {
  onConfirm: (pw: string) => void;
  onCancel: () => void;
  title: string;
}) {
  const [pw, setPw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-[320px] p-5" onClick={e => e.stopPropagation()} data-no-drag>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-gray-500" />
          <h3 className="font-bold text-sm text-gray-800">{title}</h3>
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pw && onConfirm(pw)}
          placeholder="암호를 입력하세요"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
          <button
            onClick={() => pw && onConfirm(pw)}
            disabled={!pw}
            className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >확인</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Color Picker ──
const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#6366f1',
];

// ── Editor Toolbar ──
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  
  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  );

  const addImage = () => {
    const url = prompt('이미지 URL을 입력하세요:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const closeAllPopups = () => {
    setShowColor(false);
    setShowHighlight(false);
    setShowFontSize(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50/80 rounded-t-lg relative">
      <Btn onClick={() => editor.chain().focus().undo().run()} title="실행취소"><Undo2 size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="다시실행"><Redo2 size={14} /></Btn>
      <div className="w-px h-4 bg-gray-300 mx-1" />
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="제목1"><Heading1 size={14} /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="제목2"><Heading2 size={14} /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="제목3"><Heading3 size={14} /></Btn>
      <div className="w-px h-4 bg-gray-300 mx-1" />
      
      {/* Font Size */}
      <div className="relative">
        <Btn onClick={() => { closeAllPopups(); setShowFontSize(!showFontSize); }} title="글자크기">
          <span className="text-[12px] font-bold px-1 tracking-tighter">12pt</span>
        </Btn>
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 z-[100] bg-white shadow-xl rounded-lg border p-1.5 flex flex-col w-20">
            {['12px', '14px', '16px', '18px', '20px', '24px', '30px'].map(size => (
              <button key={size} className="hover:bg-blue-50 text-[12px] py-1.5 px-2 rounded text-left font-medium"
                onClick={() => { editor.chain().focus().setFontSize(size).run(); setShowFontSize(false); }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-300 mx-1" />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게"><Bold size={14} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임"><Italic size={14} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄"><UnderlineIcon size={14} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선"><Strikethrough size={14} /></Btn>
      <div className="w-px h-4 bg-gray-300 mx-1" />

      {/* Text Color */}
      <div className="relative">
        <Btn onClick={() => { closeAllPopups(); setShowColor(!showColor); }} title="글자색">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold leading-none">A</span>
            <div className="w-3 h-1 rounded-sm mt-px" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }} />
          </div>
        </Btn>
        {showColor && (
          <div className="absolute top-full left-0 mt-1 z-[100] bg-white shadow-xl rounded-lg border p-2 grid grid-cols-5 gap-1.5 w-[140px]">
            {COLORS.map(c => (
              <button key={c} className="w-5 h-5 rounded-full border border-gray-200 hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => { editor.chain().focus().setColor(c).run(); setShowColor(false); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <Btn active={editor.isActive('highlight')} onClick={() => { closeAllPopups(); setShowHighlight(!showHighlight); }} title="형광펜">
          <Highlighter size={14} />
        </Btn>
        {showHighlight && (
          <div className="absolute top-full left-0 mt-1 z-[100] bg-white shadow-xl rounded-lg border p-2 grid grid-cols-4 gap-1.5 w-[120px]">
            {['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'].map(c => (
              <button key={c} className="w-5 h-5 rounded-full border border-gray-200 hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlight(false); }}
              />
            ))}
            <button className="w-5 h-5 rounded-full border border-gray-300 text-[9px] hover:scale-125 transition-transform flex items-center justify-center font-bold text-gray-500"
              onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlight(false); }}
            >X</button>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-300 mx-1" />
      <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="왼쪽정렬"><AlignLeft size={14} /></Btn>
      <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="가운데정렬"><AlignCenter size={14} /></Btn>
      <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="오른쪽정렬"><AlignRight size={14} /></Btn>
      <div className="w-px h-4 bg-gray-300 mx-1" />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="목록"><List size={14} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호목록"><ListOrdered size={14} /></Btn>
      <div className="w-px h-4 bg-gray-300 mx-1" />
      <Btn onClick={addTable} title="표 삽입"><TableIcon size={14} /></Btn>
      <Btn onClick={addImage} title="이미지 삽입"><Image size={14} /></Btn>

      {/* Table controls */}
      {editor.isActive('table') && (
        <div className="flex gap-1 ml-auto">
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">열+</button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">열-</button>
          <button onClick={() => editor.chain().focus().addRowAfter().run()} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">행+</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">행-</button>
        </div>
      )}
    </div>
  );
}

// ── Write/Edit Dialog ──
function WriteDialog({ initialData, onSave, onCancel, saving }: {
  initialData?: Notice | null;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ImageExt.configure({ inline: true, allowBase64: true }),
    ],
    content: initialData?.content || '<p></p>',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[350px] px-5 py-4' },
    },
  });

  return createPortal(
    // 외부 클릭 시 닫히지 않도록 bg-black/50 영역에서 onClick 이벤트를 제거했습니다.
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-[750px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-no-drag
      >
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
          <h2 className="font-bold text-base text-gray-800">{initialData ? '게시글 수정' : '게시글 작성'}</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full text-lg font-semibold border-b pb-2 outline-none focus:border-blue-500 placeholder-gray-300 transition-colors"
          />
        </div>

        {/* 툴바와 에디터 영역을 분리하여 드롭다운 메뉴가 잘리지 않게 구조 개선 */}
        <div className="flex flex-col flex-1 mx-5 mt-4 mb-4 border rounded-lg min-h-0 bg-white">
          <div className="shrink-0 border-b bg-gray-50/50 rounded-t-lg">
            <EditorToolbar editor={editor} />
          </div>
          <div className="flex-1 overflow-auto rounded-b-lg custom-scrollbar">
            <EditorContent editor={editor} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 shrink-0">
          <button onClick={onCancel} className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium">취소</button>
          <button
            onClick={() => {
              if (!title.trim()) { alert('제목을 입력해주세요.'); return; }
              if (!editor?.getHTML() || editor.isEmpty) { alert('내용을 입력해주세요.'); return; }
              onSave(title.trim(), editor.getHTML());
            }}
            disabled={saving || !title.trim()}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5 font-bold transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── View Dialog ──
function ViewDialog({ notice, onClose, onEdit, onDelete }: {
  notice: Notice;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-no-drag
      >
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-bold text-lg text-gray-800 truncate mb-1">{notice.title}</h2>
            <div className="text-xs text-gray-400">
              {formatDate(notice.createdAt)}
              {notice.updatedAt && <span className="ml-2 pl-2 border-l border-gray-300">수정됨: {formatDate(notice.updatedAt)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* 수정 버튼 추가 */}
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors font-medium"
            >
              <Pencil size={13} />수정
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-200 transition-colors font-medium"
            >
              <Trash2 size={13} />삭제
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 custom-scrollbar bg-white">
          <div
            className="prose prose-sm max-w-none notice-content"
            dangerouslySetInnerHTML={{ __html: notice.content }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Inline Notice Panel (for TopBar) ──
interface InlineNoticePanelProps {
  className?: string;
}

export const InlineNoticePanel: React.FC<InlineNoticePanelProps> = ({ className }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewNotice, setViewNotice] = useState<Notice | null>(null);
  const [editData, setEditData] = useState<Notice | null>(null);
  const [pwDialog, setPwDialog] = useState<{ action: 'write' | 'edit' | 'delete'; payload?: any } | null>(null);
  const pendingPw = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchNotices();
      setNotices(list);
    } catch (e) {
      console.error('Notice load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWriteClick = () => {
    setEditData(null);
    setPwDialog({ action: 'write' });
  };

  const handleEditClick = () => {
    if (!viewNotice) return;
    setPwDialog({ action: 'edit', payload: viewNotice });
  };

  const handleDeleteClick = () => {
    if (!viewNotice) return;
    setPwDialog({ action: 'delete', payload: viewNotice.id });
  };

  const handleSave = async (title: string, content: string) => {
    const pw = pendingPw.current;
    if (!pw) return;
    setSaving(true);
    try {
      if (editData) {
        await updateNotice(editData.id, pw, title, content);
      } else {
        await createNotice(pw, title, content);
      }
      pendingPw.current = null;
      setShowWrite(false);
      await load();
    } catch (e: any) {
      alert(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handlePwConfirm = async (pw: string) => {
    const action = pwDialog?.action;
    const payload = pwDialog?.payload;
    setPwDialog(null);

    if (action === 'write') {
      pendingPw.current = pw;
      setEditData(null);
      setShowWrite(true);
    } else if (action === 'edit' && payload) {
      pendingPw.current = pw;
      setEditData(payload);
      setViewNotice(null);
      setShowWrite(true);
    } else if (action === 'delete' && payload) {
      try {
        await deleteNotice(payload, pw);
        setViewNotice(null);
        await load();
      } catch (e: any) {
        alert(e.message || '삭제 실패');
      }
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  return (
    <>
      <div className={`flex overflow-hidden border border-gray-200 rounded-lg ${className || ''}`} data-no-drag>
        <div className="flex-1 bg-white flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Loader2 size={12} className="animate-spin mr-1" />
                <span className="text-[10px]">로딩...</span>
              </div>
            ) : notices.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <span className="text-[10px]">등록된 공지가 없습니다</span>
              </div>
            ) : (
              notices.slice(0, 5).map((n, idx) => (
                <button
                  key={n.id}
                  onClick={() => setViewNotice(n)}
                  className={`w-full text-left px-3 py-1 flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                    idx < Math.min(notices.length, 5) - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-gray-700 truncate">{n.title}</div>
                  </div>
                  <span className="text-[9px] text-gray-400 shrink-0">{formatDate(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <button
          onClick={handleWriteClick}
          className="flex flex-col items-center justify-center w-[44px] shrink-0 bg-gray-50 hover:bg-blue-50 border-l border-gray-200 transition-colors text-gray-500 hover:text-blue-600"
        >
          <Plus size={16} />
          <span className="text-[9px] font-bold mt-1">작성</span>
        </button>
      </div>

      {showWrite && (
        <WriteDialog
          initialData={editData}
          onSave={handleSave}
          onCancel={() => setShowWrite(false)}
          saving={saving}
        />
      )}
      {viewNotice && (
        <ViewDialog
          notice={viewNotice}
          onClose={() => setViewNotice(null)}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      )}
      {pwDialog && (
        <PasswordDialog
          title={pwDialog.action === 'write' ? '게시글 작성 암호' : pwDialog.action === 'edit' ? '게시글 수정 암호' : '게시글 삭제 암호'}
          onConfirm={handlePwConfirm}
          onCancel={() => setPwDialog(null)}
        />
      )}

      {/* TipTap content styles */}
      <style>{`
        .notice-content h1 { font-size: 1.8em; font-weight: 700; margin: 0.5em 0; }
        .notice-content h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; }
        .notice-content h3 { font-size: 1.25em; font-weight: 600; margin: 0.4em 0; }
        .notice-content p { margin: 0.3em 0; line-height: 1.6; }
        .notice-content ul { list-style: disc; padding-left: 1.5em; margin: 0.3em 0; }
        .notice-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.3em 0; }
        .notice-content table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .notice-content th, .notice-content td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        .notice-content th { background: #f3f4f6; font-weight: 600; }
        .notice-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .notice-content mark { padding: 2px 4px; border-radius: 4px; }
        .notice-content blockquote { border-left: 4px solid #9ca3af; padding-left: 1em; color: #4b5563; margin: 0.5em 0; font-style: italic; background: #f9fafb; padding: 10px; border-radius: 0 8px 8px 0; }

        .tiptap { min-height: 350px; }
        .tiptap:focus { outline: none; }
        .tiptap h1 { font-size: 1.8em; font-weight: 700; margin: 0.5em 0; }
        .tiptap h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; }
        .tiptap h3 { font-size: 1.25em; font-weight: 600; margin: 0.4em 0; }
        .tiptap p { margin: 0.3em 0; line-height: 1.6; }
        .tiptap ul { list-style: disc; padding-left: 1.5em; margin: 0.3em 0; }
        .tiptap ol { list-style: decimal; padding-left: 1.5em; margin: 0.3em 0; }
        .tiptap table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .tiptap th, .tiptap td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; min-width: 50px; position: relative; }
        .tiptap th { background: #f3f4f6; font-weight: 600; }
        .tiptap img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
        .tiptap mark { padding: 2px 4px; border-radius: 4px; }
        .tiptap blockquote { border-left: 4px solid #9ca3af; padding-left: 1em; color: #4b5563; margin: 0.5em 0; font-style: italic; background: #f9fafb; padding: 10px; border-radius: 0 8px 8px 0; }
        .tiptap .selectedCell { background: #dbeafe; }
        
        /* 스크롤바 디자인 */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </>
  );
};