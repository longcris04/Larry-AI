// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// --- Vá mấy API mà jsdom thiếu, còn trình duyệt thật thì có sẵn --------------
//
// jsdom bản đi kèm react-scripts 5 dừng trước khi TextEncoder/TextDecoder vào
// chuẩn, nên chúng KHÔNG có trong môi trường test. Trình duyệt thì đã có từ 2017
// (Chrome 38, Firefox 19, Safari 10.1) — tức là đây là lỗ hổng của môi trường
// test, không phải của mã nguồn.
//
// Không vá thì utils/xlsx.js (bộ ghi file Excel) không chạy nổi trong test, và
// cách "sửa" duy nhất còn lại là viết mã sản phẩm né tránh một API đã phổ cập.
import { TextDecoder, TextEncoder } from 'util';

if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

// Blob của jsdom cũng chưa có arrayBuffer(). Bài test đọc lại byte của file .xlsx
// vừa dựng bằng đúng hàm này.
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
