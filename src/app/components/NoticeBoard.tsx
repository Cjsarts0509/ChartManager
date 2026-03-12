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
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Trash2, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Image, Table as TableIcon,
  Heading1, Heading2, Heading3, Undo2, Redo2,
  Highlighter, Loader2, Lock, Pencil, Bell
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

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); } 
  catch { throw new Error(`서버 응답 오류 (${res.status})`); }
}

async function fetchNotices(): Promise<Notice[]> {
  const res = await fetch(`${API_BASE}/notices`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
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

function PasswordDialog({ onConfirm, onCancel, title }: {
  onConfirm: (pw: string) => void;
  onCancel: () => void;
  title: string;
}) {
  const [pw, setPw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-[12px]" onClick={onCancel}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/90 backdrop-blur-xl border border-white shadow-[0_30px_60px_rgba(0,0,0,0.12)] rounded-3xl p-6 w-[320px]" 
        onClick={e => e.stopPropagation()} 
        data-no-drag
      >
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-slate-600" />
          <h3 className="font-bold text-sm text-slate-800">{title}</h3>
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pw && onConfirm(pw)}
          placeholder="암호를 입력하세요"
          className="w-full border border-slate-200/80 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 mb-4 outline-none focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] bg-white/50 placeholder-slate-400 smooth-transition"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700 rounded-xl smooth-transition active:scale-95">취소</button>
          <button
            onClick={() => pw && onConfirm(pw)}
            disabled={!pw}
            className="px-4 py-2 text-xs font-bold bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 border border-blue-600 text-white rounded-xl shadow-[0_4px_12px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:pointer-events-none smooth-transition active:scale-95"
          >확인</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#6366f1',
];

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  
  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg smooth-transition active:scale-95 font-bold ${active ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
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
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-slate-50/50 backdrop-blur-md rounded-t-2xl relative border-b border-slate-200/60">
      <Btn onClick={() => editor.chain().focus().undo().run()} title="실행취소"><Undo2 size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="다시실행"><Redo2 size={14} /></Btn>
      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="제목1"><Heading1 size={14} /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="제목2"><Heading2 size={14} /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="제목3"><Heading3 size={14} /></Btn>
      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />
      
      <div className="flex items-center border border-slate-200/80 bg-white/80 rounded-lg shadow-sm overflow-hidden h-[28px] mx-1">
        <button type="button" onClick={() => { closeAllPopups(); const current = editor.getAttributes('textStyle').fontSize || '16px'; const num = parseInt(current, 10); editor.chain().focus().setFontSize(`${Math.max(10, num - 2)}px`).run(); }} title="글자 작게 (-2px)" className="px-2.5 h-full text-slate-700 hover:bg-slate-50 font-bold text-[11px] flex items-center justify-center smooth-transition active:bg-slate-100">A-</button>
        <div className="w-px h-4 bg-slate-200" />
        <button type="button" onClick={() => { closeAllPopups(); const current = editor.getAttributes('textStyle').fontSize || '16px'; const num = parseInt(current, 10); editor.chain().focus().setFontSize(`${Math.min(60, num + 2)}px`).run(); }} title="글자 크게 (+2px)" className="px-2.5 h-full text-slate-700 hover:bg-slate-50 font-bold text-[14px] flex items-center justify-center smooth-transition active:bg-slate-100">A+</button>
      </div>

      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게"><Bold size={14} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임"><Italic size={14} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄"><UnderlineIcon size={14} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선"><Strikethrough size={14} /></Btn>
      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />

      <div className="relative">
        <Btn onClick={() => { closeAllPopups(); setShowColor(!showColor); }} title="글자색">
          <div className="flex flex-col items-center"><span className="text-[10px] font-bold leading-none">A</span><div className="w-3 h-1 rounded-sm mt-px" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }} /></div>
        </Btn>
        {showColor && (
          <div className="absolute top-full left-0 mt-2 z-[100] bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 grid grid-cols-5 gap-2 w-[160px] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
            {COLORS.map(c => <button key={c} className="w-5 h-5 rounded-full border border-black/10 hover:scale-125 hover:shadow-md smooth-transition" style={{ backgroundColor: c }} onClick={() => { editor.chain().focus().setColor(c).run(); setShowColor(false); }} />)}
          </div>
        )}
      </div>

      <div className="relative">
        <Btn active={editor.isActive('highlight')} onClick={() => { closeAllPopups(); setShowHighlight(!showHighlight); }} title="형광펜"><Highlighter size={14} /></Btn>
        {showHighlight && (
          <div className="absolute top-full left-0 mt-2 z-[100] bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 grid grid-cols-4 gap-2 w-[140px] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
            {['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'].map(c => <button key={c} className="w-5 h-5 rounded-full border border-black/10 hover:scale-125 hover:shadow-md smooth-transition" style={{ backgroundColor: c }} onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlight(false); }} />)}
            <button className="w-5 h-5 rounded-full border border-slate-200 text-[9px] hover:scale-125 smooth-transition flex items-center justify-center font-bold text-slate-500 bg-white" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlight(false); }}>X</button>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />
      <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="왼쪽정렬"><AlignLeft size={14} /></Btn>
      <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="가운데정렬"><AlignCenter size={14} /></Btn>
      <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="오른쪽정렬"><AlignRight size={14} /></Btn>
      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="목록"><List size={14} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호목록"><ListOrdered size={14} /></Btn>
      <div className="w-px h-4 bg-slate-300/60 mx-1.5" />
      <Btn onClick={addTable} title="표 삽입"><TableIcon size={14} /></Btn>
      <Btn onClick={addImage} title="이미지 삽입"><Image size={14} /></Btn>
    </div>
  );
}

