import { AlertTriangle, Store } from 'lucide-react';
import { Card } from './';

const EmptyStateNoStore = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <Card.Body className="text-center py-12">
          <div className="mb-6">
            <div className="relative inline-flex">
              <Store size={64} className="text-gray-300" />
              <div className="absolute -top-2 -right-2 bg-orange-100 rounded-full p-2">
                <AlertTriangle size={24} className="text-orange-500" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Sin Tienda Asignada
          </h2>

          <p className="text-gray-600 mb-2">
            No tienes una tienda asignada actualmente.
          </p>
          
          <p className="text-gray-500 text-sm mb-6">
            Para poder registrar ventas, ver inventario y acceder a productos, necesitas que un administrador te asigne a una tienda.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-1">
              💡 ¿Qué hacer?
            </p>
            <p className="text-sm text-blue-700">
              Contacta a tu administrador para que te asigne a la tienda donde trabajarás hoy.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Este sistema permite rotación diaria de empleados entre diferentes tiendas.
              <br />
              Tu administrador puede cambiar tu asignación según el turno del día.
            </p>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default EmptyStateNoStore;
