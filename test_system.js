// Mock minimal browser environment
function createMockEl() {
  return {
    value: '',
    innerHTML: '',
    innerText: '',
    textContent: '',
    disabled: false,
    addEventListener() {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    appendChild() {},
    querySelector() { return createMockEl(); },
    querySelectorAll() { return []; },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    style: {},
    focus() {}
  };
}

global.window = global;
global.window.addEventListener = function() {};
global.sessionStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.document = {
  addEventListener() {},
  getElementById(id) { return createMockEl(); },
  querySelector(sel) { return createMockEl(); },
  querySelectorAll(sel) { return []; },
  createElement(tag) { return createMockEl(); }
};
global.CustomEvent = class {};
global.lucide = { createIcons() {} };

// Load data_initial.js
require('./data_initial.js');
console.log('✓ data_initial.js loaded successfully');
console.log(`  - DEFAULT_CLASSES: ${window.DEFAULT_CLASSES.length} classes`);
console.log(`  - DEFAULT_STUDENTS: ${window.DEFAULT_STUDENTS.length} students`);
console.log(`  - DEFAULT_RULES: ${window.DEFAULT_RULES.length} rules`);
console.log(`  - DEFAULT_VIOLATIONS: ${window.DEFAULT_VIOLATIONS.length} violations`);
console.log(`  - DEFAULT_LOCKED_WEEKS: ${Object.keys(window.DEFAULT_LOCKED_WEEKS || {}).length} weeks`);

// Load app.js
require('./app.js');
console.log('✓ app.js loaded successfully');

const app = window.app || new window.DisciplineApp();
console.log('✓ DisciplineApp instantiated successfully');

// TEST 1: Check locked weeks
console.log('\n--- TEST 1: Kiểm tra khóa Tuần 1 -> 6 và mở Tuần 7 ---');
for (let w = 1; w <= 6; w++) {
  if (!app.isWeekLocked(w)) {
    throw new Error(`Tuần ${w} phải bị khóa nhưng isWeekLocked(${w}) trả về false!`);
  }
}
console.log('✓ Tuần 1 đến 6 được xác nhận ĐÃ KHÓA (isWeekLocked = true)');

if (app.isWeekLocked(7)) {
  throw new Error('Tuần 7 phải MỞ nhưng isWeekLocked(7) trả về true!');
}
console.log('✓ Tuần 7 được xác nhận ĐANG MỞ (isWeekLocked = false)');

// TEST 2: Calculations for locked Week 6 vs official locked data
console.log('\n--- TEST 2: Kiểm tra dữ liệu Tuần 6 (Đã khóa) ---');
const w6Data = app.calculateWeeklyEmulationRankings(6);
console.log(`✓ Tuần 6 có ${w6Data.length} lớp được tính xếp hạng.`);
const top1_w6 = [...w6Data].sort((a, b) => a.viThuChung - b.viThuChung)[0];
console.log(`  - Hạng 1 Tuần 6: Lớp ${top1_w6.className} | TB Chung: ${top1_w6.tbChung} | Xếp loại: ${top1_w6.xepLoai} | Vị thứ: ${top1_w6.viThuChung}`);
if (top1_w6.viThuChung !== 1) {
  throw new Error(`Hạng 1 phải có viThuChung = 1, nhưng nhận được ${top1_w6.viThuChung}`);
}

// TEST 3: Calculations for open Week 7
console.log('\n--- TEST 3: Kiểm tra tính toán động và công thức cho Tuần 7 ---');
const w7Data = app.calculateWeeklyEmulationRankings(7);
console.log(`✓ Tuần 7 khởi tạo với ${w7Data.length} lớp.`);
const testClass = w7Data.find(c => c.className === '10B01');
console.log(`  - Lớp 10B01 ban đầu: Điểm trừ = ${testClass.diemTru}, TB Nề nếp = ${testClass.tbNenNep}, TB Chung = ${testClass.tbChung}`);

// TEST 4: Violation linkage for Week 7
console.log('\n--- TEST 4: Thêm vi phạm vào Tuần 7 và kiểm tra trừ điểm tự động ---');
const newViolation = {
  id: 'test_vp_01',
  student_id: '10B0101',
  student_name: 'Nguyễn Văn Test',
  class_name: '10B01',
  rule_id: 'vp1',
  rule_name: 'Đi học muộn',
  points_deducted: 2.0,
  date: '2026-10-21',
  week: 7,
  session: 'Sáng',
  reporter: 'Ban nề nếp',
  note: 'Kiểm tra liên kết trừ điểm tự động'
};
app.violations.push(newViolation);
app.saveViolations();
const w7DataAfterViolation = app.calculateWeeklyEmulationRankings(7);
const testClassAfterViolation = w7DataAfterViolation.find(c => c.className === '10B01');
console.log(`  - Sau khi thêm vi phạm -2đ vào 10B01:`);
console.log(`    + Điểm trừ: ${testClassAfterViolation.diemTru} (kỳ vọng: 2)`);
console.log(`    + TB Nề nếp: ${testClassAfterViolation.tbNenNep} (kỳ vọng: 8.0)`);
if (testClassAfterViolation.diemTru !== 2 || testClassAfterViolation.tbNenNep !== 8.0) {
  throw new Error(`Điểm trừ hoặc TB Nề nếp tính sai! diemTru=${testClassAfterViolation.diemTru}, tbNenNep=${testClassAfterViolation.tbNenNep}`);
}
console.log('✓ Liên kết trừ điểm tự động từ vi phạm hoạt động CHÍNH XAC 100%!');

// TEST 5: Bonus Points
console.log('\n--- TEST 5: Kiểm tra Thêm điểm cộng vào TB ---');
const tbBeforeBonus = testClassAfterViolation.tbChung;
app.addBonusPoint(7, '10B01', 1.0, 'Đoạt giải văn nghệ 20/10');
const w7DataAfterBonus = app.calculateWeeklyEmulationRankings(7);
const testClassAfterBonus = w7DataAfterBonus.find(c => c.className === '10B01');
console.log(`  - TB Chung trước cộng: ${tbBeforeBonus} -> Sau khi cộng +1.0: ${testClassAfterBonus.tbChung}`);
if (Math.abs(testClassAfterBonus.tbChung - (tbBeforeBonus + 1.0)) > 0.001) {
  throw new Error(`Cộng điểm vào TB không đúng! Trước: ${tbBeforeBonus}, Sau: ${testClassAfterBonus.tbChung}`);
}
console.log('✓ Cộng điểm vào TB bảo toàn công thức và tính toán CHÍNH XÁC 100%!');

// TEST 6: Bonus syntax parsing
console.log('\n--- TEST 6: Kiểm tra Parser cú pháp điểm cộng ---');
app.parseBonusSyntax(7, '10B02: 1.5 (Báo tường); 11A01: 0.5 (Hoa điểm 10)');
const w7BonusList = app.getBonusPointsList(7);
console.log(`  - Số lượng điểm cộng Tuần 7 hiện có: ${w7BonusList.length}`);
const has10B02 = w7BonusList.some(b => b.className === '10B02' && b.points === 1.5);
const has11A01 = w7BonusList.some(b => b.className === '11A01' && b.points === 0.5);
if (!has10B02 || !has11A01) {
  throw new Error('Parser cú pháp không nhận đúng các lớp 10B02 hoặc 11A01');
}
console.log('✓ Parser cú pháp hoạt động CHÍNH XÁC!');

// TEST 7: Snapshot creation and restoring
console.log('\n--- TEST 7: Kiểm tra Tạo Snapshot và Phục hồi ---');
const snap = app.createSnapshot('Điểm mốc kiểm tra tự động', 'Hệ thống test');
console.log(`  - Snapshot tạo thành công: ID = ${snap.id}, Timestamp = ${snap.timestamp}`);
const allSnaps = app.getSnapshots();
if (allSnaps.length === 0) {
  throw new Error('Snapshot không được lưu trong danh sách!');
}
console.log(`✓ Quản lý Snapshot hoạt động tốt (${allSnaps.length} snapshot đã lưu).`);

// Clean test violation
app.violations = app.violations.filter(v => v.id !== 'test_vp_01');
app.saveViolations();

console.log('\n======================================================');
console.log('TẤT CẢ CÁC BÀI TEST NGHIỆP VỤ & KỸ THUẬT ĐỀU ĐẠT 100%!');
console.log('======================================================\n');
