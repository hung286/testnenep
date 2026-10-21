/**
 * ==============================================================================
 * HỆ THỐNG QUẢN LÝ NỀN NẾP & HỌC SINH VI PHẠM - TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG
 * GOOGLE APPS SCRIPT CLOUD DATABASE BACKEND (ENDPOINT CHO WEB & MOBILE)
 * ==============================================================================
 * 
 * ĐẶC ĐIỂM KỸ THUẬT:
 * 1. Đóng vai trò là Cơ sở dữ liệu đám mây (Cloud Database) chính thức cho hệ thống.
 * 2. Hỗ trợ đồng bộ 2 chiều (GET/POST) tức thì với ứng dụng Web và Mobile.
 * 3. Tự động cập nhật 2 trang tính trực quan:
 *    - "NhatKyViPham": Bảng nhật ký học sinh vi phạm chuẩn hóa, sắp xếp lớp từ A -> Z.
 *    - "BangTongHopThiDua": Bảng tổng hợp điểm nền nếp, học tập, TB chung, xếp loại và vị thứ.
 * 4. Tương thích 100% với thiết bị di động (điện thoại, máy tính bảng) KHÔNG CẦN đăng nhập Google.
 * 
 * HƯỚNG DẪN TRIỂN KHAI NHANH (CHỈ MẤT 2 PHÚT):
 * 1. Mở trang Google Sheet của bạn (hoặc tạo mới tại https://sheets.new).
 * 2. Trên thanh menu Google Sheets, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết mã có sẵn trong trình soạn thảo, dán toàn bộ nội dung file này vào và bấm Ctrl+S (Lưu).
 * 4. Bấm nút "Triển khai" (Deploy) ở góc trên bên phải -> Chọn "Tùy chọn triển khai mới" (New deployment).
 * 5. Bấm vào biểu tượng Bánh răng (⚙) cạnh "Chọn loại", chọn "Ứng dụng web" (Web app).
 * 6. Điền thông tin cấu hình:
 *    - Mô tả: "Cloud Database Nen Nep THPT Le Hong Phong"
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)  <-- [BẮT BUỘC CHỌN TÔI]
 *    - Người có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)  <-- [BẮT BUỘC ĐỂ ĐIỆN THOẠI KHÔNG CẦN ĐĂNG NHẬP GOOGLE]
 * 7. Bấm "Triển khai" (Deploy). Nếu Google hỏi cấp quyền:
 *    - Bấm "Ủy quyền truy cập" (Authorize access).
 *    - Chọn tài khoản Google của bạn -> Bấm "Nâng cao" (Advanced) -> Bấm "Đi tới... (không an toàn)".
 *    - Bấm "Cho phép" (Allow).
 * 8. Sao chép "URL Ứng dụng web" (dạng https://script.google.com/macros/s/AKfycb.../exec).
 * 9. Mở Web Quản lý nền nếp -> Bấm Cài đặt (Bánh răng) -> Dán URL vào ô "Google Apps Script Web App" và bấm Lưu.
 * ==============================================================================
 */

var SHEET_VIOLATIONS = 'NhatKyViPham';
var SHEET_EMULATION = 'BangTongHopThiDua';
var SHEET_RAW_DATA = 'HeThong_Data';

