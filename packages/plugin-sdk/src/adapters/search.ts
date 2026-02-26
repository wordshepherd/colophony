import type { BaseAdapter } from "./common.js";

export interface SearchDocument {
  id: string;
  index: string;
  fields: Record<string, unknown>;
}

export interface SearchQuery {
  index: string;
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: string;
  score: number;
  fields: Record<string, unknown>;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  took: number;
}

export interface SearchAdapter extends BaseAdapter {
  index(document: SearchDocument): Promise<void>;
  indexBulk(documents: SearchDocument[]): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
  remove(documentId: string, index: string): Promise<void>;
}
