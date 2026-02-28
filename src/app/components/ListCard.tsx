import React, { useState, useMemo } from 'react';
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
}

export const ListCard: React.FC<ListCardProps> = ({
  id,
  thisWeekBooks,
  lastWeekBooks,
  title,
  lastWeekTitle,
  onDelete,
  onPrint
}) => {
  const [groupCode, setGroupCode] = useState("소설");
  const [limit, setLimit] = useState(20); 

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
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>이번주</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>지난주</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
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
    <div 
      id={`list-card-${id}`}
      className="list-card-print bg-white p-4 shadow-xl border border-gray-200 flex flex-col items-center print:shadow-none print:border-none print:p-0 select-none"
      style={{ width: 'fit-content' }}
    >
      {/* Control Panel */}
      <div className="w-full flex items-center justify-between mb-2 print:hidden min-w-[300px]">
        <div className="flex items-center gap-2">
          <button onClick={() => onPrint(id)} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="인쇄">
            <Printer size={16} />
          </button>
          <button onClick={handleExcelDownload} className="p-1 hover:bg-green-100 rounded text-gray-600" title="ISBN 엑셀 다운로드">
            <FileDown size={16} />
          </button>
          
          <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
            <select 
              value={groupCode} 
              onChange={(e) => setGroupCode(e.target.value)}
              className="border border-gray-300 rounded px-1 py-0.5 text-sm cursor-pointer"
            >
              {CATEGORIES.map(cat => (
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
            className="border border-gray-300 rounded w-12 text-center py-0.5 text-sm"
            min={1} max={50}
          />
          <button onClick={onDelete} className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Print Area */}
      <div className="w-[400px] print:w-full bg-white">
        {/* Section 1: This Week */}
        <div className="text-center border-t-2 border-black pt-2 pb-1">
          <h3 className="font-bold text-sm">{title}</h3>
          <p className="text-[11px] text-[#888] mt-0.5 font-bold">{groupCode} 분야</p>
        </div>
        <BookTable books={currentList} />

        {/* Section 2: Last Week */}
        <div className="mt-6">
          <div className="text-center border-t border-black pt-2 pb-1">
             <h3 className="font-bold text-sm">{lastWeekTitle || "지난주 데이터 없음"}</h3>
          </div>
          <BookTable books={pastList} />
        </div>
      </div>
    </div>
  );
};