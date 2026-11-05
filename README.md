# Sổ Liệu — bản chuẩn bị triển khai

React + Vite, backend Google Apps Script, dữ liệu Google Sheets. Giao diện cho PC/mobile. Chỉ có đăng nhập tài khoản/mật khẩu qua máy chủ; không còn chế độ trải nghiệm, tài khoản chọn sẵn hay cơ sở dữ liệu trên localStorage.

Đọc **[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)** để triển khai GitHub → Vercel và **[REVIEW.md](REVIEW.md)** để xem thay đổi, kiểm thử và giới hạn.

## Chạy trên máy

Yêu cầu Node 22 hoặc 24.

```bash
npm ci
npm run dev
```

Điền URL Apps Script `/exec` vào `public/config.js`. Link Sheet có thể để trống. Thiếu URL API thì trang đăng nhập hiển thị thông báo cấu hình và không cho đăng nhập.

```js
window.APP_CONFIG = {
  appName: 'Sổ Liệu',
  apiUrl: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec',
  sheetUrl: '',
  currency: 'VND'
};
```

```bash
npm test
npm run build
npm run preview
```

Vercel dùng `SO_LIEU_API_URL` và tùy chọn `SO_LIEU_SHEET_URL`; file build tạo `dist/config.js`. Các URL này công khai. Không đưa mật khẩu, token hay pepper vào frontend/GitHub.

## Apps Script và các bảng

- Mở Google Sheet → Tiện ích mở rộng → Apps Script. Dán `backend/Code.gs` và cấu hình `backend/appsscript.json`.
- Cài mới: chạy `setup()` rồi `createInitialAdmin()`. Có thể dùng file khởi tạo tùy chọn `backend/KhoiTaoSoLieu.gs` để tạo cột và tài khoản ban đầu. Không tự chạy file khởi tạo khi cập nhật.
- Đã dùng bản trước: thay Code.gs và triển khai phiên bản Web app mới, giữ Sheet và Script Properties. Không tạo lại tài khoản.
- Web app chạy dưới quyền chủ Sheet và truy cập được từ frontend. Không chia sẻ quyền đọc/sửa Sheet gốc cho nhân viên.

Mỗi sheet dưới đây có **hai cột `id`, `json`**. API quản lý ID và các trường trong JSON, không thêm cột thủ công.

| Sheet | Nội dung |
| --- | --- |
| SL_Accounts | username, ownerName, role, active, revision và hash mật khẩu; API chỉ trả trường công khai |
| SL_Products | tên, giá USD, tỷ giá, active, revision |
| SL_Assignments | phân phối sản phẩm cho account |
| SL_Reports | ngày báo cáo, account, entries, trạng thái, revision và thời điểm gửi |
| SL_Orders | ngày, khách, sản phẩm, USD/tỷ giá/VNĐ, loại/chăm/chia/bùng, revision |
| SL_Targets | mục tiêu doanh thu/chăm/lương theo tháng và sản phẩm, giá chụp theo kỳ, revision |
| SL_Sessions | hash token ngẫu nhiên và thời hạn, không trả cho frontend |
| SL_Audit | thao tác, snapshot trước/sau báo cáo, receipt chống trùng |

## Nghiệp vụ

**Báo cáo ngày:** mặc định hôm qua theo giờ Việt Nam. Tiền mới nhận chỉ nhập phần nhận thêm. Dư chuyển sang lấy số dư cuối gần nhất của đúng account/sản phẩm, giữ qua ngày trống. Tổng khả dụng = dư chuyển sang + tiền mới nhận. Thừa cuối ngày của bảng mới mặc định 0 để tự nhập. Chi thực tế = tổng khả dụng − thừa cuối ngày; chi phí mess = chi thực tế ÷ tổng data. Bảng cũ không có `received` giữ ngân sách cũ để không cộng dư hai lần.

**Đơn hàng:** nhập trong bảng riêng, số tiền do user nhập, không gán mặc định từ giá sản phẩm. Đơn chia tính 0,5; doanh thu vẫn theo số tiền nhập. Upsale hoặc tick Chăm thuộc doanh thu chăm, theo dõi riêng với bán hàng. Bùng chỉ có khi sửa, loại khỏi số đơn/doanh thu và hiển thị nền tối; bỏ tick thì khôi phục. Desktop nhập nhiều dòng, bỏ qua dòng trống và bắt chọn sản phẩm; mobile thêm từng đơn.

**Tổng quan:** chọn ngày, khoảng ngày hoặc tháng; admin mặc định hôm qua và có bộ lọc account/sản phẩm. Tỷ lệ chi phí/DS = tổng chi thực tế ÷ tổng doanh thu bán hàng. Mẫu số bằng 0 trả 0. Tổng/trung bình dùng tổng số và đúng số account-ngày đã gửi, không cộng các tỷ lệ. Mục tiêu = mục tiêu đầy đủ của các tháng chạm khoảng đang chọn, không chia theo ngày.

