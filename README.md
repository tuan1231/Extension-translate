# 🌐 Polyglot AI Translator

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge&logo=googlechrome" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Engine-Gemini%20Flash%20%7C%20OpenRouter%20%7C%20Google-purple?style=for-the-badge&logo=openai" alt="Engines" />
  <img src="https://img.shields.io/badge/YouTube-Dual%20Subtitles%20%26%20Dictation-red?style=for-the-badge&logo=youtube" alt="YouTube Mode" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

**Polyglot AI Translator** là tiện ích mở rộng (Chrome Extension Manifest V3) thông minh, đa năng và hiện đại dành cho trình duyệt Chrome, Edge, Brave, Cốc Cốc... Tiện ích kết hợp sức mạnh của **Google Gemini AI**, **OpenRouter AI** và **Google Translate**, mang đến trải nghiệm dịch thuật mượt mà, hỗ trợ phụ đề song ngữ YouTube tức thì và bộ công cụ luyện nghe chép chính tả (Dictation) chuẩn TOEIC/IELTS.

---

## ✨ Tính Năng Nổi Bật

### 1. 🤖 Bộ 3 Engine Dịch Thuật Đa Tầng (Multi-Engine & Auto-Failover)
* **Google Translate (Tốc độ cao - Không cần Key)**:
  * Cơ chế xoay vòng endpoint (`translate.google.com`, `googleapis.com`, `clients5.google.com`) và bộ đệm (In-Memory Cache) chống lỗi quá tải/429.
  * Tự động phát hiện đảo chiều ngôn ngữ (Việt ⇄ Anh và hơn 100+ ngôn ngữ).
* **AI Gemini Flash (Mới nhất từ Google AI Studio)**:
  * Tự động truy vấn danh sách model động mới nhất từ Google API (`ModelService.ListModels`), tự bắt các bản Flash mới nhất (2.5, 3.0, 3.8...) tối ưu cho Free Tier mà không cần fix cứng phiên bản.
  * Bản dịch chuẩn ngữ cảnh, tự nhiên, văn phong bản xứ.
* **OpenRouter AI (Hệ sinh thái Model Miễn phí)**:
  * Hỗ trợ meta-router thông minh `openrouter/free` tự động điều phối sang model AI free có độ trễ thấp nhất.
  * Tự động nạp danh sách các model Miễn phí (`:free`) như Llama, DeepSeek, Mistral, Qwen, MiniMax...
* **Cơ chế phục hồi 3 tầng (3-Tier Failover)**:
  * Tự động chuyển đổi `OpenRouter ⇄ Gemini ⇄ Google Translate` nếu một engine gặp sự cố mạng hoặc hết hạn mức, đảm bảo trải nghiệm dịch không bao giờ bị đứt quãng.

---

### 2. 🎥 YouTube Song Ngữ & Luyện Nghe TOEIC / IELTS (Supercharged)
* **Phụ đề song ngữ (Bilingual Subtitles)**:
  * Hiển thị phụ đề gốc và phụ đề dịch song song ngay trên video với độ chính xác theo từng mili-giây.
  * Khớp timestamp thông minh: Tận dụng trực tiếp bản dịch native của YouTube giúp phụ đề song ngữ hiển thị ngay lập tức (0.01s), không tốn quota API.
* **Bảng Transcript tương tác**:
  * Hiển thị toàn bộ lời thoại video theo dòng thời gian.
  * Nhấp chuột vào bất kỳ câu nào để tua video đến chính xác thời điểm đó.
  * Tự động cuộn theo tiến trình phát của video.
* **Bộ luyện nghe TOEIC / IELTS chuyên sâu**:
  * 🎧 **Dictation (Nghe - Chép chính tả)**: Tự động ngắt từng câu, cho phép nghe lặp lại và gõ lại câu nghe được, hệ thống tự chấm % độ chính xác và tô màu phát hiện từ sai/thiếu.
  * ✍️ **Điền từ vào chỗ trống (Fill-in-the-blank)**: Ẩn các từ khóa quan trọng để người học tự đoán từ, hỗ trợ phím tắt và gợi ý chữ cái đầu.
