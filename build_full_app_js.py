import re, sys

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update event listeners for Emulation & Backup
old_listeners_section = '''    // Bộ lọc Xếp hạng
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
    if (btnExportExcelEmu) btnExportExcelEmu.addEventListener('click', () => this.exportEmulationExcel());'''

new_listeners_section = '''    // ==========================================
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
    if (btnExportServerJson) btnExportServerJson.addEventListener('click', () => this.exportServerSyncJson());'''

if old_listeners_section in code:
    code = code.replace(old_listeners_section, new_listeners_section, 1)
    print('Emulation and Backup listeners added successfully')
else:
    print('Could not find old_listeners_section')

# 2. Replace Tab 3 old emulation methods with complete new implementation
old_emu_methods_pattern = re.compile(
    r'  // ==================== BẢNG XẾP HẠNG & THI ĐUA \(TAB 3\) ====================.*?(?=  // ==================== QUẢN LÝ HỌC SINH \(TAB 4 - NGUỒN MỞ\) ====================)',
    re.DOTALL
)

new_emu_methods = '''  // ==================== BẢNG XẾP HẠNG & THI ĐUA (TAB 3 - CHUẨN TRANG TÍNH) ====================

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
      // - Nếu tuần đã khóa niêm phong: Giữ nguyên dữ liệu niêm phong thực tế
      // - Nếu tuần hiện tại (Tuần 7+): TỰ ĐỘNG LIÊN KẾT VÀ TÍNH TOÁN TRỰC TIẾP TỪ HỌC SINH VI PHẠM
      let diemTru = 0.0;
      let violationDetails = [];
      if (isLocked && existing && existing.diemTru !== undefined) {
        diemTru = parseFloat(existing.diemTru) || 0.0;
        violationDetails = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === cName);
      } else {
        violationDetails = this.violations.filter(v => parseInt(v.week, 10) === w && v.class_name === cName);
        diemTru = violationDetails.reduce((sum, v) => sum + (parseFloat(v.penalty_points) || 0), 0);
      }

      // 3. Điểm TB Nề nếp = 15' - Điểm trừ
      const tbNenNep = diem15 - diemTru;

      // 4. Điểm TB Chung = ((Điểm TB học tập + TB nề nếp) / 2) + Điểm cộng vào TB
      const tbChung = ((diemTbHocTap + tbNenNep) / 2) + bonus;

      // 5. Xếp loại theo cấu trúc chuẩn của nhà trường:
      // >= 9.9: X sắc | >= 8.5: Giỏi | >= 7.0: Khá | >= 5.0: T.bình | < 5.0: Yếu
      let xepLoai = 'Yếu';
      if (tbChung >= 9.9) xepLoai = 'X sắc';
      else if (tbChung >= 8.5) xepLoai = 'Giỏi';
      else if (tbChung >= 7.0) xepLoai = 'Khá';
      else if (tbChung >= 5.0) xepLoai = 'T.bình';

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

    // Xếp hạng (RANK):
    // A. Vị thứ học tập (điểm TB học tập cao nhất xếp 1)
    const sortedHT = [...results].sort((a, b) => b.diemTbHocTap - a.diemTbHocTap);
    sortedHT.forEach((r, idx) => {
      const match = results.find(x => x.className === r.className);
      if (match) match.viThuHocTap = idx + 1;
    });

    // B. Vị thứ nề nếp (TB nề nếp cao nhất xếp 1)
    const sortedNN = [...results].sort((a, b) => b.tbNenNep - a.tbNenNep);
    sortedNN.forEach((r, idx) => {
      const match = results.find(x => x.className === r.className);
      if (match) match.viThuNenNep = idx + 1;
    });

    // C. Vị thứ vắng (ít vắng hơn xếp trên)
    const sortedVang = [...results].sort((a, b) => a.hsVang - b.hsVang);
    sortedVang.forEach((r, idx) => {
      const match = results.find(x => x.className === r.className);
      if (match) match.viThuVang = idx + 1;
    });

    // D. Vị thứ chung cuộc (TB Chung cao nhất xếp Hạng 1)
    const sortedChung = [...results].sort((a, b) => {
      if (b.tbChung !== a.tbChung) return b.tbChung - a.tbChung;
      if (b.tbNenNep !== a.tbNenNep) return b.tbNenNep - a.tbNenNep;
      return a.diemTru - b.diemTru;
    });
    sortedChung.forEach((r, idx) => {
      const match = results.find(x => x.className === r.className);
      if (match) match.viThuChung = idx + 1;
    });

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
    // Adapter cho biểu đồ Chart.js
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

    // 1. Cập nhật Badge Trạng Thái Khóa Tuần
    const statusBadge = document.getElementById('emulation-week-status-badge');
    if (statusBadge) {
      if (isLocked) {
        statusBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-amber-50 text-amber-800 border-amber-300';
        statusBadge.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-amber-600"></i><span>🔒 Tuần đã khóa niêm phong (Read-Only)</span>`;
      } else {
        statusBadge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-300';
        statusBadge.innerHTML = `<i data-lucide="unlock" class="w-3.5 h-3.5 text-emerald-600"></i><span>🔓 Tuần hiện tại (Đang mở nhập liệu)</span>`;
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

    // 5. Render từng dòng trong tbody
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

      // Nút xem/thêm điểm cộng
      const bonusBadge = isLocked ? `
        <span class="text-xs font-bold text-slate-600">${r.bonus > 0 ? `+${r.bonus.toFixed(1)}đ` : '0'}</span>
      ` : `
        <button type="button" onclick="window.app.openBonusModalForClass('${r.className}')"
                class="px-2 py-0.5 rounded font-bold text-xs cursor-pointer transition ${r.bonus > 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}"
                title="Bấm để thêm/sửa điểm cộng cho lớp ${r.className}">
          ${r.bonus > 0 ? `+${r.bonus.toFixed(1)}đ` : '+ 0đ'}
        </button>
      `;

      // Cột thao tác sửa nhanh
      const actionCol = isLocked ? `
        <span class="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-semibold">
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

      // Các ô nhập liệu hoặc ô hiển thị (tùy theo trạng thái khóa)
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

          <!-- Điểm cộng vào TB -->
          <td class="text-center bg-amber-50/40 border-x border-amber-100">${bonusBadge}</td>

          <!-- Tổng hợp chung -->
          <td class="text-center font-extrabold text-emerald-950 bg-emerald-50/50 text-sm">${r.tbChung.toFixed(2)}</td>
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

    // 6. Cập nhật khối thống kê tổng hợp ở chân bảng
    this.updateEmulationSummaryStats(ranked);

    if (window.lucide) window.lucide.createIcons();
  }

  updateEmulationSummaryStats(ranked) {
    if (!ranked || ranked.length === 0) return;

    const totalLessons = ranked.reduce((s, r) => s + r.tongTiet, 0);
    const countTot = ranked.reduce((s, r) => s + r.tot, 0);
    const countA = ranked.reduce((s, r) => s + r.gioA, 0);
    const countB = ranked.reduce((s, r) => s + r.gioB, 0);
    const countCD = ranked.reduce((s, r) => s + r.gioC + r.gioD, 0);

    const totalAbsences = ranked.reduce((s, r) => s + r.hsVang, 0);
    const avgAbsence = (totalAbsences / ranked.length).toFixed(1);

    const countXS = ranked.filter(r => r.xepLoai === 'X sắc').length;
    const countGioi = ranked.filter(r => r.xepLoai === 'Giỏi').length;
    const countKha = ranked.filter(r => r.xepLoai === 'Khá').length;
    const countTB = ranked.filter(r => r.xepLoai === 'T.bình' || r.xepLoai === 'Yếu').length;

    // Gán vào DOM
    const elLessons = document.getElementById('stat-total-lessons');
    if (elLessons) elLessons.textContent = totalLessons;
    const elTot = document.getElementById('stat-count-tot');
    if (elTot) elTot.textContent = countTot;
    const elA = document.getElementById('stat-count-a');
    if (elA) elA.textContent = countA;
    const elB = document.getElementById('stat-count-b');
    if (elB) elB.textContent = countB;
    const elCD = document.getElementById('stat-count-cd');
    if (elCD) elCD.textContent = countCD;

    const elAbs = document.getElementById('stat-total-absences');
    if (elAbs) elAbs.textContent = totalAbsences;
    const elAvgAbs = document.getElementById('stat-avg-absence');
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
      top3El.innerHTML = `
        <div class="flex items-center justify-between font-bold text-slate-800">
          <span>🥇 Hạng 1: ${sortedByRank[0].className} (${sortedByRank[0].gvcn})</span>
          <span class="text-emerald-600">${sortedByRank[0].tbChung.toFixed(2)}đ</span>
        </div>
        <div class="flex items-center justify-between text-slate-700">
          <span>🥈 Hạng 2: ${sortedByRank[1].className} (${sortedByRank[1].gvcn})</span>
          <span class="text-blue-600 font-bold">${sortedByRank[1].tbChung.toFixed(2)}đ</span>
        </div>
        <div class="flex items-center justify-between text-slate-700">
          <span>🥉 Hạng 3: ${sortedByRank[2].className} (${sortedByRank[2].gvcn})</span>
          <span class="text-amber-600 font-bold">${sortedByRank[2].tbChung.toFixed(2)}đ</span>
        </div>
      `;
    }
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
    document.getElementById('modal-edit-class-title').textContent = `Chỉnh Sửa Dữ Liệu Lớp ${className}`;
    document.getElementById('modal-edit-class-subtitle').textContent = `GVCN: ${classData.gvcn || ''} • Tuần ${w}`;

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

    // Lưu điểm cộng nếu có
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
        <td class="p-2 text-slate-600">${item.reason || '-'}</td>
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

    if (!this.bonusPoints[w]) this.bonusPoints[w] = [];
    this.bonusPoints[w].push({
      id: Date.now() + Math.random(),
      className: className,
      points: parseFloat(points) || 0,
      reason: reason
    });

    this.saveBonusPoints();
    this.calculateWeeklyEmulationRankings(w);
    this.renderEmulationTable();
    this.updateCharts();
    this.showToast(`Đã cộng ${points} điểm vào TB cho lớp ${className}!`, 'success');
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

    const lines = syntaxText.split(/[;\n]/);
    let count = 0;
    const classes = (window.DEFAULT_CLASSES || []).map(c => c.class);

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      for (const c of classes) {
        const regex = new RegExp(`\\\\b${c}\\\\b[:\\\\s\\\\+]*([0-9]+(?:\\\\.[0-9]+)?)(?:\\\\s*\\\\((.*?)\\\\))?`, 'i');
        const match = trimmed.match(regex);
        if (match) {
          const pts = parseFloat(match[1]);
          const reason = match[2] || 'Cộng điểm theo cú pháp';
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
      this.showToast('Không nhận diện được cú pháp. Mẫu đúng: 10B01: 1.0 (Giải Nhất báo tường)', 'warning');
    }
  }

  // ==================== XUẤT VÀ IMPORT FILE EXCEL THI ĐUA TUẦN ====================

  exportEmulationExcel() {
    if (typeof XLSX === 'undefined') {
      this.showToast('Thư viện XLSX chưa sẵn sàng.', 'error');
      return;
    }

    const emuSelect = document.getElementById('emulation-select-week');
    const emuWeek = emuSelect ? emuSelect.value : this.currentWeek;
    const ranked = this.calculateWeeklyEmulationRankings(emuWeek);
    const dateRange = this.getWeekDateRange(emuWeek);

    // Xây dựng ma trận dữ liệu chuẩn theo cấu trúc trang tính của trường
    const rows = [
      ["SỞ GIÁO DỤC VÀ ĐÀO TẠO ĐĂK LĂK", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      [`TỔNG HỢP THI ĐUA TUẦN ${String(emuWeek).padStart(2, '0')}`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      [dateRange, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      // Row 7 (Header Nhóm Cột)
      ["TT", "LỚP", "GVCN", "SHL", "Học tập (Giờ ABCD)", "", "", "", "", "", "Vị thứ HT", "Nề nếp", "", "", "Vị thứ NN", "HS Vắng", "", "Điểm cộng vào TB", "Tổng hợp chung", "", "", "Vị thứ chung"],
      // Row 8 (Header Chi Tiết)
      ["", "", "", "", "Tốt (15đ)", "A (10đ)", "B (5đ)", "C (0đ)", "D (-5đ)", "Tổng tiết", "Điểm TB", "15'", "Điểm trừ", "TB NN", "", "Tổng", "Vị thứ", "", "TB Chung", "Xếp loại", "", ""]
    ];

    ranked.forEach(r => {
      rows.push([
        r.stt,
        r.className,
        r.gvcn,
        r.shl,
        r.tot,
        r.gioA,
        r.gioB,
        r.gioC,
        r.gioD,
        r.tongTiet,
        r.diemTbHocTap,
        r.viThuHocTap,
        r.diem15,
        r.diemTru,
        r.tbNenNep,
        r.viThuNenNep,
        r.hsVang,
        r.viThuVang,
        r.bonus,
        r.tbChung,
        r.xepLoai,
        r.viThuChung
      ]);
    });

    // Khối Tổng Hợp Chung Cuối Bảng
    rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["TỔNG HỢP CHUNG", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    const totalVang = ranked.reduce((s, r) => s + r.hsVang, 0);
    const countXS = ranked.filter(r => r.xepLoai === 'X sắc').length;
    const countGioi = ranked.filter(r => r.xepLoai === 'Giỏi').length;
    const countKha = ranked.filter(r => r.xepLoai === 'Khá').length;
    const countTB = ranked.filter(r => r.xepLoai === 'T.bình').length;
    const countYeu = ranked.filter(r => r.xepLoai === 'Yếu').length;

    rows.push(["1", "Tổng học sinh vắng", "", "", "", totalVang, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["2", "Lớp xếp loại Xuất sắc", "", "", "", countXS, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["3", "Lớp xếp loại Giỏi", "", "", "", countGioi, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["4", "Lớp xếp loại Khá", "", "", "", countKha, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["5", "Lớp xếp loại Trung bình", "", "", "", countTB, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["6", "Lớp xếp loại Yếu", "", "", "", countYeu, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Tuan_${emuWeek}`);
    XLSX.writeFile(wb, `TongHopThiDua_Tuan${emuWeek}_THPT_So1_LeHongPhong.xlsx`);
    this.showToast(`Đã xuất báo cáo Excel Tuần ${emuWeek} chuẩn xác!`, 'success');
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

    let md = `| Hạng | Lớp | GVCN | SHL | TB Học Tập | TB Nề Nếp | Điểm Trừ | Điểm Cộng | TB Chung | Xếp Loại |\n`;
    md += `|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
    ranked.forEach(r => {
      md += `| ${r.viThuChung} | ${r.className} | ${r.gvcn} | ${r.shl} | ${r.diemTbHocTap.toFixed(2)} | ${r.tbNenNep.toFixed(2)} | -${r.diemTru.toFixed(1)} | +${r.bonus} | ${r.tbChung.toFixed(2)} | ${r.xepLoai} |\n`;
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

'''

if old_emu_methods_pattern.search(code):
    code = old_emu_methods_pattern.sub(new_emu_methods, code, count=1)
    print('Emulation methods and Backup methods replaced successfully')
else:
    print('Could not find old_emu_methods_pattern')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('app.js successfully updated!')
