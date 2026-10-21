import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Backup button to Header
old_header_btn = '''        <!-- Lock / Unlock Status Button for Data Entry -->
        <button id="btn-toggle-auth-lock"'''

new_header_btn = '''        <!-- Backup & Protection Quick Button -->
        <button id="btn-header-backup" title="Sao lưu dự phòng & Bảo vệ dữ liệu năm học"
                type="button"
                onclick="window.app && window.app.switchTab('tab-backup')"
                class="hidden md:flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer min-h-[44px]">
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
          <span>Sao Lưu & Bảo Vệ</span>
        </button>

        <!-- Lock / Unlock Status Button for Data Entry -->
        <button id="btn-toggle-auth-lock"'''

if old_header_btn in content:
    content = content.replace(old_header_btn, new_header_btn, 1)
    print('Header button updated successfully')
else:
    print('Could not find old_header_btn')

# 2. Add Tab 6 to Nav
old_nav = '''        <button data-tab="tab-rules" class="tab-btn flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 rounded-t-lg transition border-b-2 border-transparent">
          <i data-lucide="book-open" class="w-4 h-4"></i>
          <span>Danh Mục Lỗi & Điểm</span>
          <span id="badge-total-rules" class="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">33</span>
        </button>'''

new_nav = '''        <button data-tab="tab-rules" class="tab-btn flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 rounded-t-lg transition border-b-2 border-transparent">
          <i data-lucide="book-open" class="w-4 h-4"></i>
          <span>Danh Mục Lỗi & Điểm</span>
          <span id="badge-total-rules" class="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">33</span>
        </button>

        <button data-tab="tab-backup" class="tab-btn flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 rounded-t-lg transition border-b-2 border-transparent">
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
          <span>Sao Lưu & Bảo Vệ Dữ Liệu</span>
        </button>'''

if old_nav in content:
    content = content.replace(old_nav, new_nav, 1)
    print('Nav tab updated successfully')
else:
    print('Could not find old_nav')

# 3. Add locked week warning to Tab 1 Date Picker
old_tab1_date = '''                <span id="display-computed-week" class="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md">
                  Tuần 7
                </span>
              </div>
            </div>'''

new_tab1_date = '''                <span id="display-computed-week" class="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md">
                  Tuần 7
                </span>
              </div>
            </div>

            <!-- Locked Week Warning Banner -->
            <div id="locked-week-warning" class="hidden mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 font-semibold flex items-center gap-2">
              <i data-lucide="lock" class="w-4 h-4 text-amber-600 shrink-0"></i>
              <span id="locked-week-warning-text">Mốc thời gian này thuộc Tuần đã khóa. Không thể ghi nhận vi phạm cho các tuần đã khóa.</span>
            </div>'''

if old_tab1_date in content:
    content = content.replace(old_tab1_date, new_tab1_date, 1)
    print('Tab 1 date warning added successfully')
else:
    print('Could not find old_tab1_date')

# 4. Replace Tab 3 with comprehensive Emulation Table
import re
tab3_pattern = re.compile(r'<!-- ===+ -->\s*<!-- TAB 3: XẾP HẠNG & BÁO CÁO THI ĐUA.*?<!-- ===+ -->\s*<!-- TAB 4: QUẢN LÝ HỌC SINH', re.DOTALL)