**Mục tiêu tháng:** user sửa mục tiêu của mình với sản phẩm đang được giao; admin xem/sửa từng account. Giá do admin quản lý và chụp theo kỳ. Số đơn cần đạt = làm tròn lên(mục tiêu doanh thu ÷ giá VNĐ), TB/ngày chia số ngày thật trong tháng. Doanh thu chăm là mục riêng. Có tổng tất cả.

**Phân quyền:** admin xem/sửa báo cáo/đơn đã có, quản lý sản phẩm, account, role và phân phối. User chỉ dữ liệu của mình. Xóa user là xóa mềm, thu hồi phiên/quyền nhập và giữ lịch sử. Không hạ quyền admin cuối cùng đang hoạt động. Report đã gửi được sửa và ghi lịch sử; revision chặn ghi đè khi dữ liệu ở máy khác đã thay đổi.

## Luồng dữ liệu và bảo mật

- Đăng nhập trả dữ liệu ban đầu trong cùng request. Đổi menu không gọi bước xác minh riêng. Mỗi request dữ liệu gửi token, máy chủ đọc quyền hiện tại.
- Token giữ trong sessionStorage của tab; F5/tải lại vẫn giữ phiên và tải lại dữ liệu qua backend. Role hiển thị cục bộ không cấp quyền máy chủ. Chỉ token sai/hết hạn hoặc tài khoản không còn hoạt động mới tự đăng xuất. Thiếu quyền hiện modal và giữ phiên; lỗi nhập liệu hoặc mạng cho phép thử lại.
- Snapshot chỉ gửi báo cáo/đơn/mục tiêu theo kỳ, kèm ngữ cảnh số dư trước kỳ. Khoảng xem tối đa 367 ngày mỗi lần. Lịch sử sửa tải khi mở và có Tải thêm.
- Lưu trả delta các bản ghi thay đổi. Request ID và ID nghiệp vụ ổn định hỗ trợ retry không tạo trùng. Không đổi dữ liệu hay F5 khi chưa biết một lần lưu đã thành công hay chưa; kiểm tra lại danh sách nếu có lỗi kéo dài.
- Apps Script memo dữ liệu trong từng request, kiểm tra trước khi ghi, gom dòng liền nhau và dùng ScriptLock. Không cache quyền giữa các request.
- Mật khẩu PBKDF2-HMAC-SHA256 có salt và được HMAC thêm bằng pepper riêng ở Script Properties. Password cũ nâng cấp khi đăng nhập thành công. Không xóa `SL_AUTH_PEPPER`, không công khai dự án Apps Script.
- CSV escape công thức. Frontend không chèn HTML từ dữ liệu người dùng. Vercel có CSP/security headers; biến cấu hình công khai không chứa thông tin xác thực.

## Cấu trúc

```text
src/                    React, API client, tính toán, component và quản lý cửa sổ dữ liệu
backend/Code.gs         Backend cần cập nhật trong Apps Script
backend/KhoiTaoSoLieu.gs File tạo bảng/tài khoản ban đầu tùy chọn
public/config.js        URL cấu hình công khai
scripts/                Kiểm tra và xuất config cho build
vercel.json             Cấu hình Vercel và headers
.github/workflows/      Kiểm thử/build/audit khi push hoặc PR
tests/                  Kiểm thử + fixture chỉ dùng kiểm thử, không đưa vào frontend build
```

Chưa có thao tác push GitHub hay triển khai Vercel vào tài khoản của bạn trong phiên chuẩn bị này. Các giới hạn Sheets/Apps Script và các bước kiểm tra thật trước vận hành nằm trong `DEPLOY_VERCEL.md`.

### Nhập báo cáo tuần tự

- User chỉ nhập/sửa trong 7 ngày gần nhất đến hết hôm qua, theo giờ Việt Nam.
- Chưa có lịch sử: được chọn ngày đầu ngay trong khoảng này, không phải điền bù trước ngày bắt đầu.
- Sau mốc đầu: phải gửi từng ngày trước khi nhập ngày sau; bản nháp chưa được tính. Ngày không phát sinh vẫn gửi đủ các ô số 0.
- Có lịch sử từ trước cửa sổ 7 ngày: bổ sung ngày thiếu từ đầu cửa sổ, không phải bổ sung toàn bộ lịch sử.
- Admin được sửa báo cáo lịch sử đã có. Sửa số dư sẽ tính lại các báo cáo sau, tăng phiên bản và ghi lịch sử; nếu số dư sau vượt ngân sách thì từ chối lưu, không âm thầm ghi sai.
