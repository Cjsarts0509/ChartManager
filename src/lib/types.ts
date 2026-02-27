export interface Book {
  rank: number;
  isbn: string;
  title: string;
  author: string;
  groupCode: string; // "조코드" e.g., "01"
}

export interface BookWithTrend extends Book {
  prevRank: number | null; // null if not found in previous week
  trend: "up" | "down" | "same" | "new" | "out";
  trendValue: number; // Absolute difference
}

export interface ProcessedData {
  title: string;
  books: Book[];
}

export interface ListConfig {
  id: string;
  groupCode: string;
  limit: number;
}
