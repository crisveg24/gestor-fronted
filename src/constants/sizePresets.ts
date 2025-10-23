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
    'Colombia/México Dama': ['34', '35', '36', '37', '38', '39', '40'],
    'Colombia/México Caballero': ['38', '39', '40', '41', '42', '43', '44', '45'],
    'USA Mujer (5-11)': ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11'],
    'USA Hombre (7-13)': ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'],
  },
  bebe: {
    'Por Meses': ['0m', '3m', '6m', '9m', '12m', '18m', '24m'],
    'Por Rango': ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
    'Numéricas': ['0', '2', '4', '6', '8', '10', '12'],
    'Colombia (0-24M)': ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M'],
  },
  nino: {
    'Estándar': ['4', '6', '8', '10', '12', '14'],
    'Con Años': ['4Y', '6Y', '8Y', '10Y', '12Y', '14Y', '16Y'],
    'Colombia/México': ['2', '4', '6', '8', '10', '12', '14', '16'],
  },
  adulto: {
    'Estándar': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    'Extra': ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    'Camisas': ['14', '15', '16', '17', '18'],
    'Pantalón Hombre': ['28', '30', '32', '34', '36', '38', '40', '42'],
    'Pantalón Mujer': ['4', '6', '8', '10', '12', '14', '16', '18'],
    'Colombia Estándar': ['S', 'M', 'L', 'XL', 'XXL'],
    'México Extendida': ['CH', 'M', 'G', 'XG', '2XG', '3XG'],
    'USA Completa': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'],
  },
  unica: {
    'Única': ['U'],
    'Talla Libre': ['TL'],
    'One Size': ['OS'],
  },
};

export const getSizePresets = (sizeType: SizeType) => {
  return SIZE_PRESETS[sizeType] || {};
};

export const getAllSizes = (sizeType: SizeType): string[] => {
  const presets = getSizePresets(sizeType);
  return Object.values(presets).flat();
};
