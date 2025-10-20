import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
  className?: string;
  defaultValue?: string;
}

const SearchBar = ({
  placeholder = 'Buscar...',
  onSearch,
  debounceMs = 300,
  className = '',
  defaultValue = '',
}: SearchBarProps) => {
  const [value, setValue] = useState(defaultValue);
  const [debouncedValue, setDebouncedValue] = useState(defaultValue);

  // Debounce search value
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, debounceMs]);

  // Trigger search when debounced value changes
  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  const handleClear = useCallback(() => {
    setValue('');
    setDebouncedValue('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="
            w-full pl-10 pr-10 py-2.5
            border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            transition-all duration-200
            placeholder:text-gray-400
          "
        />
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
