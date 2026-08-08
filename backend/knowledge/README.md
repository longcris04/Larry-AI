# Knowledge graph — khung lý thuyết cho hệ multi-agent

Kho tri thức mà bốn agent chuyên trách dựa vào để tư vấn. Dữ liệu được rút ra từ
ba tài liệu chuyên môn trong [backend/documents/](../documents/):

| File nguồn | Node id bắt đầu bằng | Agent chính |
|---|---|---|
| `khung-ly-thuyet-tu-van-khan-cap-hoc-sinh-tu-hai.docx` | `*.sh.*` | 🛟 `agent_self_harm` |
| `nan-nhan-bao-luc-hoc-duong-khung-ly-thuyet.docx` | `*.v.*` | 🛡️ `agent_victim` |
| `hoc-sinh-gay-bao-luc-giao-duc-hanh-vi.docx` | `*.a.*` | 🧩 `agent_actor` |

Phần chung của cả ba tài liệu (định nghĩa bạo lực học đường, 5 dạng hành vi, kỹ
thuật hạ nhiệt cảm xúc, danh bạ hotline) nằm ở `graph/shared.json`.

## Vì sao là graph chứ không phải chia nhỏ tài liệu rồi tìm kiếm

Cách thông thường là cắt tài liệu thành đoạn rồi tìm đoạn giống câu hỏi nhất. Nó
hỏng ở đúng thứ mà việc tư vấn cần nhất: **thứ đáng nói với em thường không chứa
chữ nào giống lời em vừa nói.**

Em nói *"em thấy trong lòng trống rỗng"*. Khớp chữ chỉ tìm ra đoạn nói về chức
năng "chuyển hoá nỗi đau tinh thần". Thứ thật sự cần đưa cho agent là **kỹ thuật
nắm đá lạnh** — nó không chứa chữ "trống rỗng" nào cả. Cái nối hai thứ đó là một
quan hệ trong tài liệu: kỹ thuật này thay thế được đúng chức năng kia.

Graph mã hoá chính các quan hệ đó thành cạnh, nên truy hồi đi được từ lời em kể
sang thứ cần nói:

```
"trống rỗng"  ──khớp──▶  Chức năng: chuyển hoá nỗi đau
                              ▲
                              │ REPLACES_FUNCTION
                         Kỹ thuật nắm đá lạnh          ◀── thứ agent thật sự cần
```

Điều tương tự với luật cấm. Em nhắc tới việc tự cắt → node NSSI sáng lên → cạnh
`CONTRAINDICATED_FOR` kéo ngược ra điều cấm *"không nhắc tới bất kỳ cách tự làm
đau nào"*, đúng lúc nó quan trọng nhất.

## Kiến trúc

```
knowledge/
├── graph/            dữ liệu — node + cạnh, mỗi file một nguồn
│   ├── shared.json
│   ├── self-harm.json
│   ├── victim.json
│   └── actor.json
├── schema.js         kiểu node, kiểu cạnh, nhãn tiếng Việt, chuẩn hoá tiếng Việt
├── index.js          nạp, kiểm tra toàn vẹn, dựng chỉ mục (cache cả tiến trình)
├── retrieve.js       lời em kể + assessment → chọn node
├── render.js         node → khối cho prompt + thẻ cho bảng tri thức của giao diện
├── cli.js            check / stats / query / node
└── README.md
```

Điểm nối duy nhất vào hệ agent nằm ở
[`agents/prompts/agentPrompt.js`](../agents/prompts/agentPrompt.js) — hàm
`renderKnowledge()` chèn khối tri thức vào ngay trước khối `PHẠM VI` trong system
prompt. Không có chỗ nào khác trong backend gọi vào thư mục này.

Cùng một lần chọn đó trả về ba dạng, luôn khớp nhau:

| Dạng | Đi đâu |
|---|---|
| `block` | khối văn bản chèn vào system prompt |
| `items` | bản gọn (id, nhãn, điểm) ghi vào `trace` của phiên |
| `cards` | bản đầy đủ — nội dung, tài liệu gốc, lý do được chọn — phát lên giao diện |

