// Xuất một bảng trên màn hình quản trị ra file .xlsx tải về máy.
//
// TỰ VIẾT, KHÔNG DÙNG THƯ VIỆN. Ba lý do, theo thứ tự quan trọng:
//
//   1. Thư viện phổ biến nhất (SheetJS `xlsx` trên npm) đứng yên ở 0.18.5 và bản
//      đó dính mấy lỗi bảo mật đã công bố; bản vá không nằm trên npm registry.
//      Đây là app có dữ liệu học sinh, không đáng đánh đổi.
//   2. Nó nặng ~400KB sau khi nén, tải về cho MỌI người dùng — trong khi chỉ
//      quản trị viên mới bấm nút tải bảng.
//   3. Thứ cần làm ở đây rất hẹp: một sheet, chữ và số, không công thức, không
//      biểu đồ. Phần đó gọn hơn nhiều so với công sức bảo trì một phụ thuộc.
//
// FILE .XLSX LÀ MỘT FILE ZIP chứa mấy file XML. Bản tối thiểu mà Excel, LibreOffice
// và Google Sheets đều mở được gồm đúng năm phần:
//
//   [Content_Types].xml        khai kiểu của từng phần bên trong
//   _rels/.rels                trỏ tới workbook
//   xl/workbook.xml            danh sách sheet
//   xl/_rels/workbook.xml.rels trỏ tới sheet và styles
//   xl/worksheets/sheet1.xml   dữ liệu thật
//   xl/styles.xml              đủ để in đậm dòng tiêu đề
//
// Các ô ghi kiểu "inlineStr" (chữ nằm thẳng trong ô) nên KHÔNG cần
// xl/sharedStrings.xml — bảng vài nghìn dòng thì phần tiết kiệm của sharedStrings
// không đáng so với một file phải giữ cho khớp.
//
// ZIP ghi kiểu "stored" (không nén). Nén DEFLATE trong trình duyệt phải kéo thêm
// CompressionStream và xử lý bất đồng bộ, trong khi file bảng vài trăm KB tải về
// máy trong chớp mắt — không nén đổi lấy code ngắn hơn hẳn là một đánh đổi đúng ở
// đây.

// --- Bảng CRC32 cho ZIP -----------------------------------------------------
// Dựng một lần, ở lần xuất file đầu tiên. Đây là thứ ZIP dùng để kiểm tra file
// không hỏng; sai một byte là Excel báo "file bị lỗi" và không nói gì thêm.
let crcTable = null;

function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Đóng gói ZIP -----------------------------------------------------------

// Giờ tạo file theo định dạng DOS mà ZIP quy định (ngày từ 1980, giây chia đôi).
// Ghi 0 cũng chạy, nhưng lúc đó Windows hiện ngày "1/1/1980" trong Explorer.
function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Gói các file thành một ZIP.
 * @param {Array<{name: string, data: Uint8Array}>} files
 * @returns {Blob}
 */
