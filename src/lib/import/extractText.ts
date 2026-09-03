// Turns an arbitrary Word/Excel/CSV file — in whatever layout the agency
// already uses, not our own template — into plain text, so it can be fed
// into the same AI itinerary-extraction pipeline used for pasted text.
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value;
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: true });
    return wb.SheetNames
      .map((sheetName) => `# ${sheetName}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])}`)
      .join('\n\n');
  }

  throw new Error('Formato no soportado. Subí un archivo .docx, .xlsx, .xls o .csv.');
}