/**
 * Xử lý GET Request: Trả về dữ liệu từ Google Sheets về Web / Mobile
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'get';

    // 1. Kiểm tra trạng thái kết nối nhanh (Ping)
    if (action === 'ping') {
      return createJsonResponse({
        status: 'success',
        message: 'Google Sheets Cloud Database kết nối thông suốt!',
        spreadsheet_name: SpreadsheetApp.getActiveSpreadsheet().getName(),
        timestamp: new Date().toISOString()
      });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rawData = loadRawData(ss);

    // 2. Nếu chưa có dữ liệu sao lưu JSON nguyên bản, khôi phục từ Sheet NhatKyViPham
    if (!rawData || !rawData.violations) {
      var sheetV = ss.getSheetByName(SHEET_VIOLATIONS);
      var violations = [];
      if (sheetV && sheetV.getLastRow() > 1) {
        var data = sheetV.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          if (!row[1] && !row[6]) continue;
          violations.push({
            id: String(row[1] || ('v_' + i)),
            date: row[2] ? formatDate(row[2]) : '',
            week: parseInt(row[3], 10) || 1,
            class_name: String(row[5] || ''),
            student_name: String(row[6] || ''),
            gender: String(row[7] || ''),
            violation_category: String(row[8] || ''),
            penalty_points: Math.abs(parseFloat(row[9]) || 0),
            original_note: String(row[10] || '')
          });
        }
      }
      rawData = {
        version: 2,
        updated_at: Date.now(),
        violations: violations,
        deleted_ids: []
      };
    }

    return createJsonResponse({
      status: 'success',
      data: rawData,
      count: (rawData.violations || []).length,
      timestamp: Date.now()
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: 'Lỗi đọc dữ liệu từ Google Sheets: ' + err.toString()
    });
  }
}

/**
 * Xử lý POST Request: Nhận dữ liệu từ Web / Mobile và lưu tự động vào Google Sheets
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    // Chống xung đột đồng thời khi nhiều giám thị ghi nhận cùng 1 lúc (chờ tối đa 30s)
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return createJsonResponse({
        status: 'error',
        message: 'Google Sheets đang bận xử lý dữ liệu. Vui lòng thử lại sau vài giây!'
      });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: 'error',
        message: 'Không nhận được dữ liệu (Nội dung gửi lên rỗng)'
      });
    }

    var contents = e.postData.contents;
    var payload;
    try {
      payload = JSON.parse(contents);
    } catch (parseErr) {
      return createJsonResponse({
        status: 'error',
        message: 'Dữ liệu không đúng định dạng JSON hợp lệ: ' + parseErr.toString()
      });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Lưu trữ bản sao dữ liệu toàn vẹn (Full State) vào sheet HeThong_Data
    saveRawData(ss, contents);

    // 2. Cập nhật trang Nhật Ký Vi Phạm (NhatKyViPham)
    var violations = payload.violations || [];
    updateViolationsSheet(ss, violations);

    // 3. Cập nhật trang Bảng Tổng Hợp Thi Đua (BangTongHopThiDua)
    if (payload.emulation_weeks) {
      updateEmulationSheet(ss, payload.emulation_weeks, payload.bonus_points || {});
    }

    return createJsonResponse({
      status: 'success',
      message: 'Đã đồng bộ an toàn ' + violations.length + ' bản ghi vi phạm lên Google Sheets!',
      count: violations.length,
      updated_at: Date.now()
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: 'Lỗi cập nhật Google Sheets: ' + err.toString(),
      stack: err.stack
    });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Cập nhật trang Nhật Ký Vi Phạm (NhatKyViPham)
 * Sắp xếp: Tuần giảm dần -> Lớp A-Z (10B01 -> 12C09) -> Tên học sinh
 */
function updateViolationsSheet(ss, violations) {
  var sheet = getOrCreateSheet(ss, SHEET_VIOLATIONS, 1);
  sheet.clear();

  // Tiêu đề cột chuẩn
  var headers = [
    'STT',
    'Mã Vi Phạm (ID)',
    'Ngày Vi Phạm',
    'Tuần',
    'Khối',
    'Lớp',
    'Họ Và Tên Học Sinh',
    'Giới Tính',
    'Lỗi Vi Phạm',
    'Điểm Trừ',
    'Ghi Chú / Nguồn Nhập',
    'Thời Điểm Đồng Bộ'
  ];

  sheet.appendRow(headers);

  // Định dạng dòng tiêu đề
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1E3A8A'); // Màu xanh Navy đậm sang trọng
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);

  if (!violations || violations.length === 0) {
    sheet.setFrozenRows(1);
    autoFitColumns(sheet, headers.length);
    return;
  }

  // Sắp xếp danh sách vi phạm: Tuần (giảm dần) -> Lớp (A-Z) -> Họ tên
  var sortedViolations = violations.slice().sort(function(a, b) {
    var weekA = parseInt(a.week, 10) || 0;
    var weekB = parseInt(b.week, 10) || 0;
    if (weekB !== weekA) return weekB - weekA;

    var classA = String(a.class_name || '').toUpperCase();
    var classB = String(b.class_name || '').toUpperCase();
    if (classA !== classB) return classA.localeCompare(classB, 'vi');

    var nameA = String(a.student_name || '');
    var nameB = String(b.student_name || '');
    return nameA.localeCompare(nameB, 'vi');
  });

  var syncTime = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
  var rows = [];

  for (var i = 0; i < sortedViolations.length; i++) {
    var v = sortedViolations[i];
    var className = String(v.class_name || '');
    var grade = '';
    if (className.length >= 2) {
      grade = className.substring(0, 2);
    }
    var points = Math.abs(parseFloat(v.penalty_points) || 0);

    rows.push([
      i + 1,
      String(v.id || ''),
      formatDate(v.date),
      parseInt(v.week, 10) || '',
      grade,
      className,
      String(v.student_name || ''),
      String(v.gender || ''),
      String(v.violation_category || ''),
      points > 0 ? -points : 0,
      String(v.original_note || ''),
      syncTime
    ]);
  }

  if (rows.length > 0) {
    var dataRange = sheet.getRange(2, 1, rows.length, headers.length);
    dataRange.setValues(rows);
    dataRange.setFontSize(10);
    dataRange.setVerticalAlignment('middle');

    // Căn giữa cho các cột: STT (1), ID (2), Ngày (3), Tuần (4), Khối (5), Lớp (6), Giới tính (8), Điểm trừ (10), Ngày đồng bộ (12)
    sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 2, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 3, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 4, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 5, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 6, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 8, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 10, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 12, rows.length, 1).setHorizontalAlignment('center');

    // Định dạng số cho cột Điểm trừ
    var pointsRange = sheet.getRange(2, 10, rows.length, 1);
    pointsRange.setNumberFormat('0.0');
    pointsRange.setFontColor('#DC2626'); // Màu đỏ cho điểm trừ
    pointsRange.setFontWeight('bold');

    // Kẻ lưới bảng
    sheet.getRange(1, 1, rows.length + 1, headers.length).setBorder(
      true, true, true, true, true, true, '#CBD5E1', SpreadsheetApp.BorderStyle.SOLID
    );
  }

  sheet.setFrozenRows(1);
  autoFitColumns(sheet, headers.length);
}