`cards` là dữ liệu của **bảng tri thức ở cột trái**: học sinh thấy đúng những mẩu
tài liệu Larry vừa mở để viết câu trả lời, nên biết được câu đó có chỗ dựa chứ
không phải model tự bịa. `agentNode` phát nó qua `config.writer()` **trước khi**
gọi model, để bảng sáng lên trước câu trả lời (xem §8.5 của `LARRY.md`).

Vì bảng nói với học sinh rằng "Larry đã đọc những mẩu này", nó chỉ được nhận phần
tri thức **thật sự lọt vào prompt**. Đó là lý do `selectForPrompt()` trả về cả
`kept` chứ không chỉ trả về chuỗi: truy hồi ra 12 node nhưng ngân sách ký tự
thường chỉ cho 5-6 node đi tiếp, và 6-7 node bị cắt kia không được phép xuất hiện
trên bảng.

## Một node trông như thế nào

```json
{
  "id": "skill.sh.ice_cube",
  "type": "Skill",
  "label": "Nắm chặt đá viên",
  "agents": ["agent_self_harm"],
  "priority": 2,
  "triggers": ["muốn cắt", "muốn làm đau", "thèm làm", "kìm không được"],
  "dangerSignals": ["self_injury"],
  "summary": "Nắm chặt một hoặc hai viên đá lạnh cho đến khi tan hết...",
  "guidance": "Nói như MỘT LỰA CHỌN để thử, không phải mệnh lệnh...",
  "source": "self-harm#ChươngV.1"
}
```

| Trường | Vai trò |
|---|---|
| `type` | Một trong 16 kiểu ở `schema.js`. Quyết định node nằm mục nào trong prompt. |
| `agents` | Ranh giới chuyên môn. `"*"` = mọi agent. Agent không thấy node ngoài phạm vi của mình. |
| `priority` | `3` GHIM (luôn nạp) · `2` cao · `1` thường · `0` chỉ khi khớp mạnh. |
| `triggers` | Cụm tiếng Việt để dò trong lời em kể. So khớp bỏ dấu, theo ranh giới từ. |
| `dangerSignals` | Khớp với enum `AssessmentSchema` của supervisor. Tín hiệu mạnh hơn khớp chữ. |
| `summary` | **Đi thẳng vào prompt.** Viết như nói với đồng nghiệp, không phải trích tài liệu. |
| `guidance` | **Đi thẳng vào prompt.** Agent nên LÀM GÌ với node này. |
| `avoid` | **Đi thẳng vào prompt.** Chỉ dùng cho `Taboo`. |
| `detail` | Chỉ vào prompt với 2 node đầu bảng. Chỗ để phần dài, phần việc của người lớn. |
| `source` | Truy vết về chương mục tài liệu gốc. Không vào prompt. |

Bốn trường in đậm ở trên đi thẳng vào prompt của model, nên **tuyệt đối không
viết id node hay tên file mã nguồn trong đó** — `cli.js check` bắt lỗi này.

## Cách truy hồi chạy

Ba tầng trong `retrieve.js`:

1. **Hạt giống** — dò `triggers` trong lời em vừa kể (2 lượt gần nhất) cộng với
   `emotions`/`behaviors` mà supervisor rút ra. Cụm càng dài khớp được thì điểm
   càng cao. Trùng `dangerSignals` được +6 mỗi tín hiệu, vì đó là kết luận của
   cả một lượt đánh giá chứ không phải một chữ trùng nhau.
2. **Lan truyền** — đi theo cạnh tối đa 2 bước, điểm nhân với hệ số suy giảm
   riêng cho từng loại cạnh và từng chiều. Node đến được bằng nhiều đường giữ
   điểm **cao nhất**, không cộng dồn — cộng dồn thì các node trung tâm (tổng đài
   111) sẽ đứng đầu ở mọi truy vấn.
3. **Ghim** — node `priority: 3` luôn có mặt. Hiện chỉ 4 node dùng tới: ba
   nguyên tắc giao tiếp của agent tự hại và quy trình 5 bước của agent actor —
   đều là thứ không có từ khoá nào để khớp.

Kết quả cắt theo ngân sách ký tự rồi gom nhóm theo mục, thứ tự cố định: **điều
cấm → mức nguy cơ → nguyên tắc → quy trình và kỹ năng → mẫu đối thoại → nền lý
thuyết → tình huống → hotline**. Điều cấm lên đầu vì làm sai nó gây hại ngay.

