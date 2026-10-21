import { exportRows } from './data.js';

export async function exportExcel(workspace) {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'Audience Review';
  const sheet = book.addWorksheet('Followers', { views: [{ state: 'frozen', ySplit: 1 }] });
  for (const row of exportRows(workspace)) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF275C48' } };
  sheet.autoFilter = { from: 'A1', to: `S${sheet.rowCount}` };
  sheet.columns.forEach((column, index) => { column.width = index === 1 || index === 7 ? 42 : 22; });

  const jobs = book.addWorksheet('Action log', { views: [{ state: 'frozen', ySplit: 1 }] });
  jobs.addRow(['plan_id', 'owner', 'username', 'status', 'updated_at', 'event_at', 'event_status', 'detail']);
  for (const job of workspace.jobs || []) for (const item of job.items || []) {
    if (!item.events?.length) jobs.addRow([job.id, job.owner || '', item.username, item.status, item.updatedAt || '', '', '', '']);
    else for (const event of item.events) jobs.addRow([job.id, job.owner || '', item.username, item.status, item.updatedAt || '', event.at, event.status, event.detail || '']);
  }
  jobs.getRow(1).font = { bold: true };
  jobs.columns.forEach(column => { column.width = 28; });
  return book.xlsx.writeBuffer();
}