function WriteDialog({ initialData, onSave, onCancel, saving }: {
  initialData?: Notice | null;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, Color, FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      ImageExt.configure({ inline: true, allowBase64: true }),
    ],
    content: initialData?.content || '<p></p>',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[350px] px-6 py-5 bg-white/60 rounded-b-2xl text-slate-800 font-medium' },
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-[12px]">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white/80 backdrop-blur-[40px] rounded-[2rem] w-[90vw] max-w-[750px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-white"
        onClick={e => e.stopPropagation()}
        data-no-drag
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/50 bg-white/40">
          <h2 className="font-bold text-lg text-slate-800">{initialData ? '게시글 수정' : '게시글 작성'}</h2>
          <button onClick={onCancel} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/80 rounded-full smooth-transition shadow-sm"><X size={18} /></button>
        </div>

        <div className="px-6 pt-5 bg-transparent">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full text-xl font-bold border-b-2 border-slate-200/80 text-slate-800 pb-2 outline-none focus:border-blue-400 bg-transparent placeholder-slate-400 smooth-transition"
          />
        </div>

        <div className="flex flex-col flex-1 mx-6 mt-4 mb-5 border border-slate-200/80 rounded-2xl min-h-0 bg-white/40 shadow-inner overflow-hidden">
          <div className="shrink-0"><EditorToolbar editor={editor} /></div>
          <div className="flex-1 overflow-auto custom-scrollbar"><EditorContent editor={editor} /></div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200/50 bg-white/40 shrink-0">
          <button onClick={onCancel} className="px-6 py-2.5 text-sm font-bold bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:bg-slate-50 hover:shadow-md text-slate-700 rounded-xl smooth-transition active:scale-95">취소</button>
          <button onClick={() => { if (!title.trim()) { alert('제목을 입력해주세요.'); return; } if (!editor?.getHTML() || editor.isEmpty) { alert('내용을 입력해주세요.'); return; } onSave(title.trim(), editor.getHTML()); }} disabled={saving || !title.trim()} className="px-8 py-2.5 text-sm bg-gradient-to-b from-blue-500 to-blue-600 border border-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl shadow-[0_4px_12px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 font-bold smooth-transition active:scale-95">
            {saving && <Loader2 size={14} className="animate-spin" />} 저장
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-[12px]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white/80 backdrop-blur-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-white rounded-[2rem] w-[90vw] max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-no-drag
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/50 bg-white/40">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-bold text-xl text-slate-800 truncate mb-1.5">{notice.title}</h2>
            <div className="text-xs font-bold text-slate-500">
              {formatDate(notice.createdAt)}
              {notice.updatedAt && <span className="ml-2 pl-2 border-l border-slate-300">수정됨: {formatDate(notice.updatedAt)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:bg-slate-50 hover:shadow-md text-slate-700 rounded-xl smooth-transition active:scale-95 font-bold">
              <Pencil size={13} />수정
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-50 border border-rose-200 shadow-[0_2px_4px_rgba(244,63,94,0.05)] hover:bg-rose-100 hover:shadow-md text-rose-700 rounded-xl smooth-transition active:scale-95 font-bold">
              <Trash2 size={13} />삭제
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/80 rounded-full smooth-transition shadow-sm"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-8 custom-scrollbar bg-white/30">
          <div className="prose prose-sm max-w-none notice-content text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: notice.content }} />
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

interface InlineNoticePanelProps { className?: string; }

export const InlineNoticePanel: React.FC<InlineNoticePanelProps> = ({ className }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWrite, setShowWrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewNotice, setViewNotice] = useState<Notice | null>(null);
  const [editData, setEditData] = useState<Notice | null>(null);
  const [pwDialog, setPwDialog] = useState<{ action: 'write' | 'edit' | 'delete'; payload?: any } | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const pendingPw = useRef<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setShowPopover(false);
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
      if (editData) await updateNotice(editData.id, pw, title, content);
      else await createNotice(pw, title, content);
      pendingPw.current = null;
      setShowWrite(false);
      await load();
    } catch (e: any) { alert(e.message || '저장 실패'); }
    finally { setSaving(false); }
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
      } catch (e: any) { alert(e.message || '삭제 실패'); }
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  return (
    <>
      <div className={`relative flex ${className || ''}`} ref={popoverRef} data-no-drag>
        <button
          onClick={() => {
            const next = !showPopover;
            setShowPopover(next);
            if (next) load();
          }}
          className="flex flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-white/60 border border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] hover:bg-gradient-to-b hover:from-rose-100 hover:to-white text-rose-700 w-[72px] h-[60px] rounded-xl smooth-transition active:scale-95 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        >
          <Bell size={22} className="mb-1" />
          <span className="text-[11px] font-bold whitespace-nowrap">공지사항</span>
        </button>

        <AnimatePresence>
          {showPopover && (
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[300px] bg-white/80 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-2xl border border-white/80 z-[80] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100/50 bg-white/40">
                <span className="text-xs font-bold text-slate-800">사내 공지사항</span>
                <button onClick={handleWriteClick} className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm rounded-lg smooth-transition active:scale-95 font-bold shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                  <Plus size={12} /> 작성
                </button>
              </div>
              
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1.5">
                {loading ? (
                  <div className="py-6 text-center text-slate-400 font-bold text-xs">로딩...</div>
                ) : notices.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 font-bold text-xs">등록된 공지가 없습니다</div>
                ) : (
                  notices.map(n => (
                    <button
                      key={n.id}
                      onClick={() => { setViewNotice(n); setShowPopover(false); }}
                      className="w-full text-left px-3 py-2.5 flex flex-col gap-1 hover:bg-slate-50/80 hover:shadow-sm border border-transparent hover:border-slate-200/50 rounded-xl smooth-transition active:scale-95 border-b border-slate-100/50 last:border-0"
                    >
                      <div className="text-[11px] font-bold text-slate-800 truncate w-full">{n.title}</div>
                      <div className="text-[9px] font-bold text-slate-400">{formatDate(n.createdAt)}</div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showWrite && <WriteDialog initialData={editData} onSave={handleSave} onCancel={() => setShowWrite(false)} saving={saving} />}
        {viewNotice && <ViewDialog notice={viewNotice} onClose={() => setViewNotice(null)} onEdit={handleEditClick} onDelete={handleDeleteClick} />}
        {pwDialog && <PasswordDialog title={pwDialog.action === 'write' ? '게시글 작성 암호' : pwDialog.action === 'edit' ? '게시글 수정 암호' : '게시글 삭제 암호'} onConfirm={handlePwConfirm} onCancel={() => setPwDialog(null)} />}
      </AnimatePresence>

      <style>{`
        /* Bright Glassmorphism styles for Editor & View */
        .notice-content { color: #1e293b; }
        .notice-content h1 { font-size: 1.8em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .notice-content h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .notice-content h3 { font-size: 1.25em; font-weight: 600; margin: 0.4em 0; color: #0f172a; }
        .notice-content p { margin: 0.3em 0; line-height: 1.6; }
        .notice-content ul { list-style: disc; padding-left: 1.5em; margin: 0.3em 0; }
        .notice-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.3em 0; }
        .notice-content table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .notice-content th, .notice-content td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        .notice-content th { background: rgba(241,245,249,0.5); font-weight: 600; color: #334155; }
        .notice-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid rgba(255,255,255,0.8); }
        .notice-content mark { padding: 2px 4px; border-radius: 4px; background-color: rgba(59,130,246,0.15); color: #1d4ed8; }
        .notice-content blockquote { border-left: 4px solid #3b82f6; padding-left: 1em; color: #64748b; margin: 0.5em 0; font-style: italic; background: rgba(241,245,249,0.5); padding: 12px; border-radius: 0 12px 12px 0; }

        .tiptap { min-height: 350px; color: #1e293b; }
        .tiptap:focus { outline: none; }
        .tiptap h1 { font-size: 1.8em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .tiptap h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .tiptap h3 { font-size: 1.25em; font-weight: 600; margin: 0.4em 0; color: #0f172a; }
        .tiptap p { margin: 0.3em 0; line-height: 1.6; }
        .tiptap ul { list-style: disc; padding-left: 1.5em; margin: 0.3em 0; }
        .tiptap ol { list-style: decimal; padding-left: 1.5em; margin: 0.3em 0; }
        .tiptap table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .tiptap th, .tiptap td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; min-width: 50px; position: relative; }
        .tiptap th { background: rgba(241,245,249,0.5); font-weight: 600; color: #334155; }
        .tiptap img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
        .tiptap mark { padding: 2px 4px; border-radius: 4px; background-color: rgba(59,130,246,0.15); color: #1d4ed8; }
        .tiptap blockquote { border-left: 4px solid #3b82f6; padding-left: 1em; color: #64748b; margin: 0.5em 0; font-style: italic; background: rgba(241,245,249,0.5); padding: 12px; border-radius: 0 12px 12px 0; }
        .tiptap .selectedCell { background: rgba(59,130,246,0.1); }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.6); }
      `}</style>
    </>
  );
};