/**
 * Cập nhật trang Bảng Tổng Hợp Thi Đua (BangTongHopThiDua)
 */
function updateEmulationSheet(ss, emulationWeeks, bonusPoints) {
  var sheet = getOrCreateSheet(ss, SHEET_EMULATION, 2);
  sheet.clear();

  var headers = [
    'Tuần',
    'Khối',
    'Lớp',
    'GVCN',
    'Điểm Nền Nếp (300đ)',
    'Tổng Điểm Cộng',
    'Tổng Điểm Trừ',
    'TB Nền Nếp',
    'Điểm Học Tập',
    'Tổng Hợp Chung',
    'Xếp Loại',
    'Vị Thứ',
    'Ghi Chú Lý Do Điểm Cộng'
  ];

  sheet.appendRow(headers);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#065F46'); // Màu xanh lá rừng đậm
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);

  if (!emulationWeeks || typeof emulationWeeks !== 'object') {
    sheet.setFrozenRows(1);
    autoFitColumns(sheet, headers.length);
    return;
  }

  var rows = [];
  var weekKeys = Object.keys(emulationWeeks).map(Number).sort(function(a, b) { return b - a; });

  for (var wIdx = 0; wIdx < weekKeys.length; wIdx++) {
    var w = weekKeys[wIdx];
    var weekData = emulationWeeks[w];
    if (!weekData || !weekData.classes) continue;

    var classNames = Object.keys(weekData.classes).sort(function(a, b) {
      return a.localeCompare(b, 'vi');
    });

    var weekBonusList = (bonusPoints && bonusPoints[w]) ? bonusPoints[w] : [];

    for (var cIdx = 0; cIdx < classNames.length; cIdx++) {
      var cName = classNames[cIdx];
      var c = weekData.classes[cName];
      var grade = cName.substring(0, 2);

      // Thu thập ghi chú điểm cộng
      var classBonusNotes = [];
      for (var bIdx = 0; bIdx < weekBonusList.length; bIdx++) {
        var bItem = weekBonusList[bIdx];
        if (bItem && String(bItem.className || '').toUpperCase() === cName.toUpperCase()) {
          var pts = parseFloat(bItem.points) || 0;
          classBonusNotes.push('+' + pts + 'đ (' + (bItem.reason || 'Khen thưởng') + ')');
        }
      }

      rows.push([
        'Tuần ' + w,
        grade,
        cName,
        c.gvcn || '',
        300,
        parseFloat(c.bonusPoints) || 0,
        parseFloat(c.diemTru) || 0,
        parseFloat(c.tbNenNep) || 0,
        parseFloat(c.hocTap) || 0,
        parseFloat(c.tbChung) || 0,
        c.xepLoai || '',
        c.viThu ? parseInt(c.viThu, 10) : '',
        classBonusNotes.join('; ')
      ]);
    }
  }

  if (rows.length > 0) {
    var dataRange = sheet.getRange(2, 1, rows.length, headers.length);
    dataRange.setValues(rows);
    dataRange.setFontSize(10);
    dataRange.setVerticalAlignment('middle');

    // Căn giữa cho Tuần (1), Khối (2), Lớp (3), Điểm chuẩn (5), Xếp loại (11), Vị thứ (12)
    sheet.getRange(2, 1, rows.length, 3).setHorizontalAlignment('center');
    sheet.getRange(2, 5, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 11, rows.length, 2).setHorizontalAlignment('center');

    // Định dạng số 2 chữ số thập phân cho Điểm
    sheet.getRange(2, 6, rows.length, 5).setNumberFormat('0.00');

    // Kẻ lưới bảng
    sheet.getRange(1, 1, rows.length + 1, headers.length).setBorder(
      true, true, true, true, true, true, '#CBD5E1', SpreadsheetApp.BorderStyle.SOLID
    );
  }

  sheet.setFrozenRows(1);
  autoFitColumns(sheet, headers.length);
}