function zip(files) {
  const encoder = new TextEncoder();
  const { time, day } = dosTime(new Date());

  const entries = files.map((file) => ({
    nameBytes: encoder.encode(file.name),
    data: file.data,
    crc: crc32(file.data)
  }));

  // Tính sẵn tổng kích thước để cấp phát ĐÚNG MỘT lần. Local header 30 byte,
  // central directory 46 byte, EOCD 22 byte — đều là hằng số của định dạng.
  const localSize = entries.reduce((sum, e) => sum + 30 + e.nameBytes.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.nameBytes.length, 0);

  const buffer = new ArrayBuffer(localSize + centralSize + 22);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;
  const u16 = (value) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const u32 = (value) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const raw = (chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  };

  // 1. Local file header + nội dung, lần lượt từng file
  for (const entry of entries) {
    entry.offset = offset;

    u32(0x04034b50); // chữ ký
    u16(20); // cần phiên bản 2.0 để giải nén
    u16(0); // cờ chung — 0 vì tên file toàn ký tự ASCII
    u16(0); // 0 = stored (không nén)
    u16(time);
    u16(day);
    u32(entry.crc);
    u32(entry.data.length); // kích thước sau nén
    u32(entry.data.length); // kích thước gốc — bằng nhau vì không nén
    u16(entry.nameBytes.length);
    u16(0); // không có extra field
    raw(entry.nameBytes);
    raw(entry.data);
  }

  // 2. Central directory — mục lục, cái mà trình giải nén đọc trước
  const centralStart = offset;
  for (const entry of entries) {
    u32(0x02014b50);
    u16(20); // phiên bản của bên tạo file
    u16(20);
    u16(0);
    u16(0);
    u16(time);
    u16(day);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.nameBytes.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // số thứ tự đĩa
    u16(0); // thuộc tính nội bộ
    u32(0); // thuộc tính ngoài
    u32(entry.offset); // vị trí local header của file này
    raw(entry.nameBytes);
  }

  // 3. End of central directory
  //
  // Chốt kích thước mục lục TRƯỚC khi ghi khối này: u32()/u16() dời `offset` đi
  // sau mỗi lần gọi, nên tính `offset - centralStart` ngay tại chỗ điền sẽ ra
  // thừa đúng 12 byte đã ghi ở mấy dòng trên — và trình giải nén sẽ đọc trượt
  // sang giữa mục lục rồi báo "Bad magic number for central directory".
  const centralLength = offset - centralStart;

  u32(0x06054b50);
  u16(0); // số thứ tự đĩa hiện tại
  u16(0); // đĩa chứa mục lục
  u16(entries.length); // số mục trên đĩa này
  u16(entries.length); // tổng số mục
  u32(centralLength);
  u32(centralStart);
  u16(0); // comment

  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

// --- Sinh XML ---------------------------------------------------------------

// Năm ký tự XML bắt buộc phải thoát. Tên trường của học sinh do người dùng tự gõ,
// nên một dấu & trong "Trường THCS A & B" đủ làm cả file không mở được.
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Ký tự điều khiển không hợp lệ trong XML 1.0. Dữ liệu dán từ nơi khác vào có
    // thể lẫn chúng, và Excel sẽ từ chối mở file mà không nói vì sao.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

// Số cột → tên cột kiểu Excel: 1→A, 26→Z, 27→AA
function columnName(index) {
  let name = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

// Chỉ hai kiểu ô: số thì ghi thẳng để Excel còn cộng/lọc được, còn lại là chữ.
// Ô rỗng thì KHÔNG ghi thẻ <c> nào — file nhẹ hơn và Excel hiểu là ô trống.
function cellXml(ref, value, styleIndex) {
  const style = styleIndex ? ` s="${styleIndex}"` : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }

  const text = value == null ? "" : String(value);
  if (!text) return styleIndex ? `<c r="${ref}"${style}/>` : "";

  // xml:space="preserve" giữ lại khoảng trắng đầu/cuối, thứ Excel mặc định cắt đi
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    text
  )}</t></is></c>`;
}

function sheetXml(columns, rows) {
  const lastCol = columnName(columns.length);
  const lastRow = rows.length + 1;

  const cols = columns
    .map(
      (col, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${col.width || 16}" customWidth="1"/>`
    )
    .join("");

  const header = columns
    .map((col, i) => cellXml(`${columnName(i + 1)}1`, col.header, 1))
    .join("");

  const body = rows
    .map((row, r) => {
      const cells = columns
        .map((col, c) => cellXml(`${columnName(c + 1)}${r + 2}`, row[c], 0))
        .join("");
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join("");

  // Thứ tự các thẻ con ở đây là BẮT BUỘC theo lược đồ của định dạng
  // (dimension → sheetViews → cols → sheetData → autoFilter). Đảo chỗ thì
  // Excel báo file hỏng, còn LibreOffice vẫn mở — nên lỗi kiểu này rất dễ lọt.
  return (
    `${XML_HEADER}<worksheet xmlns="${MAIN_NS}">` +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    // Đóng băng dòng tiêu đề: bảng vài trăm dòng mà cuộn xuống là mất tên cột
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
    // Nút lọc sẵn trên dòng tiêu đề — quản trị viên mở ra là lọc/sắp xếp được ngay
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    `</worksheet>`
  );
}

// Vừa đủ để dòng tiêu đề in đậm, có nền và một đường kẻ dưới. Excel bắt khai đủ
// fonts/fills/borders/cellXfs kể cả khi không dùng tới, và fill thứ hai BẮT BUỘC
// là gray125 — bỏ đi thì file mở ra sai màu ở mọi ô.
const STYLES_XML =
  `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">` +
  `<fonts count="2">` +
  `<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF1F3864"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F7"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left/><right/><top/><bottom style="thin"><color rgb="FF8EA9DB"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const CONTENT_TYPES_XML =
  `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS_XML =
  `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS_XML =
  `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

function workbookXml(sheetName) {
  return (
    `${XML_HEADER}<workbook xmlns="${MAIN_NS}" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  );
}

// --- Tên file và tên sheet --------------------------------------------------

// Windows cấm 9 ký tự trong tên file, macOS cấm dấu hai chấm. Dấu tiếng Việt thì
// GIỮ NGUYÊN: mọi hệ điều hành còn được hỗ trợ đều lưu tên file bằng UTF-8, và
// "Tài khoản người dùng.xlsx" là thứ quản trị viên tìm lại được trong thư mục
// Downloads — "Tai-khoan-nguoi-dung.xlsx" thì phải đoán.
export function safeFileName(name) {
  const cleaned = String(name || "bang-du-lieu")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Bỏ dấu chấm cuối: Windows lặng lẽ cắt nó đi và tên file thành khác hẳn
    .replace(/\.+$/, "")
    .slice(0, 120);

  return `${cleaned || "bang-du-lieu"}.xlsx`;
}

// Tên sheet có luật riêng và CHẶT HƠN tên file: tối đa 31 ký tự, cấm : \ / ? * [ ]
// và không được để trống. Vượt luật thì Excel từ chối mở, không phải tự sửa.
export function safeSheetName(name) {
  const cleaned = String(name || "Sheet1")
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);

  return cleaned || "Sheet1";
}

// --- Ngày giờ trong ô Excel -------------------------------------------------

/**
 * Mốc thời gian ISO → chuỗi "yyyy-mm-dd hh:mm" cho ô Excel.
 *
 * Cố ý KHÔNG dùng toLocaleString("vi-VN") như trên màn hình. Trên màn hình,
 * "19/08/2026 09:31" là cách đọc quen thuộc nhất; trong file Excel thì nó là một
 * cái bẫy — quản trị viên bấm sắp xếp cột đó sẽ nhận về thứ tự theo NGÀY TRONG
 * THÁNG (mọi ngày 01 đứng cạnh nhau, bất kể tháng nào). Dạng yyyy-mm-dd sắp xếp
 * đúng ngay cả khi Excel coi nó là chữ, và vẫn đọc được bằng mắt.
 */
export function dateTimeCell(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// --- Cửa chính --------------------------------------------------------------

/**
 * Dựng file .xlsx cho một bảng.
 *
 * @param {object}   table
 * @param {string}   table.name      Tên bảng — dùng cho cả tên file lẫn tên sheet
 * @param {Array}    table.columns   [{ header, value(row), width }]
 * @param {Array}    table.rows      Dữ liệu thô, đúng thứ tự đang hiện trên màn hình
 * @returns {{blob: Blob, fileName: string}}
 */
export function buildTableWorkbook({ name, columns, rows }) {
  const encoder = new TextEncoder();
  const sheetName = safeSheetName(name);

  // Đọc giá trị từng ô TRƯỚC khi sinh XML: hàm value() của nơi gọi có thể ném lỗi
  // trên một dòng dữ liệu lạ, và ném ở đây thì thấy ngay, còn ném giữa lúc ghép
  // chuỗi XML sẽ để lại một file cụt.
  const matrix = rows.map((row, index) =>
    columns.map((col) => {
      const value = typeof col.value === "function" ? col.value(row, index) : row[col.key];
      return value == null ? "" : value;
    })
  );

  const parts = [
    { name: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: encoder.encode(ROOT_RELS_XML) },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml(sheetName)) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(WORKBOOK_RELS_XML) },
    { name: "xl/styles.xml", data: encoder.encode(STYLES_XML) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml(columns, matrix)) }
  ];

  return { blob: zip(parts), fileName: safeFileName(name) };
}

/**
 * Dựng file rồi bảo trình duyệt tải về.
 *
 * Đi qua Blob + thẻ <a download> chứ không gọi máy chủ: dữ liệu của bảng đã nằm
 * sẵn trong trang rồi. Nhờ vậy nút này không tốn thêm một lượt gọi API, không
 * phải lo token hết hạn giữa chừng, và cái tải về LUÔN KHỚP với cái đang nhìn
 * thấy — kể cả khoảng ngày quản trị viên vừa chọn.
 */
export function downloadTableAsExcel(table) {
  const { blob, fileName } = buildTableWorkbook(table);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  // Firefox chỉ kích hoạt click khi thẻ đã nằm trong tài liệu
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Thu hồi ngay thì Safari huỷ luôn lượt tải đang bắt đầu — chờ một nhịp.
  // Không thu hồi thì mỗi lần bấm giữ lại vài trăm KB cho tới lúc đóng tab.
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return fileName;
}
