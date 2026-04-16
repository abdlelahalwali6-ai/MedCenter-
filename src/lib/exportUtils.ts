/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Utility to export data as CSV file.
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([`\ufeff${csvString}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (data: any[], filename: string, title: string) => {
  const doc = new jsPDF({
    orientation: 'landscape',
  });

  // Basic RTL support is limited in jspdf, but we can try to improve it or just list data
  // For now, we'll provide a standard table output
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  const headers = Object.keys(data[0]);
  const rows = data.map(item => Object.values(item));

  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: 30,
    theme: 'grid',
    styles: { font: 'helvetica', halign: 'center' },
    headStyles: { fillColor: [14, 165, 233] }
  });

  doc.save(`${filename}.pdf`);
};
