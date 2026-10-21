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
    this.deletedViolationIds = this.loadDeletedViolationIds();
    
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
    this.pushToCloud(true);
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
      const hasKey = (window.geminiService && typeof window.geminiService.getApiKey === 'function') ? !!window.geminiService.getApiKey() : true;
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

  // ==================== BẢO VỆ MẬT KHẨU NHẬP LIỆU (lhp38) ====================

  setupPasswordAuth() {
    this.PASSWORD_CONFIG = "lhp38";
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
