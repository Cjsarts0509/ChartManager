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
    <div className={`flex items-center rounded-xl shrink-0 smooth-transition overflow-hidden border shadow-sm ${isSelected ? 'bg-cyan-950 border-cyan-400/50' : 'bg-black/50 border-white/10'}`} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); if (value > 1) onChange(value - 1); }} className={`w-6 h-6 flex items-center justify-center smooth-transition font-bold ${isSelected ? 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-900/50' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}><MinusIcon size={10} /></button>
      <input type="number" value={value} onChange={handleInput} className={`w-9 text-center text-xs font-bold outline-none py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none smooth-transition bg-transparent ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`} min={1} max={999} />
      <button onClick={e => { e.stopPropagation(); if (value < 999) onChange(value + 1); }} className={`w-6 h-6 flex items-center justify-center smooth-transition font-bold ${isSelected ? 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-900/50' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}><Plus size={10} /></button>
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

  const actionBtnBase = "flex items-center justify-center gap-1.5 px-4 py-1.5 bg-black/40 border border-white/10 rounded-xl text-sm font-bold smooth-transition active:scale-95 backdrop-blur-md disabled:opacity-50 disabled:pointer-events-none";

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0B0F19]/95 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(34,211,238,0.1)] border border-white/10 w-[380px] max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2"><Settings2 size={16} className="text-slate-300" /><span className="text-sm font-bold text-slate-200">파트 관리</span></div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 smooth-transition"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {localParts.length === 0 ? <div className="text-center text-slate-500 font-bold text-xs py-8">등록된 파트가 없습니다</div> : localParts.map((part, idx) => (
            <div key={part.id} className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2 border border-white/5 focus-within:border-cyan-400/50 focus-within:shadow-[0_0_10px_rgba(34,211,238,0.2)] smooth-transition">
              <span className="text-xs text-slate-500 font-mono font-bold w-5 shrink-0">{idx + 1}</span><input type="text" value={part.name} onChange={e => handleRename(part.id, e.target.value)} className="flex-1 bg-transparent font-bold px-2 py-1 text-sm outline-none text-slate-200 placeholder-slate-600 border-b border-transparent transition-colors" placeholder="파트 이름" /><span className="text-[10px] font-bold text-slate-500 shrink-0">{part.categories.length}개</span><button onClick={() => setDeleteTarget(part)} className="p-1.5 rounded-full hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 hover:shadow-[0_0_10px_rgba(244,63,94,0.3)] smooth-transition active:scale-95" title="삭제"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="px-3 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <button onClick={handleAdd} className={`${actionBtnBase} text-slate-300 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.4),inset_0_0_10px_rgba(34,211,238,0.1)] hover:bg-cyan-950/30`}><Plus size={14} /><span>파트 추가</span></button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={`${actionBtnBase} text-slate-300 hover:border-slate-300 hover:text-white hover:shadow-[0_0_15px_rgba(203,213,225,0.3)] hover:bg-white/10`}>취소</button>
            <button onClick={() => { onConfirm(localParts); onClose(); }} className={`${actionBtnBase} text-slate-300 hover:border-blue-400 hover:text-blue-400 hover:shadow-[0_0_15px_rgba(96,165,250,0.4),inset_0_0_10px_rgba(96,165,250,0.1)] hover:bg-blue-950/30`}><Check size={14} />확인</button>
          </div>
        </div>
        {deleteTarget && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0B0F19]/95 rounded-2xl border border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.3)] w-[340px] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 bg-rose-950/30 border-b border-rose-500/30 flex items-center gap-2"><AlertTriangle size={18} className="text-rose-400" /><span className="text-sm font-bold text-rose-200">파트 삭제 경고</span></div>
              <div className="px-4 py-4 text-sm font-bold text-slate-300 space-y-2"><p><strong className="text-rose-400">"{deleteTarget.name}"</strong> 파트를 삭제하시겠습니까?</p>{deleteTarget.categories.length > 0 && <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/20 rounded-xl p-2">적용된 <strong className="text-rose-400">{deleteTarget.categories.length}개</strong> 조코드가 함께 삭제됩니다.</p>}</div>
              <div className="px-4 py-3 border-t border-rose-500/20 bg-rose-950/10 flex justify-end gap-2"><button onClick={() => setDeleteTarget(null)} className={`${actionBtnBase} text-slate-300 hover:border-slate-300 hover:text-white`}>취소</button><button onClick={handleDeleteConfirm} className={`${actionBtnBase} text-slate-300 hover:border-rose-400 hover:text-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.4),inset_0_0_10px_rgba(244,63,94,0.1)] hover:bg-rose-950/30`}>삭제</button></div>
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

  const actionBtnBase = "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-sm font-bold smooth-transition active:scale-95 backdrop-blur-md disabled:opacity-50 disabled:pointer-events-none text-slate-300";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0B0F19]/95 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(34,211,238,0.1)] border border-white/10 w-[760px] max-h-[85vh] flex flex-col overflow-hidden text-slate-200"
        onClick={e => e.stopPropagation()} onMouseDown={clearAllSelections}
      >
        <div className="border-b border-white/10 bg-white/5 shrink-0 px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-stretch gap-3">
            <div className="flex-1 min-w-0 relative" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowStoreDropdown(prev => !prev)} className={`w-full h-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold smooth-transition active:scale-[0.98] border backdrop-blur-md ${selectedStore ? 'border-emerald-400 bg-emerald-950/30 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3),inset_0_0_10px_rgba(52,211,153,0.1)]' : 'border-white/10 bg-black/40 text-slate-400 hover:border-emerald-400/50 hover:text-emerald-300 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]'}`}>
                <MapPin size={14} className={selectedStore ? 'text-emerald-400' : 'text-slate-400'} />
                {selectedStore ? <span className="flex-1 text-left truncate"><span className="text-emerald-200 font-mono mr-1">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 text-left">영업점 선택</span>}
                <ChevronDown size={12} className={`transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showStoreDropdown && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-1 bg-[#0B0F19]/95 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(52,211,153,0.1)] border border-white/10 rounded-2xl z-[210] overflow-hidden">
                    <div className="p-2 border-b border-white/10 bg-white/5">
                      <div className="flex items-center gap-2 bg-black/50 rounded-xl px-3 py-1.5 border border-white/10"><Search size={13} className="text-slate-400" /><input type="text" value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="코드 또는 영업점명 검색" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-slate-500 text-white" autoFocus />{storeSearch && <button onClick={() => setStoreSearch('')} className="p-0.5"><X size={12} className="text-slate-400" /></button>}</div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                      {filteredStores.map(store => (
                        <button key={store.code} onClick={() => { setSelectedStore(store); setShowStoreDropdown(false); setStoreSearch(''); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-bold smooth-transition ${selectedStore?.code === store.code ? 'bg-emerald-950/50 text-emerald-300' : 'hover:bg-white/5 text-slate-300'}`}>
                          <span className="font-mono text-xs text-slate-500 w-7">{store.code}</span><span className="flex-1">{store.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 min-w-0 relative" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowPartDropdown(prev => !prev)} disabled={parts.length === 0} className={`w-full h-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold smooth-transition active:scale-[0.98] border backdrop-blur-md disabled:opacity-50 disabled:pointer-events-none ${selectedPart ? 'border-blue-400 bg-blue-950/30 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.3),inset_0_0_10px_rgba(96,165,250,0.1)]' : 'border-white/10 bg-black/40 text-slate-400 hover:border-blue-400/50 hover:text-blue-300 hover:shadow-[0_0_15px_rgba(96,165,250,0.2)]'}`}>
                <Layers size={13} className={selectedPart ? 'text-blue-400' : 'text-slate-400'} />
                {selectedPart ? <span className="flex-1 text-left truncate"><span className="text-blue-200 font-mono mr-1 text-xs">{String(parts.indexOf(selectedPart) + 1).padStart(3, '0')}</span>{selectedPart.name}</span> : <span className="flex-1 text-left">{parts.length === 0 ? '파트 없음' : '파트 선택'}</span>}
                <ChevronDown size={12} className={`transition-transform ${showPartDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showPartDropdown && parts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-1 bg-[#0B0F19]/95 backdrop-blur-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(96,165,250,0.1)] border border-white/10 rounded-2xl z-[210] overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar py-1">
                      {parts.map((part, idx) => (
                        <button key={part.id} onClick={() => { setSelectedPartId(part.id); setShowPartDropdown(false); setSelectedActive(new Set()); setSelectedInactive(new Set()); setLastClickedActiveIndex(null); setLastClickedInactiveIndex(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-bold smooth-transition ${selectedPartId === part.id ? 'bg-blue-950/50 text-blue-300' : 'hover:bg-white/5 text-slate-300'}`}>
                          <Layers size={12} className={selectedPartId === part.id ? 'text-blue-400' : 'text-slate-500'} /><span className="font-mono text-xs text-slate-500 w-7">{String(idx + 1).padStart(3, '0')}</span><span className="flex-1">{part.name}</span><span className="text-[10px] text-slate-500">{part.categories.length}개</span>
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
              <button onClick={handleSave} disabled={saving || !selectedStore} className={`${actionBtnBase} hover:border-blue-400 hover:text-blue-400 hover:shadow-[0_0_15px_rgba(96,165,250,0.4),inset_0_0_10px_rgba(96,165,250,0.1)] hover:bg-blue-950/30`}><Save size={14} /><span>{saving ? '저장중...' : '저장'}</span></button>
              <button onClick={onClose} className={`${actionBtnBase} hover:border-rose-400 hover:text-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.4),inset_0_0_10px_rgba(244,63,94,0.1)] hover:bg-rose-950/30`}><XCircle size={14} /><span>취소</span></button>
              <button onClick={handleReset} disabled={!selectedPart} className={`${actionBtnBase} hover:border-lime-400 hover:text-lime-400 hover:shadow-[0_0_15px_rgba(163,230,53,0.4),inset_0_0_10px_rgba(163,230,53,0.1)] hover:bg-lime-950/30`}><RotateCcw size={14} /><span>초기화</span></button>
            </div>
            <div className="flex-1" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowPartManage(true)} disabled={!selectedStore} className={`${actionBtnBase} w-full h-full hover:border-violet-400 hover:text-violet-400 hover:shadow-[0_0_15px_rgba(139,92,246,0.4),inset_0_0_10px_rgba(139,92,246,0.1)] hover:bg-violet-950/30`}><Settings2 size={13} /><span>파트관리</span></button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0 bg-transparent">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-bold text-sm">설정 불러오는 중...</div>
          ) : (
            <>
              <div className="flex-1 flex flex-col border-r border-white/10 min-w-0 bg-black/20">
                <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5" onMouseDown={e => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={CATEGORIES.length > 0 && selectedInactive.size === CATEGORIES.length} ref={el => { if (el) el.indeterminate = selectedInactive.size > 0 && selectedInactive.size < CATEGORIES.length; }} className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer" onChange={handleSelectAllInactive} /><span className="text-sm font-bold text-slate-200">조코드 전체</span></label>
                  <span className="text-xs text-slate-400 font-mono font-bold">{selectedInactive.size > 0 ? `${selectedInactive.size}/` : ''}{CATEGORIES.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                  {CATEGORIES.map((cat) => {
                    const isInCurrentPart = activeCategorySet.has(cat);
                    return (
                      <div key={cat} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleInactive(cat, e); }} onDoubleClick={() => doubleClickInactive(cat)} className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1.5 cursor-pointer select-none text-sm font-bold smooth-transition border ${selectedInactive.has(cat) ? 'bg-cyan-950/60 text-cyan-300 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : isInCurrentPart ? 'bg-white/5 text-slate-500 border-transparent' : 'bg-[#1e293b]/50 text-slate-300 border-white/5 hover:border-cyan-400/50 hover:text-cyan-200 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]'}`}>
                        <span className="flex-1 truncate">{cat}</span>
                        {isInCurrentPart && !selectedInactive.has(cat) && <span className="text-[10px] text-cyan-500 shrink-0 font-bold">적용됨</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-3 px-3 shrink-0 border-r border-white/10 bg-black/40" onMouseDown={e => e.stopPropagation()}>
                <button onClick={moveToActive} disabled={selectedInactive.size === 0 || !selectedPart} className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-slate-400 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:pointer-events-none smooth-transition active:scale-90"><ChevronRight size={20} /></button>
                <button onClick={moveToInactive} disabled={selectedActive.size === 0 || !selectedPart} className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-slate-400 hover:border-rose-400 hover:text-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50 disabled:pointer-events-none smooth-transition active:scale-90"><ChevronLeft size={20} /></button>
              </div>

              <div className="flex-1 flex flex-col min-w-0 bg-black/20" style={{ flex: '1.2' }}>
                <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5" onMouseDown={e => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={activeCategories.length > 0 && selectedActive.size === activeCategories.length} ref={el => { if (el) el.indeterminate = selectedActive.size > 0 && selectedActive.size < activeCategories.length; }} disabled={activeCategories.length === 0} onChange={handleSelectAllActive} className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer" /><span className="text-sm font-bold text-slate-200">적용 조코드</span></label>
                  <div className="flex items-center gap-2">
                    <button onClick={sortActive} disabled={activeCategories.length < 2} className="p-1 rounded-full hover:bg-white/10 disabled:opacity-50 smooth-transition text-slate-400 hover:text-white" title="기본 순서로 정렬"><ArrowDownUp size={13} /></button>
                    <span className="text-xs text-slate-400 font-mono font-bold">{selectedActive.size > 0 ? `${selectedActive.size}/` : ''}{activeCategories.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                  {!selectedPart ? (
                    <div className="flex items-center justify-center h-full text-slate-500 font-bold text-sm">{parts.length === 0 ? '파트관리에서 파트를 추가하세요' : '파트를 선택하세요'}</div>
                  ) : activeCategories.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500 font-bold text-sm">적용된 조코드가 없습니다</div>
                  ) : (
                    activeCategories.map((item, index) => (
                      <div key={item.code} draggable onMouseDown={e => e.stopPropagation()} onDragStart={() => handleDragStart(item.code)} onDragOver={e => handleDragOver(e, index)} onDrop={e => handleDrop(e, index)} onDragEnd={handleDragEnd} onClick={e => { e.stopPropagation(); toggleActive(item.code, e); }} onDoubleClick={() => doubleClickActive(item.code)} className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1.5 cursor-pointer select-none text-sm font-bold smooth-transition border ${dragOverIndex === index ? 'border-t-2 border-cyan-400' : ''} ${selectedActive.has(item.code) ? 'bg-cyan-950/60 text-cyan-300 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-[#1e293b]/50 text-slate-300 border-white/5 hover:border-cyan-400/50 hover:text-cyan-200 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]'}`}>
                        <GripVertical size={14} className={`shrink-0 ${selectedActive.has(item.code) ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`} />
                        <span className={`w-5 text-center text-xs shrink-0 font-bold ${selectedActive.has(item.code) ? 'text-cyan-400' : 'text-slate-500'}`}>{index + 1}</span>
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

        <div className="px-5 py-2.5 border-t border-white/10 bg-white/5 text-[11px] font-bold text-slate-500 shrink-0 text-center">
          클릭: 선택 | Ctrl+클릭: 다중 선택 | Shift+클릭: 범위 선택 | 더블클릭: 바로 이동 | 드래그: 순서 변경
        </div>
      </motion.div>

      <PartManageDialog open={showPartManage} parts={parts} onConfirm={handlePartManageConfirm} onClose={() => setShowPartManage(false)} />
    </div>
  );
};
