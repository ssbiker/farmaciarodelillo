const xlsx = require('xlsx');
const workbook = xlsx.readFile('Reporte Stock.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log(JSON.stringify(data.slice(0, 15), null, 2));
