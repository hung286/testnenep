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
      try { return JSON.parse(saved); } catch (e) { }
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
    this.setupDateAndTime();
    this.setupTabs();
    this.setupEventListeners();
    this.setupSettingsModal();
    this.setupManualEntry();
    this.setupAuth();
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

    // Kiểm tra API Key lần đầu
    this.checkApiKeyPrompt();
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

  // ==================== NHẬP LIỆU THỦ CÔNG (AUTOCOMPLETE) ====================

  setupManualEntry() {
    const studentInput = document.getElementById('manual-student-input');
    const autoList = document.getElementById('autocomplete-list');
    const btnAdd = document.getElementById('btn-manual-add');

    if (!studentInput || !autoList) return;

    studentInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q || q.length < 2) {
        autoList.classList.add('hidden');
        return;
      }

      const matches = this.students.filter(s => 
        s.name.toLowerCase().includes(q) || s.class.toLowerCase().includes(q)
      ).slice(0, 10);

      if (matches.length === 0) {
        autoList.innerHTML = `<div class="p-2 text-slate-400 italic">Không tìm thấy học sinh phù hợp</div>`;
      } else {
        autoList.innerHTML = matches.map(s => `
          <div class="p-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex items-center justify-between"
               onclick="window.app.selectManualStudent('${s.name}', '${s.class}')">
            <span class="font-bold text-slate-800">${s.name}</span>
            <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold">${s.class}</span>
          </div>
        `).join('');
      }
      autoList.classList.remove('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!studentInput.contains(e.target) && !autoList.contains(e.target)) {
        autoList.classList.add('hidden');
      }
    });

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const studentVal = studentInput.value.trim();
        const ruleSelect = document.getElementById('manual-rule-select');
        const selectedRule = ruleSelect.value;
        const selectedOption = ruleSelect.options[ruleSelect.selectedIndex];
        const points = selectedOption ? parseFloat(selectedOption.getAttribute('data-points')) || 0.5 : 0.5;

        if (!studentVal) {
          this.showToast('Vui lòng nhập tên hoặc chọn học sinh.', 'warning');
          return;
        }
        if (!selectedRule) {
          this.showToast('Vui lòng chọn lỗi vi phạm.', 'warning');
          return;
        }

        // Tách Họ tên và Lớp nếu có dạng "Tên - Lớp" hoặc "Tên (Lớp)"
        let name = studentVal;
        let className = 'Chưa rõ';
        const matchBracket = studentVal.match(/^(.*?)[\s\-\(]+([0-9]{2}[A-Za-z][0-9]{2})[\)]?$/);
        if (matchBracket) {
          name = matchBracket[1].trim();
          className = matchBracket[2].trim().toUpperCase();
        }

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
          original_note: 'Nhập thủ công tại form nhanh'
        });

        this.saveViolations();
        studentInput.value = '';
        ruleSelect.value = '';
        this.renderLogsTable();
        this.renderEmulationTable();
        this.showToast(`Đã thêm vi phạm của ${name} (${className})!`, 'success');
      });
    }
  }

  selectManualStudent(name, className) {
    const input = document.getElementById('manual-student-input');
    const autoList = document.getElementById('autocomplete-list');
    if (input) input.value = `${name} - Lớp ${className}`;
    if (autoList) autoList.classList.add('hidden');
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
    tbody.innerHTML = filtered.map((v, idx) => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="text-center font-bold text-slate-500">${idx + 1}</td>
        <td class="text-center">
          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">T${v.week}</span>
        </td>
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
        <td class="text-center">
          <button onclick="window.app.deleteViolation(${v.id})" class="text-slate-400 hover:text-red-600 p-1 rounded" title="Xóa bản ghi này">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  deleteViolation(id) {
    if (confirm('Bạn có muốn xóa bản ghi vi phạm này?')) {
      this.violations = this.violations.filter(v => v.id !== id);
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

  // ==================== BẢNG XẾP HẠNG & THI ĐUA (TAB 3) ====================

  calculateEmulationData(selectedWeek) {
    // Thu thập tất cả 29 lớp
    const uniqueClasses = Array.from(new Set(this.students.map(s => s.class))).sort();
    
    // Lọc vi phạm theo tuần
    const relevantViolations = this.violations.filter(v => {
      if (selectedWeek === 'all') return true;
      return String(v.week) === String(selectedWeek);
    });

    // Thống kê theo lớp
    const classStats = {};
    uniqueClasses.forEach(c => {
      classStats[c] = {
        className: c,
        totalErrors: 0,
        totalPenalty: 0.0,
        details: []
      };
    });

    relevantViolations.forEach(v => {
      if (!classStats[v.class_name]) {
        classStats[v.class_name] = {
          className: v.class_name,
          totalErrors: 0,
          totalPenalty: 0.0,
          details: []
        };
      }
      classStats[v.class_name].totalErrors += 1;
      classStats[v.class_name].totalPenalty += parseFloat(v.penalty_points) || 0;
      classStats[v.class_name].details.push(v);
    });

    // Chuyển sang mảng và xếp hạng: Ít điểm trừ nhất xếp HẠNG 1
    const ranked = Object.values(classStats).sort((a, b) => {
      if (a.totalPenalty !== b.totalPenalty) {
        return a.totalPenalty - b.totalPenalty; // ít điểm phạt hơn xếp trên
      }
      return a.totalErrors - b.totalErrors; // ít lỗi hơn xếp trên
    });

    // Gán thứ hạng
    ranked.forEach((item, index) => {
      item.rank = index + 1;
      if (item.totalPenalty === 0) {
        item.status = 'Xuất sắc';
        item.statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        item.comment = 'Giữ vững nề nếp hoàn hảo, không có lỗi vi phạm.';
      } else if (item.totalPenalty <= 2.0) {
        item.status = 'Tốt';
        item.statusClass = 'bg-blue-100 text-blue-800 border-blue-300';
        item.comment = 'Thực hiện tốt nội quy, duy trì phong độ thi đua.';
      } else if (item.totalPenalty <= 4.0) {
        item.status = 'Khá';
        item.statusClass = 'bg-amber-100 text-amber-800 border-amber-300';
        item.comment = 'Cần lưu ý nhắc nhở các học sinh vi phạm giờ giấc / đồng phục.';
      } else {
        item.status = 'Trung bình';
        item.statusClass = 'bg-red-100 text-red-800 border-red-300';
        item.comment = 'Nhiều lỗi vi phạm trong tuần, GVCN cần chấn chỉnh nề nếp.';
      }
    });

    return ranked;
  }

  renderEmulationTable() {
    const tbody = document.getElementById('emulation-table-body');
    const emuWeek = document.getElementById('emulation-select-week').value;
    const title = document.getElementById('emulation-table-title');

    if (!tbody) return;

    if (title) {
      title.textContent = emuWeek === 'all' ? 
        'Bảng Tổng Hợp & Xếp Hạng Thi Đua Toàn Năm Học' : 
        `Bảng Tổng Hợp & Xếp Hạng Thi Đua - TUẦN ${emuWeek}`;
    }

    const ranked = this.calculateEmulationData(emuWeek);

    tbody.innerHTML = ranked.map(item => {
      let rankBadge = `<span class="font-bold text-slate-700">${item.rank}</span>`;
      if (item.rank === 1) rankBadge = `<span class="rank-1 px-2.5 py-1 rounded-full font-extrabold text-xs shadow-xs">🥇 Hạng 1</span>`;
      else if (item.rank === 2) rankBadge = `<span class="rank-2 px-2.5 py-1 rounded-full font-extrabold text-xs shadow-xs">🥈 Hạng 2</span>`;
      else if (item.rank === 3) rankBadge = `<span class="rank-3 px-2.5 py-1 rounded-full font-extrabold text-xs shadow-xs">🥉 Hạng 3</span>`;

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="text-center">${rankBadge}</td>
          <td class="font-bold text-slate-900">${item.className}</td>
          <td class="text-center font-semibold text-slate-700">${item.totalErrors}</td>
          <td class="text-center">
            <span class="${item.totalPenalty > 0 ? 'text-red-600 bg-red-50 border border-red-200' : 'text-emerald-600 bg-emerald-50 border border-emerald-200'} font-bold px-2.5 py-1 rounded-lg text-xs">
              -${item.totalPenalty.toFixed(1)}đ
            </span>
          </td>
          <td class="text-center">
            <span class="text-xs font-bold border px-2.5 py-0.5 rounded-full ${item.statusClass}">
              ${item.status}
            </span>
          </td>
          <td class="text-xs text-slate-600">${item.comment}</td>
        </tr>
      `;
    }).join('');
  }

  updateCharts() {
    const emuWeek = document.getElementById('emulation-select-week').value;
    const ranked = this.calculateEmulationData(emuWeek);

    // 1. Bar Chart: Penalty Points
    const ctxBar = document.getElementById('chart-class-penalties');
    if (ctxBar && window.Chart) {
      if (this.classPenaltyChart) this.classPenaltyChart.destroy();

      // Hiển thị 15 lớp có điểm trừ cao nhất hoặc các lớp dẫn đầu
      const chartLabels = ranked.map(r => r.className);
      const chartData = ranked.map(r => r.totalPenalty);

      this.classPenaltyChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [{
            label: 'Tổng điểm trừ',
            data: chartData,
            backgroundColor: chartData.map(v => v === 0 ? '#10b981' : (v <= 2 ? '#3b82f6' : '#ef4444')),
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
              beginAtZero: true,
              ticks: { stepSize: 1 }
            },
            x: {
              ticks: { font: { size: 10 } }
            }
          }
        }
      });
    }

    // 2. Doughnut Chart: Top Errors
    const ctxPie = document.getElementById('chart-top-errors');
    if (ctxPie && window.Chart) {
      if (this.topErrorsChart) this.topErrorsChart.destroy();

      const errorCounts = {};
      const relevant = this.violations.filter(v => emuWeek === 'all' || String(v.week) === String(emuWeek));
      relevant.forEach(v => {
        errorCounts[v.violation_category] = (errorCounts[v.violation_category] || 0) + 1;
      });

      const sortedErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const pieLabels = sortedErrors.map(e => e[0]);
      const pieData = sortedErrors.map(e => e[1]);

      if (pieLabels.length === 0) {
        pieLabels.push('Không có lỗi');
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

  copyEmulationMarkdown() {
    const emuWeek = document.getElementById('emulation-select-week').value;
    const ranked = this.calculateEmulationData(emuWeek);

    let md = `| Xếp hạng | Lớp | Tổng số lỗi | Tổng điểm trừ | Trạng thái |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|\n`;
    ranked.forEach(r => {
      md += `| ${r.rank} | ${r.className} | ${r.totalErrors} | -${r.totalPenalty.toFixed(1)} | ${r.status} |\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      this.showToast('Đã copy Bảng Xếp Hạng Thi Đua Markdown!', 'success');
    });
  }

  exportEmulationExcel() {
    if (typeof XLSX === 'undefined') {
      this.showToast('Thư viện Excel chưa sẵn sàng.', 'error');
      return;
    }

    const emuWeek = document.getElementById('emulation-select-week').value;
    const ranked = this.calculateEmulationData(emuWeek);

    const data = ranked.map(r => ({
      'Xếp hạng': r.rank,
      'Lớp': r.className,
      'Tổng số lỗi vi phạm': r.totalErrors,
      'Tổng điểm trừ': r.totalPenalty,
      'Xếp loại': r.status,
      'Đánh giá nề nếp': r.comment
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetName = emuWeek === 'all' ? 'ThiDua_CaNam' : `ThiDua_Tuan_${emuWeek}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `BaoCao_ThiDua_THPT_LeHongPhong_${sheetName}.xlsx`);
    this.showToast('Đã tải xuống file Báo cáo xếp hạng thi đua!', 'success');
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

  // ==================== XÁC THỰC & ĐĂNG NHẬP GOOGLE ====================

  setupAuth() {
    const btnOpenLogin = document.getElementById('btn-open-login');
    const modalAuth = document.getElementById('modal-auth');
    const btnCloseAuth = document.getElementById('btn-close-auth-modal');
    const btnUserMenu = document.getElementById('btn-user-menu');
    const userDropdown = document.getElementById('user-dropdown-menu');
    const btnLogout = document.getElementById('btn-logout');
    const btnDemoGiamThi = document.getElementById('btn-quick-login-giamthi');
    const btnDemoThiDua = document.getElementById('btn-quick-login-thidua');
    const btnGoogleTrigger = document.getElementById('btn-google-popup-trigger');
    const inputClientId = document.getElementById('input-google-client-id');
    const btnSaveClientId = document.getElementById('btn-save-client-id');

    if (btnOpenLogin) {
      btnOpenLogin.addEventListener('click', () => {
        if (modalAuth) modalAuth.classList.remove('hidden');
        if (window.authService) window.authService.initGoogleClient();
      });
    }

    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', () => {
        if (modalAuth) modalAuth.classList.add('hidden');
      });
    }

    if (btnUserMenu && userDropdown) {
      btnUserMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!btnUserMenu.contains(e.target) && !userDropdown.contains(e.target)) {
          userDropdown.classList.add('hidden');
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
          window.authService.logout();
          if (userDropdown) userDropdown.classList.add('hidden');
          this.showToast('Đã đăng xuất khỏi hệ thống.', 'info');
        }
      });
    }

    // Demo Accounts
    if (btnDemoGiamThi) {
      btnDemoGiamThi.addEventListener('click', () => {
        const user = window.authService.loginDemo('Ban Giám Thị', 'Thầy Nguyễn Bảo Ninh', 'baoninh@thptlehongphong.edu.vn');
        if (modalAuth) modalAuth.classList.add('hidden');
        this.showToast(`Chào mừng ${user.name} (Ban Giám Thị)!`, 'success');
      });
    }

    if (btnDemoThiDua) {
      btnDemoThiDua.addEventListener('click', () => {
        const user = window.authService.loginDemo('Ban Thi Đua', 'Cô Lê Thị Mai', 'lethimai@thptlehongphong.edu.vn');
        if (modalAuth) modalAuth.classList.add('hidden');
        this.showToast(`Chào mừng ${user.name} (Ban Thi Đua)!`, 'success');
      });
    }

    // Google Sign-In button trigger
    if (btnGoogleTrigger) {
      btnGoogleTrigger.addEventListener('click', () => {
        const clientId = window.authService.getClientId();
        if (!clientId) {
          // Gợi ý cấu hình Client ID hoặc đăng nhập nhanh
          if (confirm('Bạn chưa cấu hình Google Client ID cho trường.\n\nBạn có muốn đăng nhập nhanh bằng tài khoản Giám thị để trải nghiệm ngay?')) {
            window.authService.loginDemo('Ban Giám Thị', 'Thầy Nguyễn Bảo Ninh', 'giamthi@thptlehongphong.edu.vn');
            if (modalAuth) modalAuth.classList.add('hidden');
            this.showToast('Đã đăng nhập thành công với tài khoản Giám thị!', 'success');
          }
        } else {
          // Đã có Client ID: Google Identity Services sẽ mở popup
          if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.prompt();
          }
        }
      });
    }

    // Custom Client ID
    if (inputClientId && window.authService) {
      inputClientId.value = window.authService.getClientId();
    }
    if (btnSaveClientId) {
      btnSaveClientId.addEventListener('click', () => {
        const idVal = inputClientId.value.trim();
        window.authService.setClientId(idVal);
        this.showToast('Đã lưu Google Client ID!', 'success');
      });
    }

    // Lắng nghe thay đổi trạng thái đăng nhập
    if (window.authService) {
      window.authService.onAuthStateChanged((user) => this.handleAuthStateChange(user));
    }
  }

  handleAuthStateChange(user) {
    const loggedOutDiv = document.getElementById('auth-logged-out');
    const loggedInDiv = document.getElementById('auth-logged-in');
    const avatarImg = document.getElementById('user-avatar-img');
    const displayName = document.getElementById('user-display-name');
    const displayRole = document.getElementById('user-display-role');
    const dropName = document.getElementById('dropdown-user-name');
    const dropEmail = document.getElementById('dropdown-user-email');
    const dropBadge = document.getElementById('dropdown-user-badge');

    if (user) {
      if (loggedOutDiv) loggedOutDiv.classList.add('hidden');
      if (loggedInDiv) loggedInDiv.classList.remove('hidden');

      const avatarUrl = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1d4ed8&color=fff&rounded=true&bold=true`;
      if (avatarImg) avatarImg.src = avatarUrl;
      if (displayName) displayName.textContent = user.name;
      if (displayRole) displayRole.textContent = user.role || 'Ban Giám Thị';
      if (dropName) dropName.textContent = user.name;
      if (dropEmail) dropEmail.textContent = user.email || 'giamthi@thptlehongphong.edu.vn';
      if (dropBadge) dropBadge.textContent = user.role || 'Ban Giám Thị';
    } else {
      if (loggedOutDiv) loggedOutDiv.classList.remove('hidden');
      if (loggedInDiv) loggedInDiv.classList.add('hidden');
    }

    if (window.lucide) window.lucide.createIcons();
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

// Khởi chạy ứng dụng khi DOM đã tải xong
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DisciplineApp();
});
