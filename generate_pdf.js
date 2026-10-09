import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  try {
    console.log('Iniciando generador de PDF...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    const filePath = `file:///${path.resolve('guia_visual_farmacia.html').replace(/\\/g, '/')}`;
    console.log(`Cargando archivo: ${filePath}`);
    
    // waitUntil networkidle0 ensures external resources like fonts and tailwind CDN are loaded
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    
    // Inyectar regla estricta para asegurar que se impriman fondos
    await page.addStyleTag({
      content: `
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
      `
    });

    console.log('Generando PDF...');
    await page.pdf({
      path: 'Guia_Oficial_Farmacia.pdf',
      format: 'A4',
      printBackground: true,
      margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' }
    });
    
    await browser.close();
    console.log('PDF generado exitosamente!');
  } catch (error) {
    console.error('Error generando PDF:', error);
  }
})();
