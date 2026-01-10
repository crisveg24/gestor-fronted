import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Modal from './ui/Modal';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'error' | 'no-camera';

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = '📷 Escanear Código',
}) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [manualCode, setManualCode] = useState('');

  const cleanupScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setStatus('requesting');
    setErrorMessage('');

    try {
      // Primero verificar si hay cámaras disponibles
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      
      if (cameras.length === 0) {
        setStatus('no-camera');
        setErrorMessage('No se detectaron cámaras en este dispositivo');
        return;
      }

      // Solicitar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Preferir cámara trasera
        } 
      });
      // Liberar el stream de prueba
      stream.getTracks().forEach(track => track.stop());

      // Limpiar cualquier scanner previo
      cleanupScanner();

      // Pequeño delay para asegurar que el DOM esté listo
      await new Promise(resolve => setTimeout(resolve, 200));

      const scanner = new Html5QrcodeScanner(
        'barcode-reader',
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.5,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        },
        false
      );

      scanner.render(
        (decodedText) => {
          console.log('✅ Código escaneado:', decodedText);
          toast.success(`Código detectado: ${decodedText}`);
          
          cleanupScanner();
          onScan(decodedText);
          onClose();
        },
        () => {
          // Silenciar errores de escaneo (normal mientras busca)
        }
      );

      scannerRef.current = scanner;
      setStatus('scanning');

    } catch (error) {
      const err = error as { name?: string; message?: string };
      console.error('❌ Error iniciando scanner:', err);
      
      setStatus('error');
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Permiso de cámara denegado. Por favor permite el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No se encontró ninguna cámara en este dispositivo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage('La cámara está siendo usada por otra aplicación.');
      } else if (err.name === 'OverconstrainedError') {
        setErrorMessage('No se pudo acceder a la cámara con la configuración solicitada.');
      } else if (err.name === 'TypeError' || err.message?.includes('mediaDevices')) {
        setErrorMessage('Tu navegador no soporta acceso a la cámara. Usa Chrome, Firefox o Safari.');
      } else {
        setErrorMessage(`Error: ${err.message || 'No se pudo iniciar la cámara'}`);
      }
    }
  }, [cleanupScanner, onScan, onClose]);

  useEffect(() => {
    if (isOpen) {
      setManualCode('');
      // Auto-iniciar el scanner al abrir
      startScanner();
    } else {
      cleanupScanner();
      setStatus('idle');
      setErrorMessage('');
    }

    return () => {
      cleanupScanner();
    };
  }, [isOpen, startScanner, cleanupScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
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
        {/* Formulario de entrada manual - siempre visible */}
        <form onSubmit={handleManualSubmit} className="bg-green-50 border border-green-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-green-800 mb-2">
            ⌨️ Ingresar código manualmente:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Escribe el código de barras o SKU"
              className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            <Button type="submit" disabled={!manualCode.trim()}>
              Buscar
            </Button>
          </div>
        </form>

        {/* Estado del scanner */}
        {status === 'requesting' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-blue-700">Solicitando acceso a la cámara...</p>
            <p className="text-sm text-blue-600 mt-1">Acepta el permiso cuando el navegador lo solicite</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-medium">❌ {errorMessage}</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={startScanner} variant="outline" size="sm">
                🔄 Reintentar
              </Button>
            </div>
          </div>
        )}

        {status === 'no-camera' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 font-medium">📵 {errorMessage}</p>
            <p className="text-sm text-yellow-600 mt-1">Usa el campo de arriba para ingresar el código manualmente.</p>
          </div>
        )}

        {/* Área del scanner - solo mostrar si está escaneando */}
        {(status === 'scanning' || status === 'requesting') && (
          <div className="relative">
            <div
              id="barcode-reader"
              className="w-full rounded-lg overflow-hidden"
              style={{ minHeight: status === 'scanning' ? '350px' : '150px' }}
            />
          </div>
        )}

        {/* Instrucciones cuando está escaneando */}
        {status === 'scanning' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              📱 Apunta la cámara al código de barras o QR. El escaneo es automático.
            </p>
          </div>
        )}

        {/* Botón cancelar */}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BarcodeScanner;
