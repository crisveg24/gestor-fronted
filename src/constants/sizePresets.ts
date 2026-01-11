// Presets de tallas y variantes para el generador de curvas

export const SIZE_TYPES = {
  zapatos: 'Zapatos',
  bebe: 'Ropa Bebé',
  nino: 'Ropa Niño',
  adulto: 'Ropa Adulto',
  unica: 'Talla Única',
  // Nuevas variantes para cacharrería
  metros: 'Por Metros/Longitud',
  colores: 'Por Colores',
  voltaje: 'Por Voltaje/Watts',
  capacidad: 'Por Capacidad',
  medidas: 'Por Medidas',
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
  // === NUEVAS VARIANTES PARA CACHARRERÍA ===
  metros: {
    'Extensiones Eléctricas': ['1M', '1.5M', '2M', '3M', '5M', '10M', '15M', '20M'],
    'Cables USB': ['0.5M', '1M', '1.5M', '2M', '3M', '5M'],
    'Mangueras': ['5M', '10M', '15M', '20M', '25M', '30M', '50M'],
    'Cuerdas/Sogas': ['1M', '2M', '5M', '10M', '20M', '50M', '100M'],
    'Cintas Métricas': ['3M', '5M', '7.5M', '10M'],
  },
  colores: {
    'Básicos': ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo'],
    'Completos': ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosado', 'Café'],
    'Lapiceros/Esferos': ['Negro', 'Azul', 'Rojo', 'Verde'],
    'Marcadores': ['Negro', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosado', 'Café', 'Gris'],
    'Neón': ['Verde Neón', 'Amarillo Neón', 'Naranja Neón', 'Rosado Neón', 'Azul Neón'],
    'Metálicos': ['Dorado', 'Plateado', 'Bronce', 'Cobre'],
  },
  voltaje: {
    'Bombillos LED': ['5W', '7W', '9W', '12W', '15W', '18W', '20W'],
    'Bombillos Tradicionales': ['40W', '60W', '75W', '100W'],
    'Reguladores': ['110V', '220V', '110V-220V'],
    'Transformadores': ['12V', '24V', '110V', '220V'],
    'Cargadores': ['5V-1A', '5V-2A', '9V-2A', '12V-2A', '20W', '30W', '45W', '65W', '100W'],
  },
  capacidad: {
    'USB/Memorias': ['8GB', '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
    'Termos/Recipientes': ['250ml', '350ml', '500ml', '750ml', '1L', '1.5L', '2L'],
    'Galones/Tanques': ['1 Galón', '2.5 Galones', '5 Galones', '10 Galones', '20 Galones'],
    'Pilas/Baterías': ['AA', 'AAA', 'C', 'D', '9V', 'CR2032'],
    'Power Banks': ['5000mAh', '10000mAh', '20000mAh', '30000mAh'],
  },
  medidas: {
    'Tornillos/Pernos': ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1.5"', '2"'],
    'Brocas': ['1mm', '2mm', '3mm', '4mm', '5mm', '6mm', '8mm', '10mm', '12mm'],
    'Tubos PVC': ['1/2"', '3/4"', '1"', '1.5"', '2"', '3"', '4"'],
    'Papel': ['Carta', 'Oficio', 'A4', 'A3', 'Tabloide'],
    'Cuadernos': ['50 Hojas', '80 Hojas', '100 Hojas', '200 Hojas'],
  },
};

export const getSizePresets = (sizeType: SizeType) => {
  return SIZE_PRESETS[sizeType] || {};
};

export const getAllSizes = (sizeType: SizeType): string[] => {
  const presets = getSizePresets(sizeType);
  return Object.values(presets).flat();
};
