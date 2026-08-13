import { formatCurrency, parseDate } from './utils';

export interface InvoiceData {
  id: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  deliveryAddress?: string;
  deliveryMethod?: string;
  createdAt?: any;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  paymentMethod?: string;
  pharmacyName?: string;
}

export function generateInvoiceHtml(order: InvoiceData): string {
  const dateStr = order.createdAt 
    ? (parseDate(order.createdAt)?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) || new Date().toLocaleDateString('fr-FR'))
    : new Date().toLocaleDateString('fr-FR');
  
  const invoiceNum = '#' + (order.id ? order.id.slice(0, 8).toUpperCase() : '000000');
  const deliveryFee = order.deliveryMethod === 'delivery' || order.deliveryMethod === 'livraison' ? 1000 : 0;
  const itemsTotal = order.items ? order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0) : order.total;
  const grandTotal = order.total || (itemsTotal + deliveryFee);

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Facture PharmAply ${invoiceNum}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        body {
          background-color: #f8fafc;
          color: #1e293b;
          display: flex;
          justify-content: center;
          padding: 20px;
        }
        .invoice-card {
          width: 800px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          position: relative;
          border: 1px solid #e2e8f0;
        }
        .header-bg-decoration {
          position: absolute;
          top: 0;
          right: 0;
          width: 280px;
          height: 140px;
          background: linear-gradient(135deg, #2563eb15 0%, #194b4b25 100%);
          border-bottom-left-radius: 120px;
          z-index: 0;
        }
        .header-content {
          position: relative;
          z-index: 1;
          padding: 40px 48px 24px 48px;
        }
        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }
        .logo-icon {
          width: 42px;
          height: 42px;
          background-color: #194B4B;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: bold;
          font-size: 24px;
        }
        .brand-name {
          font-size: 22px;
          font-weight: 800;
          color: #194B4B;
          letter-spacing: -0.5px;
        }
        .brand-sub {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        .invoice-title-block {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }
        .invoice-title {
          font-size: 32px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .meta-group {
          text-align: right;
          font-size: 13px;
        }
        .meta-row {
          margin-bottom: 4px;
          color: #475569;
        }
        .meta-row strong {
          color: #0f172a;
        }
        .client-section {
          margin-bottom: 32px;
          font-size: 13px;
          color: #475569;
        }
        .client-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 6px;
        }
        .client-name {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .table-container {
          padding: 0 48px;
          margin-bottom: 32px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead th {
          background-color: #194B4B;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 12px 16px;
          letter-spacing: 0.5px;
        }
        thead th:first-child {
          border-top-left-radius: 8px;
          border-bottom-left-radius: 8px;
          text-align: left;
        }
        thead th:last-child {
          border-top-right-radius: 8px;
          border-bottom-right-radius: 8px;
          text-align: right;
        }
        thead th.center {
          text-align: center;
        }
        tbody td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #334155;
        }
        tbody tr:last-child td {
          border-bottom: 2px solid #e2e8f0;
        }
        tbody td.right {
          text-align: right;
          font-weight: 600;
        }
        tbody td.center {
          text-align: center;
        }
        .bottom-section {
          padding: 0 48px 32px 48px;
          display: flex;
          justify-content: space-between;
          gap: 32px;
        }
        .bottom-left {
          flex: 1.2;
          font-size: 12px;
          color: #475569;
        }
        .section-block {
          margin-bottom: 20px;
        }
        .section-block-title {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .bottom-right {
          flex: 0.8;
          font-size: 13px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          color: #475569;
        }
        .summary-row.total-row {
          background-color: #194B4B;
          color: #ffffff;
          font-weight: 800;
          font-size: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-top: 12px;
        }
        .signature-area {
          margin-top: 36px;
          text-align: right;
        }
        .signature-line {
          width: 160px;
          border-top: 1px solid #cbd5e1;
          display: inline-block;
          margin-bottom: 4px;
        }
        .signature-text {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }
        .footer-pills {
          background-color: #f1f5f9;
          padding: 16px 48px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          border-top: 1px solid #e2e8f0;
        }
        .pill {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #194B4B;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        @media print {
          body {
            background-color: #ffffff;
            padding: 0;
          }
          .invoice-card {
            box-shadow: none;
            border: none;
            width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header-bg-decoration"></div>
        <div class="header-content">
          <div class="brand-logo">
            <div class="logo-icon">+</div>
            <div>
              <div class="brand-name">PharmAply</div>
              <div class="brand-sub">Chrine Digital Agency</div>
            </div>
          </div>
          
          <div class="invoice-title-block">
            <div>
              <div class="invoice-title">FACTURE</div>
              <div class="client-section" style="margin-top: 16px; margin-bottom: 0;">
                <div class="client-title">Facturé à</div>
                <div class="client-name">${order.patientName || 'Client PharmAply'}</div>
                <div>${order.deliveryAddress || 'Douala, Cameroun'}</div>
                <div>${order.patientEmail || 'client@chrinedigitalagency.com'}</div>
                <div>${order.patientPhone || '+237 600 000 000'}</div>
              </div>
            </div>
            
            <div class="meta-group">
              <div class="meta-row">N° Facture : <strong>${invoiceNum}</strong></div>
              <div class="meta-row">Date : <strong>${dateStr}</strong></div>
              <div class="meta-row">Réf. Commande : <strong>${order.id.slice(0, 12)}</strong></div>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Description du produit</th>
                <th style="text-align: right;">Prix unitaire</th>
                <th class="center">Qté</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td style="text-align: right;">${formatCurrency(item.price)}</td>
                  <td class="center">${item.quantity}</td>
                  <td class="right">${formatCurrency(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="bottom-section">
          <div class="bottom-left">
            <div class="section-block">
              <div class="section-block-title">Conditions Générales :</div>
              <p>Médicaments certifiés conformes et délivrés sous la supervision de notre pharmacien partenaire. Merci de conserver cette facture pour toute réclamation.</p>
            </div>
            <div class="section-block">
              <div class="section-block-title">Mode de Règlement :</div>
              <p><strong>${order.paymentMethod || 'Fapshi (Mobile Money & Carte)'}</strong></p>
            </div>
            <div class="section-block">
              <div class="section-block-title">Une question ?</div>
              <p><strong>Email :</strong> support@chrinedigitalagency.com</p>
              <p><strong>Tél :</strong> +237 600 000 000</p>
              <p><strong>Adresse :</strong> Douala, Cameroun</p>
            </div>
          </div>

          <div class="bottom-right">
            <div class="summary-row">
              <span>Sous-total :</span>
              <strong>${formatCurrency(itemsTotal)}</strong>
            </div>
            <div class="summary-row">
              <span>TVA / Taxes :</span>
              <strong>0 XAF</strong>
            </div>
            <div class="summary-row">
              <span>Frais de livraison :</span>
              <strong>${formatCurrency(deliveryFee)}</strong>
            </div>
            <div class="summary-row total-row">
              <span>Total TTC :</span>
              <span>${formatCurrency(grandTotal)}</span>
            </div>

            <div class="signature-area">
              <div class="signature-line"></div>
              <div class="signature-text">Signature Autorisée</div>
            </div>
          </div>
        </div>

        <div class="footer-pills">
          <div class="pill">
            <span>🌐</span> ref.chrinedigitalagency.com
          </div>
          <div class="pill">
            <span>✉️</span> support@chrinedigitalagency.com
          </div>
          <div class="pill">
            <span>🏥</span> PharmAply Network
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function printInvoice(order: InvoiceData) {
  const html = generateInvoiceHtml(order);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }
}
