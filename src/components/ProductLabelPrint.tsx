import { useRef } from 'react';
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
  const qrRef = useRef<HTMLImageElement>(null);

  // Generar código de barras
  if (barcodeRef.current && product.barcode) {
    try {
      JsBarcode(barcodeRef.current, product.barcode, {
        format: 'EAN13',
        width: 1.2,
        height: 25,
        displayValue: true,
        fontSize: 8,
        margin: 0,
      });
    } catch {
      // Si falla EAN13, intentar CODE128
      try {
        JsBarcode(barcodeRef.current, product.barcode, {
          format: 'CODE128',
          width: 1,
          height: 25,
          displayValue: true,
          fontSize: 8,
          margin: 0,
        });
      } catch {
        // Ignorar si falla
      }
    }
  }

  // Generar QR
  if (qrRef.current && product.sku) {
    QRCode.toDataURL(product.sku, {
      width: 50,
      margin: 0,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (qrRef.current) {
        qrRef.current.src = url;
      }
    });
  }

  return (
    <div
      className="label-container"
      style={{
        width: '50mm',
        height: '25mm',
        padding: '2mm',
        border: '0.5px solid #ccc',
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
          fontSize: '7pt',
          fontWeight: 'bold',
          lineHeight: 1.1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxHeight: '12px',
        }}
      >
        {product.name}
      </div>

      {/* Contenedor principal: Códigos + Precio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', flex: 1 }}>
        {/* QR Code */}
        <div style={{ width: '15mm', height: '15mm', flexShrink: 0 }}>
          <img
            ref={qrRef}
            alt="QR"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Código de barras */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {product.barcode ? (
            <svg ref={barcodeRef} style={{ maxWidth: '25mm', height: '25px' }} />
          ) : (
            <div style={{ fontSize: '6pt', color: '#999' }}>Sin código</div>
          )}
        </div>

        {/* Precio */}
        <div
          style={{
            fontSize: '11pt',
            fontWeight: 'bold',
            textAlign: 'right',
            minWidth: '12mm',
          }}
        >
          Q{product.price.toFixed(2)}
        </div>
      </div>

      {/* SKU */}
      <div
        style={{
          fontSize: '6pt',
          color: '#666',
          textAlign: 'center',
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
