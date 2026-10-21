import re, sys

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update switchTab to handle tab-backup
old_switch_tab = '''    } else if (targetTab === 'tab-rules') {
      this.renderRulesTable();
    }'''

new_switch_tab = '''    } else if (targetTab === 'tab-rules') {
      this.renderRulesTable();
    } else if (targetTab === 'tab-backup') {
      this.renderSnapshotsList();
      this.updateBackupStats();
    }'''

if old_switch_tab in code:
    code = code.replace(old_switch_tab, new_switch_tab, 1)
    print('switchTab updated')
else:
    print('Could not find old_switch_tab')

# 2. Add checkDateLockWarning and update populateDropdowns
old_populate_dropdowns = '''  populateDropdowns() {
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
  }'''

new_populate_dropdowns = '''  checkDateLockWarning(dateStr) {
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
  }'''

if old_populate_dropdowns in code:
    code = code.replace(old_populate_dropdowns, new_populate_dropdowns, 1)
    print('populateDropdowns updated')
else:
    print('Could not find old_populate_dropdowns')

# 3. Guard against saving violations for locked weeks in AI and Manual
old_do_run_ai = '''    const dateVal = document.getElementById('input-violation-date').value || new Date().toISOString().split('T')[0];
    const weekNum = this.calculateWeek(dateVal);

    // Ẩn lỗi banner cũ'''

new_do_run_ai = '''    const dateVal = document.getElementById('input-violation-date').value || new Date().toISOString().split('T')[0];
    const weekNum = this.calculateWeek(dateVal);

    if (this.isWeekLocked(weekNum)) {
      this.showToast(`Tuần ${weekNum} đã kết thúc và được khóa dữ liệu niêm phong. Vui lòng chọn ngày thuộc Tuần 7 trở đi!`, 'error');
      return;
    }

    // Ẩn lỗi banner cũ'''

if old_do_run_ai in code:
    code = code.replace(old_do_run_ai, new_do_run_ai, 1)
    print('doRunAiParse lock guard added')
else:
    print('Could not find old_do_run_ai')

old_confirm_save_ai = '''  confirmSaveAiViolations() {
    this.requirePassword(() => this.doConfirmSaveAiViolations());
  }

  doConfirmSaveAiViolations() {
    if (this.pendingAiRecords.length === 0) return;'''

new_confirm_save_ai = '''  confirmSaveAiViolations() {
    const dateInput = document.getElementById('input-violation-date');
    const inputDate = dateInput ? dateInput.value : '';
    const week = this.calculateWeek(inputDate);
    if (this.isWeekLocked(week)) {
      this.showToast(`Tuần ${week} đã kết thúc và được khóa dữ liệu niêm phong. Không thể lưu vi phạm!`, 'error');
      return;
    }
    this.requirePassword(() => this.doConfirmSaveAiViolations());
  }

  doConfirmSaveAiViolations() {
    if (this.pendingAiRecords.length === 0) return;'''

if old_confirm_save_ai in code:
    code = code.replace(old_confirm_save_ai, new_confirm_save_ai, 1)
    print('confirmSaveAiViolations lock guard added')
else:
    print('Could not find old_confirm_save_ai')

old_manual_add = '''          if (studentInput) {
            const val = studentInput.value.trim();
            const m = val.match(/\\((.*?)\\)/);
            if (m) selectedClass = m[1].trim();
          }'''

new_manual_add = '''          if (studentInput) {
            const val = studentInput.value.trim();
            const m = val.match(/\\((.*?)\\)/);
            if (m) selectedClass = m[1].trim();
          }

          const dateInput = document.getElementById('input-violation-date');
          const inputDate = dateInput ? dateInput.value : '';
          const week = this.calculateWeek(inputDate);
          if (this.isWeekLocked(week)) {
            this.showToast(`Tuần ${week} đã kết thúc và được khóa dữ liệu niêm phong. Không thể thêm vi phạm!`, 'error');
            return;
          }'''

if old_manual_add in code:
    code = code.replace(old_manual_add, new_manual_add, 1)
    print('manual add lock guard added')
else:
    print('Could not find old_manual_add')

# 4. Update renderLogsTable to display locked badge and disable delete
old_render_logs = '''    emptyState.classList.add('hidden');
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
    `).join('');'''

new_render_logs = '''    emptyState.classList.add('hidden');
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
    }).join('');'''

if old_render_logs in code:
    code = code.replace(old_render_logs, new_render_logs, 1)
    print('renderLogsTable updated')
else:
    print('Could not find old_render_logs')

# 5. Update deleteViolation to guard locked records
old_delete_violation = '''  deleteViolation(id) {
    this.requirePassword(() => {
      if (confirm('Bạn có muốn xóa bản ghi vi phạm này?')) {'''

new_delete_violation = '''  deleteViolation(id) {
    const target = this.violations.find(v => String(v.id) === String(id));
    if (target && this.isWeekLocked(target.week)) {
      this.showToast(`Vi phạm này thuộc Tuần ${target.week} đã được khóa niêm phong. Không thể xóa!`, 'error');
      return;
    }

    this.requirePassword(() => {
      if (confirm('Bạn có muốn xóa bản ghi vi phạm này?')) {'''

if old_delete_violation in code:
    code = code.replace(old_delete_violation, new_delete_violation, 1)
    print('deleteViolation lock guard added')
else:
    print('Could not find old_delete_violation')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('app.js part 2 updated')
