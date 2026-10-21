import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { exportExcel } from '../src/lib/excel.js';

test('exports a readable workbook with follower and action sheets', async () => {
  const workspace = {
    people: [{ username: 'alice', mutual: null, status: 'candidate', note: '', profile: { display_name: 'Alice' } }],
    jobs: [{ id: 'review-1', owner: 'owner', items: [{ username: 'alice', status: 'unconfirmed', updatedAt: '2026-10-21T10:00:00Z', events: [{ at: '2026-10-21T10:00:00Z', status: 'unconfirmed', detail: 'Interrupted' }] }] }],
  };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exportExcel(workspace));
  assert.equal(workbook.getWorksheet('Followers').getRow(2).getCell(1).value, 'alice');
  assert.equal(workbook.getWorksheet('Action log').getRow(2).getCell(7).value, 'unconfirmed');
});
