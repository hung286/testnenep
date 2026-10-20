/**
 * ỨNG DỤNG ĐIỀU PHỐI NỀ NẾP & THI ĐUA HỌC ĐƯỜNG - THPT LÊ HỒNG PHONG
 * Xây dựng theo Custom System Instruction & AI_INSTRUCTIONS.md
 */

class DisciplineApp {
  constructor() {
    this.startDate = new Date(2026, 8, 7); // Thứ Hai, 07/09/2026 (Tuần 1)
    
    // Khởi tạo State từ LocalStorage hoặc dữ liệu mặc định
    this.students = this.loadStudents();
    this.rules = this.loadRules();
    this.violations = this.loadViolations();
    
    this.activeTab = 'tab-ai-logger';
    this.pendingAiRecords = [];
    this.editingStudentId = null;
    this.editingRuleId = null;
    this.importPreviewData = [];

    // Charts
    this.classPenaltyChart = null;
    this.topErrorsChart = null;

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
    // Dữ liệu mẫu ban đầu từ Form Nhap Lieu (Tuần 7)
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
    ];
  }

  saveViolations() {
    localStorage.setItem('dshs_violations', JSON.stringify(this.violations));
    this.updateBadges();
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

    this.syncCloudData(true);
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

      dateInput.addEventListener('change', (e) => {
        const w = this.calculateWeek(e.target.value);
        document.getElementById('display-computed-week').textContent = `Tuần ${w}`;
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
      const hasKey = !!window.geminiService.getApiKey();
      keyIndicator.className = hasKey ? 'w-2 h-2 rounded-full bg-emerald-500' : 'w-2 h-2 rounded-full bg-red-500 animate-ping';
    }
  }

  populateDropdowns() {
    // 1. Populate class dropdowns
    const uniqueClasses = Array.from(new Set(this.students.map(s => s.class))).sort();
    
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

    // 2. Populate week dropdowns
    const currentWeek = this.calculateWeek(new Date());
    const maxWeeks = Math.max(35, currentWeek + 2);
    
    const logWeekSelect = document.getElementById('log-filter-week');
    if (logWeekSelect) {
      let options = '<option value="all">Tất cả các tuần</option>';
      for (let w = 1; w <= maxWeeks; w++) {
        const isCurrent = w === currentWeek ? ' (Hiện tại)' : '';
        options += `<option value="${w}" ${w === currentWeek ? 'selected' : ''}>Tuần ${w}${isCurrent}</option>`;
      }
      logWeekSelect.innerHTML = options;
    }

    const emuWeekSelect = document.getElementById('emulation-select-week');
    if (emuWeekSelect) {
      let options = '<option value="all">Toàn bộ năm học (Lũy kế)</option>';
      for (let w = 1; w <= maxWeeks; w++) {
        const isCurrent = w === currentWeek ? ' (Hiện tại)' : '';
        options += `<option value="${w}" ${w === currentWeek ? 'selected' : ''}>Tuần ${w}${isCurrent}</option>`;
      }
      emuWeekSelect.innerHTML = options;
    }

    // 3. Populate manual rule select
    const manualRuleSelect = document.getElementById('manual-rule-select');
    if (manualRuleSelect) {
      manualRuleSelect.innerHTML = '<option value="">-- Chọn lỗi vi phạm --</option>' +
        this.rules.map(r => `<option value="${r.name}" data-points="${r.points}">${r.name} (-${r.points}đ)</option>`).join('');
    }
  }

  // ==================== BỘ NÃO AI GIÁM THỊ (AI LOGGER) ====================

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

    // Bộ lọc Xếp hạng
    const emuWeek = document.getElementById('emulation-select-week');
    if (emuWeek) {
      emuWeek.addEventListener('change', () => {
        this.renderEmulationTable();
        this.updateCharts();
      });
    }

    // Nút copy & xuất Xếp hạng
    const btnCopyMdEmu = document.getElementById('btn-copy-markdown-emulation');
    if (btnCopyMdEmu) btnCopyMdEmu.addEventListener('click', () => this.copyEmulationMarkdown());

    const btnExportExcelEmu = document.getElementById('btn-export-excel-emulation');
    if (btnExportExcelEmu) btnExportExcelEmu.addEventListener('click', () => this.exportEmulationExcel());

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
        if (confirm('Khôi phục danh sách gốc 1.226 học sinh THPT Lê Hồng Phong?')) {
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
                <span class="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
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
                <span class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
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

  // ==================== BẢO VỆ MẬT KHẨU NHẬP LIỆU (lhp38) ====================

  setupPasswordAuth() {
    this.PASSWORD_CONFIG = "lhp38";
    this.pendingAction = null;

    const btnToggleLock = document.getElementById('btn-toggle-auth-lock');
    const modalPass = document.getElementById('modal-login-password');
    const formPass = document.getElementById('form-login-password');
    const btnCancel = document.getElementById('btn-cancel-password-modal');

    this.updateLockStatusUI();

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
    return sessionStorage.getItem('data_entry_unlocked') === 'true' || localStorage.getItem('data_entry_unlocked') === 'true';
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
      icon.className = isUnlocked ? 'w-4 h-4 text-emerald-400 pointer-events-none' : 'w-4 h-4 text-amber-400 pointer-events-none';
    }
    if (btn) {
      btn.className = isUnlocked 
        ? 'flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer'
        : 'flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-xl transition shadow-sm min-h-[44px] cursor-pointer';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  openPasswordModal(onSuccess = null) {
    this.pendingAction = onSuccess;
    const modal = document.getElementById('modal-login-password');
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    
    if (err) {
      err.classList.add('hidden');
      err.style.display = 'none';
    }
    if (input) {
      input.value = '';
      input.setAttribute('autocomplete', 'new-password');
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
    }
    if (input) {
      input.value = '';
    }
    this.pendingAction = null;
  }

  submitPassword() {
    const input = document.getElementById('login-password');
    const err = document.getElementById('password-error-msg');
    const entered = (input ? input.value : '').trim();

    if (entered === this.PASSWORD_CONFIG) {
      sessionStorage.setItem('data_entry_unlocked', 'true');
      localStorage.setItem('data_entry_unlocked', 'true');
      this.updateLockStatusUI();
      this.closePasswordModal();
      this.showToast('Đăng nhập thành công!', 'success');

      if (typeof this.pendingAction === 'function') {
        const action = this.pendingAction;
        this.pendingAction = null;
        action();
      }
    } else {
      if (err) {
        err.textContent = 'Đăng nhập không thành công!';
        err.classList.remove('hidden');
        err.style.display = 'block';
      }
      this.showToast('Đăng nhập không thành công!', 'error');
      if (input) {
        input.select();
        input.focus();
      }
    }
  }

  requirePassword(onSuccess) {
    if (this.isDataEntryUnlocked()) {
      onSuccess();
    } else {
      this.openPasswordModal(onSuccess);
    }
  }

  // ==================== ĐỒNG BỘ DỮ LIỆU ĐÁM MÂY (GITHUB / VERCEL & LOCAL) ====================

  async syncCloudData(silent = false) {
    const btn = document.getElementById('btn-cloud-sync');
    if (btn) btn.classList.add('animate-pulse');

    try {
      const res = await fetch(`./data_violations.json?t=${Date.now()}`);
      if (res.ok) {
        const cloudViolations = await res.json();
        if (Array.isArray(cloudViolations) && cloudViolations.length > 0) {
          const existingIds = new Set(this.violations.map(v => String(v.id)));
          let added = 0;
          for (const cv of cloudViolations) {
            if (!existingIds.has(String(cv.id))) {
              this.violations.push(cv);
              existingIds.add(String(cv.id));
              added++;
            }
          }
          if (added > 0) {
            this.saveViolations();
            this.renderLogsTable();
            this.renderEmulationTable();
          }
        }
      }

      this.saveViolations();

      if (!silent) {
        this.showToast('Đồng bộ dữ liệu thời gian thực thành công!', 'success');
      }
    } catch (err) {
      console.warn('Lỗi khi đồng bộ dữ liệu đám mây:', err);
      if (!silent) {
        this.showToast('Đã lưu dữ liệu trên thiết bị.', 'info');
      }
    } finally {
      if (btn) btn.classList.remove('animate-pulse');
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