new_tab3_content = '''<!-- ================================================================ -->
    <!-- TAB 3: XẾP HẠNG & BÁO CÁO THI ĐUA (Bảng Tổng Hợp Chuẩn Mực Tuần)   -->
    <!-- ================================================================ -->
    <div id="tab-emulation" class="tab-content hidden space-y-6">
      
      <!-- Top Bar: Select Week, Lock Status & Actions -->
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-700">Xem thi đua:</span>
            <select id="emulation-select-week" class="text-xs font-bold bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <!-- Dynamically populated with weeks 1 to 35+ and lock badges -->
            </select>
          </div>

          <!-- Lock / Active Status Badge -->
          <div id="emulation-week-status-badge" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition">
            <!-- Dynamically populated: 🔒 Đã khóa tuần OR 🔓 Đang mở nhập liệu -->
          </div>
        </div>

        <!-- Action Buttons Bar -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <!-- Button Thêm Điểm Cộng TB -->
          <button id="btn-add-bonus-point" class="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition shadow-xs cursor-pointer">
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
            <span>+ Điểm Cộng TB</span>
          </button>

          <!-- Button Import Excel Tuần -->
          <button id="btn-open-excel-import" class="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer">
            <i data-lucide="upload" class="w-3.5 h-3.5"></i>
            <span>📥 Import Excel Tuần</span>
          </button>
          
          <!-- Hidden File Input for Excel Import -->
          <input type="file" id="input-emulation-excel-file" accept=".xlsx, .xls, .csv" class="hidden">

          <!-- Button Tải Mẫu Excel Tuần -->
          <button id="btn-download-emulation-template" class="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer">
            <i data-lucide="file-down" class="w-3.5 h-3.5"></i>
            <span>Mẫu Excel</span>
          </button>

          <!-- Button Lưu Thay Đổi Bảng -->
          <button id="btn-save-emulation-table" class="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer">
            <i data-lucide="save" class="w-3.5 h-3.5"></i>
            <span>Lưu Bảng</span>
          </button>

          <!-- Button Copy Markdown -->
          <button id="btn-copy-markdown-emulation" class="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Copy Markdown</span>
          </button>
          
          <!-- Button Xuất Excel Chuẩn -->
          <button id="btn-export-excel-emulation" class="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer">
            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
            <span>Xuất Báo Cáo Tuần (.xlsx)</span>
          </button>
        </div>
      </div>

      <!-- Weekly Title & Regulations Banner -->
      <div id="emulation-header-banner" class="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
              <span id="emulation-school-name">TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG</span>
              <span>•</span>
              <span>BAN NỀN NẾP & THI ĐUA</span>
            </div>
            <h2 id="emulation-banner-title" class="text-xl md:text-2xl font-extrabold tracking-tight mt-1 text-white">
              TỔNG HỢP THI ĐUA TUẦN 07
            </h2>
            <p id="emulation-banner-dates" class="text-xs md:text-sm text-blue-200 font-medium mt-1">
              Từ ngày 19 tháng 10 đến ngày 24 tháng 10 năm 2026
            </p>
          </div>
          
          <div id="emulation-banner-note" class="text-xs max-w-md bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-slate-200">
            <p class="font-bold text-amber-300 flex items-center gap-1.5">
              <i data-lucide="info" class="w-3.5 h-3.5"></i>
              <span>Cơ chế tính điểm & khóa tuần:</span>
            </p>
            <p class="mt-1 leading-relaxed text-[11px] text-slate-300">
              • <strong>Tuần 01 -> 06:</strong> Đã kết thúc và được khóa dữ liệu niêm phong.<br>
              • <strong>Từ Tuần 07 trở đi:</strong> Tuần hiện tại mở để nhập liệu/chỉnh sửa. <strong>Điểm trừ nề nếp</strong> được tự động tính trực tiếp từ học sinh vi phạm ghi nhận trên hệ thống.
            </p>
          </div>
        </div>
      </div>

      <!-- Official Emulation Ranking Table (Chuẩn Trang Tính Mẫu Nhà Trường) -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <i data-lucide="award" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="font-extrabold text-slate-900 text-sm" id="emulation-table-title">BẢNG TỔNG HỢP THI ĐUA 29 LỚP</h3>
              <p class="text-[11px] text-slate-500">Bảo toàn đầy đủ công thức chuẩn: Điểm TB học tập, TB nề nếp, Tổng hợp chung, Xếp loại và Vị thứ</p>
            </div>
          </div>

          <div class="flex items-center gap-3 text-xs">
            <span class="inline-flex items-center gap-1 text-slate-600 font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Xuất sắc (&gt;= 9.9)
            </span>
            <span class="inline-flex items-center gap-1 text-slate-600 font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Giỏi (8.5 - 9.8)
            </span>
            <span class="inline-flex items-center gap-1 text-slate-600 font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Khá (7.0 - 8.4)
            </span>
            <span class="inline-flex items-center gap-1 text-slate-600 font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> T.bình (5.0 - 6.9)
            </span>
          </div>
        </div>

        <div class="overflow-x-auto max-h-[720px]">
          <table class="w-full text-left border-collapse emulation-table custom-table">
            <thead class="sticky top-0 z-20 shadow-xs">
              <!-- Header Row 1: Nhóm cột chính -->
              <tr>
                <th rowspan="2" class="text-center w-10 bg-slate-100 text-slate-700 border border-slate-200">TT</th>
                <th rowspan="2" class="text-center w-20 bg-slate-100 text-slate-900 font-extrabold border border-slate-200">LỚP</th>
                <th rowspan="2" class="w-40 bg-slate-100 text-slate-800 border border-slate-200">GVCN</th>
                <th rowspan="2" class="text-center w-16 th-group-study border border-indigo-200" title="Điểm GVCN tiết Sinh hoạt lớp">SHL</th>
                
                <!-- Nhóm Học Tập (7 cột) -->
                <th colspan="7" class="text-center th-group-study border border-indigo-200">HỌC TẬP (GIỜ ABCD)</th>
                <th rowspan="2" class="text-center w-14 th-group-study border border-indigo-200 font-bold" title="Vị thứ học tập">Vị thứ</th>
                
                <!-- Nhóm Nề Nếp (3 cột) -->
                <th colspan="3" class="text-center th-group-discipline border border-rose-200">NỀ NẾP</th>
                <th rowspan="2" class="text-center w-14 th-group-discipline border border-rose-200 font-bold" title="Vị thứ nề nếp">Vị thứ</th>
                
                <!-- Nhóm Vắng (2 cột) -->
                <th colspan="2" class="text-center th-group-absence border border-slate-200">HS VẮNG</th>
                
                <!-- Nhóm Điểm Cộng (1 cột) -->
                <th rowspan="2" class="text-center w-16 th-group-bonus border border-amber-200 font-bold" title="Điểm cộng vào TB nếu có">Điểm Cộng</th>
                
                <!-- Nhóm Tổng Hợp Chung (3 cột) -->
                <th colspan="3" class="text-center th-group-overall border border-emerald-200">TỔNG HỢP CHUNG</th>
                <th rowspan="2" class="text-center w-16 bg-slate-100 text-slate-700 border border-slate-200">Thao Tác</th>
              </tr>

              <!-- Header Row 2: Chi tiết từng cột -->
              <tr>
                <!-- Học tập -->
                <th class="text-center w-12 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]" title="Giờ Tốt (15 điểm)">Tốt</th>
                <th class="text-center w-12 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]" title="Giờ A (10 điểm)">A</th>
                <th class="text-center w-12 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]" title="Giờ B (5 điểm)">B</th>
                <th class="text-center w-12 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]" title="Giờ C (0 điểm)">C</th>
                <th class="text-center w-12 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]" title="Giờ D (-5 điểm)">D</th>
                <th class="text-center w-14 bg-indigo-100 text-indigo-950 font-bold border border-indigo-200 text-[11px]">Tổng tiết</th>
                <th class="text-center w-16 bg-indigo-100 text-indigo-950 font-bold border border-indigo-200 text-[11px]" title="Điểm TB = (Tốt*15 + A*10 + B*5 + C*0 + D*-5) / Tổng tiết">Điểm TB</th>

                <!-- Nề nếp -->
                <th class="text-center w-14 bg-rose-50 text-rose-900 border border-rose-200 text-[11px]" title="Điểm nề nếp 15 phút (Khởi điểm 10đ)">15\'</th>
                <th class="text-center w-16 bg-rose-50 text-rose-900 font-bold border border-rose-200 text-[11px]" title="Điểm trừ tự động liên kết từ học sinh vi phạm">Điểm trừ</th>
                <th class="text-center w-16 bg-rose-100 text-rose-950 font-bold border border-rose-200 text-[11px]" title="TB Nề nếp = 15\' - Điểm trừ">TB NN</th>

                <!-- Vắng -->
                <th class="text-center w-12 bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">Tổng</th>
                <th class="text-center w-12 bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">Vị thứ</th>

                <!-- Tổng hợp chung -->
                <th class="text-center w-20 bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-200 text-[11px]" title="TB Chung = (Điểm TB học tập + TB nề nếp)/2 + Điểm cộng">TB Chung</th>
                <th class="text-center w-20 bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-200 text-[11px]">Xếp loại</th>
                <th class="text-center w-14 bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-200 text-[11px]">Vị thứ</th>
              </tr>
            </thead>
            <tbody id="emulation-table-body">
              <!-- Dynamically populated 29 rows -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bottom Statistical Summary Section (Khối Tổng Hợp Chung Cuối Bảng) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Summary Card 1: Tổng Giờ Học Tập -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span class="font-bold uppercase tracking-wider text-indigo-700">Tổng Tiết & Giờ Dạy</span>
            <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-extrabold text-slate-900" id="stat-total-lessons">0</span>
            <span class="text-xs text-slate-500">tiết học toàn trường</span>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>Tốt: <strong id="stat-count-tot" class="text-indigo-600">0</strong></span>
            <span>A: <strong id="stat-count-a" class="text-emerald-600">0</strong></span>
            <span>B: <strong id="stat-count-b" class="text-blue-600">0</strong></span>
            <span>C/D: <strong id="stat-count-cd" class="text-rose-600">0</strong></span>
          </div>
        </div>

        <!-- Summary Card 2: Tổng Lượt Vắng -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span class="font-bold uppercase tracking-wider text-slate-700">Học Sinh Vắng Tuần</span>
            <i data-lucide="user-x" class="w-4 h-4 text-slate-600"></i>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-extrabold text-slate-900" id="stat-total-absences">0</span>
            <span class="text-xs text-slate-500">lượt vắng</span>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>Trung bình: <strong id="stat-avg-absence" class="text-slate-800">0.0</strong> lượt/lớp</span>
          </div>
        </div>

        <!-- Summary Card 3: Thống Kê Xếp Loại -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span class="font-bold uppercase tracking-wider text-emerald-700">Phân Loại Thi Đua</span>
            <i data-lucide="bar-chart-2" class="w-4 h-4 text-emerald-600"></i>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap text-xs font-bold">
            <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">X.Sắc: <strong id="stat-count-xs">0</strong></span>
            <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Giỏi: <strong id="stat-count-gioi">0</strong></span>
            <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Khá: <strong id="stat-count-kha">0</strong></span>
            <span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded">T.Bình: <strong id="stat-count-tb">0</strong></span>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Tổng cộng: <strong>29/29 lớp</strong></span>
          </div>
        </div>

        <!-- Summary Card 4: Top 3 Lớp Dẫn Đầu -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span class="font-bold uppercase tracking-wider text-amber-600">Top 3 Thi Đua Tuần</span>
            <i data-lucide="crown" class="w-4 h-4 text-amber-500"></i>
          </div>
          <div class="space-y-1 text-xs" id="stat-top3-classes">
            <!-- Dynamically populated top 3 -->
            <div class="flex items-center justify-between font-bold text-slate-800">
              <span>🥇 Hạng 1: --</span>
              <span class="text-emerald-600">-- đ</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Visual Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Chart 1: Bar chart score by class -->
        <div class="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Biểu đồ Điểm Trung Bình Thi Đua Chung theo lớp (Tuần được chọn)</span>
            <span class="text-[11px] font-normal text-slate-400">Cột càng cao xếp hạng càng cao</span>
          </h3>
          <div class="h-64 relative">
            <canvas id="chart-class-penalties"></canvas>
          </div>
        </div>

        <!-- Chart 2: Top violations doughnut -->
        <div class="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
            Top lỗi vi phạm phổ biến
          </h3>
          <div class="h-64 relative flex items-center justify-center">
            <canvas id="chart-top-errors"></canvas>
          </div>
        </div>

      </div>

    </div>

    <!-- ================================================================ -->
    <!-- TAB 4: QUẢN LÝ HỌC SINH'''

