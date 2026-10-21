import re, sys

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update constructor
old_constructor = '''    this.deletedViolationIds = this.loadDeletedViolationIds();
    
    this.activeTab = 'tab-ai-logger';'''

new_constructor = '''    this.deletedViolationIds = this.loadDeletedViolationIds();
    this.lockedWeeks = [1, 2, 3, 4, 5, 6];
    this.currentWeek = 7;
    
    // Nạp Bảng thi đua, Điểm cộng & Snapshots sao lưu
    this.emulationWeeks = this.loadEmulationWeeks();
    this.bonusPoints = this.loadBonusPoints();
    this.snapshots = this.loadSnapshots();
    this.pendingRestoreData = null;
    
    this.activeTab = 'tab-ai-logger';'''

if old_constructor in code:
    code = code.replace(old_constructor, new_constructor, 1)
    print('Constructor updated')
else:
    print('Could not find old_constructor')

# 2. Update loadViolations and saveViolations
old_load_violations = '''    // Dữ liệu mẫu ban đầu từ Form Nhap Lieu (Tuần 7)
    return [
      {
        id: 1,
        week: 7,
        date: '2026-10-20',
        student_name: 'Nguyễn Bo',
        class_name: '11A04',
        violation_category: 'Không bảng tên',
        penalty_points: 0.5,
        original_note: 'Không bảng tên giờ chào cờ'
      },
      {
        id: 2,
        week: 7,
        date: '2026-10-20',
        student_name: 'H Ti Ra Niê',
        class_name: '12C08',
        violation_category: 'Sai đồng phục',
        penalty_points: 0.5,
        original_note: 'Sai đồng phục ngày thứ ba'
      },
      {
        id: 3,
        week: 7,
        date: '2026-10-19',
        student_name: 'Trần Ngọc Vũ',
        class_name: '11A07',
        violation_category: 'Đi học muộn',
        penalty_points: 0.5,
        original_note: 'Đi học trễ 10 phút'
      },
      {
        id: 4,
        week: 7,
        date: '2026-10-19',
        student_name: 'Lê Âu Kỳ',
        class_name: '10B11',
        violation_category: 'Đi học muộn',
        penalty_points: 0.5,
        original_note: 'Đi học muộn xe hư'
      }
    ];'''

new_load_violations = '''    // Nạp toàn bộ dữ liệu vi phạm chuẩn từ window.DEFAULT_VIOLATIONS (Tuần 1 đến 7)
    return window.DEFAULT_VIOLATIONS || [];'''

if old_load_violations in code:
    code = code.replace(old_load_violations, new_load_violations, 1)
    print('loadViolations updated')
else:
    print('Could not find old_load_violations')

# 3. Add EmulationWeeks, DateRange and WeekLock helper methods after saveViolations
save_viol_marker = '''  saveViolations() {
    localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
    this.updateBadges();
    this.pushToCloud(true);
  }'''

new_save_viol_and_helpers = '''  saveViolations() {
    localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
    this.updateBadges();

    // Tự động tính toán lại điểm trừ thi đua của tuần hiện tại (Tuần 7)
    const curW = this.calculateWeek(new Date());
    if (this.emulationWeeks && this.emulationWeeks[curW]) {
      this.calculateWeeklyEmulationRankings(curW);
      this.saveEmulationWeeks(true);
    }
    
    // Cập nhật lại giao diện bảng thi đua nếu đang hiển thị
    const emuSelect = document.getElementById('emulation-select-week');
    if (emuSelect && emuSelect.value) {
      this.renderEmulationTable();
    }

    this.pushToCloud(true);
  }

  isWeekLocked(weekNum) {
    const w = parseInt(weekNum, 10);
    return this.lockedWeeks.includes(w);
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
  }'''

if save_viol_marker in code:
    code = code.replace(save_viol_marker, new_save_viol_and_helpers, 1)
    print('saveViolations & emulation helpers added')
else:
    print('Could not find save_viol_marker')

# 4. Update setupDateAndTime to check locked week warning
old_date_time = '''    const dateInput = document.getElementById('input-violation-date');
    if (dateInput) {
      dateInput.value = todayStr;
      const week = this.calculateWeek(todayStr);
      document.getElementById('display-computed-week').textContent = `Tuần ${week}`;

      dateInput.addEventListener('change', (e) => {
        const w = this.calculateWeek(e.target.value);
        document.getElementById('display-computed-week').textContent = `Tuần ${w}`;
      });
    }'''

new_date_time = '''    const dateInput = document.getElementById('input-violation-date');
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
    }'''

if old_date_time in code:
    code = code.replace(old_date_time, new_date_time, 1)
    print('setupDateAndTime updated')
else:
    print('Could not find old_date_time')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('app.js part 1 updated')
