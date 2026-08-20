# Larry AI

Larry là chatbot đồng hành cảm xúc dành cho học sinh tiểu học và THCS.

Webcam nhận diện cảm xúc của học sinh ngay khi mở app (vui, buồn, tức giận, lo lắng...), sau đó Larry chủ động mở lời bằng tiếng Việt, lắng nghe và trò chuyện. Khi cuộc trò chuyện phù hợp, Larry gợi ý chơi một game Scratch nhỏ để thư giãn.

- **Frontend**: React 19 (Create React App) + `face-api.js` để nhận diện cảm xúc ngay trên trình duyệt.
- **Nói và nghe**: học sinh bấm micro để nói thay vì gõ, và Larry đọc câu trả lời lên loa — hai model riêng khai trong `.env`, xem **[mục 12](#12-nói-chuyện-bằng-giọng-nói-micro--loa)**.
- **Trang giới thiệu công khai** tại `/gioi-thieu`, không cần đăng nhập — kèm **đồ thị bấm được** của toàn bộ kho tri thức Larry truy vấn ([mục 11](#11-trang-giới-thiệu-công-khai)).
- **Backend**: Express 5 + JWT auth, gọi model AI qua **OpenRouter**.
- **Hệ multi-agent**: một Supervisor phân nhóm trường hợp rồi giao cho **đúng 1** trong 4 agent chuyên trách (nhóm ưu tiên cao nhất thắng), chạy trên **LangGraph.js**. Kiến trúc và luồng chi tiết: **[LARRY.md](LARRY.md)**.
- **Khi AI lỗi**: nếu không có API key hoặc không gọi được OpenRouter, app **không tự bịa câu trả lời** mà báo rõ hệ thống đang không hoạt động ([backend/fallback.js](backend/fallback.js)).

---

## 1. Yêu cầu

| Thành phần | Phiên bản |
|---|---|
| Node.js | **18 trở lên** (backend dùng `fetch` có sẵn của Node) |
| npm | 9 trở lên |
| Trình duyệt | Chrome/Edge/Firefox có webcam (thêm micro + loa nếu dùng giọng nói) |

Một tài khoản [OpenRouter](https://openrouter.ai) để lấy API key.

> Trình duyệt chỉ cho phép truy cập webcam **và micro** trên `localhost` hoặc HTTPS. Chạy local qua `http://localhost:3000` là được.

---

## 2. Cấu trúc thư mục

```
Larry-AI/
├── backend/              # API Express
│   ├── server.js         # Auth (register/login/me) + khu vực quản trị + documents
│   ├── auth.js           # JWT + middleware phân quyền
│   ├── routes/chat.js    # /chat/stream (SSE), /chat, /api/session/end
│   ├── routes/voice.js   # /api/voice/stt, /api/voice/tts, /api/voice/config
│   ├── voice.js          # Gọi model nghe/nói của OpenRouter + bọc PCM thành WAV
│   ├── teachers.js       # Ghép giáo viên chủ nhiệm ↔ học sinh theo trường + lớp
│   ├── agents/           # Hệ multi-agent LangGraph — xem LARRY.md
│   │   ├── graph.js      #   Dựng graph: supervisor + 4 agent chuyên trách
│   │   ├── supervisor.js #   Phân nhóm, quyết định gọi agent nào
│   │   ├── routing.js    #   Sàn an toàn + chọn đúng 1 agent mỗi lượt
│   │   ├── runner.js     #   Chạy một lượt, phát sự kiện cho giao diện
│   │   ├── prompts/      #   System prompt của từng agent
│   │   └── dev-run.js    #   Chạy 10 kịch bản kiểm thử từ dòng lệnh
│   ├── sessionStore.js   # Vùng nhớ phiên + tóm tắt + gắn cờ cho giáo viên
│   ├── accounts.js       # Đọc/ghi tài khoản xuống account.json
│   ├── account.json      # Danh sách tài khoản (KHÔNG commit)
│   ├── sessions.js       # Vùng nhớ phiên hội thoại cho quản trị viên
│   ├── sessions.json     # Tóm tắt các phiên (KHÔNG commit)
│   ├── summarizer.js     # Model riêng tóm tắt + gắn cờ dấu hiệu tiêu cực
│   ├── risk.js           # Thang mức độ + chấm phiếu cảm xúc bằng luật
│   ├── alertEmail.js     # AI soạn email cảnh báo GVCN + gửi qua SMTP
│   ├── fallback.js       # Câu trả lời dự phòng khi không gọi được AI
│   ├── documents/        # Điều khoản & Chính sách bảo mật (.txt, sửa trực tiếp)
│   ├── .env              # API key thật (KHÔNG commit)
│   └── .env.example      # Mẫu biến môi trường
├── frontend/             # React app
│   ├── public/models/    # Model face-api.js (chỉ chạy khi vào giao diện chat)
│   └── src/
│       ├── components/ui/  # Camera, ChatBox, AgentTrace, Login, AdminPage...
│       ├── hooks/          # useAgentStream (SSE), useVoiceInput (micro), useSpeaker (loa)
│       ├── utils/audio.js  # Đổi đoạn thu của trình duyệt sang WAV 16kHz mono
│       ├── utils/speechChunks.js # Cắt câu trả lời thành đoạn để đọc sớm
│       ├── utils/forceLayout.js  # Bố cục đồ thị bằng mô phỏng lực (tự viết)
│       ├── utils/voicePref.js    # Nhớ lựa chọn tắt/bật giọng nói của Larry
│       ├── utils/xlsx.js         # Dựng file .xlsx cho nút tải bảng (tự viết)
│       ├── utils/days.js         # Ngày/giờ Việt Nam cho các biểu đồ thống kê
│       ├── utils/search.js       # Tìm kiếm tiếng Việt — gõ không dấu vẫn ra
│       ├── config/api.js   # Địa chỉ backend dùng chung
│       ├── context/        # AuthContext (JWT)
│       └── styles/
└── netlify.toml          # Cấu hình deploy frontend lên Netlify
```

---

## 3. Cài đặt

```bash
# Backend
cd backend
npm install

# Frontend (mở terminal khác hoặc quay lại thư mục gốc)
cd ../frontend
npm install
```

---

## 4. Cấu hình biến môi trường

### 4.1. Backend — `backend/.env`

```bash
cd backend
cp .env.example .env
```

Mở `backend/.env` và điền:

```env
OPENROUTER_API_KEY=sk-or-v1-...            # Lấy tại https://openrouter.ai/keys

# Model nền — thành phần nào không khai riêng thì dùng cái này
CHAT_MODEL=google/gemini-2.5-flash-lite

# Từng agent trong hệ multi-agent, đổi riêng được
SUPERVISOR_MODEL=google/gemini-2.5-flash-lite
AGENT_SELF_HARM_MODEL=google/gemini-2.5-flash-lite
AGENT_VICTIM_MODEL=google/gemini-2.5-flash-lite
AGENT_ACTOR_MODEL=google/gemini-2.5-flash-lite
AGENT_HOMEROOM_MODEL=google/gemini-2.5-flash-lite

SUMMARY_MODEL=google/gemini-2.5-flash
ALERT_MODEL=google/gemini-2.5-flash

# Giọng nói (tuỳ chọn) — bỏ trống thì app chỉ gõ chữ như trước.
# Khai xong loa vẫn TẮT sẵn ở phía học sinh; em nào muốn nghe thì tự bấm nút loa.
STT_MODEL=nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b
TTS_MODEL=google/gemini-3.1-flash-tts-preview

# Hạn mức lượt hỏi mỗi tài khoản (mặc định 20 lượt / 10 phút — xem mục 10).
# Lượt Larry chào đếm bằng túi riêng, không ăn vào 20 lượt này.
# CHAT_RATE_LIMIT_MAX=20
# CHAT_RATE_LIMIT_WINDOW_MINUTES=10
# CHAT_RATE_LIMIT_GREETING_MAX=6

PORT=5000
JWT_SECRET=doi-thanh-chuoi-ngau-nhien-cua-ban
```

> Tên model **chỉ nằm trong `.env`** — mã nguồn không ghi cứng tên model nào
> ([backend/models.js](backend/models.js) là nơi duy nhất đọc chúng). Thành phần
> nào không giải ra được model thì `/chat` báo lỗi hệ thống chứ không tự chọn model
> thay bạn. Khai riêng đủ cho từng agent thì bỏ trống `CHAT_MODEL` cũng được.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | – | API key OpenRouter. Thiếu key thì `/chat` báo hệ thống AI không hoạt động. |
| `SUPPORT_EMAIL` | – | `lanmc2k13@gmail.com` | Email hiển thị trong thông báo lỗi hệ thống. |
| `CHAT_MODEL` | ✅¹ | – | Model nền. Thành phần nào không khai riêng thì dùng cái này. ¹Bỏ trống được nếu **mọi** biến bên dưới đều đã khai. |
| `SUPERVISOR_MODEL` | – | `CHAT_MODEL` | Model của 🧭 Larry Điều phối — đánh giá và phân nhóm. Nên nâng cấp trước tiên. |
| `AGENT_SELF_HARM_MODEL` | – | `CHAT_MODEL` | Model của 🛟 Larry Đồng hành (ca tự hại). |
| `AGENT_VICTIM_MODEL` | – | `CHAT_MODEL` | Model của 🛡️ Larry Bảo vệ (nạn nhân bạo lực học đường). |
| `AGENT_ACTOR_MODEL` | – | `CHAT_MODEL` | Model của 🧩 Larry Thấu hiểu (người gây bạo lực). |
| `AGENT_HOMEROOM_MODEL` | – | `CHAT_MODEL` | Model của 🍎 Cô giáo Larry (trò chuyện thường ngày). |
| `SUMMARY_MODEL` | – | `CHAT_MODEL` | Model tóm tắt hội thoại + chấm mức độ nguy cơ cho quản trị viên. |
| `ALERT_MODEL` | – | `SUMMARY_MODEL` | Model soạn email cảnh báo giáo viên chủ nhiệm. |
| `STT_MODEL` | – | – | Model nghe tiếng nói của học sinh → chữ. Bỏ trống thì **nút micro không hiện** (xem mục 12). |
| `TTS_MODEL` | – | – | Model đọc câu trả lời của Larry thành tiếng. Bỏ trống thì Larry chỉ hiện chữ. |
| `TTS_VOICE` | – | `Kore` | Giọng đọc của Larry. Mỗi model TTS có bộ giọng riêng. |
| `STT_LANGUAGE` | – | `vi` | Ngôn ngữ gợi ý cho model nghe. Để trống thì model tự đoán. |
| `VOICE_TIMEOUT_MS` | – | `45000` | Hạn giờ mỗi lần gọi model giọng nói. |
| `CHAT_RATE_LIMIT_MAX` | – | `20` | Số lượt chat tối đa của **một tài khoản** trong một cửa sổ. Đặt `0` để tắt hẳn (xem mục 10). |
| `CHAT_RATE_LIMIT_WINDOW_MINUTES` | – | `10` | Độ dài cửa sổ tính hạn mức, tính bằng phút. |
| `CHAT_RATE_LIMIT_GREETING_MAX` | – | `6` | Trần riêng cho **lượt Larry chào** (mở khung chat, học sinh chưa gõ gì). Đếm tách khỏi `CHAT_RATE_LIMIT_MAX`. |
| `OPENROUTER_MODEL` | – | – | Tên **cũ** của `CHAT_MODEL`, chỉ dùng khi `CHAT_MODEL` không có. |
| `PORT` | – | `5000` | Cổng backend. Trên Render/Railway thì **đừng đặt** — nền tảng tự tiêm. |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | – | Tự tạo quản trị viên lúc khởi động, dùng khi nơi deploy không mở được terminal. |
| `ADMIN_PHONE` | – | – | Số điện thoại của quản trị viên tạo từ biến môi trường. Bỏ trống vẫn đăng nhập bình thường bằng `ADMIN_EMAIL`. |
| `JWT_SECRET` | – | chuỗi dev mặc định | Khoá ký JWT. **Bắt buộc đổi khi deploy thật.** |
| `OPENROUTER_BASE_URL` | – | `https://openrouter.ai/api/v1` | Chỉ đổi khi dùng proxy tương thích OpenRouter. |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | – | `http://localhost:3000` / `Larry AI` | Gửi kèm request để OpenRouter thống kê app. |
| `ACCOUNTS_FILE` | – | `backend/account.json` | Nơi lưu danh sách tài khoản. |
| `SUMMARY_EVERY_N_MESSAGES` | – | `4` | Tóm tắt lại sau mỗi bao nhiêu tin nhắn mới. |
| `SESSIONS_FILE` | – | `backend/sessions.json` | Nơi lưu vùng nhớ phiên hội thoại. |
| `EMAIL_USER` / `EMAIL_APP_PASSWORD` | – | – | Tài khoản Gmail gửi email cảnh báo (xem mục 8). |
| `ALERT_EMAIL_TO` | – | – | Địa chỉ điền sẵn ở ô "Gửi tới" của email cảnh báo. Email còn gửi kèm giáo viên chủ nhiệm nếu ghép được (xem mục 8). |
| `STUDENT_FEEDBACK_FORM` | – | – | Link biểu mẫu góp ý cho học sinh, hiện ở cột trái màn hình chat. |
| `TEACHER_FEEDBACK_FORM` | – | – | Link biểu mẫu góp ý cho thầy cô, hiện cùng chỗ. Bỏ trống cả hai thì khối góp ý không hiện. |

### 4.2. Frontend — `frontend/.env`

```bash
cd frontend
cp .env.example .env
```

```env
REACT_APP_API_URL=http://localhost:5000
GENERATE_SOURCEMAP=false
```

`REACT_APP_API_URL` phải trỏ đúng cổng backend. Nếu bỏ trống, frontend sẽ gọi tới server deploy sẵn trên Render thay vì backend local.

> CRA chỉ đọc biến môi trường lúc khởi động — sửa `.env` xong phải khởi động lại `npm start`.

---

## 5. Chạy app

Mở **hai terminal**:

**Terminal 1 — backend**

```bash
cd backend
npm start          # hoặc: npm run dev  (tự restart khi sửa code)
```

Log khi chạy đúng:

```
Server running on http://localhost:5000
OPENROUTER_API_KEY: loaded ✓
Model: google/gemini-2.5-flash-lite
Tài khoản: 0 — lưu tại /.../backend/account.json
```

**Terminal 2 — frontend**

```bash
cd frontend
npm start
```

Trình duyệt tự mở `http://localhost:3000`.

### Kiểm tra nhanh backend

```bash
curl http://localhost:5000/api/health
# {"status":"ok","provider":"openrouter","model":"google/gemini-2.5-flash-lite","apiKey":"loaded","accounts":0}
```

### Các bước sử dụng

1. Vào `http://localhost:3000`, chọn một trong ba cách:
   - Bấm **"Trò chuyện với Larry ngay! 💬"** để vào thẳng chat, không cần tài khoản.
   - **Đăng ký** / **Đăng nhập** với dropdown **"Bạn là" → Người dùng** nếu muốn có tài khoản riêng. Đăng ký cần **số điện thoại** và mật khẩu (email không bắt buộc). Đăng ký xong **quay về màn hình đăng nhập** (kèm thông báo thành công và số điện thoại điền sẵn), chứ không vào thẳng chat.
   - **Đăng nhập** với dropdown **"Bạn là" → Quản trị viên** để vào khu vực quản trị (xem mục 8).
2. Bấm **Cho phép** khi trình duyệt xin quyền camera.
3. Đợi vài giây để tải model nhận diện. Larry chào ngay khi nhận ra cảm xúc đầu tiên, và **giữ nguyên cảm xúc đó suốt phiên chat**.
4. Nhắn tin với Larry, hoặc bấm nút Scratch để mở trang game.

> Tài khoản được lưu vào file `backend/account.json` nên **không mất khi khởi động lại backend**. Xem mục 7 bên dưới.

### Hai chế độ đăng nhập

| | Chế độ khách | Tài khoản |
|---|---|---|
| Cách vào | Nút "Trò chuyện với Larry ngay!" | Đăng ký / Đăng nhập |
| Ghi vào `account.json` | Không | Có |
| Hạn token | 1 ngày | 7 ngày |
| Dùng được `/chat` | Có | Có |

Khách vẫn được cấp JWT thật nên endpoint `/chat` giữ nguyên cơ chế bảo vệ — không có token thì vẫn bị chặn 401.

---

## 6. API backend

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/health` | – | Kiểm tra server và trạng thái API key |
| `POST` | `/api/register` | – | `{ phone, password, profile, email?, role? }` → `{ user, message }`. **`phone` là bắt buộc và duy nhất**, `email` không bắt buộc. **Không cấp token/cookie** — đăng ký xong phải đăng nhập |
| `POST` | `/api/login` | – | `{ identifier, password, role }` → `{ user, token }`. `identifier` là **số điện thoại hoặc email** |
| `POST` | `/api/guest` | – | Không cần body → `{ user, token }` cho chế độ khách (token hạn 1 ngày) |
| `POST` | `/api/logout` | – | Xoá cookie token |
| `GET` | `/api/me` | ✅ | Thông tin user hiện tại |
| `GET` | `/api/documents/:slug` | – | Điều khoản (`dieu-khoan`) / Chính sách bảo mật (`chinh-sach-bao-mat`) → `{ title, content }` |
| `GET` | `/api/agents` | – | Danh sách agent (id, tên, icon, màu) để giao diện hiển thị |
| `POST` | `/chat/stream` | ✅ | **Đường chính.** `{ sessionId, message, emotion, checkin }` → luồng SSE (`trace` / `token` / `message` / `done` / `error`) |
| `POST` | `/chat` | ✅ | Dự phòng, không stream. Cùng body → `{ messages[], groups, agents, fallback }` |
| `POST` | `/api/session/end` | ✅ | `{ sessionId, history, emotion, checkin }` → chốt bản tóm tắt cuối |
| `GET` | `/api/feedback-links` | – | `{ student, teacher }` — hai link biểu mẫu khai trong `backend/.env` |
| `GET` | `/api/settings` | – | `{ guestMode, ttsEnabled, voice: { stt, tts } }` — công tắc quản trị viên + micro/loa có dùng được không. **Công khai** vì trang đăng nhập phải đọc trước khi có ai đăng nhập; chỉ toàn giá trị đúng/sai, không lộ tên model hay khoá API |
| `GET` | `/api/knowledge/graph` | – | Kho tri thức dạng `{ nodes, edges, ... }` cho trang giới thiệu vẽ đồ thị |
| `POST` | `/api/admin/users/:id/approval` | 👑 | `{ status: "approved" \| "rejected" }` — duyệt tài khoản giáo viên chủ nhiệm |
| `GET` | `/api/teacher/students` | 🍎 | Học sinh lớp mình, kèm số phiên / số phiên đáng lo / số email đã gửi |
| `GET` | `/api/teacher/students/:id/sessions` | 🍎 | Tóm tắt từng phiên của một em trong lớp mình (403 nếu khác lớp) |
| `GET` | `/api/teacher/flagged` | 🍎 | Mọi phiên đáng lo của cả lớp, nguy hiểm nhất lên trước |

👑 = chỉ quản trị viên · 🍎 = chỉ giáo viên chủ nhiệm **đã được duyệt**
| `GET` | `/api/voice/config` | ✅ | `{ stt, tts, voice, language }` — có bật được micro/loa không, để giao diện quyết định vẽ nút |
| `POST` | `/api/voice/stt` | ✅ | Byte âm thanh thô (`Content-Type: audio/wav`) → `{ text, seconds }` |
| `POST` | `/api/voice/tts` | ✅ | `{ text }` → byte âm thanh (`audio/wav`) |

Auth bằng JWT gửi qua header `Authorization: Bearer <token>` (hoặc cookie `token`).

Ví dụ gọi `/chat`:

```bash
# /api/register không trả token, nên lấy token bằng /api/login.
# Tài khoản định danh bằng SỐ ĐIỆN THOẠI; email bỏ qua được.
curl -s -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"0912345678","password":"123456"}' > /dev/null

TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"0912345678","password":"123456"}' | jq -r .token)

# Lượt đầu: message rỗng = Larry chủ động mở lời
curl -N -X POST http://localhost:5000/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sessionId":"demo-1","message":"","emotion":"sad"}'

# Lượt sau: chỉ gửi tin nhắn mới
curl -N -X POST http://localhost:5000/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sessionId":"demo-1","message":"mấy bạn trong lớp đánh em suốt","emotion":"sad"}'
```

**Không cần gửi lại `history` mỗi lượt** như bản trước: hội thoại và kết quả phân nhóm
được giữ trong graph theo `sessionId`. `history` chỉ còn dùng ở `/api/session/end`.

Trong response, `fallback: false` nghĩa là câu trả lời đến từ OpenRouter; `fallback: true` kèm `warning` nghĩa là đang dùng câu trả lời dự phòng.

---

## 7. Lưu trữ tài khoản

Tài khoản được lưu trong **`backend/account.json`** ([backend/accounts.js](backend/accounts.js)):

- Backend nạp file này lúc khởi động, và ghi lại mỗi khi có người đăng ký thành công.
- Lần chạy đầu tiên file chưa có thì backend tự tạo với nội dung `[]`.
- Mật khẩu lưu dưới dạng **hash bcrypt**, không lưu mật khẩu gốc.
- Muốn đổi mật khẩu bằng tay thì cứ ghi thẳng mật khẩu dạng chữ thường vào field `password`, ví dụ `"password": "M@tkhau1"`. Lần khởi động sau backend sẽ **tự hash lại rồi ghi đè** và in log `🔐 Mật khẩu của "..." đang để dạng chữ thường — đã tự hash lại`. Không có bước này thì `bcrypt.compare()` so mật khẩu với chuỗi thô sẽ luôn sai và đăng nhập báo sai mật khẩu dù gõ đúng.
- Ghi theo kiểu atomic (ghi ra `.tmp` rồi đổi tên) nên tắt server giữa chừng cũng không làm hỏng file.
- Nếu file bị sửa sai cú pháp JSON, backend **không xoá** mà đổi tên thành `account.json.broken-<timestamp>`, cảnh báo trong log rồi chạy tiếp với danh sách rỗng.

Định dạng file:

```json
[
  {
    "id": 1,
    "username": "Nguyễn Thị Mai",
    "phone": "0912345678",
    "email": "",
    "password": "$2b$10$...",
    "role": "user",
    "profile": {
      "fullName": "Nguyễn Thị Mai",
      "grade": "6",
      "school": "THCS Nguyễn Du",
      "className": "6A1"
    },
    "createdAt": "2026-07-25T05:41:30.041Z"
  }
]
```

**`phone` là danh tính của tài khoản**: bắt buộc lúc đăng ký, duy nhất trên toàn hệ thống, và là thứ dùng để đăng nhập. Số được chuẩn hoá trước khi lưu (bỏ dấu cách/chấm, `+84…` → `0…`) nên `"0912 345 678"` và `"+84912345678"` là **cùng một tài khoản**, không đăng ký hai lần được.

`email` **không bắt buộc** — học sinh cấp 2 phần lớn chưa có email riêng. Bỏ trống thì lưu chuỗi rỗng; đã khai thì phải đúng định dạng và cũng là duy nhất. Riêng giáo viên chủ nhiệm nên khai, vì bản sao email cảnh báo gửi tới chính địa chỉ đó.

`username` giờ chỉ là **tên hiển thị**, không dùng để đăng nhập và không cần khác nhau (hai em trùng tên là chuyện thường). Đăng ký xong nó lấy theo `profile.fullName`, không khai tên thì rơi về chính số điện thoại.

> Tài khoản tạo **trước** khi đổi sang số điện thoại chỉ có email: chúng được bổ sung `phone: ""` lúc khởi động và **vẫn đăng nhập bằng email như cũ** (ô đầu tiên ở trang đăng nhập nhận cả hai). Quản trị viên bổ sung số cho những tài khoản đó ở trang `/admin`.

`profile` là 4 thông tin học sinh điền lúc đăng ký, **tất cả đều không bắt buộc** — bỏ trống thì lưu chuỗi rỗng:

| Field | Nhãn trên form | Cách nhập |
|---|---|---|
| `fullName` | Tên | Ô nhập |
| `grade` | Bạn là học sinh khối | Dropdown đủ 12 khối (lớp 1 → lớp 12), lưu số trần: `"7"` |
| `className` | Lớp của bạn | Ô nhập, ví dụ `6A1` |
| `school` | Trường học của bạn là | Dropdown; chọn "Trường khác..." thì hiện thêm ô tự nhập |

Danh sách khối và trường nằm ở [constants/schoolOptions.js](frontend/src/constants/schoolOptions.js) — thêm trường mới chỉ cần thêm một dòng vào `SCHOOL_OPTIONS`. Dropdown dùng [AuthSelect.jsx](frontend/src/components/ui/AuthSelect.jsx) để trông giống các ô nhập khác. Ở trang quản trị, ba thông tin này hiện thành **3 cột riêng: Trường · Lớp · Khối**, và ô sửa vẫn để nhập tay tự do (quản trị viên có thể chỉnh dữ liệu cũ kiểu `"lớp 6"`).

Tài khoản tạo từ phiên bản cũ (chưa có `role`/`profile`) sẽ được tự bổ sung field khi backend khởi động.

Muốn xoá hết tài khoản thì dừng backend, sửa file thành `[]` (hoặc xoá file) rồi chạy lại — admin mặc định sẽ được tạo lại.

Muốn đổi chỗ lưu thì đặt `ACCOUNTS_FILE` trong `backend/.env`.

> File này chứa số điện thoại, email và hash mật khẩu nên đã được `.gitignore` — không commit lên git.

---

## 8. Phân quyền

Hệ thống có 3 vai trò, lưu ở field `role` trong `account.json` và nhúng vào JWT:

| Vai trò | Cách có được | Cần duyệt | Vào được | Trò chuyện với Larry |
|---|---|---|---|---|
| `user` | Đăng ký, hoặc bấm nút khách | Không | Trang chat `/`, trang game `/game` | Có |
| `teacher` | Đăng ký, chọn "Giáo viên chủ nhiệm" | **Có** — quản trị viên duyệt | Chỉ `/teacher` | **Không** |
| `admin` | Tài khoản tạo sẵn trong `account.json` | Không | Chỉ khu vực quản trị `/admin` | **Không** |

Quản trị viên và giáo viên chủ nhiệm là tài khoản quản lý/theo dõi, **không tham gia trò chuyện**. Chặn ở hai tầng: [ProtectedRoute.jsx](frontend/src/components/ui/ProtectedRoute.jsx) đẩy họ từ `/` và `/game` về khu vực của mình, còn middleware `blockAdmin` ở [auth.js](backend/auth.js) trả 403 cho `/chat` và `/api/session/end` kể cả khi gọi thẳng API. Vì vậy hai vai trò này không bao giờ sinh ra phiên hội thoại nào trong `sessions.json`.

Ở trang đăng nhập có dropdown **"Bạn là"** với ba lựa chọn *Người dùng* / *Giáo viên chủ nhiệm* / *Quản trị viên*. Vai trò được chọn gửi kèm request đăng nhập và server tra tài khoản theo cả định danh lẫn vai trò.

> **Số điện thoại là duy nhất trên toàn hệ thống.** Một số chỉ dùng được cho **một** tài khoản, dù là học sinh, giáo viên hay quản trị viên — so sánh sau khi chuẩn hoá, nên `0912 345 678` và `+84912345678` là một.
>
> **Email cũng duy nhất, nhưng không bắt buộc.** Bỏ trống thì thôi (nhiều tài khoản cùng để trống không tính là trùng nhau); đã khai thì kiểm tra không phân biệt hoa/thường (`an@a.vn` và `An@A.vn` là một). Tài khoản cũ trùng email vẫn đăng nhập được bình thường nhờ dropdown "Bạn là".
>
> Ô đầu tiên ở trang đăng nhập nhận **số điện thoại hoặc email** — tài khoản tạo trước khi đổi sang định danh bằng số vẫn vào được bằng email như cũ.

### Quên mật khẩu

Bấm **"Quên mật khẩu?"** ở trang đăng nhập thì hiện ra một dòng nhỏ ngay dưới nút:

> hãy gửi email liên hệ tới **larryai.bluemoon@gmail.com** để được cấp lại mật khẩu!

Địa chỉ đó bấm được (mở sẵn ứng dụng thư), và bấm nút lần nữa thì dòng chữ thu lại.

**Vì sao không có luồng tự đặt lại mật khẩu?** Danh tính của tài khoản là **số điện thoại**, còn email thì không bắt buộc và phần lớn học sinh để trống (xem mục 7) — gửi link đặt lại qua email là gửi vào chỗ không có ai. Nên đường đi thật hiện nay là: học sinh nhắn cho quản trị viên → quản trị viên vào `/admin`, bấm **Sửa** ở dòng của em đó và đặt mật khẩu mới. Nút "Quên mật khẩu?" nói thẳng ra điều đó thay vì mở một biểu mẫu không dẫn tới đâu.

Đổi địa chỉ ở [frontend/src/constants/systemMessages.js](frontend/src/constants/systemMessages.js) (`PASSWORD_RESET_EMAIL`). Nó cố ý **tách khỏi** `SUPPORT_EMAIL` — một bên là hòm thư nhận phản hồi khi hệ thống lỗi, một bên là hòm thư của người cấp lại được mật khẩu; đổi cái này không nên kéo theo cái kia.

### Vai trò giáo viên chủ nhiệm

**Đăng ký.** Ngay đầu form [đăng ký](frontend/src/components/ui/Register.jsx) có hai nút **🎒 Học sinh** / **🍎 Giáo viên chủ nhiệm** — chọn nút nào thì bộ câu hỏi bên dưới đổi theo. Giáo viên khai: họ tên, ngày sinh, **trường** và **lớp chủ nhiệm**. Hai field cuối là **bắt buộc** vì chúng chính là thứ dùng để ghép thầy cô với học sinh. Email vẫn không bắt buộc như mọi tài khoản khác, nhưng thầy cô **nên khai** — bản sao email cảnh báo về học sinh trong lớp gửi tới chính địa chỉ đó, bỏ trống thì tài khoản vẫn dùng được nhưng không nhận được bản sao nào (trang soạn email cảnh báo sẽ báo rõ điều này cho quản trị viên).

**Duyệt.** Tài khoản giáo viên đọc được tóm tắt hội thoại của cả một lớp, nên không dùng được ngay: nó ở trạng thái `pending` cho tới khi quản trị viên bấm duyệt. Đăng nhập lúc này trả 403 kèm câu giải thích. Khu duyệt nằm ở **đầu trang `/admin`**, chỉ hiện khi có tài khoản đang chờ. Học sinh đăng ký **không** qua bước này.

**Ghép với học sinh.** Không có bảng phân công lớp riêng — cả hai bên đều đã tự khai trường và lớp, nên chỗ ghép chính là hai field đó ([teachers.js](backend/teachers.js)):

```
học sinh: { school: "THCS Đoàn Thị Điểm", className: "6A1" }
                              ↕  khớp nhau (bỏ qua hoa/thường, khoảng trắng thừa)
giáo viên: { school: "THCS Đoàn Thị Điểm", className: "6A1" }  → status: approved
```

So sánh cố ý **dễ tính vừa phải**: `"6a1"`, `"6A1"` và `" 6A1 "` là một lớp, nhưng `"6A1"` với `"6/1"` là hai — đoán xa hơn thế thì có ngày một giáo viên đọc được lớp không phải lớp mình. Bên nào bỏ trống trường hoặc lớp thì **không ghép được với ai** (nếu không, mọi tài khoản chưa khai gì sẽ khớp lẫn nhau vì cùng là chuỗi rỗng). Mỗi lớp chỉ có **một** giáo viên chủ nhiệm — chặn cả lúc đăng ký lẫn lúc duyệt.

**Giao diện `/teacher` — chỉ đọc.** Thầy cô thấy danh sách học sinh lớp mình (em cần chú ý nhất lên đầu), mở ra là tóm tắt từng phiên kèm mức độ, dấu hiệu ghi nhận được, và **tình trạng email cảnh báo đã gửi hay chưa**. Khu vực này **không có route sửa hay xoá nào** ở backend — thiếu hẳn route là cách bảo đảm chắc chắn hơn mọi kiểm tra quyền viết trong thân hàm. Đổi id trên URL để xem lớp khác trả về 403.

> Thứ hiện ra là **bản tóm tắt do model viết**. `sessions.json` không lưu nguyên văn lời học sinh, nên không có đường nào để giáo viên đọc lại hội thoại gốc — điều này nên nói rõ với cả thầy cô lẫn các em.

### Tạo tài khoản quản trị viên

Quyền admin **không** cấp được từ web: không đăng ký được, backend không tự tạo lúc khởi động, và quản trị viên đang đăng nhập cũng không nâng quyền cho ai được. Cách duy nhất là developer chạy lệnh trực tiếp trên máy chủ.

```bash
cd backend
npm run create-admin
```

Script sẽ hỏi lần lượt tên đăng nhập, email, số điện thoại (Enter để bỏ qua), mật khẩu (nhập 2 lần, gõ tới đâu hiện `*` tới đó nên không lọt vào lịch sử shell):

```
Tạo tài khoản quản trị viên
File tài khoản: /.../backend/account.json
Hiện có: 3 tài khoản (1 quản trị viên)

Tên đăng nhập: coLan
Email: co.lan@truong.edu.vn
Số điện thoại (Enter để bỏ qua): 0912345678
Mật khẩu (tối thiểu 8 ký tự): ************
Nhập lại mật khẩu: ************

✅ Đã tạo quản trị viên: coLan <co.lan@truong.edu.vn> (id 4)
```

Muốn chạy một phát không hỏi gì (dùng khi viết script tự động):

```bash
npm run create-admin -- --username coLan --email co.lan@truong.edu.vn --password 'MatKhauManh@2026'
```

> Cách này để mật khẩu lọt vào lịch sử shell. Nếu dùng, nhớ xoá dòng đó khỏi `~/.bash_history`.

Sau khi tạo xong, **khởi động lại backend** để nạp tài khoản mới, rồi đăng nhập ở `/login` với dropdown **"Bạn là" → Quản trị viên**.

Script tự chặn: mật khẩu dưới 8 ký tự, trùng email hoặc trùng tên với một admin đã có. Nếu `account.json` chưa có admin nào, backend sẽ in cảnh báo lúc khởi động:

```
⚠️  Chưa có tài khoản quản trị nào. Tạo bằng lệnh:  npm run create-admin
```

Muốn gỡ quyền admin của ai đó thì sửa tay `account.json` (đổi `"role": "admin"` thành `"user"`, hoặc xoá cả bản ghi) rồi khởi động lại backend.

#### Tạo admin ở nơi không mở được terminal (Render, Railway…)

Gói miễn phí của các nền tảng này thường **không cho mở shell**, và ổ đĩa là tạm nên tài khoản tạo bằng tay cũng mất sau mỗi lần deploy. Khai ba biến môi trường sau, backend sẽ tự dựng lại đúng tài khoản đó **ở mỗi lần khởi động**:

```env
ADMIN_USERNAME=coLan
ADMIN_EMAIL=co.lan@truong.edu.vn
ADMIN_PASSWORD=MatKhauRatManh@2026
# Không bắt buộc — khai thêm thì đăng nhập bằng số điện thoại cũng được
ADMIN_PHONE=0912345678
```

Log khởi động sẽ in `✅ Đã tạo quản trị viên từ biến môi trường: …`. Cơ chế này **không ghi đè** tài khoản đang có: đã tồn tại admin đúng email đó thì bỏ qua, nên đổi mật khẩu trong `account.json` cũng không bị dựng lại. Mật khẩu dưới 8 ký tự hoặc trùng tên với admin khác thì backend chỉ cảnh báo rồi chạy tiếp, không sập.

> Mật khẩu nằm trong biến môi trường của nền tảng — hãy dùng một mật khẩu riêng, không tái sử dụng ở đâu khác.

### Tính năng quản trị viên

Trang `/admin` ([AdminPage.jsx](frontend/src/components/ui/AdminPage.jsx)) có **hai tab**:

| Tab | Trả lời câu hỏi |
|---|---|
| 📊 **Tổng quan** | "Cả trường đang thế nào" — bảng điều khiển, khối chờ duyệt, hai công tắc hệ thống (chế độ khách · giọng đọc), bảng tài khoản |
| 📈 **Tần suất sử dụng** | "Em này vào đều không" — biểu đồ lượt trò chuyện theo ngày của MỘT học sinh |

Ở tab Tổng quan, quản trị viên có thể:

- **Xem** danh sách tài khoản kèm 3 cột Trường · Lớp · Khối, số phiên hội thoại và số phiên bị gắn cờ 🚩. Bảng hiện **10 dòng mỗi trang**, có ô tìm kiếm và nút ← Trước / Sau → (xem *Bảng tài khoản* bên dưới).
- **Sửa** tên tài khoản, email, hồ sơ trường lớp, và đặt lại mật khẩu — kể cả tài khoản của chính mình. Đây cũng là **cách duy nhất** để cấp lại mật khẩu cho người quên (xem *Quên mật khẩu* ở mục 8).
- **Xoá** tài khoản (kèm toàn bộ lịch sử hội thoại của tài khoản đó).
- **Bấm "Hội thoại"** để xem các phiên trò chuyện: thời gian bắt đầu/kết thúc, số tin nhắn, bản tóm tắt, mức độ 🚩 và nhóm dấu hiệu phát hiện được.
- **Bấm "✉️ Cảnh báo GVCN"** ở phiên bị gắn cờ để AI soạn email cảnh báo, đọc lại rồi gửi cho giáo viên chủ nhiệm (xem cuối mục này).
- **Bấm "⬇️ Tải Excel"** ở góc phải mỗi bảng để tải bảng đó về máy, file mang đúng tên bảng (xem *Tải bảng về máy dưới dạng Excel* bên dưới).
- **Bật/tắt chế độ khách** và **bật/tắt giọng đọc của Larry** bằng hai công tắc ngay trên bảng tài khoản (xem *Hai công tắc hệ thống* bên dưới).

**Cơ chế gắn cờ:** phiên được gắn cờ khi có **bất kỳ dấu hiệu tiêu cực nào** về học sinh — không chỉ bắt nạt/bạo lực học đường mà cả bị xâm hại, bạo hành gia đình, tự làm đau bản thân, suy sụp tinh thần, sợ hãi, suy nhược thể chất, áp lực học tập, cô đơn... Chỉ những phiên học sinh vui vẻ/bình thường mới không bị gắn cờ; nghi ngờ thì vẫn gắn cờ. Mỗi phiên gắn cờ có `riskLevel` là `low` (Cần chú ý), `medium` (Đáng lo) hoặc `high` (Khẩn cấp), kèm `categories` — mã nhóm dấu hiệu, nhãn tiếng Việt nằm ở [riskCategories.js](frontend/src/constants/riskCategories.js).

Bốn giới hạn cố ý:

| Giới hạn | Vì sao |
|---|---|
| Không tự xoá được tài khoản đang đăng nhập | Tránh tự khoá mình khỏi hệ thống. Nút "Xoá" cũng bị ẩn ở dòng của chính mình |
| Không xem được hội thoại của tài khoản admin | Admin không trò chuyện nên không có hội thoại. Nút "Hội thoại" bị ẩn ở các dòng admin |
| Không đổi được vai trò từ giao diện | Cấp quyền admin chỉ làm được bằng `npm run create-admin` |
| Không xoá được quản trị viên cuối cùng | Tránh mất hoàn toàn quyền quản trị |

API tương ứng, tất cả đều cần `authenticateToken + requireAdmin`:

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/admin/users` | Danh sách tài khoản + thống kê phiên |
| `PATCH` | `/api/admin/users/:id` | Sửa tài khoản (`username`, `email`, `role`, `profile`, `password`) |
| `DELETE` | `/api/admin/users/:id` | Xoá tài khoản và toàn bộ phiên của họ |
| `GET` | `/api/admin/users/:id/sessions` | Các phiên hội thoại của một tài khoản |
| `GET` | `/api/admin/flagged` | Mọi phiên có dấu hiệu tiêu cực, mức khẩn cấp lên đầu rồi tới mới nhất |
| `GET` | `/api/admin/alert/config` | Trạng thái tài khoản gửi email: `{ ready, error, from, defaultTo, model }` |
| `POST` | `/api/admin/sessions/:id/alert/draft` | AI soạn nháp email cảnh báo GVCN → `{ subject, body, to, from }`. **Không gửi gì** |
| `POST` | `/api/admin/sessions/:id/alert/send` | `{ to, subject, body }` → gửi thật và ghi vào `alerts[]` của phiên |
| `PATCH` | `/api/admin/settings/guest-mode` | `{ enabled }` → `{ guestMode }` — bật/tắt trò chuyện không cần đăng nhập |
| `PATCH` | `/api/admin/settings/tts` | `{ enabled }` → `{ ttsEnabled, voice }` — bật/tắt giọng đọc của Larry |

Hai chốt chặn để hệ thống không tự khoá mình: không xoá được tài khoản đang đăng nhập, và không hạ quyền/xoá được quản trị viên cuối cùng.

### Hai công tắc hệ thống

Nằm ngay trên bảng tài khoản, vì chúng tác động tới **mọi** người vào web chứ không phải từng tài khoản một. Cả hai lưu vào `settings.json` — **cùng thư mục với `account.json`**, không phải trong thư mục mã nguồn, nên lựa chọn không bị đặt lại sau mỗi lần deploy ([settings.js](backend/settings.js)).

| Công tắc | Tắt đi thì | Mặc định |
|---|---|---|
| **Chế độ khách** | Nút "Trò chuyện với Larry ngay" biến mất, `/api/guest` trả 403 | BẬT |
| **Giọng đọc của Larry (TTS)** | Nút loa biến mất ở trang đăng nhập lẫn khung chat, `/api/voice/tts` trả 503 | BẬT |

**Công tắc giọng đọc là để tiết kiệm token.** Mỗi câu trả lời được đọc lên là một lần gọi model TTS tính tiền theo số chữ — mà chữ thì đã hiện sẵn trên màn hình rồi. Tắt đi, khung chat vẫn đủ chức năng: Larry vẫn trả lời, học sinh vẫn nói vào **micro** được (STT không bị đụng tới — đó là đường *vào* của những em chưa gõ thạo, tắt nhầm là mất luôn một cách nhập).

Tắt đóng **cả hai đầu**, không chỉ giấu nút:

```
PATCH /api/admin/settings/tts  { enabled: false }
        │
        ├─> /api/settings      → voice.tts = false  → trang đăng nhập không vẽ nút loa
        ├─> /api/voice/config  → tts = false        → khung chat không vẽ nút loa
        └─> POST /api/voice/tts → 503 "Quản trị viên đang tắt giọng đọc của Larry."
```

Đóng ở máy chủ mới là đóng thật: giấu nút chỉ là giấu, ai biết địa chỉ API vẫn gọi thẳng vào đốt token được. Ba đường trên đọc lại cài đặt ở **mỗi lượt** chứ không nhớ lúc khởi động — bấm tắt lúc 9h thì 9h01 em đang mở sẵn khung chat cũng thôi phát tiếng, không cần khởi động lại backend.

Trang quản trị phân biệt **"tôi tắt"** với **"máy chủ chưa cấu hình"**: bật công tắc lên mà `TTS_MODEL`/`OPENROUTER_API_KEY` còn thiếu thì ô trạng thái nói thẳng ra điều đó, thay vì trông như một cái nút hỏng. Log lúc khởi động cũng in kèm — `Loa (TTS_MODEL): ... — QUẢN TRỊ VIÊN ĐANG TẮT`.

Kiểm nhanh: `npm run test:settings` trong `backend/` ([settings.test.js](backend/settings.test.js)) — 7 bài, gồm cả "công tắc sống sót qua lần khởi động lại" và "file `settings.json` cũ chỉ có `guestMode` vẫn đọc được".

### Bảng tài khoản: tìm kiếm, phân trang, và bảng chi tiết mở tại chỗ

**Mười dòng một trang.** Một trường cấp 2 có hàng trăm tài khoản; đổ hết ra một bảng thì mọi thứ bên dưới nó — kể cả nút tải Excel — trôi khỏi tầm nhìn. Nút ← Trước / Sau → ở cuối bảng, kèm dòng "Trang 2 / 5 · đang xem 11–20 trong 47" để biết mình đang ở đâu.

**Lọc theo vai trò** bằng bốn nút ngay cạnh ô tìm kiếm — *Tất cả · Học sinh · Giáo viên chủ nhiệm · Quản trị viên* — mỗi nút in sẵn số lượng (`Học sinh 25`). Dạng nút bấm chứ không phải ô chọn xổ xuống: cả bốn lựa chọn luôn nhìn thấy kèm số lượng, nên liếc một cái là biết trường có bao nhiêu giáo viên mà không phải mở ra xem. Con số đếm trên **toàn bộ** danh sách, không đổi theo chính nút đang bật — nó trả lời "bấm vào đây thì được bao nhiêu dòng".

**Ô tìm kiếm dò trên MỌI cột cùng lúc**: tên tài khoản, họ tên, trường, lớp, khối, email, số điện thoại.

Hai điều làm ô này dùng được thật ([utils/search.js](frontend/src/utils/search.js)):

| Gõ | Ra | Vì sao quan trọng |
|---|---|---|
| `doan thi diem` | Đoàn Thị Điểm | **Gõ không dấu vẫn ra.** Bắt gõ đúng dấu thì người dùng sẽ kết luận là trường đó chưa có trong hệ thống — một kết luận sai mà không có gì trên màn hình gợi ý là mình vừa sai |
| `6a1 diem` | em lớp 6A1 trường Đoàn Thị Điểm | Mỗi **từ** khớp ở đâu cũng được, không cần đúng thứ tự và không cần cùng một cột — đúng cách người ta gõ khi đang nhớ mang máng vài mẩu |

Hai bộ lọc **cộng dồn**: chọn *Giáo viên chủ nhiệm* rồi gõ `doan thi diem` là ra đúng các thầy cô chủ nhiệm của trường đó. Đổi bộ lọc thì bảng quay về trang 1 — kết quả mới không liên quan gì tới việc mình đang đứng ở trang mấy của kết quả cũ.

Lọc xong thì nút **⬇️ Tải Excel** xuất đúng những dòng đang lọc ra: tìm "6A1" rồi bấm tải là được danh sách lớp 6A1, không phải cả trường.

Khi không còn dòng nào, câu báo nói rõ **thủ phạm là bộ lọc nào** ("Không có tài khoản giáo viên chủ nhiệm nào khớp với *khong-ton-tai*") và kèm nút **Xoá bộ lọc**. Câu báo chung chung sẽ khiến người dùng ngồi sửa từ khoá trong khi thứ đang chặn là cái nút vai trò họ bấm từ lúc nãy.

**Bấm "Hội thoại" / "Sửa" / "Xoá" thì bảng chi tiết mở ra NGAY DƯỚI dòng đó.** Trước đây phần hội thoại nằm ở cuối trang: bấm xong phải cuộn qua cả bảng mới thấy, mà tới nơi thì không còn nhìn thấy mình vừa bấm vào ai. Ba điểm khác so với bản cũ:

- **Dòng gốc vẫn còn nguyên** khi bấm Sửa. Bản cũ thay hẳn dòng đó bằng biểu mẫu, nên đang sửa thì không đối chiếu lại được dữ liệu cũ.
- **Xoá hỏi lại ngay trong bảng mở ra**, không phải hộp thoại `window.confirm()` bật ra giữa màn hình. Hộp thoại đó che mất chính cái dòng đang nói tới, nên người bấm không đối chiếu lại được tên mình vừa chọn — với thao tác không khôi phục được thì đó là chỗ sai. Câu hỏi lại ghi rõ tên, họ tên và **số phiên hội thoại sẽ mất theo**.
- **Mỗi lúc chỉ một dòng được mở**, và bấm lại đúng nút đó là đóng.

### Tần suất sử dụng của một học sinh

Tab **📈 Tần suất sử dụng** ([UsageFrequency.jsx](frontend/src/components/ui/UsageFrequency.jsx)): chọn một tài khoản học sinh → biểu đồ cột, **trục ngang là các ngày tăng dần tới hôm nay**, trục dọc là số lượt trò chuyện trong ngày. Chọn được **7 ngày** hoặc **30 ngày** gần nhất.

Vì sao đáng nhìn: một em vào đều rồi **im hẳn ba hôm** là một tín hiệu, và tín hiệu đó không hiện ra ở bất cứ con số tổng nào của bảng điều khiển. Bốn ô số phía trên biểu đồ nói thẳng điều đó — tổng lượt, **số ngày có vào trên tổng số ngày**, trung bình mỗi ngày, và ngày nhiều nhất.

> Trung bình chia cho **số ngày trong khoảng**, không chia cho số ngày có hoạt động: câu hỏi là "em vào đều không", mà bỏ ngày im lặng ra khỏi mẫu số thì em vào đúng một hôm với 3 lượt cũng ra "3 lượt/ngày".

Lượt được tính theo `startedAt` (lúc em **mở** cuộc trò chuyện): một phiên bắt đầu 23h50 và chốt lúc 0h10 hôm sau vẫn là "em vào nói chuyện tối hôm đó". Ngày cắt theo **giờ Việt Nam**, giống hệt backend ([utils/days.js](frontend/src/utils/days.js) và [backend/stats.js](backend/stats.js)) — hai bên cắt lệch nhau thì hai biểu đồ cạnh nhau sẽ nói hai con số khác nhau về cùng một ngày.

Tab này **không thêm API nào mới**: nó dùng lại đúng đường `/api/admin/users/:id/sessions` mà nút "Hội thoại" vẫn gọi, rồi tự đếm theo ngày ở phía trình duyệt. Biểu đồ cũng dùng chung component với bảng điều khiển ([DayColumnChart.jsx](frontend/src/components/ui/DayColumnChart.jsx)) — một chuỗi thì nó vẽ cột thường, nhiều chuỗi thì thành cột chồng.

### Tải bảng về máy dưới dạng Excel

Mỗi bảng ở khu vực quản trị có nút **⬇️ Tải Excel** ở góc phải tiêu đề. Bấm là file `.xlsx` về thẳng thư mục Downloads, **mang đúng tên bảng** — tải cả bốn liền nhau vẫn nhìn tên là biết file nào của bảng nào:

| Bảng trên màn hình | File tải về | Nội dung |
|---|---|---|
| Tài khoản người dùng | `Tài khoản người dùng.xlsx` | Toàn bộ tài khoản: danh tính, trường/lớp/khối, số phiên, số phiên có dấu hiệu và khẩn cấp |
| Hội thoại theo ngày | `Hội thoại theo ngày.xlsx` | Từng ngày trong khoảng đang chọn |
| Các lớp đã tạo tài khoản | `Các lớp đã tạo tài khoản.xlsx` | **Tất cả** các lớp, không chỉ mấy lớp đang hiện trên màn hình |
| Các trường đã tạo tài khoản | `Các trường đã tạo tài khoản.xlsx` | Gộp theo trường |

Ba điều đáng nói về cách nó chạy:

**1. Không gọi thêm API.** Số liệu đã nằm sẵn trong trang rồi, nên file dựng ngay trong trình duyệt. Nhờ vậy cái tải về **luôn khớp với cái đang nhìn thấy** — kể cả khoảng ngày vừa chọn ở bảng điều khiển — không tốn thêm một lượt gọi máy chủ, và không có chuyện token hết hạn giữa chừng làm hỏng lượt tải. Máy chủ trên Render không phải làm gì cả, kể cả khi bảng có vài nghìn dòng.

**2. File Excel thật, không phải CSV đổi đuôi.** [utils/xlsx.js](frontend/src/utils/xlsx.js) tự dựng file `.xlsx` — vốn là một file ZIP chứa mấy file XML — **không dùng thư viện nào**. Lý do, theo thứ tự quan trọng:

- Thư viện phổ biến nhất (SheetJS `xlsx` trên npm) đứng yên ở 0.18.5 và bản đó dính mấy lỗi bảo mật đã công bố; bản vá không nằm trên npm registry. Đây là app có dữ liệu học sinh.
- Nó nặng ~400KB sau khi nén, tải về cho **mọi** người dùng — trong khi chỉ quản trị viên mới bấm nút này.
- Việc cần làm rất hẹp: một sheet, chữ và số, không công thức, không biểu đồ.

Đổi lại, phần tự viết được kiểm bằng [9 bài test](frontend/src/utils/xlsx.test.js) soi thẳng vào byte của file, và bản sinh ra đã đối chiếu bằng **hai bộ đọc độc lập** (openpyxl và LibreOffice) — cả hai đọc lại đủ và đúng.

**3. File mở ra là dùng được ngay:** dòng tiêu đề in đậm, được đóng băng khi cuộn, có sẵn nút lọc (AutoFilter), và độ rộng cột đặt theo từng cột.

Vài chỗ cố ý khác với bảng trên màn hình, vì hai nơi phục vụ hai việc khác nhau:

| Trên màn hình | Trong file Excel | Vì sao |
|---|---|---|
| Phù hiệu `🚩 3`, `❗`, `Chờ duyệt` | Cột riêng, giá trị **số** | Liếc một cái là hiểu thì hợp với màn hình; còn tải file về là để **lọc và sắp xếp** |
| `3 HS · 1 GV` gộp một ô | Tách hai cột | Gộp lại là một ô chữ, cộng hay lọc đều không được |
| Ngày `19/08/2026` | `2026-08-19` | Cột ngày kiểu `dd/mm/yyyy` trong Excel sắp xếp theo **ngày trong tháng**, không theo thời gian |
| Bảng lớp cắt bớt cho khỏi dài | Đủ tất cả các lớp | File thiếu dòng thì đúng lúc cần tra một lớp yên ổn lại không có |

> Bảng nào chưa có dòng nào thì **không hiện nút** — một file Excel chỉ có mỗi dòng tiêu đề không giúp được gì, và cái nút bấm vào ra file trống thì khó hiểu hơn là không có nút.

### Vùng nhớ phiên hội thoại

Mỗi lần học sinh **đã đăng nhập** vào màn hình chat, frontend sinh một `sessionId` và gửi kèm mọi request `/chat`. Backend tạo một bản ghi trong `backend/sessions.json` ([sessions.js](backend/sessions.js)):

```json
{
  "id": "b3f1...",
  "userId": 2, "username": "nam",
  "startedAt": "...", "endedAt": "...",
  "messageCount": 8,
  "checkinNote": "Rất khó chịu (cảm xúc ngay lúc này) · cảm xúc: Sợ hãi · tác động bởi: Bạn bè · có kể thêm bằng lời",
  "cameraEmotion": "fearful",
  "summary": "Học sinh bày tỏ sự sợ hãi khi đi học do bị các bạn lớp trên chặn đường đòi tiền...",
  "flagged": true,
  "riskLevel": "high",
  "categories": ["bullying", "fear"],
  "bullyingDetected": true,
  "concerns": ["..."]
}
```

Bản tóm tắt do **một model LLM riêng** sinh ra ([summarizer.js](backend/summarizer.js)), cấu hình bằng `SUMMARY_MODEL` trong `backend/.env` — tách khỏi model chat để chọn model khá hơn cho việc đánh giá dấu hiệu tiêu cực mà không làm đắt phần trò chuyện. Model đọc **cả ba nguồn**: phiếu cảm xúc đầu phiên, cảm xúc camera, và hội thoại; rồi trả về JSON `{summary, flagged, riskLevel, categories, concerns}`. Prompt cũng có câu chặn prompt injection.

Kết quả của model được siết lại ở phía backend, luôn nghiêng về phía gắn cờ: nếu model trả `flagged=false` nhưng vẫn liệt kê `concerns`/`categories`, phiên vẫn bị gắn cờ; mã nhóm lạ bị loại bỏ; thiếu `riskLevel` thì suy ra từ nhóm dấu hiệu. Bản ghi cũ (chỉ có `bullyingDetected`) được `normalizeSession()` trong [sessions.js](backend/sessions.js) quy đổi sang cờ mới lúc đọc file, nên không cần chạy migration.

**Hội thoại ngắn vẫn được gắn cờ.** Học sinh điền phiếu cảm xúc xong là Larry đã nắm được tình trạng, em có thể không nhắn thêm câu nào — nên phiếu được chấm độc lập với hội thoại ở [risk.js](backend/risk.js):

- `analyzeCheckin()` chấm bằng luật, chỉ dựa trên các ô chọn sẵn (mức cảm xúc, từ cảm xúc, lý do tác động) — cố ý **không** dò từ khoá trong phần học sinh tự kể, việc hiểu đoạn đó là của model. Mức "Rất khó chịu" → sàn `medium`, "Khó chịu" → sàn `low`, các từ như *Sợ hãi / Vô vọng / Kiệt sức* → sàn `medium`.
- Mức sàn này được áp **ngay khi phiếu tới**, trước cả khi model chạy, nên phiên vẫn hiện cờ dù model tóm tắt lỗi hoặc chưa cấu hình API key. Model chỉ được nâng mức, không được hạ xuống dưới sàn.
- Phiếu có dấu hiệu tiêu cực còn khiến bản tóm tắt chạy **ngay từ lượt chào đầu tiên**, thay vì đợi đủ `SUMMARY_EVERY_N_MESSAGES` tin nhắn — vì kiểu phiên này thường không bao giờ đạt tới ngưỡng đó.
- Trang quản trị hiện dòng `📝 Phiếu cảm xúc: ...` trên mỗi phiên để giáo viên thấy căn cứ, kể cả khi chưa có tóm tắt.

Để tiết kiệm chi phí, tóm tắt **không** chạy mỗi lượt chat: chỉ chạy lại sau mỗi `SUMMARY_EVERY_N_MESSAGES` tin nhắn mới (mặc định 4), chạy nền sau khi đã trả lời học sinh nên không làm chậm cuộc trò chuyện. Khi rời màn hình chat, frontend gọi `POST /api/session/end` (kèm `checkin` + `emotion`) để chốt bản tóm tắt cuối cùng — kể cả khi học sinh chưa nhắn câu nào mà đã điền phiếu.

> **Khách không đăng nhập thì không lưu gì cả.** `touchSession()` trả về `null` ngay khi gặp token khách, nên không có bản ghi nào được tạo và quản trị viên cũng không thấy gì.

**Hệ thống chỉ lưu bản tóm tắt, không lưu nguyên văn hội thoại.** Đây là lựa chọn có chủ đích để giảm lượng dữ liệu nhạy cảm của trẻ bị lưu lại. Phiếu cảm xúc cũng vậy: `checkinNote` chỉ ghi lại các ô chọn sẵn, phần học sinh tự kể được gửi cho model phân tích nhưng **không** ghi xuống `sessions.json` (vì thế frontend phải gửi lại phiếu ở `/api/session/end`). Nếu bạn cần đọc nguyên văn để xác minh, nói mình biết — nhưng nên cân nhắc kỹ vì đó là nhật ký tâm sự của học sinh.

### Cảnh báo cho giáo viên chủ nhiệm qua email

Ở mỗi phiên bị gắn cờ, trang quản trị có nút **✉️ Cảnh báo GVCN**. Luồng cố ý chia làm **hai bước**, email KHÔNG bao giờ tự động gửi đi:

1. **Soạn** — `POST /api/admin/sessions/:sessionId/alert/draft` gọi model AI ([alertEmail.js](backend/alertEmail.js)) viết email từ bản tóm tắt, phiếu cảm xúc, mức độ và nhóm dấu hiệu của phiên. Model bị ràng buộc: không kết luận chắc chắn, không bịa chi tiết, **không trích nguyên văn lời học sinh**, không suy đoán về người bị nghi gây hại, luôn nói rõ đây là dấu hiệu cần giáo viên xác minh.
2. **Gửi** — quản trị viên đọc lại, sửa được cả người nhận / tiêu đề / nội dung trong hộp thoại, rồi bấm *Gửi email*. Lúc đó `POST /api/admin/sessions/:sessionId/alert/send` mới gửi thật qua SMTP và ghi lại `{sentAt, to, recipients, homeroomTeacherEmail, subject, sentBy}` vào `alerts[]` của phiên. Lần sau mở lại, hộp thoại cảnh báo "phiên này đã gửi N lần" để tránh gửi trùng.

#### Ai nhận được email

Email đi tới **hai** địa chỉ:

| Người nhận | Khi nào |
|---|---|
| Địa chỉ ở ô "Gửi tới" (mặc định `ALERT_EMAIL_TO`) | **Luôn luôn** |
| Giáo viên chủ nhiệm của chính em đó | Khi ghép được theo trường + lớp (xem mục 8) |

Chưa ghép được — lớp chưa có tài khoản giáo viên được duyệt, hoặc em chưa khai lớp — thì email vẫn gửi bình thường tới một địa chỉ. **Không chặn việc gửi**: lớp chưa có giáo viên đăng ký là chuyện thường, và cảnh báo vẫn phải tới được bộ phận tư vấn.

Hộp thoại soạn email hiện sẵn tên và địa chỉ giáo viên sẽ nhận kèm, để quản trị viên **biết trước ai sẽ đọc** thay vì phát hiện sau khi đã bấm gửi. Địa chỉ đó **không sửa được từ giao diện** và được máy chủ tra lại lúc gửi — đây là dữ liệu nhạy cảm về một học sinh cụ thể, nên người nhận phải lấy từ tài khoản giáo viên đã duyệt chứ không phải từ một ô nhập của client. Hai địa chỉ trùng nhau thì tự gộp làm một (không phân biệt hoa/thường), không ai nhận hai bản.

#### Bước 1 — Tạo tài khoản Gmail để gửi

1. Vào [accounts.google.com/signup](https://accounts.google.com/signup), tạo tài khoản mới với tên người dùng `larryai.bluemoon` → email đầy đủ là `larryai.bluemoon@gmail.com`.
2. Đăng nhập vào tài khoản vừa tạo.

#### Bước 2 — Bật xác minh 2 bước (bắt buộc)

Google chỉ cho tạo App Password khi tài khoản đã bật 2FA.

1. Vào [myaccount.google.com/security](https://myaccount.google.com/security).
2. Mục **Xác minh 2 bước** → **Bắt đầu** → xác minh bằng số điện thoại.

#### Bước 3 — Tạo App Password (KHÔNG dùng mật khẩu Gmail thường)

1. Vào [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
2. Đặt tên app, ví dụ `Larry AI backend` → **Tạo**.
3. Google hiện chuỗi **16 ký tự** dạng `abcd efgh ijkl mnop` — copy ngay, đóng đi là không xem lại được.

> Không thấy mục App Passwords: kiểm tra lại 2FA đã bật chưa, và tài khoản không thuộc Google Workspace bị quản trị viên khoá tính năng này.

#### Bước 4 — Điền vào `backend/.env`

```bash
EMAIL_USER=larryai.bluemoon@gmail.com
EMAIL_APP_PASSWORD=abcd efgh ijkl mnop      # dán y nguyên, có dấu cách cũng được
ALERT_EMAIL_TO=26ai.longnh2@vinuni.edu.vn   # địa chỉ điền sẵn ô "Gửi tới"
# EMAIL_FROM_NAME=Larry AI — Tư vấn tâm lý học đường
# ALERT_MODEL=google/gemini-2.5-flash       # mặc định dùng chung SUMMARY_MODEL
```

Khởi động lại backend (`npm run dev` tự restart khi file đổi, nhưng `.env` thì phải chạy lại tay).

#### Bước 5 — Kiểm tra

```bash
cd backend
npm run test-email             # chỉ đăng nhập SMTP, KHÔNG gửi email nào
npm run test-email -- --send   # gửi thật 1 email thử tới ALERT_EMAIL_TO
```

Lệnh này ([test-email.js](backend/test-email.js)) in ra cấu hình đang đọc được và báo rõ đăng nhập Gmail thành công hay không, chạy lại bao nhiêu lần cũng được. Không cần khởi động backend.

Khi đã `✅`, vào `/admin` → **Hội thoại** của một học sinh → **✉️ Cảnh báo GVCN**. Sau vài giây AI soạn xong, đọc lại rồi bấm **Gửi email**, kiểm tra hộp thư `26ai.longnh2@vinuni.edu.vn` (ngó cả mục Spam ở lần gửi đầu).

| Lỗi hay gặp | Nguyên nhân |
|---|---|
| `Invalid login: 535-5.7.8 Username and Password not accepted` | Đang dùng mật khẩu Gmail thường thay vì App Password, hoặc gõ sai `EMAIL_USER` |
| `Chưa cấu hình EMAIL_USER / EMAIL_APP_PASSWORD` | Thiếu biến trong `.env`, hoặc chưa khởi động lại backend |
| `Không soạn được email` | Lỗi từ OpenRouter (hết credit / rate limit), bấm **Soạn lại** |
| Nút **Gửi email** bị mờ | `ready:false` — backend chưa gửi được, xem `error` ở `/api/admin/alert/config` |

Trường dùng mail server riêng thì đặt thêm `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE` để bỏ qua Gmail.

> Email chỉ chứa **tóm tắt và dấu hiệu**, không kèm nguyên văn lời học sinh — cùng nguyên tắc với `sessions.json`. Địa chỉ nhận hiện là địa chỉ mock cấu hình cứng trong `.env`; muốn mỗi lớp một GVCN khác nhau thì thêm field `teacherEmail` vào `profile` của học sinh rồi trả về trong bước soạn nháp.

---

## 9. Phiếu cảm xúc đầu phiên chat

Ngay khi vào giao diện chat, một pop-up hỏi lần lượt để Larry nắm được tình trạng cảm xúc trước khi trò chuyện ([CheckinModal.jsx](frontend/src/components/ui/CheckinModal.jsx), nội dung câu hỏi nằm ở [constants/checkin.js](frontend/src/constants/checkin.js)):

| Bước | Câu hỏi | Cách trả lời |
|---|---|---|
| 1 | Hãy chia sẻ cảm xúc của bạn với tôi để tôi có thể hỗ trợ bạn nhé! | Chọn *ngay lúc này* hoặc *tổng thể hôm nay* |
| 2 | Tiêu đề đổi theo bước 1: "Ngay lúc này bạn đang cảm thấy thế nào?" / "Chọn cảm giác tổng thể của bạn hôm nay" | Thanh trượt 5 mức: Rất khó chịu → Rất dễ chịu |
| 3 | Điều gì mô tả đúng nhất về cảm giác này? | Chọn **nhiều** từ + ô tự nhập. **Bỏ qua bước này nếu bước 2 chọn "Bình thường"**. Bộ từ đổi theo khó chịu/dễ chịu |
| 4 | Điều gì đang có tác động lớn nhất đối với sự *{cảm xúc}* của bạn? | Chọn **nhiều**: Sức khỏe / Gia đình / Bạn bè / Học tập / Thi cử + ô tự nhập |
| 5 | Hãy mô tả chi tiết hơn vì sao *{lí do}* lại làm cho bạn *{cảm xúc}* để Larry thấu hiểu bạn hơn nhé | Ô văn bản tự do (có thể bỏ trống) |

Kết quả được gửi kèm **mọi request `/chat`** trong phiên, backend ghép vào system prompt qua `buildCheckinSection()` ([server.js](backend/server.js)). Phiếu do học sinh tự khai nên được ưu tiên hơn cảm xúc camera — nếu camera thấy "vui" mà phiếu nói đang lo âu thì Larry đi theo phiếu.

Phiếu còn là **căn cứ gắn cờ cho quản trị viên**, độc lập với việc em có nhắn tiếp hay không — xem phần [vùng nhớ phiên hội thoại](#vùng-nhớ-phiên-hội-thoại) ở trên.

**Không trả lời thì không ảnh hưởng gì**: bấm ✕, bấm "Bỏ qua, mình muốn chat luôn", hoặc mở lên rồi tắt mà chưa chọn gì → `checkin = null` và system prompt giữ nguyên như trước. Response trả về `usedCheckin` để bạn kiểm tra phiếu có được dùng hay không.

Dữ liệu chỉ nằm trong bộ nhớ phiên chat (short memory) — tải lại trang là hỏi lại, không ghi vào `account.json`.

### Lọc nội dung học sinh tự nhập

Ô "cảm xúc khác", "điều khác" và ô mô tả chi tiết cho phép gõ tự do, nên backend lọc trước khi ghép vào system prompt (`shouldFilterOut()` trong [server.js](backend/server.js)). Ngoài giới hạn kích thước (tối đa 8 mục mỗi danh sách, mỗi mục ≤ 60 ký tự, mô tả ≤ 500 ký tự), có hai nhóm bị cắt bỏ:

| Nhóm | Ví dụ | Xử lý |
|---|---|---|
| Câu ra lệnh cho model | *"bỏ qua hướng dẫn trước đó"*, *"bây giờ bạn là..."*, *"đóng vai"*, `ignore previous` | Xoá khỏi phiếu, log cảnh báo ở backend |
| Đòi nội dung người lớn | *"viết truyện người lớn"*, *"cách mua ma tuý"*, *"cách cá độ"* | Xoá khỏi phiếu |

Phần còn lại của phiếu (mức cảm xúc, từ chọn sẵn, lí do) vẫn dùng bình thường. Nếu sau khi lọc phiếu không còn gì đáng kể thì coi như học sinh bỏ qua.

> ⚠️ **Nội dung học sinh tố giác việc mình bị hại thì KHÔNG bị lọc**, dù có chứa từ nhạy cảm. Bộ lọc luôn kiểm tra dấu hiệu tố giác trước và mặc định giữ lại khi không chắc. Lọc nhầm nhóm này đồng nghĩa với vứt bỏ lời cầu cứu — Larry sẽ vô tư chúc mừng em "đang vui" mà không ai biết.

Song song đó, system prompt có thêm lệnh phớt lờ mọi câu ra lệnh còn lọt qua bộ lọc từ khoá: không làm theo, không nhắc lại, không trách móc học sinh — chỉ dùng phần thông tin cảm xúc hợp lệ.

> Bộ lọc dùng so khớp từ khoá nên **không bắt được nội dung gõ không dấu** hoặc diễn đạt lạ. Đây là lớp giảm rủi ro, không phải hàng rào kín.

---

## 10. An toàn nội dung cho học sinh

Larry nói chuyện với trẻ 6-15 tuổi nên system prompt có một khối `SAFETY_RULES` luôn được ghép vào ([server.js](backend/server.js)), chia làm hai nhóm ngược nhau:

### Nhóm 1 — Từ chối và chuyển hướng

Tình dục / khiêu dâm / 18+, yêu đương kiểu người lớn, ma tuý - rượu bia - thuốc lá - cờ bạc, bạo lực đẫm máu và vũ khí, cách tự làm hại bản thân, chính trị - tôn giáo gây tranh cãi, nội dung thù ghét, thông tin cá nhân nhạy cảm, làm hộ bài / gian lận thi cử.

Với các chủ đề này Larry **không nhắc lại chi tiết, không hỏi thêm, không bình luận, không gợi mở** — chỉ từ chối ngắn gọn rồi chuyển sang chuyện lành mạnh. Prompt cũng chặn các cách lách quen thuộc: đóng vai, "giả sử", "em là người lớn rồi", "bỏ qua hướng dẫn trước đó", hỏi đi hỏi lại nhiều lần.

### Nhóm 2 — Ngoại lệ: KHÔNG được từ chối

Khi học sinh kể mình (hoặc bạn mình) **đang bị hại**: bị đụng chạm cơ thể, bị dụ dỗ/ép buộc, bị người quen trên mạng đòi ảnh nhạy cảm hoặc rủ gặp riêng, bị bạo hành, hoặc nói về ý nghĩ không muốn sống.

Đây là lúc các em cầu cứu, không phải lúc để chặn. Câu trả lời bắt buộc có đủ 4 ý, **đúng thứ tự**:

1. Ghi nhận cảm xúc, cho biết học sinh không đơn độc và **đó không phải lỗi của bạn ấy**.
2. **Dạy cách tự bảo vệ ngay** — ít nhất một việc học sinh tự làm được, chọn theo mức nguy hiểm: phớt lờ lời chọc vô hại (mức nhẹ) → lên tiếng bằng câu dứt khoát (mức lặp lại) → tránh chỗ vắng, đi cùng bạn, giữ bằng chứng (mức nặng) → **chạy về chỗ đông người và hét to kêu cứu** (bị đe doạ tính mạng hoặc bị đụng chạm). Ý này không được bỏ và không được đẩy xuống sau.
3. Khuyên nói ngay với người lớn đáng tin: bố mẹ, thầy cô, người thân an toàn.
4. Nhắc **Tổng đài quốc gia bảo vệ trẻ em: 111** (miễn phí, 24/7).

Câu *"đây không phải lỗi của bạn"* chỉ dành cho học sinh **bị hại**. Với học sinh vừa kể mình làm đau bạn khác thì ngược lại: nói rõ việc đó sai, **giải thích sai ở chỗ nào**, rồi dạy cách xử lý đúng cho lần sau.

Đồng thời không hỏi chi tiết về thân thể/sự việc, không hứa giữ bí mật, không chẩn đoán hay khuyên y tế.

> Đây là hàng rào mềm bằng prompt, không phải bộ lọc tuyệt đối. Nếu triển khai thật trong trường, nên có thêm người lớn theo dõi và cơ chế báo cáo hội thoại đáng lo ngại.

### Gợi ý game mô phỏng

Ngoài việc khuyên gọi 111 và nói với bố mẹ/thầy cô, Larry còn rủ học sinh **tập xử lý tình huống** bằng các kịch bản Scratch có sẵn (hằng `GAME_RULES` trong [server.js](backend/server.js)):

| Tình huống học sinh gặp | Kịch bản Larry gợi ý |
|---|---|
| Bị bắt nạt, trêu chọc, cô lập | Bắt nạt học đường |
| Căng thẳng, lo âu, cần bình tĩnh | Không gian an toàn cùng Larry |
| Ngại bắt chuyện, thấy cô đơn | Kết bạn mới |
| Chuyện buồn trong gia đình | Gia đình yêu thương |
| Sợ hãi, sợ thi cử | Vượt qua nỗi sợ |

Prompt liệt kê đúng 5 kịch bản này để Larry không rủ chơi game không tồn tại — **danh sách phải khớp với `DEFAULT_SCENARIOS` trong [ScratchGamePage.jsx](frontend/src/components/ui/ScratchGamePage.jsx)**, thêm kịch bản mới thì nhớ cập nhật cả hai nơi.

Quy tắc về thời điểm:

- **Không** gợi ý ngay ở câu trả lời đầu tiên khi em vừa kể chuyện buồn.
- **Bắt buộc** gợi ý khi em tỏ ra bí cách xử lý: *"em không biết phải làm gì"*, *"mai đến lớp em phải làm sao"*, *"em sợ gặp lại bạn ấy"*.
- Mỗi lần chỉ một kịch bản, rủ chứ không ép, em từ chối thì thôi.
- Với ca nguy hiểm: **luôn nói đủ 4 ý an toàn (không phải lỗi của bạn → cách tự bảo vệ → người lớn tin cậy → 111) TRƯỚC**, game chỉ là bước làm thêm và không bao giờ thay cho việc nhờ người lớn.

### Khi AI không hoạt động

App **không** trả lời thay LLM bằng cách dò từ khoá — cách đó dễ trả lời lệch ngữ cảnh và rủi ro với người dùng là học sinh. Thay vào đó cả backend lẫn frontend cùng hiển thị một thông báo:

```
Hệ thống AI hiện tại không hoạt động 😔
Bạn vui lòng tải lại ứng dụng và thử lại sau nhé.
Hoặc gửi email về cho chúng tôi ở lanmc2k13@gmail.com để phản hồi về tình trạng bạn gặp phải.
```

| Tình huống | Nơi xử lý |
|---|---|
| Chưa cấu hình `OPENROUTER_API_KEY` | [server.js](backend/server.js) — `SYSTEM_DOWN_MESSAGE` |
| Gọi OpenRouter thất bại (sai key, hết credit, 429, timeout, mất mạng) | [server.js](backend/server.js) — sau khi đã thử lại 1 lần |
| Không gọi được backend (server tắt, mất mạng) | [ChatBox.jsx](frontend/src/components/ui/ChatBox.jsx) — `systemMessages.js` |

Response vẫn là HTTP 200 kèm `fallback: true` và một field `warning` mô tả lỗi kỹ thuật (chỉ dành cho lập trình viên, không hiển thị cho học sinh). Xem `warning` hoặc log backend để biết nguyên nhân thật.

Đổi email hỗ trợ qua biến `SUPPORT_EMAIL` trong `backend/.env`, và sửa cùng lúc [frontend/src/constants/systemMessages.js](frontend/src/constants/systemMessages.js) để hai bên khớp nhau.

### Hạn mức lượt hỏi — 20 lượt / 10 phút cho mỗi tài khoản

Mỗi lượt chat là một chuỗi lời gọi model **có trả tiền** (supervisor đánh giá → agent trả lời → tóm tắt chạy nền), nên một em bấm gửi liên tục — hay một script gọi thẳng API — đốt tiền nhanh hơn nhiều so với một cuộc trò chuyện thật. [backend/rateLimit.js](backend/rateLimit.js) là cái phanh cho chuyện đó.

**Lượt Larry chào được miễn.** Mở khung chat là một lượt gọi model, nhưng nó không phải câu hỏi của học sinh — em vào chat, bấm sang trò chơi rồi quay lại, hay tải lại trang vì mạng chập chờn, thì 20 lượt hỏi của em vẫn còn nguyên. Hai loại lượt đó đếm bằng **hai túi riêng**:

| Túi | Là lượt nào | Trần |
|---|---|---|
| `turn` — **lượt hỏi** | `message` có chữ: em gõ một câu và gửi đi | 20 / 10 phút |
| `greeting` — **lượt chào** | `message` rỗng: mở màn hình chat, Larry nói trước | 6 / 10 phút, **đếm riêng** |

Hết lượt hỏi thì em vẫn **vào được khung chat và nghe Larry chào**; chỉ câu hỏi tiếp theo mới phải chờ. Ngược lại, dùng hết lượt chào cũng không mất câu hỏi nào.

Lượt chào vẫn có trần vì nó gọi supervisor + agent y hệt một câu hỏi — miễn hẳn thì chỉ cần gửi liên tục `message` rỗng là tiêu tiền không giới hạn, đúng cái mà hạn mức sinh ra để chặn. Sáu lần mở khung chat trong 10 phút gần như không bao giờ chạm tới khi dùng thật. Và việc phân loại đọc từ **nội dung** `message`, không từ một cờ do client tự khai (kiểu `greeting: true`) — cờ đó thì ai cũng đặt được cho mọi request, và cả hạn mức biến mất bằng một dòng JSON.

Chạm trần túi nào cũng nhận đúng một câu, **hiện thành bong bóng của Larry** như mọi câu khác:

> Bạn hãy thử lại sau **7** phút! Larry cần nghỉ ngơi một chút rồi mình cùng tiếp tục nói chuyện nhé!

Con số phút là **thật**, tính từ lúc lượt cũ nhất rời khỏi cửa sổ, nên nó đếm lùi dần chứ không đứng im ở "10 phút".

| Điều | Cách làm | Vì sao |
|---|---|---|
| Đếm theo **tài khoản** | Khoá là `user:<id>` lấy từ JWT | Đếm theo IP thì cả một phòng máy trong trường đi chung một địa chỉ — em đầu tiên dùng hết hạn mức của cả lớp. Khách chưa đăng nhập cũng có id riêng trong token nên mỗi phiên khách là một "tài khoản" độc lập. |
| **Cửa sổ trượt**, không phải cửa sổ cố định | Nhớ mốc thời gian của từng lượt | Cửa sổ cố định (đếm lại từ 0 mỗi 10 phút) cho phép dồn 20 lượt cuối cửa sổ này với 20 lượt đầu cửa sổ sau — 40 lượt trong chớp mắt, đúng thứ hạn mức sinh ra để chặn. |
| Chặn ở **máy chủ** | Middleware trước handler | Giao diện khoá nút gửi thì cũng chỉ là khoá ở trình duyệt; ai biết địa chỉ API vẫn gọi thẳng vào được. |
| **Lượt chào đếm riêng** | Túi `greeting`, nhận diện bằng `message` rỗng | Vào chat rồi quay lại không phải là một câu hỏi. Tính chung thì em bị cụt cuộc trò chuyện vì những việc mình không làm. |
| Không đụng `/api/session/end` | Chỉ gắn vào `/chat/stream` và `/chat` | Chốt phiên chạy một lần lúc học sinh rời màn hình. Chặn nó nghĩa là mất bản tóm tắt của **chính cuộc trò chuyện vừa chạm hạn mức** — mất đúng thứ giáo viên cần xem nhất. |

Response là **HTTP 429** kèm `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` và `X-RateLimit-Bucket` (đọc header cuối là biết ngay vì sao còn 19 lượt hỏi mà vẫn bị chặn):

```jsonc
{
  "error": "Bạn hãy thử lại sau 7 phút! Larry cần nghỉ ngơi một chút rồi mình cùng tiếp tục nói chuyện nhé!",
  "rateLimited": true,
  "retryAfterSeconds": 383,
  "retryAfterMinutes": 7,
  "bucket": "turn",          // "turn" = hết lượt hỏi, "greeting" = hết lượt chào
  "limit": 20,
  "windowMinutes": 10
}
```

Frontend ([useAgentStream.js](frontend/src/hooks/useAgentStream.js)) xử lý 429 **khác hẳn đường lỗi**: nó không hiện `SYSTEM_DOWN_MESSAGE` và không bật dải cảnh báo đỏ, mà đưa thẳng câu trên vào khung chat như lời Larry nói. Đây không phải hỏng hóc — thứ thật sự xảy ra chỉ là nghỉ giải lao.

```bash
# Thử nhanh: lượt thứ 21 trong 10 phút.
# message PHẢI có chữ — gửi rỗng là rơi vào túi lượt chào, đếm chỗ khác.
for i in $(seq 1 21); do
  curl -s -o /dev/null -w "$i → %{http_code}\n" -X POST http://localhost:5000/chat/stream \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"sessionId":"s","message":"xin chao"}'
done
# 1..20 → 200
# 21    → 429
```

Đổi mức bằng `CHAT_RATE_LIMIT_MAX` / `CHAT_RATE_LIMIT_WINDOW_MINUTES`, hoặc đặt `CHAT_RATE_LIMIT_MAX=0` để tắt hẳn (chỉ nên làm ở máy cá nhân lúc chạy thử). Trạng thái hiện ở log lúc khởi động và ở `/api/health`.

Phần đếm có bài kiểm tra riêng, chạy bằng bộ test có sẵn của Node (**không thêm thư viện nào**):

```bash
cd backend
npm run test:ratelimit     # 8 bài: đếm đúng số lượt, cửa sổ trượt, hai tài khoản tách nhau,
                           #        lượt chào không ăn vào lượt hỏi, câu báo hết lượt
```

> Khách chưa đăng nhập có một **chỗ hở đã biết**: id của khách sinh mới mỗi lần bấm "Trò chuyện ngay", nên bấm lại là có hạn mức mới. Tài khoản có đăng nhập thì không — id nằm trong `account.json` và không đổi. Ai lo tiền thật thì tắt chế độ khách trong trang quản trị.

> **Chạy nhiều instance thì sao?** Bộ đếm nằm trong bộ nhớ tiến trình, nên mỗi instance đếm riêng — hạn mức thật sẽ thành `20 × số instance`. Render gói free chạy đúng một instance nên không ảnh hưởng; khi nào bật autoscale thì phải thay `Map` trong `rateLimit.js` bằng Redis. Khởi động lại cũng xoá bộ đếm — đánh đổi có chủ ý, nhẹ hơn nhiều so với ghi đĩa ở mọi lượt chat.

---

## 11. Trang giới thiệu công khai

Đường dẫn **`/gioi-thieu`** — ai mở cũng xem được, **không cần đăng nhập**. Nó nằm *song song* với `/login` chứ không nằm sau: thanh điều hướng ở đầu trang có nút sang đăng nhập, và trang đăng nhập có đường về giới thiệu. Người đã đăng nhập quay lại đọc lúc nào cũng được — route này cố ý **không** đá ai đi chỗ khác.

Nội dung: Larry là gì · vấn đề của học sinh · mục tiêu dự án · đối tượng sử dụng · hướng dẫn 5 bước · **đồ thị kho tri thức** · đội ngũ phát triển (4 bạn học sinh lớp 8T1.1, THCS Đoàn Thị Điểm).

> Tên bốn thành viên chưa được điền — mảng `TEAM` ở đầu [AboutPage.jsx](frontend/src/components/ui/AboutPage.jsx) đang để `name: ""` nên thẻ hiện "Thành viên 1…4". Điền tên vào là xong, không phải sửa gì khác.

### Đồ thị kho tri thức

Phần cuối trang vẽ **toàn bộ kho tri thức Larry truy vấn** thành một đồ thị bấm được: 133 mẩu tri thức, 195 mối liên hệ, lấy từ `GET /api/knowledge/graph` ([publicView.js](backend/knowledge/publicView.js)). Bấm vào một chấm để đọc nội dung mẩu đó cùng những cụm từ khiến nó được lấy ra; bấm vào một đường nối để xem mối liên hệ và chỗ nó được rút ra trong tài liệu gốc.

**Vẽ bằng SVG, không thêm thư viện đồ thị nào.** Ở cỡ 133 node, bố cục lực tự viết ([forceLayout.js](frontend/src/utils/forceLayout.js)) chạy hết 22ms — rẻ hơn hẳn việc kéo về vài trăm KB `d3`, và đổi lại là toàn quyền với nhãn tiếng Việt, hình dạng theo nhóm và chế độ xem dạng bảng. Bố cục **tất định**: mở lại trang ra đúng hình cũ, không phụ thuộc số ngẫu nhiên.

**Màu:** 16 loại node được gom thành **4 nhóm chức năng**, vì một bảng màu phân loại đọc được chỉ chịu nổi tối đa 8 màu — và với đồ thị mạng, nơi node nào cũng có thể nằm cạnh node nào, giới hạn thực tế còn thấp hơn. Bốn màu đã chạy qua bộ kiểm tra bảng màu (mọi cặp, nền sáng): tách bạch với mắt người mù màu ở ΔE 9.2, đạt ngưỡng ≥8.

| Nhóm | Trả lời câu hỏi | Hình | Gồm |
|---|---|---|---|
| Dấu hiệu & bằng chứng | Em đang có biểu hiện gì? | ▲ | Sign · RiskFactor · Stat · Case |
| Khái niệm | Chuyện đó gọi là gì? | ● | Concept · ViolenceType · Function · RiskLevel |
| Hành động | Làm gì bây giờ? | ■ | Protocol · Step · Skill · Method · Script |
| Ranh giới & hỗ trợ | Không được làm gì, cầu cứu ai? | ◆ | Principle · Taboo · Hotline |

Màu xanh ngọc của nhóm *Hành động* có độ tương phản 2.74:1 trên nền trắng, dưới mức 3:1, nên nó **không bao giờ đứng một mình**: mỗi nhóm còn mang một **hình dạng** riêng, luôn có nhãn chữ đi kèm, và cả đồ thị có nút **“Xem dạng bảng”** liệt kê đủ mọi mẩu bằng chữ. Nhận ra nhóm không phụ thuộc vào việc phân biệt được màu.

Cạnh **không** tô theo loại quan hệ: 13 loại mà mỗi loại một màu thì đồ thị thành cầu vồng. Cạnh là cấu trúc chứ không phải phân loại — nó dùng một màu xám lùi về sau, tên quan hệ hiện ra khi bấm vào.

> Vì sao dữ liệu này công khai được: đây là tài liệu tham khảo chuyên môn về tâm lý học đường, **không có một dòng nào của học sinh** trong đó. Hội thoại của các em nằm ở `sessions.json` và không có đường nào từ endpoint này tới đó.

---

## 12. Nói chuyện bằng giọng nói (micro + loa)

Ngoài gõ chữ, học sinh **bấm nút micro để nói**, và câu trả lời của Larry vừa hiện chữ vừa **đọc lên loa**. Hai chiều dùng hai model riêng, khai trong `backend/.env`:

```env
STT_MODEL=nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b   # 🎤 nghe
TTS_MODEL=google/gemini-3.1-flash-tts-preview                   # 🔊 nói
TTS_VOICE=Kore                                                  # giọng của Larry
STT_LANGUAGE=vi
```

### Luồng chạy

```
🎤 Học sinh bấm micro
   → MediaRecorder thu (webm/opus, mp4/aac... tuỳ trình duyệt)
   → utils/audio.js giải mã rồi mã hoá lại thành WAV 16kHz mono
   → POST /api/voice/stt  →  STT_MODEL  →  { text }
   → runTurn(text)  ── ĐÚNG đường mà tin nhắn gõ tay đi ──→  /chat/stream
                                                                  ↓
🔊 Larry trả lời — chữ chảy về tới đâu, câu nào xong thì đọc tới đó
   → speechChunks.js cắt theo câu
   → POST /api/voice/tts (song song tối đa 3 đoạn)  →  TTS_MODEL  →  PCM 24kHz
   → backend bọc header WAV  →  phát nối tiếp từng đoạn ra loa
```

### Vì sao phải cắt câu ra đọc

Endpoint `/audio/speech` trả về **nguyên cục** — không một mẫu âm thanh nào phát được cho tới khi mẫu cuối cùng sinh xong. Đo trên model đang dùng:

| | Thời gian tới lúc tiếng bắt đầu vang |
|---|---|
| Gửi cả đoạn trả lời (236 ký tự) | **12,8 – 17,4 giây** |
| Chỉ gửi câu đầu (26 ký tự) | **2,6 – 3,3 giây** |

Nên thay vì một lời gọi cho cả bài, [useSpeaker.js](frontend/src/hooks/useSpeaker.js) cắt theo câu và chạy dây chuyền: câu đầu vừa hoàn chỉnh trong luồng token là đem đi sinh tiếng ngay (không đợi Larry viết xong), phát luôn, rồi sinh các đoạn sau trong lúc đoạn trước đang đọc. Tải trước tối đa 3 đoạn song song để đoạn sau có sẵn đúng lúc đoạn trước hết.

Cắt theo **câu** chứ không theo số ký tự: mỗi lần gọi TTS là một lần model đặt ngữ điệu cho trọn vẹn thứ nó nhận được, cắt giữa câu thì nửa đầu xuống giọng như đã hết ý. Câu ngắn dưới 60 ký tự được gom với câu sau (trừ câu đầu tiên — nó được ưu tiên phát sớm); câu dài quá 240 ký tự mà chưa có dấu chấm thì cắt ở dấu phẩy gần nhất.

> Đánh đổi: mỗi đoạn được sinh độc lập nên ngữ điệu **giữa các câu** phẳng hơn so với đọc liền một mạch, và lúc model chậm bất thường (đo được những cú vọt lên 20 giây) vẫn có thể hở một quãng giữa hai đoạn. Đổi lại là bớt được ~10 giây im lặng ở đầu mỗi lượt.

Máy trạng thái của hàng đợi có bộ test riêng: `npm test -- --testPathPattern=useSpeaker` ([useSpeaker.test.js](frontend/src/hooks/useSpeaker.test.js)) — kiểm tra đọc đủ không sót/không lặp, phát tuần tự không chồng tiếng, bỏ qua đoạn hỏng, và `stop()` thu hồi hết URL tạm.

Điểm quan trọng: **giọng nói không phải một luồng thứ hai**. Lời nói sau khi thành chữ đi qua đúng `runTurn` mà ô gõ vẫn dùng — cùng `sessionId`, cùng cảm xúc camera, cùng phiếu check-in. Hệ multi-agent không biết (và không cần biết) em vừa gõ hay vừa nói.

### Giao diện

| Nút | Trạng thái | Ý nghĩa |
|---|---|---|
| 🎤 | bình thường | Bấm để bắt đầu nói |
| ⏹️ đỏ, đập nhịp | đang thu | Micro đang bật — bấm lần nữa để gửi |
| vòng xoay | đang nhận dạng | Đã thu xong, chờ model đọc ra chữ |
| 🔇 | **mặc định** | Loa TẮT sẵn — chưa bấm thì **không lời gọi TTS nào được phát đi** |
| 🔊 / 🔇 | ở đầu khung chat, và ở trang đăng nhập | Tắt/bật tiếng Larry, nhớ lại ở lần vào sau |
| 🔊 + cột sóng | **loa đang phát** | Dải "Larry đang nói..." hiện dưới bong bóng cuối, tự tắt khi đọc xong |

Dải báo đang nói ([SpeakingIndicator.jsx](frontend/src/components/ui/SpeakingIndicator.jsx)) cố ý dùng **cột sóng nhấp nhô**, khác với **ba chấm nảy** của lúc Larry đang nghĩ — chữ đã hiện đủ trên màn hình rồi, thứ đang chạy là tiếng nói, hai trạng thái đó không được lẫn vào nhau. Nó lấy màu theo trợ lý đang trả lời, và đứng yên nếu hệ điều hành bật `prefers-reduced-motion`.

- Bấm micro thì Larry **im ngay** — micro đang mở mà loa còn đọc thì đoạn thu dính giọng Larry và model sẽ chép lại chính lời của nó.
- Đang thu hoặc đang nhận dạng thì **khoá ô gõ**: hai đường nhập cùng đổ vào một lượt chat.
- Câu vừa nhận dạng **hiện lên thành bong bóng của học sinh** trước khi Larry trả lời — nghe nhầm thì em thấy ngay và nói lại được.
- Tự dừng thu sau 60 giây; đoạn thu ngắn dưới nửa giây bị bỏ qua kèm lời nhắc (bấm nhầm là chuyện thường xuyên với học sinh nhỏ).

### Loa mặc định TẮT — và tắt nghĩa là không tốn tiền

Mỗi câu Larry nói là **một lần gọi model TTS có tính phí**, trong khi phần lớn học sinh ngồi trong lớp hoặc dùng máy không loa thì cũng không nghe. Bật sẵn cho tất cả nghĩa là trả tiền cho phần đông những người không dùng tới, nên mặc định là **tắt**:

```
Chưa bấm nút loa  →  useSpeaker.feed() dừng ngay ở dòng đầu
                  →  không cắt câu, không gọi /api/voice/tts, không sinh byte âm thanh
                  →  hoá đơn TTS của lượt chat đó = 0
```

Đây là **không gọi model**, không phải "gọi rồi hạ âm lượng xuống 0" — có một bài test giữ đúng điều đó ([useSpeaker.test.js](frontend/src/hooks/useSpeaker.test.js): *"mặc định là tắt tiếng — chưa ai bấm nút thì không gọi API"*).

Nút loa đứng ở **hai nơi**:

| Nơi | Dáng | Vì sao ở đó |
|---|---|---|
| Trang đăng nhập | Khối rộng có chữ *"Giọng nói của Larry — Đang tắt"* kèm công tắc | Mặc định tắt nên không có tiếng nào tự vang lên để gợi ý rằng Larry biết nói. Bật từ đây thì **lời chào đầu tiên đã có tiếng** — bật lúc Larry đang chào thì câu đó đã trôi qua rồi. |
| Đầu khung chat | Nút tròn 🔊/🔇 cạnh tên Larry | Đổi ý giữa chừng: đang nghe mà vào lớp thì bấm một cái là Larry **im ngay**, không đọc nốt đoạn đang dở. |

Hai nút đó là **một lựa chọn duy nhất**, không phải hai công tắc rời. Chúng nằm ở hai trang không có tổ tiên chung trong cây React (`/login` và `/chat`), nên state của React không nối được — chỗ chung là `localStorage` cộng một sự kiện để nơi này bấm thì nơi kia vẽ lại theo ([utils/voicePref.js](frontend/src/utils/voicePref.js)):

```
[nút ở trang đăng nhập] ──┐                 ┌──> [nút ở khung chat]
                          ├─> localStorage ─┤
[nút ở khung chat] ───────┘   + sự kiện     └──> [useSpeaker: gọi/không gọi TTS]
```

Lựa chọn được **nhớ lại giữa các lần vào app**, và mở app ở hai tab cũng không lệch trạng thái (nghe cả sự kiện `storage` của trình duyệt). Trang đăng nhập biết có nên vẽ nút hay không nhờ `/api/settings` — đường **công khai**, trả về đúng hai giá trị đúng/sai `{ stt, tts }`, không lộ tên model hay khoá API. Backend chưa khai `TTS_MODEL` thì nút không hiện ở cả hai nơi.

Nút 🔇 này là lựa chọn của **từng học sinh**. Trên nó còn một công tắc nữa của **quản trị viên** — tắt là cả trường thôi đọc thành tiếng, để tiết kiệm token (xem *Hai công tắc hệ thống* ở mục 8). Hai thứ độc lập: quản trị viên tắt thì nút 🔇 không còn được vẽ ra nữa.

### Thiếu cấu hình thì sao?

Giọng nói là tính năng **thêm vào**, không phải điều kiện để chat chạy:

| Tình huống | Kết quả |
|---|---|
| Bỏ trống `STT_MODEL` | Nút micro **không hiện ra** (không phải hiện rồi bấm vào báo lỗi) |
| Bỏ trống `TTS_MODEL` | Không có nút loa, Larry chỉ hiện chữ |
| Bỏ trống cả hai | App chạy **y hệt** bản chưa có giọng nói |
| Học sinh không cấp quyền micro | Câu nhắc ngay cạnh nút micro, ô gõ vẫn dùng bình thường |

Hai model này **không rơi về `CHAT_MODEL`** như các model khác: model chat nhận chữ trả chữ, còn hai model này nhận/trả âm thanh — rơi về sẽ thành lỗi khó hiểu ở tận trong lời gọi API. Frontend hỏi `/api/voice/config` lúc mở khung chat để biết vẽ nút nào.

### Kiểm tra nhanh

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"0912345678","password":"123456"}' | jq -r .token)

# Larry đọc một câu ra file WAV
curl -s -X POST http://localhost:5000/api/voice/tts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"Chào bạn, mình là Larry nhé!"}' -o larry.wav

# Gửi ngược file đó lên để xem model nghe ra gì
curl -s -X POST http://localhost:5000/api/voice/stt \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: audio/wav" \
  --data-binary @larry.wav
# → {"text":"Chào bạn, mình là Larry nhé.","seconds":3.84}
```

> Trình duyệt chỉ cho phép dùng micro trên `localhost` hoặc **HTTPS** — giống hệt webcam. Deploy lên HTTP thuần thì nút micro hiện nhưng xin quyền sẽ bị chặn.

### Khối góp ý ở màn hình chat

Cột trái màn hình chat có một khối nhỏ **💌 Góp ý cho Larry** với hai đường link, đọc từ `backend/.env`:

```env
STUDENT_FEEDBACK_FORM=https://docs.google.com/forms/d/.../viewform
TEACHER_FEEDBACK_FORM=https://docs.google.com/forms/d/.../viewform
```

Cả hai link đều **hiện đầy đủ địa chỉ** và mở ra **tab mới** khi bấm (`target="_blank"` kèm `rel="noopener noreferrer"`) — khung chat có thể đang giữa cuộc trò chuyện, điều hướng đi chỗ khác sẽ chốt phiên và mất mạch nói chuyện của em. Bỏ trống cả hai biến thì khối này không hiện ra; backend không chạy được cũng vậy, nó lặng lẽ ẩn đi thay vì bày một dòng lỗi đỏ giữa màn hình của học sinh.

---

## 13. Đổi model AI

Hệ thống gọi LLM ở **nhiều chỗ, mỗi chỗ một biến riêng** trong `backend/.env` — đổi cái nào chỉ ảnh hưởng đúng phần đó. **Không có tên model nào ghi trong mã nguồn**: [backend/models.js](backend/models.js) là nơi duy nhất đọc các biến này. Sửa xong khởi động lại backend, log khởi động in nguyên bảng agent → model để bạn kiểm tra:

| Tác vụ | Biến | Chạy ở | Gợi ý chọn |
|---|---|---|---|
| Model nền cho mọi thành phần | `CHAT_MODEL` | [agents/llm.js](backend/agents/llm.js) | Gọi nhiều nhất → ưu tiên nhanh & rẻ |
| 🧭 Điều phối: đánh giá, phân nhóm | `SUPERVISOR_MODEL` | [agents/supervisor.js](backend/agents/supervisor.js) | Phân nhóm sai thì cả lượt sai → nâng trước tiên |
| 🛟 Đồng hành (tự hại) | `AGENT_SELF_HARM_MODEL` | [nodes/agentNode.js](backend/agents/nodes/agentNode.js) | Rủi ro cao nhất → nên khá hơn model nền |
| 🛡️ Bảo vệ (nạn nhân) | `AGENT_VICTIM_MODEL` | như trên | |
| 🧩 Thấu hiểu (người gây bạo lực) | `AGENT_ACTOR_MODEL` | như trên | Dễ hỏng nhất về giọng điệu |
| 🍎 Cô giáo (thường ngày) | `AGENT_HOMEROOM_MODEL` | như trên | Chạy nhiều nhất → ưu tiên rẻ |
| Tóm tắt + chấm mức độ nguy cơ | `SUMMARY_MODEL` | [summarizer.js](backend/summarizer.js) | Quyết định có gắn cờ hay không → nên khá hơn model chat |
| Soạn email cảnh báo GVCN | `ALERT_MODEL` | [alertEmail.js](backend/alertEmail.js) | Văn bản gửi ra ngoài cho giáo viên → nên khá hơn model chat |
| 🎤 Nghe tiếng nói học sinh | `STT_MODEL` | [voice.js](backend/voice.js) | Model **nhận âm thanh** (xem mục 12), không rơi về `CHAT_MODEL` |
| 🔊 Đọc câu trả lời lên loa | `TTS_MODEL` | [voice.js](backend/voice.js) | Model **trả về âm thanh**, không rơi về `CHAT_MODEL` |

Biến của một thành phần bỏ trống thì rơi về `CHAT_MODEL`. Ví dụ nâng riêng hai chỗ quan trọng nhất, phần còn lại giữ nguyên model rẻ:

```env
CHAT_MODEL=google/gemini-2.5-flash-lite       # nhanh, rẻ — nền cho mọi agent
SUPERVISOR_MODEL=google/gemini-2.5-flash      # phân nhóm chuẩn hơn
AGENT_SELF_HARM_MODEL=google/gemini-2.5-flash # ca rủi ro cao nhất
SUMMARY_MODEL=google/gemini-2.5-flash         # cân bằng
ALERT_MODEL=google/gemini-2.5-pro             # kỹ hơn cho văn bản đối ngoại
```

Đổi sang nhà cung cấp khác cũng chỉ là đổi chuỗi, vì cả ba đều đi qua OpenRouter: `anthropic/claude-sonnet-4.5`, `openai/gpt-4o-mini`, ... Danh sách đầy đủ ở [openrouter.ai/models](https://openrouter.ai/models).

Kiểm tra nhanh model nào đang chạy: `curl -s http://localhost:5000/api/health` → `{ chatModel, supervisorModel, agentModels, summaryModel, alertModel, sttModel, ttsModel, missingModelConfig }`.

Phần gọi AI của Larry nằm trong `requestOpenRouter` ([server.js](backend/server.js)) — đúng chuẩn `POST /chat/completions` của OpenRouter, tự thử lại 1 lần khi gặp lỗi 429/503/timeout. Prompt của Larry ở `buildSystemPrompt` và `buildUserPrompt` trong cùng file.

---

## 14. Build production

```bash
cd frontend
npm run build      # kết quả trong frontend/build/
```

- **Frontend**: repo đã có sẵn [netlify.toml](netlify.toml) (base `frontend`, publish `build`). Nhớ khai báo `REACT_APP_API_URL` trong phần environment variables của Netlify, trỏ về backend đã deploy.
- **Backend**: deploy `backend/` lên Render/Railway/VPS với lệnh `npm start`, và khai báo `OPENROUTER_API_KEY`, `JWT_SECRET`, `CHAT_MODEL` (bắt buộc — không có giá trị mặc định trong code), các biến model của từng agent nếu muốn tách, `SUMMARY_MODEL`, `ALERT_MODEL`, cùng `EMAIL_USER` / `EMAIL_APP_PASSWORD` / `ALERT_EMAIL_TO` trong environment variables của nền tảng đó. Muốn có giọng nói thì thêm `STT_MODEL` và `TTS_MODEL` — bỏ trống thì app vẫn chạy, chỉ không có micro và loa.

> ⚠️ Render/Railway gói free dùng ổ đĩa tạm — `account.json` sẽ bị xoá mỗi lần deploy lại hoặc khi dịch vụ ngủ dậy. Muốn giữ tài khoản trên server thật thì gắn persistent disk rồi trỏ `ACCOUNTS_FILE` vào đó, hoặc chuyển hẳn sang database.

### Deploy lên Render — mấy chỗ dễ vấp

| Chỗ | Cần gì |
|---|---|
| **Lệnh chạy** | Root directory `backend`, build `npm install`, start `npm start`. Không thêm thư viện nào mới cho hạn mức lượt hỏi — nó tự viết bằng một `Map`, nên `npm install` không đổi gì. |
| **`PORT`** | **Đừng khai.** Render tự tiêm; code đọc `process.env.PORT` rồi mới rơi về 5000. |
| **Reverse proxy** | Đã bật sẵn `app.set("trust proxy", 1)` trong [server.js](backend/server.js). Thiếu dòng này thì mọi request đều mang địa chỉ của proxy Render, và cookie `secure` không nhận ra kết nối gốc là HTTPS. Tin **đúng một tầng** chứ không tin tất cả — tin tất cả thì ai gửi kèm `X-Forwarded-For` giả cũng tự chọn được địa chỉ cho mình. |
| **SSE không bị đệm** | Route `/chat/stream` đã gửi `X-Accel-Buffering: no` kèm 2KB đệm mở đầu — proxy của Render đệm response theo mặc định, thiếu hai thứ đó thì cả lượt trả lời về thành một cục. |
| **Hạn mức lượt hỏi** | Chạy được ngay, không cần khai gì (mặc định 20 lượt / 10 phút). Chỉ khai `CHAT_RATE_LIMIT_MAX` / `CHAT_RATE_LIMIT_WINDOW_MINUTES` khi muốn đổi mức. Bộ đếm nằm trong bộ nhớ nên dịch vụ ngủ dậy là xoá sạch — xem lưu ý ở mục 10. |
| **Nút loa** | Trang đăng nhập hỏi `/api/settings` để biết có vẽ nút không, mà `REACT_APP_API_URL` của frontend phải trỏ đúng backend đã deploy. Trỏ sai thì nút loa lẫn nút "Trò chuyện ngay" đều không hiện — không phải lỗi cấu hình model. |
| **Giọng nói cần HTTPS** | Micro chỉ chạy trên `localhost` hoặc HTTPS. Render cấp HTTPS sẵn nên chỗ này không phải làm gì. |

Kiểm lại sau khi deploy — một lệnh là thấy đủ:

```bash
curl -s https://<backend-cua-ban>.onrender.com/api/health | jq '{apiKey, voice, rateLimit}'
# {
#   "apiKey": "loaded",
#   "voice": { "stt": true, "tts": true, "voice": "Kore", "language": "vi" },
#   "rateLimit": { "enabled": true, "maxTurns": 20, "windowMinutes": 10, "tracked": 0 }
# }

curl -s https://<backend-cua-ban>.onrender.com/api/settings
# {"guestMode":true,"voice":{"stt":true,"tts":true}}   ← trang đăng nhập đọc đúng cái này
```

---

## 15. Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Log ghi `OPENROUTER_API_KEY: MISSING ✗` | Chưa có `backend/.env` hoặc sai tên biến. Chạy backend từ đúng thư mục `backend/`. |
| Larry luôn trả lời chung chung, response có `fallback: true` | Key sai/hết hạn, hết credit, hoặc tên model không tồn tại. Xem log backend để biết lỗi cụ thể từ OpenRouter. |
| `401 Access token required` khi chat | Chưa đăng nhập hoặc token đã hết hạn (7 ngày). Đăng nhập lại. |
| `Không lưu được tài khoản` khi đăng ký | Không ghi được `backend/account.json` — kiểm tra quyền ghi thư mục `backend/`. |
| Gõ đúng mật khẩu nhưng vẫn báo sai, sau khi sửa tay `account.json` | Field `password` đang là chữ thường chứ không phải hash bcrypt. **Khởi động lại backend** — nó sẽ tự hash lại. Sửa file lúc backend đang chạy cũng không có tác dụng vì danh sách tài khoản chỉ được đọc lúc khởi động. |
| Chat báo "Larry không kết nối được server" | Backend chưa chạy, hoặc `REACT_APP_API_URL` sai. Kiểm tra `curl http://localhost:5000/api/health`. |
| Camera không hiện | Chưa cấp quyền camera, hoặc đang mở qua IP/HTTP thay vì `localhost`. |
| Không thấy nút micro 🎤 | Chưa khai `STT_MODEL` trong `backend/.env`, hoặc thiếu API key. Kiểm tra: `curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/voice/config`. |
| Larry không đọc thành tiếng | Chưa khai `TTS_MODEL`, **quản trị viên đang tắt giọng đọc** ở trang `/admin`, đang bật 🔇, hoặc trình duyệt chặn tự phát tiếng khi chưa bấm vào trang lần nào (bấm một cái là mở khoá). Kiểm tra: `curl http://localhost:5000/api/settings` — `ttsEnabled` là công tắc quản trị, `voice.tts` là trạng thái hiệu lực. |
| Bấm micro báo "chưa cho phép dùng micro" | Chưa cấp quyền micro, hoặc đang mở qua IP/HTTP thay vì `localhost`/HTTPS. |
| Nhận dạng ra chữ sai nhiều | Đặt `STT_LANGUAGE=vi`, thu ở nơi bớt ồn, và nói cách micro khoảng một gang tay. |
| Nhận diện cảm xúc không chạy | Thiếu model trong `frontend/public/models/` — cần đủ 4 file `tiny_face_detector_*` và `face_expression_*`. |
| `Port 5000 already in use` | Đổi `PORT` trong `backend/.env` và sửa `REACT_APP_API_URL` tương ứng. |

---

## 16. Điều khoản & Chính sách bảo mật

Hai văn bản nằm ở **[backend/documents/](backend/documents/)** dưới dạng `.txt` thuần:

| File | Slug | Hiện ở đâu |
|---|---|---|
| [dieukhoan.txt](backend/documents/dieukhoan.txt) | `dieu-khoan` | Link "Điều khoản" ở dòng đồng ý của form đăng ký |
| [chinhsachbaomat.txt](backend/documents/chinhsachbaomat.txt) | `chinh-sach-bao-mat` | Link "Chính sách bảo mật" ngay cạnh |

Bấm vào link sẽ mở hộp thoại ([LegalModal.jsx](frontend/src/components/ui/LegalModal.jsx)) đọc nội dung qua `GET /api/documents/:slug`, **không điều hướng đi đâu** nên học sinh không mất phần đã điền trong form. Đóng bằng nút ✕, nút "Đã hiểu", phím Esc hoặc bấm ra ngoài.

**Sửa nội dung**: mở thẳng file `.txt` và sửa, lưu là xong — không cần build lại frontend, chỉ cần backend đọc lại file ở request kế tiếp. Nhớ cập nhật dòng "Cập nhật lần cuối" ở đầu văn bản.

**Thêm văn bản mới**: thêm file vào `backend/documents/`, khai thêm một dòng vào hằng `DOCUMENTS` trong [server.js](backend/server.js). Danh sách này là danh sách trắng cố định — tên file **không** ghép từ URL, nên không thể lợi dụng đường dẫn để đọc file khác trên máy chủ (`/api/documents/../.env` trả về 404).

> Nội dung hiện tại mô tả đúng cách hệ thống đang xử lý dữ liệu (không lưu nguyên văn hội thoại, camera xử lý tại máy, có gắn cờ và gửi cảnh báo cho GVCN). Đây là văn bản cho dự án học đường — trước khi triển khai thật, nhà trường nên rà soát lại và bổ sung tên đơn vị chịu trách nhiệm.

---

## 17. Lưu ý bảo mật

- `backend/.env` và `frontend/.env` đã được `.gitignore` — **không commit API key lên git**.
- `backend/account.json` chứa số điện thoại, email, hash mật khẩu và thông tin trường lớp của học sinh — đã được `.gitignore`, nhớ backup và phân quyền file cẩn thận. Số điện thoại của học sinh là dữ liệu cá nhân, đừng để lọt ra ngoài cùng bản backup.
- Không còn tài khoản admin mặc định trong mã nguồn. Quyền quản trị chỉ cấp được bằng `npm run create-admin` chạy trực tiếp trên máy chủ — ai truy cập được máy chủ thì cấp được quyền admin, nên hãy bảo vệ quyền truy cập đó.
- Cách lưu bằng file JSON phù hợp cho lớp học/demo. Khi số tài khoản lớn hoặc chạy nhiều instance backend cùng lúc thì nên chuyển sang database (SQLite/Postgres).
- Đổi `JWT_SECRET` trước khi deploy.
- `EMAIL_APP_PASSWORD` là chìa khoá gửi thư dưới danh nghĩa nhà trường — giữ như API key: chỉ nằm trong `.env`, không commit, lộ thì vào [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) thu hồi và tạo lại. Chỉ quản trị viên gọi được hai endpoint `alert/draft` và `alert/send`.
