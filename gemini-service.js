/**
 * Gemini Service - Bộ não AI Điều phối Nề nếp & Thi đua Học đường
 * Tuân thủ quy tắc trong AI_INSTRUCTIONS.md:
 * - Model mặc định: gemini-3-flash-preview
 * - Danh sách fallback: gemini-3-flash-preview -> gemini-3-pro-preview -> gemini-2.5-flash
 * - Tự động retry với model tiếp theo khi gặp lỗi (429, 503,...)
 * - Quản lý trạng thái lỗi nguyên văn, không báo hoàn tất giả
 */

const GEMINI_MODELS = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    badge: 'Mặc định (Khuyên dùng)',
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
    this.apiKey = localStorage.getItem('gemini_api_key') || '';
    this.selectedModel = localStorage.getItem('gemini_selected_model') || 'gemini-3-flash-preview';
    this.models = GEMINI_MODELS;
  }

  getApiKey() {
    return localStorage.getItem('gemini_api_key') || '';
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    localStorage.setItem('gemini_api_key', this.apiKey);
  }

  getSelectedModel() {
    return localStorage.getItem('gemini_selected_model') || 'gemini-3-flash-preview';
  }

  setSelectedModel(modelId) {
    this.selectedModel = modelId;
    localStorage.setItem('gemini_selected_model', modelId);
  }

  // Lấy danh sách fallback bắt đầu từ model đang chọn
  getFallbackChain(startModelId) {
    const list = this.models.map(m => m.id);
    const startIdx = list.indexOf(startModelId);
    if (startIdx === -1) return list;
    // Xếp model đang chọn lên đầu, sau đó đến các model khác
    return [startModelId, ...list.filter(id => id !== startModelId)];
  }

  /**
   * Gọi API Gemini với cơ chế Fallback tự động
   */
  async callWithFallback(systemInstruction, prompt, onStatusUpdate = () => {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('CHƯA_CÓ_API_KEY: Vui lòng nhập Google Gemini API Key để kích hoạt chức năng AI.');
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
        // Tiếp tục thử model tiếp theo trong chuỗi fallback
      }
    }

    // Nếu tất cả các model đều thất bại
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
      // Thử parse trực tiếp nếu là JSON thuần
      return JSON.parse(text);
    } catch (e) {
      // Trích xuất JSON từ markdown code block ```json ... ``` hoặc giữa { ... } hoặc [ ... ]
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerErr) {
          // fallback bên dưới
        }
      }

      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = text.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(candidate);
        } catch (err) {
          // fallback
        }
      }

      throw new Error(`Không thể phân tích dữ liệu JSON trả về từ AI: ${text.substring(0, 300)}...`);
    }
  }

  /**
   * Xây dựng Prompt và kích hoạt Chuẩn hóa Vi phạm Nề nếp
   */
  async parseViolationInput({ rawText, inputDate, weekNum, activeRules, activeStudents, onProgress }) {
    // Định nghĩa System Instruction chuẩn mực sư phạm
    const systemInstruction = `
Bạn là "Chuyên gia Điều phối Thi đua & Quản lý Nề nếp Học đường", bộ não trung tâm của Ban Giám thị trường THPT Lê Hồng Phong.
Nhiệm vụ: Phân tích mô tả vi phạm tự do của Giám thị/Cờ đỏ, trích xuất chính xác học sinh, đối chiếu Danh mục quy chế và quy đổi ra điểm trừ chuẩn mực.

QUY TẮC BẮT BUỘC:
1. KHỚP HỌ TÊN VÀ LỚP:
   - Tra cứu trong Danh sách học sinh cung cấp bên dưới.
   - Luôn đảm bảo đúng cặp [Họ tên - Lớp]. Nếu học sinh chỉ có tên kèm lớp (ví dụ: "Bảo An 10B01"), hãy tìm tên đầy đủ trong danh sách lớp đó (ví dụ: "Mã Ngọc Bảo An - 10B01").
   - Nếu không tìm thấy chính xác, vẫn giữ họ tên và lớp người dùng nhập, đặt matched_student = false.

2. CHUẨN HÓA LỖI VI PHẠM & ĐIỂM TRỪ:
   - Phân tích hành vi mô tả (ví dụ: "đi trễ 10p", "không sơ vin", "quên huy hiệu") và khớp với LỖI CHUẨN trong Danh mục quy chế.
   - Áp đúng mức điểm phạt quy định trong danh mục.
   - Nếu một học sinh vi phạm nhiều lỗi (ví dụ: "đi học muộn, không bảng tên"), hãy tách thành từng lỗi hoặc gộp theo danh mục kết hợp phù hợp.
   - Nếu lỗi không có trong danh mục, gán vào "Vi phạm khác" với điểm phạt 1.0 (hoặc mức hợp lý) và ghi rõ chú thích.

3. THỜI GIAN:
   - Ngày vi phạm: "${inputDate}"
   - Tuần học: ${weekNum} (Năm học 2026 - 2027, Tuần 1 bắt đầu từ 07/09/2026).

4. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON):
Trả về DUY NHẤT một đối tượng JSON có cấu trúc sau:
{
  "summary": "Tóm tắt ngắn gọn số học sinh và số lỗi bóc tách được",
  "records": [
    {
      "student_id": "ID học sinh trong danh sách (nếu tìm thấy) hoặc chuỗi rỗng",
      "student_name": "Họ và tên đầy đủ của học sinh",
      "class_name": "Lớp (ví dụ: 10B01)",
      "matched_student": true,
      "violation_category": "Tên lỗi chuẩn hóa chính xác theo Danh mục",
      "penalty_points": 0.5,
      "date": "${inputDate}",
      "week": ${weekNum},
      "original_text": "Mô tả gốc của lỗi",
      "confidence": "high|medium|low",
      "note": "Ghi chú nếu có điều gì cần giám thị lưu ý"
    }
  ]
}
`.trim();

    // Rút gọn danh mục quy chế gửi kèm
    const rulesSummary = activeRules.map(r => `- ${r.name}: ${r.points} điểm`).join('\n');

    // Tạo danh sách học sinh mẫu theo lớp hoặc toàn bộ nếu vừa đủ
    // Đối với 1226 học sinh, ta lọc các lớp xuất hiện trong văn bản hoặc gửi danh sách rút gọn
    const prompt = `
DANH MỤC LỖI VI PHẠM VÀ KHUNG ĐIỂM TRỪ CHÍNH THỨC CỦA TRƯỜNG:
${rulesSummary}

DANH SÁCH HỌC SINH TOÀN TRƯỜNG THPT LÊ HỒNG PHONG (Họ tên, Lớp):
${activeStudents.map(s => `${s.name} (${s.class})`).join(', ')}

VĂN BẢN MÔ TẢ VI PHẠM CỦA GIÁM THỊ / CỜ ĐỎ CẦN PHÂN TÍCH:
"""
${rawText}
"""
`.trim();

    return await this.callWithFallback(systemInstruction, prompt, onProgress);
  }
}

// Khởi tạo global instance
window.geminiService = new GeminiService();
