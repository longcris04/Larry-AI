// Ô tìm kiếm ở bảng tài khoản đứng hay đổ trên đúng hai hàm này.
//
// Bài quan trọng nhất là bài GÕ KHÔNG DẤU: gõ "doan thi diem" mà không ra "Đoàn
// Thị Điểm" thì quản trị viên sẽ kết luận là trường đó chưa có trong hệ thống —
// một kết luận sai, và không có gì trên màn hình gợi ý rằng mình vừa sai.

import { matchesQuery, normalizeVi } from "./search";

test("bỏ dấu và hạ chữ thường", () => {
  expect(normalizeVi("Đoàn Thị Điểm")).toBe("doan thi diem");
  expect(normalizeVi("Nguyễn Văn An")).toBe("nguyen van an");
  expect(normalizeVi("THPT Lê Quý Đôn")).toBe("thpt le quy don");
  // "đ" là một CHỮ CÁI RIÊNG, không phải "d" có dấu — NFD không tách được nó
  expect(normalizeVi("ĐỨC")).toBe("duc");
  expect(normalizeVi("  nhiều   khoảng   trắng  ")).toBe("nhieu khoang trang");
  expect(normalizeVi(null)).toBe("");
  expect(normalizeVi(undefined)).toBe("");
});

const HOC_SINH = [
  "hocsinh07",
  "Nguyễn Văn An",
  "THCS Đoàn Thị Điểm",
  "6A1",
  "6",
  "an.nguyen@truong.edu.vn",
  "0912345678"
];

test("gõ không dấu vẫn tìm ra", () => {
  expect(matchesQuery("doan thi diem", HOC_SINH)).toBe(true);
  expect(matchesQuery("nguyen van an", HOC_SINH)).toBe(true);
  expect(matchesQuery("DOAN", HOC_SINH)).toBe(true);
});

test("gõ có dấu cũng tìm ra", () => {
  expect(matchesQuery("Đoàn Thị Điểm", HOC_SINH)).toBe(true);
  expect(matchesQuery("nguyễn", HOC_SINH)).toBe(true);
});

test("dò trên đủ mọi cột: tên, trường, lớp, khối, email, số điện thoại", () => {
  expect(matchesQuery("hocsinh07", HOC_SINH)).toBe(true);
  expect(matchesQuery("6a1", HOC_SINH)).toBe(true);
  expect(matchesQuery("an.nguyen@truong.edu.vn", HOC_SINH)).toBe(true);
  expect(matchesQuery("0912345678", HOC_SINH)).toBe(true);
});

// Đây là thứ làm ô tìm kiếm dùng được thật: người ta gõ mấy mẩu mình còn nhớ,
// không theo thứ tự và không nhất thiết cùng một cột.
test("nhiều từ khoá: mỗi từ khớp ở đâu cũng được, không cần đúng thứ tự", () => {
  expect(matchesQuery("6a1 diem", HOC_SINH)).toBe(true);
  expect(matchesQuery("diem 6a1", HOC_SINH)).toBe(true);
  expect(matchesQuery("an thcs", HOC_SINH)).toBe(true);

  // Một từ không khớp là cả câu không khớp — nếu không thì gõ càng nhiều càng ra
  // nhiều kết quả, ngược hẳn với thứ người dùng mong đợi khi gõ thêm.
  expect(matchesQuery("6a1 khong-ton-tai", HOC_SINH)).toBe(false);
});

test("câu truy vấn rỗng thì khớp tất cả — bảng hiện đủ khi chưa gõ gì", () => {
  expect(matchesQuery("", HOC_SINH)).toBe(true);
  expect(matchesQuery("   ", HOC_SINH)).toBe(true);
});

test("ô trống trong hồ sơ không làm hỏng phép so khớp", () => {
  const thieuThongTin = ["hocsinh08", null, undefined, "", "7", null, "0900000000"];
  expect(matchesQuery("hocsinh08", thieuThongTin)).toBe(true);
  expect(matchesQuery("truong nao do", thieuThongTin)).toBe(false);
});
