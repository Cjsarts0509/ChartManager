import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Book, BookWithTrend } from '../../lib/types';
import { getComparison } from '../../lib/compare';
import { CATEGORIES } from '../../lib/constants';
import { BookTable } from './BookTable';
import { Printer, X, FileDown } from 'lucide-react';

interface ListCardProps {
  id: string;
  thisWeekBooks: Book[];
  lastWeekBooks: Book[];
  title: string;
  lastWeekTitle: string;
  onDelete: () => void;
  onPrint: (id: string) => void;
  storeCode?: string;
  storeName?: string;
  availableCategories?: string[];
  categoryRanks?: Record<string, number>;
  defaultGroupCode?: string;
  defaultLimit?: number;
}

export const ListCard: React.FC<ListCardProps> = ({
  id,
  thisWeekBooks,
  lastWeekBooks,
  title,
  lastWeekTitle,
  onDelete,
  onPrint,
  storeCode,
  storeName,
  availableCategories,
  categoryRanks,
  defaultGroupCode,
  defaultLimit
}) => {
  const categories = availableCategories && availableCategories.length > 0 ? availableCategories : CATEGORIES;
  const [groupCode, setGroupCode] = useState(defaultGroupCode || categories[0] || "소설");
  const [limit, setLimit] = useState(() => {
    if (defaultLimit) return defaultLimit;
    const first = defaultGroupCode || categories[0];
    return (first && categoryRanks?.[first]) || 20;
  });

  // defaultGroupCode/defaultLimit 변경 시 동기화 (파트 전환 등)
  React.useEffect(() => {
    if (defaultGroupCode) {
      setGroupCode(defaultGroupCode);
      setLimit(defaultLimit || categoryRanks?.[defaultGroupCode] || 20);
    }
  }, [defaultGroupCode, defaultLimit]);

  // categories가 변경되었을 때 현재 groupCode가 목록에 없으면 첫 번째로 리셋
  React.useEffect(() => {
    if (!defaultGroupCode && !categories.includes(groupCode)) {
      const first = categories[0] || "소설";
      setGroupCode(first);
      setLimit(categoryRanks?.[first] || 20);
    }
  }, [categories, groupCode, categoryRanks, defaultGroupCode]);

  // groupCode 변경 시 해당 카테고리의 설정 순위로 자동 변경
  React.useEffect(() => {
    if (categoryRanks && categoryRanks[groupCode]) {
      setLimit(categoryRanks[groupCode]);
    }
  }, [groupCode, categoryRanks]);

  // 1. 이번주 데이터 계산 (Top List)
  const currentList = useMemo(() => {
    return getComparison(thisWeekBooks, lastWeekBooks, groupCode, limit);
  }, [thisWeekBooks, lastWeekBooks, groupCode, limit]);

  // 2. 지난주 데이터 계산 (Bottom List - OUT 판별 로직 강화)
  const pastList = useMemo(() => {
    const prevGroupSlice = lastWeekBooks
      .filter(b => b.groupCode === groupCode)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);

    const currentGroupSlice = thisWeekBooks
      .filter(b => b.groupCode === groupCode)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);

    return prevGroupSlice.map(prevBook => {
      const existsInCurrentTopN = currentGroupSlice.some(curr => curr.isbn === prevBook.isbn);
      
      return {
        ...prevBook,
        prevRank: null,
        trend: existsInCurrentTopN ? 'same' : 'out', 
        trendValue: 0
      } as BookWithTrend;
    });
  }, [lastWeekBooks, thisWeekBooks, groupCode, limit]);

  // 엑셀 다운로드: HTML 테이블로 서식 유지
  const handleExcelDownload = () => {
    const getTrendText = (book: BookWithTrend) => {
      if (book.trend === 'new') return 'NEW';
      if (book.trend === 'out') return 'OUT';
      if (book.trend === 'up') return `▲${book.trendValue}`;
      if (book.trend === 'down') return `▼${book.trendValue}`;
      return '-';
    };

    const getRowStyle = (book: BookWithTrend) => {
      if (book.trend === 'new') return 'background-color:#2563EB;color:#fff;';
      if (book.trend === 'out') return 'background-color:#DC2626;color:#fff;';
      return '';
    };

    const getTrendStyle = (book: BookWithTrend) => {
      if (book.trend === 'new' || book.trend === 'out') return 'color:#fff;';
      if (book.trend === 'up') return 'color:#DC2626;';
      if (book.trend === 'down') return 'color:#2563EB;';
      return 'color:#999;';
    };

    const buildTable = (books: BookWithTrend[], sectionTitle: string) => {
      let html = `<tr><td colspan="4" style="text-align:center;font-weight:bold;font-size:13px;padding:8px 0;border-top:2px solid #000;">${sectionTitle}</td></tr>`;
      html += `<tr><td colspan="4" style="text-align:center;font-size:10px;color:#888;padding:2px 0;font-weight:bold;">${groupCode} 분야</td></tr>`;
      html += `<tr style="background-color:#F2F2F2;font-weight:bold;text-align:center;border-top:2px solid #000;border-bottom:1px solid #000;">
        <td style="width:40px;">순위</td>
        <td style="width:120px;">ISBN</td>
        <td style="width:250px;">도서명</td>
        <td style="width:50px;">변동</td>
      </tr>`;
      
      books.forEach(book => {
        const rowStyle = getRowStyle(book);
        const trendStyle = getTrendStyle(book);
        html += `<tr style="${rowStyle}border-bottom:1px solid #E1E1E1;">
          <td style="text-align:center;font-weight:bold;">${book.rank > 0 ? book.rank : ''}</td>
          <td style="text-align:center;mso-number-format:'\\@';">${book.isbn}</td>
          <td style="font-weight:600;padding-left:4px;">${book.title}</td>
          <td style="text-align:center;font-weight:bold;${trendStyle}">${getTrendText(book)}</td>
        </tr>`;
      });
      
      return html;
    };

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>td{font-family:sans-serif;font-size:10px;vertical-align:middle;}</style></head><body>`;

    // 시트1: 이번주
    html += `<div id="이번주"><table>${buildTable(currentList, title || '이번주')}</table></div>`;
    // 시트2: 지난주
    html += `<div id="지난주"><table>${buildTable(pastList, lastWeekTitle || '지난주')}</table></div>`;

    html += '</body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupCode}_Top${limit}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      id={`list-card-${id}`}
      className="list-card-print glass-panel p-4 rounded-xl flex flex-col items-center print:shadow-none print:border-none print:bg-white print:p-0 select-none"
      style={{ width: 'fit-content' }}
    >
      {/* Control Panel */}
      <div className="w-full flex items-center justify-between mb-2 print:hidden min-w-[300px]">
        <div className="flex items-center gap-2">
          <button onClick={() => onPrint(id)} className="p-1 hover:bg-gray-100 rounded text-gray-600 smooth-transition hover:scale-110 active:scale-95" title="인쇄">
            <Printer size={16} />
          </button>
          <button onClick={handleExcelDownload} className="p-1 hover:bg-green-100 rounded text-gray-600 smooth-transition hover:scale-110 active:scale-95" title="ISBN 엑셀 다운로드">
            <FileDown size={16} />
          </button>
          
          <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
            <select 
              value={groupCode} 
              onChange={(e) => setGroupCode(e.target.value)}
              className="bg-white/50 backdrop-blur-sm border border-gray-300 rounded px-1 py-0.5 text-sm cursor-pointer smooth-transition hover:bg-white/80 focus:ring-2 focus:ring-primary/50"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <input 
            type="number" 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-white/50 backdrop-blur-sm border border-gray-300 rounded w-12 text-center py-0.5 text-sm smooth-transition hover:bg-white/80 focus:ring-2 focus:ring-primary/50"
            min={1} max={50}
          />
          <button onClick={onDelete} className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded smooth-transition hover:scale-110 active:scale-95">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Print Area */}
      <div className="w-[400px] print:w-full bg-transparent print:bg-white">
        {/* Section 1: This Week */}
        <div className="text-center border-t-2 border-black/80 pt-2 pb-1">
          <h3 className="font-bold text-sm">{title}</h3>
          <p className="text-[11px] text-[#888] mt-0.5 font-bold">{groupCode} 분야</p>
        </div>
        <BookTable books={currentList} storeCode={storeCode} storeName={storeName} />

        {/* Section 2: Last Week */}
        <div className="mt-6">
          <div className="text-center border-t border-black/80 pt-2 pb-1">
             <h3 className="font-bold text-sm">{lastWeekTitle || "지난주 데이터 없음"}</h3>
          </div>
          <BookTable books={pastList} storeCode={storeCode} storeName={storeName} />
        </div>
      </div>
    </motion.div>
  );
};