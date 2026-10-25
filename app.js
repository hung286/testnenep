/**
 * ỨNG DỤNG ĐIỀU PHỐI NỀN NẾP & THI ĐUA HỌC ĐƯỜNG - TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG
 * Xây dựng theo Custom System Instruction & AI_INSTRUCTIONS.md
 */

// ==================== CẤU HÌNH TOÀN CỤC & ENDPOINT CHUẨN GOOGLE APPS SCRIPT ====================
const OFFICIAL_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwQxI054Rt_-t8oVCUcAQ4F-DHTklMfv7JPyrS-pKTkqV2vtW4zPCup0UXFAIyDxNXZvQ/exec';

window.GLOBAL_CONFIG = {
  // Đường dẫn Google Apps Script Web App Endpoint chính thức toàn hệ thống
  DEFAULT_GAS_ENDPOINT: OFFICIAL_GAS_ENDPOINT,
  CONFIG_FILE_URL: 'config.json',
  VERSION: '2.3.0_GAS_STANDARD'
};

// Tự động dọn dẹp triệt để cache cũ và link kvdb.io ngay khi tải trang trên mọi thiết bị (điện thoại, máy tính)
(function purgeLegacyCacheEarly() {
  try {
    const CURRENT_STORAGE_VER = '2.3.0_GAS_STANDARD';
    if (typeof localStorage !== 'undefined') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k) {
          const v = localStorage.getItem(k);
          if (typeof v === 'string' && v.includes('kvdb.io')) {
            localStorage.removeItem(k);
          }
        }
      }
      const currentUrl = localStorage.getItem('dshs_cloud_url');
      if (currentUrl && (currentUrl.includes('kvdb.io') || !currentUrl.includes('script.google.com'))) {
        localStorage.removeItem('dshs_cloud_url');
      }
      if (localStorage.getItem('dshs_storage_version') !== CURRENT_STORAGE_VER) {
        localStorage.removeItem('dshs_cloud_url');
        localStorage.removeItem('dshs_cloud_url_updated_at');
        localStorage.setItem('dshs_storage_version', CURRENT_STORAGE_VER);
      }
    }
  } catch (e) {}
})();

class DisciplineApp {
  constructor() {
    // Dọn dẹp cache phiên bản cũ ngay từ constructor
    this.purgeObsoleteCache();

    this.startDate = new Date(2026, 8, 7); // Thứ Hai, 07/09/2026 (Tuần 1)
    
    // Khởi tạo State từ LocalStorage hoặc dữ liệu mặc định
    this.students = this.loadStudents();
    this.rules = this.loadRules();
    this.violations = this.loadViolations();
    this.deletedViolationIds = this.loadDeletedViolationIds();
    this.lockedWeeks = this.loadLockedWeeks();
    this.currentWeek = 7;
    this.PASSWORD_ADMIN = "2806";
    this.PASSWORD_SUPERVISOR = "lhp38";
    this.currentModalRequireAdmin = false;
    
    // Nạp Bảng thi đua, Điểm cộng & Snapshots sao lưu
    this.emulationWeeks = this.loadEmulationWeeks();
    this.bonusPoints = this.loadBonusPoints();
    this.weeklyNotes = this.loadWeeklyNotes();
    this.snapshots = this.loadSnapshots();
    this.auditLogs = this.loadAuditLogs();
    this.pendingRestoreData = null;
    
    this.activeTab = 'tab-ai-logger';
    this.pendingAiRecords = [];
    this.editingStudentId = null;
    this.editingRuleId = null;
    this.importPreviewData = [];

    // Charts
    this.classPenaltyChart = null;
    this.topErrorsChart = null;
    this.isSyncingCloud = false;
    this.autoSyncInterval = null;

    this.init();
  }

  // ==================== KHỞI TẠO DỮ LIỆU & GIAO DIỆN ====================

  loadStudents() {
    const saved = localStorage.getItem('dshs_students');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return window.DEFAULT_STUDENTS || [];
  }

  saveStudents() {
    localStorage.setItem('dshs_students', JSON.stringify(this.students));
    this.updateBadges();
  }

  loadRules() {
    const saved = localStorage.getItem('dshs_rules');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return window.DEFAULT_RULES || [];
  }

  saveRules() {
    localStorage.setItem('dshs_rules', JSON.stringify(this.rules));
    this.updateBadges();
  }

  getStudentGender(name, className) {
    if (!name) return 'Nam';
    const students = this.students || window.DEFAULT_STUDENTS || [];
    const s = students.find(x => 
      (x.name && x.name.toLowerCase() === name.toLowerCase()) && 
      (!className || x.class === className || x.class_name === className)
    );
    if (s && s.gender) return s.gender;
    const lower = name.toLowerCase();
    if (lower.includes('thị') || lower.includes('ngọc') || lower.includes('nhi') || lower.includes('hương') || lower.includes('trâm') || lower.includes('vy') || lower.includes('hân')) {
      return 'Nữ';
    }
    return 'Nam';
  }

  autoFitWorksheetColumns(ws, minWidths = {}, padding = 3) {
    const colLetterToIndex = (col) => {
      let num = 0;
      for (let i = 0; i < col.length; i++) {
        num = num * 26 + (col.charCodeAt(i) - 64);
      }
      return num - 1;
    };
    const indexToColLetter = (idx) => {
      let temp = idx;
      let letter = '';
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    const maxLenPerCol = {};

    for (let cellRef in ws) {
      if (cellRef.startsWith('!')) continue;
      const match = cellRef.match(/^([A-Z]+)([0-9]+)$/);
      if (!match) continue;
      const colStr = match[1];
      const rowNum = parseInt(match[2], 10);

      // Bỏ qua các dòng tiêu đề gộp ô đầu trang (Row 1 đến Row 5)
      if (rowNum <= 5) continue;

      const cell = ws[cellRef];
      if (!cell) continue;

      let textLen = 0;
      if (cell.v !== undefined && cell.v !== null) {
        const str = String(cell.v);
        const lines = str.split('\n');
        textLen = Math.max(...lines.map(l => l.length));
      }
      maxLenPerCol[colStr] = Math.max(maxLenPerCol[colStr] || 0, textLen);
    }

    let maxColIdx = 20;
    for (let colStr in maxLenPerCol) {
      maxColIdx = Math.max(maxColIdx, colLetterToIndex(colStr));
    }

    const cols = [];
    for (let i = 0; i <= maxColIdx; i++) {
      const colStr = indexToColLetter(i);
      const contentLen = maxLenPerCol[colStr] || 0;
      const minW = minWidths[colStr] !== undefined ? minWidths[colStr] : (minWidths[i] !== undefined ? minWidths[i] : 8);
      const width = Math.max(minW, contentLen + padding);
      cols[i] = { wch: width };
    }

    return cols;
  }

  sortViolations(list) {
    if (!list || !Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      // 1. Sắp xếp thứ tự Lớp tăng dần từ A -> Z (10B01 -> 12C09)
      const classA = a.class_name || '';
      const classB = b.class_name || '';
      const cmpClass = classA.localeCompare(classB, 'vi', { numeric: true });
      if (cmpClass !== 0) return cmpClass;

      // 2. Trong cùng một lớp, sắp xếp tên học sinh theo thứ tự A -> Z
      const nameA = a.student_name || '';
      const nameB = b.student_name || '';
      const cmpName = nameA.localeCompare(nameB, 'vi');
      if (cmpName !== 0) return cmpName;

      // 3. Ngày vi phạm
      const dateA = a.date || '';
      const dateB = b.date || '';
      const cmpDate = dateA.localeCompare(dateB);
      if (cmpDate !== 0) return cmpDate;

      return (a.id || 0) - (b.id || 0);
    });
  }

  loadViolations() {
    let violations = [];
    const saved = localStorage.getItem('dshs_violations');
    if (saved) {
      try { 
        violations = JSON.parse(saved);
        // Tự động làm sạch lỗi thừa chữ " - Lớp" nếu có trong dữ liệu cũ
        violations.forEach(v => {
          if (v.student_name) {
            v.student_name = v.student_name.replace(/[\s\-\–\—]*(?:[Ll][ớơo]p)?\s*$/i, '').trim();
          }
        });
      } catch (e) { 
        violations = [];
      }
    }
    
    if (!violations || violations.length === 0) {
      violations = (window.DEFAULT_VIOLATIONS || []).slice();
    } else if (window.DEFAULT_VIOLATIONS && window.DEFAULT_VIOLATIONS.length > 0) {
      // Đảm bảo dữ liệu vi phạm chuẩn (đặc biệt là Tuần 6 ngày 13/10/2026) được đồng bộ nếu trong localStorage chưa có
      const hasW6 = violations.some(v => parseInt(v.week, 10) === 6);
      if (!hasW6) {
        const defW6 = window.DEFAULT_VIOLATIONS.filter(v => parseInt(v.week, 10) === 6);
        if (defW6.length > 0) {
          violations = violations.concat(defW6);
        }
      }
    }

    // Đảm bảo toàn bộ học sinh có giới tính và được sắp xếp khoa học theo Lớp A -> Z
    violations.forEach(v => {
      if (!v.gender) {
        v.gender = this.getStudentGender(v.student_name, v.class_name);
      }
    });

    const sorted = this.sortViolations(violations);
    try { localStorage.setItem('dshs_violations', JSON.stringify(sorted)); } catch (e) {}
    return sorted;
  }

  saveViolations(targetWeek = null, targetClassName = null) {
    try {
      localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
    } catch (e) {}
    this.updateBadges();

    // 1. Tự động đồng bộ và tính toán lại điểm trừ cho tuần tương ứng
    if (targetWeek) {
      this.syncViolationWithEmulation(targetWeek, targetClassName);
    } else {
      const curW = this.calculateWeek(new Date());
      if (this.emulationWeeks && this.emulationWeeks[curW]) {
        this.syncViolationWithEmulation(curW, targetClassName);
      }
    }

    // 2. Cập nhật lại giao diện Bảng thi đua nếu đang hiển thị
    const emuSelect = document.getElementById('emulation-select-week');
    if (emuSelect && emuSelect.value) {
      this.renderEmulationTable();
    }

    this.pushToCloud(true);
  }

  syncViolationWithEmulation(weekNum, className = null) {
    const w = parseInt(weekNum, 10);
    if (isNaN(w)) return;

    if (!this.emulationWeeks) this.emulationWeeks = {};
    if (!this.emulationWeeks[w]) {
      this.emulationWeeks[w] = this.createDefaultWeekData(w);
    }
    if (!this.emulationWeeks[w].classes) {
      this.emulationWeeks[w].classes = {};
    }

    const classesToSync = className ? [className] : (window.DEFAULT_CLASSES || []).map(c => c.class);

    classesToSync.forEach(cName => {
      if (!this.emulationWeeks[w].classes[cName]) {
        this.emulationWeeks[w].classes[cName] = {
          stt: 1,
          className: cName,
          tot: 0,
          gioA: 27,
          gioB: 0,
          gioC: 0,
          gioD: 0,
          tongTiet: 27,
          diemTbHocTap: 10.0,
          diem15: 10.0,
          diemTru: 0.0,
          tbNenNep: 10.0,
          bonus: 0.0,
          tbChung: 10.0,
          xepLoai: 'X sắc',
          viThuChung: 1
        };
      }

      // Lọc các bản ghi vi phạm thực tế đang hoạt động của lớp trong tuần
      const activeViols = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === cName);
      const totalPenalty = activeViols.reduce((sum, v) => {
        const pts = parseFloat(v.penalty_points !== undefined ? v.penalty_points : (v.points_deducted !== undefined ? v.points_deducted : v.points)) || 0;
        return sum + pts;
      }, 0);

      const roundedDiemTru = Math.round(totalPenalty * 10) / 10;
      this.emulationWeeks[w].classes[cName].diemTru = roundedDiemTru;
      this.emulationWeeks[w].classes[cName]._forceSyncFromViolations = true;
      if (activeViols.length === 0) {
        this.emulationWeeks[w].classes[cName]._manuallyResetDiemTru = true;
      }
    });