* **Nhận diện giọng nói trực tiếp (Live AI Speech-to-Text)**:
  * Hỗ trợ nhận diện lời thoại trực tiếp từ âm thanh video bằng Gemini Multimodal Audio hoặc Web Speech API ngay cả khi video không có phụ đề sẵn.

---

### 3. ⚡ Dịch Bôi Đen Trên Mọi Trang Web
* **Biểu tượng nổi (Floating Icon)**: Xuất hiện tinh tế ngay cạnh đoạn văn bản vừa bôi đen, nhấp vào là mở hộp thoại dịch tức thì.
* **Cô lập giao diện bằng Shadow DOM**:
  * Toàn bộ popup dịch bôi đen nằm trong Shadow DOM độc lập, đảm bảo **100% không bị vỡ giao diện** hay xung đột CSS với bất kỳ trang web nào.
* **Menu chuột phải (Context Menu)**: Nhấp chuột phải vào văn bản bất kỳ ➔ chọn *"Dịch với Polyglot"*.
* **Phát âm chất lượng cao (Google TTS & Chrome TTS)**:
  * Ứng dụng công nghệ **Chrome Offscreen Document API** để phát âm giọng đọc Google tự nhiên, truyền cảm.
  * Tự động fallback sang giọng đọc offline/hệ thống mượt mà khi mất mạng.

---

### 4. 📚 Sổ Tay Từ Vựng & Flashcards Ôn Tập
* **Lưu từ vựng 1-click**: Bấm biểu tượng Bookmark ở bất kỳ câu dịch nào (trên Popup, web hoặc YouTube) để lưu vào sổ tay.
* **Ôn tập Flashcards**: Giao diện thẻ ghi nhớ thông minh trong Popup giúp ôn lại từ vựng đã học kèm ngôn ngữ, ngữ nghĩa và nút xóa tiện lợi.

---

## 📁 Cấu Trúc Mã Nguồn

```text
Extension-translate/
├── manifest.json               # Cấu hình Chrome Extension (Manifest V3)
├── background/
│   └── service-worker.js       # Background Service Worker (Quản lý Batch, TTS, Context Menu)
├── content/
│   ├── content.js              # Xử lý bôi đen dịch trên mọi trang web (Shadow DOM)
│   ├── content.css             # Định kiểu cho bong bóng & hộp thoại dịch trên trang
│   ├── youtube.js              # Script phụ đề song ngữ, bảng transcript, luyện nghe
│   ├── youtube.css             # Giao diện phụ đề & bảng luyện nghe YouTube
│   └── youtube-main.js         # Injector chạy trong MAIN world để hook YouTube Player API
├── offscreen/
│   ├── offscreen.html          # Tài liệu Offscreen chạy ngầm phát âm thanh
│   └── offscreen.js            # Trình phát âm thanh Google TTS chất lượng cao
├── popup/
│   ├── popup.html              # Giao diện chính của Extension (3 tab: Dịch, Ôn tập, Cài đặt)
│   ├── popup.css               # Phong cách giao diện Dark Theme hiện đại, Glassmorphism
│   └── popup.js                # Xử lý tương tác, chuyển tab, lưu cấu hình, test API
└── shared/
    ├── languages.js            # Danh mục 100+ ngôn ngữ được hỗ trợ
    ├── storage.js              # Lớp giao tiếp chrome.storage.local (Settings, History)
    └── translator.js           # Bộ lõi dịch thuật: Google, Gemini Flash, OpenRouter
```

---

## 🛠️ Hướng Dẫn Cài Đặt (Developer Mode)

Không cần cài đặt `npm` hay công cụ build phức tạp, tiện ích được viết bằng mã nguồn Vanilla JavaScript thuần túy:

1. **Tải mã nguồn**:
   * Tải file ZIP của dự án và giải nén, hoặc clone bằng git:
   ```bash
   git clone https://github.com/tuan1231/Extension-translate.git
   ```

