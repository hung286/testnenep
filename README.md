# 🏫 Hệ Thống Điều Phối Nề Nếp & Thi Đua Học Đường - THPT Lê Hồng Phong

> **Trợ lý Số Chuyên sâu về Quản lý Giáo dục và Thi đua**  
> Ứng dụng Web hiện đại (Single Page Application - SPA) hỗ trợ Ban Thi đua, Ban Giám thị và Đội Cờ đỏ chuẩn hóa lỗi vi phạm bằng AI, tự động tính tuần năm học, tổng hợp xếp hạng và xuất báo cáo Excel chuẩn mực.

---

## ✨ Điểm Nổi Bật Của Hệ Thống

1. **Bộ Não AI Giám Thị (Powered by Google Gemini):**
   - Phân tích cú pháp ngôn ngữ tự nhiên từ ghi chú thô của giám thị (ví dụ: *"Tuấn 10B01 và Hùng 11A04 đi học muộn, không đeo bảng tên"*).
   - Tự động bóc tách và đối chiếu danh sách **1.226 học sinh** thuộc **29 lớp**.
   - Tự động quy đổi hành vi vi phạm về **33 danh mục lỗi quy chế chuẩn** và áp khung điểm trừ chính xác.
   - Cơ chế Fallback 3 cấp độ: `gemini-3-flash-preview` (mặc định) $\rightarrow$ `gemini-3-pro-preview` $\rightarrow$ `gemini-2.5-flash` tự động thử lại khi gặp hạn mức API (429, 503,...).
2. **Quản Trị Dữ Liệu Nguồn Mở (Open & Customizable):**
   - **Quản lý học sinh:** Thêm, sửa, xóa học sinh trực tiếp trên giao diện; Hỗ trợ Import file Excel (`.xlsx`, `.xlsm`, `.csv`) và Export Excel.
   - **Quản lý quy chế & điểm trừ:** Tự do thêm lỗi mới, sửa khung điểm phạt theo từng năm học hoặc khôi phục mặc định.
3. **Quản Lý Thời Gian Năm Học Chuẩn Xác:**
   - **Mốc Tuần 1 bắt đầu từ Thứ Hai, 07/09/2026**.
   - Tự động tính chính xác tuần học từ bất kỳ ngày nào ghi nhận vi phạm.
4. **Báo Cáo & Xếp Hạng Tự Động:**
   - Lớp có tổng điểm trừ **thấp nhất xếp Hạng 1**.
   - Phân loại trạng thái: Xuất sắc, Tốt, Khá, Trung bình.
   - Biểu đồ trực quan (Chart.js) thống kê điểm trừ theo lớp và top 5 lỗi vi phạm phổ biến.
   - Xuất dữ liệu đa định dạng: File Excel (`.xlsx`) hoặc Copy bảng Markdown dán thẳng vào Excel.

---

## 🔑 Hướng Dẫn Thiết Lập Google Gemini API Key

Hệ thống hoạt động 100% trên trình duyệt người dùng (Client-Side), API Key được lưu an toàn trong `localStorage` máy cá nhân, không thông qua bất kỳ server trung gian nào.

1. Truy cập trang Google AI Studio: **[https://aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)**.
2. Đăng nhập bằng tài khoản Google cá nhân hoặc tài khoản trường.
3. Nhấp vào nút **"Create API Key"** (Tạo khóa API) $\rightarrow$ Chọn một Google Cloud Project hoặc bấm tạo mới.
4. Copy đoạn mã API Key (dạng `AIzaSy...`).
5. Mở ứng dụng Quản lý Nề nếp $\rightarrow$ Nhấp vào nút **"Lấy API key để sử dụng app"** hoặc **"Cài đặt AI"** trên Header $\rightarrow$ Dán API Key vào và nhấn **"Lưu Thiết Lập"**.

---

## 🚀 Hướng Dẫn Triển Khai Lên Vercel (0 đồng chi phí)

Ứng dụng đã được cấu hình sẵn file `vercel.json` chuẩn Single Page Application (SPA).

### Cách 1: Đẩy code lên GitHub và kết nối Vercel
1. Khởi tạo Git và đẩy thư mục `quanlinenep` lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Khoi tao he thong quan ly ne nep THPT Le Hong Phong"
   git branch -M main
   git remote add origin https://github.com/TÊN_GITHUB_CỦA_BẠN/quanlinenep.git
   git push -u origin main
   ```
2. Truy cập [vercel.com](https://vercel.com) $\rightarrow$ Đăng nhập bằng GitHub.
3. Nhấp **"Add New Project"** $\rightarrow$ Chọn repository `quanlinenep`.
4. Nhấn **"Deploy"** (Vercel tự động nhận diện và hoàn tất trong 30 giây).

### Cách 2: Chạy trực tiếp trên máy tính cá nhân
- Bạn chỉ cần nhấp đúp trực tiếp vào file `index.html` trong thư mục này để mở trên trình duyệt (Chrome, Edge, Cốc Cốc, Firefox, Safari) mà không cần cài đặt thêm bất kỳ phần mềm máy chủ nào!

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
quanlinenep/
├── index.html            # Giao diện chính (Tailwind CSS, Lucide Icons, SheetJS, Chart.js)
├── app.js                # Nghiệp vụ: Tính tuần, CRUD học sinh/lỗi, RBAC 3 cấp, Cloud Sync
├── gemini-service.js     # Bộ não AI Gemini: Fallback chain, parse tự nhiên, kiểm soát lỗi
├── google_apps_script.js # Backend Cloud Database Google Sheets (Apps Script Web App)
├── google_apps_script.gs # File Google Apps Script (.gs) tải về
├── style.css             # Giao diện sư phạm hiện đại, thiết kế theo chuẩn SKILL EDUCATION
├── data_initial.js       # Dữ liệu dự phòng nhúng sẵn (1.226 HS & 33 quy định lỗi)
├── data_students.json    # CSDL trích xuất 1.226 học sinh 29 lớp THPT Lê Hồng Phong
├── data_rules.json       # CSDL trích xuất 33 danh mục lỗi vi phạm kèm khung điểm trừ
├── vercel.json           # Cấu hình routing SPA cho Vercel
├── DSHS.xlsm             # File Excel gốc của nhà trường
└── README.md             # Tài liệu hướng dẫn sử dụng & triển khai
```

---

## 📊 Cơ Sở Dữ Liệu Đám Mây Google Sheets (Cloud Database)

Hệ thống hỗ trợ tích hợp trực tiếp **Google Sheets** thông qua **Google Apps Script Web App Endpoint**:
- **Đồng bộ tự động 2 chiều:** Thêm, Sửa, Xóa học sinh vi phạm hoặc chỉnh sửa bảng thi đua đều tự động đẩy lên Google Sheets thời gian thực qua `fetch(async/await)`.
- **Hoạt động đa thiết bị:** Điện thoại (iPhone, Android) và Máy tính bảng chỉ cần mở đường link trên trình duyệt là sử dụng được ngay, **hoàn toàn không cần đăng nhập Google**.
- **Trang tính trực quan:**
  - `NhatKyViPham`: Tự động ghi lại từng học sinh vi phạm, sắp xếp thứ tự lớp từ A &rarr; Z ($10B01 \rightarrow 12C09$).
  - `BangTongHopThiDua`: Bảng tổng hợp thi đua theo tuần, TB nề nếp, điểm học tập, TB chung, xếp loại và vị thứ.

---

*Hệ thống được thiết kế và xây dựng bởi Chuyên gia Điều phối Thi đua & Quản lý Nề nếp Học đường.*