if tab3_pattern.search(content):
    content = tab3_pattern.sub(new_tab3_content, content, count=1)
    print('Tab 3 replaced successfully')
else:
    print('Could not find Tab 3 pattern')

# 5. Add Tab 6 before </main>
tab6_content = '''    <!-- ================================================================ -->
    <!-- TAB 6: SAO LƯU & BẢO VỆ DỮ LIỆU (Long-Term Storage & Backup)     -->
    <!-- ================================================================ -->
    <div id="tab-backup" class="tab-content hidden space-y-6">
      
      <!-- Top Title Banner -->
      <div class="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              <span>CƠ CHẾ LƯU TRỮ AN TOÀN TUYỆT ĐỐI • NĂM HỌC 2026 - 2027</span>
            </div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight text-white">
              Sao Lưu Dự Phòng & Bảo Vệ CSDL 1 Năm Học
            </h2>
            <p class="text-xs md:text-sm text-emerald-100 font-normal leading-relaxed max-w-2xl">
              Đảm bảo toàn vẹn dữ liệu nề nếp thi đua suốt 35+ tuần học. Chống mọi nguy cơ mất mát, tự động xóa hoặc thay đổi ngoài ý muốn khi dùng trình duyệt hoặc máy chủ nội bộ.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button id="btn-export-full-backup" class="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-md cursor-pointer text-xs">
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Xuất File Backup (.json)</span>
            </button>
            <button id="btn-open-create-snapshot" class="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl border border-white/20 transition cursor-pointer text-xs">
              <i data-lucide="bookmark-plus" class="w-4 h-4 text-emerald-300"></i>
              <span>Tạo Điểm Khôi Phục</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Overview Cards Row: Current DB Health & Counts -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span class="font-bold uppercase text-slate-700">Dữ Liệu Học Sinh & Quy Chế</span>
            <i data-lucide="database" class="w-4 h-4 text-blue-600"></i>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-extrabold text-slate-900" id="backup-stat-students">1.226</span>
            <span class="text-xs text-slate-500">học sinh • <strong>33</strong> lỗi</span>
          </div>
          <p class="text-[11px] text-emerald-600 font-semibold mt-1">✓ Đồng bộ 29 lớp khối 10, 11, 12</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span class="font-bold uppercase text-slate-700">Vi Phạm Đã Ghi Nhận</span>
            <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-extrabold text-slate-900" id="backup-stat-violations">87</span>
            <span class="text-xs text-slate-500">bản ghi toàn năm</span>
          </div>
          <p class="text-[11px] text-blue-600 font-semibold mt-1">✓ Tuần 01 -&gt; 06 đã khóa niêm phong</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span class="font-bold uppercase text-slate-700">Điểm Khôi Phục (Snapshots)</span>
            <i data-lucide="history" class="w-4 h-4 text-indigo-600"></i>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-extrabold text-slate-900" id="backup-stat-snapshots">0</span>
            <span class="text-xs text-slate-500">mốc đã tạo</span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1" id="backup-stat-last-snapshot">Chưa có mốc thủ công</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span class="font-bold uppercase text-slate-700">Đồng Bộ & An Toàn Bộ Nhớ</span>
            <i data-lucide="hard-drive" class="w-4 h-4 text-emerald-600"></i>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-extrabold text-emerald-700">An Toàn 100%</span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1">Local Storage + Backup Checkpoints</p>
        </div>

      </div>

      <!-- Main Backup & Restore Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left Column: Backup & Restore Actions (6 cols) -->
        <div class="lg:col-span-6 space-y-6">
          
          <!-- Card 1: Xuất Bản Sao Lưu Toàn Diện -->
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <i data-lucide="download-cloud" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-900 text-sm">1. Xuất File Sao Lưu CSDL Dài Hạn (.json)</h3>
                <p class="text-xs text-slate-500">Tải về toàn bộ cơ sở dữ liệu để lưu trữ dự phòng</p>
              </div>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed mb-4">
              File sao lưu định dạng chuẩn JSON chứa đầy đủ: <strong>1.226 học sinh</strong>, <strong>33 danh mục quy chế</strong>, toàn bộ <strong>nhật ký vi phạm</strong>, toàn bộ <strong>kết quả thi đua các tuần (Tuần 1 đến 35+)</strong> và <strong>lịch sử điểm cộng</strong>. Bạn có thể cất giữ file này trên máy tính cá nhân, Google Drive của trường hoặc USB.
            </p>

            <button id="btn-export-full-backup-2" class="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs text-xs cursor-pointer">
              <i data-lucide="file-json" class="w-4 h-4"></i>
              <span>Tải Xuống File Backup Hệ Thống (.json)</span>
            </button>
          </div>

          <!-- Card 2: Phục Hồi Dữ Liệu Từ File Backup -->
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <i data-lucide="upload-cloud" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-900 text-sm">2. Khôi Phục Dữ Liệu Từ File Backup (.json)</h3>
                <p class="text-xs text-slate-500">Nạp lại dữ liệu từ file backup đã lưu trước đó</p>
              </div>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed mb-4">
              Khi chuyển máy tính, triển khai lại hệ thống hoặc cần khôi phục mốc thời gian cũ, hãy chọn file backup <code class="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">.json</code>. Hệ thống sẽ tự động kiểm tra cấu trúc dữ liệu, hiển thị bản xem trước và yêu cầu mật khẩu quản trị trước khi khôi phục an toàn.
            </p>

            <div class="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-5 text-center transition cursor-pointer bg-slate-50/50"
                 onclick="document.getElementById('input-backup-file').click()">
              <i data-lucide="file-up" class="w-8 h-8 mx-auto text-slate-400 mb-2"></i>
              <p class="text-xs font-bold text-slate-800">Nhấp để chọn file sao lưu (.json) từ máy tính</p>
              <p class="text-[11px] text-slate-400 mt-1">Chấp nhận tệp sao lưu chuẩn của Ban Nền Nếp THPT Số 1 Lê Hồng Phong</p>
              <input type="file" id="input-backup-file" accept=".json" class="hidden">
            </div>
          </div>

          <!-- Card 3: Cập nhật & Đồng bộ Máy chủ nội bộ của trường -->
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <i data-lucide="server" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-bold text-slate-900 text-sm">3. Triển Khai Trên Máy Chủ Riêng Của Trường</h3>
                <p class="text-xs text-slate-500">Đồng bộ nội bộ qua mạng LAN hoặc Local Server</p>
              </div>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed mb-3">
              Khi triển khai trên máy chủ nội bộ trường THPT Số 1 Lê Hồng Phong:
            </p>

            <div class="space-y-2 text-xs">
              <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div class="flex items-center gap-2">
                  <i data-lucide="file-code" class="w-4 h-4 text-purple-600"></i>
                  <span class="font-semibold text-slate-700">Tệp đồng bộ Server nội bộ:</span>
                </div>
                <button id="btn-export-server-json" class="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  <span>Xuất data_server_sync.json</span>
                </button>
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                <p class="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <i data-lucide="terminal" class="w-3.5 h-3.5 text-blue-600"></i>
                  <span>Chạy file sync_local.bat trên máy chủ:</span>
                </p>
                <p class="text-[11px] leading-relaxed">
                  Nhấp đúp chuột vào file <code class="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold text-slate-800">sync_local.bat</code> trong thư mục dự án để tự động đồng bộ dữ liệu mới nhất cho toàn trường.
                </p>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Snapshots Manager & Timeline (6 cols) -->
        <div class="lg:col-span-6 space-y-4">
          
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col h-full">
            
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <i data-lucide="history" class="w-5 h-5"></i>
                </div>
                <div>
                  <h3 class="font-bold text-slate-900 text-sm">Điểm Khôi Phục Nhanh (Snapshots Timeline)</h3>
                  <p class="text-xs text-slate-500">Tạo mốc lưu trữ theo mốc thời gian và khôi phục chỉ 1 chạm</p>
                </div>
              </div>

              <button id="btn-trigger-snapshot-modal" class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition text-xs shadow-xs cursor-pointer">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Tạo Mốc Mới</span>
              </button>
            </div>

            <!-- Snapshots List Container -->
            <div class="flex-1 overflow-y-auto max-h-[580px] space-y-3 pr-1" id="snapshots-list-container">
              <!-- Dynamically populated snapshot items -->
              <div class="py-12 text-center text-slate-400" id="snapshots-empty-state">
                <i data-lucide="clock" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
                <p class="text-xs font-semibold text-slate-600">Chưa có Điểm khôi phục nhanh nào.</p>
                <p class="text-[11px] text-slate-400 mt-1">Bấm nút "Tạo Mốc Mới" ở trên để lưu lại trạng thái CSDL hiện tại (VD: "Trước khi chốt Tuần 7").</p>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Hệ thống tự động lưu tối đa 30 điểm khôi phục gần nhất.</span>
              <button id="btn-clear-all-snapshots" class="text-rose-600 hover:underline font-semibold cursor-pointer">Xóa tất cả mốc</button>
            </div>

          </div>

        </div>

      </div>

    </div>

  </main>'''

