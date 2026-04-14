
import pdf from 'pdf-parse';
console.log('Type of pdf:', typeof pdf);
console.log('Value of pdf:', pdf);
import('pdf-parse').then(m => {
    console.log('Dynamic import type:', typeof m);
    console.log('Dynamic import value:', m);
    console.log('Dynamic import default:', m.default);
}).catch(err => {
    console.error('Dynamic import error:', err);
});
