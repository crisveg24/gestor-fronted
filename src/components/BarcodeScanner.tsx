import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import Modal from './ui/Modal';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = '📷 Escanear Código',
}) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Limpiar scanner al cerrar
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      setIsScanning(false);
      return;
    }

    // Inicializar scanner
    const initScanner = async () => {
      try {
        // Verificar permisos de cámara
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());

        const scanner = new Html5QrcodeScanner(
          'barcode-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777778, // 16:9
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            ],
          },
          false
        );

        scanner.render(
          (decodedText) => {
            // Código escaneado exitosamente
            console.log('✅ Código escaneado:', decodedText);
            toast.success(`Código detectado: ${decodedText}`);
            
            // Limpiar y cerrar
            scanner.clear().catch(console.error);
            scannerRef.current = null;
            
            // Callback con el código
            onScan(decodedText);
            onClose();
          },
          (errorMessage) => {
            // Error de escaneo (normal mientras busca)
            // No mostrar toast para evitar spam
            console.debug('Escaneando...', errorMessage);
          }
        );

        scannerRef.current = scanner;
        setIsScanning(true);
      } catch (error: any) {
        console.error('❌ Error iniciando scanner:', error);
        
        if (error.name === 'NotAllowedError') {
          toast.error('Necesitas permitir el acceso a la cámara');
        } else if (error.name === 'NotFoundError') {
          toast.error('No se detectó ninguna cámara');
        } else {
          toast.error('Error al iniciar el scanner');
        }
        
        onClose();
      }
    };

    // Pequeño delay para asegurar que el DOM esté listo
    const timer = setTimeout(initScanner, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [isOpen, onScan, onClose]);

  const handleManualInput = () => {
    const barcode = prompt('Ingresa el código manualmente:');
    if (barcode && barcode.trim()) {
      onScan(barcode.trim());
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
    >
      <div className="space-y-4">
        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>📱 Instrucciones:</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
            <li>Permite el acceso a la cámara cuando se solicite</li>
            <li>Coloca el código de barras frente a la cámara</li>
            <li>Mantén el código dentro del área marcada</li>
            <li>El escaneo es automático al detectar el código</li>
          </ul>
        </div>

        {/* Área del scanner */}
        <div className="relative">
          <div
            id="barcode-reader"
            className="w-full"
            style={{ minHeight: isScanning ? '400px' : '200px' }}
          />
          
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Iniciando cámara...</p>
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleManualInput}
            className="flex-1"
          >
            ⌨️ Ingresar Manualmente
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>

        {/* Compatibilidad */}
        <div className="text-xs text-gray-500 text-center">
          <p>💡 Funciona con códigos de barras EAN, UPC, QR y más</p>
          <p className="mt-1">
            ⚠️ Requiere HTTPS en producción para acceso a la cámara
          </p>
        </div>
      </div>
    </Modal>
  );
};
