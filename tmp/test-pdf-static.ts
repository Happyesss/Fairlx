
import { PDFParse } from 'pdf-parse';
console.log('PDFParse class:', PDFParse);
try {
  const parser = new PDFParse({});
  console.log('Parser instance created');
} catch (err) {
  console.error('Parser creation error:', err);
}