/**
 * Lưu JSON nguyên bản vào sheet HeThong_Data (Chia nhỏ mỗi ô tối đa 30.000 ký tự để không bị giới hạn Google Sheet)
 */
function saveRawData(ss, jsonString) {
  var sheet = getOrCreateSheet(ss, SHEET_RAW_DATA, 3);
  sheet.clear();

  var CHUNK_SIZE = 30000;
  var chunks = [];
  for (var i = 0; i < jsonString.length; i += CHUNK_SIZE) {
    chunks.push([jsonString.substring(i, i + CHUNK_SIZE)]);
  }

  if (chunks.length > 0) {
    sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
  }
}

/**
 * Đọc JSON nguyên bản từ sheet HeThong_Data
 */
function loadRawData(ss) {
  var sheet = ss.getSheetByName(SHEET_RAW_DATA);
  if (!sheet) return null;

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return null;

  var values = sheet.getRange(1, 1, lastRow, 1).getValues();
  var jsonString = values.map(function(r) { return r[0]; }).join('');

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
}

function SHERAW_DATA() {
  return SHEET_RAW_DATA;
}

/**
 * Tiện ích lấy hoặc tạo Sheet mới theo tên
 */
function getOrCreateSheet(ss, sheetName, position) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName, position ? position - 1 : 0);
  }
  return sheet;
}

/**
 * Tự động căn chỉnh độ rộng cột
 */
function autoFitColumns(sheet, colCount) {
  for (var i = 1; i <= colCount; i++) {
    sheet.autoResizeColumn(i);
    var width = sheet.getColumnWidth(i);
    if (width < 80) sheet.setColumnWidth(i, 80);
    if (width > 350) sheet.setColumnWidth(i, 350);
  }
}

/**
 * Định dạng ngày YYYY-MM-DD
 */
function formatDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    return dateVal.slice(0, 10);
  }
  try {
    return Utilities.formatDate(new Date(dateVal), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Tạo phản hồi JSON chuẩn CORS cho Web & Mobile
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Tạo Menu tiện ích trực tiếp trên thanh công cụ Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⭐ Quản Lý Nền Nếp THPT Lê Hồng Phong')
    .addItem('🔄 Tự động căn chỉnh độ rộng các cột', 'menuAutoFitColumns')
    .addItem('📊 Làm mới Bảng Tổng Hợp Thi Đua', 'menuRefreshEmulation')
    .addSeparator()
    .addItem('ℹ️ Thông tin kết nối Web App', 'menuShowInfo')
    .addToUi();
}

function menuAutoFitColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetV = ss.getSheetByName(SHEET_VIOLATIONS);
  if (sheetV) autoFitColumns(sheetV, 12);
  var sheetE = ss.getSheetByName(SHEET_EMULATION);
  if (sheetE) autoFitColumns(sheetE, 13);
  SpreadsheetApp.getUi().alert('Đã tự động căn chỉnh hoàn tất các cột!');
}

function menuRefreshEmulation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawData = loadRawData(ss);
  if (rawData && rawData.emulation_weeks) {
    updateEmulationSheet(ss, rawData.emulation_weeks, rawData.bonus_points);
    SpreadsheetApp.getUi().alert('Đã làm mới thành công Bảng Tổng Hợp Thi Đua!');
  } else {
    SpreadsheetApp.getUi().alert('Chưa có dữ liệu thi đua trong hệ thống.');
  }
}

function menuShowInfo() {
  var msg = 'Hệ thống Quản lý Nền nếp & Học sinh Vi phạm - THPT Số 1 Lê Hồng Phong\n\n' +
            '• Trang tính này đang được liên kết với ứng dụng Web và Mobile.\n' +
            '• Mọi thay đổi khi giám thị nhập trên điện thoại sẽ tự động xuất hiện tại đây theo thời gian thực.\n' +
            '• Nếu cần cấp quyền mới, vào menu: Triển khai -> Quản lý các bản triển khai.';
  SpreadsheetApp.getUi().alert(msg);
}
