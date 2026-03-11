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

function generateId() {
  return `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function deepCloneParts(parts: PartConfig[]): PartConfig[] {
  return JSON.parse(JSON.stringify(parts));
}

const RankStepper: React.FC<{
  value: number;
  onChange: (v: number) => void;
  isSelected: boolean;
}> = ({ value, onChange, isSelected }) => {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 1 && v <= 999) onChange(v);
  };

  return (
    <div
      className={`flex items-center rounded-xl border shrink-0 smooth-transition overflow-hidden shadow-sm ${
        isSelected ? 'border-blue-400 bg-blue-500' : 'border-gray-300 bg-white/80 backdrop-blur-sm'
      }`}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        onClick={e => { e.stopPropagation(); if (value > 1) onChange(value - 1); }}
        className={`w-6 h-6 flex items-center justify-center smooth-transition ${
          isSelected
            ? 'text-blue-200 hover:text-white hover:bg-blue-600'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
        }`}
      >
        <MinusIcon size={10} />
      </button>
      <input
        type="number"
        value={value}
        onChange={handleInput}
        className={`w-9 text-center text-xs border-x outline-none py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none smooth-transition ${
          isSelected
            ? 'bg-blue-500 border-blue-400 text-white'
            : 'bg-transparent border-gray-300 text-gray-700'
        }`}
        min={1}
        max={999}
      />
      <button
        onClick={e => { e.stopPropagation(); if (value < 999) onChange(value + 1); }}
        className={`w-6 h-6 flex items-center justify-center smooth-transition ${
          isSelected
            ? 'text-blue-200 hover:text-white hover:bg-blue-600'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
        }`}
      >
        <Plus size={10} />
      </button>
    </div>
  );
};

const PartManageDialog: React.FC<{
  open: boolean;
  parts: PartConfig[];
  onConfirm: (parts: PartConfig[]) => void;
  onClose: () => void;
}> = ({ open, parts, onConfirm, onClose }) => {
  const [localParts, setLocalParts] = useState<PartConfig[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PartConfig | null>(null);

  useEffect(() => {
    if (open) {
      setLocalParts(deepCloneParts(parts));
      setDeleteTarget(null);
    }
  }, [open]);

  if (!open) return null;

  const handleAdd = () => {
    const newPart: PartConfig = { id: generateId(), name: `파트 ${localParts.length + 1}`, categories: [], };
    setLocalParts(prev => [...prev, newPart]);
  };

  const handleRename = (id: string, name: string) => { setLocalParts(prev => prev.map(p => p.id === id ? { ...p, name } : p)); };
  const handleDeleteConfirm = () => { if (!deleteTarget) return; setLocalParts(prev => prev.filter(p => p.id !== deleteTarget.id)); setDeleteTarget(null); };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel bg-white/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-white/50 w-[380px] max-h-[70vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200/50 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-gray-600" />
            <span className="text-sm font-bold text-gray-800">파트 관리</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200/80 smooth-transition"><X size={14} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white/30 custom-scrollbar">
          {localParts.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-8">등록된 파트가 없습니다</div>
          ) : (
            localParts.map((part, idx) => (
              <div key={part.id} className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 border border-gray-200/50 shadow-sm">
                <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{idx + 1}</span>
                <input type="text" value={part.name} onChange={e => handleRename(part.id, e.target.value)} className="flex-1 bg-transparent border-b border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-400 transition-colors" placeholder="파트 이름" />
                <span className="text-[10px] text-gray-400 shrink-0">{part.categories.length}개</span>
                <button onClick={() => setDeleteTarget(part)} className="p-1.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 smooth-transition active:scale-95" title="삭제"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-3 border-t border-gray-200/50 bg-gray-50/50 flex items-center justify-between">
          <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/90 text-white rounded-xl text-sm smooth-transition active:scale-95 shadow-sm"><Plus size={14} /><span>파트 추가</span></button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-1.5 bg-gray-200/80 hover:bg-gray-300/80 text-gray-700 rounded-xl text-sm smooth-transition active:scale-95">취소</button>
            <button onClick={() => { onConfirm(localParts); onClose(); }} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600/90 text-white rounded-xl text-sm smooth-transition active:scale-95 shadow-sm"><Check size={14} />확인</button>
          </div>
        </div>

        {deleteTarget && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel bg-white/95 rounded-2xl border border-red-200 w-[340px] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 bg-red-50/80 border-b border-red-200 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500" /><span className="text-sm font-bold text-red-800">파트 삭제 경고</span></div>
              <div className="px-4 py-4 text-sm text-gray-700 space-y-2">
                <p><strong className="text-red-600">"{deleteTarget.name}"</strong> 파트를 삭제하시겠습니까?</p>
                {deleteTarget.categories.length > 0 && <p className="text-xs text-gray-500 bg-gray-50/80 rounded-xl p-2">적용된 <strong className="text-gray-700">{deleteTarget.categories.length}개</strong> 조코드가 함께 삭제됩니다.</p>}
              </div>
              <div className="px-4 py-3 border-t border-gray-200/50 bg-gray-50/50 flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-1.5 bg-gray-200/80 hover:bg-gray-300 text-gray-700 rounded-xl text-sm smooth-transition active:scale-95">취소</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-1.5 bg-red-600/90 text-white rounded-xl text-sm smooth-transition active:scale-95 shadow-sm">삭제</button>
              </div>
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
    if (!open || !selectedStore) return;
    let cancelled = false; setLoading(true);
    fetchStorePartConfig(selectedStore.code).then(config => {
      if (cancelled) return;
      const loadedParts = (config && config.length > 0) ? config : getDefaultParts();
      setParts(loadedParts); setSelectedPartId(loadedParts[0].id);
      setSelectedActive(new Set()); setSelectedInactive(new Set()); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, selectedStore]);

  useEffect(() => {
    if (open && !selectedStore) { setParts([]); setSelectedPartId(null); setSelectedActive(new Set()); setSelectedInactive(new Set()); }
  }, [open, selectedStore]);

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return STORES;
    const q = storeSearch.trim().toLowerCase(); return STORES.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [storeSearch]);

  const updateCurrentPart = useCallback((updater: (part: PartConfig) => PartConfig) => {
    if (!selectedPartId) return; setParts(prev => prev.map(p => p.id === selectedPartId ? updater(p) : p));
  }, [selectedPartId]);

  const moveToActive = useCallback(() => {
    if (selectedInactive.size === 0 || !selectedPartId) return;
    const toMove = CATEGORIES.filter(c => selectedInactive.has(c) && !activeCategorySet.has(c));
    if (toMove.length === 0) { toast.info('선택한 조코드가 이미 이 파트에 적용되어 있습니다'); setSelectedInactive(new Set()); return; }
    updateCurrentPart(part => ({ ...part, categories: [...part.categories, ...toMove.map(code => ({ code, rank: DEFAULT_RANK }))], }));
    setSelectedInactive(new Set());
  }, [selectedInactive, selectedPartId, activeCategorySet, updateCurrentPart]);

  const moveToInactive = useCallback(() => {
    if (selectedActive.size === 0 || !selectedPartId) return;
    updateCurrentPart(part => ({ ...part, categories: part.categories.filter(c => !selectedActive.has(c.code)), }));
    setSelectedActive(new Set());
  }, [selectedActive, selectedPartId, updateCurrentPart]);

  const handleReset = () => {
    if (!selectedPartId) return; updateCurrentPart(part => ({ ...part, categories: [] })); setSelectedActive(new Set()); setSelectedInactive(new Set());
  };

  const handleRankChange = (code: string, rank: number) => { updateCurrentPart(part => ({ ...part, categories: part.categories.map(c => c.code === code ? { ...c, rank } : c), })); };

  const handleSave = async () => {
    if (!selectedStore) { toast.error('영업점을 먼저 선택해주세요'); return; }
    if (parts.length === 0) { toast.error('파트를 먼저 추가해주세요'); return; }
    setSaving(true);
    try {
      await saveStorePartConfig(selectedStore.code, parts);
      toast.success(`${selectedStore.name} 파트/조코드 설정 저장 완료`);
      onSaved?.(selectedStore.code, parts); onClose();
    } catch (e) { toast.error('저장 실패'); } finally { setSaving(false); }
  };

  const clearAllSelections = () => { setSelectedActive(new Set()); setSelectedInactive(new Set()); };

  const toggleActive = (code: string, e: React.MouseEvent) => {
    const currentIndex = activeCategories.findIndex(c => c.code === code);
    if (currentIndex === -1) return;
    setSelectedInactive(new Set());
    setSelectedActive(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedActiveIndex !== null && lastClickedActiveIndex < activeCategories.length) {
        const start = Math.min(currentIndex, lastClickedActiveIndex); const end = Math.min(Math.max(currentIndex, lastClickedActiveIndex), activeCategories.length - 1);
        for (let i = start; i <= end; i++) { if (activeCategories[i]) next.add(activeCategories[i].code); }
      } else if (e.ctrlKey || e.metaKey) { next.has(code) ? next.delete(code) : next.add(code); } 
      else { if (next.has(code) && next.size === 1) next.clear(); else { next.clear(); next.add(code); } }
      return next;
    });
    setLastClickedActiveIndex(currentIndex);
  };

  const toggleInactive = (cat: string, e: React.MouseEvent) => {
    const currentIndex = CATEGORIES.indexOf(cat);
    setSelectedActive(new Set());
    setSelectedInactive(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedInactiveIndex !== null) {
        const start = Math.min(currentIndex, lastClickedInactiveIndex); const end = Math.max(currentIndex, lastClickedInactiveIndex);
        for (let i = start; i <= end; i++) next.add(CATEGORIES[i]);
      } else if (e.ctrlKey || e.metaKey) { next.has(cat) ? next.delete(cat) : next.add(cat); } 
      else { if (next.has(cat) && next.size === 1) next.clear(); else { next.clear(); next.add(cat); } }
      return next;
    });
    setLastClickedInactiveIndex(currentIndex);
  };

  const doubleClickActive = (code: string) => {
    if (!selectedPartId) return;
    updateCurrentPart(part => ({ ...part, categories: part.categories.filter(c => c.code !== code) }));
    setSelectedActive(prev => { const n = new Set(prev); n.delete(code); return n; });
  };

  const doubleClickInactive = (cat: string) => {
    if (!selectedPartId) return;
    if (activeCategorySet.has(cat)) { toast.info(`"${cat}" 조코드가 이미 이 파트에 적용되어 있습니다`); return; }
    updateCurrentPart(part => ({ ...part, categories: [...part.categories, { code: cat, rank: DEFAULT_RANK }] }));
    setSelectedInactive(prev => { const n = new Set(prev); n.delete(cat); return n; });
  };

  const handleDragStart = (code: string) => { setDragItem(code); };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!dragItem || !selectedPartId) { setDragItem(null); setDragOverIndex(null); return; }
    updateCurrentPart(part => {
      const sourceIndex = part.categories.findIndex(c => c.code === dragItem);
      if (sourceIndex === -1) return part;
      const next = [...part.categories];
      const [item] = next.splice(sourceIndex, 1);
      const adjusted = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      next.splice(adjusted, 0, item);
      return { ...part, categories: next };
    });
    setDragItem(null); setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragItem(null); setDragOverIndex(null); };

  const sortActive = () => {
    updateCurrentPart(part => ({ ...part, categories: [...part.categories].sort((a, b) => CATEGORIES.indexOf(a.code) - CATEGORIES.indexOf(b.code)) }));
    setLastClickedActiveIndex(null);
  };

  const handleSelectAllInactive = () => { if (selectedInactive.size === CATEGORIES.length) setSelectedInactive(new Set()); else setSelectedInactive(new Set(CATEGORIES)); };
  const handleSelectAllActive = () => { if (selectedActive.size === activeCategories.length) setSelectedActive(new Set()); else setSelectedActive(new Set(activeCategories.map(c => c.code))); };

  const handlePartManageConfirm = (newParts: PartConfig[]) => {
    setParts(newParts);
    if (selectedPartId && !newParts.find(p => p.id === selectedPartId)) { setSelectedPartId(newParts.length > 0 ? newParts[0].id : null); }
    setSelectedActive(new Set()); setSelectedInactive(new Set()); setLastClickedActiveIndex(null); setLastClickedInactiveIndex(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-white/50 w-[760px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()} onMouseDown={clearAllSelections}
      >
        <div className="border-b border-gray-200/50 bg-white/40 shrink-0 px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-stretch gap-3">
            <div className="flex-1 min-w-0 relative" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowStoreDropdown(prev => !prev)} className={`w-full h-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm smooth-transition active:scale-[0.98] border shadow-sm ${selectedStore ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800' : 'bg-white/60 border-gray-300 text-gray-500 hover:bg-white'}`}>
                <MapPin size={14} className={selectedStore ? 'text-emerald-600' : 'text-gray-400'} />
                {selectedStore ? <span className="flex-1 text-left truncate"><span className="text-emerald-500 font-mono mr-1">{selectedStore.code}</span>{selectedStore.name}</span> : <span className="flex-1 text-left text-gray-400">영업점 선택</span>}
                <ChevronDown size={12} className={`transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showStoreDropdown && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-panel absolute left-0 right-0 top-full mt-1 bg-white/95 rounded-2xl z-[210] overflow-hidden">
                    <div className="p-2 border-b border-gray-100/50">
                      <div className="flex items-center gap-2 bg-gray-50/80 rounded-xl px-3 py-1.5"><Search size={13} className="text-gray-400" /><input type="text" value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="코드 또는 영업점명 검색" className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400" autoFocus />{storeSearch && <button onClick={() => setStoreSearch('')} className="p-0.5"><X size={12} className="text-gray-400" /></button>}</div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                      {filteredStores.map(store => (
                        <button key={store.code} onClick={() => { setSelectedStore(store); setShowStoreDropdown(false); setStoreSearch(''); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm smooth-transition ${selectedStore?.code === store.code ? 'bg-emerald-50/80' : 'hover:bg-gray-50/50'}`}>
                          <span className="font-mono text-xs text-gray-400 w-7">{store.code}</span><span className="flex-1 font-semibold">{store.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 min-w-0 relative" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowPartDropdown(prev => !prev)} disabled={parts.length === 0} className={`w-full h-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm smooth-transition active:scale-[0.98] border shadow-sm ${selectedPart ? 'bg-blue-50/80 border-blue-300 text-blue-800' : 'bg-white/60 border-gray-300 text-gray-500 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <Layers size={13} className={selectedPart ? 'text-blue-600' : 'text-gray-400'} />
                {selectedPart ? <span className="flex-1 text-left truncate"><span className="text-blue-400 font-mono mr-1 text-xs">{String(parts.indexOf(selectedPart) + 1).padStart(3, '0')}</span>{selectedPart.name}</span> : <span className="flex-1 text-left text-gray-400">{parts.length === 0 ? '파트 없음' : '파트 선택'}</span>}
                <ChevronDown size={12} className={`transition-transform ${showPartDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showPartDropdown && parts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-panel absolute left-0 right-0 top-full mt-1 bg-white/95 rounded-2xl z-[210] overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                      {parts.map((part, idx) => (
                        <button key={part.id} onClick={() => { setSelectedPartId(part.id); setShowPartDropdown(false); setSelectedActive(new Set()); setSelectedInactive(new Set()); setLastClickedActiveIndex(null); setLastClickedInactiveIndex(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm smooth-transition ${selectedPartId === part.id ? 'bg-blue-50/80' : 'hover:bg-gray-50/50'}`}>
                          <Layers size={12} className={selectedPartId === part.id ? 'text-blue-500' : 'text-gray-300'} /><span className="font-mono text-xs text-gray-400 w-7">{String(idx + 1).padStart(3, '0')}</span><span className="flex-1 font-semibold">{part.name}</span><span className="text-[10px] text-gray-400">{part.categories.length}개</span>
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
              <button onClick={handleSave} disabled={saving || !selectedStore} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600/90 hover:bg-blue-700 disabled:bg-gray-300/50 text-white rounded-xl text-sm smooth-transition active:scale-95 shadow-sm"><Save size={14} /><span>{saving ? '저장중...' : '저장'}</span></button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-100/80 hover:bg-rose-200 text-rose-700 border border-rose-200/50 rounded-xl text-sm smooth-transition active:scale-95 shadow-sm"><XCircle size={14} /><span>취소</span></button>
              <button onClick={handleReset} disabled={!selectedPart} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-100/80 hover:bg-emerald-200 text-emerald-700 border border-emerald-200/50 rounded-xl text-sm smooth-transition active:scale-95 shadow-sm disabled:opacity-50"><RotateCcw size={14} /><span>초기화</span></button>
            </div>
            <div className="flex-1" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => setShowPartManage(true)} disabled={!selectedStore} className="w-full h-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-100/80 hover:bg-violet-200 text-violet-700 border border-violet-300/50 rounded-xl text-sm smooth-transition active:scale-95 shadow-sm disabled:opacity-50"><Settings2 size={13} /><span>파트관리</span></button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0 bg-white/30 backdrop-blur-sm">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 font-bold text-sm">설정 불러오는 중...</div>
          ) : (
            <>
              <div className="flex-1 flex flex-col border-r border-gray-200/50 min-w-0">
                <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200/50 flex items-center justify-between shrink-0" onMouseDown={e => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={CATEGORIES.length > 0 && selectedInactive.size === CATEGORIES.length} ref={el => { if (el) el.indeterminate = selectedInactive.size > 0 && selectedInactive.size < CATEGORIES.length; }} onChange={handleSelectAllInactive} className="w-3.5 h-3.5 accent-gray-600 cursor-pointer" /><span className="text-sm font-bold text-gray-700">조코드 전체</span></label>
                  <span className="text-xs text-gray-500 font-mono font-semibold">{selectedInactive.size > 0 ? `${selectedInactive.size}/` : ''}{CATEGORIES.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/20 custom-scrollbar">
                  {CATEGORIES.map((cat) => {
                    const isInCurrentPart = activeCategorySet.has(cat);
                    return (
                      <div key={cat} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleInactive(cat, e); }} onDoubleClick={() => doubleClickInactive(cat)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-0.5 cursor-pointer select-none text-sm smooth-transition shadow-sm ${selectedInactive.has(cat) ? 'bg-blue-600/90 text-white' : isInCurrentPart ? 'bg-blue-50/50 text-gray-400 border border-blue-200/50' : 'bg-white/80 hover:bg-blue-50/50 text-gray-700 border border-gray-200/50'}`}>
                        <span className="flex-1 truncate font-medium">{cat}</span>
                        {isInCurrentPart && !selectedInactive.has(cat) && <span className="text-[9px] text-blue-500 shrink-0 font-bold">적용됨</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-3 px-3 shrink-0 bg-gray-50/30" onMouseDown={e => e.stopPropagation()}>
                <button onClick={moveToActive} disabled={selectedInactive.size === 0 || !selectedPart} className="w-10 h-10 rounded-xl bg-white/80 border border-gray-300 flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-300 smooth-transition active:scale-90 shadow-sm"><ChevronRight size={20} className="text-blue-600" /></button>
                <button onClick={moveToInactive} disabled={selectedActive.size === 0 || !selectedPart} className="w-10 h-10 rounded-xl bg-white/80 border border-gray-300 flex items-center justify-center hover:bg-orange-50 hover:border-orange-400 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-300 smooth-transition active:scale-90 shadow-sm"><ChevronLeft size={20} className="text-orange-600" /></button>
              </div>

              <div className="flex-1 flex flex-col min-w-0" style={{ flex: '1.2' }}>
                <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-200/30 flex items-center justify-between shrink-0" onMouseDown={e => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={activeCategories.length > 0 && selectedActive.size === activeCategories.length} ref={el => { if (el) el.indeterminate = selectedActive.size > 0 && selectedActive.size < activeCategories.length; }} onChange={handleSelectAllActive} disabled={activeCategories.length === 0} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" /><span className="text-sm font-bold text-blue-800">적용 조코드</span></label>
                  <div className="flex items-center gap-2">
                    <button onClick={sortActive} disabled={activeCategories.length < 2} className="p-1 rounded-full hover:bg-blue-200/50 disabled:opacity-30 smooth-transition" title="기본 순서로 정렬"><ArrowDownUp size={13} className="text-blue-600" /></button>
                    <span className="text-xs text-blue-600 font-mono font-semibold">{selectedActive.size > 0 ? `${selectedActive.size}/` : ''}{activeCategories.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-blue-600/5 custom-scrollbar">
                  {!selectedPart ? (
                    <div className="flex items-center justify-center h-full text-gray-500 font-bold text-xs">{parts.length === 0 ? '파트관리에서 파트를 추가하세요' : '파트를 선택하세요'}</div>
                  ) : activeCategories.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 font-bold text-xs">적용된 조코드가 없습니다</div>
                  ) : (
                    activeCategories.map((item, index) => (
                      <div key={item.code} draggable onMouseDown={e => e.stopPropagation()} onDragStart={() => handleDragStart(item.code)} onDragOver={e => handleDragOver(e, index)} onDrop={e => handleDrop(e, index)} onDragEnd={handleDragEnd} onClick={e => { e.stopPropagation(); toggleActive(item.code, e); }} onDoubleClick={() => doubleClickActive(item.code)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-0.5 cursor-pointer select-none text-sm smooth-transition shadow-sm ${dragOverIndex === index ? 'border-t-2 border-blue-500' : ''} ${selectedActive.has(item.code) ? 'bg-blue-600/90 text-white' : 'bg-white/80 hover:bg-blue-50/50 text-gray-700 border border-gray-200/50'}`}>
                        <GripVertical size={14} className={`shrink-0 ${selectedActive.has(item.code) ? 'text-blue-200' : 'text-gray-300 hover:text-gray-500'}`} />
                        <span className={`w-5 text-center text-xs shrink-0 font-bold ${selectedActive.has(item.code) ? 'text-blue-200' : 'text-blue-500'}`}>{index + 1}</span>
                        <span className="flex-1 truncate font-medium">{item.code}</span>
                        <RankStepper value={item.rank} onChange={v => handleRankChange(item.code, v)} isSelected={selectedActive.has(item.code)} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-gray-200/50 bg-white/40 backdrop-blur-md text-[11px] font-semibold text-gray-500 shrink-0 text-center">
          클릭: 선택 | Ctrl+클릭: 다중 선택 | Shift+클릭: 범위 선택 | 더블클릭: 바로 이동 | 드래그: 순서 변경
        </div>
      </motion.div>

      <PartManageDialog open={showPartManage} parts={parts} onConfirm={handlePartManageConfirm} onClose={() => setShowPartManage(false)} />
    </div>
  );
};