2. **Cài đặt vào trình duyệt**:
   * Mở trình duyệt Chrome / Edge / Brave / Cốc Cốc.
   * Truy cập vào đường dẫn: `chrome://extensions/`
   * Bật công tắc **Chế độ dành cho nhà phát triển** (Developer mode) ở góc trên bên phải.
   * Nhấn nút **Tải tiện ích đã giải nén** (Load unpacked).
   * Chọn thư mục `Extension-translate` vừa giải nén.

3. **Ghim tiện ích**:
   * Nhấp vào biểu tượng mảnh ghép (Extensions) trên thanh công cụ của Chrome và bấm **Ghim (Pin)** Polyglot AI Translator để sử dụng nhanh.

---

## ⚙️ Hướng Dẫn Cấu Hình API Key (Tuỳ Chọn)

Mặc định extension sử dụng **Google Translate** hoàn toàn miễn phí và không cần cấu hình key. Nếu bạn muốn sử dụng các mô hình AI tiên tiến:

### 1. Dùng Google Gemini Flash (Khuyên dùng)
1. Truy cập [Google AI Studio](https://aistudio.google.com/) và tạo một API Key miễn phí.
2. Mở Popup extension ➔ Chuyển sang tab **Cài đặt** (biểu tượng bánh răng).
3. Chọn engine **AI Gemini Flash (Mới nhất)**.
4. Dán API Key vào ô và nhấn nút **Kiểm tra** (hệ thống sẽ kiểm tra và hiển thị model Flash mới nhất).
5. Nhấn **Lưu Cài đặt**.

### 2. Dùng OpenRouter AI
1. Đăng ký tài khoản và tạo key tại [openrouter.ai/keys](https://openrouter.ai/keys).
2. Vào tab **Cài đặt** ➔ Chọn **OpenRouter AI (Miễn phí)**.
3. Dán key vào ô và bấm **Kiểm tra**.
4. Menu sẽ tự động tải danh sách các model `:free` (Mặc định chọn `openrouter/free` để tự động dùng model free tối ưu nhất).
5. Nhấn **Lưu Cài đặt**.

---

## 🎯 Phím Tắt Tiện Lợi

| Phím tắt | Vị trí | Tác dụng |
| :--- | :--- | :--- |
| `Ctrl + Enter` | Popup Dịch | Dịch ngay văn bản đang nhập |
| `Bôi đen văn bản` | Mọi trang web | Hiện icon nổi để dịch tức thì |
| `Click câu transcript` | YouTube | Tua video đến đúng mốc thời gian của câu |

---

## 🔒 Quyền Hạn & Quyền Riêng Tư (Permissions)

Tiện ích chỉ yêu cầu các quyền hạn cần thiết tối thiểu theo chuẩn Manifest V3:
* `storage`: Lưu cài đặt cá nhân và danh sách từ vựng ôn tập trên máy của bạn.
* `activeTab`, `scripting`: Hỗ trợ dịch và hiển thị giao diện bôi đen trên trang web đang xem.
* `contextMenus`: Thêm lựa chọn dịch nhanh vào menu chuột phải.
* `offscreen`: Dành riêng cho việc phát âm thanh TTS tự nhiên mà không gây ảnh hưởng đến trang web.
* `tts`: Dự phòng phát âm qua giọng đọc hệ điều hành khi ngoại tuyến.
* **Quyền riêng tư**: Tiện ích **không** thu thập bất kỳ dữ liệu cá nhân hay lịch sử duyệt web nào của người dùng. Mọi API Key và từ vựng đều được lưu trữ trực tiếp trong `chrome.storage.local` trên máy tính cá nhân.

---

## 📄 Bản Quyền (License)

Dự án được phát hành theo giấy phép mã nguồn mở [MIT License](LICENSE).
Mọi đóng góp, báo lỗi (issue) và ý tưởng cải tiến (pull request) đều được hoan nghênh!
