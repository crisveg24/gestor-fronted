import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TicketItem {
  product: {
    name: string;
    price: number;
  };
  quantity: number;
  subtotal: number;
}

interface TicketData {
  store: {
    name: string;
    address?: string;
    phone?: string;
  };
  items: TicketItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  saleId?: string;
  date?: Date;
}

const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    efectivo: 'Efectivo',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    'llave-bancolombia': 'Llave Bancolombia',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
  };
  return methods[method] || method;
};

export const printTicket = (ticketData: TicketData) => {
  // Crear ventana de impresión
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  
  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes para imprimir el ticket');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ticket de Venta</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .no-print {
            display: none;
          }
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          max-width: 80mm;
          margin: 0 auto;
          padding: 5mm;
          background: white;
        }
        
        .ticket {
          width: 100%;
        }
        
        .header {
          text-align: center;
          margin-bottom: 10px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        
        .header h1 {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 5px;
          text-transform: uppercase;
        }
        
        .header p {
          font-size: 10px;
          margin: 2px 0;
        }
        
        .info {
          margin-bottom: 10px;
          font-size: 10px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        
        .items {
          margin: 10px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 10px 0;
        }
        
        .item {
          margin: 5px 0;
        }
        
        .item-name {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 2px;
        }
        
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        
        .totals {
          margin-top: 10px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        
        .total-row.grand-total {
          font-size: 14px;
          font-weight: bold;
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px solid #000;
        }
        
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px dashed #000;
          font-size: 10px;
        }
        
        .footer p {
          margin: 3px 0;
        }
        
        .print-btn {
          display: block;
          width: 100%;
          padding: 10px;
          margin: 20px 0;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 14px;
          cursor: pointer;
          font-family: Arial, sans-serif;
        }
        
        .print-btn:hover {
          background: #2563eb;
        }
        
        @media print {
          .print-btn {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <!-- Header -->
        <div class="header">
          <h1>${ticketData.store.name}</h1>
          ${ticketData.store.address ? `<p>${ticketData.store.address}</p>` : ''}
          ${ticketData.store.phone ? `<p>Tel: ${ticketData.store.phone}</p>` : ''}
        </div>
        
        <!-- Info -->
        <div class="info">
          <div class="info-row">
            <span>Fecha:</span>
            <span>${format(ticketData.date || new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</span>
          </div>
          ${ticketData.saleId ? `
          <div class="info-row">
            <span>Ticket:</span>
            <span>#${ticketData.saleId.slice(-8).toUpperCase()}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span>Pago:</span>
            <span>${formatPaymentMethod(ticketData.paymentMethod)}</span>
          </div>
        </div>
        
        <!-- Items -->
        <div class="items">
          ${ticketData.items.map(item => `
            <div class="item">
              <div class="item-name">${item.product.name}</div>
              <div class="item-details">
                <span>${item.quantity} x $${item.product.price.toLocaleString('es-CO')}</span>
                <span>$${item.subtotal.toLocaleString('es-CO')}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Totals -->
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${ticketData.subtotal.toLocaleString('es-CO')}</span>
          </div>
          ${ticketData.discount > 0 ? `
          <div class="total-row">
            <span>Descuento:</span>
            <span>-$${ticketData.discount.toLocaleString('es-CO')}</span>
          </div>
          ` : ''}
          ${ticketData.tax > 0 ? `
          <div class="total-row">
            <span>IVA:</span>
            <span>$${ticketData.tax.toLocaleString('es-CO')}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>$${ticketData.total.toLocaleString('es-CO')}</span>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p>¡Gracias por su compra!</p>
          <p>www.vrmajo.xyz</p>
          <p>- - - - - - - - - - - - - - - - - - - -</p>
        </div>
        
        <!-- Print Button (solo visible en pantalla) -->
        <button class="print-btn no-print" onclick="window.print()">
          🖨️ Imprimir Ticket
        </button>
      </div>
      
      <script>
        // Auto-print después de cargar (opcional)
        // window.onload = () => {
        //   setTimeout(() => {
        //     window.print();
        //   }, 500);
        // };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
