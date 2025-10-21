// Presets de tallas para el generador de curvas

export const SIZE_TYPES = {
  zapatos: 'Zapatos',
  bebe: 'Ropa Bebé',
  nino: 'Ropa Niño',
  adulto: 'Ropa Adulto',
  unica: 'Talla Única',
} as const;

export type SizeType = keyof typeof SIZE_TYPES;

export const SIZE_PRESETS = {
  zapatos: {
    'Curva Completa (34-42)': ['34', '35', '36', '37', '38', '39', '40', '41', '42'],
    'Curva Dama (34-40)': ['34', '35', '36', '37', '38', '39', '40'],
    'Curva Caballero (38-44)': ['38', '39', '40', '41', '42', '43', '44'],
    'Niños (22-33)': ['22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
  },
  bebe: {
    'Por Meses': ['0m', '3m', '6m', '9m', '12m', '18m', '24m'],
    'Por Rango': ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
    'Numéricas': ['0', '2', '4', '6', '8', '10', '12'],
  },
  nino: {
    'Estándar': ['4', '6', '8', '10', '12', '14'],
    'Con Años': ['4Y', '6Y', '8Y', '10Y', '12Y', '14Y', '16Y'],
  },
  adulto: {
    'Estándar': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    'Extra': ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    'Camisas': ['14', '15', '16', '17', '18'],
    'Pantalón Hombre': ['28', '30', '32', '34', '36', '38', '40', '42'],
    'Pantalón Mujer': ['4', '6', '8', '10', '12', '14', '16', '18'],
  },
  unica: {
    'Única': ['U'],
  },
};

export const getSizePresets = (sizeType: SizeType) => {
  return SIZE_PRESETS[sizeType] || {};
};

export const getAllSizes = (sizeType: SizeType): string[] => {
  const presets = getSizePresets(sizeType);
  return Object.values(presets).flat();
};
