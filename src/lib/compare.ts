import { Book, BookWithTrend } from "./types";

export const getComparison = (
  thisWeekBooks: Book[],
  lastWeekBooks: Book[],
  groupCode: string,
  limit: number
): BookWithTrend[] => {
  // 1. 분야별 데이터 필터링
  const currentGroup = thisWeekBooks.filter((b) => b.groupCode === groupCode);
  const prevGroup = lastWeekBooks.filter((b) => b.groupCode === groupCode);

  // 2. 순위 정렬
  currentGroup.sort((a, b) => a.rank - b.rank);
  prevGroup.sort((a, b) => a.rank - b.rank);

  // 3. 비교 대상군 설정 (엄격하게 limit 개수만큼만 잘라서 비교군 형성)
  // "NEW"를 판단할 때: 지난주 전체가 아니라, '지난주 Top N'에 없었으면 NEW로 침
  const prevTopN = prevGroup.slice(0, limit);
  
  // 4. 이번주 데이터 처리 (Top N만 처리)
  const currentTopN = currentGroup.slice(0, limit);

  const processed = currentTopN.map((book) => {
    // 잘라낸 지난주 Top N 리스트에서 찾기
    const prevBook = prevTopN.find((b) => b.isbn === book.isbn);

    let trend: BookWithTrend["trend"] = "same";
    let trendValue = 0;
    let prevRank = null;

    if (!prevBook) {
      // 지난주 Top N에 없었으면 NEW
      trend = "new";
    } else {
      prevRank = prevBook.rank;
      const diff = prevRank - book.rank; 
      
      if (diff > 0) {
        trend = "up";
        trendValue = diff;
      } else if (diff < 0) {
        trend = "down";
        trendValue = Math.abs(diff);
      } else {
        trend = "same";
      }
    }

    return {
      ...book,
      prevRank,
      trend,
      trendValue,
    };
  });

  return processed;
};