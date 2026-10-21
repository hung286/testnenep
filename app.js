/**
 * ỨNG DỤNG ĐIỀU PHỐI NỀN NẾP & THI ĐUA HỌC ĐƯỜNG - TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG
 * Xây dựng theo Custom System Instruction & AI_INSTRUCTIONS.md
 */

class DisciplineApp {
  constructor() {
    this.startDate = new Date(2026, 8, 7); // Thứ Hai, 07/09/2026 (Tuần 1)
    
    // Khởi tạo State từ LocalStorage hoặc dữ liệu mặc định
    this.students = this.loadStudents();
    this.rules = this.loadRules();
    this.violations = this.loadViolations();
    this.deletedViolationIds = this.loadDeletedViolationIds();
    this.lockedWeeks = this.loadLockedWeeks();
    this.currentWeek = 7;
    
    // Nạp Bảng thi đua, Điểm cộng & Snapshots sao lưu
    this.emulationWeeks = this.loadEmulationWeeks();
    this.bonusPoints = this.loadBonusPoints();
    this.snapshots = this.loadSnapshots();
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

  loadViolations() {
    const saved = localStorage.getItem('dshs_violations');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        // Tự động làm sạch lỗi thừa chữ " - Lớp" nếu có trong dữ liệu cũ
        parsed.forEach(v => {
          if (v.student_name) {
            v.student_name = v.student_name.replace(/[\s\-\–\—]*(?:[Ll][ớơo]p)?\s*$/i, '').trim();
          }
        });
        return parsed;
      } catch (e) { }
    }
    // Nạp toàn bộ dữ liệu vi phạm chuẩn từ window.DEFAULT_VIOLATIONS (Tuần 1 đến 7)
    return window.DEFAULT_VIOLATIONS || [];
  }

  saveViolations() {
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

  adminUnlockSpecificWeek(weekNum) {
    const w = parseInt(weekNum, 10);
    this.requirePassword(() => {
      this.lockedWeeks = this.lockedWeeks.filter(x => x !== w);
      this.saveLockedWeeks();
      this.renderManageWeeksList();
      this.showToast(`Quyền Admin (2806): Đã mở khóa Tuần ${w} thành công! Thầy/cô có thể chỉnh sửa dữ liệu tuần này.`, 'success');
    });
  }

  lockSpecificWeek(weekNum) {
    const w = parseInt(weekNum, 10);
    if (!this.lockedWeeks.includes(w)) {
      this.lockedWeeks.push(w);
      this.lockedWeeks.sort((a, b) => a - b);
    }
    this.saveLockedWeeks();
    this.renderManageWeeksList();
    this.showToast(`Đã khóa niêm phong Tuần ${w} an toàn!`, 'info');
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
        ? `<button onclick="window.app.adminUnlockSpecificWeek(${w})" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1 mx-auto"><i data-lucide="unlock" class="w-3 h-3"></i> Mở khóa (2806)</button>`
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
    this.renderManageWeeksList();
    this.showToast(`Đã khóa niêm phong tất cả các tuần trước Tuần ${curW}!`, 'success');
  }

  openCurrentWeekOnly() {
    this.requirePassword(() => {
      const curW = this.calculateWeek(new Date());
      const maxWeeks = Math.max(35, curW + 2);
      this.lockedWeeks = [];
      for (let w = 1; w <= maxWeeks; w++) {
        if (w !== curW) {
          this.lockedWeeks.push(w);
        }
      }
      this.saveLockedWeeks();
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
    // 1. Tự động gán và lưu API Key ngầm
    const DEFAULT_API_KEY = typeof atob !== "undefined" ? atob("QVEuQWI4Uk42S05UclVUVEFDaTZoOTQwRW5ETEt1LW1UUTdMcTVldlRsQUx0aVBDSG9jOEE=") : "";
    if (!localStorage.getItem('gemini_api_key')) {
      localStorage.setItem('gemini_api_key', DEFAULT_API_KEY);
    }

    this.setupDateAndTime();
    this.syncCloudData(true);
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
      area.value = `Sáng nay kiểm tra đầu giờ phát hiện học sinh:\n1. Nguyễn Văn Đức lớp 10B03 không có bảng tên và đi xe trong sân trường\n2. H' Surian Ayun 11A07 mặc sai đồng phục`;
    } else if (sampleType === 3) {
      area.value = `Ghi nhận vi phạm ngày hôm nay:\n- Bạn Cao Đặng Ngọc Trâm lớp 10B04 đi dép lê vào trường\n- Huỳnh Lê Bảo An 12C03 nhuộm tóc`;
    }
  }

  setupEventListeners() {
    // Nút chạy AI Parse
    const btnRunAi = document.getElementById('btn-run-ai-parse');
    if (btnRunAi) {
      btnRunAi.addEventListener('click', () => this.handleRunAiParse());
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
      btnConfirmSave.addEventListener('click', () => this.confirmSaveAiViolations());
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

    // Đồng bộ thời gian thực đa thiết bị: Tự động kéo dữ liệu khi chuyển tab hoặc mở lại trình duyệt
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullAndMergeFromCloud(true);
      }
    });

    window.addEventListener('focus', () => {
      this.pullAndMergeFromCloud(true);
    });

    window.addEventListener('online', () => {
      this.syncCloudData(true);
    });

    // Vòng lặp định kỳ mỗi 15 giây tự động đồng bộ ngầm
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
    this.autoSyncInterval = setInterval(() => {
      this.pullAndMergeFromCloud(true);
    }, 15000);

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
          this.renderLogsTable();
          this.renderEmulationTable();
          this.showToast('Đã làm trống toàn bộ nhật ký vi phạm.', 'info');
        }
      });
    }

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
        const curW = document.getElementById('emulation-select-week').value;
        if (this.isWeekLocked(curW)) {
          this.showToast(`Tuần ${curW} đã khóa niêm phong. Không thể import dữ liệu!`, 'error');
          return;
        }
        inputExcelImp.value = '';
        inputExcelImp.click();
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

  async handleRunAiParse() {
    this.requirePassword(() => this.doRunAiParse());
  }

  async doRunAiParse() {
    const rawText = (document.getElementById('ai-input-text').value || '').trim();
    if (!rawText) {
      this.showToast('Vui lòng nhập nội dung mô tả vi phạm trước khi phân tích.', 'warning');
      document.getElementById('ai-input-text').focus();
      return;
    }

    const apiKey = window.geminiService.getApiKey();
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

    // Bắt đầu Stepper
    this.updateStepperState('running', 1);

    const btnRun = document.getElementById('btn-run-ai-parse');
    btnRun.disabled = true;
    btnRun.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang Phân Tích...</span>`;
    if (window.lucide) window.lucide.createIcons();

    try {
      // Step 1: Bóc tách thực thể
      this.updateStepperState('running', 1);
      await this.sleep(300);

      // Gọi service với callback fallback
      const response = await window.geminiService.parseViolationInput({
        rawText,
        inputDate: dateVal,
        weekNum,
        activeRules: this.rules,
        activeStudents: this.students,
        onProgress: (status) => {
          if (status.type === 'fallback') {
            const fallbackLog = document.getElementById('ai-fallback-log');
            const fallbackText = document.getElementById('ai-fallback-text');
            if (fallbackLog && fallbackText) {
              fallbackLog.classList.remove('hidden');
              fallbackText.textContent = status.message;
            }
          }
        }
      });

      // Step 2: Khớp hồ sơ
      this.updateStepperState('running', 2);
      await this.sleep(300);

      // Step 3: Chuẩn hóa & tính điểm
      this.updateStepperState('running', 3);
      await this.sleep(300);

      // Thành công
      this.updateStepperState('success');
      this.renderAiPreview(response.data);

      this.showToast(`Phân tích thành công! AI đã bóc tách được ${response.data.records ? response.data.records.length : 0} vi phạm.`, 'success');

    } catch (err) {
      console.error('Lỗi quy trình AI:', err);
      // Quy tắc AI_INSTRUCTIONS: Khi lỗi, chuyển trạng thái thành "Đã dừng do lỗi", hiển thị nguyên văn lỗi API màu đỏ
      this.updateStepperState('error', err.message);
      
      const banner = document.getElementById('global-error-banner');
      const bannerMsg = document.getElementById('global-error-message');
      if (banner && bannerMsg) {
        banner.classList.remove('hidden');
        bannerMsg.textContent = err.message || 'Lỗi không xác định khi kết nối API';
      }
    } finally {
      btnRun.disabled = false;
      btnRun.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i><span>Bắt Đầu Chuẩn Hóa Bằng AI</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  updateStepperState(status, stepIndex = 1) {
    const badge = document.getElementById('stepper-badge-status');
    const progressBar = document.getElementById('stepper-progress-bar');
    const step1 = document.getElementById('step-item-1');
    const step2 = document.getElementById('step-item-2');
    const step3 = document.getElementById('step-item-3');

    // Reset styles
    [step1, step2, step3].forEach(s => {
      s.className = 'step-item flex items-start gap-3';
    });

    if (status === 'running') {
      badge.textContent = `Đang xử lý Bước ${stepIndex}/3...`;
      badge.className = 'text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded animate-pulse';
      progressBar.className = 'h-full bg-blue-600 transition-all duration-300';
      progressBar.style.width = `${(stepIndex / 3) * 100}%`;

      if (stepIndex >= 1) step1.classList.add('completed');
      if (stepIndex >= 2) step2.classList.add('completed');
      if (stepIndex >= 3) step3.classList.add('completed');

    } else if (status === 'success') {
      badge.textContent = 'Hoàn tất phân tích';
      badge.className = 'text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded';
      progressBar.className = 'h-full bg-emerald-500 transition-all duration-300';
      progressBar.style.width = '100%';

      [step1, step2, step3].forEach(s => s.classList.add('completed'));

    } else if (status === 'error') {
      // Tuân thủ AI_INSTRUCTIONS: "Đã dừng do lỗi", tuyệt đối không hiện checkmark xanh nếu quy trình bị gián đoạn
      badge.textContent = 'Đã dừng do lỗi';
      badge.className = 'text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200';
      progressBar.className = 'h-full bg-red-500 transition-all duration-300';
      
      [step1, step2, step3].forEach(s => s.classList.add('error'));
    }
  }

  resetAiStepper() {
    const badge = document.getElementById('stepper-badge-status');
    const progressBar = document.getElementById('stepper-progress-bar');
    if (badge) {
      badge.textContent = 'Sẵn sàng';
      badge.className = 'text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded';
    }
    if (progressBar) {
      progressBar.className = 'h-full bg-blue-600 w-0 transition-all duration-300';
      progressBar.style.width = '0%';
    }
    const step1 = document.getElementById('step-item-1');
    const step2 = document.getElementById('step-item-2');
    const step3 = document.getElementById('step-item-3');
    [step1, step2, step3].forEach(s => {
      if (s) s.className = 'step-item flex items-start gap-3';
    });
  }

  renderAiPreview(parsedData) {
    const card = document.getElementById('ai-result-preview-card');
    const list = document.getElementById('preview-records-list');
    const countBadge = document.getElementById('preview-count');
    
    if (!card || !list) return;

    this.pendingAiRecords = parsedData.records || [];
    countBadge.textContent = this.pendingAiRecords.length;

    if (this.pendingAiRecords.length === 0) {
      list.innerHTML = `<p class="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">Không tìm thấy thông tin vi phạm cụ thể trong văn bản đã nhập.</p>`;
      card.classList.remove('hidden');
      return;
    }

    list.innerHTML = this.pendingAiRecords.map((r, idx) => `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${r.student_name || 'Chưa rõ tên'}</span>
            <span class="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded text-[11px]">${r.class_name || 'Chưa rõ lớp'}</span>
            ${r.matched_student ? 
              `<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-semibold">Khớp CSDL</span>` : 
              `<span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-semibold">Tên mới/Chưa khớp</span>`}
          </div>
          <div class="text-slate-700 font-medium flex items-center gap-1.5">
            <span class="text-slate-400">Lỗi quy đổi:</span>
            <strong class="text-slate-900">${r.violation_category}</strong>
            <span class="text-red-600 font-bold bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">-${r.penalty_points}đ</span>
          </div>
          <div class="text-[11px] text-slate-500 italic">
            Ghi chú gốc: "${r.original_text || ''}"
          </div>
        </div>

        <button onclick="window.app.removePendingAiRecord(${idx})" class="text-slate-400 hover:text-red-600 p-1 rounded" title="Bỏ dòng này">
          <i data-lucide="trash" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `).join('');

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

    this.pendingAiRecords.forEach(rec => {
      this.violations.unshift({
        id: Date.now() + Math.random(),
        week: rec.week || this.calculateWeek(rec.date),
        date: rec.date || new Date().toISOString().split('T')[0],
        student_name: rec.student_name,
        class_name: rec.class_name,
        violation_category: rec.violation_category,
        penalty_points: parseFloat(rec.penalty_points) || 0.5,
        original_note: rec.original_text || rec.note || ''
      });
    });

    this.saveViolations();
    this.pendingAiRecords = [];
    document.getElementById('ai-result-preview-card').classList.add('hidden');
    document.getElementById('ai-input-text').value = '';
    this.resetAiStepper();

    this.showToast('Đã lưu các bản ghi vi phạm vào Nhật ký!', 'success');
    this.switchTab('tab-violation-logs');
  }

  // ==================== CHUẨN HÓA LỚP & BỘ LỌC THÔNG MINH ====================

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

          this.violations.unshift({
            id: Date.now(),
            week,
            date: dateVal,
            student_name: name,
            class_name: className,
            violation_category: selectedRule,
            penalty_points: points,
            original_note: 'Nhập thủ công trực tiếp'
          });

          this.saveViolations();

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
    tbody.innerHTML = filtered.map((v, idx) => {
      const isLocked = this.isWeekLocked(v.week);
      let weekBadge = `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">T${v.week}</span>`;
      let deleteBtn = `
        <button onclick="window.app.deleteViolation(${v.id})" class="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer" title="Xóa bản ghi này">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;

      if (isLocked) {
        weekBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1" title="Tuần đã khóa niêm phong"><i data-lucide="lock" class="w-3 h-3 text-amber-600"></i> T${v.week}</span>`;
        deleteBtn = `
          <button disabled class="text-slate-300 p-1 cursor-not-allowed" title="Tuần ${v.week} đã khóa niêm phong (Read-Only)">
            <i data-lucide="lock" class="w-4 h-4 text-slate-300"></i>
          </button>
        `;
      }

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="text-center font-bold text-slate-500">${idx + 1}</td>
          <td class="text-center">${weekBadge}</td>
          <td class="font-medium text-slate-700">${this.formatDate(v.date)}</td>
          <td class="font-bold text-slate-900">${v.student_name}</td>
          <td class="text-center">
            <span class="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">${v.class_name}</span>
          </td>
          <td class="font-semibold text-slate-800">${v.violation_category}</td>
          <td class="text-center">
            <span class="text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs">-${v.penalty_points}đ</span>
          </td>
          <td class="text-slate-500 text-xs italic">${v.original_note || '-'}</td>
          <td class="text-center">${deleteBtn}</td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  deleteViolation(id) {
    const target = this.violations.find(v => String(v.id) === String(id));
    if (target && this.isWeekLocked(target.week)) {
      this.showToast(`Vi phạm này thuộc Tuần ${target.week} đã được khóa niêm phong. Không thể xóa!`, 'error');
      return;
    }

    this.requirePassword(() => {
      if (confirm('Bạn có muốn xóa bản ghi vi phạm này?')) {
        this.trackDeletedViolationId(id);
        this.violations = this.violations.filter(v => String(v.id) !== String(id));
        this.saveViolations();
        this.renderLogsTable();
        this.renderEmulationTable();
        this.showToast('Đã xóa bản ghi vi phạm!', 'info');
      }
    });
  }

  _oldDeleteViolation(id) {
    if (confirm('Bạn có muốn xóa bản ghi vi phạm này?')) {
      this.trackDeletedViolationId(id);
      this.violations = this.violations.filter(v => String(v.id) !== String(id));
      this.saveViolations();
      this.renderLogsTable();
      this.renderEmulationTable();
      this.showToast('Đã xóa bản ghi vi phạm!', 'info');
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

    const data = this.violations.map((v, idx) => ({
      'STT': idx + 1,
      'Tuần': v.week,
      'Ngày vi phạm': this.formatDate(v.date),
      'Họ và Tên': v.student_name,
      'Lớp': v.class_name,
      'Nội dung vi phạm': v.violation_category,
      'Điểm trừ': v.penalty_points,
      'Ghi chú': v.original_note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NhatKyViPham');
    XLSX.writeFile(wb, `NhatKyViPham_THPT_LeHongPhong_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.showToast('Đã tải xuống file Excel Nhật ký vi phạm!', 'success');
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

      // 2. Điểm trừ nề nếp:
      // Tự động liên kết và tính toán trực tiếp từ dữ liệu học sinh vi phạm ghi nhận trên hệ thống web
      let diemTru = 0.0;
      let violationDetails = [];
      if (isLocked && existing && existing.diemTru !== undefined) {
        diemTru = parseFloat(existing.diemTru) || 0.0;
        violationDetails = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === cName);
      } else {
        violationDetails = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === cName);
        if (violationDetails.length > 0) {
          diemTru = violationDetails.reduce((sum, v) => sum + (parseFloat(v.penalty_points !== undefined ? v.penalty_points : (v.points_deducted !== undefined ? v.points_deducted : v.points)) || 0), 0);
        } else if (existing && existing.diemTru !== undefined && existing.diemTru > 0) {
          diemTru = parseFloat(existing.diemTru) || 0.0;
        }
      }

      // 3. Điểm TB Nề nếp = 15' - Điểm trừ
      const tbNenNep = diem15 - diemTru;

      // 4. Điểm TB Chung = ((Điểm TB học tập + TB nề nếp) / 2) + Điểm cộng vào TB
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

    // B. Vị thứ nề nếp
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
        viThuChung: r.viThuChung
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

    // 1. Cập nhật Badge Trạng Thái Khóa Tuần & Nút Mở Khóa / Khóa Tuần
    const statusBadge = document.getElementById('emulation-week-status-badge');
    const btnToggleLock = document.getElementById('btn-toggle-week-lock');

    if (statusBadge) {
      if (isLocked) {
        statusBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-amber-50 text-amber-800 border-amber-300';
        statusBadge.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-amber-600"></i><span>🔒 Tuần đã khóa niêm phong (Read-Only)</span>`;
      } else {
        statusBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-300';
        statusBadge.innerHTML = `<i data-lucide="unlock" class="w-3.5 h-3.5 text-emerald-600"></i><span>🔓 Đang mở nhập liệu / chỉnh sửa</span>`;
      }
    }

    if (btnToggleLock) {
      if (isLocked) {
        btnToggleLock.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer border border-amber-600';
        btnToggleLock.innerHTML = `<i data-lucide="unlock" class="w-3.5 h-3.5"></i><span>🔓 Mở Khóa Tuần (Admin)</span>`;
        btnToggleLock.title = 'Quyền Admin (2806): Mở khóa tuần này để chỉnh sửa dữ liệu';
      } else {
        btnToggleLock.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-800 text-slate-100 transition shadow-xs cursor-pointer border border-slate-600';
        btnToggleLock.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5"></i><span>🔒 Khóa Tuần Này</span>`;
        btnToggleLock.title = 'Khóa niêm phong an toàn tuần này sau khi hoàn tất';
      }
    }

    // 2. Bật/Tắt các nút thao tác theo trạng thái khóa
    const btnAddBonus = document.getElementById('btn-add-bonus-point');
    const btnImport = document.getElementById('btn-open-excel-import');
    const btnSaveTable = document.getElementById('btn-save-emulation-table');
    if (btnAddBonus) {
      btnAddBonus.disabled = isLocked;
      btnAddBonus.className = isLocked ? 
        'flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed' :
        'flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition shadow-xs cursor-pointer';
    }
    if (btnImport) {
      btnImport.disabled = isLocked;
      btnImport.className = isLocked ?
        'flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed' :
        'flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer';
    }
    if (btnSaveTable) {
      btnSaveTable.disabled = isLocked;
      btnSaveTable.className = isLocked ?
        'flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed' :
        'flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer';
    }

    // 3. Cập nhật Banner Tiêu đề
    const bannerTitle = document.getElementById('emulation-banner-title');
    const bannerDates = document.getElementById('emulation-banner-dates');
    if (bannerTitle) bannerTitle.textContent = `TỔNG HỢP THI ĐUA TUẦN ${String(selectedWeek).padStart(2, '0')}`;
    if (bannerDates) bannerDates.textContent = dateRange;

    // 4. Tính toán kết quả cho 29 lớp
    const ranked = this.calculateWeeklyEmulationRankings(selectedWeek);

    // 5. Render từng dòng trong tbody (Chuẩn 21 cột truyền thống - ẨN CỘT ĐIỂM CỘNG RIÊNG)
    tbody.innerHTML = ranked.map(r => {
      // Huy hiệu Vị thứ chung cuộc
      let rankBadge = `<span class="font-extrabold text-slate-700">${r.viThuChung}</span>`;
      if (r.viThuChung === 1) rankBadge = `<span class="rank-1 px-2 py-0.5 rounded-full font-extrabold text-[11px] shadow-xs">🥇 1</span>`;
      else if (r.viThuChung === 2) rankBadge = `<span class="rank-2 px-2 py-0.5 rounded-full font-extrabold text-[11px] shadow-xs">🥈 2</span>`;
      else if (r.viThuChung === 3) rankBadge = `<span class="rank-3 px-2 py-0.5 rounded-full font-extrabold text-[11px] shadow-xs">🥉 3</span>`;

      // Huy hiệu Xếp loại
      let xepLoaiClass = 'bg-slate-100 text-slate-700 border-slate-300';
      if (r.xepLoai === 'X sắc') xepLoaiClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold';
      else if (r.xepLoai === 'Giỏi') xepLoaiClass = 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
      else if (r.xepLoai === 'Khá') xepLoaiClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      else if (r.xepLoai === 'T.bình') xepLoaiClass = 'bg-rose-100 text-rose-900 border-rose-300 font-semibold';

      // Nút xem chi tiết điểm trừ
      const diemTruBadge = `
        <button type="button" onclick="window.app.viewClassViolations(${selectedWeek}, '${r.className}')" 
                class="px-2 py-0.5 rounded font-extrabold text-xs cursor-pointer transition ${r.diemTru > 0 ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}"
                title="Bấm để xem chi tiết học sinh vi phạm của lớp ${r.className}">
          -${r.diemTru.toFixed(1)}đ
        </button>
      `;

      // Cột thao tác sửa nhanh
      const actionCol = isLocked ? `
        <span class="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-semibold" title="Tuần đã khóa niêm phong">
          <i data-lucide="lock" class="w-3.5 h-3.5"></i>
        </span>
      ` : `
        <button type="button" onclick="window.app.openEditClassModal(${selectedWeek}, '${r.className}')"
                class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                title="Sửa nhanh thông tin lớp ${r.className}">
          <i data-lucide="edit-2" class="w-3 h-3"></i>
          <span>Sửa</span>
        </button>
      `;

      const renderCell = (field, val, step = '1') => {
        if (isLocked) {
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
          
          <!-- Cột GVCN SHL -->
          <td class="text-center bg-blue-50/30 border-x border-blue-100">
            ${renderCell('shl', r.shl, '0.5')}
          </td>

          <!-- Giờ Học Tập ABCD -->
          <td class="text-center bg-indigo-50/20">${renderCell('tot', r.tot)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioA', r.gioA)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioB', r.gioB)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioC', r.gioC)}</td>
          <td class="text-center bg-indigo-50/20">${renderCell('gioD', r.gioD)}</td>
          <td class="text-center font-bold text-indigo-900 bg-indigo-50/40">${r.tongTiet}</td>
          <td class="text-center font-extrabold text-indigo-950 bg-indigo-50/60">${r.diemTbHocTap.toFixed(2)}</td>
          <td class="text-center font-bold text-indigo-900 bg-indigo-50/40">${r.viThuHocTap}</td>

          <!-- Nề nếp -->
          <td class="text-center bg-rose-50/20">${renderCell('diem15', r.diem15, '0.1')}</td>
          <td class="text-center bg-rose-50/30">${diemTruBadge}</td>
          <td class="text-center font-extrabold text-rose-950 bg-rose-50/50">${r.tbNenNep.toFixed(2)}</td>
          <td class="text-center font-bold text-rose-900 bg-rose-50/30">${r.viThuNenNep}</td>

          <!-- HS Vắng -->
          <td class="text-center bg-slate-50/50">${renderCell('hsVang', r.hsVang)}</td>
          <td class="text-center font-bold text-slate-700 bg-slate-50/50">${r.viThuVang}</td>

          <!-- Tổng hợp chung (Cột Điểm cộng đã ẩn, TB Chung đã bao gồm điểm cộng) -->
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

    // 6. Tự động tổng hợp và hiển thị phần Ghi chú dưới bảng
    const notesContent = document.getElementById('emulation-notes-content');
    if (notesContent) {
      const bonusList = this.getBonusPointsList(selectedWeek);
      if (!bonusList || bonusList.length === 0) {
        notesContent.innerHTML = '<p class="text-slate-400 italic">Tuần này không có lớp nào được cộng điểm thưởng.</p>';
      } else {
        notesContent.innerHTML = bonusList.map(b => `
          <div class="flex items-start gap-2 font-medium text-slate-800">
            <span class="text-amber-600 font-bold">•</span>
            <span><strong>Lớp ${b.className}</strong> cộng <strong>${b.points}đ</strong>, lý do: <em>${b.reason || 'thực hiện công trình tự giác'}</em>.</span>
          </div>
        `).join('');
      }
    }

    // 7. Cập nhật các khối thống kê cuối trang
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
    const w = parseInt(weekNum, 10);
    if (this.isWeekLocked(w)) {
      this.showToast(`Tuần ${w} đã khóa niêm phong. Không thể chỉnh sửa!`, 'error');
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

  viewClassViolations(weekNum, className) {
    const w = parseInt(weekNum, 10);
    const viols = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === className);

    document.getElementById('modal-class-violations-title').textContent = `Chi Tiết Vi Phạm Lớp ${className} - Tuần ${w}`;
    document.getElementById('modal-class-violations-subtitle').textContent = `Tìm thấy ${viols.length} vụ vi phạm được ghi nhận trong tuần`;

    const totalPts = viols.reduce((s, v) => s + (parseFloat(v.penalty_points) || 0), 0);
    document.getElementById('modal-class-violations-total').textContent = `-${totalPts.toFixed(1)}đ`;

    const tbody = document.getElementById('class-violations-tbody');
    if (tbody) {
      if (viols.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Không có vi phạm nào trong tuần được chọn.</td></tr>`;
      } else {
        tbody.innerHTML = viols.map((v, i) => `
          <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="p-2.5 text-center font-bold text-slate-500">${i + 1}</td>
            <td class="p-2.5 text-slate-600">${this.formatDate(v.date)}</td>
            <td class="p-2.5 font-bold text-slate-900">${v.student_name}</td>
            <td class="p-2.5 text-slate-800 font-semibold">${v.violation_category}</td>
            <td class="p-2.5 text-center font-bold text-red-600">-${v.penalty_points}đ</td>
          </tr>
        `).join('');
      }
    }

    document.getElementById('modal-view-class-violations').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // ==================== ĐIỂM CỘNG VÀO TB (NẾU CÓ) ====================

  loadBonusPoints() {
    const saved = localStorage.getItem('dshs_bonus_points');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {};
  }

  saveBonusPoints() {
    localStorage.setItem('dshs_bonus_points', JSON.stringify(this.bonusPoints));
    this.renderBonusPointsTable();
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
  }

  openBonusModalForClass(className) {
    const emuSelect = document.getElementById('emulation-select-week');
    const w = emuSelect ? emuSelect.value : this.currentWeek;
    this.openBonusModal(w, className);
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

    const encodeCell = (r, c) => XLSX.utils.encode_cell({ r, c });
    const setCell = (r, c, val, type = 's', formula = null) => {
      const ref = encodeCell(r, c);
      const cell = { t: type, v: val };
      if (formula) cell.f = formula;
      ws[ref] = cell;
    };

    // 1. Quốc hiệu & Tên trường (Row 1 & Row 2)
    setCell(0, 0, 'SỞ GIÁO DỤC VÀ ĐÀO TẠO ĐĂK LĂK');
    setCell(1, 0, 'TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG');

    // 2. Tiêu đề Tuần thi đua & Mốc ngày (Row 4 & Row 5)
    setCell(3, 0, `TỔNG HỢP THI ĐUA TUẦN ${String(emuWeek).padStart(2, '0')}`);
    setCell(4, 0, dateRange);

    // 3. Header bảng Row 7 (r=6) & Row 8 (r=7) - Chuẩn 21 cột
    setCell(6, 0, 'TT');
    setCell(6, 1, 'LỚP');
    setCell(6, 2, 'GVCN');
    setCell(6, 4, 'Học tập');
    setCell(6, 12, 'Nề nếp');
    setCell(6, 16, 'HS Vắng');
    setCell(6, 18, 'Tổng hợp chung');

    setCell(7, 4, 'Tốt');
    setCell(7, 5, 'A');
    setCell(7, 6, 'B');
    setCell(7, 7, 'C');
    setCell(7, 8, 'D');
    setCell(7, 9, 'Tổng\ntiết');
    setCell(7, 10, 'Điểm\nTB');
    setCell(7, 11, 'Vị\nthứ');
    setCell(7, 12, "15'");
    setCell(7, 13, 'Điểm\ntrừ');
    setCell(7, 14, 'TB\nNN');
    setCell(7, 15, 'Vị\nthứ');
    setCell(7, 16, 'Tổng');
    setCell(7, 17, 'TT');
    setCell(7, 18, 'TB\nChung');
    setCell(7, 19, 'Xếp\nloại');
    setCell(7, 20, 'Vị\nthứ');

    // 4. Dữ liệu 29 lớp (Row 9 đến Row 37, r=8 đến r=36)
    ranked.forEach((r, idx) => {
      const rowIdx = 8 + idx;
      const rowNum = rowIdx + 1;

      setCell(rowIdx, 0, r.stt, 'n');
      setCell(rowIdx, 1, r.className, 's');

      // Tách GVCN thành Họ đệm (Col C) và Tên (Col D)
      const gvcnParts = (r.gvcn || '').trim().split(' ');
      const gvcnTen = gvcnParts.length > 1 ? gvcnParts.pop() : '';
      const gvcnHo = gvcnParts.join(' ');
      setCell(rowIdx, 2, gvcnHo, 's');
      setCell(rowIdx, 3, gvcnTen, 's');

      // Giờ ABCD
      setCell(rowIdx, 4, r.tot || '', r.tot ? 'n' : 's');
      setCell(rowIdx, 5, r.gioA || '', r.gioA ? 'n' : 's');
      setCell(rowIdx, 6, r.gioB || '', r.gioB ? 'n' : 's');
      setCell(rowIdx, 7, r.gioC || '', r.gioC ? 'n' : 's');
      setCell(rowIdx, 8, r.gioD || '', r.gioD ? 'n' : 's');

      // Tổng tiết & Điểm TB & Vị thứ Học tập (Có công thức live)
      setCell(rowIdx, 9, r.tongTiet, 'n', `SUM(E${rowNum}:I${rowNum})`);
      setCell(rowIdx, 10, r.diemTbHocTap, 'n', `SUM((E${rowNum}*15)+(F${rowNum}*10)+(G${rowNum}*5)+(H${rowNum}*0)+(I${rowNum}*-5))/J${rowNum}`);
      setCell(rowIdx, 11, r.viThuHocTap, 'n', `RANK(K${rowNum},$K$9:$K$37)`);

      // Nề nếp (15', Điểm trừ, TB NN, Vị thứ NN)
      setCell(rowIdx, 12, r.diem15, 'n');
      setCell(rowIdx, 13, r.diemTru, 'n');
      setCell(rowIdx, 14, r.tbNenNep, 'n', `M${rowNum}-N${rowNum}`);
      setCell(rowIdx, 15, r.viThuNenNep, 'n', `RANK(O${rowNum},$O$9:$O$37)`);

      // HS Vắng
      setCell(rowIdx, 16, r.hsVang || '', r.hsVang ? 'n' : 's');
      setCell(rowIdx, 17, r.viThuVang, 'n', `RANK(Q${rowNum},$Q$9:$Q$37,1)`);

      // TB Chung, Xếp loại, Vị thứ Chung cuộc
      const bonusPts = r.bonus || 0;
      const tbChungFormula = bonusPts > 0 ? `(K${rowNum}+O${rowNum})/2+${bonusPts}` : `(K${rowNum}+O${rowNum})/2`;
      setCell(rowIdx, 18, r.tbChung, 'n', tbChungFormula);
      const xepLoaiFormula = `IF(S${rowNum}>=10,"X sắc",IF(AND(S${rowNum}>=9,S${rowNum}<10),"Giỏi",IF(AND(S${rowNum}>=7.5,S${rowNum}<9),"Khá",IF(AND(S${rowNum}>=6.5,S${rowNum}<7.5),"T.bình",IF(AND(S${rowNum}>=5,S${rowNum}<6.5),"Yếu","Kém")))))`;
      setCell(rowIdx, 19, r.xepLoai, 's', xepLoaiFormula);
      setCell(rowIdx, 20, r.viThuChung, 'n', `RANK(S${rowNum},$S$9:$S$37)`);
    });

    // 5. Hàng Tổng giờ dạy học tập (Row 38, r=37)
    setCell(37, 4, ranked.reduce((s, r) => s + r.tot, 0), 'n', 'SUM(E9:E37)');
    setCell(37, 5, ranked.reduce((s, r) => s + r.gioA, 0), 'n', 'SUM(F9:F37)');
    setCell(37, 6, ranked.reduce((s, r) => s + r.gioB, 0), 'n', 'SUM(G9:G37)');
    setCell(37, 7, ranked.reduce((s, r) => s + r.gioC, 0), 'n', 'SUM(H9:H37)');
    setCell(37, 8, ranked.reduce((s, r) => s + r.gioD, 0), 'n', 'SUM(I9:I37)');
    setCell(37, 9, ranked.reduce((s, r) => s + r.tongTiet, 0), 'n', 'SUM(J9:J37)');

    // 6. Khối Tổng Hợp Chung & Ghi Chú Dưới Bảng (Row 39 to 47, r=38 to 46)
    setCell(38, 0, 'TỔNG HỢP CHUNG', 's');

    setCell(39, 0, 'TT', 's');
    setCell(39, 1, 'Nội dung', 's');
    setCell(39, 5, 'T. số', 's');
    setCell(39, 8, 'Ghi chú:', 's');

    setCell(40, 0, 1, 'n');
    setCell(40, 1, 'Tổng học sinh vắng', 's');
    setCell(40, 5, ranked.reduce((s, r) => s + r.hsVang, 0), 'n', 'SUM(Q9:Q37)');

    setCell(41, 0, 2, 'n');
    setCell(41, 1, 'Lớp xếp loại Xuất sắc', 's');
    setCell(41, 5, ranked.filter(r => r.xepLoai === 'X sắc').length, 'n', 'COUNTIF(T9:T37,"X sắc")');

    setCell(42, 0, 3, 'n');
    setCell(42, 1, 'Lớp xếp loại Giỏi', 's');
    setCell(42, 5, ranked.filter(r => r.xepLoai === 'Giỏi').length, 'n', 'COUNTIF(T9:T37,"Giỏi")');

    setCell(43, 0, 4, 'n');
    setCell(43, 1, 'Lớp xếp loại Khá', 's');
    setCell(43, 5, ranked.filter(r => r.xepLoai === 'Khá').length, 'n', 'COUNTIF(T9:T37,"Khá")');

    setCell(44, 0, 5, 'n');
    setCell(44, 1, 'Lớp xếp loại Trung bình', 's');
    setCell(44, 5, ranked.filter(r => r.xepLoai === 'T.bình').length, 'n', 'COUNTIF(T9:T37,"T.bình")');

    setCell(45, 0, 6, 'n');
    setCell(45, 1, 'Lớp xếp loại Yếu', 's');
    setCell(45, 5, ranked.filter(r => r.xepLoai === 'Yếu').length, 'n', 'COUNTIF(T9:T37,"Yếu")');

    setCell(46, 0, 7, 'n');
    setCell(46, 1, 'Lớp xếp loại Kém', 's');
    setCell(46, 5, ranked.filter(r => r.xepLoai === 'Kém').length, 'n', 'COUNTIF(T9:T37,"Kém")');

    // Điền rõ ràng từng dòng Ghi chú điểm cộng vào Cột I (r=40 đến r=50)
    if (bonusList && bonusList.length > 0) {
      bonusList.forEach((b, idx) => {
        const noteRow = 40 + idx;
        if (noteRow <= 50) {
          const noteText = `Lớp ${b.className} cộng ${b.points}đ, lý do: ${b.reason || 'thực hiện công trình tự giác'}`;
          setCell(noteRow, 8, noteText, 's');
        }
      });
    } else {
      setCell(40, 8, 'Tuần này không có điểm cộng.', 's');
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
      { s: { r: 6, c: 12 }, e: { r: 6, c: 15 } }, // Nề nếp
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

    // 8. Thiết lập độ rộng cột (Column widths)
    ws['!cols'] = [
      { wch: 4 },  // A: TT
      { wch: 8 },  // B: LỚP
      { wch: 16 }, // C: GVCN Họ
      { wch: 8 },  // D: GVCN Tên
      { wch: 5 },  // E: Tốt
      { wch: 5 },  // F: A
      { wch: 4 },  // G: B
      { wch: 4 },  // H: C
      { wch: 4 },  // I: D
      { wch: 7 },  // J: Tổng tiết
      { wch: 8 },  // K: Điểm TB
      { wch: 6 },  // L: Vị thứ
      { wch: 6 },  // M: 15'
      { wch: 7 },  // N: Điểm trừ
      { wch: 6 },  // O: TB NN
      { wch: 6 },  // P: Vị thứ
      { wch: 6 },  // Q: HS vắng
      { wch: 5 },  // R: TT vắng
      { wch: 8 },  // S: TB Chung
      { wch: 8 },  // T: Xếp loại
      { wch: 6 }   // U: Vị thứ
    ];

    const maxRow = Math.max(47, 40 + (bonusList ? bonusList.length : 0));
    ws['!ref'] = `A1:U${maxRow}`;

    const sheetName = `T${emuWeek}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `TONG_HOP_THI_DUA_TUAN_${String(emuWeek).padStart(2, '0')}_THPT_LeHongPhong.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.showToast(`Đã xuất báo cáo trang tính ${fileName} theo chuẩn mẫu của trường!`, 'success');
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

    let md = `| Hạng | Lớp | GVCN | SHL | TB Học Tập | TB Nề Nếp | Điểm Trừ | Điểm Cộng | TB Chung | Xếp Loại |
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
          <button type="button" onclick="window.app.restoreSnapshot('${s.id}')"
                  class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[11px] shadow-xs cursor-pointer flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
            <span>Khôi phục</span>
          </button>
          <button type="button" onclick="window.app.deleteSnapshot('${s.id}')"
                  class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
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

      this.showToast(`Đã khôi phục thành công về mốc: "${snap.name}"!`, 'success');
    });
  }

  deleteSnapshot(snapId) {
    if (!confirm('Bạn có chắc chắn muốn xóa mốc khôi phục này không?')) return;
    this.snapshots = this.snapshots.filter(s => s.id !== snapId);
    this.saveSnapshots();
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
    if (entered !== this.PASSWORD_CONFIG) {
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

  // ==================== QUẢN LÝ HỌC SINH (TAB 4 - NGUỒN MỞ) ====================

  renderStudentsTable() {
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
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="window.app.editStudent(${s.id})" class="text-slate-400 hover:text-blue-600 p-1" title="Sửa học sinh">
              <i data-lucide="edit" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="window.app.deleteStudent(${s.id})" class="text-slate-400 hover:text-red-600 p-1" title="Xóa học sinh">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
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
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.app.editRule(${r.id})" class="text-slate-400 hover:text-blue-600 p-1" title="Sửa quy định">
                <i data-lucide="edit" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.app.deleteRule(${r.id})" class="text-slate-400 hover:text-red-600 p-1" title="Xóa quy định">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openRuleModal(rule = null) {
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

        document.getElementById('display-current-model-tag').textContent = modelId;
        this.updateBadges();
        modal.classList.add('hidden');
        this.showToast('Đã lưu thiết lập Gemini API Key và Model thành công!', 'success');
      });
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
    const modal = document.getElementById('modal-settings');
    const inputKey = document.getElementById('input-api-key');
    inputKey.value = window.geminiService.getApiKey();

    const currentModel = window.geminiService.getSelectedModel();
    this.selectModelCard(currentModel);

    modal.classList.remove('hidden');
    inputKey.focus();
  }

  selectModelCard(modelId) {
    document.querySelectorAll('.model-card').forEach(card => {
      const isMatch = card.getAttribute('data-model') === modelId;
      const radio = card.querySelector('input[type="radio"]');
      if (isMatch) {
        card.classList.add('selected');
        if (radio) radio.checked = true;
      } else {
        card.classList.remove('selected');
        if (radio) radio.checked = false;
      }
    });
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

  // ==================== BẢO VỆ MẬT KHẨU NHẬP LIỆU (2806) ====================

  setupPasswordAuth() {
    this.PASSWORD_CONFIG = "2806";
    this.pendingAction = null;

    const btnToggleLock = document.getElementById('btn-toggle-auth-lock');
    const modalPass = document.getElementById('modal-login-password');
    const formPass = document.getElementById('form-login-password');
    const btnCancel = document.getElementById('btn-cancel-password-modal');
    const inputPass = document.getElementById('login-password');

    this.updateLockStatusUI();

    if (inputPass) {
      // Tắt triệt để tính năng gợi ý và lưu mật khẩu của trình duyệt
      inputPass.setAttribute('autocomplete', 'off');
      inputPass.setAttribute('name', 'lhp_otp_token');
      inputPass.setAttribute('autocorrect', 'off');
      inputPass.setAttribute('autocapitalize', 'off');
      inputPass.setAttribute('spellcheck', 'false');
      inputPass.setAttribute('data-lpignore', 'true');
      inputPass.setAttribute('data-1p-ignore', 'true');
      inputPass.setAttribute('data-form-type', 'other');

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
      if (confirm('Bạn đang ở trạng thái đã đăng nhập. Bạn có muốn đăng xuất để chuyển sang chế độ Chỉ xem (Read-only) không?')) {
        sessionStorage.removeItem('data_entry_unlocked');
        localStorage.removeItem('data_entry_unlocked');
        this.updateLockStatusUI();
        this.showToast('Đã chuyển sang chế độ chỉ xem.', 'info');
      }
    } else {
      this.openPasswordModal();
    }
  }

  isDataEntryUnlocked() {
    return sessionStorage.getItem('data_entry_unlocked') === 'true';
  }

  updateLockStatusUI() {
    const text = document.getElementById('lock-status-text');
    const icon = document.getElementById('lock-icon');
    const btn = document.getElementById('btn-toggle-auth-lock');
    const isUnlocked = this.isDataEntryUnlocked();

    if (text) {
      text.textContent = isUnlocked ? '🔓 Đã đăng nhập' : '🔒 Đăng nhập';
    }
    if (icon) {
      icon.setAttribute('data-lucide', isUnlocked ? 'unlock' : 'lock');
      icon.setAttribute('class', isUnlocked ? 'w-4 h-4 text-emerald-400 pointer-events-none' : 'w-4 h-4 text-amber-400 pointer-events-none');
    }
    if (btn) {
      btn.className = isUnlocked 
        ? 'flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer'
        : 'flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer';
    }

    const btnManualAdd = document.getElementById('btn-manual-add');
    if (btnManualAdd) {
      if (isUnlocked) {
        btnManualAdd.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 pointer-events-none"></i><span>Thêm Lỗi</span>`;
        btnManualAdd.className = 'w-full text-sm font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl transition shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer';
      } else {
        btnManualAdd.innerHTML = `<i data-lucide="lock" class="w-4 h-4 pointer-events-none text-amber-300"></i><span>Thêm Lỗi (Cần Đăng Nhập)</span>`;
        btnManualAdd.className = 'w-full text-sm font-bold bg-slate-700 hover:bg-slate-800 text-slate-200 p-3.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer';
      }
    }

    const btnRunAi = document.getElementById('btn-run-ai-parse');
    if (btnRunAi) {
      if (isUnlocked) {
        btnRunAi.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 pointer-events-none"></i><span>Bắt Đầu Chuẩn Hóa Bằng AI</span>`;
        btnRunAi.className = 'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/25 cursor-pointer';
      } else {
        btnRunAi.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 pointer-events-none text-amber-300"></i><span>Bắt Đầu Chuẩn Hóa AI (Cần Đăng Nhập)</span>`;
        btnRunAi.className = 'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl transition shadow-sm cursor-pointer';
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openPasswordModal(onSuccess = null) {
    this.pendingAction = onSuccess;
    const modal = document.getElementById('modal-login-password');
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    
    if (err) {
      err.textContent = 'Đăng nhập không thành công!';
      err.classList.add('hidden');
      err.style.display = 'none';
    }
    if (input) {
      input.value = '';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('name', 'lhp_otp_token');
      input.classList.remove('border-red-500', 'bg-red-50');
      input.classList.add('border-slate-300');
    }
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      setTimeout(() => {
        if (input) input.focus();
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
      input.setAttribute('autocomplete', 'off');
      input.classList.remove('border-red-500', 'bg-red-50');
      input.classList.add('border-slate-300');
    }
    this.pendingAction = null;
  }

  submitPassword() {
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    const entered = (input ? input.value : '').trim();

    if (entered === this.PASSWORD_CONFIG) {
      try {
        sessionStorage.setItem('data_entry_unlocked', 'true');
        
        // 1. Tự động đóng (ẩn) hộp thoại đăng nhập ngay lập tức không độ trễ
        this.closePasswordModal();

        // 2. Cập nhật giao diện mở khóa
        this.updateLockStatusUI();
        
        // 3. Hiển thị thông báo "Đăng nhập thành công"
        this.showToast('Đăng nhập thành công!', 'success');

        if (typeof this.pendingAction === 'function') {
          const action = this.pendingAction;
          this.pendingAction = null;
          action();
        }
      } catch (err) {
        console.error('LỖI trong submitPassword:', err);
      }
    } else {
      // 3. Nếu sai mật khẩu, hiển thị thông báo "Đăng nhập không thành công!" trực tiếp trên modal
      if (err) {
        err.textContent = 'Đăng nhập không thành công!';
        err.classList.remove('hidden');
        err.style.display = 'block';
      }
      if (input) {
        input.classList.remove('border-slate-300');
        input.classList.add('border-red-500', 'bg-red-50');
        input.select();
        input.focus();
      }
      this.showToast('Đăng nhập không thành công! Vui lòng thử lại.', 'error');
    }
  }

  requirePassword(onSuccess) {
    if (this.isDataEntryUnlocked()) {
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      this.openPasswordModal(onSuccess);
    }
  }

  // ==================== CƠ SỞ DỮ LIỆU ĐÁM MÂY (CLOUD DATABASE) ====================

  get DEFAULT_CLOUD_URL() {
    return 'https://kvdb.io/UiyqhMqb9xKt19ZniuwjeH/violations';
  }

  getCloudUrl() {
    return localStorage.getItem('dshs_cloud_url') || this.DEFAULT_CLOUD_URL;
  }

  setCloudUrl(url) {
    if (url && url.trim()) {
      localStorage.setItem('dshs_cloud_url', url.trim());
    } else {
      localStorage.removeItem('dshs_cloud_url');
    }
  }

  loadDeletedViolationIds() {
    try {
      const saved = localStorage.getItem('dshs_deleted_violations_ids');
      return new Set(saved ? JSON.parse(saved).map(String) : []);
    } catch (e) {
      return new Set();
    }
  }

  trackDeletedViolationId(id) {
    if (!this.deletedViolationIds) {
      this.deletedViolationIds = new Set();
    }
    if (!id) return;
    this.deletedViolationIds.add(String(id));
    try {
      localStorage.setItem('dshs_deleted_violations_ids', JSON.stringify(Array.from(this.deletedViolationIds)));
    } catch (e) {}
  }

  updateCloudStatusBadge(isOnline = true) {
    const badge = document.getElementById('cloud-sync-badge');
    const indicatorText = document.getElementById('cloud-status-indicator-text');
    const indicator = document.getElementById('cloud-status-indicator');

    if (badge) {
      badge.className = isOnline 
        ? 'w-2 h-2 rounded-full bg-emerald-500' 
        : 'w-2 h-2 rounded-full bg-amber-500';
      badge.title = isOnline 
        ? 'Cloud Database: Đang kết nối thông suốt' 
        : 'Cloud Database: Ngoại tuyến (Đã lưu trên máy)';
    }

    if (indicatorText) {
      indicatorText.textContent = isOnline ? 'Đang kết nối' : 'Ngoại tuyến';
    }
    if (indicator) {
      indicator.className = isOnline
        ? 'text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5'
        : 'text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5';
    }
  }

  async pushToCloud(silent = true) {
    const cloudUrl = this.getCloudUrl();
    if (!cloudUrl) return false;

    try {
      let method = 'POST';
      let headers = { 'Content-Type': 'application/json' };

      // Hỗ trợ Firebase Realtime Database REST API (sử dụng method PUT)
      if (cloudUrl.includes('.firebaseio.com') || cloudUrl.includes('.firebasedatabase.app')) {
        method = 'PUT';
      }

      const payload = {
        version: 2,
        updated_at: Date.now(),
        violations: this.violations,
        deleted_ids: Array.from(this.deletedViolationIds || [])
      };

      const res = await fetch(cloudUrl, {
        method: method,
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        localStorage.setItem('dshs_last_sync_time', new Date().toISOString());
        this.updateCloudStatusBadge(true);
        if (!silent) {
          this.showToast(`Đã đồng bộ an toàn ${this.violations.length} bản ghi vi phạm lên Cloud!`, 'success');
        }
        return true;
      } else {
        console.warn('Cloud Database push returned status:', res.status);
        this.updateCloudStatusBadge(false);
        return false;
      }
    } catch (err) {
      console.warn('Không thể gửi dữ liệu lên Cloud Database:', err);
      this.updateCloudStatusBadge(false);
      return false;
    }
  }

  async pullAndMergeFromCloud(silent = true) {
    const cloudUrl = this.getCloudUrl();
    if (!cloudUrl) return false;

    // Giới hạn tần suất gọi tối thiểu 2 giây giữa các lần để tránh nghẽn mạng
    const now = Date.now();
    if (this._lastPullTime && (now - this._lastPullTime < 2000)) {
      return false;
    }
    this._lastPullTime = now;

    try {
      const res = await fetch(`${cloudUrl}?t=${now}`);
      if (!res.ok) {
        return false;
      }

      let data = await res.json();
      let cloudViolations = [];
      let cloudDeletedIds = [];

      if (Array.isArray(data)) {
        cloudViolations = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.violations)) {
          cloudViolations = data.violations;
          if (Array.isArray(data.deleted_ids)) {
            cloudDeletedIds = data.deleted_ids;
          }
        } else {
          cloudViolations = Object.values(data);
        }
      }

      // 1. Đồng bộ danh sách ID đã xóa từ Cloud về máy này
      if (cloudDeletedIds.length > 0) {
        cloudDeletedIds.forEach(id => {
          if (id) this.deletedViolationIds.add(String(id));
        });
        localStorage.setItem('dshs_deleted_violations_ids', JSON.stringify(Array.from(this.deletedViolationIds)));
      }

      // 2. Lọc bỏ các bản ghi cục bộ nếu đã bị xóa trên thiết bị khác
      const initialCount = this.violations.length;
      this.violations = this.violations.filter(v => v && v.id && !this.deletedViolationIds.has(String(v.id)));

      // 3. Nạp danh sách vi phạm cục bộ hiện hành (bỏ qua những id đã bị xóa)
      const localMap = new Map();
      this.violations.forEach(v => {
        if (v && v.id && !this.deletedViolationIds.has(String(v.id))) {
          localMap.set(String(v.id), v);
        }
      });

      let hasNewFromCloud = false;

      // 4. Hợp nhất dữ liệu mới từ Cloud (từ các thiết bị khác như điện thoại)
      cloudViolations.forEach(cv => {
        if (cv && cv.id && !this.deletedViolationIds.has(String(cv.id))) {
          if (!localMap.has(String(cv.id))) {
            localMap.set(String(cv.id), cv);
            hasNewFromCloud = true;
          }
        }
      });

      // 5. Sắp xếp lại danh sách hợp nhất theo thứ tự thời gian/ID
      const mergedList = Array.from(localMap.values()).sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || 0) - (a.id || 0);
      });

      const oldCount = this.violations.length;
      const dataChanged = hasNewFromCloud || (initialCount !== oldCount) || (mergedList.length !== oldCount);
      this.violations = mergedList;
      localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
      this.updateBadges();

      if (dataChanged) {
        this.renderLogsTable();
        this.renderEmulationTable();
        // Đẩy lại toàn bộ danh sách hợp nhất lên Cloud để 2 bên đồng nhất 100%
        this.pushToCloud(true);
      }

      localStorage.setItem('dshs_last_sync_time', new Date().toISOString());
      this.updateCloudStatusBadge(true);
      return true;
    } catch (err) {
      console.warn('Lỗi khi tải dữ liệu từ Cloud Database:', err);
      this.updateCloudStatusBadge(false);
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
      const pullSuccess = await this.pullAndMergeFromCloud(silent);
      if (pullSuccess) {
        await this.pushToCloud(true);
        if (!silent) {
          this.showToast(`Đồng bộ Cloud thành công! Có ${this.violations.length} bản ghi vi phạm được bảo vệ an toàn.`, 'success');
        }
      } else {
        // Nếu không kéo được, thử đẩy dữ liệu hiện có lên cloud
        const pushSuccess = await this.pushToCloud(true);
        if (pushSuccess && !silent) {
          this.showToast(`Đã đồng bộ ${this.violations.length} bản ghi vi phạm lên Cloud!`, 'success');
        } else if (!silent) {
          this.showToast('Không thể kết nối Cloud. Đang hoạt động Offline (Dữ liệu đã lưu an toàn trên máy).', 'warning');
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
      this.showToast('Vui lòng nhập địa chỉ Cloud Endpoint!', 'error');
      return;
    }

    this.showToast('Đang kiểm tra kết nối Cloud Database...', 'info');
    try {
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 0);
        this.setCloudUrl(url);
        this.updateCloudStatusBadge(true);
        this.showToast(`Kết nối Cloud thành công! Tìm thấy ${count} bản ghi vi phạm trên Đám mây.`, 'success');
        this.syncCloudData(true);
      } else {
        this.updateCloudStatusBadge(false);
        this.showToast(`Không thể kết nối Cloud (Mã phản hồi HTTP ${res.status})`, 'error');
      }
    } catch (e) {
      this.updateCloudStatusBadge(false);
      this.showToast(`Lỗi kết nối: ${e.message}`, 'error');
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
