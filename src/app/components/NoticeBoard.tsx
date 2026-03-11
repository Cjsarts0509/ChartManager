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
  Highlighter, Loader2, Lock, Pencil, Bell
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-22196a99`;

interface Notice { id: string; title: string; content: string; createdAt: string; updatedAt?: string; }

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
          renderHTML: attributes => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
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
  try { return JSON.parse(text); } catch { throw new Error(`서버 응답 오류 (${res.status})`); }
}
async function fetchNotices(): Promise<Notice[]> {
  const res = await fetch(`${API_BASE}/notices`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed');
  return data.notices || [];
}
async function createNotice(password: string, title: string, content: string): Promise<Notice> {
  const res = await fetch(`${API_BASE}/notices`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` }, body: JSON.stringify({ password, title, content }) });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || '등록 실패');
  return data.notice;
}
async function updateNotice(id: string, password: string, title: string, content: string): Promise<Notice> {
  const res = await fetch(`${API_BASE}/notices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` }, body: JSON.stringify({ password, title, content }) });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || '수정 실패');
  return data.notice;
}
async function deleteNotice(id: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notices/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` }, body: JSON.stringify({ password }) });
  if (!res.ok) throw new Error('삭제 실패');
}

function PasswordDialog({ onConfirm, onCancel, title }: { onConfirm: (pw: string) => void; onCancel: () => void; title: string; }) {
  const [pw, setPw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={onCancel}>
      <div className="skeuo-card w-[320px] p-6 animate-skeuo-enter" onClick={e => e.stopPropagation()} data-no-drag>
        <div className="flex items-center gap-2 mb-5 text-slate-700">
          <Lock size={18} /> <h3 className="font-bold text-sm">{title}</h3>
        </div>
        <input ref={inputRef} type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && pw && onConfirm(pw)} placeholder="암호를 입력하세요" className="w-full skeuo-input rounded-xl px-4 py-3 text-sm mb-5 text-slate-700" />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">취소</button>
          <button onClick={() => pw && onConfirm(pw)} disabled={!pw} className="skeuo-btn text-blue-600 px-5 py-2 text-xs font-bold rounded-xl disabled:opacity-40">확인</button>
        </div>
      </div>
    </div>, document.body
  );
}

const COLORS = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#6366f1'];

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button type="button" onClick={onClick} title={title} className={`p-1.5 rounded-lg transition-all duration-300 ${active ? 'skeuo-inset text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}>{children}</button>
  );
  const closeAll = () => { setShowColor(false); setShowHighlight(false); };

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-white/50">
      <Btn onClick={() => editor.chain().focus().undo().run()} title="실행취소"><Undo2 size={16} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="다시실행"><Redo2 size={16} /></Btn>
      <div className="w-px h-5 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]" />
      
      <div className="flex items-center skeuo-inset rounded-lg p-0.5 mx-1">
        <button type="button" onClick={() => { closeAll(); const num = parseInt(editor.getAttributes('textStyle').fontSize || '16px', 10); editor.chain().focus().setFontSize(`${Math.max(10, num - 2)}px`).run(); }} className="px-3 py-1 text-slate-600 hover:text-slate-900 font-bold text-[12px] active:scale-90 transition-transform">A-</button>
        <div className="w-px h-4 bg-slate-300/50" />
        <button type="button" onClick={() => { closeAll(); const num = parseInt(editor.getAttributes('textStyle').fontSize || '16px', 10); editor.chain().focus().setFontSize(`${Math.min(60, num + 2)}px`).run(); }} className="px-3 py-1 text-slate-600 hover:text-slate-900 font-bold text-[15px] active:scale-90 transition-transform">A+</button>
      </div>
      
      <div className="w-px h-5 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]" />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></Btn>
      
      <div className="w-px h-5 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]" />
      <div className="relative">
        <Btn onClick={() => { closeAll(); setShowColor(!showColor); }}>
          <div className="flex flex-col items-center"><span className="text-[11px] font-bold leading-none">A</span><div className="w-3 h-1 rounded-sm mt-0.5" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }} /></div>
        </Btn>
        {showColor && (
          <div className="absolute top-[120%] left-0 z-[100] skeuo-card p-3 grid grid-cols-5 gap-2 w-[160px] animate-in fade-in slide-in-from-top-2">
            {COLORS.map(c => <button key={c} className="w-6 h-6 rounded-full border border-white/50 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} onClick={() => { editor.chain().focus().setColor(c).run(); setShowColor(false); }} />)}
          </div>
        )}
      </div>

      <div className="relative">
        <Btn active={editor.isActive('highlight')} onClick={() => { closeAll(); setShowHighlight(!showHighlight); }}><Highlighter size={16} /></Btn>
        {showHighlight && (
          <div className="absolute top-[120%] left-0 z-[100] skeuo-card p-3 grid grid-cols-4 gap-2 w-[140px] animate-in fade-in slide-in-from-top-2">
            {['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'].map(c => <button key={c} className="w-6 h-6 rounded-full border border-white/50 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlight(false); }} />)}
            <button className="w-6 h-6 rounded-full skeuo-inset text-[10px] flex items-center justify-center font-bold text-slate-500 active:scale-90 transition-transform" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlight(false); }}>X</button>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]" />
      <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
      <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
      <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
      
      <div className="w-px h-5 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]" />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      
      <div className="w-px h-5 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]" />
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></Btn>
      <Btn onClick={() => { const url = prompt('이미지 URL:'); if (url) editor.chain().focus().setImage({ src: url }).run(); }}><Image size={16} /></Btn>
    </div>
  );
}

function WriteDialog({ initialData, onSave, onCancel, saving }: { initialData?: Notice | null; onSave: (t: string, c: string) => void; onCancel: () => void; saving: boolean; }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color, FontSize, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }), Table.configure({ resizable: true }), TableRow, TableCell, TableHeader, ImageExt.configure({ inline: true, allowBase64: true })],
    content: initialData?.content || '<p></p>',
    editorProps: { attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-5' } },
  });

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="skeuo-card w-[90vw] max-w-[800px] max-h-[90vh] flex flex-col animate-skeuo-enter" onClick={e => e.stopPropagation()} data-no-drag>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/50">
          <h2 className="font-bold text-lg text-slate-800">{initialData ? '게시글 수정' : '게시글 작성'}</h2>
          <button onClick={onCancel} className="p-2 skeuo-btn rounded-full text-slate-500"><X size={18} /></button>
        </div>
        <div className="px-6 pt-5">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력하세요" className="w-full text-xl font-bold skeuo-input rounded-xl px-4 py-3 text-slate-800" />
        </div>
        <div className="flex flex-col flex-1 mx-6 mt-5 mb-5 skeuo-inset rounded-2xl min-h-0 overflow-hidden border border-white/30">
          <EditorToolbar editor={editor} />
          <div className="flex-1 overflow-auto custom-scrollbar bg-white/30"><EditorContent editor={editor} /></div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/50">
          <button onClick={onCancel} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors">취소</button>
          <button onClick={() => { if (!title.trim() || !editor?.getHTML() || editor.isEmpty) return alert('제목과 내용을 입력해주세요.'); onSave(title.trim(), editor.getHTML()); }} disabled={saving || !title.trim()} className="skeuo-btn text-blue-600 px-8 py-2.5 rounded-xl font-bold flex items-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} 저장
          </button>
        </div>
      </div>
    </div>, document.body
  );
}

