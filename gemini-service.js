/**
 * Gemini Service - Bộ não AI Điều phối Nền nếp & Thi đua Học đường
 * Trường THPT Số 1 Lê Hồng Phong - Ban nền nếp
 * 
 * Phiên bản Nâng cấp Toàn diện:
 * 1. Khắc phục lỗi Quá tải 429 (Exponential Backoff Retry & Seamless Fallback).
 * 2. Tự động chia nhỏ Batch/Chunk cho văn bản dài nhiều dòng.
 * 3. Hỗ trợ OCR Multimodal Vision AI bóc tách chữ viết tay từ ảnh chụp sổ tay vi phạm.
 * 4. Tự động quy chuẩn lỗi Áo khoác / Áo đoàn về "Sai đồng phục" (-0.5đ).
 * 5. Tự động tách dòng độc lập theo từng ngày vi phạm (Multi-Date Splitting).
 */

// Tự động giải mã và lưu API Key ngầm
const DEFAULT_API_KEY = typeof atob !== 'undefined'
  ? atob("QVEuQWI4Uk42S05UclVUVEFDaTZoOTQwRW5ETEt1LW1UUTdMcTVldlRsQUx0aVBDSG9jOEE=")
  : "";

if (!localStorage.getItem('gemini_api_key') || localStorage.getItem('gemini_api_key').trim() === '') {
  localStorage.setItem('gemini_api_key', DEFAULT_API_KEY);
}

const GEMINI_MODELS = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    badge: 'Mặc định (Tốc độ & Ổn định)',
    desc: 'Tốc độ cực nhanh, hỗ trợ cả văn bản & ảnh chữ viết tay, quota dồi dào, kháng lỗi 429 vượt trội.',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300'
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    badge: 'Chính xác chuyên sâu',
    desc: 'Khả năng suy luận ngữ cảnh sâu sắc, bóc tách chính xác chữ viết tay khó đọc (thay thế gemini-3-pro-preview).',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-300'
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Thế hệ mới tốc độ cao',
    desc: 'Phiên bản Flash mới nhất từ Google AI, ổn định và tối ưu cho xử lý dữ liệu lớn.',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-300'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Tương thích ngược',
    desc: 'Dự phòng tương thích ngược cho các tài khoản hỗ trợ.',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300'
  }
];

class GeminiService {
  constructor() {
    let key = localStorage.getItem('gemini_api_key');
    if (!key || key.trim() === '') {
      key = DEFAULT_API_KEY;
      localStorage.setItem('gemini_api_key', key);
    }
    this.apiKey = key;
    this.selectedModel = this.getSelectedModel();
    this.models = GEMINI_MODELS;
  }

  getApiKey() {
    let key = localStorage.getItem('gemini_api_key');
    if (!key || key.trim() === '') {
      key = DEFAULT_API_KEY;
      localStorage.setItem('gemini_api_key', key);
    }
    return key;
  }

  setApiKey(key) {
    this.apiKey = (key || DEFAULT_API_KEY).trim();
    localStorage.setItem('gemini_api_key', this.apiKey);
  }

  getSelectedModel() {
    let model = localStorage.getItem('gemini_selected_model') || 'gemini-3-flash-preview';
    // Tự động nâng cấp model cũ bị 404 hoặc không tương thích
    if (model === 'gemini-3-pro-preview') {
      model = 'gemini-3.1-pro-preview';
      localStorage.setItem('gemini_selected_model', model);
    } else if (model === 'gemini-2.5-flash') {
      model = 'gemini-3-flash-preview';
      localStorage.setItem('gemini_selected_model', model);
    }
    return model;
  }

  setSelectedModel(modelId) {
    if (modelId === 'gemini-3-pro-preview') {
      modelId = 'gemini-3.1-pro-preview';
    }
    this.selectedModel = modelId;
    localStorage.setItem('gemini_selected_model', modelId);
  }

