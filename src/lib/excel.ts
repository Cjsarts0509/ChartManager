import * as XLSX from 'xlsx';
import { Book, ProcessedData } from './types';

// Core parsing logic - works with any data XLSX.read can handle
const parseWorkbook = (workbook: XLSX.WorkBook): ProcessedData => {
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  if (jsonData.length === 0) {
    throw new Error("엑셀 파일이 비어있습니다.");
  }

  // 제목 추출
  let title = "제목 없음";
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i];
    for (const cell of row) {
      if (typeof cell === 'string' && (cell.includes('베스트셀러') || cell.includes('주'))) {
        if (cell.length > 5) { 
          title = cell;
          break; 
        }
      }
    }
    if (title !== "제목 없음") break;
  }

  const books: Book[] = [];

  // =========================================================
  // [Part 1] 상단 영역 파싱 (Row 2 ~ 201)
  // =========================================================
  const COMPREHENSIVE_END_INDEX = 200; 
  
  // ★ 시/에세이 전용 순위 카운터 초기화
  let poetryRank = 1;

  for (let i = 1; i <= COMPREHENSIVE_END_INDEX; i++) {
      if (i >= jsonData.length) break;

      const row = jsonData[i];
      if (!row) continue;

      const isbn = row[1] ? String(row[1]).trim() : "";
      
      if (isbn && isbn.length > 5) {
          // 엑셀에 적힌 원래 순위 (A열)
          const originalRank = parseInt(String(row[0])) || i;

          const bookBase = {
              isbn: isbn,
              title: String(row[2]).trim(),
              author: row[3] ? String(row[3]).trim() : "",
          };

          // 1. 종합베스트 리스트에는 무조건 추가 (A열 순위 사용)
          books.push({ 
              ...bookBase, 
              rank: originalRank, 
              groupCode: "종합베스트" 
          });

          // 2. "시/에세이" 조건 체크 (G열)
          const groupVar = row[6] ? String(row[6]).trim() : "";
          
          if (groupVar === "시" || groupVar === "에세이" || groupVar.includes("시/에세이")) {
              // ★ 핵심 변경: 시/에세이는 A열 순위 대신, 발견된 순서대로 1, 2, 3... 부여
              books.push({ 
                  ...bookBase, 
                  rank: poetryRank++, // 카운터 사용
                  groupCode: "시/에세이" 
              });
          }
      }
  }

  // =========================================================
  // [Part 2] 일반 분야 파싱 (Row 202 ~ 끝)
  // =========================================================
  const NORMAL_START_INDEX = 201;

  for (let i = NORMAL_START_INDEX; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row) continue;

    const isbnCandidate = row[1];
    const groupCandidate = row[6]; // G열

    if (isbnCandidate && String(isbnCandidate).length > 5 && groupCandidate) {
      books.push({
        rank: parseInt(String(row[0])) || 0,
        isbn: String(row[1]).trim(),
        title: String(row[2]).trim(),
        author: row[3] ? String(row[3]).trim() : "",
        groupCode: String(row[6]).trim()
      });
    }
  }

  console.log(`총 ${books.length}개의 데이터를 불러왔습니다.`);
  return { title, books };
};

// Parse from File object (local upload)
export const parseExcel = async (file: File): Promise<ProcessedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { reject("파일 읽기 실패"); return; }
        // ArrayBuffer로 읽어서 XLSX에 전달 (바이너리 안전)
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(parseWorkbook(workbook));
      } catch (err) {
        console.error(err);
        reject("엑셀 파일 파싱 중 오류가 발생했습니다.");
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file); // ★ readAsBinaryString 대신 readAsArrayBuffer 사용
  });
};

// Parse from ArrayBuffer (cloud download)
export const parseExcelFromBuffer = (buffer: ArrayBuffer): ProcessedData => {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  return parseWorkbook(workbook);
};

/**
 * 엑셀 A1 셀 타이틀에서 주차 정보를 추출하여 정렬 가능한 키를 반환
 * 형식: "2026년 2월 2주간 베스트셀러" → "2026-02-02"
 *       "2026년 12월 1주간 베스트셀러" → "2026-12-01"
 * 추출 실패 시 null 반환
 */
export const extractWeekKey = (title: string): string | null => {
  // "YYYY년 M월 N주" 패턴 (주간, 주차 등 포함)
  const match = title.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})주/);
  if (!match) return null;
  const year = match[1];
  const month = match[2].padStart(2, '0');
  const week = match[3].padStart(2, '0');
  return `${year}-${month}-${week}`;
};