function ViewDialog({ notice, onClose, onEdit, onDelete }: { notice: Notice; onClose: () => void; onEdit: () => void; onDelete: () => void; }) {
  const formatDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`; };
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="skeuo-card w-[90vw] max-w-[700px] max-h-[85vh] flex flex-col animate-skeuo-enter" onClick={e => e.stopPropagation()} data-no-drag>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/50">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-bold text-xl text-slate-800 truncate mb-1.5">{notice.title}</h2>
            <div className="text-xs text-slate-400 font-medium">{formatDate(notice.createdAt)} {notice.updatedAt && <span className="ml-2 pl-2 border-l border-slate-300">수정됨: {formatDate(notice.updatedAt)}</span>}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onEdit} className="skeuo-btn text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"><Pencil size={14} />수정</button>
            <button onClick={onDelete} className="skeuo-btn text-red-500 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"><Trash2 size={14} />삭제</button>
            <div className="w-px h-6 bg-white/60 mx-1 shadow-[inset_1px_0_2px_rgba(209,217,230,0.5)]"></div>
            <button onClick={onClose} className="p-2.5 skeuo-btn rounded-full text-slate-500"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-8 py-8 custom-scrollbar">
          <div className="prose prose-slate max-w-none notice-content" dangerouslySetInnerHTML={{ __html: notice.content }} />
        </div>
      </div>
    </div>, document.body
  );
}

export const InlineNoticePanel: React.FC = () => {
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
    const handleClickOutside = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setShowPopover(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); try { setNotices(await fetchNotices()); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleWriteClick = () => { setShowPopover(false); setEditData(null); setPwDialog({ action: 'write' }); };
  const handleEditClick = () => { if (!viewNotice) return; setPwDialog({ action: 'edit', payload: viewNotice }); };
  const handleDeleteClick = () => { if (!viewNotice) return; setPwDialog({ action: 'delete', payload: viewNotice.id }); };

  const handleSave = async (title: string, content: string) => {
    const pw = pendingPw.current; if (!pw) return;
    setSaving(true);
    try {
      if (editData) await updateNotice(editData.id, pw, title, content);
      else await createNotice(pw, title, content);
      pendingPw.current = null; setShowWrite(false); await load();
    } catch (e: any) { alert(e.message || '저장 실패'); } finally { setSaving(false); }
  };

  const handlePwConfirm = async (pw: string) => {
    const { action, payload } = pwDialog || {}; setPwDialog(null);
    if (action === 'write') { pendingPw.current = pw; setEditData(null); setShowWrite(true); }
    else if (action === 'edit' && payload) { pendingPw.current = pw; setEditData(payload); setViewNotice(null); setShowWrite(true); }
    else if (action === 'delete' && payload) { try { await deleteNotice(payload, pw); setViewNotice(null); await load(); } catch (e: any) { alert(e.message); } }
  };

  return (
    <>
      <div className="relative flex" ref={popoverRef} data-no-drag>
        {/* 붉은색 테마 스큐오 버튼 */}
        <button onClick={() => { const next = !showPopover; setShowPopover(next); if (next) load(); }}
          className="skeuo-btn-red flex flex-col items-center justify-center text-red-600 w-[72px] rounded-2xl group"
        >
          <Bell size={22} className="mb-1 transition-transform group-active:scale-90" />
          <span className="text-[11px] font-bold whitespace-nowrap">공지사항</span>
        </button>

        {showPopover && (
          <div className="absolute top-[110%] left-1/2 -translate-x-1/2 w-[320px] skeuo-card z-[60] overflow-hidden flex flex-col origin-top animate-in fade-in slide-in-from-top-2 duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/50">
              <span className="text-sm font-bold text-slate-800">사내 공지사항</span>
              <button onClick={handleWriteClick} className="skeuo-btn text-red-500 flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-xl font-bold">
                <Plus size={14} /> 작성
              </button>
            </div>
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-2">
              {loading ? <div className="py-8 text-center text-slate-400 text-xs font-medium">로딩중...</div> : notices.length === 0 ? <div className="py-8 text-center text-slate-400 text-xs font-medium">등록된 공지가 없습니다</div> : (
                notices.map(n => (
                  <button key={n.id} onClick={() => { setViewNotice(n); setShowPopover(false); }} className="w-full text-left px-4 py-3 flex flex-col gap-1.5 rounded-xl hover:bg-white/50 transition-colors border-b border-slate-200/50 last:border-0 active:scale-[0.98]">
                    <div className="text-[12px] font-bold text-slate-700 truncate w-full">{n.title}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{new Date(n.createdAt).toLocaleDateString()}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showWrite && <WriteDialog initialData={editData} onSave={handleSave} onCancel={() => setShowWrite(false)} saving={saving} />}
      {viewNotice && <ViewDialog notice={viewNotice} onClose={() => setViewNotice(null)} onEdit={handleEditClick} onDelete={handleDeleteClick} />}
      {pwDialog && <PasswordDialog title={pwDialog.action === 'write' ? '게시글 작성 암호' : pwDialog.action === 'edit' ? '게시글 수정 암호' : '게시글 삭제 암호'} onConfirm={handlePwConfirm} onCancel={() => setPwDialog(null)} />}

      <style>{`
        .notice-content h1 { font-size: 1.8em; font-weight: 800; margin: 0.6em 0; color: #1e293b; }
        .notice-content h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; color: #334155; }
        .notice-content h3 { font-size: 1.25em; font-weight: 700; margin: 0.4em 0; color: #475569; }
        .notice-content p { margin: 0.4em 0; line-height: 1.7; color: #475569; }
        .notice-content ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; color: #475569; }
        .notice-content table { border-collapse: collapse; width: 100%; margin: 1em 0; border-radius: 8px; overflow: hidden; }
        .notice-content th, .notice-content td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
        .notice-content th { background: #f1f5f9; font-weight: 700; color: #334155; }
        .notice-content img { border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 1em 0; }
        .notice-content mark { padding: 2px 6px; border-radius: 6px; font-weight: 600; }
      `}</style>
    </>
  );
};