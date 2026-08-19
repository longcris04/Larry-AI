// Bài kiểm tra cho bộ ghi file .xlsx tự viết (utils/xlsx.js).
//
// Ở đây không có Excel để mở file ra xem, nên các bài dưới đây soi thẳng vào
// BYTE của file: chữ ký ZIP, mục lục, và nội dung XML bên trong. Đọc được thẳng
// như vậy vì ZIP ghi kiểu "stored" — không nén, nên XML nằm nguyên văn trong file.
//
// Bản sinh ra cũng đã được đối chiếu bằng hai bộ đọc độc lập ngoài đời
// (openpyxl và LibreOffice) — mấy bài này giữ cho nó không hỏng về sau.

import { buildTableWorkbook, safeFileName, safeSheetName } from "./xlsx";

const COLUMNS = [
  { header: "Trường", value: (r) => r.school, width: 30 },
  { header: "Học sinh", value: (r) => r.students }
];

const ROWS = [
  { school: "THCS Đoàn Thị Điểm & Bạn", students: 42 },
  { school: 'Trường "nháy kép" <a>', students: 0 }
];

async function build(overrides = {}) {
  const { blob, fileName } = buildTableWorkbook({
    name: "Các lớp đã tạo tài khoản",
    columns: COLUMNS,
    rows: ROWS,
    ...overrides
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(bytes);

  // Phần XML của sheet, tách riêng khỏi phần byte của ZIP. Mấy bài soi nội dung
  // phải nhìn vào ĐÂY: giải mã cả file ra chữ thì lẫn cả byte nhị phân của header
  // ZIP (CRC, kích thước...), và chúng tình cờ chứa được ký tự bất kỳ — kể cả
  // dấu & hay ký tự điều khiển đang cần kiểm.
  const sheet = text.slice(
    text.indexOf("<worksheet"),
    text.indexOf("</worksheet>") + "</worksheet>".length
  );

  return { bytes, fileName, text, sheet };
}

// Đọc "End of central directory" — 22 byte cuối file — rồi kiểm xem nó có trỏ
// đúng vào đầu mục lục không.
function readEocd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdAt = bytes.length - 22;

  return {
    signature: view.getUint32(eocdAt, true),
    entries: view.getUint16(eocdAt + 10, true),
    centralLength: view.getUint32(eocdAt + 12, true),
    centralStart: view.getUint32(eocdAt + 16, true),
    signatureAtCentralStart: view.getUint32(view.getUint32(eocdAt + 16, true), true)
  };
}

test("gói đủ 6 phần mà một file .xlsx tối thiểu cần", async () => {
  const { text } = await build();

  for (const part of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml"
  ]) {
    expect(text).toContain(part);
  }
});

// ĐÂY LÀ BÀI QUAN TRỌNG NHẤT của file này.
//
// Mục lục ZIP nằm ở cuối file, và EOCD phải nói đúng nó bắt đầu ở byte nào. Sai
// một chút thôi thì file vẫn "trông như" ZIP, vẫn đúng kích thước, nhưng mọi
// trình giải nén đều từ chối với đúng một câu: "Bad magic number for central
// directory" — không nói thêm gì để lần ra chỗ hỏng. Bản đầu tiên của
// utils/xlsx.js đã sai đúng chỗ này (tính độ dài mục lục SAU khi con trỏ ghi đã
// dời đi 12 byte).
test("mục lục ZIP trỏ đúng chỗ — file mở được bằng trình giải nén thật", async () => {
  const { bytes } = await build();
  const eocd = readEocd(bytes);

  expect(eocd.signature).toBe(0x06054b50); // chữ ký EOCD
  expect(eocd.entries).toBe(6);
  expect(eocd.signatureAtCentralStart).toBe(0x02014b50); // đầu mục lục
  // Mục lục phải chạy đúng tới đầu EOCD, không thừa không thiếu
  expect(eocd.centralStart + eocd.centralLength).toBe(bytes.length - 22);
});

test("số ghi thành số, chữ ghi thành chữ", async () => {
  const { sheet: text } = await build();

  // Ô số: <v>42</v>, không bọc trong inlineStr — có vậy Excel mới cộng/lọc được
  expect(text).toContain("<v>42</v>");
  expect(text).not.toContain("<t xml:space=\"preserve\">42</t>");

  // Số 0 vẫn là một ô có giá trị, không bị coi là ô rỗng
  expect(text).toContain("<v>0</v>");
});

test("thoát đúng các ký tự làm vỡ XML", async () => {
  const { sheet } = await build();

  expect(sheet).toContain("THCS Đoàn Thị Điểm &amp; Bạn");
  expect(sheet).toContain("Trường &quot;nháy kép&quot; &lt;a&gt;");
  // Dấu & thô lọt vào giữa nội dung là file hỏng — chỉ được phép xuất hiện ở
  // dạng đã thoát (&amp; &lt; &gt; &quot; &apos;)
  expect(sheet).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
});

test("ký tự điều khiển bị lọc bỏ thay vì làm hỏng file", async () => {
  const { sheet } = await build({
    rows: [{ school: "Có ký tự \u0007 điều khiển", students: 1 }]
  });

  expect(sheet).toContain("Có ký tự  điều khiển");
  expect(sheet).not.toContain("\u0007");
});

test("dòng tiêu đề in đậm và được đóng băng khi cuộn", async () => {
  const { sheet: text } = await build();

  expect(text).toContain('<c r="A1" s="1"'); // ô tiêu đề dùng style in đậm
  expect(text).toContain('state="frozen"');
  expect(text).toContain('<autoFilter ref="A1:B3"/>'); // 1 dòng tiêu đề + 2 dòng dữ liệu
});

test("tên file lấy đúng tên bảng, chỉ bỏ ký tự hệ điều hành cấm", async () => {
  const { fileName } = await build();
  expect(fileName).toBe("Các lớp đã tạo tài khoản.xlsx");

  // Dấu tiếng Việt GIỮ NGUYÊN — đó là thứ giúp tìm lại file trong thư mục Downloads
  expect(safeFileName("Tài khoản người dùng")).toBe("Tài khoản người dùng.xlsx");

  // 9 ký tự Windows cấm
  expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j.xlsx");

  // Dấu chấm cuối bị Windows lặng lẽ cắt đi → bỏ trước cho khỏi lệch tên
  expect(safeFileName("Bảng số liệu...")).toBe("Bảng số liệu.xlsx");

  expect(safeFileName("")).toBe("bang-du-lieu.xlsx");
});

test("tên sheet theo luật chặt hơn của Excel: tối đa 31 ký tự, cấm : \\ / ? * [ ]", () => {
  expect(safeSheetName("Các lớp đã tạo tài khoản")).toBe("Các lớp đã tạo tài khoản");
  expect(safeSheetName("a/b\\c:d?e*f[g]h")).toBe("a b c d e f g h");
  expect(safeSheetName("x".repeat(50))).toHaveLength(31);
  expect(safeSheetName("")).toBe("Sheet1");
});

test("bảng rỗng vẫn ra file mở được, chỉ có dòng tiêu đề", async () => {
  const { sheet, bytes } = await build({ rows: [] });

  expect(readEocd(bytes).signature).toBe(0x06054b50);
  expect(sheet).toContain('<autoFilter ref="A1:B1"/>');
  expect(sheet).toContain("Trường");
});
