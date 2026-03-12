import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CATEGORIES, STORES, Store } from '../../lib/constants';
import { fetchStorePartConfig, saveStorePartConfig, PartConfig, getDefaultParts } from '../../lib/cloud';
import { ChevronRight, ChevronLeft, Search, X, RotateCcw, Save, MapPin, ChevronDown, GripVertical, ArrowDownUp, Settings2, Plus, Trash2, AlertTriangle, Minus as MinusIcon, Check, Layers, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (storeCode: string, parts: PartConfig[]) => void;
  initialStore?: Store | null;
}

const DEFAULT_RANK = 20;
function generateId() { return `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function deepCloneParts(parts: PartConfig[]): PartConfig[] { return JSON.parse(JSON.stringify(parts)); }

const RankStepper: React.FC<{ value: number; onChange: (v: number) => void; isSelected: boolean; }> = ({ value, onChange, isSelected }) => {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 999) onChange(v); };
  return (
    <div className={`flex items-center rounded-xl shrink-0 smooth-transition overflow-hidden shadow-sm border ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); if (value > 1) onChange(value - 1); }} className={`w-6 h-6 flex items-center justify-center smooth-transition font-bold ${isSelected ? 'text-blue-100 hover:text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}><MinusIcon size={10} /></button>
      <input type="number" value={value} onChange={handleInput} className={`w-9 text-center text-xs font-bold outline-none py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none smooth-transition bg-transparent ${isSelected ? 'text-white' : 'text-slate-800'}`} min={1} max={999} />
      <button onClick={e => { e.stopPropagation(); if (value < 999) onChange(value + 1); }} className={`w-6 h-6 flex items-center justify-center smooth-transition font-bold ${isSelected ? 'text-blue-100 hover:text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}><Plus size={10} /></button>
    </div>
  );
};

