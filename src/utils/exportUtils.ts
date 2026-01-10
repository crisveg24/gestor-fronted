/**
 * Utilidades de exportación con lazy loading
 * Las librerías pesadas (jspdf, xlsx) se cargan solo cuando se necesitan
 */

// ==================== TIPOS ====================
export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  filename: string;
  title?: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
}

// ==================== EXCEL EXPORT ====================
export async function exportToExcel(options: ExportOptions): Promise<void> {
  const { filename, title, columns, data } = options;
  
  // Lazy load xlsx
  const XLSX = await import('xlsx');
  
  // Preparar datos para Excel
  const headers = columns.map(col => col.header);
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      return value !== undefined && value !== null ? String(value) : '';
    })
  );
  
  // Crear workbook
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Ajustar anchos de columna
  const colWidths = columns.map(col => ({ wch: col.width || 15 }));
  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, title || 'Datos');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ==================== PDF EXPORT ====================
export async function exportToPDF(options: ExportOptions): Promise<void> {
  const { filename, title, columns, data } = options;
  
  // Lazy load jspdf y autotable
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  
  const doc = new jsPDF();
  
  // Título
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 20);
  }
  
  // Preparar datos para la tabla
  const headers = columns.map(col => col.header);
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      return value !== undefined && value !== null ? String(value) : '';
    })
  );
  
  // Generar tabla
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 30 : 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }, // Azul
  });
  
  doc.save(`${filename}.pdf`);
}

// ==================== HELPER: FORMATEAR MONEDA ====================
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
}

// ==================== HELPER: FORMATEAR FECHA ====================
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ==================== HELPER: FORMATEAR FECHA Y HORA ====================
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
