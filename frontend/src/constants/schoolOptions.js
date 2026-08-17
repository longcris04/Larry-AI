// Lựa chọn sẵn cho phần thông tin học sinh ở form đăng ký.
// Trường nào chưa có trong danh sách thì chọn "Trường khác" rồi tự nhập.

// Đủ 12 khối: Larry không chỉ dùng ở cấp 2 nữa, đã có học sinh cấp 1 và cấp 3
// đăng ký. Thiếu khối của mình thì các em hoặc bỏ trống, hoặc chọn đại một khối
// khác — và mọi thứ dựa trên khối (cách xưng hô, cách chọn tình huống) sai theo.
export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export const SCHOOL_OPTIONS = ["THCS Đoàn Thị Điểm"];

// Giá trị đánh dấu "tự nhập", không bao giờ được lưu vào hồ sơ
export const OTHER_VALUE = "__other__";
