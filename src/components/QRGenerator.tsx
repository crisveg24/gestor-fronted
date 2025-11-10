import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface QRGeneratorProps {
  value: string;
  size?: number;
  label?: string;
  showDownload?: boolean;
}

export const QRGenerator: React.FC<QRGeneratorProps> = ({
  value,
  size = 200,
  label,
  showDownload = true,
}) => {
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    try {
      const canvas = qrRef.current?.querySelector('canvas');
      if (!canvas) {
        toast.error('No se pudo generar el código QR');
        return;
      }

      // Convertir canvas a imagen
      const url = canvas.toDataURL('image/png');
      
      // Crear link de descarga
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-${value}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Código QR descargado');
    } catch (error) {
      console.error('Error descargando QR:', error);
      toast.error('Error al descargar el código QR');
    }
  };

  const handlePrint = () => {
    try {
      const canvas = qrRef.current?.querySelector('canvas');
      if (!canvas) {
        toast.error('No se pudo generar el código QR');
        return;
      }

      // Crear ventana de impresión
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Permite las ventanas emergentes para imprimir');
        return;
      }

      const url = canvas.toDataURL('image/png');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Código QR - ${label || value}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                font-family: Arial, sans-serif;
              }
              .qr-container {
                text-align: center;
                padding: 20px;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              h2 {
                margin-top: 20px;
                color: #333;
              }
              p {
                margin-top: 10px;
                color: #666;
                font-size: 14px;
              }
              @media print {
                body {
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <img src="${url}" alt="Código QR" />
              ${label ? `<h2>${label}</h2>` : ''}
              <p>Código: ${value}</p>
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();
      
      // Esperar a que cargue la imagen antes de imprimir
      printWindow.onload = () => {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
    } catch (error) {
      console.error('Error imprimiendo QR:', error);
      toast.error('Error al imprimir el código QR');
    }
  };

  if (!value || value.trim() === '') {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>No hay código para generar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QR Code */}
      <div
        ref={qrRef}
        className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border-2 border-gray-200"
      >
        <QRCodeCanvas
          value={value}
          size={size}
          level="H" // Alta corrección de errores
          includeMargin={true}
          imageSettings={{
            src: '', // Aquí podrías agregar un logo
            x: undefined,
            y: undefined,
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
        
        {label && (
          <p className="mt-4 text-sm font-medium text-gray-700">{label}</p>
        )}
        
        <p className="mt-2 text-xs text-gray-500 font-mono">{value}</p>
      </div>

      {/* Botones de acción */}
      {showDownload && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownload}
            className="flex-1"
          >
            📥 Descargar
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex-1"
          >
            🖨️ Imprimir
          </Button>
        </div>
      )}

      {/* Información */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <p className="font-medium text-gray-700 mb-1">ℹ️ Información:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Nivel de corrección: Alto (H) - resiste hasta 30% de daño</li>
          <li>Compatible con cualquier lector de códigos QR</li>
          <li>Tamaño optimizado para impresión</li>
        </ul>
      </div>
    </div>
  );
};