### Vì sao điều cấm không được ghim hết

Các file `roles/*.js` đã mang sẵn danh sách "TUYỆT ĐỐI KHÔNG" ở **mọi** lượt.
Ghim lại toàn bộ `Taboo` chỉ chiếm chỗ của phần tri thức theo tình huống. Thay
vào đó mỗi `Taboo` được nối bằng cạnh `CONTRAINDICATED_FOR` tới đúng chủ đề nó
cấm, và hệ số đi ngược của cạnh này để rất cao (0.95) — nên điều cấm tự nổi lên
đúng lúc chủ đề đó xuất hiện.

## Công cụ dòng lệnh

```bash
npm run kg:check      # kiểm tra toàn vẹn — chạy sau MỖI lần sửa graph/
npm run kg:stats      # thống kê node/cạnh theo loại và theo agent
npm run kg:query -- agent_victim "em bị các bạn cô lập"
npm run kg:query -- agent_self_harm "em thấy trống rỗng" --danger self_injury

node knowledge/cli.js node concept.nssi     # xem một node và mọi cạnh của nó
```

`check` bắt các lỗi mà lúc chat chỉ biểu hiện thành "agent tự nhiên kém đi":

- id trùng, kiểu node/cạnh sai chính tả, thiếu `label`/`summary`
- cạnh trỏ tới node không tồn tại (kể cả cạnh liên file)
- node gán cho agent không có trong `agents/registry.js`
- **node chết** — không trigger, không được ghim, và cách mọi node khớp được quá
  2 bước, nên không lượt nào truy hồi ra nó
- rò rỉ id node hoặc tên file mã nguồn vào các trường đi thẳng vào prompt

## Thêm hoặc sửa tri thức

1. Chọn file trong `graph/` theo nguồn tài liệu. Dùng chung nhiều agent thì để
   `shared.json`.
2. Thêm node, đặt id theo `<kiểu>.<agent>.<tên>`. `summary` viết bằng lời nói
   được, không chép nguyên văn tài liệu — model sẽ đọc lại nó cho học sinh.
3. **Nối cạnh.** Một node không cạnh gần như là node chết. Tự hỏi: từ đâu người
   ta sẽ đi tới nó, và từ nó đi tiếp được tới đâu.
4. `npm run kg:check`, rồi `npm run kg:query` với vài câu thật để xem node có
   nổi lên đúng lúc không.

Đổi cấu hình bằng biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `KNOWLEDGE_CHAR_BUDGET` | `2600` | Trần ký tự của khối tri thức trong prompt |
| `KNOWLEDGE_DETAIL_TOP_K` | `2` | Số node đầu bảng được kèm cả `detail` |

## Giới hạn đã biết

- **Truy hồi bằng khớp cụm từ, không phải embedding.** Cách viết mà graph chưa
  có trigger tương ứng sẽ không khớp. Bù lại: không thêm phụ thuộc nào, kết quả
  giải thích được từng bước, và chạy dưới một mili-giây. Khi thêm node mới, hãy
  viết trigger theo đúng cách một học sinh 12 tuổi gõ, không theo thuật ngữ.
- **Graph nạp một lần rồi cache.** Sửa file trong `graph/` phải khởi động lại
  backend (hoặc `npm run dev` đã có `--watch`).
- **`agent_homeroom` gần như không có tri thức riêng** — chỉ 16 node, hầu hết là
  loại dùng chung. Đây không phải thiếu sót của graph: ba tài liệu nguồn viết về
  bạo lực học đường và tự hại, không tài liệu nào viết về chuyện học hành, bạn bè
  và sinh hoạt thường ngày. Muốn agent này có khung lý thuyết thì phải bổ sung
  một tài liệu nguồn thứ tư, chứ không phải chia lại số node hiện có.
- **Supervisor chưa dùng graph.** Hiện chỉ 4 agent chuyên trách đọc nó. Các node
  `Sign` và `RiskLevel` hoàn toàn dùng được cho khâu đánh giá và phân nhóm — đó
  là hướng mở rộng tự nhiên tiếp theo.
