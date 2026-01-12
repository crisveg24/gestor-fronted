import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage = 10,
  totalItems,
  onItemsPerPageChange,
}: PaginationProps) => {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    // Menos páginas visibles en móvil
    const maxVisible = typeof window !== 'undefined' && window.innerWidth < 640 ? 5 : 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= Math.min(4, totalPages); i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = Math.max(totalPages - 3, 1); i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-t border-gray-200 bg-white gap-2 sm:gap-0">
      {/* Info */}
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
        {totalItems !== undefined && (
          <p className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
            <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span>
            {' - '}
            <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span>
            {' de '}
            <span className="font-medium">{totalItems}</span>
          </p>
        )}

        {/* Items per page selector */}
        {onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        )}
      </div>

      {/* Pagination buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 sm:px-3"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline ml-1">Ant</span>
        </Button>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-1.5 sm:px-3 py-1 text-gray-500 text-sm">
                  ...
                </span>
              );
            }

            const pageNumber = page as number;
            const isActive = pageNumber === currentPage;

            return (
              <button
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                className={`
                  px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors min-w-[28px] sm:min-w-[32px]
                  ${
                    isActive
                      ? 'bg-primary-600 text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                  }
                `}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 sm:px-3"
        >
          <span className="hidden sm:inline mr-1">Sig</span>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
