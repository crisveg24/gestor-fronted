/**
 * Formatea un valor numérico como moneda colombiana (COP)
 * @param value - El valor a formatear
 * @returns String formateado como moneda
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Formatea un valor numérico como moneda simplificada (sin símbolo)
 * @param value - El valor a formatear
 * @returns String formateado
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Parsea un string de moneda a número
 * @param value - String con formato de moneda
 * @returns Número parseado
 */
export const parseCurrency = (value: string): number => {
  // Remover caracteres no numéricos excepto el punto decimal
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
};