const PartManageDialog: React.FC<{ open: boolean; parts: PartConfig[]; onConfirm: (parts: PartConfig[]) => void; onClose: () => void; }> = ({ open, parts, onConfirm, onClose }) => {
  const [localParts, setLocalParts] = useState<PartConfig[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PartConfig | null>(null);

  useEffect(() => { if (open) { setLocalParts(deepCloneParts(parts)); setDeleteTarget(null); } }, [open]);
  if (!open) return null;

  const handleAdd = () => { const newPart: PartConfig = { id: generateId(), name: `파트 ${localParts.length + 1}`, categories: [], }; setLocalParts(prev => [...prev, newPart]); };
  const handleRename = (id: string, name: string) => { setLocalParts(prev => prev.map(p => p.id === id ? { ...p, name } : p)); };
  const handleDeleteConfirm = () => { if (!deleteTarget) return; setLocalParts(prev => prev.filter(p => p.id !== deleteTarget.id)); setDeleteTarget(null); };

  const glassActionBtn = "flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:bg-slate-50 hover:shadow-md text-slate-700 rounded-xl text-sm font-bold smooth-transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/30 backdrop-blur-[12px]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-white w-[380px] max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100/50 bg-white/40 flex items-center justify-between">
          <div className="flex items-center gap-2"><Settings2 size={16} className="text-slate-500" /><span className="text-sm font-bold text-slate-800">파트 관리</span></div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-white/80 smooth-transition shadow-sm"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-transparent">
          {localParts.length === 0 ? <div className="text-center text-slate-400 font-bold text-xs py-8">등록된 파트가 없습니다</div> : localParts.map((part, idx) => (
            <div key={part.id} className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2 border border-slate-200 shadow-sm focus-within:border-blue-400 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] smooth-transition">
              <span className="text-xs text-slate-400 font-mono font-bold w-5 shrink-0">{idx + 1}</span><input type="text" value={part.name} onChange={e => handleRename(part.id, e.target.value)} className="flex-1 bg-transparent font-bold px-2 py-1 text-sm outline-none text-slate-800 placeholder-slate-400 border-b border-transparent transition-colors" placeholder="파트 이름" /><span className="text-[10px] font-bold text-slate-500 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded-md">{part.categories.length}개</span><button onClick={() => setDeleteTarget(part)} className="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 smooth-transition active:scale-95" title="삭제"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 border-t border-slate-100/50 bg-white/40 flex items-center justify-between">
          <button onClick={handleAdd} className={`${glassActionBtn} text-blue-600`}><Plus size={14} /><span>파트 추가</span></button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={glassActionBtn}>취소</button>
            <button onClick={() => { onConfirm(localParts); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 border border-blue-600 shadow-[0_4px_12px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] text-white font-bold rounded-xl text-sm smooth-transition active:scale-95"><Check size={14} />확인</button>
          </div>
        </div>
        {deleteTarget && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/30 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/95 backdrop-blur-xl rounded-2xl border border-rose-200 shadow-[0_20px_40px_rgba(244,63,94,0.1)] w-[340px] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 bg-rose-50/50 border-b border-rose-100 flex items-center gap-2"><AlertTriangle size={18} className="text-rose-500" /><span className="text-sm font-bold text-rose-800">파트 삭제 경고</span></div>
              <div className="px-5 py-5 text-sm font-bold text-slate-700 space-y-3"><p><strong className="text-rose-600">"{deleteTarget.name}"</strong> 파트를 삭제하시겠습니까?</p>{deleteTarget.categories.length > 0 && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">적용된 <strong className="text-rose-800">{deleteTarget.categories.length}개</strong> 조코드가 함께 삭제됩니다.</p>}</div>
              <div className="px-5 py-4 border-t border-slate-100 bg-white flex justify-end gap-2"><button onClick={() => setDeleteTarget(null)} className={glassActionBtn}>취소</button><button onClick={handleDeleteConfirm} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 border border-rose-600 shadow-[0_4px_12px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] text-white font-bold rounded-xl text-sm smooth-transition active:scale-95">삭제</button></div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export const CategoryConfigDialog: React.FC<CategoryConfigDialogProps> = ({ open, onClose, onSaved, initialStore }) => {
  const [selectedStore, setSelectedStore] = useState<Store | null>(initialStore || null);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [parts, setParts] = useState<PartConfig[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedActive, setSelectedActive] = useState<Set<string>>(new Set());
  const [selectedInactive, setSelectedInactive] = useState<Set<string>>(new Set());
  const [lastClickedActiveIndex, setLastClickedActiveIndex] = useState<number | null>(null);
  const [lastClickedInactiveIndex, setLastClickedInactiveIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPartManage, setShowPartManage] = useState(false);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedPart = useMemo(() => parts.find(p => p.id === selectedPartId) || null, [parts, selectedPartId]);
  const activeCategories = useMemo(() => selectedPart?.categories || [], [selectedPart]);
  const activeCategorySet = useMemo(() => new Set(activeCategories.map(c => c.code)), [activeCategories]);

  useEffect(() => { if (open && initialStore) setSelectedStore(initialStore); }, [open, initialStore]);
  useEffect(() => {
    if (!open || !selectedStore) return; let cancelled = false; setLoading(true);
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      const loadedParts = (config && config.length > 0) ? config : getDefaultParts();
      setParts(loadedParts); setSelectedPartId(loadedParts[0].id); setSelectedActive(new Set()); setSelectedInactive(new Set()); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, selectedStore]);
  useEffect(() => { if (open && !selectedStore) { setParts([]); setSelectedPartId(null); setSelectedActive(new Set()); setSelectedInactive(new Set()); } }, [open, selectedStore]);

  const filteredStores = useMemo(() => { if (!storeSearch.trim()) return STORES; const q = storeSearch.trim().toLowerCase(); return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q)); }, [storeSearch]);
  const updateCurrentPart = useCallback((updater: (part: PartConfig) => PartConfig) => { if (!selectedPartId) return; setParts(prev => prev.map(p => p.id === selectedPartId ? updater(p) : p)); }, [selectedPartId]);
  const moveToActive = useCallback(() => {
    if (selectedInactive.size === 0 || !selectedPartId) return;
    const toMove = CATEGORIES.filter(c => selectedInactive.has(c) && !activeCategorySet.has(c));
    if (toMove.length === 0) { toast.info('선택한 조코드가 이미 이 파트에 적용되어 있습니다'); setSelectedInactive(new Set()); return; }
    updateCurrentPart(part => ({ ...part, categories: [...part.categories, ...toMove.map(code => ({ code, rank: DEFAULT_RANK }))], })); setSelectedInactive(new Set());
  }, [selectedInactive, selectedPartId, activeCategorySet, updateCurrentPart]);
  const moveToInactive = useCallback(() => { if (selectedActive.size === 0 || !selectedPartId) return; updateCurrentPart(part => ({ ...part, categories: part.categories.filter(c => !selectedActive.has(c.code)), })); setSelectedActive(new Set()); }, [selectedActive, selectedPartId, updateCurrentPart]);
  const handleReset = () => { if (!selectedPartId) return; updateCurrentPart(part => ({ ...part, categories: [] })); setSelectedActive(new Set()); setSelectedInactive(new Set()); };
  const handleRankChange = (code: string, rank: number) => { updateCurrentPart(part => ({ ...part, categories: part.categories.map(c => c.code === code ? { ...c, rank } : c), })); };
  const handleSave = async () => {
    if (!selectedStore) { toast.error('영업점을 먼저 선택해주세요'); return; } if (parts.length === 0) { toast.error('파트를 먼저 추가해주세요'); return; }
    setSaving(true); try { await saveStorePartConfig(selectedStore.code, parts); toast.success(`${selectedStore.name} 파트/조코드 설정 저장 완료`); onSaved?.(selectedStore.code, parts); onClose(); } catch (e) { toast.error('저장 실패'); } finally { setSaving(false); }
  };

  const clearAllSelections = () => { setSelectedActive(new Set()); setSelectedInactive(new Set()); };
  const toggleActive = (code: string, e: React.MouseEvent) => {
    const currentIndex = activeCategories.findIndex(c => c.code === code); if (currentIndex === -1) return; setSelectedInactive(new Set());
    setSelectedActive(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedActiveIndex !== null && lastClickedActiveIndex < activeCategories.length) {
        const start = Math.min(currentIndex, lastClickedActiveIndex); const end = Math.min(Math.max(currentIndex, lastClickedActiveIndex), activeCategories.length - 1);
        for (let i = start; i <= end; i++) { if (activeCategories[i]) next.add(activeCategories[i].code); }
      } else if (e.ctrlKey || e.metaKey) { next.has(code) ? next.delete(code) : next.add(code); } 
      else { if (next.has(code) && next.size === 1) next.clear(); else { next.clear(); next.add(code); } }
      return next;
    }); setLastClickedActiveIndex(currentIndex);
  };
  const toggleInactive = (cat: string, e: React.MouseEvent) => {
    const currentIndex = CATEGORIES.indexOf(cat); setSelectedActive(new Set());
    setSelectedInactive(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedInactiveIndex !== null) {
        const start = Math.min(currentIndex, lastClickedInactiveIndex); const end = Math.max(currentIndex, lastClickedInactiveIndex);
        for (let i = start; i <= end; i++) next.add(CATEGORIES[i]);
      } else if (e.ctrlKey || e.metaKey) { next.has(cat) ? next.delete(cat) : next.add(cat); } 
      else { if (next.has(cat) && next.size === 1) next.clear(); else { next.clear(); next.add(cat); } }
      return next;
    }); setLastClickedInactiveIndex(currentIndex);
  };
  const doubleClickActive = (code: string) => { if (!selectedPartId) return; updateCurrentPart(part => ({ ...part, categories: part.categories.filter(c => c.code !== code) })); setSelectedActive(prev => { const n = new Set(prev); n.delete(code); return n; }); };
  const doubleClickInactive = (cat: string) => { if (!selectedPartId) return; if (activeCategorySet.has(cat)) { toast.info(`"${cat}" 조코드가 이미 이 파트에 적용되어 있습니다`); return; } updateCurrentPart(part => ({ ...part, categories: [...part.categories, { code: cat, rank: DEFAULT_RANK }] })); setSelectedInactive(prev => { const n = new Set(prev); n.delete(cat); return n; }); };
  const handleDragStart = (code: string) => { setDragItem(code); };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault(); if (!dragItem || !selectedPartId) { setDragItem(null); setDragOverIndex(null); return; }
    updateCurrentPart(part => {
      const sourceIndex = part.categories.findIndex(c => c.code === dragItem); if (sourceIndex === -1) return part;
      const next = [...part.categories]; const [item] = next.splice(sourceIndex, 1);
      const adjusted = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex; next.splice(adjusted, 0, item); return { ...part, categories: next };
    }); setDragItem(null); setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragItem(null); setDragOverIndex(null); };
  const sortActive = () => { updateCurrentPart(part => ({ ...part, categories: [...part.categories].sort((a, b) => CATEGORIES.indexOf(a.code) - CATEGORIES.indexOf(b.code)) })); setLastClickedActiveIndex(null); };
  const handleSelectAllInactive = () => { if (selectedInactive.size === CATEGORIES.length) setSelectedInactive(new Set()); else setSelectedInactive(new Set(CATEGORIES)); };
  const handleSelectAllActive = () => { if (selectedActive.size === activeCategories.length) setSelectedActive(new Set()); else setSelectedActive(new Set(activeCategories.map(c => c.code))); };
  const handlePartManageConfirm = (newParts: PartConfig[]) => { setParts(newParts); if (selectedPartId && !newParts.find(p => p.id === selectedPartId)) { setSelectedPartId(newParts.length > 0 ? newParts[0].id : null); } setSelectedActive(new Set()); setSelectedInactive(new Set()); setLastClickedActiveIndex(null); setLastClickedInactiveIndex(null); };

  if (!open) return null;

  const glassActionBtn = "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:bg-slate-50 hover:shadow-md text-slate-700 rounded-xl text-sm font-bold smooth-transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 backdrop-blur-[12px]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/80 backdrop-blur-[40px] rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-white w-[760px] max-h-[85vh] flex flex-col overflow-hidden text-slate-800"
        onClick={e => e.stopPropagation()} onMouseDown={clearAllSelections}
      >
        <div className="border-b border-white/60 bg-white/40 shrink-0 px-6 pt-5 pb-4 space-y-4">
          <div className="flex items-stretch gap-3">
            <div className="flex-1 min-w-0 relative" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowStoreDropdown(prev => !prev)} className={`w-full h-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold smooth-transition active:scale-[0.98] border backdrop-blur-xl ${selectedStore ? 'bg-gradient-to-b from-emerald-50 to-white/80 border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] text-emerald-800' : 'bg-gradient-to-b from-white to-slate-50 border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] text-slate-600 hover:from-slate-50 hover:to-white'}`}>
                <MapPin size={16} className={selectedStore ? 'text-emerald-500' : 'text-slate-400'} />
                {selectedStore ? <span className="flex-1 text-left truncate"><span className="text-emerald-500 font-mono mr-1.5">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 text-left">영업점 선택</span>}
                <ChevronDown size={14} className={`transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showStoreDropdown && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 bg-white/90 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white rounded-2xl z-[210] overflow-hidden">
                    <div className="p-3 border-b border-slate-100/50 bg-white/50">
                      <div className="flex items-center gap-2 bg-slate-50/80 rounded-xl px-3 py-2 border border-slate-200/50 shadow-inner"><Search size={14} className="text-slate-400" /><input type="text" value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="코드 또는 영업점명 검색" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-slate-400 text-slate-800" autoFocus />{storeSearch && <button onClick={() => setStoreSearch('')} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={12} className="text-slate-500" /></button>}</div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                      {filteredStores.map(store => (
                        <button key={store.code} onClick={() => { setSelectedStore(store); setShowStoreDropdown(false); setStoreSearch(''); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold smooth-transition ${selectedStore?.code === store.code ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                          <span className="font-mono text-xs text-slate-400 w-8">{store.code}</span><span className="flex-1">{store.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 min-w-0 relative" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowPartDropdown(prev => !prev)} disabled={parts.length === 0} className={`w-full h-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold smooth-transition active:scale-[0.98] border backdrop-blur-xl disabled:opacity-50 disabled:pointer-events-none ${selectedPart ? 'bg-gradient-to-b from-blue-50 to-white/80 border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] text-blue-800' : 'bg-gradient-to-b from-white to-slate-50 border-white shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] text-slate-600 hover:from-slate-50 hover:to-white'}`}>
                <Layers size={16} className={selectedPart ? 'text-blue-500' : 'text-slate-400'} />
                {selectedPart ? <span className="flex-1 text-left truncate"><span className="text-blue-500 font-mono mr-1.5 text-xs">{String(parts.indexOf(selectedPart) + 1).padStart(3, '0')}</span>{selectedPart.name}</span> : <span className="flex-1 text-left">{parts.length === 0 ? '파트 없음' : '파트 선택'}</span>}
                <ChevronDown size={14} className={`transition-transform ${showPartDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showPartDropdown && parts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 bg-white/90 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white rounded-2xl z-[210] overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar py-2">
                      {parts.map((part, idx) => (
                        <button key={part.id} onClick={() => { setSelectedPartId(part.id); setShowPartDropdown(false); setSelectedActive(new Set()); setSelectedInactive(new Set()); setLastClickedActiveIndex(null); setLastClickedInactiveIndex(null); }} className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold smooth-transition ${selectedPartId === part.id ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                          <Layers size={14} className={selectedPartId === part.id ? 'text-blue-500' : 'text-slate-400'} /><span className="font-mono text-xs text-slate-400 w-8">{String(idx + 1).padStart(3, '0')}</span><span className="flex-1">{part.name}</span><span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/50">{part.categories.length}개</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="flex-1 flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
              <button onClick={handleSave} disabled={saving || !selectedStore} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 border border-blue-600 text-white rounded-xl text-sm font-bold smooth-transition active:scale-95 shadow-[0_4px_12px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:pointer-events-none"><Save size={14} /><span>{saving ? '저장중...' : '저장'}</span></button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 border border-rose-600 text-white font-bold rounded-xl text-sm smooth-transition active:scale-95 shadow-[0_4px_12px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"><XCircle size={14} /><span>취소</span></button>
              <button onClick={handleReset} disabled={!selectedPart} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 border border-emerald-600 text-white font-bold rounded-xl text-sm smooth-transition active:scale-95 shadow-[0_4px_12px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:pointer-events-none"><RotateCcw size={14} /><span>초기화</span></button>
            </div>
            <div className="flex-1" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowPartManage(true)} disabled={!selectedStore} className={`${glassActionBtn} w-full h-full text-violet-700`}><Settings2 size={14} /><span>파트관리</span></button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0 bg-transparent">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-sm">설정 불러오는 중...</div>
          ) : (
            <>
              <div className="flex-1 flex flex-col border-r border-white/60 min-w-0 bg-white/20 backdrop-blur-sm">
                <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between shrink-0 bg-white/40" onMouseDown={e => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={CATEGORIES.length > 0 && selectedInactive.size === CATEGORIES.length} ref={el => { if (el) el.indeterminate = selectedInactive.size > 0 && selectedInactive.size < CATEGORIES.length; }} className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" onChange={handleSelectAllInactive} /><span className="text-sm font-bold text-slate-700">조코드 전체</span></label>
                  <span className="text-xs text-slate-500 font-mono font-bold">{selectedInactive.size > 0 ? `${selectedInactive.size}/` : ''}{CATEGORIES.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {CATEGORIES.map((cat) => {
                    const isInCurrentPart = activeCategorySet.has(cat);
                    return (
                      <div key={cat} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleInactive(cat, e); }} onDoubleClick={() => doubleClickInactive(cat)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl mb-2 cursor-pointer select-none text-sm font-bold smooth-transition border shadow-sm ${selectedInactive.has(cat) ? 'bg-blue-600 text-white border-blue-500 shadow-[0_4px_12px_rgba(59,130,246,0.3)]' : isInCurrentPart ? 'bg-slate-50/50 text-slate-400 border-transparent shadow-none' : 'bg-white/80 text-slate-700 border-white hover:border-blue-200 hover:shadow-md'}`}>
                        <span className="flex-1 truncate">{cat}</span>
                        {isInCurrentPart && !selectedInactive.has(cat) && <span className="text-[10px] text-blue-500 shrink-0 font-bold bg-blue-50 px-1.5 py-0.5 rounded-md">적용됨</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 px-4 shrink-0 border-r border-white/60 bg-white/30 backdrop-blur-sm" onMouseDown={e => e.stopPropagation()}>
                <button onClick={moveToActive} disabled={selectedInactive.size === 0 || !selectedPart} className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:shadow-md disabled:opacity-50 disabled:pointer-events-none smooth-transition active:scale-90"><ChevronRight size={24} /></button>
                <button onClick={moveToInactive} disabled={selectedActive.size === 0 || !selectedPart} className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:border-rose-400 hover:text-rose-600 hover:shadow-md disabled:opacity-50 disabled:pointer-events-none smooth-transition active:scale-90"><ChevronLeft size={24} /></button>
              </div>

              <div className="flex-1 flex flex-col min-w-0 bg-white/40 backdrop-blur-sm" style={{ flex: '1.2' }}>
                <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between shrink-0 bg-white/50" onMouseDown={e => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={activeCategories.length > 0 && selectedActive.size === activeCategories.length} ref={el => { if (el) el.indeterminate = selectedActive.size > 0 && selectedActive.size < activeCategories.length; }} disabled={activeCategories.length === 0} onChange={handleSelectAllActive} className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" /><span className="text-sm font-bold text-slate-700">적용 조코드</span></label>
                  <div className="flex items-center gap-3">
                    <button onClick={sortActive} disabled={activeCategories.length < 2} className="p-1.5 rounded-full hover:bg-white/80 disabled:opacity-50 smooth-transition text-slate-500 hover:text-slate-800 shadow-sm border border-transparent hover:border-slate-200" title="기본 순서로 정렬"><ArrowDownUp size={14} /></button>
                    <span className="text-xs text-slate-500 font-mono font-bold">{selectedActive.size > 0 ? `${selectedActive.size}/` : ''}{activeCategories.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {!selectedPart ? (
                    <div className="flex items-center justify-center h-full text-slate-400 font-bold text-sm bg-white/30 rounded-2xl border border-dashed border-slate-300 mx-4 my-4">{parts.length === 0 ? '파트관리에서 파트를 추가하세요' : '파트를 선택하세요'}</div>
                  ) : activeCategories.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 font-bold text-sm bg-white/30 rounded-2xl border border-dashed border-slate-300 mx-4 my-4">적용된 조코드가 없습니다</div>
                  ) : (
                    activeCategories.map((item, index) => (
                      <div key={item.code} draggable onMouseDown={e => e.stopPropagation()} onDragStart={() => handleDragStart(item.code)} onDragOver={e => handleDragOver(e, index)} onDrop={e => handleDrop(e, index)} onDragEnd={handleDragEnd} onClick={e => { e.stopPropagation(); toggleActive(item.code, e); }} onDoubleClick={() => doubleClickActive(item.code)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2 cursor-pointer select-none text-sm font-bold smooth-transition border shadow-sm ${dragOverIndex === index ? 'border-t-4 border-blue-400 scale-[1.02]' : ''} ${selectedActive.has(item.code) ? 'bg-blue-600 text-white border-blue-500 shadow-[0_4px_12px_rgba(59,130,246,0.3)]' : 'bg-white/80 text-slate-700 border-white hover:border-blue-200 hover:shadow-md'}`}>
                        <GripVertical size={16} className={`shrink-0 ${selectedActive.has(item.code) ? 'text-blue-300' : 'text-slate-300 hover:text-slate-500'}`} />
                        <span className={`w-6 text-center text-xs shrink-0 font-bold ${selectedActive.has(item.code) ? 'text-blue-200' : 'text-slate-400'}`}>{index + 1}</span>
                        <span className="flex-1 truncate">{item.code}</span>
                        <RankStepper value={item.rank} onChange={v => handleRankChange(item.code, v)} isSelected={selectedActive.has(item.code)} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/60 bg-white/40 text-[11px] font-bold text-slate-500 shrink-0 text-center">
          클릭: 선택 | Ctrl+클릭: 다중 선택 | Shift+클릭: 범위 선택 | 더블클릭: 바로 이동 | 드래그: 순서 변경
        </div>
      </motion.div>

      <PartManageDialog open={showPartManage} parts={parts} onConfirm={handlePartManageConfirm} onClose={() => setShowPartManage(false)} />
    </div>
  );
};
