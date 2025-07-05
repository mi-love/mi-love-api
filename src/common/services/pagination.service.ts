import { Injectable } from '@nestjs/common';

export interface PaginationParams {
  page: number | string;
  limit: number | string;
}

@Injectable()
export class PaginationUtils {
  getPagination({ page, limit }: PaginationParams) {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 50;
    const skip = (pageNumber - 1) * limitNumber;
    return { skip, limit: limitNumber };
  }

  getMeta({
    totalItems,
    page,
    limit,
  }: { totalItems: number } & PaginationParams) {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 50;
    const totalPages = Math.ceil(totalItems / limitNumber);
    return {
      totalPages,
      currentPage: pageNumber,
      itemsPerPage: limitNumber,
      totalItems,
    };
  }
}
