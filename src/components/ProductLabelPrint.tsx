import { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from './ui';
import { Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface ProductLabelData {
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  quantity?: number; // Cantidad de etiquetas a imprimir
}

interface ProductLabelPrintProps {
  products: ProductLabelData[];
  onClose?: () => void;
}

// Componente individual de etiqueta (5cm x 2.5cm = 50mm x 25mm)
const ProductLabel = ({ product }: { product: ProductLabelData }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generar QR al montar
  useEffect(() => {
    if (product.sku) {
      QRCode.toDataURL(product.sku, {
        width: 80,
        margin: 1,
        errorCorrectionLevel: 'M',
      }).then((url) => {
        setQrDataUrl(url);
      }).catch(() => {
        // Fallback si falla
      });
    }
  }, [product.sku]);

  // Generar código de barras al montar
  useEffect(() => {
    if (barcodeRef.current && product.barcode) {
      try {
        JsBarcode(barcodeRef.current, product.barcode, {
          format: 'CODE128', // Más flexible que EAN13
          width: 1.5,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 2,
        });
      } catch {
        // Ignorar errores
      }
    }
  }, [product.barcode]);

  return (
    <div
      className="label-container"
      style={{
        width: '50mm',
        height: '25mm',
        padding: '2mm',
        border: '1px solid #ccc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pageBreakInside: 'avoid',
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: 'white',
      }}
    >
      {/* Nombre del producto */}
      <div
        style={{
          fontSize: '8pt',
          fontWeight: 'bold',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={product.name}
      >
        {product.name}
      </div>

      {/* Contenedor principal: QR + Código de barras + Precio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', flex: 1, marginTop: '1mm' }}>
        {/* QR Code */}
        <div style={{ width: '12mm', height: '12mm', flexShrink: 0 }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6pt' }}>QR</div>
          )}
        </div>

        {/* Código de barras */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
          {product.barcode ? (
            <svg ref={barcodeRef} style={{ maxWidth: '22mm', height: '28px' }} />
          ) : (
            <div style={{ fontSize: '6pt', color: '#999' }}>Sin código</div>
          )}
        </div>

        {/* Precio */}
        <div
          style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            textAlign: 'right',
            minWidth: '14mm',
            color: '#000',
          }}
        >
          Q{product.price.toFixed(2)}
        </div>
      </div>

      {/* SKU en la parte inferior */}
      <div
        style={{
          fontSize: '6pt',
          color: '#555',
          textAlign: 'center',
          borderTop: '0.5px solid #ddd',
          paddingTop: '1mm',
          marginTop: '1mm',
        }}
      >
        SKU: {product.sku}
      </div>
    </div>
  );
};

// Componente principal con vista de impresión
export const ProductLabelPrint = ({ products, onClose }: ProductLabelPrintProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Etiquetas de Productos',
    pageStyle: `
      @page {
        size: 50mm 25mm;
        margin: 0;
      }
      @media print {
        html, body {
          margin: 0;
          padding: 0;
        }
        .label-container {
          page-break-after: always;
        }
        .label-container:last-child {
          page-break-after: avoid;
        }
      }
    `,
  });

  // Expandir productos según cantidad
  const expandedProducts = products.flatMap((product) => {
    const qty = product.quantity || 1;
    return Array(qty).fill(product);
  });

  return (
    <div className="space-y-4">
      {/* Vista previa */}
      <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
        <p className="text-sm text-gray-600 mb-3">
          Vista previa ({expandedProducts.length} etiqueta{expandedProducts.length !== 1 ? 's' : ''})
        </p>
        <div
          ref={printRef}
          className="flex flex-wrap gap-2"
          style={{ backgroundColor: 'white', padding: '10px' }}
        >
          {expandedProducts.map((product, index) => (
            <ProductLabel key={index} product={product} />
          ))}
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        )}
        <Button onClick={() => handlePrint()} leftIcon={<Printer size={18} />}>
          Imprimir Etiquetas
        </Button>
      </div>
    </div>
  );
};

export default ProductLabelPrint;
