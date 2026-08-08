# Larry AI

Larry là chatbot đồng hành cảm xúc dành cho học sinh tiểu học và THCS.

Webcam nhận diện cảm xúc của học sinh ngay khi mở app (vui, buồn, tức giận, lo lắng...), sau đó Larry chủ động mở lời bằng tiếng Việt, lắng nghe và trò chuyện. Khi cuộc trò chuyện phù hợp, Larry gợi ý chơi một game Scratch nhỏ để thư giãn.

- **Frontend**: React 19 (Create React App) + `face-api.js` để nhận diện cảm xúc ngay trên trình duyệt.
- **Backend**: Express 5 + JWT auth, gọi model AI qua **OpenRouter**.
- **Hệ multi-agent**: một Supervisor phân nhóm trường hợp rồi giao cho **đúng 1** trong 4 agent chuyên trách (nhóm ưu tiên cao nhất thắng), chạy trên **LangGraph.js**. Kiến trúc và luồng chi tiết: **[LARRY.md](LARRY.md)**.
- **Khi AI lỗi**: nếu không có API key hoặc không gọi được OpenRouter, app **không tự bịa câu trả lời** mà báo rõ hệ thống đang không hoạt động ([backend/fallback.js](backend/fallback.js)).

---

## 1. Yêu cầu

| Thành phần | Phiên bản |
|---|---|
| Node.js | **18 trở lên** (backend dùng `fetch` có sẵn của Node) |
| npm | 9 trở lên |
| Trình duyệt | Chrome/Edge/Firefox có webcam |

