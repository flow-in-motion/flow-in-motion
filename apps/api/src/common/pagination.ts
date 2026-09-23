import { BadRequestException } from '@nestjs/common';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): PaginatedResult<never>['meta'] {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { page: safePage, pageSize, totalItems, totalPages };
}
export function paginationOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * pageSize;
}

// Bound explicit All requests; never silently truncate or fan out into many requests.
export const MAX_ALL_ITEMS = 5000;
export function listPageSize(pageSize: number | 'all'): number {
  return pageSize === 'all' ? MAX_ALL_ITEMS : pageSize;
}
export function assertAllFits(pageSize: number | 'all', totalItems: number) {
  if (pageSize === 'all' && totalItems > MAX_ALL_ITEMS) {
    throw new BadRequestException(`All is limited to ${MAX_ALL_ITEMS} items. Choose 20, 50 or 100, or narrow your search.`);
  }
}

export function searchPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, '\\$&')}%`;
}