    // Tính toán lại thứ hạng, điểm TB, TB Chung, Xếp loại toàn tuần
    this.calculateWeeklyEmulationRankings(w);
    this.saveEmulationWeeks(true);
  }

  loadLockedWeeks() {
    const saved = localStorage.getItem('dshs_locked_weeks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(x => parseInt(x, 10)).filter(x => !isNaN(x));
        }
      } catch (e) {
        console.error('Lỗi đọc dshs_locked_weeks:', e);
      }
    }
    // Mặc định các tuần đã kết thúc: 1 đến 6
    return [1, 2, 3, 4, 5, 6];
  }

  saveLockedWeeks() {
    localStorage.setItem('dshs_locked_weeks', JSON.stringify(this.lockedWeeks));
    this.populateDropdowns();
    this.renderEmulationTable();
    this.renderLogsTable();
  }

  isWeekLocked(weekNum) {
    const w = parseInt(weekNum, 10);
    return this.lockedWeeks.includes(w);
  }

  loadWeeklyNotes() {
    const saved = localStorage.getItem('dshs_weekly_notes');
    let notes = {};
    if (saved) {
      try { notes = JSON.parse(saved); } catch (e) { }
    }
    if (window.DEFAULT_WEEKLY_NOTES) {
      Object.keys(window.DEFAULT_WEEKLY_NOTES).forEach(w => {
        if (!notes[w] || !Array.isArray(notes[w]) || notes[w].length === 0) {
          notes[w] = [...window.DEFAULT_WEEKLY_NOTES[w]];
        }
      });
    }
    return notes;
  }

  saveWeeklyNotes() {
    localStorage.setItem('dshs_weekly_notes', JSON.stringify(this.weeklyNotes));
  }

  adminUnlockAllWeeks() {
    this.requireAdmin(() => {
      this.lockedWeeks = [];
      this.saveLockedWeeks();
      this.logAuditAction('UNLOCK_WEEK', 'Mở khóa toàn bộ tuần', 'Quản trị viên đã mở khóa toàn bộ các tuần thi đua (Tuần 01 đến Tuần 06)');
      this.renderManageWeeksList();
      this.renderEmulationTable();
      this.showToast('Quyền Admin: Đã mở khóa toàn bộ các tuần (Tuần 01 đến Tuần 06)! Thầy/cô có thể chỉnh sửa dữ liệu của tất cả các tuần.', 'success');
    });
  }

  adminUnlockSpecificWeek(weekNum) {
    const w = parseInt(weekNum, 10);
    this.requireAdmin(() => {
      this.lockedWeeks = this.lockedWeeks.filter(x => x !== w);
      this.saveLockedWeeks();
      this.logAuditAction('UNLOCK_WEEK', 'Mở khóa tuần', `Quản trị viên đã mở khóa Tuần ${w} để chỉnh sửa dữ liệu`, { week: w });
      this.renderManageWeeksList();
      this.renderEmulationTable();
      this.showToast(`Quyền Admin: Đã mở khóa Tuần ${w} thành công! Thầy/cô có thể chỉnh sửa dữ liệu tuần này.`, 'success');
    });
  }

  lockSpecificWeek(weekNum) {
    this.requireAdmin(() => {
      const w = parseInt(weekNum, 10);
      if (!this.lockedWeeks.includes(w)) {
        this.lockedWeeks.push(w);
        this.lockedWeeks.sort((a, b) => a - b);
      }
      this.saveLockedWeeks();
      this.logAuditAction('LOCK_WEEK', 'Khóa tuần thi đua', `Quản trị viên đã khóa niêm phong thi đua Tuần ${w}`, { week: w });
      this.renderManageWeeksList();
      this.renderEmulationTable();
      this.showToast(`Đã khóa niêm phong Tuần ${w} an toàn!`, 'info');
    });
  }

  handleToggleCurrentWeekLock() {
    const emuSelect = document.getElementById('emulation-select-week');
    const selectedWeek = parseInt(emuSelect ? emuSelect.value : this.currentWeek, 10) || this.currentWeek;
    const isLocked = this.isWeekLocked(selectedWeek);

    if (isLocked) {
      this.adminUnlockSpecificWeek(selectedWeek);
    } else {
      this.lockSpecificWeek(selectedWeek);
    }
  }

  openManageWeeksModal() {
    this.renderManageWeeksList();
    const modal = document.getElementById('modal-manage-weeks');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  }

  closeManageWeeksModal() {
    const modal = document.getElementById('modal-manage-weeks');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  renderManageWeeksList() {
    const tbody = document.getElementById('manage-weeks-tbody');
    if (!tbody) return;

    const currentWeek = this.calculateWeek(new Date());
    const maxWeeks = Math.max(35, currentWeek + 2);
    let html = '';

    for (let w = 1; w <= maxWeeks; w++) {
      const isLocked = this.isWeekLocked(w);
      const isCur = (w === currentWeek);
      const range = this.getWeekDateRange(w);

      const statusBadge = isLocked 
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300"><i data-lucide="lock" class="w-3 h-3 text-amber-600"></i> Đã khóa</span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i data-lucide="unlock" class="w-3 h-3 text-emerald-600"></i> Đang mở</span>`;

      const actionBtn = isLocked
        ? `<button onclick="window.app.adminUnlockSpecificWeek(${w})" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1 mx-auto"><i data-lucide="unlock" class="w-3 h-3"></i> Mở khóa</button>`
        : `<button onclick="window.app.lockSpecificWeek(${w})" class="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-slate-100 rounded-lg font-bold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1 mx-auto"><i data-lucide="lock" class="w-3 h-3"></i> Khóa lại</button>`;

      const rowBg = isCur ? 'bg-blue-50/60 font-semibold' : 'hover:bg-slate-50';

      html += `
        <tr class="${rowBg}">
          <td class="p-3 text-center font-bold text-slate-800">
            Tuần ${String(w).padStart(2, '0')} ${isCur ? '<span class="text-[10px] text-blue-600 block font-normal">(Hiện tại)</span>' : ''}
          </td>
          <td class="p-3 text-slate-600">${range}</td>
          <td class="p-3 text-center">${statusBadge}</td>
          <td class="p-3 text-center">${actionBtn}</td>
        </tr>
      `;
    }

    tbody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  lockPastWeeks() {
    const curW = this.calculateWeek(new Date());
    for (let w = 1; w < curW; w++) {
      if (!this.lockedWeeks.includes(w)) {
        this.lockedWeeks.push(w);
      }
    }
    this.lockedWeeks.sort((a, b) => a - b);
    this.saveLockedWeeks();
    this.logAuditAction('LOCK_WEEK', 'Khóa các tuần trước', `Đã khóa niêm phong tất cả các tuần trước Tuần ${curW}`, { week: curW });
    this.renderManageWeeksList();
    this.showToast(`Đã khóa niêm phong tất cả các tuần trước Tuần ${curW}!`, 'success');
  }

  openCurrentWeekOnly() {
    this.requireAdmin(() => {
      const curW = this.calculateWeek(new Date());
      const maxWeeks = Math.max(35, curW + 2);
      this.lockedWeeks = [];
      for (let w = 1; w <= maxWeeks; w++) {
        if (w !== curW) {
          this.lockedWeeks.push(w);
        }
      }
      this.saveLockedWeeks();
      this.logAuditAction('LOCK_WEEK', 'Chỉ mở tuần hiện tại', `Đã khóa các tuần khác và chỉ mở duy nhất Tuần ${curW}`, { week: curW });
      this.renderManageWeeksList();
      this.showToast(`Đã khóa các tuần khác và chỉ mở duy nhất Tuần ${curW}!`, 'success');
    });
  }

  getWeekDateRange(weekNum) {
    const w = parseInt(weekNum, 10);
    if (isNaN(w) || w < 1) return '';
    // Mốc Tuần 1 bắt đầu từ Thứ Hai, 07/09/2026
    const monday = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate() + (w - 1) * 7);
    const saturday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 5);
    
    const d1 = String(monday.getDate()).padStart(2, '0');
    const m1 = String(monday.getMonth() + 1).padStart(2, '0');
    const d2 = String(saturday.getDate()).padStart(2, '0');
    const m2 = String(saturday.getMonth() + 1).padStart(2, '0');
    const y = saturday.getFullYear();
    return `Từ ngày ${d1}/${m1} đến ngày ${d2}/${m2} năm ${y}`;
  }

  loadEmulationWeeks() {
    const saved = localStorage.getItem('dshs_emulation_weeks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (window.DEFAULT_LOCKED_WEEKS && window.DEFAULT_LOCKED_WEEKS['6']) {
            if (!parsed['6'] || !parsed['6'].classes) {
              parsed['6'] = JSON.parse(JSON.stringify(window.DEFAULT_LOCKED_WEEKS['6']));
              try { localStorage.setItem('dshs_emulation_weeks', JSON.stringify(parsed)); } catch (e) {}
            }
          }
          return parsed;
        }
      } catch (e) {
        console.error('Lỗi đọc dshs_emulation_weeks:', e);
      }
    }

    // Nạp dữ liệu Tuần 01 -> 06 mặc định đã niêm phong từ file mẫu
    const weeks = {};
    if (window.DEFAULT_LOCKED_WEEKS) {
      Object.keys(window.DEFAULT_LOCKED_WEEKS).forEach(w => {
        weeks[w] = JSON.parse(JSON.stringify(window.DEFAULT_LOCKED_WEEKS[w]));
      });
    }

    // Khởi tạo Tuần 07 (tuần hiện tại đang mở) nếu chưa có
    if (!weeks['7']) {
      weeks['7'] = this.createDefaultWeekData(7);
    }

    return weeks;
  }

  saveEmulationWeeks(silent = false) {
    try {
      localStorage.setItem('dshs_emulation_weeks', JSON.stringify(this.emulationWeeks));
      if (!silent) {
        this.showToast('Đã lưu dữ liệu bảng thi đua thành công!', 'success');
      }
      this.debouncedPushToCloud(true);
    } catch (e) {
      this.showToast('Lỗi lưu bảng thi đua: ' + e.message, 'error');
    }
  }

  createDefaultWeekData(weekNum) {
    const w = parseInt(weekNum, 10);
    const classesData = {};
    const classes = window.DEFAULT_CLASSES || [];
    classes.forEach(c => {
      classesData[c.class] = {
        stt: c.stt,
        className: c.class,
        gvcn: c.gvcn,
        shl: 0.0,
        tot: 0,
        gioA: 27, // Tiêu chuẩn 27 tiết tuần đạt A
        gioB: 0,
        gioC: 0,
        gioD: 0,
        tongTiet: 27,
        diemTbHocTap: 10.0,
        viThuHocTap: 1,
        diem15: 10.0,
        diemTru: 0.0,
        tbNenNep: 10.0,
        viThuNenNep: 1,
        hsVang: 0,
        viThuVang: 1,
        bonus: 0.0,
        tbChung: 10.0,
        xepLoai: 'X sắc',
        viThuChung: 1
      };
    });
    return {
      week: w,
      locked: this.isWeekLocked(w),
      dateTitle: this.getWeekDateRange(w),
      classes: classesData
    };
  }

  // Tính Tuần Học Đường: Tuần 1 bắt đầu từ 07/09/2026
  calculateWeek(dateInput) {
    if (!dateInput) return 1;
    const dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) return 1;

    // Reset về 00:00:00 để tính khoảng cách ngày chuẩn
    const start = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate()).getTime();
    const current = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
    
    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 1;
    return Math.floor(diffDays / 7) + 1;
  }

  init() {
    // 0. Quét và loại bỏ sạch cache cũ và link kvdb.io, ép Endpoint Google Sheets chuẩn
    this.purgeObsoleteCache();
    this.updateCloudStatusBadge(true);

    // 1. Tự động gán và lưu API Key ngầm
    const DEFAULT_API_KEY = typeof atob !== "undefined" ? atob("QVEuQWI4Uk42S05UclVUVEFDaTZoOTQwRW5ETEt1LW1UUTdMcTVldlRsQUx0aVBDSG9jOEE=") : "";
    if (!localStorage.getItem('gemini_api_key')) {
      localStorage.setItem('gemini_api_key', DEFAULT_API_KEY);
    }

    // 2. Kích hoạt cơ chế Realtime Tab Sync (đồng bộ tức thì giữa các tab cùng trình duyệt)
    this.setupRealtimeTabSync();

    // 3. TỰ ĐỘNG LẤY DỮ LIỆU MỚI NHẤT TRỰC TIẾP TỪ GOOGLE SHEETS NGAY KHI MỞ TRANG
    // Đảm bảo điện thoại và các tab mới luôn nhận ngay trạng thái mới nhất (những gì đã xóa sẽ biến mất ngay)
    this.pullAndMergeFromCloud(true, true);

    // Đồng thời kiểm tra Endpoint từ config.json ngầm
    this.syncGlobalEndpoint().catch(() => {});

    // Luôn cập nhật sẵn URL vào ô input Cài đặt để hiển thị ngay lập tức
    const inputCloudUrl = document.getElementById('input-cloud-url');
    if (inputCloudUrl) {
      inputCloudUrl.value = this.getCloudUrl();
    }

    this.setupDateAndTime();
    this.setupTabs();
    this.setupEventListeners();
    this.setupSettingsModal();
    this.setupManualEntry();
    this.setupPasswordAuth();
    this.updateBadges();
    this.populateDropdowns();

    // Render các bảng
    this.renderLogsTable();
    this.renderEmulationTable();
    this.renderStudentsTable();
    this.renderRulesTable();

    // Render icons Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  setupDateAndTime() {
    // Lấy ngày hôm nay
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const dateInput = document.getElementById('input-violation-date');
    if (dateInput) {
      dateInput.value = todayStr;
      const week = this.calculateWeek(todayStr);
      document.getElementById('display-computed-week').textContent = `Tuần ${week}`;
      this.checkDateLockWarning(todayStr);

      dateInput.addEventListener('change', (e) => {
        const val = e.target.value;
        const w = this.calculateWeek(val);
        document.getElementById('display-computed-week').textContent = `Tuần ${w}`;
        this.checkDateLockWarning(val);
      });
    }

    const todayDisplay = document.getElementById('header-today-display');
    const weekDisplay = document.getElementById('header-week-display');
    if (todayDisplay && weekDisplay) {
      const currentWeek = this.calculateWeek(todayStr);
      todayDisplay.textContent = `${dd}/${mm}/${yyyy}`;
      weekDisplay.textContent = `Tuần ${currentWeek}`;
    }
  }

  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(targetTab) {
    // Tab Quản lý học sinh và Tab Danh mục lỗi cho phép Giám thị / Cờ đỏ và Admin truy cập
    // Chỉ tab Sao lưu & Bảo vệ dữ liệu và tab Lịch sử thao tác mới bắt buộc quyền Quản trị Admin (2806)
    const SENSITIVE_ADMIN_TABS = ['tab-backup', 'tab-audit-logs'];
    if (SENSITIVE_ADMIN_TABS.includes(targetTab) && !this.isAdmin()) {
      let tabName = targetTab === 'tab-audit-logs' ? 'Lịch Sử Thao Tác (Audit Log)' : 'Sao Lưu & Bảo Vệ Dữ Liệu';
      const isSuper = this.isSupervisor();
      const msg = isSuper
        ? `🔒 Tab ${tabName} yêu cầu quyền Quản trị Admin cấp cao (2806). Bạn đang ở quyền Giám thị / Cờ đỏ!`
        : `🔒 Tab ${tabName} yêu cầu quyền Quản trị Admin (2806). Vui lòng đăng nhập Admin để truy cập!`;

      this.showToast(msg, 'warning');
      this.openPasswordModal(() => {
        this.switchTab(targetTab);
      }, true);
      return;
    }

    this.activeTab = targetTab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === targetTab) {
        b.classList.add('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/50');
        b.classList.remove('border-transparent', 'text-slate-600');
      } else {
        b.classList.remove('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/50');
        b.classList.add('border-transparent', 'text-slate-600');
      }
    });

    document.querySelectorAll('.tab-content').forEach(c => {
      if (c.id === targetTab) {
        c.classList.remove('hidden');
      } else {
        c.classList.add('hidden');
      }
    });

    if (targetTab === 'tab-emulation') {
      this.renderEmulationTable();
      this.updateCharts();
    } else if (targetTab === 'tab-violation-logs') {
      this.renderLogsTable();
    } else if (targetTab === 'tab-students') {
      this.renderStudentsTable();
    } else if (targetTab === 'tab-rules') {
      this.renderRulesTable();
    } else if (targetTab === 'tab-backup') {
      this.renderSnapshotsList();
      this.updateBackupStats();
    } else if (targetTab === 'tab-audit-logs') {
      this.renderAuditLogsTable();
      this.updateAuditStats();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateBadges() {
    const studentBadge = document.getElementById('badge-total-students');
    if (studentBadge) studentBadge.textContent = this.students.length;

    const ruleBadge = document.getElementById('badge-total-rules');
    if (ruleBadge) ruleBadge.textContent = this.rules.length;

    const violationBadge = document.getElementById('badge-total-violations');
    if (violationBadge) violationBadge.textContent = this.violations.length;

    const keyIndicator = document.getElementById('api-key-status-indicator');
    if (keyIndicator) {
      const hasKey = (window.geminiService && typeof window.geminiService.getApiKey === 'function') ? !!window.geminiService.getApiKey() : true;
      keyIndicator.className = hasKey ? 'w-2 h-2 rounded-full bg-emerald-500' : 'w-2 h-2 rounded-full bg-red-500 animate-ping';
    }

    const modelTag = document.getElementById('display-current-model-tag');
    if (modelTag && window.geminiService && typeof window.geminiService.getSelectedModel === 'function') {
      modelTag.textContent = window.geminiService.getSelectedModel();
    }
  }

  checkDateLockWarning(dateStr) {
    const w = this.calculateWeek(dateStr);
    const warnBox = document.getElementById('locked-week-warning');
    const warnText = document.getElementById('locked-week-warning-text');
    const isLocked = this.isWeekLocked(w);
    
    if (warnBox && warnText) {
      if (isLocked) {
        warnText.textContent = `Mốc thời gian này thuộc Tuần ${w} đã kết thúc và được khóa dữ liệu niêm phong. Hệ thống chỉ cho phép ghi nhận vi phạm từ Tuần 7 trở đi.`;
        warnBox.classList.remove('hidden');
      } else {
        warnBox.classList.add('hidden');
      }
    }
    return isLocked;
  }

  populateDropdowns() {
    // 1. Populate class dropdowns (29 lớp THPT Số 1 Lê Hồng Phong)
    const uniqueClasses = (window.DEFAULT_CLASSES || []).map(c => c.class).sort();
    
    // Log filter class
    const logClassSelect = document.getElementById('log-filter-class');
    if (logClassSelect) {
      logClassSelect.innerHTML = '<option value="all">Tất cả lớp (29 lớp)</option>' +
        uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // Student filter class
    const studentClassSelect = document.getElementById('student-filter-class');
    if (studentClassSelect) {
      studentClassSelect.innerHTML = '<option value="all">Tất cả lớp (29 lớp)</option>' +
        uniqueClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // 2. Populate week dropdowns với nhãn Khóa niêm phong và Tuần hiện tại
    const currentWeek = this.calculateWeek(new Date());
    const maxWeeks = Math.max(35, currentWeek + 2);
    
    const logWeekSelect = document.getElementById('log-filter-week');
    if (logWeekSelect) {
      let options = '<option value="all">Tất cả các tuần (Năm học 2026-2027)</option>';
      for (let w = 1; w <= maxWeeks; w++) {
        let tag = '';
        if (w === currentWeek) {
          tag = ' (Hiện tại - Đang mở 🔓)';
        } else if (this.isWeekLocked(w)) {
          tag = ' [🔒 Đã khóa niêm phong]';
        }
        options += `<option value="${w}" ${w === currentWeek ? 'selected' : ''}>Tuần ${w}${tag}</option>`;
      }
      logWeekSelect.innerHTML = options;
    }

    const emuWeekSelect = document.getElementById('emulation-select-week');
    if (emuWeekSelect) {
      let options = '';
      for (let w = 1; w <= maxWeeks; w++) {
        let tag = '';
        if (w === currentWeek) {
          tag = ' (Hiện tại - Đang mở 🔓)';
        } else if (this.isWeekLocked(w)) {
          tag = ' [🔒 Đã khóa niêm phong]';
        }
        options += `<option value="${w}" ${w === currentWeek ? 'selected' : ''}>Tuần ${w}${tag}</option>`;
      }
      emuWeekSelect.innerHTML = options;
    }

    // Populate bonus class select
    const bonusClassSelect = document.getElementById('bonus-select-class');
    if (bonusClassSelect) {
      bonusClassSelect.innerHTML = (window.DEFAULT_CLASSES || []).map(c => 
        `<option value="${c.class}">Lớp ${c.class} (GVCN: ${c.gvcn})</option>`
      ).join('');
    }

    // 3. Populate manual rule select
    const manualRuleSelect = document.getElementById('manual-rule-select');
    if (manualRuleSelect) {
      manualRuleSelect.innerHTML = '<option value="">-- Chọn lỗi vi phạm --</option>' +
        this.rules.map(r => `<option value="${r.name}" data-points="${r.points}">${r.name} (-${r.points}đ)</option>`).join('');
    }
  }

  // ==================== NHẬP HỌC SINH VI PHẠM (AI LOGGER) ====================

  fillSampleText(sampleType) {
    const area = document.getElementById('ai-input-text');
    if (!area) return;

    if (sampleType === 1) {
      area.value = `- Nguyễn Bo 11A04 đi học muộn 15p, không đeo bảng tên\n- 12C08: H Ti Ra Niê mặc sai đồng phục\n- Học sinh Lê Âu Kỳ lớp 10B11 bỏ tiết sinh hoạt 15p`;
    } else if (sampleType === 2) {
      // Mẫu quy chuẩn lỗi Áo khoác & Áo đoàn -> Sai đồng phục (-0.5đ)
      area.value = `Ghi nhận nền nếp sáng thứ 2:\n- Bạn Vy lớp 10B01 không mang áo khoác theo quy định\n- Học sinh Huỳnh Lê Bảo An 12C08 không mặc áo đoàn\n- Em Nguyễn Bo 11A04 quên áo đoàn thứ 2`;
    } else if (sampleType === 3) {
      // Mẫu kiểm tra tách dòng đa ngày vi phạm
      area.value = `Ghi nhận tổng hợp trong tuần:\n- Nguyễn Bo 11A04 vi phạm ngày 19/10 và ngày 22/10 không mang áo khoác\n- Học sinh Lê Âu Kỳ lớp 10B11 ngày 19-10-2026 đi học muộn; ngày 22-10-2026 không có bảng tên`;
    }
  }

  setupEventListeners() {
    // Chuyển đổi chế độ: Nhập văn bản <-> Import ảnh sổ tay OCR
    const btnModeText = document.getElementById('btn-mode-text-input');
    const btnModeImage = document.getElementById('btn-mode-image-ocr');
    const containerText = document.getElementById('ai-text-input-container');
    const containerImage = document.getElementById('ai-image-ocr-container');

    if (btnModeText && btnModeImage && containerText && containerImage) {
      btnModeText.addEventListener('click', () => {
        btnModeText.className = 'ai-mode-btn active flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 transition shadow-xs cursor-pointer';
        btnModeImage.className = 'ai-mode-btn flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent transition cursor-pointer';
        containerText.classList.remove('hidden');
        containerImage.classList.add('hidden');
      });

      btnModeImage.addEventListener('click', () => {
        btnModeImage.className = 'ai-mode-btn active flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 transition shadow-xs cursor-pointer';
        btnModeText.className = 'ai-mode-btn flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent transition cursor-pointer';
        containerImage.classList.remove('hidden');
        containerText.classList.add('hidden');
      });
    }

    // Các nút kích hoạt chọn ảnh / chụp camera
    const btnTriggerCam = document.getElementById('btn-trigger-camera');
    const btnTriggerFile = document.getElementById('btn-trigger-file-select');
    const fileCam = document.getElementById('ai-input-camera-file');
    const fileInput = document.getElementById('ai-input-image-file');

    if (btnTriggerCam && fileCam) {
      btnTriggerCam.addEventListener('click', () => fileCam.click());
    }
    if (btnTriggerFile && fileInput) {
      btnTriggerFile.addEventListener('click', () => fileInput.click());
    }

    if (fileCam) {
      fileCam.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.handleImageSelect(e.target.files[0]);
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.handleImageSelect(e.target.files[0]);
      });
    }

    // Drag and drop ảnh vào Dropzone
    const dropzone = document.getElementById('ai-image-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-indigo-500', 'bg-indigo-100/50');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-indigo-500', 'bg-indigo-100/50');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-500', 'bg-indigo-100/50');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleImageSelect(e.dataTransfer.files[0]);
        }
      });
    }

    // Hỗ trợ Paste ảnh trực tiếp từ Clipboard
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            if (this.activeTab === 'tab-ai-logger' && btnModeImage) {
              btnModeImage.click();
              this.handleImageSelect(file);
              this.showToast('Đã dán ảnh từ clipboard!', 'info');
            }
          }
        }
      }
    });

    // Nút xóa ảnh & xoay ảnh
    const btnRemoveImg = document.getElementById('btn-remove-ai-image');
    if (btnRemoveImg) {
      btnRemoveImg.addEventListener('click', () => this.clearOcrImage());
    }

    const btnRotateImg = document.getElementById('btn-rotate-ai-image');
    if (btnRotateImg) {
      btnRotateImg.addEventListener('click', () => this.rotateOcrImage());
    }

    // Nút chạy AI Vision (1 Chạm trực tiếp)
    const btnRunVision = document.getElementById('btn-run-ai-vision');
    if (btnRunVision) {
      btnRunVision.addEventListener('click', () => {
        this.requirePassword(() => this.handleRunAiVisionParse());
      });
    }

    // Quy trình 2 Bước: Bước 1 (Trích xuất văn bản thô OCR)
    const btnRunOcrStep1 = document.getElementById('btn-run-ocr-step1');
    if (btnRunOcrStep1) {
      btnRunOcrStep1.addEventListener('click', () => {
        this.requirePassword(() => this.handleRunAiOcrStep1());
      });
    }

    // Quy trình 2 Bước: Bước 2 (Chuẩn hóa văn bản thô & Đẩy lên Cloud)
    const btnRunOcrStep2 = document.getElementById('btn-run-ocr-step2');
    if (btnRunOcrStep2) {
      btnRunOcrStep2.addEventListener('click', () => {
        this.requirePassword(() => this.handleRunAiOcrStep2());
      });
    }

    // Nút chuyển văn bản thô sang Tab Nhập Văn Bản
    const btnCopyRawToTab = document.getElementById('btn-copy-raw-to-text-tab');
    if (btnCopyRawToTab) {
      btnCopyRawToTab.addEventListener('click', () => {
        const rawText = (document.getElementById('ai-ocr-raw-text') ? document.getElementById('ai-ocr-raw-text').value : '').trim();
        if (!rawText) {
          this.showToast('Chưa có văn bản thô để chuyển sang Tab Văn bản!', 'warning');
          return;
        }
        const textInput = document.getElementById('ai-input-text');
        if (textInput) textInput.value = rawText;
        const textTabBtn = document.getElementById('tab-btn-text-input');
        if (textTabBtn) textTabBtn.click();
        this.showToast('Đã chuyển văn bản thô sang Tab Nhập Văn Bản!', 'info');
      });
    }

    // Nút xóa nhanh văn bản thô
    const btnClearRawText = document.getElementById('btn-clear-raw-ocr-text');
    if (btnClearRawText) {
      btnClearRawText.addEventListener('click', () => {
        const rawEl = document.getElementById('ai-ocr-raw-text');
        if (rawEl) rawEl.value = '';
      });
    }

    // Modal lựa chọn học sinh trùng tên
    const btnCloseAmbiguous = document.getElementById('btn-close-ambiguous-modal');
    const btnCancelAmbiguous = document.getElementById('btn-cancel-ambiguous');
    const btnKeepAmbiguousRaw = document.getElementById('btn-keep-ambiguous-raw');

    if (btnCloseAmbiguous) {
      btnCloseAmbiguous.addEventListener('click', () => this.closeAmbiguousModal());
    }
    if (btnCancelAmbiguous) {
      btnCancelAmbiguous.addEventListener('click', () => this.closeAmbiguousModal());
    }
    if (btnKeepAmbiguousRaw) {
      btnKeepAmbiguousRaw.addEventListener('click', () => {
        if (this._currentAmbiguousRecordIndex !== null) {
          this.resolveAmbiguousKeepRaw(this._currentAmbiguousRecordIndex);
        }
      });
    }

    // Nút chạy AI Parse (Văn bản)
    const btnRunAi = document.getElementById('btn-run-ai-parse');
    if (btnRunAi) {
      btnRunAi.addEventListener('click', () => {
        this.requirePassword(() => this.handleRunAiParse());
      });
    }

    // Nút Clear AI Input
    const btnClearAi = document.getElementById('btn-clear-ai-input');
    if (btnClearAi) {
      btnClearAi.addEventListener('click', () => {
        document.getElementById('ai-input-text').value = '';
        this.resetAiStepper();
        document.getElementById('ai-result-preview-card').classList.add('hidden');
      });
    }

    // Nút xác nhận lưu vào nhật ký
    const btnConfirmSave = document.getElementById('btn-confirm-save-violations');
    if (btnConfirmSave) {
      btnConfirmSave.addEventListener('click', () => {
        this.requirePassword(() => this.confirmSaveAiViolations());
      });
    }

    // Nút hủy xem trước
    const btnCancelPreview = document.getElementById('btn-cancel-preview');
    if (btnCancelPreview) {
      btnCancelPreview.addEventListener('click', () => {
        document.getElementById('ai-result-preview-card').classList.add('hidden');
        this.resetAiStepper();
      });
    }

    // Bộ lọc Nhật ký
    const logWeek = document.getElementById('log-filter-week');
    const logClass = document.getElementById('log-filter-class');
    const logSearch = document.getElementById('log-filter-search');
    if (logWeek) logWeek.addEventListener('change', () => this.renderLogsTable());
    if (logClass) logClass.addEventListener('change', () => this.renderLogsTable());
    if (logSearch) logSearch.addEventListener('input', () => this.renderLogsTable());

    // Nút xuất & copy Nhật ký
    const btnCloudSync = document.getElementById('btn-cloud-sync');
    if (btnCloudSync) btnCloudSync.addEventListener('click', () => this.syncCloudData(false));

    // ── Auto-Refresh & Polling: Đồng bộ thời gian thực đa thiết bị ──────────────
    // 1. visibilitychange: Kéo dữ liệu Google Sheets ngay lập tức khi mở khóa màn hình hoặc quay lại tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._lastPullTime = 0; // Reset rate-limit để kéo ngay lập tức
        this.pullAndMergeFromCloud(true, true);
      }
    });

    // 2. window.focus: Kéo dữ liệu Google Sheets ngay lập tức khi cửa sổ/tab được chọn lại
    window.addEventListener('focus', () => {
      this._lastPullTime = 0; // Reset rate-limit để kéo ngay lập tức
      this.pullAndMergeFromCloud(true, true);
    });

    // 3. online: Kết nối mạng khôi phục → đồng bộ đầy đủ ngay lập tức
    window.addEventListener('online', () => {
      this._lastPullTime = 0;
      this.pullAndMergeFromCloud(true, true);
    });

    // 4. Polling định kỳ mỗi 6 giây (chỉ khi tab đang hiển thị)
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
    this.autoSyncInterval = setInterval(() => {
      if (document.hidden) return;
      this.pullAndMergeFromCloud(true);
    }, 6000);

    const btnCopyMdLogs = document.getElementById('btn-copy-markdown-logs');
    if (btnCopyMdLogs) btnCopyMdLogs.addEventListener('click', () => this.copyLogsMarkdown());

    const btnExportExcelLogs = document.getElementById('btn-export-excel-logs');
    if (btnExportExcelLogs) btnExportExcelLogs.addEventListener('click', () => this.exportLogsExcel());

    const btnClearAllLogs = document.getElementById('btn-clear-all-logs');
    if (btnClearAllLogs) {
      btnClearAllLogs.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ nhật ký vi phạm không?')) {
          this.violations = [];
          this.saveViolations();
          this.logAuditAction('DELETE_VIOLATION', 'Xóa toàn bộ vi phạm', 'Đã làm trống toàn bộ nhật ký vi phạm trong hệ thống');
          this.renderLogsTable();
          this.renderEmulationTable();
          this.showToast('Đã làm trống toàn bộ nhật ký vi phạm.', 'info');
        }
      });
    }

    // ==========================================
    // LỊCH SỬ THAO TÁC (AUDIT LOGS - TAB 7)
    // ==========================================
    const auditType = document.getElementById('audit-filter-type');
    const auditActor = document.getElementById('audit-filter-actor');
    const auditSearch = document.getElementById('audit-filter-search');
    if (auditType) auditType.addEventListener('change', () => this.renderAuditLogsTable());
    if (auditActor) auditActor.addEventListener('change', () => this.renderAuditLogsTable());
    if (auditSearch) auditSearch.addEventListener('input', () => this.renderAuditLogsTable());

    const btnExportAuditExcel = document.getElementById('btn-export-audit-excel');
    if (btnExportAuditExcel) btnExportAuditExcel.addEventListener('click', () => this.exportAuditLogsExcel());

    const btnClearAuditLogs = document.getElementById('btn-clear-audit-logs');
    if (btnClearAuditLogs) btnClearAuditLogs.addEventListener('click', () => this.clearAuditLogs());

    const btnRefreshAudit = document.getElementById('btn-refresh-audit-logs');
    if (btnRefreshAudit) btnRefreshAudit.addEventListener('click', () => {
      this.renderAuditLogsTable();
      this.updateAuditStats();
      this.showToast('Đã làm mới danh sách lịch sử thao tác!', 'info');
    });

    // ==========================================
    // THI ĐUA & BẢNG TỔNG HỢP TUẦN (TAB 3)
    // ==========================================
    const emuWeek = document.getElementById('emulation-select-week');
    if (emuWeek) {
      emuWeek.addEventListener('change', () => {
        this.renderEmulationTable();
        this.updateCharts();
      });
    }

    const btnAddBonus = document.getElementById('btn-add-bonus-point');
    if (btnAddBonus) btnAddBonus.addEventListener('click', () => this.openBonusModal());

    const btnOpenExcelImp = document.getElementById('btn-open-excel-import');
    const inputExcelImp = document.getElementById('input-emulation-excel-file');
    if (btnOpenExcelImp && inputExcelImp) {
      btnOpenExcelImp.addEventListener('click', () => {
        this.requirePassword(() => {
          const curW = document.getElementById('emulation-select-week').value;
          if (this.isWeekLocked(curW)) {
            this.showToast(`Tuần ${curW} đã khóa niêm phong. Không thể import dữ liệu!`, 'error');
            return;
          }
          inputExcelImp.value = '';
          inputExcelImp.click();
        });
      });

      inputExcelImp.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleExcelEmulationImport(e.target.files[0]);
        }
      });
    }

    const btnDownloadTpl = document.getElementById('btn-download-emulation-template');
    if (btnDownloadTpl) btnDownloadTpl.addEventListener('click', () => this.downloadEmulationTemplateExcel());

    const btnSaveEmuTable = document.getElementById('btn-save-emulation-table');
    if (btnSaveEmuTable) btnSaveEmuTable.addEventListener('click', () => {
      const curW = document.getElementById('emulation-select-week').value;
      if (this.isWeekLocked(curW)) {
        this.showToast(`Tuần ${curW} đã được khóa niêm phong. Không thể thay đổi!`, 'error');
        return;
      }
      this.saveEmulationWeeks(false);
    });

    const btnCopyMdEmu = document.getElementById('btn-copy-markdown-emulation');
    if (btnCopyMdEmu) btnCopyMdEmu.addEventListener('click', () => this.copyEmulationMarkdown());

    const btnExportExcelEmu = document.getElementById('btn-export-excel-emulation');
    if (btnExportExcelEmu) btnExportExcelEmu.addEventListener('click', () => this.exportEmulationExcel());

    const btnViewWeeklyViolations = document.getElementById('btn-view-weekly-violations');
    if (btnViewWeeklyViolations) {
      btnViewWeeklyViolations.addEventListener('click', () => this.viewWeeklyViolations());
    }

    // Quản lý khóa / mở tuần
    const btnToggleWeekLock = document.getElementById('btn-toggle-week-lock');
    if (btnToggleWeekLock) btnToggleWeekLock.addEventListener('click', () => this.handleToggleCurrentWeekLock());

    const btnOpenManageWeeks = document.getElementById('btn-open-manage-weeks-modal');
    if (btnOpenManageWeeks) btnOpenManageWeeks.addEventListener('click', () => this.openManageWeeksModal());

    const btnCloseManageWeeks = document.getElementById('btn-close-manage-weeks-modal');
    if (btnCloseManageWeeks) btnCloseManageWeeks.addEventListener('click', () => this.closeManageWeeksModal());

    const btnDoneManageWeeks = document.getElementById('btn-done-manage-weeks');
    if (btnDoneManageWeeks) btnDoneManageWeeks.addEventListener('click', () => this.closeManageWeeksModal());

    const btnLockPast = document.getElementById('btn-lock-past-weeks');
    if (btnLockPast) btnLockPast.addEventListener('click', () => this.lockPastWeeks());

    const btnOpenCurOnly = document.getElementById('btn-open-current-week-only');
    if (btnOpenCurOnly) btnOpenCurOnly.addEventListener('click', () => this.openCurrentWeekOnly());

    const modalManageWeeks = document.getElementById('modal-manage-weeks');
    if (modalManageWeeks) {
      modalManageWeeks.addEventListener('click', (e) => {
        if (e.target === modalManageWeeks) this.closeManageWeeksModal();
      });
    }

    // Modal Bonus handlers
    const btnCloseBonus = document.getElementById('btn-close-bonus-modal');
    if (btnCloseBonus) btnCloseBonus.addEventListener('click', () => {
      document.getElementById('modal-bonus-points').classList.add('hidden');
    });

    const tabBonusForm = document.getElementById('tab-btn-bonus-form');
    const tabBonusSyntax = document.getElementById('tab-btn-bonus-syntax');
    const modeBonusForm = document.getElementById('bonus-mode-form');
    const modeBonusSyntax = document.getElementById('bonus-mode-syntax');
    if (tabBonusForm && tabBonusSyntax && modeBonusForm && modeBonusSyntax) {
      tabBonusForm.addEventListener('click', () => {
        tabBonusForm.className = 'py-2 px-4 border-b-2 border-amber-500 text-amber-700 active-tab-bonus';
        tabBonusSyntax.className = 'py-2 px-4 border-b-2 border-transparent text-slate-500 hover:text-slate-800';
        modeBonusForm.classList.remove('hidden');
        modeBonusSyntax.classList.add('hidden');
      });

      tabBonusSyntax.addEventListener('click', () => {
        tabBonusSyntax.className = 'py-2 px-4 border-b-2 border-amber-500 text-amber-700 active-tab-bonus';
        tabBonusForm.className = 'py-2 px-4 border-b-2 border-transparent text-slate-500 hover:text-slate-800';
        modeBonusSyntax.classList.remove('hidden');
        modeBonusForm.classList.add('hidden');
      });
    }

    const btnSubmitBonusForm = document.getElementById('btn-submit-bonus-form');
    if (btnSubmitBonusForm) {
      btnSubmitBonusForm.addEventListener('click', () => {
        const curW = document.getElementById('emulation-select-week').value;
        const className = document.getElementById('bonus-select-class').value;
        const pts = parseFloat(document.getElementById('bonus-input-points').value) || 0;
        const reason = (document.getElementById('bonus-input-reason').value || '').trim();

        if (pts <= 0) {
          this.showToast('Vui lòng nhập số điểm cộng lớn hơn 0!', 'warning');
          return;
        }

        if (!reason) {
          this.showToast('Bắt buộc phải nhập lý do cộng điểm!', 'warning');
          const rInp = document.getElementById('bonus-input-reason');
          if (rInp) rInp.focus();
          return;
        }

        this.addBonusPoint(curW, className, pts, reason);
        document.getElementById('bonus-input-reason').value = '';
      });
    }

    const btnSubmitBonusSyntax = document.getElementById('btn-submit-bonus-syntax');
    if (btnSubmitBonusSyntax) {
      btnSubmitBonusSyntax.addEventListener('click', () => {
        const curW = document.getElementById('emulation-select-week').value;
        const text = (document.getElementById('bonus-syntax-text').value || '').trim();
        this.parseBonusSyntax(curW, text);
        document.getElementById('bonus-syntax-text').value = '';
      });
    }

    // Modal Edit Class handlers
    const btnCloseEditClass = document.getElementById('btn-close-edit-class-modal');
    const btnCancelEditClass = document.getElementById('btn-cancel-edit-class');
    const modalEditClass = document.getElementById('modal-edit-class-emulation');
    if (btnCloseEditClass && modalEditClass) btnCloseEditClass.addEventListener('click', () => modalEditClass.classList.add('hidden'));
    if (btnCancelEditClass && modalEditClass) btnCancelEditClass.addEventListener('click', () => modalEditClass.classList.add('hidden'));

    const formEditClass = document.getElementById('form-edit-class-emulation');
    if (formEditClass) {
      formEditClass.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveClassModal(e);
      });
    }

    // Modal View Violations handler
    const btnCloseClassViols = document.getElementById('btn-close-class-violations-modal');
    const modalClassViols = document.getElementById('modal-view-class-violations');
    if (btnCloseClassViols && modalClassViols) btnCloseClassViols.addEventListener('click', () => modalClassViols.classList.add('hidden'));

    // ==========================================
    // SAO LƯU & BẢO VỆ DỮ LIỆU (TAB 6)
    // ==========================================
    const btnExportBackup1 = document.getElementById('btn-export-full-backup');
    const btnExportBackup2 = document.getElementById('btn-export-full-backup-2');
    if (btnExportBackup1) btnExportBackup1.addEventListener('click', () => this.exportFullBackupJson());
    if (btnExportBackup2) btnExportBackup2.addEventListener('click', () => this.exportFullBackupJson());

    const inputBackupFile = document.getElementById('input-backup-file');
    if (inputBackupFile) {
      inputBackupFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleRestoreBackupFile(e.target.files[0]);
          inputBackupFile.value = '';
        }
      });
    }

    const btnCloseBackupPrev = document.getElementById('btn-close-backup-preview');
    const btnCancelBackupRestore = document.getElementById('btn-cancel-backup-restore');
    const modalBackupPrev = document.getElementById('modal-backup-preview');
    if (btnCloseBackupPrev && modalBackupPrev) btnCloseBackupPrev.addEventListener('click', () => modalBackupPrev.classList.add('hidden'));
    if (btnCancelBackupRestore && modalBackupPrev) btnCancelBackupRestore.addEventListener('click', () => modalBackupPrev.classList.add('hidden'));

    const btnConfirmBackupRestore = document.getElementById('btn-confirm-backup-restore');
    if (btnConfirmBackupRestore) btnConfirmBackupRestore.addEventListener('click', () => this.confirmRestoreBackup());

    // Snapshot Modal handlers
    const btnOpenSnap1 = document.getElementById('btn-open-create-snapshot');
    const btnOpenSnap2 = document.getElementById('btn-trigger-snapshot-modal');
    const modalCreateSnap = document.getElementById('modal-create-snapshot');
    const btnCloseSnap = document.getElementById('btn-close-create-snapshot');
    const btnCancelSnap = document.getElementById('btn-cancel-create-snapshot');
    const btnConfirmSnap = document.getElementById('btn-confirm-create-snapshot');

    const openSnapModal = () => {
      document.getElementById('input-snapshot-name').value = `Mốc lưu ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}`;
      document.getElementById('input-snapshot-desc').value = '';
      modalCreateSnap.classList.remove('hidden');
    };

    if (btnOpenSnap1) btnOpenSnap1.addEventListener('click', openSnapModal);
    if (btnOpenSnap2) btnOpenSnap2.addEventListener('click', openSnapModal);
    if (btnCloseSnap && modalCreateSnap) btnCloseSnap.addEventListener('click', () => modalCreateSnap.classList.add('hidden'));
    if (btnCancelSnap && modalCreateSnap) btnCancelSnap.addEventListener('click', () => modalCreateSnap.classList.add('hidden'));

    if (btnConfirmSnap) {
      btnConfirmSnap.addEventListener('click', () => {
        const name = (document.getElementById('input-snapshot-name').value || '').trim();
        const desc = (document.getElementById('input-snapshot-desc').value || '').trim();
        this.createSnapshot(name, desc, false);
        modalCreateSnap.classList.add('hidden');
        this.showToast('Đã tạo Điểm khôi phục thành công!', 'success');
      });
    }

    const btnClearSnaps = document.getElementById('btn-clear-all-snapshots');
    if (btnClearSnaps) {
      btnClearSnaps.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa TẤT CẢ các điểm khôi phục không?')) {
          this.snapshots = [];
          this.saveSnapshots();
          this.showToast('Đã xóa danh sách mốc khôi phục.', 'info');
        }
      });
    }

    const btnExportServerJson = document.getElementById('btn-export-server-json');
    if (btnExportServerJson) btnExportServerJson.addEventListener('click', () => this.exportServerSyncJson());

    // Học sinh (Tab 4)
    const stuSearch = document.getElementById('student-search-query');
    const stuFilter = document.getElementById('student-filter-class');
    if (stuSearch) stuSearch.addEventListener('input', () => this.renderStudentsTable());
    if (stuFilter) stuFilter.addEventListener('change', () => this.renderStudentsTable());

    const btnOpenAddStudent = document.getElementById('btn-open-add-student');
    if (btnOpenAddStudent) {
      btnOpenAddStudent.addEventListener('click', () => this.openStudentModal());
    }

    const btnSaveStudent = document.getElementById('btn-save-student');
    if (btnSaveStudent) {
      btnSaveStudent.addEventListener('click', () => this.saveStudentModal());
    }

    const btnResetDefaultStudents = document.getElementById('btn-reset-default-students');
    if (btnResetDefaultStudents) {
      btnResetDefaultStudents.addEventListener('click', () => {
        if (!this.isSupervisor()) {
          this.openPasswordModal();
          return;
        }
        if (confirm('Khôi phục danh sách gốc 1.226 học sinh Trường THPT Số 1 Lê Hồng Phong?')) {
          this.students = JSON.parse(JSON.stringify(window.DEFAULT_STUDENTS || []));
          this.saveStudents();
          this.populateDropdowns();
          this.renderStudentsTable();
          this.showToast('Đã khôi phục 1.226 học sinh gốc!', 'success');
        }
      });
    }

    const btnExportStudentsExcel = document.getElementById('btn-export-students-excel');
    if (btnExportStudentsExcel) {
      btnExportStudentsExcel.addEventListener('click', () => this.exportStudentsExcel());
    }

    // Import Excel Modal
    const btnOpenImportStudents = document.getElementById('btn-open-import-students');
    if (btnOpenImportStudents) {
      btnOpenImportStudents.addEventListener('click', () => {
        document.getElementById('modal-import-students').classList.remove('hidden');
        document.getElementById('import-preview-box').classList.add('hidden');
        document.getElementById('btn-confirm-import-students').disabled = true;
      });
    }

    const fileImportInput = document.getElementById('file-import-input');
    if (fileImportInput) {
      fileImportInput.addEventListener('change', (e) => this.handleExcelFileSelect(e));
    }

    const btnConfirmImportStudents = document.getElementById('btn-confirm-import-students');
    if (btnConfirmImportStudents) {
      btnConfirmImportStudents.addEventListener('click', () => this.executeStudentImport());
    }

    // Quy định (Tab 5)
    const btnOpenAddRule = document.getElementById('btn-open-add-rule');
    if (btnOpenAddRule) {
      btnOpenAddRule.addEventListener('click', () => this.openRuleModal());
    }

    const btnSaveRule = document.getElementById('btn-save-rule');
    if (btnSaveRule) {
      btnSaveRule.addEventListener('click', () => this.saveRuleModal());
    }

    const btnResetDefaultRules = document.getElementById('btn-reset-default-rules');
    if (btnResetDefaultRules) {
      btnResetDefaultRules.addEventListener('click', () => {
        if (!this.isSupervisor()) {
          this.openPasswordModal();
          return;
        }
        if (confirm('Khôi phục danh mục 33 lỗi vi phạm quy định gốc của trường?')) {
          this.rules = JSON.parse(JSON.stringify(window.DEFAULT_RULES || []));
          this.saveRules();
          this.populateDropdowns();
          this.renderRulesTable();
          this.showToast('Đã khôi phục 33 danh mục lỗi gốc!', 'success');
        }
      });
    }
  }

  // ==================== XỬ LÝ AI & QUY TRÌNH STEPPER ====================

  // ── Xử lý Image Upload & Vision OCR ─────────────────────────────────────────

  handleImageSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.showToast('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP).', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentOcrImageBase64 = e.target.result;
      this.currentOcrImageMimeType = file.type || 'image/jpeg';
      this.currentOcrImageRotation = 0;

      const previewCard = document.getElementById('ai-image-preview-card');
      const previewImg = document.getElementById('ai-image-preview-element');
      const nameEl = document.getElementById('ai-image-name');
      const sizeEl = document.getElementById('ai-image-size');
      const btnRun = document.getElementById('btn-run-ai-vision');
      const btnStep1 = document.getElementById('btn-run-ocr-step1');

      if (previewImg) {
        previewImg.src = this.currentOcrImageBase64;
        previewImg.style.transform = 'rotate(0deg)';
      }
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      if (previewCard) previewCard.classList.remove('hidden');
      if (btnRun) btnRun.disabled = false;
      if (btnStep1) btnStep1.disabled = false;

      this.showToast('Đã tải ảnh lên thành công. Thầy/Cô có thể bấm "Bước 1" để trích xuất chữ viết tay!', 'success');
    };
    reader.readAsDataURL(file);
  }

  clearOcrImage() {
    this.currentOcrImageBase64 = null;
    this.currentOcrImageMimeType = null;
    this.currentOcrImageRotation = 0;
    const previewCard = document.getElementById('ai-image-preview-card');
    const previewImg = document.getElementById('ai-image-preview-element');
    const btnRun = document.getElementById('btn-run-ai-vision');
    const btnStep1 = document.getElementById('btn-run-ocr-step1');
    const rawBox = document.getElementById('ai-ocr-raw-step2-box');
    const rawEl = document.getElementById('ai-ocr-raw-text');
    const fileCam = document.getElementById('ai-input-camera-file');
    const fileInput = document.getElementById('ai-input-image-file');

    if (previewCard) previewCard.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (btnRun) btnRun.disabled = true;
    if (btnStep1) btnStep1.disabled = true;
    if (rawBox) rawBox.classList.add('hidden');
    if (rawEl) rawEl.value = '';
    if (fileCam) fileCam.value = '';
    if (fileInput) fileInput.value = '';
  }

  rotateOcrImage() {
    if (!this.currentOcrImageBase64) return;
    this.currentOcrImageRotation = (this.currentOcrImageRotation + 90) % 360;
    const previewImg = document.getElementById('ai-image-preview-element');
    if (previewImg) {
      previewImg.style.transform = `rotate(${this.currentOcrImageRotation}deg)`;
    }
  }

  // ── Quy trình 2 Bước: Xử lý OCR Chữ Viết Tay Sổ Tay ──────────────────────────

  handleRunAiOcrStep1() {
    this.requirePassword(() => this.doRunAiOcrStep1());
  }

  async doRunAiOcrStep1() {
    if (!this.currentOcrImageBase64) {
      this.showToast('Vui lòng tải ảnh chụp sổ tay lên trước khi quét!', 'warning');
      return;
    }

    const apiKey = window.geminiService ? window.geminiService.getApiKey() : null;
    if (!apiKey) {
      this.showToast('Chưa có API Key. Vui lòng cài đặt API Key để sử dụng AI.', 'warning');
      this.openSettingsModal();
      return;
    }

    document.getElementById('global-error-banner').classList.add('hidden');
    document.getElementById('ai-fallback-log').classList.add('hidden');

    const btnStep1 = document.getElementById('btn-run-ocr-step1');
    if (btnStep1) {
      btnStep1.disabled = true;
      btnStep1.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang Trích Xuất...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    this.updateStepperState('running', 1, 'Mô hình Vision AI đang bóc tách chữ viết tay từ ảnh chụp sổ tay (Bước 1: OCR Thô)...');

    try {
      const result = await window.geminiService.extractRawTextFromImage({
        imageBase64: this.currentOcrImageBase64,
        mimeType: this.currentOcrImageMimeType || 'image/jpeg',
        onProgress: (status) => {
          if (status.type === 'fallback') {
            const fallbackLog = document.getElementById('ai-fallback-log');
            const fallbackText = document.getElementById('ai-fallback-text');
            if (fallbackLog && fallbackText) {
              fallbackLog.classList.remove('hidden');
              fallbackText.textContent = status.message;
            }
          } else if (status.message) {
            this.updateStepperState('running', 1, status.message);
          }
        }
      });

      const rawTextEl = document.getElementById('ai-ocr-raw-text');
      const rawBox = document.getElementById('ai-ocr-raw-step2-box');

      if (rawTextEl) {
        rawTextEl.value = result.rawText || '';
      }
      if (rawBox) {
        rawBox.classList.remove('hidden');
        rawBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      this.updateStepperState('success', 1, 'Bước 1 hoàn tất! Đã trích xuất xong chữ viết tay. Thầy/Cô có thể chỉnh sửa bên dưới trước khi bấm Bước 2.');
      this.showToast('Đã trích xuất xong chữ viết tay! Thầy/Cô có thể xem và chỉnh sửa văn bản thô bên dưới.', 'success');

    } catch (err) {
      console.error('Lỗi trích xuất OCR Bước 1:', err);
      this.updateStepperState('error', 1, err.message);
      this.showToast(`Lỗi trích xuất OCR: ${err.message}`, 'error');
    } finally {
      if (btnStep1) {
        btnStep1.disabled = false;
        btnStep1.innerHTML = `<i data-lucide="scan-text" class="w-4 h-4"></i><span>Bước 1: Trích Xuất Chữ Viết Tay (OCR Thô)</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  handleRunAiOcrStep2() {
    this.requirePassword(() => {
      const rawTextEl = document.getElementById('ai-ocr-raw-text');
      const text = rawTextEl ? rawTextEl.value.trim() : '';
      if (!text) {
        this.showToast('Văn bản thô đang rỗng. Vui lòng bấm "Bước 1" để trích xuất hoặc nhập nội dung vi phạm!', 'warning');
        if (rawTextEl) rawTextEl.focus();
        return;
      }
      this.doRunAiParse(text);
    });
  }

  handleRunAiVisionParse() {
    this.requirePassword(() => this.doRunAiVisionParse());
  }

  async doRunAiVisionParse() {
    if (!this.currentOcrImageBase64) {
      this.showToast('Vui lòng tải ảnh chụp sổ tay lên trước khi quét!', 'warning');
      return;
    }

    const apiKey = window.geminiService ? window.geminiService.getApiKey() : null;
    if (!apiKey) {
      this.showToast('Chưa có API Key. Vui lòng cài đặt API Key để sử dụng AI.', 'warning');
      this.openSettingsModal();
      return;
    }

    const dateVal = document.getElementById('input-violation-date').value || new Date().toISOString().split('T')[0];
    const weekNum = this.calculateWeek(dateVal);

    if (this.isWeekLocked(weekNum)) {
      this.showToast(`Tuần ${weekNum} đã kết thúc và được khóa dữ liệu niêm phong. Vui lòng chọn ngày thuộc Tuần 7 trở đi!`, 'error');
      return;
    }

    document.getElementById('global-error-banner').classList.add('hidden');
    document.getElementById('ai-fallback-log').classList.add('hidden');

    const btnRun = document.getElementById('btn-run-ai-vision');
    btnRun.disabled = true;
    btnRun.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang Quét Chữ Viết Tay...</span>`;
    if (window.lucide) window.lucide.createIcons();

    try {
      // Step 1: Multimodal Vision OCR
      this.updateStepperState('running', 1, 'Mô hình Vision AI đang bóc tách chữ viết tay từ ảnh chụp sổ tay...');
      await this.sleep(300);

      const response = await window.geminiService.parseHandwrittenImage({
        imageBase64: this.currentOcrImageBase64,
        mimeType: this.currentOcrImageMimeType || 'image/jpeg',
        inputDate: dateVal,
        weekNum,
        activeRules: this.rules,
        onProgress: (status) => {
          if (status.type === 'fallback') {
            const fallbackLog = document.getElementById('ai-fallback-log');
            const fallbackText = document.getElementById('ai-fallback-text');
            if (fallbackLog && fallbackText) {
              fallbackLog.classList.remove('hidden');
              fallbackText.textContent = status.message;
            }
          } else if (status.message) {
            this.updateStepperState('running', 1, status.message);
          }
        }
      });

      const rawRecords = (response.data && response.data.records) ? response.data.records : [];

      // Cập nhật văn bản thô vào Textarea Bước 2 để giáo viên theo dõi và chỉnh sửa trực quan
      const rawTextEl = document.getElementById('ai-ocr-raw-text');
      const rawBox = document.getElementById('ai-ocr-raw-step2-box');
      if (rawTextEl && rawRecords.length > 0) {
        rawTextEl.value = rawRecords.map(r => `${r.date || dateVal} - ${r.student_name || ''} - ${r.class_name || ''} - ${r.original_text || r.violation_category || ''}`).join('\n');
      }
      if (rawBox) {
        rawBox.classList.remove('hidden');
      }

      // Step 2: Tách dòng Đa ngày
      this.updateStepperState('running', 2, 'Kiểm tra và tự động tách dòng độc lập theo từng ngày vi phạm...');
      await this.sleep(250);

      // Step 3: Đối chiếu CSDL 1.226 học sinh (Smart Heuristics)
      this.updateStepperState('running', 3, 'Đối chiếu CSDL 1.226 học sinh (Smart Heuristics & Khối 10B/11A/12C)...');
      await this.sleep(250);

      const postProcessed = this.postProcessAiRecords(rawRecords, dateVal, weekNum);

      // Kiểm tra xem có học sinh trùng tên / khác họ cần giải quyết không
      const firstAmbiguousIdx = postProcessed.records.findIndex(r => r.ambiguous);

      if (firstAmbiguousIdx !== -1) {
        // DỪNG TIẾN TRÌNH TẠI BƯỚC 3, BẬT POPUP CHO GIÁO VIÊN CHỌN
        this.updateStepperState('running', 3, '⚠️ Phát hiện học sinh trùng tên / khác họ: Đang chờ giáo viên chọn học sinh thực tế...');
        this.renderAiPreview(postProcessed);
        setTimeout(() => this.openAmbiguousModal(firstAmbiguousIdx), 400);
      } else {
        // Step 4: Chuẩn hóa Quy chế & Áp điểm phạt
        this.updateStepperState('running', 4, 'Chuẩn hóa quy chế (Áo khoác/Áo đoàn -> Sai đồng phục)...');
        await this.sleep(200);
        this.updateStepperState('success', 4, `Vision AI đã bóc tách thành công ${postProcessed.records.length} bản ghi vi phạm từ ảnh sổ tay!`);
        this.renderAiPreview(postProcessed);
        this.showToast(`Vision AI đã quét xong! Tìm thấy ${postProcessed.records.length} vi phạm.`, 'success');
      }

    } catch (err) {
      console.error('Lỗi Vision AI:', err);
      this.updateStepperState('error', 1, err.message);
      const banner = document.getElementById('global-error-banner');
      const bannerMsg = document.getElementById('global-error-message');
      if (banner && bannerMsg) {
        banner.classList.remove('hidden');
        bannerMsg.textContent = err.message || 'Lỗi không xác định khi quét ảnh';
      }
    } finally {
      btnRun.disabled = false;
      btnRun.innerHTML = `<i data-lucide="scan" class="w-4 h-4"></i><span>Quét & Bóc Tách Chữ Viết Tay Bằng Vision AI</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // ── Xử lý Văn bản Tự do / Giọng nói (NLP) ───────────────────────────────────

  async handleRunAiParse() {
    this.requirePassword(() => this.doRunAiParse());
  }

  async doRunAiParse(customRawText = null) {
    const rawText = customRawText !== null
      ? customRawText.trim()
      : (document.getElementById('ai-input-text').value || '').trim();
    if (!rawText) {
      this.showToast('Vui lòng nhập hoặc bóc tách nội dung mô tả vi phạm trước khi phân tích.', 'warning');
      const textEl = document.getElementById('ai-input-text');
      if (textEl) textEl.focus();
      return;
    }

    const apiKey = window.geminiService ? window.geminiService.getApiKey() : null;
    if (!apiKey) {
      this.showToast('Chưa có API Key. Vui lòng cài đặt API Key để sử dụng AI.', 'warning');
      this.openSettingsModal();
      return;
    }

    const dateVal = document.getElementById('input-violation-date').value || new Date().toISOString().split('T')[0];
    const weekNum = this.calculateWeek(dateVal);

    if (this.isWeekLocked(weekNum)) {
      this.showToast(`Tuần ${weekNum} đã kết thúc và được khóa dữ liệu niêm phong. Vui lòng chọn ngày thuộc Tuần 7 trở đi!`, 'error');
      return;
    }

    // Ẩn lỗi banner cũ
    document.getElementById('global-error-banner').classList.add('hidden');
    document.getElementById('ai-fallback-log').classList.add('hidden');

    const btnRun = document.getElementById('btn-run-ai-parse');
    if (btnRun) {
      btnRun.disabled = true;
      btnRun.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang Phân Tích...</span>`;
    }

    const btnRunStep2 = document.getElementById('btn-run-ocr-step2');
    if (btnRunStep2) {
      btnRunStep2.disabled = true;
      btnRunStep2.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang Chuẩn Hóa & Đẩy Dữ Liệu...</span>`;
    }

    if (window.lucide) window.lucide.createIcons();

    try {
      // Step 1: Bóc tách thực thể (Hỗ trợ Batching & Exponential Backoff Retry)
      this.updateStepperState('running', 1, 'Đang phân tích cú pháp ngôn ngữ tự nhiên và trích xuất thực thể...');
      await this.sleep(300);

      const response = await window.geminiService.parseViolationInput({
        rawText,
        inputDate: dateVal,
        weekNum,
        activeRules: this.rules,
        onProgress: (status) => {
          if (status.type === 'fallback') {
            const fallbackLog = document.getElementById('ai-fallback-log');
            const fallbackText = document.getElementById('ai-fallback-text');
            if (fallbackLog && fallbackText) {
              fallbackLog.classList.remove('hidden');
              fallbackText.textContent = status.message;
            }
          } else if (status.message) {
            this.updateStepperState('running', 1, status.message);
          }
        }
      });

      const rawRecords = (response.data && response.data.records) ? response.data.records : [];

      // Step 2: Kiểm tra & Tách dòng Đa ngày
      this.updateStepperState('running', 2, 'Kiểm tra và tự động tách dòng độc lập theo từng ngày vi phạm...');
      await this.sleep(250);

      // Step 3: Đối chiếu CSDL 1.226 học sinh (Smart Heuristics & Fuzzy Matcher)
      this.updateStepperState('running', 3, 'Đối chiếu CSDL 1.226 học sinh (Smart Heuristics & Khối 10B/11A/12C)...');
      await this.sleep(250);

      const postProcessed = this.postProcessAiRecords(rawRecords, dateVal, weekNum);

      const firstAmbiguousIdx = postProcessed.records.findIndex(r => r.ambiguous);
      if (firstAmbiguousIdx !== -1) {
        // DỪNG TIẾN TRÌNH TẠI BƯỚC 3, BẬT POPUP CHO GIÁO VIÊN CHỌN
        this.updateStepperState('running', 3, '⚠️ Phát hiện học sinh trùng tên / khác họ: Đang chờ giáo viên chọn học sinh thực tế...');
        this.renderAiPreview(postProcessed);
        setTimeout(() => this.openAmbiguousModal(firstAmbiguousIdx), 400);
      } else {
        // Step 4: Chuẩn hóa Quy chế & Áp điểm phạt
        this.updateStepperState('running', 4, 'Chuẩn hóa quy chế (Quy đổi Áo khoác / Áo đoàn -> Sai đồng phục)...');
        await this.sleep(200);
        this.updateStepperState('success', 4, `Phân tích thành công! AI đã xử lý ${postProcessed.records.length} bản ghi.`);
        this.renderAiPreview(postProcessed);
        this.showToast(`Phân tích thành công! Bóc tách được ${postProcessed.records.length} vi phạm.`, 'success');
      }

    } catch (err) {
      console.error('Lỗi quy trình AI:', err);
      this.updateStepperState('error', 1, err.message);
      
      const banner = document.getElementById('global-error-banner');
      const bannerMsg = document.getElementById('global-error-message');
      if (banner && bannerMsg) {
        banner.classList.remove('hidden');
        bannerMsg.textContent = err.message || 'Lỗi không xác định khi kết nối API';
      }
    } finally {
      if (btnRun) {
        btnRun.disabled = false;
        btnRun.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i><span>Bắt Đầu Chuẩn Hóa Bằng AI</span>`;
      }
      if (btnRunStep2) {
        btnRunStep2.disabled = false;
        btnRunStep2.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i><span>Bước 2: Bắt Đầu Chuẩn Hóa & Đẩy Dữ Liệu</span>`;
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // ── Xử lý Hậu kỳ Toàn diện (Multi-Date Splitting, Fuzzy Matcher, Quy chế lỗi) ──

  postProcessAiRecords(rawRecords, defaultDate, defaultWeek) {
    if (!Array.isArray(rawRecords)) return { records: [], stats: { total: 0, matched: 0, unmatched: 0, ambiguous: 0, split: 0 } };
    
    // 1. Tách dòng đa ngày (Multi-Date Splitting)
    const dateSplitRecords = (window.geminiService && typeof window.geminiService.splitMultiDateRecords === 'function')
      ? window.geminiService.splitMultiDateRecords(rawRecords, defaultDate)
      : rawRecords;

    const processed = [];
    let ambiguousCount = 0;
    let unmatchedCount = 0;
    let splitCount = 0;
    let matchedCount = 0;

    dateSplitRecords.forEach(rec => {
      const recDate = rec.date || defaultDate;
      const recWeek = this.calculateWeek(recDate);
      const isSplit = !!rec.multiple_dates_split;
      if (isSplit) splitCount++;

      // 2. Chuẩn hóa Quy chế Lỗi Vi phạm (Áo khoác, Áo đoàn -> "Sai đồng phục" -0.5đ)
      let cat = rec.violation_category || 'Sai đồng phục';
      let pts = parseFloat(rec.penalty_points) || 0.5;

      const normRule = (window.geminiService && typeof window.geminiService.normalizeViolationRule === 'function')
        ? window.geminiService.normalizeViolationRule(cat, rec.original_text || rec.note)
        : null;

      if (normRule) {
        cat = normRule.category;
        pts = normRule.points;
      } else {
        const foundRule = this.rules.find(r => r.name.toLowerCase() === cat.toLowerCase());
        if (foundRule) {
          cat = foundRule.name;
          pts = foundRule.points;
        }
      }

      // 3. Đối chiếu Học sinh trong CSDL 1.226 học sinh
      const matchResult = this.matchStudentSmart(rec.student_name, rec.class_name);
      let finalName = rec.student_name;
      let finalClass = this.normalizeClassName(rec.class_name);
      let finalStudentId = rec.student_id || null;
      let isMatched = false;
      let isAmbiguous = false;
      let candidates = [];
      let warningBadge = null;

      let ambiguityReason = null;
      if (matchResult.matched && matchResult.student) {
        finalName = matchResult.student.name;
        finalClass = matchResult.student.class;
        finalStudentId = matchResult.student.id;
        isMatched = true;
        matchedCount++;
      } else if (matchResult.ambiguous) {
        isAmbiguous = true;
        candidates = matchResult.candidates || [];
        ambiguityReason = matchResult.reason || 'same_given_diff_surname_multi';
        ambiguousCount++;
      } else {
        // Yêu cầu 3: Không tìm thấy trong CSDL -> Không ngắt tiến trình, gắn cờ cảnh báo đỏ
        unmatchedCount++;
        warningBadge = 'Không tìm thấy trong CSDL';
      }

      processed.push({
        student_id: finalStudentId,
        student_name: finalName,
        class_name: finalClass,
        matched_student: isMatched,
        ambiguous: isAmbiguous,
        ambiguity_reason: ambiguityReason,
        candidates: candidates,
        unmatched_warning: warningBadge,
        violation_category: cat,
        penalty_points: pts,
        date: recDate,
        week: recWeek,
        original_text: rec.original_text || rec.note || '',
        multiple_dates_split: isSplit,
        split_index: rec.split_index || 1,
        split_total: rec.split_total || 1
      });
    });

    return {
      records: processed,
      stats: {
        total: processed.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        ambiguous: ambiguousCount,
        split: splitCount
      }
    };
  }

  // ── Điều khiển Stepper 4 bước & Trực quan hóa Trải nghiệm ──────────────────

  updateStepperState(status, stepIndex = 1, customMsg = null) {
    const badge = document.getElementById('stepper-badge-status');
    const progressBar = document.getElementById('stepper-progress-bar');
    const liveLog = document.getElementById('ai-stepper-live-log');
    const liveLogText = document.getElementById('ai-stepper-live-log-text');
    
    const steps = [
      document.getElementById('step-item-1'),
      document.getElementById('step-item-2'),
      document.getElementById('step-item-3'),
      document.getElementById('step-item-4')
    ];

    steps.forEach(s => {
      if (s) s.className = 'step-item flex items-start gap-3';
    });

    const stepLabels = [
      'Bóc tách thực thể & Nhận diện',
      'Kiểm tra & Tách dòng Đa ngày',
      'Đối chiếu CSDL 1.226 học sinh',
      'Chuẩn hóa Quy chế & Áp điểm phạt'
    ];

    if (status === 'running') {
      const pct = Math.round((stepIndex / 4) * 100);
      if (badge) {
        badge.textContent = `Đang xử lý Bước ${stepIndex}/4 (${pct}%)...`;
        badge.className = 'text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded animate-pulse';
      }
      if (progressBar) {
        progressBar.className = 'h-full bg-blue-600 transition-all duration-300';
        progressBar.style.width = `${pct}%`;
      }

      steps.forEach((s, idx) => {
        if (s) {
          if (idx + 1 < stepIndex) s.classList.add('completed');
          else if (idx + 1 === stepIndex) s.classList.add('active');
        }
      });

      if (liveLog && liveLogText) {
        liveLog.classList.remove('hidden');
        liveLogText.textContent = customMsg || `Bước ${stepIndex}: ${stepLabels[stepIndex - 1] || 'Đang xử lý...'}`;
      }

    } else if (status === 'success') {
      if (badge) {
        badge.textContent = 'Hoàn tất phân tích 100%';
        badge.className = 'text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded';
      }
      if (progressBar) {
        progressBar.className = 'h-full bg-emerald-500 transition-all duration-300';
        progressBar.style.width = '100%';
      }
      steps.forEach(s => { if (s) s.classList.add('completed'); });

      if (liveLog && liveLogText) {
        liveLog.classList.remove('hidden');
        liveLogText.textContent = customMsg || 'Toàn bộ quy trình AI đã hoàn thành xuất sắc.';
      }

    } else if (status === 'error') {
      if (badge) {
        badge.textContent = 'Đã dừng do lỗi';
        badge.className = 'text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200';
      }
      if (progressBar) {
        progressBar.className = 'h-full bg-red-500 transition-all duration-300';
      }
      steps.forEach(s => { if (s) s.classList.add('error'); });

      if (liveLog && liveLogText) {
        liveLog.classList.remove('hidden');
        liveLogText.textContent = customMsg || 'Quy trình bị gián đoạn do lỗi kết nối API.';
      }
    }
  }

  resetAiStepper() {
    const badge = document.getElementById('stepper-badge-status');
    const progressBar = document.getElementById('stepper-progress-bar');
    const liveLog = document.getElementById('ai-stepper-live-log');

    if (badge) {
      badge.textContent = 'Sẵn sàng';
      badge.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded';
    }
    if (progressBar) {
      progressBar.className = 'h-full bg-blue-600 w-0 transition-all duration-300';
      progressBar.style.width = '0%';
    }
    if (liveLog) liveLog.classList.add('hidden');

    const steps = [
      document.getElementById('step-item-1'),
      document.getElementById('step-item-2'),
      document.getElementById('step-item-3'),
      document.getElementById('step-item-4')
    ];
    steps.forEach(s => {
      if (s) s.className = 'step-item flex items-start gap-3';
    });
  }

  // ── Modal Xử lý Trùng Tên (Ambiguity Resolution) ────────────────────────────

  openAmbiguousModal(recordIdx) {
    const rec = this.pendingAiRecords[recordIdx];
    if (!rec || !rec.ambiguous || !rec.candidates || rec.candidates.length === 0) return;
    this._currentAmbiguousRecordIndex = recordIdx;

    const modal = document.getElementById('modal-resolve-ambiguous-student');
    const sourceName = document.getElementById('ambiguous-source-name');
    const sourceClass = document.getElementById('ambiguous-source-class');
    const list = document.getElementById('ambiguous-candidates-list');
    const modalSubtitle = document.getElementById('ambiguous-modal-subtitle');

    if (sourceName) sourceName.textContent = rec.student_name;
    if (sourceClass) sourceClass.textContent = rec.class_name || 'Chưa rõ';

    let reasonText = 'Phát hiện nhiều học sinh tương tự trong CSDL';
    if (rec.ambiguity_reason === 'same_given_diff_surname_multi') {
      reasonText = 'Trùng Tên trong cùng Lớp nhưng Khác Họ / Mập mờ họ: Vui lòng bấm chọn đúng học sinh thực tế:';
    } else if (rec.ambiguity_reason === 'diff_surname_single_candidate') {
      reasonText = 'Họ ghi chép khác với CSDL của học sinh cùng tên trong lớp: Vui lòng kiểm tra và xác nhận:';
    }
    if (modalSubtitle) modalSubtitle.textContent = reasonText;

    if (list) {
      list.innerHTML = rec.candidates.map((cand) => `
        <div class="p-3 bg-white hover:bg-blue-50/70 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition">
          <div>
            <div class="font-bold text-slate-900 text-sm">${cand.name}</div>
            <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span class="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">${cand.class}</span>
              <span>Mã HS: #${cand.id}</span>
              <span>Giới tính: ${cand.gender || 'Chưa rõ'}</span>
            </div>
          </div>
          <button type="button" onclick="window.app.resolveAmbiguousStudent(${recordIdx}, ${cand.id})" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer">
            Chọn học sinh này
          </button>
        </div>
      `).join('');
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  resolveAmbiguousStudent(recordIdx, studentId) {
    const rec = this.pendingAiRecords[recordIdx];
    if (!rec) return;
    const cand = (rec.candidates || []).find(c => c.id === studentId) || this.students.find(s => s.id === studentId);
    if (cand) {
      rec.student_name = cand.name;
      rec.class_name = cand.class;
      rec.student_id = cand.id;
      rec.matched_student = true;
      rec.ambiguous = false;
      rec.candidates = [];
      rec.unmatched_warning = null;
    }
    this.closeAmbiguousModal();
    this.renderAiPreview({ records: this.pendingAiRecords });
    this.showToast(`Đã chuẩn hóa học sinh: ${rec.student_name} (${rec.class_name})`, 'success');

    // Nếu còn bản ghi trùng tên khác, tự động mở tiếp
    const nextAmbiguousIdx = this.pendingAiRecords.findIndex(r => r.ambiguous);
    if (nextAmbiguousIdx !== -1) {
      setTimeout(() => this.openAmbiguousModal(nextAmbiguousIdx), 300);
    } else {
      this.updateStepperState('success', 4, 'Đã chuẩn hóa toàn bộ học sinh và áp khung điểm phạt! Sẵn sàng lưu vào Google Sheets.');
    }
  }

  resolveAmbiguousKeepRaw(recordIdx) {
    const rec = this.pendingAiRecords[recordIdx];
    if (rec) {
      rec.ambiguous = false;
      rec.matched_student = false;
      rec.unmatched_warning = 'Tên gốc chưa khớp CSDL';
    }
    this.closeAmbiguousModal();
    this.renderAiPreview({ records: this.pendingAiRecords });
    this.showToast('Đã giữ nguyên tên gốc theo ghi chép sổ tay.', 'info');
  }

  closeAmbiguousModal() {
    this._currentAmbiguousRecordIndex = null;
    const modal = document.getElementById('modal-resolve-ambiguous-student');
    if (modal) modal.classList.add('hidden');
  }

  // ── Kết quả Xem trước (Preview Card) ────────────────────────────────────────

  renderAiPreview(parsedData) {
    const card = document.getElementById('ai-result-preview-card');
    const list = document.getElementById('preview-records-list');
    const countBadge = document.getElementById('preview-count');
    
    if (!card || !list) return;

    this.pendingAiRecords = parsedData.records || [];
    countBadge.textContent = this.pendingAiRecords.length;

    // Cập nhật thống kê KPI tags
    let matchedCount = 0;
    let unmatchedCount = 0;
    let splitCount = 0;
    let ambiguousCount = 0;

    this.pendingAiRecords.forEach(r => {
      if (r.matched_student) matchedCount++;
      if (r.unmatched_warning) unmatchedCount++;
      if (r.multiple_dates_split) splitCount++;
      if (r.ambiguous) ambiguousCount++;
    });

    const elValMatched = document.getElementById('val-kpi-matched');
    const elValUnmatched = document.getElementById('val-kpi-unmatched');
    const elValSplit = document.getElementById('val-kpi-split');
    const elValAmbiguous = document.getElementById('val-kpi-ambiguous');

    const kpiUnmatched = document.getElementById('kpi-unmatched-count');
    const kpiSplit = document.getElementById('kpi-split-count');
    const kpiAmbiguous = document.getElementById('kpi-ambiguous-count');

    if (elValMatched) elValMatched.textContent = matchedCount;
    if (elValUnmatched) elValUnmatched.textContent = unmatchedCount;
    if (elValSplit) elValSplit.textContent = splitCount;
    if (elValAmbiguous) elValAmbiguous.textContent = ambiguousCount;

    if (kpiUnmatched) kpiUnmatched.classList.toggle('hidden', unmatchedCount === 0);
    if (kpiSplit) kpiSplit.classList.toggle('hidden', splitCount === 0);
    if (kpiAmbiguous) kpiAmbiguous.classList.toggle('hidden', ambiguousCount === 0);

    if (this.pendingAiRecords.length === 0) {
      list.innerHTML = `<p class="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">Không tìm thấy thông tin vi phạm cụ thể trong dữ liệu đã xử lý.</p>`;
      card.classList.remove('hidden');
      return;
    }

    list.innerHTML = this.pendingAiRecords.map((r, idx) => {
      // Phân loại kiểu card (bình thường, cảnh báo đỏ chưa khớp, hoặc trùng tên)
      const isUnmatched = !r.matched_student && !r.ambiguous;
      const borderClass = r.ambiguous
        ? 'border-amber-300 bg-amber-50/50'
        : (isUnmatched ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50/60');

      return `
        <div class="p-3.5 border ${borderClass} rounded-2xl flex items-start justify-between gap-3 text-xs transition shadow-2xs">
          <div class="space-y-1.5 flex-1">
            <!-- Student Header & Badges -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-bold text-slate-900 text-sm">${r.student_name || 'Chưa rõ tên'}</span>
              <span class="font-extrabold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded text-[11px]">${r.class_name || 'Chưa rõ lớp'}</span>

              ${r.matched_student ? 
                `<span class="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded font-bold">✓ Khớp CSDL</span>` : ''}

              ${r.unmatched_warning ? 
                `<span class="text-[10px] bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded font-bold">⚠️ ${r.unmatched_warning}</span>` : ''}

              ${r.multiple_dates_split ? 
                `<span class="text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-bold">📅 Ngày ${r.date} (Tuần ${r.week})</span>` : ''}

              ${r.ambiguous ? 
                `<button type="button" onclick="window.app.openAmbiguousModal(${idx})" class="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold cursor-pointer animate-pulse flex items-center gap-1">
                  <i data-lucide="help-circle" class="w-3 h-3"></i>
                  <span>Trùng tên: Bấm để chọn (${r.candidates ? r.candidates.length : 0} gợi ý)</span>
                </button>` : ''}
            </div>

            <!-- Violation Rule & Penalty Points -->
            <div class="text-slate-700 font-medium flex items-center gap-2 pt-0.5">
              <span class="text-slate-400">Lỗi quy đổi:</span>
              <strong class="text-slate-900 font-bold">${r.violation_category}</strong>
              <span class="text-red-600 font-extrabold bg-red-50 border border-red-200 px-2 py-0.5 rounded">-${r.penalty_points}đ</span>
              ${!r.multiple_dates_split && r.date ? `<span class="text-slate-400 text-[11px]">• ${r.date}</span>` : ''}
            </div>

            <!-- Original Note -->
            ${r.original_text ? `
              <div class="text-[11px] text-slate-500 italic bg-white/70 p-1.5 rounded-lg border border-slate-100">
                Ghi chú gốc: "${r.original_text}"
              </div>` : ''}
          </div>

          <button onclick="window.app.removePendingAiRecord(${idx})" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-white transition cursor-pointer" title="Bỏ bản ghi này">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }).join('');

    card.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  removePendingAiRecord(idx) {
    this.pendingAiRecords.splice(idx, 1);
    document.getElementById('preview-count').textContent = this.pendingAiRecords.length;
    if (this.pendingAiRecords.length === 0) {
      document.getElementById('ai-result-preview-card').classList.add('hidden');
      this.resetAiStepper();
    } else {
      this.renderAiPreview({ records: this.pendingAiRecords });
    }
  }

  confirmSaveAiViolations() {
    this.requirePassword(() => this.doConfirmSaveAiViolations());
  }

  doConfirmSaveAiViolations() {
    if (!this.pendingAiRecords || this.pendingAiRecords.length === 0) return;

    // Kiểm tra an toàn: Tuyệt đối không lưu nếu còn học sinh trùng tên / khác họ chưa được chọn
    const remainingAmbiguousIdx = this.pendingAiRecords.findIndex(r => r.ambiguous);
    if (remainingAmbiguousIdx !== -1) {
      this.showToast('Vui lòng chọn học sinh trùng tên / khác họ từ danh sách gợi ý trước khi lưu vào Google Sheets!', 'warning');
      this.openAmbiguousModal(remainingAmbiguousIdx);
      return;
    }

    const affectedWeeksAndClasses = new Map();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const countSaved = this.pendingAiRecords.length;

    this.pendingAiRecords.forEach(rec => {
      const w = rec.week || this.calculateWeek(rec.date);
      const c = rec.class_name;
      this.violations.unshift({
        id: Date.now() + Math.random(),
        week: w,
        date: rec.date || now.toISOString().split('T')[0],
        time: timeStr,
        created_at: now.toISOString(),
        student_name: rec.student_name,
        class_name: c,
        violation_category: rec.violation_category,
        penalty_points: parseFloat(rec.penalty_points) || 0.5,
        original_note: rec.original_text || rec.note || ''
      });
      if (!affectedWeeksAndClasses.has(w)) affectedWeeksAndClasses.set(w, new Set());
      affectedWeeksAndClasses.get(w).add(c);
    });

    // Đồng bộ tức thì từng tuần và lớp bị ảnh hưởng
    affectedWeeksAndClasses.forEach((classesSet, w) => {
      classesSet.forEach(c => {
        this.syncViolationWithEmulation(w, c);
      });
    });

    this.saveViolations();
    this.logAuditAction('ADD_VIOLATION', 'Nhập vi phạm AI', `Đã xác nhận và lưu ${countSaved} bản ghi vi phạm từ văn bản/ảnh sổ tay AI`, { count: countSaved });
    this.pendingAiRecords = [];
    document.getElementById('ai-result-preview-card').classList.add('hidden');
    const inputArea = document.getElementById('ai-input-text');
    if (inputArea) inputArea.value = '';
    this.clearOcrImage();
    this.resetAiStepper();

    this.showToast(`Đã lưu ${countSaved} bản ghi vi phạm vào Nhật ký!`, 'success');
    this.switchTab('tab-violation-logs');
  }

  // ==================== CHUẨN HÓA LỚP & BỘ LỌC THÔNG MINH ====================

  levenshteinDistance(a, b) {
    if (!a || !b) return (a || b || '').length;
    const m = a.length, n = b.length;
    const d = [];
    for (let i = 0; i <= m; i++) d[i] = [i];
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[m][n];
  }

  matchStudentSmart(rawName, rawClass) {
    if (!rawName) return { matched: false, notFound: true, candidates: [] };
    const targetClass = this.normalizeClassName(rawClass);
    const cleanName = String(rawName).trim()
      .replace(/^(?:học\s*sinh|bạn|em)\s+/i, '')
      .replace(/\s*-\s*l[ớơo]p.*$/i, '')
      .trim();

    const cleanNameNorm = this.removeVietnameseTones(cleanName.toLowerCase());
    const nameTokens = cleanNameNorm.split(/\s+/).filter(Boolean);
    const givenName = nameTokens[nameTokens.length - 1] || '';
    const surname = nameTokens.length > 1 ? nameTokens[0] : '';

    // 1. Phân loại pool tìm kiếm: ưu tiên lớp nếu nhận diện được
    let pool = targetClass ? this.students.filter(s => s.class === targetClass) : this.students;
    if (pool.length === 0) pool = this.students;

    // 2. So khớp chính xác 100% cả họ và tên (case-insensitive)
    const exact = pool.filter(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (exact.length === 1) return { matched: true, status: 'exact', student: exact[0], candidates: exact };
    if (exact.length > 1) return { matched: false, ambiguous: true, reason: 'exact_multi', candidates: exact };

    // 3. So khớp không dấu chính xác 100%
    const toneFreeExact = pool.filter(s => this.removeVietnameseTones(s.name.toLowerCase()) === cleanNameNorm);
    if (toneFreeExact.length === 1) return { matched: true, status: 'tone_free', student: toneFreeExact[0], candidates: toneFreeExact };
    if (toneFreeExact.length > 1) return { matched: false, ambiguous: true, reason: 'tone_free_multi', candidates: toneFreeExact };

    // 4. QUY TẮC CỐT LÕI: Trùng Tên trong cùng Lớp nhưng Khác Họ / Mập Mờ Họ
    const sameGivenInClass = pool.filter(s => {
      const sTokens = this.removeVietnameseTones(s.name.toLowerCase()).split(/\s+/);
      return sTokens[sTokens.length - 1] === givenName;
    });

    if (sameGivenInClass.length > 0) {
      // Trường hợp 4.1: Có từ 2 học sinh cùng tên trong lớp trở lên (VD: 10B01 có cả 'Mã Ngọc Bảo An' và 'Vy Thị Tường An')
      if (sameGivenInClass.length > 1) {
        if (surname) {
          const exactSurnameMatches = sameGivenInClass.filter(s => {
            const sTokens = this.removeVietnameseTones(s.name.toLowerCase()).split(/\s+/);
            return sTokens[0] === surname;
          });
          if (exactSurnameMatches.length === 1) {
            return { matched: true, status: 'exact_surname_given', student: exactSurnameMatches[0], candidates: exactSurnameMatches };
          }
        }
        // Khác họ (VD: sổ ghi 'Nguyễn Văn An' mà CSDL chỉ có 'Mã Ngọc Bảo An' & 'Vy Thị Tường An') hoặc chỉ ghi tên:
        // TUYỆT ĐỐI KHÔNG GÁN BỪA -> BẮT BUỘC DỪNG & BẬT POPUP CHO GIÁO VIÊN CHỌN
        return {
          matched: false,
          ambiguous: true,
          reason: 'same_given_diff_surname_multi',
          candidates: sameGivenInClass
        };
      }

      // Trường hợp 4.2: Trong lớp chỉ có ĐÚNG 1 học sinh mang tên đó
      if (sameGivenInClass.length === 1) {
        const candidate = sameGivenInClass[0];
        const cTokens = this.removeVietnameseTones(candidate.name.toLowerCase()).split(/\s+/);
        const cSurname = cTokens[0];

        // Nếu người dùng nhập cả họ và tên, NHƯNG HỌ HOÀN TOÀN KHÁC (VD: ghi 'Trần Bo 11A04' nhưng CSDL là 'Nguyễn Bo')
        // TUYỆT ĐỐI KHÔNG TỰ Ý GÁN -> Bật popup yêu cầu xác nhận
        if (surname && surname !== cSurname && surname.length > 1) {
          return {
            matched: false,
            ambiguous: true,
            reason: 'diff_surname_single_candidate',
            candidates: [candidate]
          };
        }

        // Họ khớp hoặc chỉ ghi tên gọi/tên đệm (VD: 'Bo 11A04' -> 'Nguyễn Bo', 'Kỳ 10B11' -> 'Lê Âu Kỳ')
        return {
          matched: true,
          status: 'single_given_match',
          student: candidate,
          candidates: [candidate]
        };
      }
    }

    // 5. So khớp theo các token trong họ tên
    const tokenMatches = pool.filter(s => {
      const sNorm = this.removeVietnameseTones(s.name.toLowerCase());
      return nameTokens.every(tok => sNorm.includes(tok));
    });

    if (tokenMatches.length === 1) {
      return { matched: true, status: 'token_single', student: tokenMatches[0], candidates: tokenMatches };
    } else if (tokenMatches.length > 1) {
      return { matched: false, ambiguous: true, reason: 'token_multi', candidates: tokenMatches };
    }

    // 6. So khớp mờ Fuzzy Levenshtein (khắc phục chữ viết tay bị lỗi 1-2 ký tự)
    if (cleanNameNorm.length >= 4) {
      const fuzzyMatches = pool.map(s => {
        const sNorm = this.removeVietnameseTones(s.name.toLowerCase());
        const dist = this.levenshteinDistance(cleanNameNorm, sNorm);
        return { student: s, dist };
      }).filter(item => item.dist <= 2);

      if (fuzzyMatches.length === 1) {
        return { matched: true, status: 'fuzzy_levenshtein', student: fuzzyMatches[0].student, candidates: [fuzzyMatches[0].student] };
      } else if (fuzzyMatches.length > 1) {
        return { matched: false, ambiguous: true, reason: 'fuzzy_multi', candidates: fuzzyMatches.map(m => m.student) };
      }
    }

    // 7. Hoàn toàn không tìm thấy trong CSDL 1.226 học sinh (Không dừng tiến trình, đánh dấu đỏ cảnh báo)
    return { matched: false, notFound: true, candidates: [] };
  }

  normalizeClassName(raw) {
    if (!raw) return '';
    let str = String(raw).trim().toUpperCase().replace(/\s+/g, '');
    str = str.replace(/^(?:L[ỚƠO]P)/i, '');

    // Khối 10 dùng B: 10B01 đến 10B11 (10b1, 10b01, b1, b01, 1001, 10b11, b11...)
    let m = str.match(/^(?:10)?B0?([1-9]|1[0-1])$/i);
    if (m) return `10B${m[1].padStart(2, '0')}`;
    m = str.match(/^100?([1-9]|1[0-1])$/);
    if (m) return `10B${m[1].padStart(2, '0')}`;

    // Khối 11 dùng A: 11A01 đến 11A09 (11a4, 11a04, a4, a04, 1104...)
    m = str.match(/^(?:11)?A0?([1-9])$/i);
    if (m) return `11A${m[1].padStart(2, '0')}`;
    m = str.match(/^110?([1-9])$/);
    if (m) return `11A${m[1].padStart(2, '0')}`;

    // Khối 12 dùng C: 12C01 đến 12C09 (12c8, 12c08, c8, c08, 1208...)
    m = str.match(/^(?:12)?C0?([1-9])$/i);
    if (m) return `12C${m[1].padStart(2, '0')}`;
    m = str.match(/^120?([1-9])$/);
    if (m) return `12C${m[1].padStart(2, '0')}`;

    return str;
  }

  removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
  }

  filterStudentsSmart(query) {
    if (!query || query.trim().length === 0) {
      return this.students.slice(0, 10);
    }
    const q = query.trim().toLowerCase();
    const parts = q.split(/\s+/).filter(Boolean);

    let classFilter = null;
    let nameKeywords = [];

    parts.forEach(p => {
      const normalizedClass = this.normalizeClassName(p);
      if (/^[0-9]{2}[A-C][0-9]{2}$/.test(normalizedClass)) {
        classFilter = normalizedClass;
      } else {
        nameKeywords.push(p);
      }
    });

    const searchName = nameKeywords.join(' ');
    const searchNameNorm = this.removeVietnameseTones(searchName);

    return this.students.filter(s => {
      const sClass = s.class.toUpperCase();
      const sName = s.name.toLowerCase();
      const sNameNorm = this.removeVietnameseTones(sName);

      if (classFilter) {
        if (sClass !== classFilter) return false;
        if (!searchName) return true;
        return sName.includes(searchName) || sNameNorm.includes(searchNameNorm);
      }

      const qNorm = this.removeVietnameseTones(q);
      const qClassNorm = this.normalizeClassName(q);

      return sName.includes(q) ||
             sNameNorm.includes(qNorm) ||
             sClass.includes(qClassNorm || q.toUpperCase()) ||
             sClass.toLowerCase().includes(q);
    }).slice(0, 25);
  }

  filterRulesSmart(query) {
    if (!query || query.trim() === '') {
      return this.rules.slice(0, 15);
    }
    const q = query.trim().toLowerCase();
    const qNorm = this.removeVietnameseTones(q);

    const aliases = {
      'k': ['khong'],
      'kbt': ['khong bang ten'],
      'bt': ['bo tiet', 'khong bang ten', 'bt ten'],
      'muon': ['di hoc muon', 'tre'],
      'tre': ['di hoc muon', 've sinh tre'],
      'dep': ['di dep le'],
      'le': ['di dep le'],
      'dp': ['sai dong phuc'],
      'dong phuc': ['sai dong phuc'],
      'dt': ['su dung dien thoai'],
      'dienthoai': ['su dung dien thoai'],
      'kmbh': ['khong doi mu bao hiem'],
      'mbh': ['khong doi mu bao hiem'],
      'mu': ['khong doi mu bao hiem'],
      'ao dai': ['khong mac ao dai'],
      'ao doan': ['khong mac ao doan'],
      'toc': ['nhuom toc'],
      'xe': ['di xe trong san truong'],
      'so': ['khong nop so truc', 'khong tong hop so dau bai'],
      've': ['ve sinh', 've bieu']
    };

    return this.rules.filter(r => {
      const rName = r.name.toLowerCase();
      const rNorm = this.removeVietnameseTones(rName);

      // 1. Chứa trực tiếp (có dấu hoặc không dấu)
      if (rName.includes(q) || rNorm.includes(qNorm)) return true;

      // 2. Viết tắt chữ cái đầu các từ trong tên lỗi (Acronym)
      const words = rNorm.split(/[\s,\-\/]+/).filter(Boolean);
      const acronym = words.map(w => w[0]).join('');
      if (acronym.includes(qNorm)) return true;

      // 3. Nếu gõ từ ngắn (như "k", "bt"), kiểm tra chữ cái đầu từ
      if (qNorm.length <= 2 && words.some(w => w.startsWith(qNorm))) return true;

      // 4. Tra cứu từ khóa mở rộng (alias)
      if (aliases[qNorm]) {
        if (aliases[qNorm].some(keyword => rNorm.includes(keyword))) {
          return true;
        }
      }

      return false;
    }).slice(0, 20);
  }

  // ==================== NHẬP LIỆU THỦ CÔNG TRỰC TIẾP ====================

  setupManualEntry() {
    const studentInput = document.getElementById('manual-student-input');
    const autoList = document.getElementById('autocomplete-list');
    const ruleInput = document.getElementById('manual-rule-input');
    const ruleAutoList = document.getElementById('rule-autocomplete-list');
    const ruleSelect = document.getElementById('manual-rule-select');
    const btnAdd = document.getElementById('btn-manual-add');

    this.currentMatchedStudents = [];
    this.currentMatchedRules = [];

    // ==========================================
    // 1. GỢI Ý HỌC SINH & LỚP (DROPDOWN LIST)
    // ==========================================
    if (studentInput && autoList) {
      const renderStudentDropdown = (query) => {
        const matches = this.filterStudentsSmart(query);
        this.currentMatchedStudents = matches;

        if (matches.length === 0) {
          autoList.innerHTML = `
            <div class="p-4 text-slate-400 text-xs md:text-sm italic text-center">
              Không tìm thấy học sinh phù hợp với từ khóa "${query}"
            </div>
          `;
        } else {
          autoList.innerHTML = matches.map((s, idx) => `
            <div class="suggestion-dropdown-item flex items-center justify-between p-3.5 hover:bg-blue-50 active:bg-blue-100 cursor-pointer border-b border-slate-100 transition select-none"
                 data-student-index="${idx}">
              <div class="flex items-center gap-2.5 pointer-events-none">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                <span class="student-name font-bold text-slate-900 text-sm md:text-base">${s.name}</span>
              </div>
              <span class="student-class font-extrabold text-xs md:text-sm bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 rounded-lg pointer-events-none shrink-0">${s.class}</span>
            </div>
          `).join('');
        }
        autoList.classList.remove('hidden');
        autoList.style.display = 'block';
      };

      studentInput.addEventListener('focus', () => {
        renderStudentDropdown(studentInput.value);
      });

      studentInput.addEventListener('input', (e) => {
        delete studentInput.dataset.studentName;
        delete studentInput.dataset.studentClass;
        renderStudentDropdown(e.target.value);
      });

      const selectStudentByIndex = (e) => {
        const item = e.target.closest('.suggestion-dropdown-item');
        if (item && item.dataset.studentIndex !== undefined) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(item.dataset.studentIndex);
          const student = this.currentMatchedStudents[idx];
          if (student) {
            this.selectManualStudent(student.name, student.class);
          }
        }
      };

      autoList.addEventListener('mousedown', selectStudentByIndex);
      autoList.addEventListener('click', selectStudentByIndex);
    }

    // ==========================================
    // 2. GỢI Ý LỖI VI PHẠM (DROPDOWN BẢNG LIST)
    // ==========================================
    if (ruleInput && ruleAutoList) {
      const renderRuleDropdown = (query) => {
        const matches = this.filterRulesSmart(query);
        this.currentMatchedRules = matches;

        if (matches.length === 0) {
          ruleAutoList.innerHTML = `
            <div class="p-4 text-slate-400 text-xs md:text-sm italic text-center">
              Không tìm thấy quy định phù hợp với từ khóa "${query}"
            </div>
          `;
        } else {
          ruleAutoList.innerHTML = matches.map((r, idx) => `
            <div class="rule-suggestion-item flex items-center justify-between p-3.5 hover:bg-rose-50 active:bg-rose-100 cursor-pointer border-b border-slate-100 transition select-none"
                 data-rule-index="${idx}">
              <div class="flex items-center gap-2.5 pointer-events-none">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                <span class="rule-name font-bold text-slate-800 text-sm md:text-base">${r.name}</span>
              </div>
              <span class="rule-points font-extrabold text-xs md:text-sm bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-lg pointer-events-none shrink-0">-${r.points}đ</span>
            </div>
          `).join('');
        }
        ruleAutoList.classList.remove('hidden');
        ruleAutoList.style.display = 'block';
      };

      ruleInput.addEventListener('focus', () => {
        renderRuleDropdown(ruleInput.value);
      });

      ruleInput.addEventListener('input', (e) => {
        delete ruleInput.dataset.ruleName;
        delete ruleInput.dataset.rulePoints;
        renderRuleDropdown(e.target.value);
      });

      const selectRuleByIndex = (e) => {
        const item = e.target.closest('.rule-suggestion-item');
        if (item && item.dataset.ruleIndex !== undefined) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(item.dataset.ruleIndex);
          const rule = this.currentMatchedRules[idx];
          if (rule) {
            this.selectManualRule(rule.name, rule.points);
          }
        }
      };

      ruleAutoList.addEventListener('mousedown', selectRuleByIndex);
      ruleAutoList.addEventListener('click', selectRuleByIndex);
    }

    // Đóng dropdown khi click ngoài
    document.addEventListener('click', (e) => {
      if (studentInput && autoList && !studentInput.contains(e.target) && !autoList.contains(e.target)) {
        autoList.classList.add('hidden');
        autoList.style.display = 'none';
      }
      if (ruleInput && ruleAutoList && !ruleInput.contains(e.target) && !ruleAutoList.contains(e.target)) {
        ruleAutoList.classList.add('hidden');
        ruleAutoList.style.display = 'none';
      }
    });

    // ==========================================
    // 3. THAO TÁC THÊM LỖI THỦ CÔNG
    // ==========================================
    if (btnAdd) {
      btnAdd.onclick = (e) => {
        e.preventDefault();
        this.requirePassword(() => {
          const studentVal = (studentInput ? studentInput.value : '').trim();
          let selectedRule = ruleInput ? (ruleInput.dataset.ruleName || ruleInput.value.trim()) : '';
          let points = ruleInput && ruleInput.dataset.rulePoints ? parseFloat(ruleInput.dataset.rulePoints) : NaN;

          if (!selectedRule && ruleSelect) {
            selectedRule = ruleSelect.value;
            const opt = ruleSelect.options[ruleSelect.selectedIndex];
            if (opt) points = parseFloat(opt.getAttribute('data-points')) || 0.5;
          }

          if (isNaN(points)) {
            const matched = this.rules.find(r => r.name.toLowerCase() === selectedRule.toLowerCase());
            points = matched ? matched.points : 0.5;
          }

          if (!studentVal) {
            this.showToast('Vui lòng nhập tên hoặc chọn học sinh.', 'warning');
            if (studentInput) studentInput.focus();
            return;
          }
          if (!selectedRule) {
            this.showToast('Vui lòng chọn hoặc nhập lỗi vi phạm.', 'warning');
            if (ruleInput) ruleInput.focus();
            return;
          }

          let name = studentInput ? (studentInput.dataset.studentName || '') : '';
          let className = studentInput ? (studentInput.dataset.studentClass || '') : '';

          if (!name) {
            const match = studentVal.match(/^(.*?)(?:[\s\-\–\—\(\/]+(?:[Ll][ớơo]p\s*)?([0-9]{1,2}[A-Za-z0-9]+)\)?)$/i);
            if (match) {
              name = match[1].replace(/[\s\-\–\—]*(?:[Ll][ớơo]p)?\s*$/i, '').trim();
              className = this.normalizeClassName(match[2]);
            } else {
              name = studentVal.replace(/[\s\-\–\—]*(?:[Ll][ớơo]p)?\s*$/i, '').trim();
              className = 'Chưa rõ';
            }
          }

          name = name.replace(/[\s\-\–\—]*(?:[Ll][ớơo]p)?\s*$/i, '').trim();

          const dateVal = document.getElementById('input-violation-date').value || new Date().toISOString().split('T')[0];
          const week = this.calculateWeek(dateVal);
          const now = new Date();
          const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

          this.violations.unshift({
            id: Date.now(),
            week,
            date: dateVal,
            time: timeStr,
            created_at: now.toISOString(),
            student_name: name,
            class_name: className,
            violation_category: selectedRule,
            penalty_points: points,
            original_note: 'Nhập thủ công trực tiếp'
          });

          // Ghi nhận Audit Log
          this.logAuditAction('ADD_VIOLATION', 'Thêm vi phạm', `Đã ghi nhận vi phạm: ${name} (${className}) - ${selectedRule} (-${points}đ) - Tuần ${week}`, { week, className, student: name, points });

          // Tự động đồng bộ và tính toán lại Bảng thi đua thời gian thực
          this.syncViolationWithEmulation(week, className);
          this.saveViolations(week, className);

          if (studentInput) {
            studentInput.value = '';
            delete studentInput.dataset.studentName;
            delete studentInput.dataset.studentClass;
          }
          if (ruleInput) {
            ruleInput.value = '';
            delete ruleInput.dataset.ruleName;
            delete ruleInput.dataset.rulePoints;
          }
          if (ruleSelect) ruleSelect.value = '';

          this.renderLogsTable();
          this.renderEmulationTable();
          this.showToast(`Đã ghi nhận vi phạm: ${name} - ${className}!`, 'success');
        });
      };
    }
  }

  selectManualStudent(name, className) {
    const input = document.getElementById('manual-student-input');
    const autoList = document.getElementById('autocomplete-list');
    const cleanName = (name || '').replace(/[\s\-\–\—]*(?:[Ll][ớơo]p)?\s*$/i, '').trim();
    if (input) {
      input.value = `${cleanName} - ${className}`;
      input.dataset.studentName = cleanName;
      input.dataset.studentClass = className;
    }
    if (autoList) {
      autoList.classList.add('hidden');
      autoList.style.display = 'none';
    }
  }

  selectManualRule(ruleName, points) {
    const ruleInput = document.getElementById('manual-rule-input');
    const ruleAutoList = document.getElementById('rule-autocomplete-list');
    const ruleSelect = document.getElementById('manual-rule-select');

    if (ruleInput) {
      ruleInput.value = ruleName;
      ruleInput.dataset.ruleName = ruleName;
      ruleInput.dataset.rulePoints = points;
    }
    if (ruleSelect) {
      ruleSelect.value = ruleName;
    }
    if (ruleAutoList) {
      ruleAutoList.classList.add('hidden');
      ruleAutoList.style.display = 'none';
    }
  }

  // ==================== BẢNG NHẬT KÝ VI PHẠM (TAB 2) ====================

  renderLogsTable() {
    const tbody = document.getElementById('logs-table-body');
    const emptyState = document.getElementById('logs-empty-state');
    const weekFilter = document.getElementById('log-filter-week').value;
    const classFilter = document.getElementById('log-filter-class').value;
    const searchQuery = (document.getElementById('log-filter-search').value || '').trim().toLowerCase();

    if (!tbody) return;

    let filtered = this.violations.filter(item => {
      if (weekFilter !== 'all' && String(item.week) !== String(weekFilter)) return false;
      if (classFilter !== 'all' && item.class_name !== classFilter) return false;
      if (searchQuery) {
        const full = `${item.student_name} ${item.class_name} ${item.violation_category} ${item.original_note}`.toLowerCase();
        if (!full.includes(searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    // Tự động sắp xếp theo Lớp từ A -> Z và Tên học sinh
    const sortedFiltered = this.sortViolations(filtered);

    tbody.innerHTML = sortedFiltered.map((v, idx) => {
      const isLocked = this.isWeekLocked(v.week);
      let weekBadge = `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">T${v.week}</span>`;
      
      const actionButtons = `
        <div class="flex items-center justify-center gap-1">
          <button type="button" onclick="window.app.openEditViolationModal('${v.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer" title="Sửa bản ghi vi phạm này">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="window.app.deleteViolation('${v.id}')" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Xóa bản ghi này">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;

      const gender = v.gender || this.getStudentGender(v.student_name, v.class_name);
      const genderBadge = gender === 'Nữ'
        ? `<span class="bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full text-xs font-semibold">Nữ</span>`
        : `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">Nam</span>`;

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="text-center font-bold text-slate-500">${idx + 1}</td>
          <td class="text-center">
            <span class="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded text-xs border border-slate-200">${v.class_name}</span>
          </td>
          <td class="font-bold text-slate-900">${v.student_name}</td>
          <td class="text-center">${genderBadge}</td>
          <td class="text-center font-medium text-slate-700 text-xs cursor-pointer group hover:bg-indigo-50/50 transition"
              onmouseenter="window.app.showViolationTooltip(event, '${v.id}')"
              onmousemove="window.app.moveViolationTooltip(event)"
              onmouseleave="window.app.hideViolationTooltip()"
              title="Rê chuột xem chi tiết Giờ : Phút : Giây">
            <span class="inline-flex items-center gap-1 group-hover:text-indigo-600 font-semibold transition">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500"></i>
              <span>${this.formatDate(v.date)}</span>
            </span>
          </td>
          <td class="text-center">${weekBadge}</td>
          <td class="font-semibold text-slate-800 cursor-pointer"
              onmouseenter="window.app.showViolationTooltip(event, '${v.id}')"
              onmousemove="window.app.moveViolationTooltip(event)"
              onmouseleave="window.app.hideViolationTooltip()">
            <span class="inline-flex items-center gap-1.5 hover:text-blue-600 transition group">
              <i data-lucide="info" class="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100"></i>
              <span class="group-hover:underline underline-offset-2">${v.violation_category}</span>
            </span>
          </td>
          <td class="text-center">
            <span class="text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs">-${v.penalty_points}đ</span>
          </td>
          <td class="text-slate-600 text-xs max-w-xs truncate cursor-pointer"
              title="${v.original_note || ''}"
              onmouseenter="window.app.showViolationTooltip(event, '${v.id}')"
              onmousemove="window.app.moveViolationTooltip(event)"
              onmouseleave="window.app.hideViolationTooltip()">
            ${v.original_note || '—'}
          </td>
          <td class="text-center">${actionButtons}</td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  deleteViolation(id) {
    const target = this.violations.find(v => String(v.id) === String(id));
    if (!target) {
      this.showToast('Không tìm thấy bản ghi vi phạm này!', 'error');
      return;
    }

    const targetWeek = parseInt(target.week, 10);
    const targetClass = target.class_name;
    const studentName = target.student_name || 'Học sinh';

    if (!this.isSupervisor()) {
      this.showToast('Chế độ Chỉ xem! Vui lòng đăng nhập Giám thị / Cờ đỏ hoặc Admin để xóa vi phạm.', 'warning');
      this.openPasswordModal(() => this.deleteViolation(id));
      return;
    }

    this.requirePassword(async () => {
      const confirmMsg = `Bạn có chắc chắn muốn xóa bản ghi vi phạm của học sinh "${studentName}" (Lớp ${targetClass}, Tuần ${targetWeek})?\n\nHệ thống sẽ tự động tính toán lại điểm trừ nền nếp, TB Chung, Xếp loại và Vị thứ của Lớp ${targetClass} và đồng bộ ngay lập tức lên Google Sheets!`;
      if (!confirm(confirmMsg)) return;

      // 1. Ghi nhận ID đã xóa để chống khôi phục ngoài ý muốn
      this.trackDeletedViolationId(id, targetWeek, targetClass);

      // 2. Xóa khỏi danh sách violations cục bộ
      this.violations = this.violations.filter(v => String(v.id) !== String(id));
      localStorage.setItem('dshs_violations', JSON.stringify(this.violations));

      // Ghi nhận Audit Log
      this.logAuditAction('DELETE_VIOLATION', 'Xóa vi phạm', `Đã xóa vi phạm: ${studentName} (${targetClass}) - ${target.violation_category || ''} (-${target.penalty_points || 0}đ) - Tuần ${targetWeek}`, { week: targetWeek, className: targetClass, student: studentName });

      // 3. Tự động tính toán lại điểm trừ của lớp và tuần tương ứng & cập nhật tức thì Bảng tổng hợp thi đua
      this.syncViolationWithEmulation(targetWeek, targetClass);

      // 4. Cập nhật lại giao diện ngay lập tức
      this.updateBadges();
      this.renderLogsTable();
      this.renderEmulationTable();
      this.updateCharts();

      // Nếu modal xem chi tiết vi phạm lớp đang mở, làm mới modal đó
      const viewClassModal = document.getElementById('modal-view-class-violations');
      if (viewClassModal && !viewClassModal.classList.contains('hidden')) {
        this.viewClassViolations(targetWeek, targetClass);
      }

      // 5. Phát tín hiệu thời gian thực cho TẤT CẢ các tab khác trên cùng trình duyệt (0ms)
      this.broadcastLocalChange({
        type: 'DELETE_VIOLATION',
        id: String(id),
        week: targetWeek,
        className: targetClass
      });

      // 6. GỬI LỆNH ĐỒNG BỘ NGAY LẬP TỨC LÊN GOOGLE SHEETS (CLOUD DATABASE)
      const pushSuccess = await this.pushToCloud(true, {
        sub_action: 'delete',
        deleted_id: String(id)
      });

      const remainingViols = this.violations.filter(v => parseInt(v.week, 10) === targetWeek && v.class_name === targetClass);
      const newDiemTru = remainingViols.reduce((s, v) => s + (parseFloat(v.penalty_points) || 0), 0);
      
      if (pushSuccess) {
        this.showToast(`✅ Đã xóa vi phạm và đồng bộ tức thì lên Google Sheets! Điểm trừ lớp ${targetClass} Tuần ${targetWeek} là -${newDiemTru.toFixed(1)}đ.`, 'success');
      } else {
        this.showToast(`Đã xóa vi phạm trên máy! Sẽ tự động cập nhật lên Google Sheets khi có kết nối mạng.`, 'warning');
      }
    });
  }

  openEditViolationModal(id) {
    const v = this.violations.find(item => String(item.id) === String(id));
    if (!v) {
      this.showToast('Không tìm thấy bản ghi vi phạm cần sửa!', 'error');
      return;
    }

    if (!this.isSupervisor()) {
      this.showToast('Chế độ Chỉ xem! Vui lòng đăng nhập Giám thị / Cờ đỏ hoặc Admin để sửa vi phạm.', 'warning');
      this.openPasswordModal(() => this.openEditViolationModal(id));
      return;
    }

    this.requirePassword(() => {
      const modal = document.getElementById('modal-edit-violation');
      if (!modal) return;

      const editId = document.getElementById('edit-viol-id');
      const editStudent = document.getElementById('edit-viol-student');
      const editClass = document.getElementById('edit-viol-class');
      const editGender = document.getElementById('edit-viol-gender');
      const editDate = document.getElementById('edit-viol-date');
      const editWeek = document.getElementById('edit-viol-week');
      const editCat = document.getElementById('edit-viol-category');
      const editPoints = document.getElementById('edit-viol-points');
      const editNote = document.getElementById('edit-viol-note');

      if (editId) editId.value = v.id;
      if (editStudent) editStudent.value = v.student_name || '';

      if (editClass) {
        const classes = (window.DEFAULT_CLASSES || []).map(c => c.class);
        editClass.innerHTML = classes.map(c => `<option value="${c}" ${c === v.class_name ? 'selected' : ''}>${c}</option>`).join('');
        editClass.value = v.class_name;
      }

      const currentGender = v.gender || this.getStudentGender(v.student_name, v.class_name);
      if (editGender) {
        editGender.value = currentGender;
      }

      if (editDate) {
        editDate.value = v.date || new Date().toISOString().split('T')[0];
      }

      const w = parseInt(v.week, 10) || this.calculateWeek(v.date) || this.currentWeek || 1;
      if (editWeek) {
        let optHtml = '';
        for (let i = 1; i <= 35; i++) {
          optHtml += `<option value="${i}" ${i === w ? 'selected' : ''}>Tuần ${String(i).padStart(2, '0')}</option>`;
        }
        editWeek.innerHTML = optHtml;
        editWeek.value = String(w);
      }

      if (editCat) editCat.value = v.violation_category || '';
      if (editPoints) editPoints.value = v.penalty_points !== undefined ? v.penalty_points : 0.5;
      if (editNote) editNote.value = v.original_note || '';

      // Tự động nạp gợi ý danh sách học sinh và danh mục lỗi cho modal chỉnh sửa
      const stuDatalist = document.getElementById('edit-viol-students-datalist');
      if (stuDatalist) {
        stuDatalist.innerHTML = (this.students || []).slice(0, 150).map(s => `<option value="${s.name}">Lớp ${s.class}</option>`).join('');
      }
      const ruleDatalist = document.getElementById('edit-viol-rules-datalist');
      if (ruleDatalist) {
        ruleDatalist.innerHTML = (this.rules || []).map(r => `<option value="${r.name}">-${r.points}đ</option>`).join('');
      }

      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    });
  }

  closeEditViolationModal() {
    const modal = document.getElementById('modal-edit-violation');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  handleSaveEditViolation(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('edit-viol-id').value;
    const v = this.violations.find(item => String(item.id) === String(id));
    if (!v) {
      this.showToast('Không tìm thấy bản ghi vi phạm!', 'error');
      return;
    }

    const oldWeek = parseInt(v.week, 10);
    const oldClass = v.class_name;

    const newStudent = document.getElementById('edit-viol-student').value.trim();
    const newClass = document.getElementById('edit-viol-class').value;
    const newGender = document.getElementById('edit-viol-gender').value;
    const newDate = document.getElementById('edit-viol-date').value;
    const newWeek = parseInt(document.getElementById('edit-viol-week').value, 10);
    const newCategory = document.getElementById('edit-viol-category').value.trim();
    const newPoints = Math.abs(parseFloat(document.getElementById('edit-viol-points').value) || 0);
    const newNote = document.getElementById('edit-viol-note').value.trim();

    if (!newStudent || !newClass || isNaN(newWeek)) {
      this.showToast('Vui lòng điền đầy đủ các thông tin bắt buộc!', 'error');
      return;
    }

    // Cập nhật bản ghi
    const now = new Date();
    v.student_name = newStudent;
    v.class_name = newClass;
    v.gender = newGender;
    v.date = newDate;
    v.week = newWeek;
    v.violation_category = newCategory;
    v.penalty_points = newPoints;
    v.original_note = newNote;
    v.time = v.time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    v.updated_at = now.toISOString();

    // Ghi nhận Audit Log
    this.logAuditAction('EDIT_VIOLATION', 'Sửa vi phạm', `Đã cập nhật vi phạm: ${newStudent} (${newClass}) - ${newCategory} (-${newPoints}đ) - Tuần ${newWeek}`, { week: newWeek, className: newClass, student: newStudent, points: newPoints });

    this.saveViolations();

    // Đồng bộ lại Bảng thi đua cho tuần/lớp cũ
    this.syncViolationWithEmulation(oldWeek, oldClass);

    // Nếu tuần hoặc lớp bị đổi, đồng bộ tiếp tuần/lớp mới
    if (oldWeek !== newWeek || oldClass !== newClass) {
      this.syncViolationWithEmulation(newWeek, newClass);
    }

    this.closeEditViolationModal();

    this.updateBadges();
    this.renderLogsTable();
    this.renderEmulationTable();
    this.updateCharts();

    const viewClassModal = document.getElementById('modal-view-class-violations');
    if (viewClassModal && !viewClassModal.classList.contains('hidden')) {
      this.viewClassViolations(newWeek, newClass);
    }

    // Tự động đồng bộ thời gian thực lên Cloud Database (Google Sheets)
    this.pushToCloud(false).then(ok => {
      if (ok) {
        this.showToast(`✅ Đã cập nhật vi phạm và đồng bộ trực tiếp lên Google Sheets cho lớp ${newClass} Tuần ${newWeek}!`, 'success');
      } else {
        this.showToast(`Đã cập nhật vi phạm trên thiết bị và đồng bộ điểm thi đua của lớp ${newClass} Tuần ${newWeek}!`, 'success');
      }
    }).catch(() => {
      this.showToast(`Đã cập nhật vi phạm trên thiết bị của lớp ${newClass} Tuần ${newWeek}!`, 'success');
    });
  }

  formatViolationTime(v) {
    if (!v) return '07:15:00';
    if (v.time && typeof v.time === 'string' && v.time.includes(':')) {
      const parts = v.time.split(':');
      if (parts.length >= 2) {
        const hh = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const ss = (parts[2] || '00').padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
      return v.time;
    }
    if (v.created_at) {
      const d = new Date(v.created_at);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      }
    }
    // Nếu v.id là timestamp epoch millis (như Date.now())
    const numId = typeof v.id === 'number' ? v.id : parseInt(String(v.id).split('_')[0], 10);
    if (!isNaN(numId) && numId > 1600000000000 && numId < 2500000000000) {
      const d = new Date(numId);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      }
    }
    // Dữ liệu mẫu khởi tạo: phân bố mốc giờ truy bài/đầu buổi học thực tế (07:05:00 - 07:45:00)
    const baseHour = 7;
    const seed = Math.abs(parseInt(v.id, 10) || (v.student_name ? v.student_name.length : 1));
    const baseMinute = 5 + ((seed * 7) % 40);
    const baseSec = (seed * 13) % 60;
    return `${String(baseHour).padStart(2, '0')}:${String(baseMinute).padStart(2, '0')}:${String(baseSec).padStart(2, '0')}`;
  }

  showViolationTooltip(event, id) {
    const v = this.violations.find(x => String(x.id) === String(id));
    if (!v) return;

    const popover = document.getElementById('violation-tooltip-popover');
    if (!popover) return;

    const gender = v.gender || this.getStudentGender(v.student_name, v.class_name);
    const dateFormatted = this.formatDate(v.date);
    const timeFormatted = this.formatViolationTime(v);
    const noteContent = (v.original_note && v.original_note.trim()) ? v.original_note.trim() : 'Không có ghi chú thêm.';

    popover.innerHTML = `
      <div class="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div>
            <div class="font-bold text-slate-900 text-xs">${v.student_name || 'Học sinh'}</div>
            <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span class="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">Lớp ${v.class_name}</span>
              <span>•</span>
              <span>${gender}</span>
              <span>•</span>
              <span class="font-medium text-slate-600">Tuần ${v.week}</span>
            </div>
          </div>
        </div>
        <span class="bg-rose-100 text-rose-700 font-extrabold px-2 py-0.5 rounded-full text-xs shadow-xs border border-rose-200">-${v.penalty_points}đ</span>
      </div>

      <!-- Mốc thời gian chi tiết Giờ : Phút : Giây khi rê chuột -->
      <div class="my-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/90 rounded-xl flex items-center justify-between text-[11px]">
        <div class="flex items-center gap-1.5 text-blue-950 font-bold">
          <svg class="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Thời điểm: <b class="font-extrabold text-blue-700 tracking-wide font-mono text-xs">${timeFormatted}</b></span>
        </div>
        <span class="text-slate-600 font-semibold bg-white/80 px-2 py-0.5 rounded border border-slate-200/60">${dateFormatted}</span>
      </div>

      <div class="py-1 space-y-2 text-xs">
        <div>
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Lỗi vi phạm</span>
          <p class="font-bold text-slate-800 leading-snug">${v.violation_category}</p>
        </div>
        
        <div>
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Chi tiết / Ghi chú gốc</span>
          <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-[11px] leading-relaxed break-words whitespace-pre-wrap">
            ${noteContent}
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span class="flex items-center gap-1 text-emerald-700 font-medium">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Đã lưu an toàn CSDL</span>
        </span>
        <span class="text-blue-600 font-semibold">Google Sheets</span>
      </div>
    `;

    popover.classList.remove('hidden');
    popover.style.display = 'block';
    this.moveViolationTooltip(event);
  }

  moveViolationTooltip(event) {
    const popover = document.getElementById('violation-tooltip-popover');
    if (!popover || popover.style.display === 'none') return;

    const w = 340;
    const h = 280;
    let x = event.clientX + 16;
    let y = event.clientY + 16;

    if (x + w > window.innerWidth) {
      x = event.clientX - w - 16;
    }
    if (y + h > window.innerHeight) {
      y = event.clientY - h - 16;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
  }

  hideViolationTooltip() {
    const popover = document.getElementById('violation-tooltip-popover');
    if (popover) {
      popover.classList.add('hidden');
      popover.style.display = 'none';
    }
  }

  handleEditViolDateChange(dateVal) {
    if (!dateVal) return;
    const calculatedWeek = this.calculateWeek(dateVal);
    const weekSelect = document.getElementById('edit-viol-week');
    if (weekSelect && calculatedWeek >= 1 && calculatedWeek <= 35) {
      weekSelect.value = calculatedWeek;
    }
  }

  copyLogsMarkdown() {
    const weekFilter = document.getElementById('log-filter-week').value;
    const classFilter = document.getElementById('log-filter-class').value;
    
    let list = this.violations.filter(v => {
      if (weekFilter !== 'all' && String(v.week) !== String(weekFilter)) return false;
      if (classFilter !== 'all' && v.class_name !== classFilter) return false;
      return true;
    });

    let md = `| Tuần | Ngày vi phạm | Họ tên | Lớp | Nội dung vi phạm | Điểm trừ | Ghi chú |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
    list.forEach(v => {
      md += `| ${v.week} | ${this.formatDate(v.date)} | ${v.student_name} | ${v.class_name} | ${v.violation_category} | ${v.penalty_points} | ${v.original_note || ''} |\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      this.showToast('Đã copy bảng Markdown! Bạn có thể dán trực tiếp vào Excel.', 'success');
    });
  }

  exportLogsExcel() {
    if (typeof XLSX === 'undefined') {
      this.showToast('Thư viện Excel chưa sẵn sàng.', 'error');
      return;
    }

    const weekFilter = document.getElementById('log-filter-week') ? document.getElementById('log-filter-week').value : 'all';
    const classFilter = document.getElementById('log-filter-class') ? document.getElementById('log-filter-class').value : 'all';
    const searchQuery = (document.getElementById('log-filter-search') ? document.getElementById('log-filter-search').value : '').trim().toLowerCase();

    let filtered = this.violations.filter(item => {
      if (weekFilter !== 'all' && String(item.week) !== String(weekFilter)) return false;
      if (classFilter !== 'all' && item.class_name !== classFilter) return false;
      if (searchQuery) {
        const full = `${item.student_name} ${item.class_name} ${item.violation_category} ${item.original_note}`.toLowerCase();
        if (!full.includes(searchQuery)) return false;
      }
      return true;
    });

    // Sắp xếp danh sách theo Lớp từ A -> Z và Họ tên học sinh
    const sorted = this.sortViolations(filtered);

    const data = sorted.map((v, idx) => ({
      'STT': idx + 1,
      'Lớp': v.class_name,
      'Họ và Tên': v.student_name,
      'Giới tính': v.gender || this.getStudentGender(v.student_name, v.class_name),
      'Ngày vi phạm': this.formatDate(v.date),
      'Tuần': v.week,
      'Nội dung vi phạm': v.violation_category,
      'Điểm trừ': v.penalty_points ? -Math.abs(v.penalty_points) : 0,
      'Ghi chú': v.original_note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const minWidthsLogs = {
      0: 6,   // STT
      1: 10,  // Lớp
      2: 26,  // Họ và Tên
      3: 12,  // Giới tính
      4: 16,  // Ngày vi phạm
      5: 8,   // Tuần
      6: 32,  // Nội dung vi phạm
      7: 12,  // Điểm trừ
      8: 30   // Ghi chú
    };
    ws['!cols'] = this.autoFitWorksheetColumns(ws, minWidthsLogs, 3);

    const wb = XLSX.utils.book_new();
    const sheetTitle = weekFilter !== 'all' ? `ViPham_T${weekFilter}` : 'DS_ViPham_Lop_A-Z';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    const fileName = `DS_HocSinh_ViPham_Lop_AZ_${weekFilter !== 'all' ? 'Tuan_' + weekFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.showToast(`Đã tải xuống file Excel ${fileName} (sắp xếp Lớp A -> Z)!`, 'success');
  }

  // ==================== BẢNG XẾP HẠNG & THI ĐUA (TAB 3 - CHUẨN TRANG TÍNH) ====================

  calculateWeeklyEmulationRankings(weekNum) {
    const w = parseInt(weekNum, 10);
    const weekData = this.emulationWeeks[w] || this.createDefaultWeekData(w);
    const isLocked = this.isWeekLocked(w);
    const classes = window.DEFAULT_CLASSES || [];

    const results = [];

    classes.forEach(c => {
      const cName = c.class;
      const existing = (weekData.classes && weekData.classes[cName]) ? weekData.classes[cName] : null;

      const stt = existing ? existing.stt : c.stt;
      const gvcn = existing ? existing.gvcn : c.gvcn;
      const shl = existing ? (parseFloat(existing.shl) || 0) : 0;
      const tot = existing ? (parseInt(existing.tot, 10) || 0) : 0;
      const gioA = existing ? (parseInt(existing.gioA, 10) || 0) : (isLocked ? 0 : 27);
      const gioB = existing ? (parseInt(existing.gioB, 10) || 0) : 0;
      const gioC = existing ? (parseInt(existing.gioC, 10) || 0) : 0;
      const gioD = existing ? (parseInt(existing.gioD, 10) || 0) : 0;
      const diem15 = existing ? (parseFloat(existing.diem15) || 10.0) : 10.0;
      const hsVang = existing ? (parseInt(existing.hsVang, 10) || 0) : 0;
      const bonus = this.getBonusPoints(w, cName);

      // 1. Tính tổng tiết & Điểm TB học tập theo công thức chuẩn:
      // (Tốt*15 + A*10 + B*5 + C*0 + D*-5) / Tổng tiết
      const tongTiet = tot + gioA + gioB + gioC + gioD;
      let diemTbHocTap = 10.0;
      if (tongTiet > 0) {
        diemTbHocTap = ((tot * 15) + (gioA * 10) + (gioB * 5) + (gioC * 0) + (gioD * -5)) / tongTiet;
      }

      // 2. Điểm trừ nền nếp:
      // Tự động liên kết và tính toán trực tiếp từ dữ liệu học sinh vi phạm ghi nhận trên hệ thống web
      let diemTru = 0.0;
      const violationDetails = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === cName);

      if (isLocked && existing && existing.diemTru !== undefined && !existing._forceSyncFromViolations) {
        // Tuần đang khóa niêm phong: giữ nguyên điểm chốt trừ khi được mở khóa/đồng bộ
        diemTru = parseFloat(existing.diemTru) || 0.0;
      } else {
        // Tuần đang mở hoặc đã mở khóa
        if (violationDetails.length > 0) {
          diemTru = violationDetails.reduce((sum, v) => sum + (parseFloat(v.penalty_points !== undefined ? v.penalty_points : (v.points_deducted !== undefined ? v.points_deducted : v.points)) || 0), 0);
        } else if (existing && (existing._forceSyncFromViolations || existing._manuallyResetDiemTru || w >= 7)) {
          // Lớp đã được đồng bộ / xóa hết vi phạm / hoặc từ Tuần 7 trở đi: điểm trừ chính xác là 0.0
          diemTru = 0.0;
        } else if (existing && existing.diemTru !== undefined && !this.classHasDeletedViolations(w, cName)) {
          // Chỉ giữ lại điểm trừ cũ nếu là dữ liệu tĩnh lịch sử (Tuần 1-6) và chưa từng bị xóa vi phạm
          diemTru = parseFloat(existing.diemTru) || 0.0;
        } else {
          diemTru = 0.0;
        }
      }

      // 3. Điểm TB Nền nếp = 15' - Điểm trừ
      const tbNenNep = diem15 - diemTru;

      // 4. Điểm TB Chung = ((Điểm TB học tập + TB nền nếp) / 2) + Điểm cộng vào TB
      const tbChung = ((diemTbHocTap + tbNenNep) / 2) + bonus;

      // 5. Xếp loại theo cấu trúc chuẩn công thức Excel mẫu nhà trường:
      // >= 10.0: X sắc | >= 9.0: Giỏi | >= 7.5: Khá | >= 6.5: T.bình | >= 5.0: Yếu | < 5.0: Kém
      let xepLoai = 'Kém';
      if (tbChung >= 10.0) xepLoai = 'X sắc';
      else if (tbChung >= 9.0) xepLoai = 'Giỏi';
      else if (tbChung >= 7.5) xepLoai = 'Khá';
      else if (tbChung >= 6.5) xepLoai = 'T.bình';
      else if (tbChung >= 5.0) xepLoai = 'Yếu';
      else xepLoai = 'Kém';

      results.push({
        stt,
        className: cName,
        gvcn,
        shl,
        tot,
        gioA,
        gioB,
        gioC,
        gioD,
        tongTiet,
        diemTbHocTap: Math.round(diemTbHocTap * 1000) / 1000,
        diem15,
        diemTru: Math.round(diemTru * 10) / 10,
        tbNenNep: Math.round(tbNenNep * 100) / 100,
        hsVang,
        bonus: Math.round(bonus * 10) / 10,
        tbChung: Math.round(tbChung * 1000) / 1000,
        xepLoai,
        violationDetails,
        _forceSyncFromViolations: (existing && existing._forceSyncFromViolations) || (w >= 7) || false,
        _manuallyResetDiemTru: (existing && existing._manuallyResetDiemTru) || false,
        viThuHocTap: 1,
        viThuNenNep: 1,
        viThuVang: 1,
        viThuChung: 1
      });
    });

    // ==========================================
    // CƠ CHẾ XẾP HẠNG (RANK) CHUẨN RANK() EXCEL
    // Nếu điểm bằng nhau -> Xếp đồng hạng
    // Lớp kế tiếp nhảy bậc đúng theo số lượng thực tế (Ví dụ: 3 lớp đồng hạng 1 thì lớp tiếp theo là hạng 4)
    // ==========================================

    // A. Vị thứ học tập
    const sortedHT = [...results].sort((a, b) => b.diemTbHocTap - a.diemTbHocTap);
    for (let i = 0; i < sortedHT.length; i++) {
      const match = results.find(x => x.className === sortedHT[i].className);
      if (!match) continue;
      if (i === 0) {
        match.viThuHocTap = 1;
      } else {
        const prev = sortedHT[i - 1];
        if (Math.abs(sortedHT[i].diemTbHocTap - prev.diemTbHocTap) < 0.0001) {
          const prevMatch = results.find(x => x.className === prev.className);
          match.viThuHocTap = prevMatch ? prevMatch.viThuHocTap : 1;
        } else {
          match.viThuHocTap = i + 1;
        }
      }
    }

    // B. Vị thứ nền nếp
    const sortedNN = [...results].sort((a, b) => b.tbNenNep - a.tbNenNep);
    for (let i = 0; i < sortedNN.length; i++) {
      const match = results.find(x => x.className === sortedNN[i].className);
      if (!match) continue;
      if (i === 0) {
        match.viThuNenNep = 1;
      } else {
        const prev = sortedNN[i - 1];
        if (Math.abs(sortedNN[i].tbNenNep - prev.tbNenNep) < 0.0001) {
          const prevMatch = results.find(x => x.className === prev.className);
          match.viThuNenNep = prevMatch ? prevMatch.viThuNenNep : 1;
        } else {
          match.viThuNenNep = i + 1;
        }
      }
    }

    // C. Vị thứ vắng (ít hơn xếp trên)
    const sortedVang = [...results].sort((a, b) => a.hsVang - b.hsVang);
    for (let i = 0; i < sortedVang.length; i++) {
      const match = results.find(x => x.className === sortedVang[i].className);
      if (!match) continue;
      if (i === 0) {
        match.viThuVang = 1;
      } else {
        const prev = sortedVang[i - 1];
        if (sortedVang[i].hsVang === prev.hsVang) {
          const prevMatch = results.find(x => x.className === prev.className);
          match.viThuVang = prevMatch ? prevMatch.viThuVang : 1;
        } else {
          match.viThuVang = i + 1;
        }
      }
    }

    // D. Vị thứ chung cuộc (Dựa trên TB Chung, chuẩn Standard Competition Rank)
    const sortedChung = [...results].sort((a, b) => b.tbChung - a.tbChung);
    for (let i = 0; i < sortedChung.length; i++) {
      const match = results.find(x => x.className === sortedChung[i].className);
      if (!match) continue;
      if (i === 0) {
        match.viThuChung = 1;
      } else {
        const prev = sortedChung[i - 1];
        // So sánh điểm làm tròn tới 3 chữ số thập phân
        if (Math.abs(sortedChung[i].tbChung - prev.tbChung) < 0.0001) {
          const prevMatch = results.find(x => x.className === prev.className);
          match.viThuChung = prevMatch ? prevMatch.viThuChung : 1;
        } else {
          match.viThuChung = i + 1;
        }
      }
    }

    // Đồng bộ lại vào this.emulationWeeks
    if (!this.emulationWeeks[w]) {
      this.emulationWeeks[w] = {
        week: w,
        locked: isLocked,
        dateTitle: this.getWeekDateRange(w),
        classes: {}
      };
    }
    results.forEach(r => {
      this.emulationWeeks[w].classes[r.className] = {
        stt: r.stt,
        className: r.className,
        gvcn: r.gvcn,
        shl: r.shl,
        tot: r.tot,
        gioA: r.gioA,
        gioB: r.gioB,
        gioC: r.gioC,
        gioD: r.gioD,
        tongTiet: r.tongTiet,
        diemTbHocTap: r.diemTbHocTap,
        viThuHocTap: r.viThuHocTap,
        diem15: r.diem15,
        diemTru: r.diemTru,
        tbNenNep: r.tbNenNep,
        viThuNenNep: r.viThuNenNep,
        hsVang: r.hsVang,
        viThuVang: r.viThuVang,
        bonus: r.bonus,
        tbChung: r.tbChung,
        xepLoai: r.xepLoai,
        viThuChung: r.viThuChung,
        _forceSyncFromViolations: r._forceSyncFromViolations || false,
        _manuallyResetDiemTru: r._manuallyResetDiemTru || false
      };
    });

    // Sắp xếp danh sách trả về theo thứ tự STT lớp để hiển thị đúng mẫu
    return results.sort((a, b) => a.stt - b.stt);
  }

  calculateEmulationData(selectedWeek) {
    const w = selectedWeek === 'all' ? this.currentWeek : parseInt(selectedWeek, 10);
    const ranked = this.calculateWeeklyEmulationRankings(w);
    return ranked.map(r => ({
      className: r.className,
      totalErrors: r.violationDetails ? r.violationDetails.length : 0,
      totalPenalty: r.diemTru,
      rank: r.viThuChung,
      status: r.xepLoai,
      score: r.tbChung
    }));
  }

  renderEmulationTable() {
    const tbody = document.getElementById('emulation-table-body');
    const emuSelect = document.getElementById('emulation-select-week');
    if (!tbody || !emuSelect) return;

    const selectedWeek = parseInt(emuSelect.value, 10) || this.currentWeek;
    const isLocked = this.isWeekLocked(selectedWeek);
    const dateRange = this.getWeekDateRange(selectedWeek);
    const isAuth = this.isDataEntryUnlocked();
    const canEdit = isAuth && !isLocked;

    // 1. Cập nhật Banner Chế độ Bảo mật (Chỉ xem) vs Quyền Admin vs Giám thị / Cờ đỏ
    const readonlyBanner = document.getElementById('emulation-readonly-banner');
    const isAdmin = this.isAdmin();
    const isSupervisor = this.isSupervisor();

    if (readonlyBanner) {
      if (!isSupervisor) {
        readonlyBanner.innerHTML = `
          <div class="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center flex-shrink-0 font-bold">
                <i data-lucide="shield-alert" class="w-4 h-4"></i>
              </div>
              <div>
                <p class="font-extrabold text-amber-950 text-xs sm:text-sm">Chế độ Bảo mật: CẤP ĐỘ 1 - CHỈ XEM (Khách / Người xem)</p>
                <p class="text-[11px] text-amber-800 mt-0.5">Thầy/cô và phụ huynh có quyền xem bảng tổng hợp thi đua, xem báo cáo, xem danh sách học sinh vi phạm và xem danh sách học sinh toàn trường. Các tính năng chỉnh sửa đều bị khóa an toàn.</p>
              </div>
            </div>
            <button type="button" onclick="window.app.openPasswordModal()" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex-shrink-0 flex items-center justify-center gap-1.5 shadow-xs">
              <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
              <span>Đăng nhập</span>
            </button>
          </div>
        `;
      } else if (isAdmin) {
        readonlyBanner.innerHTML = `
          <div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-emerald-950 shadow-xs">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-emerald-200/80 text-emerald-800 flex items-center justify-center flex-shrink-0 font-bold">
                <i data-lucide="shield-check" class="w-4 h-4"></i>
              </div>
              <div>
                <p class="font-extrabold text-emerald-950">CẤP ĐỘ 3 - QUẢN TRỊ ADMIN CẤP CAO ĐANG KÍCH HOẠT</p>
                <p class="text-[11px] text-emerald-800">Toàn quyền hệ thống: Mở/khóa các tuần từ 1 đến 6, Quản lý danh mục lỗi, Quản lý học sinh, Sao lưu dữ liệu và toàn bộ quyền của Giám thị.</p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button type="button" onclick="window.app.adminUnlockAllWeeks()" class="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs" title="Mở khóa tất cả các tuần 1 đến 6">
                <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                <span>Mở Khóa Toàn Bộ Tuần</span>
              </button>
              <button type="button" onclick="window.app.handleAuthButtonClick()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs">
                Đăng xuất
              </button>
            </div>
          </div>
        `;
      } else {
        readonlyBanner.innerHTML = `
          <div class="p-3 bg-indigo-50 border border-indigo-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-indigo-950 shadow-xs">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-indigo-200/80 text-indigo-800 flex items-center justify-center flex-shrink-0 font-bold">
                <i data-lucide="flag" class="w-4 h-4"></i>
              </div>
              <div>
                <p class="font-extrabold text-indigo-950">CẤP ĐỘ 2 - GIÁM THỊ / ĐỘI CỜ ĐỎ ĐANG HOẠT ĐỘNG</p>
                <p class="text-[11px] text-indigo-800">Thầy/cô có quyền: Thêm danh sách học sinh, thêm/bớt/sửa các lỗi vi phạm trong phần Nhật ký vi phạm và điều chỉnh Danh mục lỗi & điểm. Mọi thay đổi tự động đồng bộ thời gian thực qua bảng thi đua.</p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button type="button" onclick="window.app.requireAdmin(() => {})" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs" title="Nhập mật khẩu Admin để mở khóa các tính năng cấp cao">
                <i data-lucide="key" class="w-3.5 h-3.5"></i>
                <span>Nâng Quyền Admin</span>
              </button>
              <button type="button" onclick="window.app.handleAuthButtonClick()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs">
                Đăng xuất
              </button>
            </div>
          </div>
        `;
      }
    }

    // 2. Cập nhật Badge Trạng Thái Khóa Tuần & Nút Mở Khóa / Khóa Tuần
    const statusBadge = document.getElementById('emulation-week-status-badge');
    const btnToggleLock = document.getElementById('btn-toggle-week-lock');

    if (statusBadge) {
      if (isLocked) {
        statusBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-amber-50 text-amber-800 border-amber-300';
        statusBadge.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-amber-600"></i><span>🔒 Tuần đã khóa niêm phong</span>`;
      } else {
        statusBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-300';
        statusBadge.innerHTML = `<i data-lucide="unlock" class="w-3.5 h-3.5 text-emerald-600"></i><span>🔓 Tuần đang mở</span>`;
      }
    }

    if (btnToggleLock) {
      if (isLocked) {
        btnToggleLock.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer border border-amber-600';
        btnToggleLock.innerHTML = `<i data-lucide="unlock" class="w-3.5 h-3.5"></i><span>Mở Khóa Tuần (Admin)</span>`;
        btnToggleLock.title = 'Quyền Admin: Mở khóa tuần này để chỉnh sửa dữ liệu';
      } else {
        btnToggleLock.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-800 text-slate-100 transition shadow-xs cursor-pointer border border-slate-600';
        btnToggleLock.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5"></i><span>Khóa Tuần Này</span>`;
        btnToggleLock.title = 'Khóa niêm phong an toàn tuần này sau khi hoàn tất';
      }
      btnToggleLock.onclick = () => this.handleToggleCurrentWeekLock();
    }

    // 3. Bật/Tắt các nút thao tác theo trạng thái khóa & quyền Admin
    const btnAddBonus = document.getElementById('btn-add-bonus-point');
    const btnImport = document.getElementById('btn-open-excel-import');
    const btnSaveTable = document.getElementById('btn-save-emulation-table');
    
    if (btnAddBonus) {
      if (!isAuth) {
        btnAddBonus.disabled = false;
        btnAddBonus.className = 'flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-lg transition shadow-xs cursor-pointer border border-slate-300';
        btnAddBonus.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-amber-500"></i><span>+ Điểm Cộng TB (Cần Đăng Nhập)</span>`;
        btnAddBonus.onclick = () => this.requirePassword(() => this.openBonusModal());
      } else if (isLocked) {
        btnAddBonus.disabled = true;
        btnAddBonus.className = 'flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed border border-slate-200';
        btnAddBonus.innerHTML = `<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i><span>+ Điểm Cộng TB</span>`;
        btnAddBonus.onclick = null;
      } else {
        btnAddBonus.disabled = false;
        btnAddBonus.className = 'flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition shadow-xs cursor-pointer';
        btnAddBonus.innerHTML = `<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i><span>+ Điểm Cộng TB</span>`;
        btnAddBonus.onclick = () => this.openBonusModal();
      }
    }

    if (btnImport) {
      if (!isAuth) {
        btnImport.disabled = false;
        btnImport.className = 'flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-lg transition shadow-xs cursor-pointer border border-slate-300';
        btnImport.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-amber-500"></i><span>📥 Import Excel (Cần Đăng Nhập)</span>`;
        btnImport.onclick = () => this.requirePassword(() => this.openExcelImportModal());
      } else if (isLocked) {
        btnImport.disabled = true;
        btnImport.className = 'flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed border border-slate-200';
        btnImport.innerHTML = `<i data-lucide="upload" class="w-3.5 h-3.5"></i><span>📥 Import Excel Tuần</span>`;
        btnImport.onclick = null;
      } else {
        btnImport.disabled = false;
        btnImport.className = 'flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer';
        btnImport.innerHTML = `<i data-lucide="upload" class="w-3.5 h-3.5"></i><span>📥 Import Excel Tuần</span>`;
        btnImport.onclick = () => this.openExcelImportModal();
      }
    }

    if (btnSaveTable) {
      if (!isAuth) {
        btnSaveTable.disabled = false;
        btnSaveTable.className = 'flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-lg transition shadow-xs cursor-pointer border border-slate-300';
        btnSaveTable.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-amber-500"></i><span>Lưu Bảng (Cần Đăng Nhập)</span>`;
        btnSaveTable.onclick = () => this.requirePassword(() => this.handleSaveEmulationTable());
      } else if (isLocked) {
        btnSaveTable.disabled = true;
        btnSaveTable.className = 'flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed border border-slate-200';
        btnSaveTable.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>Lưu Bảng</span>`;
        btnSaveTable.onclick = null;
      } else {
        btnSaveTable.disabled = false;
        btnSaveTable.className = 'flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer';
        btnSaveTable.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>Lưu Bảng</span>`;
        btnSaveTable.onclick = () => this.handleSaveEmulationTable();
      }
    }

    // 4. Cập nhật Banner Tiêu đề
    const bannerTitle = document.getElementById('emulation-banner-title');
    const bannerDates = document.getElementById('emulation-banner-dates');
    if (bannerTitle) bannerTitle.textContent = `TỔNG HỢP THI ĐUA TUẦN ${String(selectedWeek).padStart(2, '0')}`;
    if (bannerDates) bannerDates.textContent = dateRange;

    // 5. Tính toán kết quả cho 29 lớp
    const ranked = this.calculateWeeklyEmulationRankings(selectedWeek);

    // 6. Render từng dòng trong tbody (Chuẩn 21 cột truyền thống - ẨN CỘT ĐIỂM CỘNG RIÊNG)
    tbody.innerHTML = ranked.map(r => {
      let rankBadge = `<span class="font-extrabold text-slate-700">${r.viThuChung}</span>`;
      if (r.viThuChung === 1) rankBadge = `<span class="rank-1 px-2 py-0.5 rounded-full font-extrabold text-[11px] shadow-xs">🥇 1</span>`;
      else if (r.viThuChung === 2) rankBadge = `<span class="rank-2 px-2 py-0.5 rounded-full font-extrabold text-[11px] shadow-xs">🥈 2</span>`;
      else if (r.viThuChung === 3) rankBadge = `<span class="rank-3 px-2 py-0.5 rounded-full font-extrabold text-[11px] shadow-xs">🥉 3</span>`;

      let xepLoaiClass = 'bg-slate-100 text-slate-700 border-slate-300';
      if (r.xepLoai === 'X sắc') xepLoaiClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold';
      else if (r.xepLoai === 'Giỏi') xepLoaiClass = 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
      else if (r.xepLoai === 'Khá') xepLoaiClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      else if (r.xepLoai === 'T.bình') xepLoaiClass = 'bg-rose-100 text-rose-900 border-rose-300 font-semibold';

      const diemTruBadge = `
        <button type="button" onclick="window.app.viewClassViolations(${selectedWeek}, '${r.className}')" 
                class="px-2 py-0.5 rounded font-extrabold text-xs cursor-pointer transition ${r.diemTru > 0 ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}"
                title="Bấm để xem chi tiết học sinh vi phạm của lớp ${r.className}">
          -${r.diemTru.toFixed(1)}đ
        </button>
      `;

      let actionCol = '';
      if (!isAuth) {
        actionCol = `
          <button type="button" onclick="window.app.requirePassword(() => window.app.openEditClassModal(${selectedWeek}, '${r.className}'))"
                  class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  title="Cần đăng nhập Admin để sửa">
            <i data-lucide="lock" class="w-3 h-3 text-amber-500"></i>
            <span>Chỉ xem</span>
          </button>
        `;
      } else if (isLocked) {
        actionCol = `
          <button type="button" onclick="window.app.adminUnlockSpecificWeek(${selectedWeek})"
                  class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  title="Tuần đã khóa. Bấm để mở khóa tuần này">
            <i data-lucide="lock" class="w-3 h-3"></i>
            <span>Mở tuần</span>
          </button>
        `;
      } else {
        actionCol = `
          <button type="button" onclick="window.app.openEditClassModal(${selectedWeek}, '${r.className}')"
                  class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  title="Sửa nhanh thông tin lớp ${r.className}">
            <i data-lucide="edit-2" class="w-3 h-3"></i>
            <span>Sửa</span>
          </button>
        `;
      }

      const renderCell = (field, val, step = '1') => {
        if (!canEdit) {
          return `<span class="font-semibold text-slate-800">${val}</span>`;
        }
        return `
          <input type="number" step="${step}" min="0" value="${val}"
                 data-class="${r.className}" data-field="${field}"
                 onchange="window.app.handleInlineEmulationChange(${selectedWeek}, '${r.className}', '${field}', this.value)"
                 class="table-num-input">
        `;
      };

      return `
        <tr class="hover:bg-slate-50/80 transition border-b border-slate-100 text-slate-800">
          <td class="text-center font-bold text-slate-500">${r.stt}</td>
          <td class="text-center font-extrabold text-slate-900 bg-slate-50/60">${r.className}</td>
          <td class="font-medium text-slate-700 text-xs truncate max-w-[150px]" title="${r.gvcn}">${r.gvcn}</td>
          
          <td class="text-center bg-blue-50/30 border-x border-blue-100">
            ${renderCell('shl', r.shl, '0.5')}
          </td>

          <td class="text-center bg-indigo-50/20">${renderCell('tot', r.tot)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioA', r.gioA)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioB', r.gioB)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioC', r.gioC)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioD', r.gioD)}</td>
          <td class="text-center font-bold text-indigo-900 bg-indigo-50/40">${r.tongTiet}</td>
          <td class="text-center font-extrabold text-indigo-950 bg-indigo-50/60">${r.diemTbHocTap.toFixed(2)}</td>
          <td class="text-center font-bold text-indigo-900 bg-indigo-50/40">${r.viThuHocTap}</td>

          <td class="text-center bg-rose-50/20">${renderCell('diem15', r.diem15, '0.1')}</td>
          <td class="text-center bg-rose-50/30">${diemTruBadge}</td>
          <td class="text-center font-extrabold text-rose-950 bg-rose-50/50">${r.tbNenNep.toFixed(2)}</td>
          <td class="text-center font-bold text-rose-900 bg-rose-50/30">${r.viThuNenNep}</td>

          <td class="text-center bg-slate-50/50">${renderCell('hsVang', r.hsVang)}</td>
          <td class="text-center font-bold text-slate-700 bg-slate-50/50">${r.viThuVang}</td>

          <td class="text-center font-extrabold text-emerald-950 bg-emerald-50/50 text-sm">
            ${r.tbChung.toFixed(2)}
            ${r.bonus > 0 ? `<span class="ml-1 text-[11px] text-amber-600 font-bold" title="Đã gồm +${r.bonus}đ điểm cộng (xem ghi chú dưới bảng)">*</span>` : ''}
          </td>
          <td class="text-center bg-emerald-50/40">
            <span class="text-[11px] px-2 py-0.5 rounded-full border ${xepLoaiClass}">
              ${r.xepLoai}
            </span>
          </td>
          <td class="text-center bg-emerald-50/50">${rankBadge}</td>
          <td class="text-center">${actionCol}</td>
        </tr>
      `;
    }).join('');

    // 7. Tự động tổng hợp và hiển thị phần Ghi chú & Thống kê dưới bảng
    const notesContent = document.getElementById('emulation-notes-content');
    if (notesContent) {
      const bonusList = this.getBonusPointsList(selectedWeek);
      const weeklyNotesList = (this.weeklyNotes && this.weeklyNotes[String(selectedWeek)]) || [];

      let notesHtml = '';

      // Thống kê chuẩn đặc thù Tuần 4
      if (selectedWeek === 4) {
        notesHtml += `
          <div class="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl mb-3 text-xs text-blue-950">
            <div class="flex items-center gap-2 font-bold text-blue-900 mb-2">
              <i data-lucide="award" class="w-4 h-4 text-blue-700"></i>
              <span>THỐNG KÊ XẾP LOẠI & NỀN NẾP TUẦN 04 (LƯU TRỮ CHUẨN NĂM HỌC):</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-800">
              <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs font-medium">
                <span class="text-slate-500 block text-[10px]">Tổng học sinh vắng:</span>
                <strong class="text-sm text-blue-800">163 lượt</strong>
              </div>
              <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs font-medium">
                <span class="text-slate-500 block text-[10px]">Lớp Xuất sắc:</span>
                <strong class="text-sm text-emerald-700">6 lớp</strong>
              </div>
              <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs font-medium">
                <span class="text-slate-500 block text-[10px]">Lớp Giỏi:</span>
                <strong class="text-sm text-blue-700">20 lớp</strong>
              </div>
              <div class="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs font-medium">
                <span class="text-slate-500 block text-[10px]">Lớp Khá / Trung bình:</span>
                <strong class="text-sm text-amber-700">1 Khá | 1 T.bình</strong>
              </div>
            </div>
          </div>
        `;
      }

      if (bonusList && bonusList.length > 0) {
        notesHtml += `
          <div class="space-y-1.5">
            <p class="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <i data-lucide="gift" class="w-3.5 h-3.5 text-amber-600"></i>
              <span>Điểm cộng thi đua vào Trung Bình chung (Ghi nhận dưới bảng):</span>
            </p>
            ${bonusList.map(b => `
              <div class="flex items-start gap-2 font-medium text-slate-800 text-xs">
                <span class="text-amber-600 font-bold">•</span>
                <span><strong>Lớp ${b.className}</strong> cộng <strong>${b.points}đ</strong>, lý do: <em>${b.reason || 'thực hiện công trình tự giác'}</em>.</span>
              </div>
            `).join('')}
          </div>
        `;
      } else if (selectedWeek !== 4) {
        notesHtml += '<p class="text-slate-400 italic text-xs">Tuần này không có lớp nào được cộng điểm thưởng.</p>';
      }

      if (weeklyNotesList.length > 0 && selectedWeek !== 4) {
        notesHtml += `
          <div class="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
            ${weeklyNotesList.map(n => `
              <div class="flex items-start gap-2 font-medium text-slate-700 text-xs">
                <span class="text-blue-600 font-bold">•</span>
                <span>${n}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      notesContent.innerHTML = notesHtml;
    }

    // 8. Cập nhật các khối thống kê cuối trang
    const totalLessons = ranked.reduce((s, r) => s + r.tongTiet, 0);
    const totalTot = ranked.reduce((s, r) => s + r.tot, 0);
    const totalA = ranked.reduce((s, r) => s + r.gioA, 0);
    const totalB = ranked.reduce((s, r) => s + r.gioB, 0);
    const totalCD = ranked.reduce((s, r) => s + r.gioC + r.gioD, 0);

    const totalAbsence = ranked.reduce((s, r) => s + r.hsVang, 0);
    const avgAbsence = (totalAbsence / 29).toFixed(1);

    const countXS = ranked.filter(r => r.xepLoai === 'X sắc').length;
    const countGioi = ranked.filter(r => r.xepLoai === 'Giỏi').length;
    const countKha = ranked.filter(r => r.xepLoai === 'Khá').length;
    const countTB = ranked.filter(r => r.xepLoai === 'T.bình').length;

    const elTotalLes = document.getElementById('stat-total-lessons');
    if (elTotalLes) elTotalLes.textContent = totalLessons;
    const elTot = document.getElementById('stat-count-tot');
    if (elTot) elTot.textContent = totalTot;
    const elA = document.getElementById('stat-count-a');
    if (elA) elA.textContent = totalA;
    const elB = document.getElementById('stat-count-b');
    if (elB) elB.textContent = totalB;
    const elCD = document.getElementById('stat-count-cd');
    if (elCD) elCD.textContent = totalCD;

    const elTotalAbs = document.getElementById('stat-total-absences');
    if (elTotalAbs) elTotalAbs.textContent = totalAbsence;
    const elAvgAbs = document.getElementById('stat-avg-absences');
    if (elAvgAbs) elAvgAbs.textContent = avgAbsence;

    const elXS = document.getElementById('stat-count-xs');
    if (elXS) elXS.textContent = countXS;
    const elGioi = document.getElementById('stat-count-gioi');
    if (elGioi) elGioi.textContent = countGioi;
    const elKha = document.getElementById('stat-count-kha');
    if (elKha) elKha.textContent = countKha;
    const elTB = document.getElementById('stat-count-tb');
    if (elTB) elTB.textContent = countTB;

    // Top 3 lớp thi đua
    const sortedByRank = [...ranked].sort((a, b) => a.viThuChung - b.viThuChung);
    const top3El = document.getElementById('stat-top3-classes');
    if (top3El && sortedByRank.length >= 3) {
      const getMedal = (rank) => rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : '🎖️'));
      top3El.innerHTML = sortedByRank.slice(0, 3).map(item => `
        <div class="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>${getMedal(item.viThuChung)} Hạng ${item.viThuChung}: ${item.className} (${item.gvcn})</span>
          <span class="text-emerald-600">${item.tbChung.toFixed(2)}đ</span>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  handleInlineEmulationChange(weekNum, className, field, value) {
    if (!this.isDataEntryUnlocked()) {
      this.showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng đăng nhập Admin để chỉnh sửa!', 'warning');
      this.openPasswordModal();
      this.renderEmulationTable();
      return;
    }
    const w = parseInt(weekNum, 10);
    if (this.isWeekLocked(w)) {
      this.showToast(`Tuần ${w} đã khóa niêm phong. Hãy bấm Mở Khóa Tuần trước khi chỉnh sửa!`, 'error');
      this.renderEmulationTable();
      return;
    }

    if (!this.emulationWeeks[w]) {
      this.emulationWeeks[w] = this.createDefaultWeekData(w);
    }
    if (!this.emulationWeeks[w].classes[className]) {
      return;
    }

    const numVal = parseFloat(value) || 0;
    this.emulationWeeks[w].classes[className][field] = numVal;

    // Tính lại thứ hạng tuần và lưu
    this.calculateWeeklyEmulationRankings(w);
    this.saveEmulationWeeks(true);
    this.renderEmulationTable();
    this.updateCharts();
  }

  openEditClassModal(weekNum, className) {
    this.requirePassword(() => {
      const w = parseInt(weekNum, 10);
      if (this.isWeekLocked(w)) {
        this.showToast(`Tuần ${w} đã khóa niêm phong!`, 'error');
        return;
      }

    const weekData = this.emulationWeeks[w] || this.createDefaultWeekData(w);
    const classData = weekData.classes[className] || {};

    document.getElementById('edit-class-name').value = className;
    document.getElementById('edit-class-week').value = w;
    document.getElementById('modal-edit-class-title').textContent = `Chỉnh Sửa Dữ Liệu Thi Đua - Lớp ${className}`;
    document.getElementById('modal-edit-class-subtitle').textContent = `Tuần ${w} (${this.getWeekDateRange(w)})`;

    document.getElementById('edit-class-shl').value = classData.shl !== undefined ? classData.shl : 0;
    document.getElementById('edit-class-diem15').value = classData.diem15 !== undefined ? classData.diem15 : 10;
    document.getElementById('edit-class-tot').value = classData.tot !== undefined ? classData.tot : 0;
    document.getElementById('edit-class-gioA').value = classData.gioA !== undefined ? classData.gioA : 27;
    document.getElementById('edit-class-gioB').value = classData.gioB !== undefined ? classData.gioB : 0;
    document.getElementById('edit-class-gioC').value = classData.gioC !== undefined ? classData.gioC : 0;
    document.getElementById('edit-class-gioD').value = classData.gioD !== undefined ? classData.gioD : 0;
    document.getElementById('edit-class-hsvang').value = classData.hsVang !== undefined ? classData.hsVang : 0;
    document.getElementById('edit-class-bonus').value = this.getBonusPoints(w, className);

    document.getElementById('modal-edit-class-emulation').classList.remove('hidden');
    });
  }

  saveClassModal(e) {
    const className = document.getElementById('edit-class-name').value;
    const w = parseInt(document.getElementById('edit-class-week').value, 10);
    if (!className || isNaN(w)) return;

    if (!this.emulationWeeks[w]) {
      this.emulationWeeks[w] = this.createDefaultWeekData(w);
    }
    if (!this.emulationWeeks[w].classes[className]) {
      this.emulationWeeks[w].classes[className] = {};
    }

    const c = this.emulationWeeks[w].classes[className];
    c.shl = parseFloat(document.getElementById('edit-class-shl').value) || 0;
    c.diem15 = parseFloat(document.getElementById('edit-class-diem15').value) || 10;
    c.tot = parseInt(document.getElementById('edit-class-tot').value, 10) || 0;
    c.gioA = parseInt(document.getElementById('edit-class-gioA').value, 10) || 0;
    c.gioB = parseInt(document.getElementById('edit-class-gioB').value, 10) || 0;
    c.gioC = parseInt(document.getElementById('edit-class-gioC').value, 10) || 0;
    c.gioD = parseInt(document.getElementById('edit-class-gioD').value, 10) || 0;
    c.hsVang = parseInt(document.getElementById('edit-class-hsvang').value, 10) || 0;

    const bonusVal = parseFloat(document.getElementById('edit-class-bonus').value) || 0;
    if (bonusVal > 0) {
      this.bonusPoints[String(w)] = (this.bonusPoints[String(w)] || []).filter(x => x.className !== className);
      this.bonusPoints[String(w)].push({
        id: Date.now(),
        className: className,
        points: bonusVal,
        reason: 'Cập nhật từ bảng sửa lớp'
      });
      this.saveBonusPoints();
    }

    this.calculateWeeklyEmulationRankings(w);
    this.saveEmulationWeeks(false);
    this.renderEmulationTable();
    this.updateCharts();

    document.getElementById('modal-edit-class-emulation').classList.add('hidden');
    this.showToast(`Đã cập nhật dữ liệu lớp ${className}!`, 'success');
  }

  viewWeeklyViolations(targetWeek = null) {
    let w = targetWeek;
    if (!w) {
      const emuSelect = document.getElementById('emulation-select-week');
      w = emuSelect ? parseInt(emuSelect.value, 10) || this.currentWeek : this.currentWeek;
    }
    this.viewClassViolations(w, 'all');
  }

  viewClassViolations(weekNum, className) {
    const w = parseInt(weekNum, 10);
    const isAll = !className || className === 'all';
    let viols = this.violations.filter(v => parseInt(v.week, 10) === w && (isAll || v.class_name === className));
    
    // Sắp xếp tự động theo thứ tự Lớp A -> Z và Tên học sinh
    viols = this.sortViolations(viols);

    const titleEl = document.getElementById('modal-class-violations-title');
    const subTitleEl = document.getElementById('modal-class-violations-subtitle');

    if (titleEl) {
      titleEl.textContent = isAll 
        ? `Danh Sách Học Sinh Vi Phạm Toàn Trường - Tuần ${String(w).padStart(2, '0')}`
        : `Chi Tiết Vi Phạm Lớp ${className} - Tuần ${String(w).padStart(2, '0')}`;
    }
    if (subTitleEl) {
      subTitleEl.textContent = isAll
        ? `Tổng hợp toàn bộ ${viols.length} lượt vi phạm (Sắp xếp Lớp từ A -> Z: 10B01 -> 12C09)`
        : `Tìm thấy ${viols.length} vụ vi phạm được ghi nhận trong tuần (Sắp xếp khoa học theo Lớp A -> Z)`;
    }

    const totalPts = viols.reduce((s, v) => s + (parseFloat(v.penalty_points) || 0), 0);
    const totalEl = document.getElementById('modal-class-violations-total');
    if (totalEl) totalEl.textContent = `-${totalPts.toFixed(1)}đ`;

    const tbody = document.getElementById('class-violations-tbody');
    if (tbody) {
      if (viols.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Không có vi phạm nào trong tuần được chọn.</td></tr>`;
      } else {
        const isAuth = this.isDataEntryUnlocked();
        const canAction = isAuth;

        tbody.innerHTML = viols.map((v, i) => {
          const gender = v.gender || this.getStudentGender(v.student_name, v.class_name);
          const genderBadge = gender === 'Nữ'
            ? `<span class="bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded text-[11px] font-semibold">Nữ</span>`
            : `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold">Nam</span>`;
          
          const actCol = `
            <div class="flex items-center justify-center gap-1">
              <button type="button" onclick="window.app.openEditViolationModal('${v.id}')" class="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer" title="Sửa vi phạm">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" onclick="window.app.deleteViolation('${v.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer" title="Xóa vi phạm">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `;

          return `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
              <td class="p-2.5 text-center font-bold text-slate-500">${i + 1}</td>
              <td class="p-2.5 text-center">
                <span class="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">${v.class_name}</span>
              </td>
              <td class="p-2.5 font-bold text-slate-900">${v.student_name}</td>
              <td class="p-2.5 text-center">${genderBadge}</td>
              <td class="p-2.5 text-center text-slate-600 text-xs cursor-pointer group hover:bg-indigo-50/50 transition"
                  onmouseenter="window.app.showViolationTooltip(event, '${v.id}')"
                  onmousemove="window.app.moveViolationTooltip(event)"
                  onmouseleave="window.app.hideViolationTooltip()"
                  title="Rê chuột xem chi tiết Giờ : Phút : Giây">
                <span class="inline-flex items-center gap-1 group-hover:text-indigo-600 font-semibold transition">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500"></i>
                  <span>${this.formatDate(v.date)}</span>
                </span>
              </td>
              <td class="p-2.5 text-slate-800 font-semibold cursor-pointer"
                  onmouseenter="window.app.showViolationTooltip(event, '${v.id}')"
                  onmousemove="window.app.moveViolationTooltip(event)"
                  onmouseleave="window.app.hideViolationTooltip()">
                <span class="inline-flex items-center gap-1.5 hover:text-blue-600 transition group">
                  <i data-lucide="info" class="w-3 h-3 text-blue-500 opacity-60 group-hover:opacity-100"></i>
                  <span class="group-hover:underline underline-offset-2">${v.violation_category}</span>
                </span>
              </td>
              <td class="p-2.5 text-center font-bold text-red-600">-${v.penalty_points}đ</td>
              <td class="p-2.5 text-center">${actCol}</td>
            </tr>
          `;
        }).join('');
      }
    }

    document.getElementById('modal-view-class-violations').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // ==================== ĐIỂM CỘNG VÀO TB (NẾU CÓ) ====================

  loadBonusPoints() {
    const saved = localStorage.getItem('dshs_bonus_points');
    let pts = {};
    if (saved) {
      try { pts = JSON.parse(saved); } catch (e) { }
    }
    if (!pts || typeof pts !== 'object') pts = {};
    if (window.DEFAULT_BONUS_POINTS) {
      Object.keys(window.DEFAULT_BONUS_POINTS).forEach(w => {
        if (!pts[w] || !Array.isArray(pts[w]) || pts[w].length === 0) {
          pts[w] = JSON.parse(JSON.stringify(window.DEFAULT_BONUS_POINTS[w]));
        }
      });
    }
    return pts;
  }

  saveBonusPoints() {
    localStorage.setItem('dshs_bonus_points', JSON.stringify(this.bonusPoints));
    this.renderBonusPointsTable();
    this.debouncedPushToCloud(true);
  }

  getBonusPoints(weekNum, className) {
    const w = String(weekNum);
    if (!this.bonusPoints[w]) return 0.0;
    const items = this.bonusPoints[w].filter(x => x.className.toUpperCase() === className.toUpperCase());
    return items.reduce((sum, item) => sum + (parseFloat(item.points) || 0), 0);
  }

  getBonusPointsList(weekNum) {
    const w = String(weekNum);
    return this.bonusPoints[w] || [];
  }

  openBonusModal(weekNum = null, preselectedClass = '') {
    this.requirePassword(() => {
      const emuSelect = document.getElementById('emulation-select-week');
      const w = weekNum !== null ? weekNum : (emuSelect ? emuSelect.value : this.currentWeek);

      if (this.isWeekLocked(w)) {
        this.showToast(`Tuần ${w} đã khóa niêm phong. Không thể thêm điểm cộng!`, 'error');
        return;
      }

      document.getElementById('modal-bonus-week-title').textContent = `Áp dụng cho Tuần ${w} (${this.getWeekDateRange(w)})`;
      if (preselectedClass) {
        document.getElementById('bonus-select-class').value = preselectedClass;
      }

      this.renderBonusPointsTable(w);
      document.getElementById('modal-bonus-points').classList.remove('hidden');
    });
  }

  openBonusModalForClass(className) {
    this.requirePassword(() => {
      const emuSelect = document.getElementById('emulation-select-week');
      const w = emuSelect ? emuSelect.value : this.currentWeek;
      this.openBonusModal(w, className);
    });
  }

  renderBonusPointsTable(weekNum = null) {
    const emuSelect = document.getElementById('emulation-select-week');
    const w = weekNum !== null ? String(weekNum) : (emuSelect ? String(emuSelect.value) : String(this.currentWeek));
    const tbody = document.getElementById('bonus-table-body');
    const countBadge = document.getElementById('bonus-count-badge');
    if (!tbody) return;

    const items = this.bonusPoints[w] || [];
    if (countBadge) countBadge.textContent = `${items.length} mục`;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400">Chưa có điểm cộng nào trong tuần ${w}</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => `
      <tr class="hover:bg-amber-50/50 border-b border-slate-100">
        <td class="p-2 font-bold text-slate-900">${item.className}</td>
        <td class="p-2 text-center font-extrabold text-amber-700">+${item.points}đ</td>
        <td class="p-2 text-slate-600">${item.reason || 'thực hiện công trình tự giác'}</td>
        <td class="p-2 text-center">
          <button type="button" onclick="window.app.removeBonusPoint(${w}, ${item.id})" class="text-slate-400 hover:text-red-600 p-1 cursor-pointer">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  addBonusPoint(weekNum, className, points, reason = '') {
    const w = String(weekNum);
    if (this.isWeekLocked(w)) {
      this.showToast(`Tuần ${w} đã khóa niêm phong!`, 'error');
      return;
    }

    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) {
      this.showToast('Bắt buộc phải nhập lý do cộng điểm!', 'warning');
      return;
    }

    if (!this.bonusPoints[w]) this.bonusPoints[w] = [];
    this.bonusPoints[w].push({
      id: Date.now() + Math.random(),
      className: className,
      points: parseFloat(points) || 0,
      reason: trimmedReason
    });

    this.saveBonusPoints();
    this.calculateWeeklyEmulationRankings(w);
    this.renderEmulationTable();
    this.updateCharts();
    this.showToast(`Đã cộng ${points}đ vào TB cho lớp ${className} (${trimmedReason})!`, 'success');
  }

  removeBonusPoint(weekNum, id) {
    const w = String(weekNum);
    if (this.isWeekLocked(w)) return;

    if (!this.bonusPoints[w]) return;
    this.bonusPoints[w] = this.bonusPoints[w].filter(x => x.id !== id);

    this.saveBonusPoints();
    this.calculateWeeklyEmulationRankings(w);
    this.renderEmulationTable();
    this.updateCharts();
    this.showToast('Đã xóa điểm cộng.', 'info');
  }

  parseBonusSyntax(weekNum, syntaxText) {
    const w = String(weekNum);
    if (!syntaxText || !syntaxText.trim()) return;

    const lines = syntaxText.split(/[;\r\n]+/);
    let count = 0;
    const classes = (window.DEFAULT_CLASSES || []).map(c => c.class);

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      for (const c of classes) {
        const regex = new RegExp('(?:^|\\s)' + c + '[:\\s\\+]+([0-9]+(?:\\.[0-9]+)?)(?:\\s*\\((.*?)\\))?', 'i');
        const match = trimmed.match(regex);
        if (match) {
          const pts = parseFloat(match[1]);
          const reason = match[2] ? match[2].trim() : 'thực hiện công trình tự giác';
          if (!isNaN(pts) && pts > 0) {
            this.addBonusPoint(w, c, pts, reason);
            count++;
          }
          break;
        }
      }
    });

    if (count > 0) {
      this.showToast(`Đã áp dụng thành công điểm cộng cho ${count} lớp!`, 'success');
    } else {
      this.showToast('Không nhận diện được cú pháp. Mẫu đúng: 10B01: 1.0 (thực hiện công trình tự giác)', 'warning');
    }
  }

  // ==================== XUẤT VÀ IMPORT FILE EXCEL THI ĐUA TUẦN ====================
  // Thiết kế khớp 100% với mẫu truyền thống "TONG HOP THI DUA 2026-2027 (3).xlsx"

  exportEmulationExcel() {
    if (typeof XLSX === 'undefined') {
      this.showToast('Thư viện XLSX chưa sẵn sàng.', 'error');
      return;
    }

    const emuSelect = document.getElementById('emulation-select-week');
    const emuWeek = emuSelect ? parseInt(emuSelect.value, 10) || this.currentWeek : this.currentWeek;
    const ranked = this.calculateWeeklyEmulationRankings(emuWeek);
    const dateRange = this.getWeekDateRange(emuWeek);
    const bonusList = this.getBonusPointsList(emuWeek);

    const wb = XLSX.utils.book_new();
    const ws = {};

    // ==========================================
    // STYLING DEFINITIONS (TIMES NEW ROMAN & THIN BORDERS)
    // ==========================================
    const FONT_NAME = 'Times New Roman';
    const borderAll = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    };

    const styleHeaderNational = {
      font: { name: FONT_NAME, sz: 11, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };
    const styleTitle = {
      font: { name: FONT_NAME, sz: 15, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };
    const styleSubtitle = {
      font: { name: FONT_NAME, sz: 11, italic: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const styleColHeader = {
      font: { name: FONT_NAME, sz: 10, bold: true },
      fill: { fgColor: { rgb: 'F2F2F2' } },
      border: borderAll,
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
    };

    const styleDataCenter = {
      font: { name: FONT_NAME, sz: 10 },
      border: borderAll,
      alignment: { vertical: 'center', horizontal: 'center' }
    };
    const styleDataCenterBold = {
      font: { name: FONT_NAME, sz: 10, bold: true },
      border: borderAll,
      alignment: { vertical: 'center', horizontal: 'center' }
    };
    const styleDataLeft = {
      font: { name: FONT_NAME, sz: 10 },
      border: borderAll,
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const styleSummaryLabel = {
      font: { name: FONT_NAME, sz: 10, bold: true },
      border: borderAll,
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const styleSummaryVal = {
      font: { name: FONT_NAME, sz: 10, bold: true },
      border: borderAll,
      alignment: { vertical: 'center', horizontal: 'center' }
    };
    const styleNoteText = {
      font: { name: FONT_NAME, sz: 10, italic: true },
      alignment: { vertical: 'center', horizontal: 'left' }
    };

    const encodeCell = (r, c) => XLSX.utils.encode_cell({ r, c });
    const setCell = (r, c, val, type = 's', formula = null, style = styleDataCenter, numFmt = null) => {
      const ref = encodeCell(r, c);
      const cell = { t: type, v: val };
      if (formula) cell.f = formula;
      if (numFmt) cell.z = numFmt;
      if (style) cell.s = style;
      ws[ref] = cell;
    };

    // 1. Quốc hiệu & Tên trường (Row 1 & Row 2)
    setCell(0, 0, 'SỞ GIÁO DỤC VÀ ĐÀO TẠO ĐĂK LĂK', 's', null, styleHeaderNational);
    setCell(1, 0, 'TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG', 's', null, styleHeaderNational);

    // 2. Tiêu đề Tuần thi đua & Mốc ngày (Row 4 & Row 5)
    setCell(3, 0, `TỔNG HỢP THI ĐUA TUẦN ${String(emuWeek).padStart(2, '0')}`, 's', null, styleTitle);
    setCell(4, 0, dateRange, 's', null, styleSubtitle);

    // 3. Header bảng Row 7 (r=6) & Row 8 (r=7) - Chuẩn 21 cột truyền thống
    for (let c = 0; c <= 20; c++) {
      setCell(6, c, '', 's', null, styleColHeader);
      setCell(7, c, '', 's', null, styleColHeader);
    }

    setCell(6, 0, 'TT', 's', null, styleColHeader);
    setCell(6, 1, 'LỚP', 's', null, styleColHeader);
    setCell(6, 2, 'GVCN', 's', null, styleColHeader);
    setCell(6, 4, 'Học tập', 's', null, styleColHeader);
    setCell(6, 12, 'Nền nếp', 's', null, styleColHeader);
    setCell(6, 16, 'HS Vắng', 's', null, styleColHeader);
    setCell(6, 18, 'Tổng hợp chung', 's', null, styleColHeader);

    setCell(7, 4, 'Tốt', 's', null, styleColHeader);
    setCell(7, 5, 'A', 's', null, styleColHeader);
    setCell(7, 6, 'B', 's', null, styleColHeader);
    setCell(7, 7, 'C', 's', null, styleColHeader);
    setCell(7, 8, 'D', 's', null, styleColHeader);
    setCell(7, 9, 'Tổng\ntiết', 's', null, styleColHeader);
    setCell(7, 10, 'Điểm\nTB', 's', null, styleColHeader);
    setCell(7, 11, 'Vị\nthứ', 's', null, styleColHeader);
    setCell(7, 12, "15'", 's', null, styleColHeader);
    setCell(7, 13, 'Điểm\ntrừ', 's', null, styleColHeader);
    setCell(7, 14, 'TB\nNN', 's', null, styleColHeader);
    setCell(7, 15, 'Vị\nthứ', 's', null, styleColHeader);
    setCell(7, 16, 'Tổng', 's', null, styleColHeader);
    setCell(7, 17, 'TT', 's', null, styleColHeader);
    setCell(7, 18, 'TB\nChung', 's', null, styleColHeader);
    setCell(7, 19, 'Xếp\nloại', 's', null, styleColHeader);
    setCell(7, 20, 'Vị\nthứ', 's', null, styleColHeader);

    // 4. Dữ liệu 29 lớp (Row 9 đến Row 37, r=8 đến r=36)
    ranked.forEach((r, idx) => {
      const rowIdx = 8 + idx;
      const rowNum = rowIdx + 1;

      // Ép kiểu tường minh tất cả các giá trị số sang Number
      const valTot = Number(r.tot) || 0;
      const valGioA = Number(r.gioA) || 0;
      const valGioB = Number(r.gioB) || 0;
      const valGioC = Number(r.gioC) || 0;
      const valGioD = Number(r.gioD) || 0;
      const valTongTiet = Number(r.tongTiet) || (valTot + valGioA + valGioB + valGioC + valGioD);
      const valDiem15 = Number(r.diem15) || 0;
      const valDiemTru = Number(r.diemTru) || 0;
      const valTbNn = Number(r.tbNenNep) !== undefined ? Number(r.tbNenNep) : (valDiem15 - valDiemTru);
      const valHsVang = Number(r.hsVang) || 0;
      const valBonus = Number(r.bonus) || 0;
      const valTbHocTap = Number(r.diemTbHocTap) !== undefined ? Number(r.diemTbHocTap) : 10;
      const valTbChung = Number(r.tbChung) !== undefined ? Number(r.tbChung) : ((valTbHocTap + valTbNn) / 2 + valBonus);

      setCell(rowIdx, 0, Number(r.stt) || (idx + 1), 'n', null, styleDataCenter, '0');
      setCell(rowIdx, 1, r.className, 's', null, styleDataCenterBold);

      // Tách GVCN thành Họ đệm (Col C) và Tên (Col D)
      const gvcnParts = (r.gvcn || '').trim().split(' ');
      const gvcnTen = gvcnParts.length > 1 ? gvcnParts.pop() : '';
      const gvcnHo = gvcnParts.join(' ');
      setCell(rowIdx, 2, gvcnHo, 's', null, styleDataLeft);
      setCell(rowIdx, 3, gvcnTen, 's', null, styleDataLeft);

      // Giờ ABCD: luôn lưu dạng số 'n' với định dạng '0;-0;""' để số 0 hiển thị trống hoặc '0', triệt tiêu hoàn toàn #VALUE!
      setCell(rowIdx, 4, valTot, 'n', null, styleDataCenter, '0;-0;""');
      setCell(rowIdx, 5, valGioA, 'n', null, styleDataCenter, '0;-0;""');
      setCell(rowIdx, 6, valGioB, 'n', null, styleDataCenter, '0;-0;""');
      setCell(rowIdx, 7, valGioC, 'n', null, styleDataCenter, '0;-0;""');
      setCell(rowIdx, 8, valGioD, 'n', null, styleDataCenter, '0;-0;""');

      // Tổng tiết & Điểm TB & Vị thứ Học tập
      setCell(rowIdx, 9, valTongTiet, 'n', `SUM(E${rowNum}:I${rowNum})`, styleDataCenterBold, '0');
      
      // Bọc hàm N() chống lỗi #VALUE! khi ô rỗng và IF tránh chia cho 0
      const tbHocTapFormula = `IF(J${rowNum}>0,((N(E${rowNum})*15)+(N(F${rowNum})*10)+(N(G${rowNum})*5)+(N(H${rowNum})*0)+(N(I${rowNum})*-5))/J${rowNum},10)`;
      setCell(rowIdx, 10, valTbHocTap, 'n', tbHocTapFormula, styleDataCenterBold, '0.000');
      setCell(rowIdx, 11, Number(r.viThuHocTap) || 1, 'n', `RANK(K${rowNum},$K$9:$K$37)`, styleDataCenterBold, '0');

      // Nền nếp (15', Điểm trừ, TB NN, Vị thứ NN)
      setCell(rowIdx, 12, valDiem15, 'n', null, styleDataCenter, '0.0');
      setCell(rowIdx, 13, valDiemTru, 'n', null, styleDataCenterBold, '0.0');
      setCell(rowIdx, 14, valTbNn, 'n', `N(M${rowNum})-N(N${rowNum})`, styleDataCenterBold, '0.00');
      setCell(rowIdx, 15, Number(r.viThuNenNep) || 1, 'n', `RANK(O${rowNum},$O$9:$O$37)`, styleDataCenterBold, '0');

      // HS Vắng & Vị thứ Vắng (bắt buộc dạng số 'n' để hàm RANK không lỗi #VALUE!)
      setCell(rowIdx, 16, valHsVang, 'n', null, styleDataCenter, '0');
      setCell(rowIdx, 17, Number(r.viThuVang) || 1, 'n', `RANK(Q${rowNum},$Q$9:$Q$37,1)`, styleDataCenter, '0');

      // TB Chung: ((Điểm TB + TB NN)/2) + Điểm cộng
      const tbChungFormula = valBonus > 0 
        ? `((N(K${rowNum})+N(O${rowNum}))/2)+${valBonus}` 
        : `((N(K${rowNum})+N(O${rowNum}))/2)`;
      setCell(rowIdx, 18, valTbChung, 'n', tbChungFormula, styleDataCenterBold, '0.000');

      // Xếp loại chuẩn cấu trúc
      const xepLoaiFormula = `IF(S${rowNum}>=10,"X sắc",IF(S${rowNum}>=9,"Giỏi",IF(S${rowNum}>=7.5,"Khá",IF(S${rowNum}>=6.5,"T.bình",IF(S${rowNum}>=5,"Yếu","Kém")))))`;
      setCell(rowIdx, 19, r.xepLoai || 'Kém', 's', xepLoaiFormula, styleDataCenterBold);

      // Vị thứ Chung cuộc
      setCell(rowIdx, 20, Number(r.viThuChung) || 1, 'n', `RANK(S${rowNum},$S$9:$S$37)`, styleDataCenterBold, '0');
    });

    // 5. Hàng Tổng giờ dạy học tập (Row 38, r=37)
    for (let c = 0; c <= 20; c++) {
      setCell(37, c, '', 's', null, styleDataCenterBold);
    }
    setCell(37, 1, 'Tổng cộng', 's', null, styleDataCenterBold);
    setCell(37, 4, ranked.reduce((s, r) => s + (Number(r.tot) || 0), 0), 'n', 'SUM(E9:E37)', styleDataCenterBold, '0');
    setCell(37, 5, ranked.reduce((s, r) => s + (Number(r.gioA) || 0), 0), 'n', 'SUM(F9:F37)', styleDataCenterBold, '0');
    setCell(37, 6, ranked.reduce((s, r) => s + (Number(r.gioB) || 0), 0), 'n', 'SUM(G9:G37)', styleDataCenterBold, '0');
    setCell(37, 7, ranked.reduce((s, r) => s + (Number(r.gioC) || 0), 0), 'n', 'SUM(H9:H37)', styleDataCenterBold, '0');
    setCell(37, 8, ranked.reduce((s, r) => s + (Number(r.gioD) || 0), 0), 'n', 'SUM(I9:I37)', styleDataCenterBold, '0');
    setCell(37, 9, ranked.reduce((s, r) => s + (Number(r.tongTiet) || 0), 0), 'n', 'SUM(J9:J37)', styleDataCenterBold, '0');

    // 6. Khối Tổng Hợp Chung & Ghi Chú Dưới Bảng (Row 39 to 47, r=38 to 46)
    setCell(38, 0, 'TỔNG HỢP CHUNG', 's', null, styleSummaryLabel);
    for (let c = 1; c <= 3; c++) setCell(38, c, '', 's', null, styleSummaryLabel);

    setCell(39, 0, 'TT', 's', null, styleColHeader);
    setCell(39, 1, 'Nội dung', 's', null, styleColHeader);
    for (let c = 2; c <= 4; c++) setCell(39, c, '', 's', null, styleColHeader);
    setCell(39, 5, 'T. số', 's', null, styleColHeader);
    setCell(39, 6, '', 's', null, styleColHeader);
    setCell(39, 8, 'Ghi chú:', 's', null, styleSummaryLabel);

    const summaryRows = [
      { tt: 1, name: 'Tổng học sinh vắng', val: ranked.reduce((s, r) => s + r.hsVang, 0), f: 'SUM(Q9:Q37)' },
      { tt: 2, name: 'Lớp xếp loại Xuất sắc', val: ranked.filter(r => r.xepLoai === 'X sắc').length, f: 'COUNTIF(T9:T37,"X sắc")' },
      { tt: 3, name: 'Lớp xếp loại Giỏi', val: ranked.filter(r => r.xepLoai === 'Giỏi').length, f: 'COUNTIF(T9:T37,"Giỏi")' },
      { tt: 4, name: 'Lớp xếp loại Khá', val: ranked.filter(r => r.xepLoai === 'Khá').length, f: 'COUNTIF(T9:T37,"Khá")' },
      { tt: 5, name: 'Lớp xếp loại Trung bình', val: ranked.filter(r => r.xepLoai === 'T.bình').length, f: 'COUNTIF(T9:T37,"T.bình")' },
      { tt: 6, name: 'Lớp xếp loại Yếu', val: ranked.filter(r => r.xepLoai === 'Yếu').length, f: 'COUNTIF(T9:T37,"Yếu")' },
      { tt: 7, name: 'Lớp xếp loại Kém', val: ranked.filter(r => r.xepLoai === 'Kém').length, f: 'COUNTIF(T9:T37,"Kém")' }
    ];

    summaryRows.forEach((row, i) => {
      const rIdx = 40 + i;
      setCell(rIdx, 0, row.tt, 'n', null, styleDataCenter, '0');
      setCell(rIdx, 1, row.name, 's', null, styleSummaryLabel);
      for (let c = 2; c <= 4; c++) setCell(rIdx, c, '', 's', null, styleSummaryLabel);
      setCell(rIdx, 5, row.val, 'n', row.f, styleSummaryVal, '0');
      setCell(rIdx, 6, '', 's', null, styleSummaryVal);
    });

    // Điền rõ ràng từng dòng Ghi chú điểm cộng vào Cột I (r=40 đến r=50)
    if (bonusList && bonusList.length > 0) {
      bonusList.forEach((b, idx) => {
        const noteRow = 40 + idx;
        if (noteRow <= 50) {
          const noteText = `Lớp ${b.className} cộng ${b.points}đ, lý do: ${b.reason || 'thực hiện công trình tự giác'}`;
          setCell(noteRow, 8, noteText, 's', null, styleNoteText);
        }
      });
    } else {
      setCell(40, 8, 'Tuần này không có điểm cộng.', 's', null, styleNoteText);
    }

    // 7. Thiết lập vùng Merges đúng 100% theo file gốc
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 20 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 20 } },
      { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } },   // TT
      { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } },   // LỚP
      { s: { r: 6, c: 2 }, e: { r: 7, c: 3 } },   // GVCN
      { s: { r: 6, c: 4 }, e: { r: 6, c: 11 } },  // Học tập
      { s: { r: 6, c: 12 }, e: { r: 6, c: 15 } }, // Nền nếp
      { s: { r: 6, c: 16 }, e: { r: 6, c: 17 } }, // HS Vắng
      { s: { r: 6, c: 18 }, e: { r: 6, c: 20 } }, // Tổng hợp chung
      { s: { r: 38, c: 0 }, e: { r: 38, c: 3 } }, // TỔNG HỢP CHUNG
      { s: { r: 39, c: 1 }, e: { r: 39, c: 4 } }, // Nội dung
      { s: { r: 39, c: 5 }, e: { r: 39, c: 6 } }, // T. số
      { s: { r: 40, c: 1 }, e: { r: 40, c: 4 } },
      { s: { r: 40, c: 5 }, e: { r: 40, c: 6 } },
      { s: { r: 41, c: 1 }, e: { r: 41, c: 4 } },
      { s: { r: 41, c: 5 }, e: { r: 41, c: 6 } },
      { s: { r: 42, c: 1 }, e: { r: 42, c: 4 } },
      { s: { r: 42, c: 5 }, e: { r: 42, c: 6 } },
      { s: { r: 43, c: 1 }, e: { r: 43, c: 4 } },
      { s: { r: 43, c: 5 }, e: { r: 43, c: 6 } },
      { s: { r: 44, c: 1 }, e: { r: 44, c: 4 } },
      { s: { r: 44, c: 5 }, e: { r: 44, c: 6 } },
      { s: { r: 45, c: 1 }, e: { r: 45, c: 4 } },
      { s: { r: 45, c: 5 }, e: { r: 45, c: 6 } },
      { s: { r: 46, c: 1 }, e: { r: 46, c: 4 } },
      { s: { r: 46, c: 5 }, e: { r: 46, c: 6 } }
    ];

    // 8. Tự động căn chỉnh độ rộng cột (Auto-Fit Column Widths) triệt tiêu hoàn toàn lỗi ######
    const minWidthsEmu = {
      0: 6,   // A: TT
      1: 10,  // B: LỚP
      2: 18,  // C: GVCN Họ
      3: 10,  // D: GVCN Tên
      4: 8,   // E: Tốt
      5: 8,   // F: A
      6: 8,   // G: B
      7: 8,   // H: C
      8: 8,   // I: D
      9: 11,  // J: Tổng tiết
      10: 12, // K: Điểm TB
      11: 8,  // L: Vị thứ
      12: 9,  // M: 15'
      13: 11, // N: Điểm trừ
      14: 11, // O: TB NN
      15: 8,  // P: Vị thứ
      16: 10, // Q: HS vắng
      17: 8,  // R: TT vắng
      18: 13, // S: TB Chung
      19: 12, // T: Xếp loại
      20: 8   // U: Vị thứ
    };
    ws['!cols'] = this.autoFitWorksheetColumns(ws, minWidthsEmu, 3);

    const maxRow = Math.max(47, 40 + (bonusList ? bonusList.length : 0));
    ws['!ref'] = `A1:U${maxRow}`;

    const sheetName = `T${emuWeek}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // ==========================================
    // SHEET 2: DANH SÁCH HỌC SINH VI PHẠM TUẦN (SẮP XẾP LỚP A -> Z)
    // ==========================================
    const weeklyViolations = this.sortViolations(
      this.violations.filter(v => parseInt(v.week, 10) === emuWeek)
    );

    const wsV = {};
    const setCellV = (r, c, v, t = 's', z = null, s = null) => {
      const cellRef = encodeCell(r, c);
      wsV[cellRef] = { v, t };
      if (z) wsV[cellRef].z = z;
      if (s) wsV[cellRef].s = s;
    };

    setCellV(0, 0, 'SỞ GIÁO DỤC VÀ ĐÀO TẠO ĐẮK LẮK', 's', null, styleSummaryLabel);
    setCellV(1, 0, 'TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG', 's', null, styleSummaryLabel);
    setCellV(3, 0, `DANH SÁCH HỌC SINH VI PHẠM NỀN NẾP TUẦN ${String(emuWeek).padStart(2, '0')}`, 's', null, styleTitle);
    setCellV(4, 0, `(${dateRange} - Dữ liệu sắp xếp thứ tự Lớp từ A -> Z)`, 's', null, styleSubtitle);

    const vHeaders = ['STT', 'Lớp', 'Họ và Tên Học Sinh', 'Giới tính', 'Ngày vi phạm', 'Lỗi vi phạm (Chuẩn quy chế)', 'Điểm trừ', 'Ghi chú gốc'];
    vHeaders.forEach((h, cIdx) => {
      setCellV(6, cIdx, h, 's', null, styleColHeader);
    });

    let vRowIdx = 7;
    if (weeklyViolations.length === 0) {
      setCellV(vRowIdx, 0, 'Trong tuần này không ghi nhận học sinh nào vi phạm nền nếp.', 's', null, styleDataCenter);
      vRowIdx++;
    } else {
      weeklyViolations.forEach((v, idx) => {
        const gender = v.gender || this.getStudentGender(v.student_name, v.class_name);
        setCellV(vRowIdx, 0, idx + 1, 'n', null, styleDataCenter);
        setCellV(vRowIdx, 1, v.class_name, 's', null, styleDataCenterBold);
        setCellV(vRowIdx, 2, v.student_name, 's', null, styleDataLeft);
        setCellV(vRowIdx, 3, gender, 's', null, styleDataCenter);
        setCellV(vRowIdx, 4, this.formatDate(v.date), 's', null, styleDataCenter);
        setCellV(vRowIdx, 5, v.violation_category, 's', null, styleDataLeft);
        setCellV(vRowIdx, 6, v.penalty_points ? -Math.abs(v.penalty_points) : 0, 'n', '0.0', styleDataCenterBold);
        setCellV(vRowIdx, 7, v.original_note || '', 's', null, styleDataLeft);
        vRowIdx++;
      });
    }

    const minWidthsV = {
      0: 6,   // STT
      1: 10,  // Lớp
      2: 26,  // Họ và Tên
      3: 12,  // Giới tính
      4: 16,  // Ngày
      5: 32,  // Lỗi vi phạm
      6: 12,  // Điểm trừ
      7: 30   // Ghi chú
    };
    wsV['!cols'] = this.autoFitWorksheetColumns(wsV, minWidthsV, 3);
    wsV['!ref'] = `A1:H${vRowIdx + 2}`;
    XLSX.utils.book_append_sheet(wb, wsV, `ViPham_T${emuWeek}`);

    const fileName = `TONG_HOP_THI_DUA_TUAN_${String(emuWeek).padStart(2, '0')}_THPT_LeHongPhong.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.showToast(`Đã xuất báo cáo trang tính ${fileName} (gồm Bảng Thi Đua & DS Vi Phạm Lớp A-Z)!`, 'success');
  }

  downloadEmulationTemplateExcel() {
    if (typeof XLSX === 'undefined') {
      this.showToast('Thư viện XLSX chưa sẵn sàng.', 'error');
      return;
    }
    const classes = window.DEFAULT_CLASSES || [];
    const rows = [
      ["MẪU NHẬP LIỆU THI ĐUA HÀNG TUẦN - TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG"],
      ["(Hướng dẫn: Điền số tiết SHL, Tốt, A, B, C, D, Điểm 15', HS Vắng và Điểm cộng rồi Import vào web)"],
      [""],
      ["TT", "Lớp", "GVCN", "SHL", "Giờ Tốt (15đ)", "Giờ A (10đ)", "Giờ B (5đ)", "Giờ C (0đ)", "Giờ D (-5đ)", "Điểm 15'", "HS Vắng", "Điểm Cộng Vào TB", "Ghi Chú"]
    ];

    classes.forEach(c => {
      rows.push([c.stt, c.class, c.gvcn, 0, 0, 27, 0, 0, 0, 10.0, 0, 0, ""]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_NhapLieu");
    XLSX.writeFile(wb, "Mau_NhapLieu_ThiDua_Tuan_THPT_LeHongPhong.xlsx");
    this.showToast('Đã tải xuống file Excel Mẫu nhập liệu thi đua tuần!', 'success');
  }

  handleExcelEmulationImport(file) {
    if (!file) return;
    const emuSelect = document.getElementById('emulation-select-week');
    const emuWeek = emuSelect ? parseInt(emuSelect.value, 10) : this.currentWeek;

    if (this.isWeekLocked(emuWeek)) {
      this.showToast(`Tuần ${emuWeek} đã được khóa niêm phong. Không thể import dữ liệu!`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!this.emulationWeeks[emuWeek]) {
          this.emulationWeeks[emuWeek] = this.createDefaultWeekData(emuWeek);
        }

        let updatedCount = 0;
        const classes = window.DEFAULT_CLASSES || [];

        rows.forEach(row => {
          if (!Array.isArray(row) || row.length < 2) return;
          // Tìm ô chứa tên lớp
          for (let i = 0; i < row.length; i++) {
            const val = String(row[i] || '').trim().toUpperCase();
            const matched = classes.find(c => c.class.toUpperCase() === val);
            if (matched) {
              const cName = matched.class;
              if (!this.emulationWeeks[emuWeek].classes[cName]) {
                this.emulationWeeks[emuWeek].classes[cName] = {};
              }
              const target = this.emulationWeeks[emuWeek].classes[cName];

              // Đọc các giá trị số từ các cột tiếp theo
              // Giả định thứ tự sau tên lớp: GVCN (text), SHL, Tốt, A, B, C, D, 15', Vắng
              const nums = [];
              for (let k = i + 1; k < row.length; k++) {
                const cellVal = parseFloat(row[k]);
                if (!isNaN(cellVal)) {
                  nums.push(cellVal);
                }
              }

              if (nums.length >= 5) {
                // Đủ dữ liệu giờ học tập
                target.shl = nums[0] || 0;
                target.tot = parseInt(nums[1], 10) || 0;
                target.gioA = parseInt(nums[2], 10) || 0;
                target.gioB = parseInt(nums[3], 10) || 0;
                target.gioC = parseInt(nums[4], 10) || 0;
                if (nums.length >= 6) target.gioD = parseInt(nums[5], 10) || 0;
                if (nums.length >= 7) target.diem15 = nums[6] || 10.0;
                if (nums.length >= 8) target.hsVang = parseInt(nums[7], 10) || 0;
                updatedCount++;
              }
              break;
            }
          }
        });

        if (updatedCount > 0) {
          this.calculateWeeklyEmulationRankings(emuWeek);
          this.saveEmulationWeeks(false);
          this.renderEmulationTable();
          this.updateCharts();
          this.showToast(`Đã import thành công số liệu cho ${updatedCount} lớp trong Tuần ${emuWeek}!`, 'success');
        } else {
          this.showToast('Không tìm thấy dòng lớp hợp lệ trong file Excel. Vui lòng dùng đúng mẫu!', 'warning');
        }
      } catch (err) {
        this.showToast('Lỗi đọc file Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  copyEmulationMarkdown() {
    const emuSelect = document.getElementById('emulation-select-week');
    const emuWeek = emuSelect ? emuSelect.value : this.currentWeek;
    const ranked = this.calculateWeeklyEmulationRankings(emuWeek);

    let md = `| Hạng | Lớp | GVCN | SHL | TB Học Tập | TB Nền Nếp | Điểm Trừ | Điểm Cộng | TB Chung | Xếp Loại |
`;
    md += `|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
`;
    ranked.forEach(r => {
      md += `| ${r.viThuChung} | ${r.className} | ${r.gvcn} | ${r.shl} | ${r.diemTbHocTap.toFixed(2)} | ${r.tbNenNep.toFixed(2)} | -${r.diemTru.toFixed(1)} | +${r.bonus} | ${r.tbChung.toFixed(2)} | ${r.xepLoai} |
`;
    });

    navigator.clipboard.writeText(md).then(() => {
      this.showToast('Đã copy Bảng Tổng Hợp Thi Đua Markdown! Dán trực tiếp vào Excel dễ dàng.', 'success');
    });
  }

  updateCharts() {
    const emuSelect = document.getElementById('emulation-select-week');
    const emuWeek = emuSelect ? emuSelect.value : this.currentWeek;
    const ranked = this.calculateWeeklyEmulationRankings(emuWeek);

    // 1. Bar Chart: Điểm TB Chung theo lớp
    const ctxBar = document.getElementById('chart-class-penalties');
    if (ctxBar && window.Chart) {
      if (this.classPenaltyChart) this.classPenaltyChart.destroy();

      const sorted = [...ranked].sort((a, b) => b.tbChung - a.tbChung);
      const chartLabels = sorted.map(r => r.className);
      const chartData = sorted.map(r => r.tbChung);

      this.classPenaltyChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [{
            label: 'Điểm TB Chung',
            data: chartData,
            backgroundColor: chartData.map(v => v >= 9.9 ? '#10b981' : (v >= 8.5 ? '#3b82f6' : (v >= 7.0 ? '#f59e0b' : '#ef4444'))),
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              min: 0,
              max: 12,
              ticks: { stepSize: 2 }
            },
            x: {
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }

    // 2. Doughnut Chart: Top lỗi vi phạm
    const ctxPie = document.getElementById('chart-top-errors');
    if (ctxPie && window.Chart) {
      if (this.topErrorsChart) this.topErrorsChart.destroy();

      const errorCounts = {};
      const relevant = this.violations.filter(v => String(v.week) === String(emuWeek));
      relevant.forEach(v => {
        errorCounts[v.violation_category] = (errorCounts[v.violation_category] || 0) + 1;
      });

      const sortedErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const pieLabels = sortedErrors.map(e => e[0]);
      const pieData = sortedErrors.map(e => e[1]);

      if (pieLabels.length === 0) {
        pieLabels.push('Không có vi phạm');
        pieData.push(1);
      }

      this.topErrorsChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: pieLabels,
          datasets: [{
            data: pieData,
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
          }
        }
      });
    }
  }

  // ==================== SAO LƯU DỰ PHÒNG & BẢO VỆ DỮ LIỆU DÀI HẠN (TAB 6) ====================

  loadSnapshots() {
    const saved = localStorage.getItem('dshs_backup_snapshots');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [];
  }

  saveSnapshots() {
    localStorage.setItem('dshs_backup_snapshots', JSON.stringify(this.snapshots));
    this.renderSnapshotsList();
    this.updateBackupStats();
  }

  updateBackupStats() {
    const elStudents = document.getElementById('backup-stat-students');
    const elViolations = document.getElementById('backup-stat-violations');
    const elSnaps = document.getElementById('backup-stat-snapshots');
    const elLastSnap = document.getElementById('backup-stat-last-snapshot');

    if (elStudents) elStudents.textContent = this.students.length;
    if (elViolations) elViolations.textContent = this.violations.length;
    if (elSnaps) elSnaps.textContent = this.snapshots.length;
    if (elLastSnap) {
      if (this.snapshots.length > 0) {
        elLastSnap.textContent = `Mới nhất: ${this.snapshots[0].name}`;
      } else {
        elLastSnap.textContent = 'Chưa có mốc thủ công';
      }
    }
  }

  renderSnapshotsList() {
    const isAuth = this.isAdmin();
    const container = document.getElementById('snapshots-list-container');
    const emptyState = document.getElementById('snapshots-empty-state');
    if (!container) return;

    if (this.snapshots.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    container.innerHTML = this.snapshots.map(s => `
      <div class="snapshot-item p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${s.name}</span>
            ${s.isAuto ? '<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold">Tự động</span>' : '<span class="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">Thủ công</span>'}
          </div>
          <p class="text-[11px] text-slate-500">${new Date(s.timestamp).toLocaleString('vi-VN')} • ${s.stats ? `${s.stats.violations} vi phạm • ${s.stats.students} HS` : ''}</p>
          ${s.desc ? `<p class="text-[11px] text-slate-600 italic">${s.desc}</p>` : ''}
        </div>

        <div class="flex items-center gap-2 shrink-0">
          ${isAuth ? `
            <button type="button" onclick="window.app.restoreSnapshot('${s.id}')"
                    class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[11px] shadow-xs cursor-pointer flex items-center gap-1">
              <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
              <span>Khôi phục</span>
            </button>
            <button type="button" onclick="window.app.deleteSnapshot('${s.id}')"
                    class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          ` : `
            <span class="text-slate-400 text-xs italic font-medium flex items-center gap-1">
              <i data-lucide="lock" class="w-3 h-3 text-amber-500"></i>
              <span>Cần Admin</span>
            </span>
          `}
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  getSnapshots() {
    return this.snapshots || [];
  }

  createSnapshot(name, desc = '', isAuto = false) {
    const snapId = 'snap_' + Date.now();
    const snapName = name || (isAuto ? `Tự động lưu ${new Date().toLocaleTimeString('vi-VN')}` : `Mốc khôi phục ${new Date().toLocaleString('vi-VN')}`);

    const newSnapshot = {
      id: snapId,
      name: snapName,
      desc: desc,
      isAuto: isAuto,
      timestamp: new Date().toISOString(),
      stats: {
        students: this.students.length,
        rules: this.rules.length,
        violations: this.violations.length,
        weeks: Object.keys(this.emulationWeeks).length
      },
      data: {
        students: JSON.parse(JSON.stringify(this.students)),
        rules: JSON.parse(JSON.stringify(this.rules)),
        violations: JSON.parse(JSON.stringify(this.violations)),
        emulationWeeks: JSON.parse(JSON.stringify(this.emulationWeeks)),
        bonusPoints: JSON.parse(JSON.stringify(this.bonusPoints)),
        lockedWeeks: JSON.parse(JSON.stringify(this.lockedWeeks))
      }
    };

    this.snapshots.unshift(newSnapshot);
    if (this.snapshots.length > 30) {
      this.snapshots = this.snapshots.slice(0, 30);
    }

    this.saveSnapshots();
    this.logAuditAction('SNAPSHOT', 'Tạo điểm khôi phục', `Đã tạo điểm khôi phục CSDL: "${snapName}"`);
    return newSnapshot;
  }

  restoreSnapshot(snapId) {
    const snap = this.snapshots.find(s => s.id === snapId);
    if (!snap) {
      this.showToast('Không tìm thấy điểm khôi phục!', 'error');
      return;
    }

    this.requirePassword(() => {
      // Tự động tạo snapshot dự phòng trước khi khôi phục
      this.createSnapshot('Tự động lưu trước khi khôi phục ' + snap.name, '', true);

      this.students = JSON.parse(JSON.stringify(snap.data.students));
      this.rules = JSON.parse(JSON.stringify(snap.data.rules));
      this.violations = JSON.parse(JSON.stringify(snap.data.violations));
      this.emulationWeeks = JSON.parse(JSON.stringify(snap.data.emulationWeeks));
      this.bonusPoints = JSON.parse(JSON.stringify(snap.data.bonusPoints));
      this.lockedWeeks = JSON.parse(JSON.stringify(snap.data.lockedWeeks || [1, 2, 3, 4, 5, 6]));

      this.saveStudents();
      this.saveRules();
      this.saveViolations();
      this.saveEmulationWeeks(true);
      this.saveBonusPoints();

      this.populateDropdowns();
      this.renderLogsTable();
      this.renderEmulationTable();
      this.renderStudentsTable();
      this.renderRulesTable();
      this.renderSnapshotsList();
      this.updateBackupStats();

      this.logAuditAction('SNAPSHOT', 'Khôi phục CSDL', `Đã khôi phục toàn bộ CSDL về mốc: "${snap.name}"`);
      this.showToast(`Đã khôi phục thành công về mốc: "${snap.name}"!`, 'success');
    });
  }

  deleteSnapshot(snapId) {
    if (!confirm('Bạn có chắc chắn muốn xóa mốc khôi phục này không?')) return;
    const snap = this.snapshots.find(s => s.id === snapId);
    const snapName = snap ? snap.name : snapId;
    this.snapshots = this.snapshots.filter(s => s.id !== snapId);
    this.saveSnapshots();
    this.logAuditAction('SNAPSHOT', 'Xóa điểm khôi phục', `Đã xóa mốc khôi phục: "${snapName}"`);
    this.showToast('Đã xóa mốc khôi phục.', 'info');
  }

  exportFullBackupJson() {
    try {
      const backupData = {
        app: "BanNenNep_THPT_So1_LeHongPhong",
        academic_year: "2026-2027",
        school_name: "Trường THPT Số 1 Lê Hồng Phong",
        version: "2.0",
        exported_at: new Date().toISOString(),
        summary: {
          total_students: this.students.length,
          total_rules: this.rules.length,
          total_violations: this.violations.length,
          total_weeks: Object.keys(this.emulationWeeks).length,
          locked_weeks: this.lockedWeeks,
          current_week: this.currentWeek
        },
        students: this.students,
        rules: this.rules,
        violations: this.violations,
        emulation_weeks: this.emulationWeeks,
        bonus_points: this.bonusPoints,
        locked_weeks: this.lockedWeeks,
        snapshots: this.snapshots.map(s => ({
          id: s.id,
          name: s.name,
          desc: s.desc,
          timestamp: s.timestamp,
          stats: s.stats
        }))
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Backup_BanNenNep_THPT_LeHongPhong_${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      this.showToast('Đã xuất file sao lưu hệ thống toàn diện (.json) thành công!', 'success');
    } catch (e) {
      this.showToast('Lỗi xuất file backup: ' + e.message, 'error');
    }
  }

  handleRestoreBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.students || !json.violations) {
          this.showToast('File JSON không đúng cấu trúc sao lưu của Ban Nền Nếp!', 'error');
          return;
        }

        this.pendingRestoreData = json;
        document.getElementById('preview-backup-filename').textContent = file.name;
        document.getElementById('preview-backup-time').textContent = json.exported_at ? new Date(json.exported_at).toLocaleString('vi-VN') : 'Không rõ';
        document.getElementById('preview-backup-students').textContent = `${(json.students || []).length} học sinh`;
        document.getElementById('preview-backup-violations').textContent = `${(json.violations || []).length} vi phạm`;
        document.getElementById('preview-backup-weeks').textContent = `${Object.keys(json.emulation_weeks || {}).length} tuần thi đua`;

        document.getElementById('input-backup-password').value = '';
        document.getElementById('backup-password-error').classList.add('hidden');
        document.getElementById('modal-backup-preview').classList.remove('hidden');
      } catch (err) {
        this.showToast('Tệp sao lưu bị lỗi định dạng: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  confirmRestoreBackup() {
    const entered = (document.getElementById('input-backup-password').value || '').trim();
    if (entered !== this.PASSWORD_ADMIN) {
      document.getElementById('backup-password-error').classList.remove('hidden');
      return;
    }

    if (!this.pendingRestoreData) return;

    this.createSnapshot('Tự động lưu trước khi phục hồi file backup', '', true);

    const json = this.pendingRestoreData;
    this.students = json.students || this.students;
    this.rules = json.rules || this.rules;
    this.violations = json.violations || this.violations;
    this.emulationWeeks = json.emulation_weeks || this.emulationWeeks;
    this.bonusPoints = json.bonus_points || this.bonusPoints;
    this.lockedWeeks = json.locked_weeks || [1, 2, 3, 4, 5, 6];

    this.saveStudents();
    this.saveRules();
    this.saveViolations();
    this.saveEmulationWeeks(true);
    this.saveBonusPoints();

    document.getElementById('modal-backup-preview').classList.add('hidden');
    this.pendingRestoreData = null;

    this.populateDropdowns();
    this.renderLogsTable();
    this.renderEmulationTable();
    this.renderStudentsTable();
    this.renderRulesTable();
    this.renderSnapshotsList();
    this.updateBackupStats();

    this.showToast('Đã khôi phục toàn bộ CSDL năm học thành công!', 'success');
  }

  exportServerSyncJson() {
    try {
      const serverData = {
        server_sync_version: "2.0",
        sync_time: new Date().toISOString(),
        school: "TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG",
        academic_year: "2026-2027",
        classes: window.DEFAULT_CLASSES || [],
        students: this.students,
        rules: this.rules,
        violations: this.violations,
        emulation_weeks: this.emulationWeeks,
        bonus_points: this.bonusPoints,
        locked_weeks: this.lockedWeeks
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(serverData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `data_server_sync.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      this.showToast('Đã tải xuống file data_server_sync.json cho Máy chủ nội bộ!', 'success');
    } catch (e) {
      this.showToast('Lỗi xuất file server: ' + e.message, 'error');
    }
  }

  // ==================== LỊCH SỬ THAO TÁC HỆ THỐNG (AUDIT LOGS - TAB 7) ====================

  loadAuditLogs() {
    try {
      const saved = localStorage.getItem('dshs_audit_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return this.getInitialAuditLogs();
  }

  getInitialAuditLogs() {
    return [
      {
        id: 'log_seed_1',
        timestamp: Date.now() - 3600000 * 2,
        time_str: '10:15:22',
        date_str: '2026-10-22',
        actor: 'Quản trị viên (Admin 2806)',
        role: 'admin',
        action_type: 'LOCK_WEEK',
        action_title: 'Khóa tuần thi đua',
        details: 'Khóa niêm phong thi đua các Tuần 01 đến Tuần 06 phục vụ tổng kết đợt 1',
        target_week: 6,
        target_class: 'Toàn trường',
        device_info: 'Windows • Chrome (Máy tính)'
      },
      {
        id: 'log_seed_2',
        timestamp: Date.now() - 3600000 * 5,
        time_str: '07:22:45',
        date_str: '2026-10-22',
        actor: 'Giám thị / Cờ đỏ (lhp38)',
        role: 'supervisor',
        action_type: 'ADD_VIOLATION',
        action_title: 'Thêm vi phạm',
        details: 'Ghi nhận vi phạm: Đoàn Nguyễn Thị Minh Vy (10B01) - Đi học muộn (-0.5đ) - Tuần 7',
        target_week: 7,
        target_class: '10B01',
        device_info: 'Android • Chrome (Di động)'
      },
      {
        id: 'log_seed_3',
        timestamp: Date.now() - 3600000 * 24,
        time_str: '14:30:10',
        date_str: '2026-10-21',
        actor: 'Quản trị viên (Admin 2806)',
        role: 'admin',
        action_type: 'SNAPSHOT',
        action_title: 'Đồng bộ Google Sheets',
        details: 'Đồng bộ thành công 97 bản ghi vi phạm lên Google Sheets Cloud Database',
        target_week: 7,
        target_class: 'Toàn trường',
        device_info: 'Windows • Chrome (Máy tính)'
      }
    ];
  }

  saveAuditLogs() {
    try {
      localStorage.setItem('dshs_audit_logs', JSON.stringify(this.auditLogs));
    } catch (e) {}
  }

  getDeviceInfo() {
    if (typeof navigator === 'undefined') return 'Không xác định';
    const ua = navigator.userAgent || '';
    let os = 'Khác';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    let browser = 'Trình duyệt';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';

    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const type = isMobile ? 'Di động' : 'Máy tính';
    return `${os} • ${browser} (${type})`;
  }

  logAuditAction(actionType, actionTitle, details, meta = {}) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = now.toISOString().split('T')[0];

    const actor = this.isAdmin() 
      ? 'Quản trị viên (Admin 2806)' 
      : (this.isSupervisor() ? 'Giám thị / Cờ đỏ (lhp38)' : 'Hệ thống');

    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      time_str: timeStr,
      date_str: dateStr,
      actor: actor,
      role: this.getUserRole() || 'guest',
      action_type: actionType,
      action_title: actionTitle,
      details: details,
      target_week: meta.week || this.currentWeek,
      target_class: meta.className || '',
      device_info: this.getDeviceInfo()
    };

    if (!this.auditLogs) this.auditLogs = [];
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveAuditLogs();

    // Đồng bộ tức thời giữa các tab qua BroadcastChannel
    this.broadcastLocalChange({
      type: 'AUDIT_LOG_ADDED',
      entry: entry
    });

    // Cập nhật giao diện Audit Logs nếu tab đang mở
    if (this.activeTab === 'tab-audit-logs') {
      this.renderAuditLogsTable();
      this.updateAuditStats();
    }
  }

  renderAuditLogsTable() {
    const tbody = document.getElementById('audit-logs-table-body');
    const emptyState = document.getElementById('audit-logs-empty-state');
    if (!tbody) return;

    const typeFilter = document.getElementById('audit-filter-type') ? document.getElementById('audit-filter-type').value : 'all';
    const actorFilter = document.getElementById('audit-filter-actor') ? document.getElementById('audit-filter-actor').value : 'all';
    const searchQuery = (document.getElementById('audit-filter-search') ? document.getElementById('audit-filter-search').value : '').trim().toLowerCase();

    let logs = this.auditLogs || [];
    let filtered = logs.filter(log => {
      if (typeFilter !== 'all' && log.action_type !== typeFilter) return false;
      if (actorFilter !== 'all' && log.role !== actorFilter) return false;
      if (searchQuery) {
        const full = `${log.action_title} ${log.details} ${log.actor} ${log.device_info} ${log.target_class || ''}`.toLowerCase();
        if (!full.includes(searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const badgeClasses = {
      ADD_VIOLATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      EDIT_VIOLATION: 'bg-blue-50 text-blue-700 border-blue-200',
      DELETE_VIOLATION: 'bg-rose-50 text-rose-700 border-rose-200',
      LOCK_WEEK: 'bg-amber-50 text-amber-700 border-amber-200',
      UNLOCK_WEEK: 'bg-purple-50 text-purple-700 border-purple-200',
      BONUS_POINT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      SNAPSHOT: 'bg-teal-50 text-teal-700 border-teal-200',
      LOGIN: 'bg-slate-100 text-slate-700 border-slate-300',
      LOGOUT: 'bg-slate-100 text-slate-500 border-slate-200'
    };

    const actionIcons = {
      ADD_VIOLATION: 'plus-circle',
      EDIT_VIOLATION: 'edit-3',
      DELETE_VIOLATION: 'trash-2',
      LOCK_WEEK: 'lock',
      UNLOCK_WEEK: 'unlock',
      BONUS_POINT: 'award',
      SNAPSHOT: 'shield-check',
      LOGIN: 'key',
      LOGOUT: 'log-out'
    };

    tbody.innerHTML = filtered.map((log, idx) => {
      const bClass = badgeClasses[log.action_type] || 'bg-slate-50 text-slate-700 border-slate-200';
      const icon = actionIcons[log.action_type] || 'activity';
      const isSuper = log.role === 'supervisor';
      const actorBadge = isSuper
        ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-bold">Giám thị (lhp38)</span>`
        : `<span class="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-bold">Admin (2806)</span>`;

      return `
        <tr class="hover:bg-purple-50/30 transition border-b border-slate-100">
          <td class="py-3 px-3 text-center font-bold text-slate-500">${idx + 1}</td>
          <td class="py-3 px-3">
            <div class="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-purple-600"></i>
              <span>${log.time_str}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">${this.formatDate(log.date_str)}</div>
          </td>
          <td class="py-3 px-3">
            <div>${actorBadge}</div>
            <div class="text-[11px] text-slate-500 font-medium mt-1">${log.actor}</div>
          </td>
          <td class="py-3 px-3 text-center">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${bClass}">
              <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
              <span>${log.action_title}</span>
            </span>
          </td>
          <td class="py-3 px-3">
            <div class="font-medium text-slate-900 leading-snug break-words">${log.details}</div>
            <div class="flex items-center gap-1.5 mt-1">
              ${log.target_class ? `<span class="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">Lớp: ${log.target_class}</span>` : ''}
              ${log.target_week ? `<span class="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">Tuần ${log.target_week}</span>` : ''}
            </div>
          </td>
          <td class="py-3 px-3 text-slate-600">
            <div class="flex items-center gap-1.5 font-medium">
              <i data-lucide="monitor" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>${log.device_info}</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  updateAuditStats() {
    const logs = this.auditLogs || [];
    const statTotal = document.getElementById('audit-stat-total');
    const statAdded = document.getElementById('audit-stat-added');
    const statModified = document.getElementById('audit-stat-modified');
    const statLocked = document.getElementById('audit-stat-locked');

    if (statTotal) statTotal.textContent = logs.length;
    if (statAdded) statAdded.textContent = logs.filter(l => l.action_type === 'ADD_VIOLATION').length;
    if (statModified) statModified.textContent = logs.filter(l => l.action_type === 'EDIT_VIOLATION' || l.action_type === 'DELETE_VIOLATION').length;
    if (statLocked) statLocked.textContent = logs.filter(l => l.action_type === 'LOCK_WEEK' || l.action_type === 'UNLOCK_WEEK').length;
  }

  exportAuditLogsExcel() {
    if (typeof XLSX === 'undefined') {
      this.showToast('Thư viện Excel chưa sẵn sàng!', 'error');
      return;
    }

    const logs = this.auditLogs || [];
    if (logs.length === 0) {
      this.showToast('Không có bản ghi lịch sử nào để xuất!', 'info');
      return;
    }

    const rows = logs.map((log, idx) => ({
      'STT': idx + 1,
      'Thời Điểm (Giờ:Phút:Giây)': log.time_str,
      'Ngày': this.formatDate(log.date_str),
      'Người Thao Tác': log.actor,
      'Vai Trò': log.role === 'admin' ? 'Quản trị viên (Admin 2806)' : 'Giám thị / Cờ đỏ (lhp38)',
      'Hành Động': log.action_title,
      'Chi Tiết Thao Tác': log.details,
      'Tuần': log.target_week || '',
      'Lớp': log.target_class || '',
      'Thiết Bị / Môi Trường': log.device_info
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LichSuThaoTac");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Lich_su_thao_tac_THPT_LHP_${today}.xlsx`);
    this.showToast('Đã xuất file Excel Lịch sử thao tác thành công!', 'success');
  }

  clearAuditLogs() {
    this.requireAdmin(() => {
      if (!confirm('Bạn có chắc chắn muốn dọn dẹp toàn bộ Lịch sử thao tác không?\n\nHành động này không thể hoàn tác!')) return;
      this.auditLogs = [];
      this.saveAuditLogs();
      this.renderAuditLogsTable();
      this.updateAuditStats();
      this.showToast('Đã làm trống lịch sử thao tác hệ thống.', 'info');
    });
  }

  // ==================== QUẢN LÝ HỌC SINH (TAB 4 - NGUỒN MỞ) ====================

  renderStudentsTable() {
    const isAuth = this.isSupervisor();
    const tbody = document.getElementById('students-table-body');
    const countSpan = document.getElementById('student-table-count');
    const searchVal = (document.getElementById('student-search-query').value || '').trim().toLowerCase();
    const classVal = document.getElementById('student-filter-class').value;

    if (!tbody) return;

    let filtered = this.students.filter(s => {
      if (classVal !== 'all' && s.class !== classVal) return false;
      if (searchVal && !s.name.toLowerCase().includes(searchVal)) return false;
      return true;
    });

    if (countSpan) countSpan.textContent = filtered.length;

    // Giới hạn hiển thị 200 bản ghi đầu tiên nếu quá nhiều để cuộn mượt mà
    const displayList = filtered.slice(0, 200);

    tbody.innerHTML = displayList.map((s, idx) => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="text-center text-slate-400 text-xs">${idx + 1}</td>
        <td class="text-center">
          <span class="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs">${s.class}</span>
        </td>
        <td class="font-semibold text-slate-900">${s.name}</td>
        <td class="text-center text-slate-600 text-xs">${s.gender || '-'}</td>
        <td class="text-center font-mono text-[11px] text-slate-400">#${s.id}</td>
        <td class="text-center">
          ${isAuth ? `
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.app.editStudent(${s.id})" class="text-slate-400 hover:text-blue-600 p-1" title="Sửa học sinh">
                <i data-lucide="edit" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.app.deleteStudent(${s.id})" class="text-slate-400 hover:text-red-600 p-1" title="Xóa học sinh">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          ` : `
            <span class="text-slate-400 text-xs italic font-medium flex items-center justify-center gap-1">
              <i data-lucide="lock" class="w-3 h-3 text-amber-500"></i>
              <span>Chỉ xem</span>
            </span>
          `}
        </td>
      </tr>
    `).join('');

    if (filtered.length > 200) {
      tbody.innerHTML += `
        <tr>
          <td colspan="6" class="text-center py-3 text-xs text-slate-400 italic bg-slate-50">
            ... Đang hiển thị 200 / ${filtered.length} học sinh. Hãy sử dụng thanh tìm kiếm hoặc lọc theo lớp để thu hẹp danh sách.
          </td>
        </tr>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openStudentModal(student = null) {
    if (!this.isSupervisor()) {
      this.openPasswordModal(() => this.openStudentModal(student));
      return;
    }
    this.editingStudentId = student ? student.id : null;
    const modal = document.getElementById('modal-student');
    const title = document.getElementById('modal-student-title');
    const classInput = document.getElementById('modal-student-class');
    const nameInput = document.getElementById('modal-student-name');
    const genderSelect = document.getElementById('modal-student-gender');

    if (student) {
      title.textContent = 'Chỉnh Sửa Thông Tin Học Sinh';
      classInput.value = student.class;
      nameInput.value = student.name;
      genderSelect.value = student.gender || 'Nam';
    } else {
      title.textContent = 'Thêm Học Sinh Mới';
      classInput.value = '';
      nameInput.value = '';
      genderSelect.value = 'Nam';
    }

    modal.classList.remove('hidden');
    nameInput.focus();
  }

  saveStudentModal() {
    const className = (document.getElementById('modal-student-class').value || '').trim().toUpperCase();
    const name = (document.getElementById('modal-student-name').value || '').trim();
    const gender = document.getElementById('modal-student-gender').value;

    if (!className || !name) {
      this.showToast('Vui lòng nhập đầy đủ Lớp và Họ tên học sinh.', 'warning');
      return;
    }

    if (this.editingStudentId) {
      const idx = this.students.findIndex(s => s.id === this.editingStudentId);
      if (idx !== -1) {
        this.students[idx].class = className;
        this.students[idx].name = name;
        this.students[idx].gender = gender;
        this.showToast('Đã cập nhật học sinh thành công!', 'success');
      }
    } else {
      const newId = this.students.length > 0 ? Math.max(...this.students.map(s => s.id || 0)) + 1 : 1;
      this.students.push({
        id: newId,
        class: className,
        name: name,
        gender: gender
      });
      this.showToast('Đã thêm học sinh mới vào danh sách!', 'success');
    }

    this.saveStudents();
    this.populateDropdowns();
    this.renderStudentsTable();
    document.getElementById('modal-student').classList.add('hidden');
  }

  editStudent(id) {
    const s = this.students.find(item => item.id === id);
    if (s) this.openStudentModal(s);
  }

  deleteStudent(id) {
    if (!this.isSupervisor()) {
      this.openPasswordModal(() => this.deleteStudent(id));
      return;
    }
    if (confirm('Bạn có chắc muốn xóa học sinh này khỏi danh sách trường?')) {
      this.students = this.students.filter(s => s.id !== id);
      this.saveStudents();
      this.populateDropdowns();
      this.renderStudentsTable();
      this.showToast('Đã xóa học sinh.', 'info');
    }
  }

  exportStudentsExcel() {
    if (typeof XLSX === 'undefined') return;
    const data = this.students.map(s => ({
      'Mã Lớp': s.class,
      'Họ và Tên': s.name,
      'Giới Tính': s.gender || '',
      'ID': s.id
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
    XLSX.writeFile(wb, `DanhSachHocSinh_THPT_LeHongPhong.xlsx`);
    this.showToast('Đã xuất danh sách học sinh ra file Excel!', 'success');
  }

  handleExcelFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Tìm sheet chứa học sinh: DMKH hoặc Sheet1 hoặc sheet đầu tiên
        let sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('DMKH') || n.toUpperCase().includes('HOC SINH')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const parsedStudents = [];
        // Duyệt các dòng tìm lớp và họ tên
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length < 2) continue;
          
          // Kiểm tra xem có cột lớp và họ tên không
          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();
          const col2 = String(row[2] || '').trim();

          // Lớp thường có dạng 10B01, 11A04, 12C03 hoặc tương tự
          if (col0.match(/^[0-9]{1,2}[A-Za-z0-9]+$/) && col1.length >= 3 && !col1.toLowerCase().includes('tên')) {
            parsedStudents.push({
              id: parsedStudents.length + 1,
              class: col0,
              name: col1,
              gender: col2.toLowerCase().includes('nam') ? 'Nam' : (col2.toLowerCase().includes('nữ') ? 'Nữ' : '')
            });
          }
        }

        if (parsedStudents.length === 0) {
          alert('Không tìm thấy dữ liệu học sinh phù hợp trong file Excel. Vui lòng kiểm tra định dạng cột (Cột 1: Lớp, Cột 2: Họ tên).');
          return;
        }

        this.importPreviewData = parsedStudents;
        document.getElementById('import-preview-count').textContent = `${parsedStudents.length} học sinh`;
        document.getElementById('import-preview-box').classList.remove('hidden');
        document.getElementById('btn-confirm-import-students').disabled = false;

      } catch (err) {
        console.error('Lỗi đọc Excel:', err);
        alert('Lỗi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  executeStudentImport() {
    if (!this.importPreviewData || this.importPreviewData.length === 0) return;

    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    if (mode === 'replace') {
      this.students = this.importPreviewData;
    } else {
      const maxId = this.students.length > 0 ? Math.max(...this.students.map(s => s.id || 0)) : 0;
      this.importPreviewData.forEach((s, i) => {
        s.id = maxId + i + 1;
        this.students.push(s);
      });
    }

    this.saveStudents();
    this.populateDropdowns();
    this.renderStudentsTable();
    document.getElementById('modal-import-students').classList.add('hidden');
    this.showToast(`Đã nạp thành công ${this.importPreviewData.length} học sinh vào hệ thống!`, 'success');
  }

  // ==================== QUẢN LÝ QUY ĐỊNH LỖI (TAB 5 - NGUỒN MỞ) ====================

  renderRulesTable() {
    const isAuth = this.isSupervisor();
    const tbody = document.getElementById('rules-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.rules.map((r, idx) => {
      let severityBadge = `<span class="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Nhẹ (-0.5đ)</span>`;
      if (r.points >= 2.0) {
        severityBadge = `<span class="bg-red-100 text-red-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Rất nặng (-${r.points}đ)</span>`;
      } else if (r.points >= 1.0) {
        severityBadge = `<span class="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">Nghiêm trọng (-${r.points}đ)</span>`;
      }

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="text-center text-slate-400 text-xs">${idx + 1}</td>
          <td class="font-bold text-slate-900">${r.name}</td>
          <td class="text-center font-bold text-red-600 bg-red-50/50">-${r.points} điểm</td>
          <td class="text-center">${severityBadge}</td>
          <td class="text-center">
            ${isAuth ? `
              <div class="flex items-center justify-center gap-1.5">
                <button onclick="window.app.editRule(${r.id})" class="text-slate-400 hover:text-blue-600 p-1" title="Sửa quy định">
                  <i data-lucide="edit" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="window.app.deleteRule(${r.id})" class="text-slate-400 hover:text-red-600 p-1" title="Xóa quy định">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            ` : `
              <span class="text-slate-400 text-xs italic font-medium flex items-center justify-center gap-1">
                <i data-lucide="lock" class="w-3 h-3 text-amber-500"></i>
                <span>Chỉ xem</span>
              </span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openRuleModal(rule = null) {
    if (!this.isSupervisor()) {
      this.openPasswordModal(() => this.openRuleModal(rule));
      return;
    }
    this.editingRuleId = rule ? rule.id : null;
    const modal = document.getElementById('modal-rule');
    const title = document.getElementById('modal-rule-title');
    const nameInput = document.getElementById('modal-rule-name');
    const pointsInput = document.getElementById('modal-rule-points');

    if (rule) {
      title.textContent = 'Chỉnh Sửa Quy Định Lỗi';
      nameInput.value = rule.name;
      pointsInput.value = rule.points;
    } else {
      title.textContent = 'Thêm Quy Định Lỗi Vi Phạm Mới';
      nameInput.value = '';
      pointsInput.value = '0.5';
    }

    modal.classList.remove('hidden');
    nameInput.focus();
  }

  saveRuleModal() {
    const name = (document.getElementById('modal-rule-name').value || '').trim();
    const points = parseFloat(document.getElementById('modal-rule-points').value) || 0.5;

    if (!name) {
      this.showToast('Vui lòng nhập tên quy định lỗi vi phạm.', 'warning');
      return;
    }

    if (this.editingRuleId) {
      const idx = this.rules.findIndex(r => r.id === this.editingRuleId);
      if (idx !== -1) {
        this.rules[idx].name = name;
        this.rules[idx].points = points;
        this.showToast('Đã cập nhật quy định lỗi!', 'success');
      }
    } else {
      const newId = this.rules.length > 0 ? Math.max(...this.rules.map(r => r.id || 0)) + 1 : 1;
      this.rules.push({
        id: newId,
        name: name,
        points: points
      });
      this.showToast('Đã thêm quy định lỗi mới!', 'success');
    }

    this.saveRules();
    this.populateDropdowns();
    this.renderRulesTable();
    document.getElementById('modal-rule').classList.add('hidden');
  }

  editRule(id) {
    const r = this.rules.find(item => item.id === id);
    if (r) this.openRuleModal(r);
  }

  deleteRule(id) {
    if (!this.isSupervisor()) {
      this.openPasswordModal(() => this.deleteRule(id));
      return;
    }
    if (confirm('Bạn có chắc muốn xóa lỗi này khỏi danh mục quy chế?')) {
      this.rules = this.rules.filter(r => r.id !== id);
      this.saveRules();
      this.populateDropdowns();
      this.renderRulesTable();
      this.showToast('Đã xóa quy định lỗi.', 'info');
    }
  }

  // ==================== CÀI ĐẶT MODEL & API KEY (THEO AI_INSTRUCTIONS) ====================

  setupSettingsModal() {
    const btnOpen = document.getElementById('btn-open-settings');
    const modal = document.getElementById('modal-settings');
    const btnClose = document.getElementById('btn-close-settings');
    const btnCancel = document.getElementById('btn-cancel-settings');
    const btnSave = document.getElementById('btn-save-settings');
    const btnDelete = document.getElementById('btn-delete-api-key');
    const btnToggle = document.getElementById('btn-toggle-key-visibility');

    if (btnOpen) btnOpen.addEventListener('click', () => this.openSettingsModal());
    if (btnClose) btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.add('hidden'));

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const inp = document.getElementById('input-api-key');
        if (inp.type === 'password') {
          inp.type = 'text';
          btnToggle.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4"></i>`;
        } else {
          inp.type = 'password';
          btnToggle.innerHTML = `<i data-lucide="eye" class="w-4 h-4"></i>`;
        }
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Model Cards click
    const cards = document.querySelectorAll('.model-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const modelId = card.getAttribute('data-model');
        this.selectModelCard(modelId);
      });
    });

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const key = document.getElementById('input-api-key').value.trim();
        const selectedRadio = document.querySelector('input[name="radio-model"]:checked');
        const modelId = selectedRadio ? selectedRadio.value : 'gemini-3-flash-preview';

        window.geminiService.setApiKey(key);
        window.geminiService.setSelectedModel(modelId);

        const inputCloudUrl = document.getElementById('input-cloud-url');
        if (inputCloudUrl) {
          const newCloudUrl = inputCloudUrl.value.trim();
          this.setCloudUrl(newCloudUrl);
        }

        document.getElementById('display-current-model-tag').textContent = modelId;
        this.updateBadges();
        this.updateCloudStatusBadge(true);
        modal.classList.add('hidden');
        this.showToast('Đã lưu thiết lập Gemini API Key và Cloud Database thành công!', 'success');

        // Tự động kiểm tra và đồng bộ đám mây ngay lập tức
        this.syncCloudData(true);
      });
    }

    // Các nút thao tác Google Sheets & Cloud Database
    const btnToggleGuide = document.getElementById('btn-toggle-gas-guide');
    const guideBox = document.getElementById('gas-guide-box');
    if (btnToggleGuide && guideBox) {
      btnToggleGuide.onclick = () => {
        guideBox.classList.toggle('hidden');
      };
    }

    const btnTestCloud = document.getElementById('btn-test-cloud-connection');
    if (btnTestCloud) {
      btnTestCloud.onclick = () => this.testCloudConnection();
    }

    const btnBackupJson = document.getElementById('btn-backup-violations-json');
    if (btnBackupJson) {
      btnBackupJson.onclick = () => this.exportViolationsBackupJson();
    }

    const btnCopyGas = document.getElementById('btn-copy-gas-code');
    if (btnCopyGas) {
      btnCopyGas.onclick = () => this.copyGasCode();
    }

    const btnDownloadGas = document.getElementById('btn-download-gas-file');
    if (btnDownloadGas) {
      btnDownloadGas.onclick = () => this.downloadGasFile();
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (confirm('Xóa API Key khỏi trình duyệt này?')) {
          window.geminiService.setApiKey('');
          document.getElementById('input-api-key').value = '';
          this.updateBadges();
          modal.classList.add('hidden');
          this.showToast('Đã xóa API Key.', 'info');
        }
      });
    }
  }

  openSettingsModal() {
    // Yêu cầu xác thực quyền Admin cấp cao (2806) trước khi mở Cài đặt / cấu hình Cloud
    this.requireAdmin(() => {
      this._openSettingsModalDirect();
    });
  }

  _openSettingsModalDirect() {
    const modal = document.getElementById('modal-settings');
    const inputKey = document.getElementById('input-api-key');
    if (inputKey) inputKey.value = window.geminiService.getApiKey();

    const currentModel = window.geminiService.getSelectedModel();
    this.selectModelCard(currentModel);

    const inputCloudUrl = document.getElementById('input-cloud-url');
    if (inputCloudUrl) {
      inputCloudUrl.value = this.getCloudUrl();
    }
    this.updateCloudStatusBadge(true);

    if (modal) {
      modal.classList.remove('hidden');
      if (inputKey) inputKey.focus();
    }
  }

  selectModelCard(modelId) {
    if (modelId === 'gemini-3-pro-preview') {
      modelId = 'gemini-3.1-pro-preview';
    } else if (modelId === 'gemini-2.5-flash') {
      modelId = 'gemini-3-flash-preview';
    }
    let matched = false;
    document.querySelectorAll('.model-card').forEach(card => {
      const isMatch = card.getAttribute('data-model') === modelId;
      const radio = card.querySelector('input[type="radio"]');
      if (isMatch) {
        matched = true;
        card.classList.add('selected');
        if (radio) radio.checked = true;
      } else {
        card.classList.remove('selected');
        if (radio) radio.checked = false;
      }
    });

    if (!matched) {
      const firstCard = document.querySelector('.model-card');
      if (firstCard) {
        firstCard.classList.add('selected');
        const radio = firstCard.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      }
    }
  }

  checkApiKeyPrompt() {
    const key = window.geminiService.getApiKey();
    if (!key) {
      // AI_INSTRUCTIONS: "Khi chưa có key, hiển thị Modal bắt buộc nhập"
      setTimeout(() => {
        this.openSettingsModal();
      }, 500);
    }
  }

  // ==================== BẢO VỆ MẬT KHẨU QUẢN TRỊ ====================

  setupPasswordAuth() {
    this.PASSWORD_CONFIG = "2806";
    this.pendingAction = null;
    this.currentModalRequireAdmin = false;

    const btnToggleLock = document.getElementById('btn-toggle-auth-lock');
    const modalPass = document.getElementById('modal-login-password');
    const formPass = document.getElementById('form-login-password');
    const btnCancel = document.getElementById('btn-cancel-password-modal');
    const inputPass = document.getElementById('login-password');

    this.updateLockStatusUI();

    if (inputPass) {
      // Tắt triệt để tính năng gợi ý và lưu mật khẩu của trình duyệt
      inputPass.setAttribute('type', 'password');
      inputPass.setAttribute('autocomplete', 'new-password');
      inputPass.setAttribute('name', 'random_pass_field');
      inputPass.setAttribute('autocorrect', 'off');
      inputPass.setAttribute('autocapitalize', 'off');
      inputPass.setAttribute('spellcheck', 'false');
      inputPass.setAttribute('data-lpignore', 'true');
      inputPass.setAttribute('data-1p-ignore', 'true');
      inputPass.setAttribute('data-form-type', 'other');
      inputPass.setAttribute('readonly', 'readonly');

      inputPass.addEventListener('focus', () => inputPass.removeAttribute('readonly'));
      inputPass.addEventListener('mousedown', () => inputPass.removeAttribute('readonly'));
      inputPass.addEventListener('touchstart', () => inputPass.removeAttribute('readonly'));

      // Tự động xóa viền đỏ khi người dùng bắt đầu gõ lại
      inputPass.addEventListener('input', () => {
        const err = document.getElementById('password-error-msg');
        if (err) {
          err.classList.add('hidden');
          err.style.display = 'none';
        }
        inputPass.classList.remove('border-red-500', 'bg-red-50');
        inputPass.classList.add('border-slate-300');
      });
    }

    if (btnToggleLock) {
      btnToggleLock.onclick = (e) => {
        e.preventDefault();
        this.handleAuthButtonClick();
      };
    }

    if (btnCancel) {
      btnCancel.onclick = (e) => {
        e.preventDefault();
        this.closePasswordModal();
      };
    }

    if (modalPass) {
      modalPass.onclick = (e) => {
        if (e.target === modalPass) {
          this.closePasswordModal();
        }
      };
    }

    if (formPass) {
      formPass.onsubmit = (e) => {
        e.preventDefault();
        this.submitPassword();
      };
    }
  }

  handleAuthButtonClick() {
    if (this.isDataEntryUnlocked()) {
      const roleName = this.isAdmin() ? 'Quản trị viên Admin' : 'Giám thị / Đội Cờ đỏ';
      if (confirm(`Bạn đang đăng nhập với quyền ${roleName}. Bạn có muốn đăng xuất để chuyển sang chế độ Chỉ xem (Read-only) không?`)) {
        sessionStorage.removeItem('user_role');
        sessionStorage.removeItem('data_entry_unlocked');
        localStorage.removeItem('user_role');
        localStorage.removeItem('data_entry_unlocked');

        // Khóa lại các tuần đã qua để đảm bảo an toàn sau khi đăng xuất
        this.lockedWeeks = [1, 2, 3, 4, 5, 6];
        this.saveLockedWeeks();

        const SENSITIVE_ADMIN_TABS = ['tab-students', 'tab-rules', 'tab-backup', 'tab-audit-logs'];
        if (SENSITIVE_ADMIN_TABS.includes(this.activeTab)) {
          this.switchTab('tab-emulation');
        }

        this.logAuditAction('LOGOUT', 'Đăng xuất', `Đã đăng xuất khỏi vai trò ${roleName}, chuyển về chế độ Chỉ xem`);
        this.updateLockStatusUI();
        this.showToast('Đã đăng xuất. Hệ thống đã chuyển về chế độ Chỉ xem an toàn.', 'info');
      }
    } else {
      this.openPasswordModal();
    }
  }

  getUserRole() {
    const role = sessionStorage.getItem('user_role') || localStorage.getItem('user_role');
    if (role === 'admin' || role === 'supervisor') return role;
    if (sessionStorage.getItem('data_entry_unlocked') === 'true' || localStorage.getItem('data_entry_unlocked') === 'true') {
      return 'admin';
    }
    return null;
  }

  isAdmin() {
    return this.getUserRole() === 'admin';
  }

  isSupervisor() {
    const role = this.getUserRole();
    return role === 'admin' || role === 'supervisor';
  }

  isDataEntryUnlocked() {
    return this.isSupervisor();
  }

    updateLockStatusUI() {
    const text = document.getElementById('lock-status-text');
    const icon = document.getElementById('lock-icon');
    const btn = document.getElementById('btn-toggle-auth-lock');
    const isUnlocked = this.isDataEntryUnlocked();
    const isAdmin = this.isAdmin();
    const isSupervisor = this.isSupervisor();

    if (text) {
      if (isAdmin) {
        text.textContent = '🔓 Quản trị Admin';
      } else if (isSupervisor) {
        text.textContent = '🚩 Giám thị / Cờ đỏ';
      } else {
        text.textContent = '🔒 Đăng nhập';
      }
    }
    if (icon) {
      if (isAdmin) {
        icon.setAttribute('data-lucide', 'unlock');
        icon.setAttribute('class', 'w-4 h-4 text-emerald-400 pointer-events-none');
      } else if (isSupervisor) {
        icon.setAttribute('data-lucide', 'shield-check');
        icon.setAttribute('class', 'w-4 h-4 text-indigo-300 pointer-events-none');
      } else {
        icon.setAttribute('data-lucide', 'lock');
        icon.setAttribute('class', 'w-4 h-4 text-amber-400 pointer-events-none');
      }
    }
    if (btn) {
      if (isAdmin) {
        btn.className = 'flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer';
      } else if (isSupervisor) {
        btn.className = 'flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer';
      } else {
        btn.className = 'flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer';
      }
    }

    // 1. Cập nhật các badge khóa trên thanh điều hướng tab
    const lockBackup = document.getElementById('lock-badge-tab-backup');
    if (lockBackup) lockBackup.style.display = isAdmin ? 'none' : 'inline-flex';
    const lockAudit = document.getElementById('lock-badge-tab-audit');
    if (lockAudit) lockAudit.style.display = isAdmin ? 'none' : 'inline-flex';
    const lockRules = document.getElementById('lock-badge-tab-rules');
    if (lockRules) lockRules.style.display = 'none';
    const lockStudents = document.getElementById('lock-badge-tab-students');
    if (lockStudents) lockStudents.style.display = 'none';

    // 2. Tab 1: Nút Thêm lỗi & Chạy AI: Mở cho CẢ Admin VÀ Giám thị / Cờ đỏ
    const btnManualAdd = document.getElementById('btn-manual-add');
    if (btnManualAdd) {
      if (isUnlocked) {
        btnManualAdd.disabled = false;
        btnManualAdd.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 pointer-events-none"></i><span>Thêm Lỗi</span>`;
        btnManualAdd.className = 'w-full text-sm font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl transition shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer';
      } else {
        btnManualAdd.disabled = true;
        btnManualAdd.innerHTML = `<i data-lucide="lock" class="w-4 h-4 pointer-events-none text-amber-300"></i><span>Thêm Lỗi (Chỉ Xem - Cần Đăng Nhập)</span>`;
        btnManualAdd.className = 'w-full text-sm font-bold bg-slate-700 hover:bg-slate-800 text-slate-300 p-3.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80';
      }
    }

    const btnRunAi = document.getElementById('btn-run-ai-parse');
    if (btnRunAi) {
      if (isUnlocked) {
        btnRunAi.disabled = false;
        btnRunAi.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 pointer-events-none"></i><span>Bắt Đầu Chuẩn Hóa Bằng AI</span>`;
        btnRunAi.className = 'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/25 cursor-pointer';
      } else {
        btnRunAi.disabled = true;
        btnRunAi.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 pointer-events-none text-amber-300"></i><span>Chuẩn Hóa AI (Chỉ Xem)</span>`;
        btnRunAi.className = 'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition shadow-sm cursor-not-allowed opacity-80';
      }
    }

    // 3. Tab 3: Thao tác Bảng Thi Đua
    const btnAddBonus = document.getElementById('btn-add-bonus-point');
    const btnImport = document.getElementById('btn-open-excel-import');
    const btnSaveTable = document.getElementById('btn-save-emulation-table');
    const btnToggleWeekLock = document.getElementById('btn-toggle-week-lock');
    const btnUnlockAllWeeks = document.getElementById('btn-unlock-all-weeks');
    const btnManageWeeks = document.getElementById('btn-open-manage-weeks-modal');

    if (btnAddBonus) btnAddBonus.style.display = isUnlocked ? 'inline-flex' : 'none';
    if (btnImport) btnImport.style.display = isUnlocked ? 'inline-flex' : 'none';
    if (btnSaveTable) btnSaveTable.style.display = isUnlocked ? 'inline-flex' : 'none';
    // Các nút can thiệp khóa tuần chỉ dành riêng cho Admin cấp cao
    if (btnToggleWeekLock) btnToggleWeekLock.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnUnlockAllWeeks) btnUnlockAllWeeks.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnManageWeeks) btnManageWeeks.style.display = isAdmin ? 'inline-flex' : 'none';

    // 4. Tab 4 (Quản Lý Học Sinh):
    // Giám thị (Level 2) và Admin (Level 3) ĐƯỢC PHÉP Thêm học sinh và Import học sinh
    const btnAddStudent = document.getElementById('btn-open-add-student');
    const btnImportStudent = document.getElementById('btn-open-import-students');
    const btnResetStudent = document.getElementById('btn-reset-default-students');

    if (btnAddStudent) btnAddStudent.style.display = isSupervisor ? 'inline-flex' : 'none';
    if (btnImportStudent) btnImportStudent.style.display = isSupervisor ? 'inline-flex' : 'none';
    // Nút khôi phục 1.226 học sinh gốc: Mở cho CẢ Giám thị và Admin
    if (btnResetStudent) btnResetStudent.style.display = isSupervisor ? 'inline-flex' : 'none';

    // 5. Tab 5: Nút Thêm / Reset nội quy: Mở cho CẢ Giám thị và Admin
    const btnAddRule = document.getElementById('btn-open-add-rule');
    const btnResetRule = document.getElementById('btn-reset-default-rules');
    if (btnAddRule) btnAddRule.style.display = isSupervisor ? 'inline-flex' : 'none';
    if (btnResetRule) btnResetRule.style.display = isSupervisor ? 'inline-flex' : 'none';

    // 6. Tab 6: Ẩn / Hiện nút Tạo điểm khôi phục / Reset: CHỈ DÀNH CHO ADMIN
    ['btn-open-create-snapshot', 'btn-trigger-snapshot-modal', 'btn-clear-all-snapshots'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    // Cập nhật lại toàn bộ bảng biểu để ẩn/hiện các nút Thao tác Sửa / Xóa
    this.renderEmulationTable();
    this.renderLogsTable();
    this.renderStudentsTable();
    this.renderRulesTable();
    this.renderSnapshotsList();

    if (window.lucide) window.lucide.createIcons();
  }

  openPasswordModal(onSuccess = null, requireAdmin = false) {
    this.pendingAction = onSuccess;
    this.currentModalRequireAdmin = Boolean(requireAdmin);
    const modal = document.getElementById('modal-login-password');
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    const title = document.getElementById('login-password-modal-title');
    const subtitle = document.getElementById('login-password-modal-subtitle');
    
    if (title && subtitle) {
      if (this.currentModalRequireAdmin) {
        title.textContent = 'Xác Thực Quản Trị Admin Cấp Cao';
        subtitle.textContent = 'Mục này yêu cầu quyền Quản trị Admin để cấu hình, mở/khóa tuần hoặc sao lưu hệ thống.';
      } else {
        title.textContent = 'Đăng Nhập Ban Nền Nếp & Quản Trị';
        subtitle.textContent = 'Nhập mật khẩu Quản trị Admin hoặc Giám thị / Đội cờ đỏ để mở khóa.';
      }
    }

    if (err) {
      err.textContent = 'Đăng nhập không thành công!';
      err.classList.add('hidden');
      err.style.display = 'none';
    }
    if (input) {
      input.value = '';
      input.setAttribute('type', 'password');
      input.setAttribute('autocomplete', 'new-password');
      input.setAttribute('name', 'random_pass_field');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('data-lpignore', 'true');
      input.setAttribute('data-1p-ignore', 'true');
      input.setAttribute('data-form-type', 'other');
      input.setAttribute('readonly', 'readonly');
      input.classList.remove('border-red-500', 'bg-red-50');
      input.classList.add('border-slate-300');
    }
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      setTimeout(() => {
        if (input) {
          input.removeAttribute('readonly');
          input.focus();
          input.select();
        }
      }, 100);
    }
  }

  closePasswordModal() {
    const modal = document.getElementById('modal-login-password');
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    if (err) {
      err.classList.add('hidden');
      err.style.display = 'none';
      err.textContent = 'Đăng nhập không thành công!';
    }
    if (input) {
      input.value = '';
      input.setAttribute('type', 'password');
      input.setAttribute('autocomplete', 'new-password');
      input.setAttribute('name', 'random_pass_field');
      input.setAttribute('readonly', 'readonly');
      input.classList.remove('border-red-500', 'bg-red-50');
      input.classList.add('border-slate-300');
    }
    this.pendingAction = null;
    this.currentModalRequireAdmin = false;
  }

  submitPassword() {
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    const entered = (input ? input.value : '').trim();
    const enteredLower = entered.toLowerCase();

    const isAdminPass = entered === this.PASSWORD_ADMIN;
    const isSupervisorPass = enteredLower === this.PASSWORD_SUPERVISOR.toLowerCase();

    // Nếu hành động đang yêu cầu quyền Admin cấp cao (ví dụ mở tab nhạy cảm)
    if (this.currentModalRequireAdmin && !isAdminPass) {
      if (isSupervisorPass) {
        if (err) {
          err.textContent = 'Mục này yêu cầu quyền Admin cấp cao! Mật khẩu Giám thị / Cờ đỏ không thể truy cập.';
          err.classList.remove('hidden');
          err.style.display = 'block';
        }
        if (input) {
          input.classList.remove('border-slate-300');
          input.classList.add('border-red-500', 'bg-red-50');
          input.select();
          input.focus();
        }
        this.showToast('Mục này yêu cầu quyền Quản trị Admin cấp cao.', 'error');
        return;
      }
    }

    if (isAdminPass || isSupervisorPass) {
      try {
        const role = isAdminPass ? 'admin' : 'supervisor';
        sessionStorage.setItem('user_role', role);
        sessionStorage.setItem('data_entry_unlocked', 'true');
        localStorage.setItem('user_role', role);
        localStorage.setItem('data_entry_unlocked', 'true');

        if (isAdminPass) {
          // Mở khóa toàn bộ các tuần (Tuần 1 đến 6) theo đặc quyền Admin
          this.lockedWeeks = [];
          this.saveLockedWeeks();
        }

        // Đóng modal đăng nhập
        this.closePasswordModal();

        // Cập nhật giao diện
        this.updateLockStatusUI();

        if (isAdminPass) {
          this.logAuditAction('LOGIN', 'Đăng nhập Admin', 'Đăng nhập thành công với vai trò Quản trị viên cấp cao (Mã 2806)');
          this.showToast('🔓 Quyền Admin: Đăng nhập thành công! Đã cấp toàn quyền quản trị cấp cao và mở khóa toàn bộ các tuần.', 'success');
        } else {
          this.logAuditAction('LOGIN', 'Đăng nhập Giám thị', 'Đăng nhập thành công với vai trò Giám thị / Đội cờ đỏ (Mã lhp38)');
          this.showToast('🚩 Quyền Giám Thị / Đội Cờ Đỏ: Đăng nhập thành công! Thầy/cô có quyền thêm danh sách HS, thêm/bớt/sửa vi phạm và điều chỉnh danh mục lỗi & điểm.', 'success');
        }

        if (typeof this.pendingAction === 'function') {
          const action = this.pendingAction;
          this.pendingAction = null;
    this.currentModalRequireAdmin = false;
          action();
        }
      } catch (err) {
        console.error('LỖI trong submitPassword:', err);
      }
    } else {
      if (err) {
        err.textContent = 'Mật khẩu không chính xác! Vui lòng thử lại.';
        err.classList.remove('hidden');
        err.style.display = 'block';
      }
      if (input) {
        input.classList.remove('border-slate-300');
        input.classList.add('border-red-500', 'bg-red-50');
        input.select();
        input.focus();
      }
      this.showToast('Mật khẩu không chính xác! Vui lòng thử lại.', 'error');
    }
  }

  requireAdmin(onSuccess) {
    if (this.isAdmin()) {
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      this.openPasswordModal(onSuccess, true);
    }
  }

  requirePassword(onSuccess) {
    if (this.isDataEntryUnlocked()) {
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      this.openPasswordModal(onSuccess, false);
    }
  }

  // ==================== DỌN DẸP CACHE & BỘ NHỚ ĐỆM CŨ ====================

  purgeObsoleteCache() {
    try {
      const CURRENT_STORAGE_VER = '2.3.0_GAS_STANDARD';
      if (typeof localStorage === 'undefined') return;

      const savedVer = localStorage.getItem('dshs_storage_version');

      // 1. Quét và loại bỏ triệt để bất kỳ key nào chứa kvdb.io trong localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          if (typeof val === 'string' && val.includes('kvdb.io')) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => {
        console.log('🧹 Purging obsolete kvdb.io cache key:', k);
        localStorage.removeItem(k);
      });

      // 2. Nếu key dshs_cloud_url chứa link cũ lệch -> xóa ngay và lưu link chuẩn
      const cloudUrl = localStorage.getItem('dshs_cloud_url');
      if (cloudUrl && (cloudUrl.includes('kvdb.io') || !cloudUrl.includes('script.google.com') || cloudUrl !== OFFICIAL_GAS_ENDPOINT)) {
        console.log('🧹 Purging obsolete dshs_cloud_url:', cloudUrl);
        localStorage.removeItem('dshs_cloud_url');
      }
      localStorage.setItem('dshs_cloud_url', OFFICIAL_GAS_ENDPOINT);

      // 3. Nếu phiên bản lưu trữ chưa được nâng cấp lên 2.3.0_GAS_STANDARD:
      // Buộc xóa sạch dshs_cloud_url cũ để ép dùng Endpoint chuẩn
      if (savedVer !== CURRENT_STORAGE_VER) {
        console.log('🔄 Nâng cấp bộ nhớ đệm hệ thống lên phiên bản:', CURRENT_STORAGE_VER);
        localStorage.removeItem('dshs_cloud_url_updated_at');
        localStorage.setItem('dshs_storage_version', CURRENT_STORAGE_VER);
      }
    } catch (err) {
      console.warn('Lỗi khi dọn dẹp cache:', err);
    }
  }

  // ==================== CƠ SỞ DỮ LIỆU ĐÁM MÂY (GOOGLE SHEETS CLOUD DATABASE) ====================

  get DEFAULT_CLOUD_URL() {
    // Đóng cứng (hardcode) tuyệt đối Endpoint Google Apps Script chuẩn của nhà trường
    return OFFICIAL_GAS_ENDPOINT;
  }

  getCloudUrl() {
    // Đóng cứng (hardcode) tuyệt đối Endpoint Google Apps Script chuẩn của nhà trường
    // Áp dụng mặc định toàn cục trên mọi thiết bị (Điện thoại, Máy tính bảng, Máy tính - Khách xem, Giám thị lhp38, Admin 2806)
    // Hoàn toàn không phụ thuộc vào localStorage cũ và không bao giờ bị kẹt link cũ hay ngoại tuyến
    return OFFICIAL_GAS_ENDPOINT;
  }

  async setCloudUrl(url, broadcast = false) {
    const cleanUrl = (url && url.trim()) ? url.trim() : this.DEFAULT_CLOUD_URL;
    if (cleanUrl !== this.DEFAULT_CLOUD_URL && cleanUrl.includes('script.google.com') && !cleanUrl.includes('kvdb.io')) {
      localStorage.setItem('dshs_cloud_url', cleanUrl);
    } else {
      localStorage.removeItem('dshs_cloud_url');
    }
    localStorage.setItem('dshs_cloud_url_updated_at', String(Date.now()));

    // Cập nhật giá trị hiển thị trên ô input Cài đặt nếu có trong DOM
    const inputCloudUrl = document.getElementById('input-cloud-url');
    if (inputCloudUrl) {
      inputCloudUrl.value = this.getCloudUrl();
    }
  }

  /**
   * Đồng bộ / ghi nhận đường dẫn Google Apps Script chuẩn
   */
  async broadcastEndpointToCloud(newUrl) {
    console.log('✅ Google Apps Script Endpoint chuẩn:', newUrl || this.getCloudUrl());
  }

  /**
   * Tự động kiểm tra và đồng bộ Endpoint mới nhất từ config.json cho các thiết bị khác (điện thoại, máy tính bảng)
   */
  async syncGlobalEndpoint() {
    try {
      const now = Date.now();
      let latestUrl = null;

      // 1. Kiểm tra config.json trên server
      try {
        const cfgRes = await fetch(`config.json?_t=${now}`, { cache: 'no-cache' });
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData && cfgData.gas_endpoint && cfgData.gas_endpoint.includes('script.google.com') && !cfgData.gas_endpoint.includes('kvdb.io')) {
            latestUrl = cfgData.gas_endpoint.trim();
          }
        }
      } catch (e) {}

      // 2. Nếu tìm thấy Endpoint hợp lệ trong config.json và khác với Endpoint hiện tại trên thiết bị này:
      if (latestUrl && latestUrl !== this.getCloudUrl()) {
        if (!this.isAdmin()) {
          console.log(`🔄 Tự động cập nhật Endpoint Google Apps Script mới từ config: ${latestUrl}`);
          await this.setCloudUrl(latestUrl, false);
          this.updateCloudStatusBadge(true);
          return true;
        }
      }
    } catch (err) {
      console.warn('Lỗi kiểm tra Global Endpoint:', err);
    }
    return false;
  }

  loadDeletedViolationIds() {
    try {
      const saved = localStorage.getItem('dshs_deleted_violations_ids');
      return new Set(saved ? JSON.parse(saved).map(String) : []);
    } catch (e) {
      return new Set();
    }
  }

  trackDeletedViolationId(id, week = null, className = null) {
    if (!this.deletedViolationIds) {
      this.deletedViolationIds = new Set();
    }
    if (!id) return;
    this.deletedViolationIds.add(String(id));
    try {
      localStorage.setItem('dshs_deleted_violations_ids', JSON.stringify(Array.from(this.deletedViolationIds)));
    } catch (e) {}

    if (week && className) {
      if (!this.deletedViolationMeta) this.deletedViolationMeta = [];
      this.deletedViolationMeta.push({ id: String(id), week: parseInt(week, 10), className });
      try {
        localStorage.setItem('dshs_deleted_violations_meta', JSON.stringify(this.deletedViolationMeta));
      } catch (e) {}
    }
  }

  classHasDeletedViolations(weekNum, className) {
    const w = parseInt(weekNum, 10);
    if (!this.deletedViolationMeta) {
      try {
        const saved = localStorage.getItem('dshs_deleted_violations_meta');
        this.deletedViolationMeta = saved ? JSON.parse(saved) : [];
      } catch (e) {
        this.deletedViolationMeta = [];
      }
    }
    return (this.deletedViolationMeta || []).some(m => parseInt(m.week, 10) === w && m.className === className);
  }

  updateCloudStatusBadge(isOnline = true) {
    const badge = document.getElementById('cloud-sync-badge');
    const indicatorText = document.getElementById('cloud-status-indicator-text');
    const indicator = document.getElementById('cloud-status-indicator');
    const cloudUrl = this.getCloudUrl();
    const isGAS = cloudUrl.includes('script.google.com');
    const name = isGAS ? 'Google Sheets' : 'Cloud';

    if (badge) {
      badge.className = isOnline 
        ? 'w-2 h-2 rounded-full bg-emerald-500' 
        : 'w-2 h-2 rounded-full bg-amber-500';
      badge.title = isOnline 
        ? `${name} Database: Đang kết nối thông suốt` 
        : `${name} Database: Ngoại tuyến (Đã lưu an toàn trên máy)`;
    }

    if (indicatorText) {
      indicatorText.textContent = isOnline ? `Đang kết nối ${name}` : 'Ngoại tuyến';
    }
    if (indicator) {
      indicator.className = isOnline
        ? 'text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5'
        : 'text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5';
    }
  }

  // ── Realtime Cross-Tab Sync (Đồng bộ tức thời giữa các tab cùng trình duyệt) ──
  setupRealtimeTabSync() {
    try {
      this._tabInstanceId = Math.random().toString(36).substring(2, 9);
      if (typeof BroadcastChannel !== 'undefined') {
        this.syncChannel = new BroadcastChannel('dshs_nenep_realtime_channel');
        this.syncChannel.onmessage = (event) => {
          if (event && event.data) {
            this.handleCrossTabMessage(event.data);
          }
        };
      }

      window.addEventListener('storage', (e) => {
        if (e.key === 'dshs_realtime_broadcast_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.handleCrossTabMessage(data);
          } catch (err) {}
        }
      });
    } catch (e) {
      console.warn('Lỗi khởi tạo Realtime Tab Sync:', e);
    }
  }

  broadcastLocalChange(data) {
    try {
      const msg = {
        ...data,
        timestamp: Date.now(),
        senderId: this._tabInstanceId || (this._tabInstanceId = Math.random().toString(36).substring(2, 9))
      };
      if (this.syncChannel) {
        this.syncChannel.postMessage(msg);
      }
      localStorage.setItem('dshs_realtime_broadcast_event', JSON.stringify(msg));
    } catch (e) {}
  }

  handleCrossTabMessage(msg) {
    if (!msg || msg.senderId === this._tabInstanceId) return;

    if (msg.type === 'DELETE_VIOLATION' && msg.id) {
      const idStr = String(msg.id);
      this.trackDeletedViolationId(idStr, msg.week, msg.className);
      this.violations = this.violations.filter(v => String(v.id) !== idStr);
      localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
      if (msg.week && msg.className) {
        this.syncViolationWithEmulation(msg.week, msg.className);
      }
      this.updateBadges();
      this.renderLogsTable();
      this.renderEmulationTable();
      this.updateCharts();
      const viewClassModal = document.getElementById('modal-view-class-violations');
      if (viewClassModal && !viewClassModal.classList.contains('hidden') && msg.week && msg.className) {
        this.viewClassViolations(msg.week, msg.className);
      }
    } else if (msg.type === 'DATA_UPDATED') {
      this._lastPullTime = 0;
      this.pullAndMergeFromCloud(true, true);
    } else if (msg.type === 'AUDIT_LOG_ADDED' && msg.entry) {
      if (!this.auditLogs) this.auditLogs = [];
      if (!this.auditLogs.some(l => l.id === msg.entry.id)) {
        this.auditLogs.unshift(msg.entry);
        if (this.auditLogs.length > 500) this.auditLogs = this.auditLogs.slice(0, 500);
        this.saveAuditLogs();
        if (this.activeTab === 'tab-audit-logs') {
          this.renderAuditLogsTable();
          this.updateAuditStats();
        }
      }
    }
  }

  debouncedPushToCloud(silent = true) {
    if (this._cloudPushTimer) {
      clearTimeout(this._cloudPushTimer);
    }
    this._cloudPushTimer = setTimeout(() => {
      this.pushToCloud(silent);
    }, 400);
  }

  async pushToCloud(silent = true, extraPayload = {}) {
    // Dual-Storage: Chỉ Admin hoặc thiết bị có quyền (Supervisor/Admin) mới được phép gọi POST ghi đè lên Google Sheets
    if (!this.isAdmin() && !this.isSupervisor()) {
      return false; // Máy khách / điện thoại chỉ xem dữ liệu, tuyệt đối không đẩy đè lên Cloud
    }

    const cloudUrl = this.getCloudUrl();
    if (!cloudUrl) return false;

    try {
      let method = 'POST';
      let headers = {
        'Content-Type': 'application/json'
      };
      const isGAS = cloudUrl.includes('script.google.com');

      if (cloudUrl.includes('.firebaseio.com') || cloudUrl.includes('.firebasedatabase.app')) {
        method = 'PUT';
      }

      // Với Google Apps Script Web App, BẮT BUỘC dùng Content-Type: text/plain;charset=utf-8 thuần túy (Mô hình kvdb.io)
      // Tuyệt đối KHÔNG gửi kèm Cache-Control/Pragma để tránh lỗi trình duyệt gửi OPTIONS CORS preflight
      if (isGAS) {
        headers = {
          'Content-Type': 'text/plain;charset=utf-8'
        };
      }

      const payload = {
        action: 'sync',
        version: 2,
        updated_at: Date.now(),
        violations: this.violations,
        deleted_ids: Array.from(this.deletedViolationIds || []),
        emulation_weeks: this.emulationWeeks || {},
        bonus_points: this.bonusPoints || {},
        audit_logs: (this.auditLogs || []).slice(0, 100),
        ...extraPayload
      };

      // Cache-Busting URL cực mạnh bằng query parameter (Chống cache di động tuyệt đối)
      const sep = cloudUrl.includes('?') ? '&' : '?';
      const cacheBustUrl = `${cloudUrl}${sep}_t=${Date.now()}&_rnd=${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch(cacheBustUrl, {
        method: method,
        mode: 'cors',
        redirect: 'follow',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        let respData = null;
        try {
          const respText = await res.text();
          respData = JSON.parse(respText);
        } catch (e) {}

        localStorage.setItem('dshs_last_sync_time', new Date().toISOString());
        localStorage.setItem('dshs_last_push_time', new Date().toISOString());
        this.updateCloudStatusBadge(true);
        if (!silent) {
          const targetName = isGAS ? 'Google Sheets' : 'Cloud';
          const count = (respData && typeof respData.count === 'number') ? respData.count : this.violations.length;
          this.showToast(`Đã đồng bộ an toàn ${count} bản ghi vi phạm lên ${targetName}!`, 'success');
        }
        return true;
      } else {
        console.warn('Cloud Database push returned status:', res.status);
        this.updateCloudStatusBadge(false);
        return false;
      }
    } catch (err) {
      console.warn('Không thể gửi dữ liệu lên Cloud Database:', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.updateCloudStatusBadge(false);
      }
      return false;
    }
  }

  async pullAndMergeFromCloud(silent = true, force = false) {
    const cloudUrl = this.getCloudUrl();
    if (!cloudUrl) return false;

    // Giới hạn tần suất gọi nếu không có cờ force
    const now = Date.now();
    if (!force && this._lastPullTime && (now - this._lastPullTime < 2000)) {
      return false;
    }
    this._lastPullTime = now;

    try {
      const sep = cloudUrl.includes('?') ? '&' : '?';
      // Cache-Busting URL cực mạnh (mô hình kvdb.io): URL query param tự động ép trình duyệt luôn lấy dữ liệu mới nhất
      const fetchUrl = `${cloudUrl}${sep}action=get&_t=${now}&_rnd=${Math.random().toString(36).substring(2, 9)}`;

      // GET request gọn nhẹ chuẩn Simple CORS: KHÔNG gửi kèm custom header Cache-Control/Pragma để tránh lỗi OPTIONS CORS
      const res = await fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });

      if (!res.ok) {
        console.warn('Lỗi kết nối máy chủ Google Sheets HTTP', res.status);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          this.updateCloudStatusBadge(false);
        }
        return false;
      }

      let respText = await res.text();
      let jsonResp = null;
      try {
        jsonResp = JSON.parse(respText);
      } catch (parseErr) {
        console.warn('Phản hồi từ Google Sheets không phải định dạng JSON:', respText.slice(0, 150));
        return false;
      }

      if (jsonResp && jsonResp.status === 'error') {
        console.warn('Google Sheets báo lỗi:', jsonResp.message);
        return false;
      }

      let data = (jsonResp && jsonResp.data) ? jsonResp.data : jsonResp;

      let cloudViolations = null;
      let cloudDeletedIds = [];
      let cloudEmulationWeeks = null;
      let cloudBonusPoints = null;
      let cloudAuditLogs = null;

      if (Array.isArray(data)) {
        cloudViolations = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.violations)) {
          cloudViolations = data.violations;
          if (Array.isArray(data.deleted_ids)) {
            cloudDeletedIds = data.deleted_ids;
          }
          if (data.emulation_weeks && typeof data.emulation_weeks === 'object') {
            cloudEmulationWeeks = data.emulation_weeks;
          }
          if (data.bonus_points && typeof data.bonus_points === 'object') {
            cloudBonusPoints = data.bonus_points;
          }
          if (Array.isArray(data.audit_logs)) {
            cloudAuditLogs = data.audit_logs;
          }
        } else if (data.violations && typeof data.violations === 'object') {
          cloudViolations = Object.values(data.violations);
        }
      }

      // 1. Đồng bộ danh sách ID đã xóa từ Cloud về thiết bị hiện tại
      if (Array.isArray(cloudDeletedIds) && cloudDeletedIds.length > 0) {
        if (!this.deletedViolationIds) this.deletedViolationIds = new Set();
        cloudDeletedIds.forEach(id => {
          if (id) this.deletedViolationIds.add(String(id));
        });
        localStorage.setItem('dshs_deleted_violations_ids', JSON.stringify(Array.from(this.deletedViolationIds)));
      }

      let dataChanged = false;

      // 2. GOOGLE SHEETS LÀ NGUỒN SỰ THẬT DUY NHẤT (Single Source of Truth) TRÊN MỌI THIẾT BỊ:
      // Áp dụng đồng bộ tuyệt đối cho toàn bộ máy (Điện thoại, Laptop, Admin, Giám thị, Khách):
      // Nếu một bản ghi vi phạm đã bị xóa trên Google Sheets, nó PHẢI BIẾN MẤT HOÀN TOÀN trên thiết bị này!
      if (Array.isArray(cloudViolations)) {
        // Lọc bỏ bất kỳ ID nào thuộc danh sách đã xóa
        const sanitizedCloudList = cloudViolations.filter(v => v && v.id && !this.deletedViolationIds.has(String(v.id)));

        // Safeguard: Nếu cloud rỗng (0 bản ghi) nhưng local có dữ liệu và chưa từng có lệnh xóa
        if (sanitizedCloudList.length === 0 && this.violations.length > 0 && (!cloudDeletedIds || cloudDeletedIds.length === 0) && (!this.deletedViolationIds || this.deletedViolationIds.size === 0)) {
          console.warn('Phát hiện Cloud rỗng chưa khởi tạo dữ liệu, giữ an toàn dữ liệu máy và đồng bộ lên Cloud');
          if (this.isAdmin() || this.isSupervisor()) {
            this.pushToCloud(true);
          }
        } else {
          // Kiểm tra xem có bản ghi nào bị xóa trên Cloud mà local vẫn còn lưu không:
          const currentLocalIds = new Set(this.violations.map(v => String(v.id)));
          const cloudIds = new Set(sanitizedCloudList.map(v => String(v.id)));

          let hasDeletedDiff = false;
          for (const localId of currentLocalIds) {
            if (!cloudIds.has(localId)) {
              hasDeletedDiff = true;
              this.trackDeletedViolationId(localId);
              break;
            }
          }

          if (hasDeletedDiff || sanitizedCloudList.length !== this.violations.length || JSON.stringify(this.violations) !== JSON.stringify(sanitizedCloudList)) {
            dataChanged = true;
          }

          // Cập nhật danh sách vi phạm chuẩn hóa từ Cloud
          this.violations = this.sortViolations(sanitizedCloudList);
          localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
        }
      }

      // 3. Cập nhật Bảng thi đua nếu có từ Cloud
      if (cloudEmulationWeeks && typeof cloudEmulationWeeks === 'object' && Object.keys(cloudEmulationWeeks).length > 0) {
        if (JSON.stringify(this.emulationWeeks) !== JSON.stringify(cloudEmulationWeeks)) {
          this.emulationWeeks = cloudEmulationWeeks;
          localStorage.setItem('dshs_emulation_weeks', JSON.stringify(this.emulationWeeks));
          dataChanged = true;
        }
      }

      // 4. Cập nhật Điểm cộng nếu có từ Cloud
      if (cloudBonusPoints && typeof cloudBonusPoints === 'object') {
        if (JSON.stringify(this.bonusPoints) !== JSON.stringify(cloudBonusPoints)) {
          this.bonusPoints = cloudBonusPoints;
          localStorage.setItem('dshs_bonus_points', JSON.stringify(this.bonusPoints));
          dataChanged = true;
        }
      }

      // 5. Cập nhật Lịch sử thao tác (Audit Logs) nếu có từ Cloud
      if (Array.isArray(cloudAuditLogs) && cloudAuditLogs.length > 0) {
        if (!this.auditLogs) this.auditLogs = [];
        const existingIds = new Set(this.auditLogs.map(l => l.id));
        let addedLog = false;
        cloudAuditLogs.forEach(cl => {
          if (cl && cl.id && !existingIds.has(cl.id)) {
            this.auditLogs.push(cl);
            existingIds.add(cl.id);
            addedLog = true;
          }
        });
        if (addedLog) {
          this.auditLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (this.auditLogs.length > 500) this.auditLogs = this.auditLogs.slice(0, 500);
          this.saveAuditLogs();
          if (this.activeTab === 'tab-audit-logs') {
            this.renderAuditLogsTable();
            this.updateAuditStats();
          }
        }
      }

      // 6. Cập nhật giao diện nếu có thay đổi
      if (dataChanged) {
        this.updateBadges();
        this.renderLogsTable();
        this.renderEmulationTable();
        this.updateCharts();

        const viewClassModal = document.getElementById('modal-view-class-violations');
        if (viewClassModal && !viewClassModal.classList.contains('hidden')) {
          const emuSelect = document.getElementById('emulation-select-week');
          const curW = emuSelect ? parseInt(emuSelect.value, 10) || this.currentWeek : this.currentWeek;
          this.viewClassViolations(curW, 'all');
        }
      }

      localStorage.setItem('dshs_last_sync_time', new Date().toISOString());
      this.updateCloudStatusBadge(true);
      return true;
    } catch (err) {
      console.warn('Lỗi khi tải dữ liệu từ Cloud Database:', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.updateCloudStatusBadge(false);
      }
      return false;
    }
  }

  async syncCloudData(silent = false) {
    if (this.isSyncingCloud) return;
    this.isSyncingCloud = true;

    const btn = document.getElementById('btn-cloud-sync');
    const icon = document.getElementById('cloud-sync-icon');
    const text = document.getElementById('cloud-sync-text');

    if (btn) btn.classList.add('opacity-75');
    if (icon) icon.classList.add('animate-spin');
    if (text) text.textContent = 'Đang đồng bộ...';

    try {
      const pullSuccess = await this.pullAndMergeFromCloud(silent, true);
      if (pullSuccess) {
        if (!silent) {
          const isGAS = this.getCloudUrl().includes('script.google.com');
          const name = isGAS ? 'Google Sheets' : 'Cloud';
          this.showToast(`Đồng bộ ${name} thành công! Có ${this.violations.length} bản ghi vi phạm được bảo vệ an toàn.`, 'success');
        }
      } else {
        // Tuyệt đối KHÔNG tự ý gọi pushToCloud khi pull thất bại (chống ghi đè đè dữ liệu cũ lên Cloud)
        if (!silent) {
          this.showToast('Không thể kết nối Cloud. Đang hoạt động ngoại tuyến (Offline).', 'warning');
        }
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ Cloud:', err);
      if (!silent) {
        this.showToast('Dữ liệu vi phạm đã được bảo toàn an toàn trên máy!', 'info');
      }
    } finally {
      this.isSyncingCloud = false;
      if (btn) btn.classList.remove('opacity-75');
      if (icon) icon.classList.remove('animate-spin');
      if (text) text.textContent = 'Đồng bộ Cloud';
      this.updateCloudStatusBadge(true);
    }
  }

  async testCloudConnection() {
    const inputUrl = document.getElementById('input-cloud-url');
    const url = inputUrl ? inputUrl.value.trim() : this.getCloudUrl();
    if (!url) {
      this.showToast('Vui lòng nhập địa chỉ Google Apps Script Web App hoặc Cloud Endpoint!', 'error');
      return;
    }

    const isGAS = url.includes('script.google.com');
    const cloudName = isGAS ? 'Google Sheets' : 'Cloud Database';
    this.showToast(`Đang kiểm tra kết nối ${cloudName}...`, 'info');

    try {
      const sep = url.includes('?') ? '&' : '?';
      const testUrl = isGAS
        ? `${url}${sep}action=ping&_t=${Date.now()}`
        : `${url}${sep}_t=${Date.now()}`;

      const res = await fetch(testUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
      if (res.ok) {
        let respData = null;
        try {
          const text = await res.text();
          respData = JSON.parse(text);
        } catch(e) {}

        await this.setCloudUrl(url, true);
        this.updateCloudStatusBadge(true);

        const detailMsg = (respData && respData.spreadsheet_name) 
          ? `Bảng tính: "${respData.spreadsheet_name}"` 
          : 'Kết nối thông suốt!';
        this.showToast(`Kết nối ${cloudName} thành công! ${detailMsg}`, 'success');

        // Tiến hành kéo và đồng bộ ngay lập tức
        await this.syncCloudData(true);
      } else {
        this.updateCloudStatusBadge(false);
        this.showToast(`Không thể kết nối ${cloudName} (Mã phản hồi HTTP ${res.status})`, 'error');
      }
    } catch (e) {
      this.updateCloudStatusBadge(false);
      this.showToast(`Lỗi kết nối ${cloudName}: ${e.message}`, 'error');
    }
  }

  async copyGasCode() {
    try {
      let code = '';
      try {
        const res = await fetch('google_apps_script.js');
        if (res.ok) code = await res.text();
      } catch (e) {}

      if (code) {
        await navigator.clipboard.writeText(code);
        this.showToast('Đã sao chép toàn bộ mã Google Apps Script vào Clipboard!', 'success');
      } else {
        window.open('google_apps_script.js', '_blank');
        this.showToast('Đang mở file google_apps_script.js trong tab mới để xem mã!', 'info');
      }
    } catch (err) {
      window.open('google_apps_script.js', '_blank');
      this.showToast('Không thể sao chép tự động. Đang mở mã trong tab mới!', 'info');
    }
  }

  downloadGasFile() {
    try {
      const a = document.createElement('a');
      a.href = 'google_apps_script.gs';
      a.download = 'google_apps_script.gs';
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.showToast('Đang tải file google_apps_script.gs về máy!', 'success');
    } catch (e) {
      this.showToast('Lỗi khi tải file: ' + e.message, 'error');
    }
  }

  exportViolationsBackupJson() {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.violations, null, 2));
      const downloadAnchor = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Sao_luu_vi_pham_THPT_LHP_${today}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Đã tải file sao lưu JSON về máy!', 'success');
    } catch (e) {
      this.showToast('Không thể xuất file sao lưu: ' + e.message, 'error');
    }
  }

  // ==================== TIỆN ÍCH HỆ THỐNG ====================

  formatDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-slate-800 text-white'
    };

    const icons = {
      success: 'check-circle-2',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    toast.className = `toast flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Khởi chạy ứng dụng ngay khi sẵn sàng
window.DisciplineApp = DisciplineApp;
function initApp() {
  if (!window.app) {
    window.app = new DisciplineApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
