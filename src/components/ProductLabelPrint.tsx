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

// Componente individual de etiqueta (50mm x 30mm para mejor legibilidad)
const ProductLabel = ({ product }: { product: ProductLabelData }) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [barcodeError, setBarcodeError] = useState(false);

  // Código a usar para el código de barras (preferir barcode, sino SKU)
  const barcodeValue = product.barcode || product.sku || '';

  // Formatear precio en pesos colombianos (sin decimales, con separador de miles)
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(product.price);

  // Generar QR al montar
  useEffect(() => {
    const code = product.sku || product.barcode;
    if (code) {
      QRCode.toDataURL(code, {
        width: 100,
        margin: 1,
        errorCorrectionLevel: 'M',
      }).then((url) => {
        setQrDataUrl(url);
      }).catch(() => {
        // Fallback silencioso
      });
    }
  }, [product.sku, product.barcode]);

  // Generar código de barras al montar usando canvas
  useEffect(() => {
    if (barcodeCanvasRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeCanvasRef.current, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5,
          background: '#ffffff',
          lineColor: '#000000',
        });
        setBarcodeError(false);
      } catch {
        setBarcodeError(true);
      }
    }
  }, [barcodeValue]);

  return (
    <div
      className="label-container"
      style={{
        width: '50mm',
        height: '30mm',
        padding: '2mm',
        border: '1px solid #000',
        display: 'flex',
        flexDirection: 'column',
        pageBreakInside: 'avoid',
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: 'white',
      }}
    >
      {/* Fila superior: Nombre + Precio */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '1mm',
        borderBottom: '0.5px solid #000',
        paddingBottom: '1mm',
      }}>
        <div
          style={{
            fontSize: '8pt',
            fontWeight: 'bold',
            lineHeight: 1.1,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            maxHeight: '5mm',
          }}
          title={product.name}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: product.price >= 100000 ? '10pt' : '12pt',
            fontWeight: 'bold',
            marginLeft: '2mm',
            whiteSpace: 'nowrap',
          }}
        >
          ${formattedPrice}
        </div>
      </div>

      {/* Fila central: QR + Código de barras */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '3mm', 
        flex: 1,
      }}>
        {/* QR Code */}
        <div style={{ width: '14mm', height: '14mm', flexShrink: 0 }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              border: '1px dashed #999',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '6pt',
              color: '#999',
            }}>
              QR
            </div>
          )}
        </div>

        {/* Código de barras */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {barcodeValue && !barcodeError ? (
            <canvas 
              ref={barcodeCanvasRef} 
              style={{ 
                maxWidth: '28mm',
                height: '12mm',
              }} 
            />
          ) : (
            <div style={{ 
              fontSize: '8pt', 
              color: '#666',
              textAlign: 'center',
            }}>
              {barcodeValue || 'Sin código'}
            </div>
          )}
        </div>
      </div>

      {/* Fila inferior: SKU */}
      <div
        style={{
          fontSize: '7pt',
          color: '#333',
          textAlign: 'center',
          borderTop: '0.5px solid #000',
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
        size: 50mm 30mm;
        margin: 0;
      }
      @media print {
        html, body {
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .label-container {
          page-break-after: always;
          break-after: page;
        }
        .label-container:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }
        canvas {
          max-width: 100% !important;
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
      <div className="bg-gray-100 p-4 rounded-lg max-h-[500px] overflow-auto">
        <p className="text-sm text-gray-600 mb-3">
          Vista previa ({expandedProducts.length} etiqueta{expandedProducts.length !== 1 ? 's' : ''})
        </p>
        <div
          ref={printRef}
          className="flex flex-wrap gap-3 justify-center"
          style={{ backgroundColor: 'white', padding: '15px' }}
        >
          {expandedProducts.map((product, index) => (
            <ProductLabel key={index} product={product} />
          ))}
        </div>
      </div>

      {/* Instrucciones */}
      <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
        <strong>Tip:</strong> Para mejores resultados, configura tu impresora con tamaño de papel 50mm x 30mm o usa papel de etiquetas estándar.
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