old_main_end = '  </main>'
if old_main_end in content:
    content = content.replace(old_main_end, tab6_content, 1)
    print('Tab 6 added before </main> successfully')
else:
    print('Could not find </main>')

# 6. Add new Modals before </body>
new_modals = '''  <!-- ================================================================ -->
  <!-- MODAL: THÊM ĐIỂM CỘNG VÀO TB (Có Form & Cú Pháp Nhanh)             -->
  <!-- ================================================================ -->
  <div id="modal-bonus-points" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <i data-lucide="plus-circle" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Điểm Cộng Vào TB Thi Đua</h3>
            <p class="text-xs text-slate-500" id="modal-bonus-week-title">Áp dụng cho Tuần 7</p>
          </div>
        </div>
        <button id="btn-close-bonus-modal" class="text-slate-400 hover:text-slate-700 cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Bonus Tabs: Form vs Syntax -->
      <div class="flex border-b border-slate-200 mb-4 text-xs font-bold">
        <button id="tab-btn-bonus-form" class="py-2 px-4 border-b-2 border-amber-500 text-amber-700 active-tab-bonus">Form Chọn Lớp</button>
        <button id="tab-btn-bonus-syntax" class="py-2 px-4 border-b-2 border-transparent text-slate-500 hover:text-slate-800">Cú Pháp Nhanh</button>
      </div>

      <!-- Mode 1: Form -->
      <div id="bonus-mode-form" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Chọn Lớp:</label>
          <select id="bonus-select-class" class="w-full text-xs font-bold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
            <!-- Populated with 29 classes -->
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Số Điểm Cộng (Điểm vào TB):</label>
          <input type="number" id="bonus-input-points" step="0.1" min="0.1" max="10.0" value="1.0"
                 class="w-full text-sm font-bold p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500">
          <p class="text-[11px] text-slate-500 mt-1">Ví dụ: 0.5, 1.0, 1.5, 2.0 (cộng trực tiếp vào Điểm TB Chung)</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Lý Do Cộng Điểm:</label>
          <input type="text" id="bonus-input-reason" placeholder="VD: Đạt giải Nhất báo tường, Trực ban xuất sắc..."
                 class="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500">
        </div>

        <button id="btn-submit-bonus-form" class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-xs text-xs cursor-pointer">
          Áp Dụng Điểm Cộng
        </button>
      </div>

      <!-- Mode 2: Syntax -->
      <div id="bonus-mode-syntax" class="hidden space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nhập Cú Pháp Nhanh:</label>
          <textarea id="bonus-syntax-text" rows="4"
                    placeholder="Nhập theo cú pháp ví dụ:
10B01: 1.0 (Giải Nhất văn nghệ)
11A04: 0.5
12C03: 1"
                    class="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"></textarea>
          <p class="text-[11px] text-slate-500 mt-1">Cú pháp linh hoạt: <code class="font-mono text-slate-800">[Lớp]: [Số điểm]</code> hoặc <code class="font-mono text-slate-800">[Lớp] +[Số điểm]</code></p>
        </div>

        <button id="btn-submit-bonus-syntax" class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-xs text-xs cursor-pointer">
          Bóc Tách & Áp Dụng Cú Pháp
        </button>
      </div>

      <!-- Active Bonus Points Table for Selected Week -->
      <div class="mt-5 pt-4 border-t border-slate-100">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700">Điểm Cộng Đang Áp Dụng Tuần Này</h4>
          <span id="bonus-count-badge" class="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">0 lớp</span>
        </div>

        <div class="max-h-40 overflow-y-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <tr>
                <th class="p-2">Lớp</th>
                <th class="p-2 text-center">Điểm</th>
                <th class="p-2">Lý do</th>
                <th class="p-2 text-center w-12">Xóa</th>
              </tr>
            </thead>
            <tbody id="bonus-table-body">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>

  <!-- ================================================================ -->
  <!-- MODAL: XEM CHI TIẾT HỌC SINH VI PHẠM CỦA LỚP TRONG TUẦN          -->
  <!-- ================================================================ -->
  <div id="modal-view-class-violations" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <i data-lucide="alert-octagon" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900" id="modal-class-violations-title">Chi Tiết Vi Phạm Lớp 10B01</h3>
            <p class="text-xs text-slate-500" id="modal-class-violations-subtitle">Tổng hợp các vụ vi phạm được ghi nhận trên hệ thống</p>
          </div>
        </div>
        <button id="btn-close-class-violations-modal" class="text-slate-400 hover:text-slate-700 cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="max-h-72 overflow-y-auto border border-slate-200 rounded-xl mb-4">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 sticky top-0">
            <tr>
              <th class="p-2.5 w-10 text-center">STT</th>
              <th class="p-2.5">Ngày</th>
              <th class="p-2.5">Họ và Tên Học Sinh</th>
              <th class="p-2.5">Lỗi Vi Phạm</th>
              <th class="p-2.5 text-center w-16">Điểm Trừ</th>
            </tr>
          </thead>
          <tbody id="class-violations-tbody">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
        <span class="text-slate-500">Tổng điểm trừ liên kết tự động:</span>
        <span class="text-base font-extrabold text-rose-600" id="modal-class-violations-total">-0.0đ</span>
      </div>

    </div>
  </div>

  <!-- ================================================================ -->
  <!-- MODAL: TẠO ĐIỂM KHÔI PHỤC DỮ LIỆU NHANH (Snapshot Point)          -->
  <!-- ================================================================ -->
  <div id="modal-create-snapshot" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
      
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <i data-lucide="bookmark-plus" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Tạo Điểm Khôi Phục Mới</h3>
            <p class="text-xs text-slate-500">Lưu lại toàn bộ trạng thái CSDL tại thời điểm này</p>
          </div>
        </div>
        <button id="btn-close-create-snapshot" class="text-slate-400 hover:text-slate-700 cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tên Mốc Khôi Phục:</label>
          <input type="text" id="input-snapshot-name" placeholder="VD: Trước khi chốt kết quả Tuần 07"
                 class="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi Chú Thêm (Nếu có):</label>
          <input type="text" id="input-snapshot-desc" placeholder="VD: Đã cập nhật xong giờ ABCD của 29 lớp"
                 class="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button id="btn-cancel-create-snapshot" class="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
            Hủy
          </button>
          <button id="btn-confirm-create-snapshot" class="flex-1 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs cursor-pointer">
            Lưu Điểm Khôi Phục
          </button>
        </div>
      </div>

    </div>
  </div>

  <!-- ================================================================ -->
  <!-- MODAL: XEM TRƯỚC VÀ XÁC NHẬN KHÔI PHỤC FILE BACKUP (.JSON)       -->
  <!-- ================================================================ -->
  <div id="modal-backup-preview" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
      
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <i data-lucide="shield-alert" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Xác Nhận Khôi Phục Dữ Liệu</h3>
            <p class="text-xs text-slate-500">Kiểm tra thông tin bản sao lưu trước khi khôi phục</p>
          </div>
        </div>
        <button id="btn-close-backup-preview" class="text-slate-400 hover:text-slate-700 cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-3 text-xs mb-4">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-slate-500">Tên file backup:</span>
            <span class="font-bold text-slate-800" id="preview-backup-filename">backup.json</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500">Thời gian xuất file:</span>
            <span class="font-bold text-slate-800" id="preview-backup-time">--</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500">Số lượng học sinh:</span>
            <span class="font-bold text-blue-700" id="preview-backup-students">--</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500">Tổng số vi phạm:</span>
            <span class="font-bold text-amber-700" id="preview-backup-violations">--</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500">Số tuần thi đua:</span>
            <span class="font-bold text-emerald-700" id="preview-backup-weeks">--</span>
          </div>
        </div>

        <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
          <p class="font-bold mb-1">⚠️ Lưu ý an toàn:</p>
          <p class="text-[11px] leading-relaxed">
            Hệ thống sẽ tự động tạo một Snapshot lưu tạm dữ liệu hiện tại trước khi khôi phục. Nhập mật khẩu quản trị bên dưới để xác nhận:
          </p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Mật khẩu quản trị:</label>
          <input type="password" id="input-backup-password" placeholder="Nhập mật khẩu (lhp38)..."
                 class="w-full text-center text-sm font-mono tracking-widest p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500">
          <p id="backup-password-error" class="hidden text-xs text-rose-600 font-bold mt-1">Mật khẩu quản trị không chính xác!</p>
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button id="btn-cancel-backup-restore" class="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
          Hủy Bỏ
        </button>
        <button id="btn-confirm-backup-restore" class="flex-1 py-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition shadow-xs cursor-pointer">
          Khôi Phục Toàn Diện
        </button>
      </div>

    </div>
  </div>

  <!-- ================================================================ -->
  <!-- MODAL: SỬA NHANH THÔNG TIN LỚP THI ĐUA                          -->
  <!-- ================================================================ -->
  <div id="modal-edit-class-emulation" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <i data-lucide="edit" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900" id="modal-edit-class-title">Chỉnh Sửa Dữ Liệu Lớp</h3>
            <p class="text-xs text-slate-500" id="modal-edit-class-subtitle">Cập nhật giờ ABCD, SHL, nề nếp</p>
          </div>
        </div>
        <button id="btn-close-edit-class-modal" class="text-slate-400 hover:text-slate-700 cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-edit-class-emulation" class="space-y-4">
        <input type="hidden" id="edit-class-name">
        <input type="hidden" id="edit-class-week">

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 uppercase mb-1">Cột GVCN (SHL):</label>
            <input type="number" id="edit-class-shl" step="0.5" min="0" max="10"
                   class="w-full font-bold p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block font-bold text-slate-700 uppercase mb-1">Điểm 15' (Nề nếp):</label>
            <input type="number" id="edit-class-diem15" step="0.1" min="0" max="10"
                   class="w-full font-bold p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>

        <div class="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
          <h4 class="text-xs font-bold text-indigo-900 uppercase mb-2">Phần Giờ Học Tập (Giờ ABCD):</h4>
          <div class="grid grid-cols-5 gap-2 text-xs">
            <div>
              <label class="block text-center font-bold text-indigo-800 mb-1">Tốt</label>
              <input type="number" id="edit-class-tot" min="0" class="w-full text-center font-bold p-2 border border-indigo-200 rounded-lg">
            </div>
            <div>
              <label class="block text-center font-bold text-indigo-800 mb-1">Giờ A</label>
              <input type="number" id="edit-class-gioA" min="0" class="w-full text-center font-bold p-2 border border-indigo-200 rounded-lg">
            </div>
            <div>
              <label class="block text-center font-bold text-indigo-800 mb-1">Giờ B</label>
              <input type="number" id="edit-class-gioB" min="0" class="w-full text-center font-bold p-2 border border-indigo-200 rounded-lg">
            </div>
            <div>
              <label class="block text-center font-bold text-indigo-800 mb-1">Giờ C</label>
              <input type="number" id="edit-class-gioC" min="0" class="w-full text-center font-bold p-2 border border-indigo-200 rounded-lg">
            </div>
            <div>
              <label class="block text-center font-bold text-indigo-800 mb-1">Giờ D</label>
              <input type="number" id="edit-class-gioD" min="0" class="w-full text-center font-bold p-2 border border-indigo-200 rounded-lg">
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 uppercase mb-1">Số Lượt Vắng:</label>
            <input type="number" id="edit-class-hsvang" min="0"
                   class="w-full font-bold p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block font-bold text-slate-700 uppercase mb-1">Điểm Cộng TB:</label>
            <input type="number" id="edit-class-bonus" step="0.1" min="0" max="10"
                   class="w-full font-bold p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500">
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button type="button" id="btn-cancel-edit-class" class="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
            Đóng
          </button>
          <button type="submit" class="flex-1 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs cursor-pointer">
            Lưu Dữ Liệu Lớp
          </button>
        </div>
      </form>

    </div>
  </div>

'''

old_body_end = '  <!-- Toast Container -->'
if old_body_end in content:
    content = content.replace(old_body_end, new_modals + '  <!-- Toast Container -->', 1)
    print('New Modals added successfully')
else:
    print('Could not find <!-- Toast Container -->')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated index.html successfully!')