Một tài khoản [OpenRouter](https://openrouter.ai) để lấy API key.

> Trình duyệt chỉ cho phép truy cập webcam trên `localhost` hoặc HTTPS. Chạy local qua `http://localhost:3000` là được.

---

## 2. Cấu trúc thư mục

```
Larry-AI/
├── backend/              # API Express
│   ├── server.js         # Auth (register/login/me) + khu vực quản trị + documents
│   ├── auth.js           # JWT + middleware phân quyền
│   ├── routes/chat.js    # /chat/stream (SSE), /chat, /api/session/end
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
│       ├── hooks/          # useAgentStream — đọc luồng SSE của hệ agent
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
| `OPENROUTER_MODEL` | – | – | Tên **cũ** của `CHAT_MODEL`, chỉ dùng khi `CHAT_MODEL` không có. |
| `PORT` | – | `5000` | Cổng backend. Trên Render/Railway thì **đừng đặt** — nền tảng tự tiêm. |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | – | Tự tạo quản trị viên lúc khởi động, dùng khi nơi deploy không mở được terminal. |
| `JWT_SECRET` | – | chuỗi dev mặc định | Khoá ký JWT. **Bắt buộc đổi khi deploy thật.** |
| `OPENROUTER_BASE_URL` | – | `https://openrouter.ai/api/v1` | Chỉ đổi khi dùng proxy tương thích OpenRouter. |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | – | `http://localhost:3000` / `Larry AI` | Gửi kèm request để OpenRouter thống kê app. |
| `ACCOUNTS_FILE` | – | `backend/account.json` | Nơi lưu danh sách tài khoản. |
| `SUMMARY_EVERY_N_MESSAGES` | – | `4` | Tóm tắt lại sau mỗi bao nhiêu tin nhắn mới. |
| `SESSIONS_FILE` | – | `backend/sessions.json` | Nơi lưu vùng nhớ phiên hội thoại. |
| `EMAIL_USER` / `EMAIL_APP_PASSWORD` | – | – | Tài khoản Gmail gửi email cảnh báo (xem mục 8). |
| `ALERT_EMAIL_TO` | – | – | Địa chỉ điền sẵn ở ô "Gửi tới" của email cảnh báo. |

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
   - **Đăng ký** / **Đăng nhập** với dropdown **"Bạn là" → Người dùng** nếu muốn có tài khoản riêng. Đăng ký xong **quay về màn hình đăng nhập** (kèm thông báo thành công và email điền sẵn), chứ không vào thẳng chat.
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
| `POST` | `/api/register` | – | `{ username, email, password, profile }` → `{ user, message }`. **Không cấp token/cookie** — đăng ký xong phải đăng nhập |
| `POST` | `/api/login` | – | `{ email, password, role }` → `{ user, token }` |
| `POST` | `/api/guest` | – | Không cần body → `{ user, token }` cho chế độ khách (token hạn 1 ngày) |
| `POST` | `/api/logout` | – | Xoá cookie token |
| `GET` | `/api/me` | ✅ | Thông tin user hiện tại |
| `GET` | `/api/documents/:slug` | – | Điều khoản (`dieu-khoan`) / Chính sách bảo mật (`chinh-sach-bao-mat`) → `{ title, content }` |
| `GET` | `/api/agents` | – | Danh sách agent (id, tên, icon, màu) để giao diện hiển thị |
| `POST` | `/chat/stream` | ✅ | **Đường chính.** `{ sessionId, message, emotion, checkin }` → luồng SSE (`trace` / `token` / `message` / `done` / `error`) |
| `POST` | `/chat` | ✅ | Dự phòng, không stream. Cùng body → `{ messages[], groups, agents, fallback }` |
| `POST` | `/api/session/end` | ✅ | `{ sessionId, history, emotion, checkin }` → chốt bản tóm tắt cuối |

Auth bằng JWT gửi qua header `Authorization: Bearer <token>` (hoặc cookie `token`).

Ví dụ gọi `/chat`:

```bash
# /api/register không trả token, nên lấy token bằng /api/login
curl -s -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"123456"}' > /dev/null

TOKEN=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}' | jq -r .token)

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
    "username": "an",
    "email": "an@lop6a.vn",
    "password": "$2b$10$...",
    "role": "user",
    "profile": {
      "fullName": "Nguyễn Thị Mai",
      "grade": "lớp 6",
      "school": "THCS Nguyễn Du",
      "className": "6A1"
    },
    "createdAt": "2026-07-25T05:41:30.041Z"
  }
]
```

`profile` là 4 thông tin học sinh điền lúc đăng ký, **tất cả đều không bắt buộc** — bỏ trống thì lưu chuỗi rỗng:

| Field | Nhãn trên form | Cách nhập |
|---|---|---|
| `fullName` | Tên | Ô nhập |
| `grade` | Bạn là học sinh khối | Dropdown khối 6–9, lưu số trần: `"7"` |
| `className` | Lớp của bạn | Ô nhập, ví dụ `6A1` |
| `school` | Trường học của bạn là | Dropdown; chọn "Trường khác..." thì hiện thêm ô tự nhập |

Danh sách khối và trường nằm ở [constants/schoolOptions.js](frontend/src/constants/schoolOptions.js) — thêm trường mới chỉ cần thêm một dòng vào `SCHOOL_OPTIONS`. Dropdown dùng [AuthSelect.jsx](frontend/src/components/ui/AuthSelect.jsx) để trông giống các ô nhập khác. Ở trang quản trị, ba thông tin này hiện thành **3 cột riêng: Trường · Lớp · Khối**, và ô sửa vẫn để nhập tay tự do (quản trị viên có thể chỉnh dữ liệu cũ kiểu `"lớp 6"`).

Tài khoản tạo từ phiên bản cũ (chưa có `role`/`profile`) sẽ được tự bổ sung field khi backend khởi động.

Muốn xoá hết tài khoản thì dừng backend, sửa file thành `[]` (hoặc xoá file) rồi chạy lại — admin mặc định sẽ được tạo lại.

Muốn đổi chỗ lưu thì đặt `ACCOUNTS_FILE` trong `backend/.env`.

> File này chứa email và hash mật khẩu nên đã được `.gitignore` — không commit lên git.

---

## 8. Phân quyền

Hệ thống có 2 vai trò, lưu ở field `role` trong `account.json` và nhúng vào JWT:

| Vai trò | Cách có được | Vào được | Trò chuyện với Larry |
|---|---|---|---|
| `user` | Đăng ký, hoặc bấm nút khách | Trang chat `/`, trang game `/game` | Có |
| `admin` | Tài khoản tạo sẵn trong `account.json` | Chỉ khu vực quản trị `/admin` | **Không** |

Quản trị viên là tài khoản quản lý, **không tham gia trò chuyện**. Chặn ở hai tầng: [ProtectedRoute.jsx](frontend/src/components/ui/ProtectedRoute.jsx) đẩy admin từ `/` và `/game` về `/admin`, còn middleware `blockAdmin` ở [server.js](backend/server.js) trả 403 cho `/chat` và `/api/session/end` kể cả khi gọi thẳng API. Vì vậy admin cũng không bao giờ sinh ra phiên hội thoại nào trong `sessions.json`.

Ở trang đăng nhập có dropdown **"Bạn là"** với hai lựa chọn *Người dùng* / *Quản trị viên*. Vai trò được chọn sẽ gửi kèm request đăng nhập, và **server tra tài khoản theo cả email lẫn vai trò**. Nhờ vậy một email có thể vừa là tài khoản học sinh vừa là tài khoản admin mà không đụng nhau.

### Tạo tài khoản quản trị viên

Quyền admin **không** cấp được từ web: không đăng ký được, backend không tự tạo lúc khởi động, và quản trị viên đang đăng nhập cũng không nâng quyền cho ai được. Cách duy nhất là developer chạy lệnh trực tiếp trên máy chủ.

```bash
cd backend
npm run create-admin
```

Script sẽ hỏi lần lượt tên đăng nhập, email, mật khẩu (nhập 2 lần, gõ tới đâu hiện `*` tới đó nên không lọt vào lịch sử shell):

```
Tạo tài khoản quản trị viên
File tài khoản: /.../backend/account.json
Hiện có: 3 tài khoản (1 quản trị viên)

Tên đăng nhập: coLan
Email: co.lan@truong.edu.vn
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
```

Log khởi động sẽ in `✅ Đã tạo quản trị viên từ biến môi trường: …`. Cơ chế này **không ghi đè** tài khoản đang có: đã tồn tại admin đúng email đó thì bỏ qua, nên đổi mật khẩu trong `account.json` cũng không bị dựng lại. Mật khẩu dưới 8 ký tự hoặc trùng tên với admin khác thì backend chỉ cảnh báo rồi chạy tiếp, không sập.

> Mật khẩu nằm trong biến môi trường của nền tảng — hãy dùng một mật khẩu riêng, không tái sử dụng ở đâu khác.

### Tính năng quản trị viên

Trang `/admin` ([AdminPage.jsx](frontend/src/components/ui/AdminPage.jsx)) cho phép:

- **Xem** danh sách tài khoản kèm 3 cột Trường · Lớp · Khối, số phiên hội thoại và số phiên bị gắn cờ 🚩.
- **Sửa** tên tài khoản, email, hồ sơ trường lớp, và đặt lại mật khẩu — kể cả tài khoản của chính mình.
- **Xoá** tài khoản (kèm toàn bộ lịch sử hội thoại của tài khoản đó).
- **Bấm "Hội thoại"** để xem các phiên trò chuyện: thời gian bắt đầu/kết thúc, số tin nhắn, bản tóm tắt, mức độ 🚩 và nhóm dấu hiệu phát hiện được.
- **Bấm "✉️ Cảnh báo GVCN"** ở phiên bị gắn cờ để AI soạn email cảnh báo, đọc lại rồi gửi cho giáo viên chủ nhiệm (xem cuối mục này).

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

Hai chốt chặn để hệ thống không tự khoá mình: không xoá được tài khoản đang đăng nhập, và không hạ quyền/xoá được quản trị viên cuối cùng.

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
2. **Gửi** — quản trị viên đọc lại, sửa được cả người nhận / tiêu đề / nội dung trong hộp thoại, rồi bấm *Gửi email*. Lúc đó `POST /api/admin/sessions/:sessionId/alert/send` mới gửi thật qua SMTP và ghi lại `{sentAt, to, subject, sentBy}` vào `alerts[]` của phiên. Lần sau mở lại, hộp thoại cảnh báo "phiên này đã gửi N lần" để tránh gửi trùng.

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

Đây là lúc các em cầu cứu, không phải lúc để chặn. Câu trả lời bắt buộc có đủ 3 ý:

1. Ghi nhận cảm xúc, cho em biết em không đơn độc và **đó không phải lỗi của em**.
2. Khuyên nói ngay với người lớn đáng tin: bố mẹ, thầy cô, người thân an toàn.
3. Nhắc **Tổng đài quốc gia bảo vệ trẻ em: 111** (miễn phí, 24/7).

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
- Với ca nguy hiểm: **luôn nói đủ 3 ý an toàn (không phải lỗi của em → người lớn tin cậy → 111) TRƯỚC**, game chỉ là bước làm thêm và không bao giờ thay cho việc nhờ người lớn.

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

---

## 11. Đổi model AI

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

Biến của một thành phần bỏ trống thì rơi về `CHAT_MODEL`. Ví dụ nâng riêng hai chỗ quan trọng nhất, phần còn lại giữ nguyên model rẻ:

```env
CHAT_MODEL=google/gemini-2.5-flash-lite       # nhanh, rẻ — nền cho mọi agent
SUPERVISOR_MODEL=google/gemini-2.5-flash      # phân nhóm chuẩn hơn
AGENT_SELF_HARM_MODEL=google/gemini-2.5-flash # ca rủi ro cao nhất
SUMMARY_MODEL=google/gemini-2.5-flash         # cân bằng
ALERT_MODEL=google/gemini-2.5-pro             # kỹ hơn cho văn bản đối ngoại
```

Đổi sang nhà cung cấp khác cũng chỉ là đổi chuỗi, vì cả ba đều đi qua OpenRouter: `anthropic/claude-sonnet-4.5`, `openai/gpt-4o-mini`, ... Danh sách đầy đủ ở [openrouter.ai/models](https://openrouter.ai/models).

Kiểm tra nhanh model nào đang chạy: `curl -s http://localhost:5000/api/health` → `{ chatModel, supervisorModel, agentModels, summaryModel, alertModel, missingModelConfig }`.

Phần gọi AI của Larry nằm trong `requestOpenRouter` ([server.js](backend/server.js)) — đúng chuẩn `POST /chat/completions` của OpenRouter, tự thử lại 1 lần khi gặp lỗi 429/503/timeout. Prompt của Larry ở `buildSystemPrompt` và `buildUserPrompt` trong cùng file.

---

## 12. Build production

```bash
cd frontend
npm run build      # kết quả trong frontend/build/
```

- **Frontend**: repo đã có sẵn [netlify.toml](netlify.toml) (base `frontend`, publish `build`). Nhớ khai báo `REACT_APP_API_URL` trong phần environment variables của Netlify, trỏ về backend đã deploy.
- **Backend**: deploy `backend/` lên Render/Railway/VPS với lệnh `npm start`, và khai báo `OPENROUTER_API_KEY`, `JWT_SECRET`, `CHAT_MODEL` (bắt buộc — không có giá trị mặc định trong code), các biến model của từng agent nếu muốn tách, `SUMMARY_MODEL`, `ALERT_MODEL`, cùng `EMAIL_USER` / `EMAIL_APP_PASSWORD` / `ALERT_EMAIL_TO` trong environment variables của nền tảng đó.

> ⚠️ Render/Railway gói free dùng ổ đĩa tạm — `account.json` sẽ bị xoá mỗi lần deploy lại hoặc khi dịch vụ ngủ dậy. Muốn giữ tài khoản trên server thật thì gắn persistent disk rồi trỏ `ACCOUNTS_FILE` vào đó, hoặc chuyển hẳn sang database.

---

## 13. Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Log ghi `OPENROUTER_API_KEY: MISSING ✗` | Chưa có `backend/.env` hoặc sai tên biến. Chạy backend từ đúng thư mục `backend/`. |
| Larry luôn trả lời chung chung, response có `fallback: true` | Key sai/hết hạn, hết credit, hoặc tên model không tồn tại. Xem log backend để biết lỗi cụ thể từ OpenRouter. |
| `401 Access token required` khi chat | Chưa đăng nhập hoặc token đã hết hạn (7 ngày). Đăng nhập lại. |
| `Không lưu được tài khoản` khi đăng ký | Không ghi được `backend/account.json` — kiểm tra quyền ghi thư mục `backend/`. |
| Gõ đúng mật khẩu nhưng vẫn báo sai, sau khi sửa tay `account.json` | Field `password` đang là chữ thường chứ không phải hash bcrypt. **Khởi động lại backend** — nó sẽ tự hash lại. Sửa file lúc backend đang chạy cũng không có tác dụng vì danh sách tài khoản chỉ được đọc lúc khởi động. |
| Chat báo "Larry không kết nối được server" | Backend chưa chạy, hoặc `REACT_APP_API_URL` sai. Kiểm tra `curl http://localhost:5000/api/health`. |
| Camera không hiện | Chưa cấp quyền camera, hoặc đang mở qua IP/HTTP thay vì `localhost`. |
| Nhận diện cảm xúc không chạy | Thiếu model trong `frontend/public/models/` — cần đủ 4 file `tiny_face_detector_*` và `face_expression_*`. |
| `Port 5000 already in use` | Đổi `PORT` trong `backend/.env` và sửa `REACT_APP_API_URL` tương ứng. |

---

## 14. Điều khoản & Chính sách bảo mật

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

## 15. Lưu ý bảo mật

- `backend/.env` và `frontend/.env` đã được `.gitignore` — **không commit API key lên git**.
- `backend/account.json` chứa email, hash mật khẩu và thông tin trường lớp của học sinh — đã được `.gitignore`, nhớ backup và phân quyền file cẩn thận.
- Không còn tài khoản admin mặc định trong mã nguồn. Quyền quản trị chỉ cấp được bằng `npm run create-admin` chạy trực tiếp trên máy chủ — ai truy cập được máy chủ thì cấp được quyền admin, nên hãy bảo vệ quyền truy cập đó.
- Cách lưu bằng file JSON phù hợp cho lớp học/demo. Khi số tài khoản lớn hoặc chạy nhiều instance backend cùng lúc thì nên chuyển sang database (SQLite/Postgres).
- Đổi `JWT_SECRET` trước khi deploy.
- `EMAIL_APP_PASSWORD` là chìa khoá gửi thư dưới danh nghĩa nhà trường — giữ như API key: chỉ nằm trong `.env`, không commit, lộ thì vào [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) thu hồi và tạo lại. Chỉ quản trị viên gọi được hai endpoint `alert/draft` và `alert/send`.