  getFallbackChain(startModelId) {
    let cleanStart = startModelId;
    if (cleanStart === 'gemini-3-pro-preview') {
      cleanStart = 'gemini-3.1-pro-preview';
    }
    const list = this.models.map(m => m.id);
    const startIdx = list.indexOf(cleanStart);
    if (startIdx === -1) return list;
    return [cleanStart, ...list.filter(id => id !== cleanStart)];
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Chuẩn hóa quy chế lỗi vi phạm:
   * Tất cả các lỗi liên quan đến "áo khoác", "áo đoàn", "không mang áo khoác", "không mặc áo đoàn"
   * đều được tự động quy về chung một danh mục chuẩn duy nhất là: "Sai đồng phục" (-0.5đ).
   */
  normalizeViolationRule(category, originalText) {
    const combined = ((category || '') + ' ' + (originalText || '')).toLowerCase();
    const toneFree = this.removeVietnameseTones(combined);

    const isUniformViolation = 
      toneFree.includes('ao khoac') || 
      toneFree.includes('ao doan') || 
      toneFree.includes('khong mang ao khoac') || 
      toneFree.includes('khong mac ao khoac') || 
      toneFree.includes('khong mac ao doan') || 
      toneFree.includes('quen ao doan') ||
      toneFree.includes('sai ao doan') ||
      toneFree.includes('ao gio') ||
      toneFree.includes('sai dong phuc');

    if (isUniformViolation) {
      return {
        category: 'Sai đồng phục',
        points: 0.5
      };
    }
    return null;
  }

  /**
   * Trích xuất các mốc ngày trong văn bản (ví dụ "19/10 và 22/10", "ngày 19-10-2026", "T2 (19/10), T5 (22/10)")
   */
  extractDatesFromText(text, defaultYear = 2026) {
    if (!text) return [];
    const regex = /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/g;
    const dates = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      let day = parseInt(match[1], 10);
      let month = parseInt(match[2], 10);
      let year = match[3] ? parseInt(match[3], 10) : defaultYear;
      if (year < 100) year += 2000;
      if (day > 12 && month <= 12) {
        // day/month
      } else if (month > 12 && day <= 12) {
        // reversed month/day
        const temp = day; day = month; month = temp;
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!dates.includes(iso)) dates.push(iso);
      }
    }
    return dates;
  }

  /**
   * Tách dòng tự động theo từng ngày vi phạm (Multi-Date Splitting)
   */
  splitMultiDateRecords(records, defaultDate) {
    if (!Array.isArray(records)) return [];
    const defaultYear = defaultDate ? parseInt(defaultDate.split('-')[0], 10) : 2026;
    const result = [];

    records.forEach(rec => {
      // 1. Áp dụng chuẩn hóa lỗi Áo khoác & Áo đoàn
      const normalizedRule = this.normalizeViolationRule(rec.violation_category, rec.original_text || rec.note);
      if (normalizedRule) {
        rec.violation_category = normalizedRule.category;
        rec.penalty_points = normalizedRule.points;
      }

      // 2. Tìm tất cả các ngày liên quan
      let detectedDates = [];
      if (Array.isArray(rec.dates) && rec.dates.length > 0) {
        detectedDates = rec.dates;
      } else {
        const textDates = this.extractDatesFromText(rec.original_text || '', defaultYear);
        if (textDates.length > 0) {
          detectedDates = textDates;
        } else if (rec.date) {
          detectedDates = [rec.date];
        } else {
          detectedDates = [defaultDate];
        }
      }

      // Loại bỏ trùng lặp ngày
      detectedDates = [...new Set(detectedDates.filter(Boolean))];

      if (detectedDates.length <= 1) {
        rec.date = detectedDates[0] || defaultDate;
        result.push(rec);
      } else {
        // Học sinh vi phạm ở nhiều ngày khác nhau -> BẮT BUỘC TÁCH THÀNH CÁC DÒNG RIÊNG BIỆT
        detectedDates.forEach((d, idx) => {
          result.push({
            ...rec,
            date: d,
            original_text: `${rec.original_text || ''} (Ngày ${d})`.trim(),
            multiple_dates_split: true,
            split_index: idx + 1,
            split_total: detectedDates.length
          });
        });
      }
    });

    return result;
  }

  /**
   * Gọi API Gemini với cơ chế Exponential Backoff Retry (xử lý 429 RESOURCE_EXHAUSTED & 503)
   * Thời gian chờ tăng theo cấp số nhân: 2s -> 4s -> 8s (kèm jitter ngẫu nhiên)
   */
  async _callGeminiAPIWithRetry(apiKey, modelId, requestBody, onStatusUpdate = () => {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const retryDelays = [2000, 4000, 8000];
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          let errorDetail = '';
          try {
            const errJson = await response.json();
            errorDetail = errJson.error ? `${errJson.error.code} ${errJson.error.status}: ${errJson.error.message}` : JSON.stringify(errJson);
          } catch (e) {
            errorDetail = await response.text();
          }

          // 1. Nếu là lỗi 404 (Model Không Tồn Tại / Đã Ngừng Hỗ Trợ): Không thử lại trên model này mà lập tức chuyển model dự phòng
          if (response.status === 404) {
            throw new Error(`HTTP 404: Mô hình ${modelId} không tồn tại hoặc đã ngừng hỗ trợ. Hệ thống tự động chuyển mô hình dự phòng.`);
          }

          // 2. Nếu là lỗi 429 (Rate Limit / Quá giới hạn tạm thời) hoặc 503/500 (Máy chủ bận):
          const isRateLimited = response.status === 429 || errorDetail.includes('RESOURCE_EXHAUSTED');
          const isServerBusy = response.status === 503 || response.status === 500;

          if ((isRateLimited || isServerBusy) && attempt <= maxRetries) {
            const baseDelay = retryDelays[attempt - 1] || 8000;
            const jitter = Math.floor(Math.random() * 300);
            const actualDelay = baseDelay + jitter;
            const waitTimeSec = Math.round(actualDelay / 1000);

            onStatusUpdate({
              type: 'retry',
              message: `Đạt giới hạn tạm thời (${response.status} / Quá tải). Hệ thống tự động chờ ${waitTimeSec} giây để thử lại (Lần ${attempt}/${maxRetries})...`,
              waitTime: waitTimeSec,
              model: modelId
            });
            await this.sleep(actualDelay);
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${errorDetail || response.statusText}`);
        }

        const data = await response.json();
        const candidate = data.candidates && data.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
          throw new Error('Dữ liệu phản hồi từ Gemini API rỗng hoặc không đúng định dạng.');
        }

        const rawText = candidate.content.parts[0].text;
        return this._extractJSON(rawText);

      } catch (err) {
        // Nếu đã hết số lần thử hoặc gặp 404, lập tức quăng lỗi ra ngoài để callWithFallback chuyển sang model tiếp theo
        if (attempt > maxRetries || (err.message && err.message.includes('404'))) {
          throw err;
        }
        // Trường hợp mất kết nối mạng, áp dụng backoff tương ứng
        const baseDelay = retryDelays[attempt - 1] || 8000;
        const actualDelay = baseDelay + Math.floor(Math.random() * 300);
        await this.sleep(actualDelay);
      }
    }
  }

  /**
   * Điều phối Fallback đa model liền mạch
   */
  async callWithFallback({ systemInstruction, prompt, inlineData = null, onStatusUpdate = () => {} }) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('CHƯA_CÓ_API_KEY: Hệ thống đang kết nối lại API Key...');
    }

    const currentSelected = this.getSelectedModel();
    const fallbackChain = this.getFallbackChain(currentSelected);
    let lastError = null;

    // Chuẩn bị payload Gemini API (hỗ trợ cả văn bản thuần và Multimodal Vision Image)
    const parts = [{ text: `${systemInstruction}\n\n${prompt}` }];
    if (inlineData) {
      parts.push({
        inlineData: {
          mimeType: inlineData.mimeType || 'image/jpeg',
          data: inlineData.data
        }
      });
    }

    const requestBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    };

    for (let i = 0; i < fallbackChain.length; i++) {
      const modelId = fallbackChain[i];
      try {
        if (i > 0) {
          onStatusUpdate({
            type: 'fallback',
            message: `Mô hình ${fallbackChain[i - 1]} gặp quá tải (429) hoặc tạm dừng. Đang tự động chuyển sang mô hình dự phòng: ${modelId}...`,
            model: modelId
          });
        }

        const result = await this._callGeminiAPIWithRetry(apiKey, modelId, requestBody, onStatusUpdate);
        return {
          data: result,
          usedModel: modelId,
          fallbackTriggered: i > 0
        };
      } catch (err) {
        lastError = err;
        console.warn(`Thất bại với model ${modelId}:`, err);
      }
    }

    const rawError = lastError ? (lastError.message || String(lastError)) : 'Lỗi kết nối không xác định';
    throw new Error(`Tất cả các mô hình AI dự phòng đều gặp sự cố hoặc quá hạn ngạch: ${rawError}`);
  }

  _extractJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerErr) { }
      }

      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = text.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(candidate);
        } catch (err) { }
      }

      throw new Error(`Không thể phân tích dữ liệu JSON trả về từ AI: ${text.substring(0, 300)}...`);
    }
  }

  /**
   * Chia nhỏ văn bản dài thành các Batch (5-7 dòng mỗi batch) để tránh 429 và quá tải token
   */
  chunkText(rawText, maxLinesPerChunk = 6) {
    if (!rawText) return [];
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= maxLinesPerChunk) {
      return [rawText];
    }

    const chunks = [];
    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      chunks.push(lines.slice(i, i + maxLinesPerChunk).join('\n'));
    }
    return chunks;
  }

  /**
   * Hệ thống Chỉ dẫn AI Chuẩn mực (System Instructions)
   */
  getSystemInstruction(inputDate, weekNum) {
    return `
Bạn là "Chuyên gia Điều phối Thi đua & Quản lý Nền nếp Học đường", bộ não trung tâm của Ban nền nếp Trường THPT Số 1 Lê Hồng Phong.
Nhiệm vụ: Phân tích mô tả vi phạm của Giám thị / Cờ đỏ / Ban nền nếp (qua văn bản hoặc ảnh sổ tay viết tay), trích xuất chính xác thông tin, chuẩn hóa theo quy chế của trường.

QUY TẮC BẮT BUỘC:
1. QUY ƯỚC KHỐI LỚP TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG:
   - Khối 10 dùng ký tự B: 10B01 đến 10B11 (10b1, 10b01, b1, 1001 => 10B01)
   - Khối 11 dùng ký tự A: 11A01 đến 11A09 (11a4, 11a04, a4, 1104 => 11A04)
   - Khối 12 dùng ký tự C: 12C01 đến 12C09 (12c8, 12c08, c8, 1208 => 12C08)

2. BẢO TOÀN VÀ BÓC TÁCH HỌ TÊN HỌC SINH:
   - Trích xuất sạch Họ và Tên học sinh. Tuyệt đối KHÔNG dính chữ "Lớp" hay "bạn" hay "học sinh" vào trong tên (ví dụ: "Phùng Ly Na", "Nguyễn Bo", "Lê Âu Kỳ").
   - Nếu học sinh chỉ ghi tên gọi và lớp (ví dụ: "Bo 11A04", "Kỳ 10B11", "Vy 10B01"), trích xuất tên gọi sạch sẽ để hệ thống phía sau đối chiếu.
   - NẾU TÊN HỌC SINH KHÔNG CÓ TRONG CSDL HOẶC CHỮ VIẾT TAY MỜ KHÔNG RÕ: Tuyệt đối KHÔNG dừng tiến trình. Hãy trích xuất tốt nhất có thể và gắn "matched_student": false.

3. CHUẨN HÓA LỖI VI PHẠM (ĐẶC BIỆT LỖI ÁO KHOÁC & ÁO ĐOÀN):
   - TẤT CẢ CÁC LỖI LIÊN QUAN ĐẾN: "áo khoác" (áo khoác sai màu, không mang áo khoác, mặc áo khoác ngoài...), "áo đoàn" (không mặc áo đoàn, quên áo đoàn, áo đoàn thứ 2...) BẮT BUỘC ĐƯỢC QUY VỀ DUY NHẤT MỘT DANH MỤC CHUẨN LÀ: "Sai đồng phục" với mức điểm phạt là 0.5 điểm.
   - Các lỗi khác áp theo Danh mục quy định (Bỏ tiết: 1.0, Đi học muộn: 0.5, Không bảng tên: 0.5, Đi dép lê: 0.5...).
   - Nếu lỗi không có trong danh mục, gán vào "Vi phạm khác" với điểm phạt 1.0.

4. XỬ LÝ TÁCH DÒNG THEO TỪNG NGÀY VI PHẠM (BẮT BUỘC):
   - Nếu một học sinh vi phạm ở nhiều ngày khác nhau (ví dụ: ngày 19/10 và ngày 22/10; hoặc thứ 2 ngày 19/10: đi muộn, thứ 5 ngày 22/10: không bảng tên):
   - BẮT BUỘC TÁCH THÀNH CÁC BẢN GHI ĐỘC LẬP TRONG MẢNG records, mỗi bản ghi ứng với một ngày cụ thể (định dạng YYYY-MM-DD), TUYỆT ĐỐI KHÔNG GỘP CHUNG VÀO MỘT DÒNG.

5. THỜI GIAN MẶC ĐỊNH:
   - Ngày mặc định: "${inputDate}"
   - Tuần học: ${weekNum} (Năm học 2026 - 2027, Tuần 1 bắt đầu từ 07/09/2026).

6. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON DUY NHẤT):
{
  "summary": "Tóm tắt ngắn gọn",
  "records": [
    {
      "student_id": "ID nếu có",
      "student_name": "Họ và tên đầy đủ sạch sẽ",
      "class_name": "Lớp chuẩn hóa (ví dụ: 12C08, 10B01, 11A04)",
      "matched_student": true,
      "violation_category": "Tên lỗi chuẩn hóa theo Danh mục (Áo khoác/áo đoàn -> Sai đồng phục)",
      "penalty_points": 0.5,
      "date": "YYYY-MM-DD",
      "week": ${weekNum},
      "original_text": "Mô tả nguyên văn hành vi vi phạm",
      "note": "Ghi chú nếu có"
    }
  ]
}
`.trim();
  }

  /**
   * Phân tích văn bản vi phạm (Hỗ trợ tự động Batching & Exponential Backoff)
   */
  async parseViolationInput({ rawText, inputDate, weekNum, activeRules, onProgress = () => {} }) {
    const rulesSummary = (activeRules || []).map(r => `- ${r.name}: ${r.points} điểm`).join('\n');
    const systemInstruction = this.getSystemInstruction(inputDate, weekNum);
    const chunks = this.chunkText(rawText, 7);

    let allRecords = [];
    let lastUsedModel = this.getSelectedModel();

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunkText = chunks[cIdx];
      if (chunks.length > 1) {
        onProgress({
          type: 'chunk_progress',
          message: `Đang xử lý phần ${cIdx + 1}/${chunks.length} (${Math.round(((cIdx + 1) / chunks.length) * 100)}%)...`,
          current: cIdx + 1,
          total: chunks.length
        });
      }

      const prompt = `
DANH MỤC LỖI VI PHẠM VÀ KHUNG ĐIỂM TRỪ CHÍNH THỨC CỦA TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG:
${rulesSummary}

VĂN BẢN MÔ TẢ VI PHẠM CẦN PHÂN TÍCH:
"""
${chunkText}
"""
`.trim();

      try {
        const response = await this.callWithFallback({
          systemInstruction,
          prompt,
          onStatusUpdate: onProgress
        });

        lastUsedModel = response.usedModel;
        const records = (response.data && response.data.records) ? response.data.records : [];
        allRecords = allRecords.concat(records);

        if (cIdx < chunks.length - 1) {
          await this.sleep(400); // Tránh rate limit liên tục
        }
      } catch (err) {
        console.error(`Lỗi khi xử lý chunk ${cIdx + 1}:`, err);
        if (chunks.length === 1) throw err;
        // Nếu là batch nhiều phần, thông báo lỗi phần này nhưng giữ lại các phần trước
        onProgress({
          type: 'chunk_error',
          message: `Cảnh báo: Phần ${cIdx + 1} gặp lỗi: ${err.message}`
        });
      }
    }

    // Tách dòng độc lập theo từng ngày vi phạm và chuẩn hóa quy chế
    const finalizedRecords = this.splitMultiDateRecords(allRecords, inputDate);

    return {
      data: {
        summary: `Đã bóc tách thành công ${finalizedRecords.length} vi phạm`,
        records: finalizedRecords
      },
      usedModel: lastUsedModel
    };
  }

  /**
   * BƯỚC 1 (CỤC BỘ / TRÍCH XUẤT THÔ):
   * Trích xuất văn bản thô từ ảnh chụp sổ tay ghi chép chữ viết tay
   * Trả về chuỗi văn bản sạch để người dùng xem lại và chỉnh sửa trực quan trên màn hình cảm ứng
   */
  async extractRawTextFromImage({ imageBase64, mimeType = 'image/jpeg', onProgress = () => {} }) {
    let cleanBase64 = imageBase64;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    const systemInstruction = `
Bạn là chuyên gia OCR bóc tách chữ viết tay từ ảnh chụp sổ tay theo dõi nề nếp / sổ trực cờ đỏ của Trường THPT Số 1 Lê Hồng Phong.
Nhiệm vụ BƯỚC 1: Đọc kỹ chữ viết tay và trích xuất danh sách các dòng văn bản thô ghi trong sổ để giáo viên xem lại và chỉnh sửa trực quan.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON):
{
  "raw_lines": [
    "Dòng 1: [Ngày nếu có] - [Họ tên] - [Lớp] - [Nội dung vi phạm]",
    "Dòng 2: [Ngày nếu có] - [Họ tên] - [Lớp] - [Nội dung vi phạm]"
  ],
  "full_text": "Văn bản thô đầy đủ, mỗi vi phạm trên một dòng độc lập"
}
`.trim();

    const prompt = 'Hãy đọc toàn bộ chữ viết tay trong ảnh sổ tay này và trích xuất thành danh sách các dòng văn bản thô:';

    onProgress({
      type: 'raw_ocr_start',
      message: 'Mô hình Vision AI đang bóc tách văn bản thô từ ảnh sổ tay...'
    });

    const response = await this.callWithFallback({
      systemInstruction,
      prompt,
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64
      },
      onStatusUpdate: onProgress
    });

    let fullText = '';
    if (response.data && response.data.full_text) {
      fullText = response.data.full_text.trim();
    } else if (response.data && Array.isArray(response.data.raw_lines)) {
      fullText = response.data.raw_lines.join('\n').trim();
    } else if (response.data && Array.isArray(response.data.records)) {
      fullText = response.data.records.map(r => `${r.date || ''} - ${r.student_name || ''} - ${r.class_name || ''} - ${r.original_text || r.violation_category || ''}`.trim()).join('\n');
    }

    return {
      rawText: fullText,
      usedModel: response.usedModel
    };
  }

  /**
   * Phân tích ảnh chụp sổ tay vi phạm bằng Vision AI (OCR Chữ viết tay)
   */
  async parseHandwrittenImage({ imageBase64, mimeType = 'image/jpeg', inputDate, weekNum, activeRules, onProgress = () => {} }) {
    const rulesSummary = (activeRules || []).map(r => `- ${r.name}: ${r.points} điểm`).join('\n');
    const systemInstruction = this.getSystemInstruction(inputDate, weekNum);

    // Chuẩn hóa dữ liệu base64
    let cleanBase64 = imageBase64;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    const prompt = `
BẠN ĐANG PHÂN TÍCH ẢNH CHỤP SỔ TAY GHI CHÉP CHỮ VIẾT TAY (Sổ trực cờ đỏ / Sổ theo dõi nề nếp thực tế) CỦA TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG.

HƯỚNG DẪN ĐỌC CHỮ VIẾT TAY CHUYÊN BIỆT:
1. Quan sát kỹ bảng biểu, cột Ngày, Họ và Tên, Lớp và Lỗi vi phạm ghi bằng bút mực/bút bi.
2. Trích xuất chính xác từng dòng vi phạm.
3. Nếu phát hiện một học sinh vi phạm ở nhiều ngày khác nhau trong sổ tay (ví dụ: ngày 19/10 và ngày 22/10), BẮT BUỘC TÁCH THÀNH 2 BẢN GHI RIÊNG BIỆT cho từng ngày trong mảng records.
4. TẤT CẢ các lỗi liên quan đến "áo khoác", "áo đoàn" BẮT BUỘC quy về lỗi chuẩn "Sai đồng phục" (-0.5đ).
5. Trả về kết quả theo định dạng JSON duy nhất quy định.

DANH MỤC LỖI CHUẨN CỦA TRƯỜNG:
${rulesSummary}
`.trim();

    onProgress({
      type: 'vision_ocr',
      message: 'Mô hình Vision AI đang bóc tách chữ viết tay từ ảnh chụp sổ tay...'
    });

    const response = await this.callWithFallback({
      systemInstruction,
      prompt,
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64
      },
      onStatusUpdate: onProgress
    });

    const records = (response.data && response.data.records) ? response.data.records : [];
    const finalizedRecords = this.splitMultiDateRecords(records, inputDate);

    return {
      data: {
        summary: `Vision AI đã bóc tách ${finalizedRecords.length} vi phạm từ ảnh chữ viết tay`,
        records: finalizedRecords
      },
      usedModel: response.usedModel
    };
  }
}

if (typeof window !== 'undefined') {
  window.geminiService = new GeminiService();
} else if (typeof global !== 'undefined') {
  global.geminiService = new GeminiService();
}
