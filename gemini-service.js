/**
 * Gemini Service - Bộ não AI Điều phối Nền nếp & Thi đua Học đường
 * Trường THPT Số 1 Lê Hồng Phong - Ban nền nếp
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
    badge: 'Mặc định (Tốc độ cao)',
    desc: 'Tốc độ phản hồi cực nhanh, tối ưu cho chuẩn hóa ngôn ngữ tự nhiên và phân tích vi phạm.',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300'
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    badge: 'Chính xác chuyên sâu',
    desc: 'Khả năng suy luận ngữ cảnh vượt trội, bóc tách chính xác các trường hợp viết tắt, tên phức tạp.',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-300'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Dự phòng ổn định',
    desc: 'Model dự phòng tốc độ cao, hoạt động bền bỉ khi các model mới gặp hạn mức quota.',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-300'
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
    this.selectedModel = localStorage.getItem('gemini_selected_model') || 'gemini-3-flash-preview';
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
    return localStorage.getItem('gemini_selected_model') || 'gemini-3-flash-preview';
  }

  setSelectedModel(modelId) {
    this.selectedModel = modelId;
    localStorage.setItem('gemini_selected_model', modelId);
  }

  getFallbackChain(startModelId) {
    const list = this.models.map(m => m.id);
    const startIdx = list.indexOf(startModelId);
    if (startIdx === -1) return list;
    return [startModelId, ...list.filter(id => id !== startModelId)];
  }

  async callWithFallback(systemInstruction, prompt, onStatusUpdate = () => {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('CHƯA_CÓ_API_KEY: Hệ thống đang kết nối lại API Key...');
    }

    const currentSelected = this.getSelectedModel();
    const fallbackChain = this.getFallbackChain(currentSelected);
    let lastError = null;

    for (let i = 0; i < fallbackChain.length; i++) {
      const modelId = fallbackChain[i];
      try {
        if (i > 0) {
          onStatusUpdate({
            type: 'fallback',
            message: `Model ${fallbackChain[i - 1]} gặp sự cố. Đang tự động chuyển sang model dự phòng: ${modelId}...`,
            model: modelId
          });
        }

        const result = await this._callGeminiAPI(apiKey, modelId, systemInstruction, prompt);
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
    throw new Error(`Tất cả các model AI đều không phản hồi: ${rawError}`);
  }

  async _callGeminiAPI(apiKey, modelId, systemInstruction, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\n--- DỮ LIỆU ĐẦU VÀO CẦN XỬ LÝ ---\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
      throw new Error(`HTTP ${response.status}: ${errorDetail || response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      throw new Error('Dữ liệu phản hồi từ Gemini API rỗng hoặc không đúng định dạng.');
    }

    const rawText = candidate.content.parts[0].text;
    return this._extractJSON(rawText);
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
   * Xây dựng Prompt và kích hoạt Chuẩn hóa Vi phạm Nền nếp
   */
  async parseViolationInput({ rawText, inputDate, weekNum, activeRules, activeStudents, onProgress }) {
    const systemInstruction = `
Bạn là "Chuyên gia Điều phối Thi đua & Quản lý Nền nếp Học đường", bộ não trung tâm của Ban nền nếp Trường THPT Số 1 Lê Hồng Phong.
Nhiệm vụ: Phân tích mô tả vi phạm tự do của Giám thị / Cờ đỏ / Ban nền nếp, trích xuất chính xác học sinh, đối chiếu Danh mục quy chế và quy đổi ra điểm trừ chuẩn mực.

QUY TẮC BẮT BUỘC VỀ NHẬN DIỆN LỚP & HỌC SINH:
1. QUY ƯỚC KHỐI LỚP TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG:
   - Khối 10 dùng ký tự B: 10B01 đến 10B11
   - Khối 11 dùng ký tự A: 11A01 đến 11A09
   - Khối 12 dùng ký tự C: 12C01 đến 12C09

2. HỖ TRỢ BIẾN THỂ VIẾT TẮT TÊN LỚP PHONG PHÚ:
   - 12c8, 12c08, c8, c08, 1208 => Lớp chuẩn là 12C08
   - 11a4, 11a04, a4, a04, 1104 => Lớp chuẩn là 11A04
   - 10b1, 10b01, b1, b01, 1001 => Lớp chuẩn là 10B01
   - 10b11, b11, 1011 => Lớp chuẩn là 10B11

3. NHẬN DIỆN HỌC SINH LINH HOẠT VỚI TÊN GỌI (TÊN RIÊNG):
   - Người dùng có thể chỉ viết tên gọi và lớp (ví dụ: "An 12c8", "Vy 10b1", "Bảo An 10b1", "Kỳ 10b11").
   - Hãy tra cứu trong Danh sách học sinh của lớp tương ứng, tìm học sinh có tên đó và lấy Họ và Tên đầy đủ (ví dụ: "Huỳnh Lê Bảo An" thuộc lớp 12C08).
   - TUYỆT ĐỐI KHÔNG để dính hoặc thừa chữ " - Lớp" hay "Lớp" vào trong họ tên học sinh. Trường student_name chỉ chứa duy nhất Họ và Tên sạch sẽ (ví dụ: "Phùng Ly Na", "Nguyễn Bo").

4. CHUẨN HÓA LỖI VI PHẠM & ĐIỂM TRỪ:
   - Phân tích hành vi mô tả (ví dụ: "đi trễ 10p", "quên huy hiệu", "không sơ vin", "bỏ tiết") và khớp với LỖI CHUẨN trong Danh mục quy định.
   - Áp đúng mức điểm phạt quy định trong danh mục.
   - Nếu lỗi không có trong danh mục, gán vào "Vi phạm khác" với điểm phạt 1.0 và ghi chú thích rõ ràng.

5. THỜI GIAN:
   - Ngày vi phạm: "${inputDate}"
   - Tuần học: ${weekNum} (Năm học 2026 - 2027, Tuần 1 bắt đầu từ 07/09/2026).

6. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON):
Trả về DUY NHẤT một đối tượng JSON:
{
  "summary": "Tóm tắt ngắn gọn",
  "records": [
    {
      "student_id": "ID học sinh (nếu tìm thấy)",
      "student_name": "Họ và tên đầy đủ (TUYỆT ĐỐI KHÔNG chứa chữ Lớp)",
      "class_name": "Lớp chuẩn hóa (ví dụ: 12C08, 10B01, 11A04)",
      "matched_student": true,
      "violation_category": "Tên lỗi chuẩn hóa theo Danh mục",
      "penalty_points": 0.5,
      "date": "${inputDate}",
      "week": ${weekNum},
      "original_text": "Mô tả gốc của lỗi",
      "note": "Ghi chú nếu có"
    }
  ]
}
`.trim();

    const rulesSummary = activeRules.map(r => `- ${r.name}: ${r.points} điểm`).join('\n');

    const prompt = `
DANH MỤC LỖI VI PHẠM VÀ KHUNG ĐIỂM TRỪ CHÍNH THỨC CỦA TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG:
${rulesSummary}

DANH SÁCH HỌC SINH TOÀN TRƯỜNG THPT SỐ 1 LÊ HỒNG PHONG (Họ tên, Lớp):
${activeStudents.map(s => `${s.name} (${s.class})`).join(', ')}

VĂN BẢN MÔ TẢ VI PHẠM CẦN PHÂN TÍCH:
"""
${rawText}
"""
`.trim();

    return await this.callWithFallback(systemInstruction, prompt, onProgress);
  }
}

window.geminiService = new GeminiService();
