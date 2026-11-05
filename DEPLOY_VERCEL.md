# Triển khai GitHub → Vercel

## 1. Cập nhật backend trước

1. Sao lưu Google Sheet hiện có. Giữ riêng quyền sở hữu Sheet; user chỉ sử dụng web.
2. Thay toàn bộ nội dung **backend/Code.gs** trong Apps Script bằng bản này. Giữ file khởi tạo nếu đã có.
3. **Deploy → Manage deployments → Edit → New version → Deploy**. Chạy dưới quyền chủ Sheet; Web app phải truy cập được để frontend gửi request. Mỗi request dữ liệu vẫn cần token và kiểm tra quyền.
4. Giữ URL `/exec`. Không chạy lại khởi tạo account, không xóa Sheet cũ. JSON sẽ tự bổ sung revision khi cập nhật bản ghi.
5. Tài khoản cũ giữ mật khẩu. Lần đăng nhập thành công đầu tiên tự bảo vệ hash bằng pepper tại **Script Properties → SL_AUTH_PEPPER**. Không xóa/đổi thuộc tính này và không đưa nó vào GitHub/Vercel/frontend.

Backend mới hỗ trợ frontend cũ ở chế độ legacy, nhưng bản frontend mới nên đi cùng backend mới để dùng đầy đủ delta, revision, chống trùng và lịch sử phân trang.

## 2. Đưa source lên GitHub

Tạo repository **private**, giải nén source vào thư mục và push:

```bash
npm ci
npm test
npm run build
git init
git add .
git commit -m "Prepare production release"
git branch -M main
git remote add origin https://github.com/TEN_CUA_BAN/TEN_REPO.git
git push -u origin main
```

Nếu đã có repo thì cập nhật file và commit/push như bình thường. Không đưa `node_modules`, `dist`, `.env`, mật khẩu, token, dữ liệu Sheet thật hay bản sao Sheet vào repository. `.gitignore` đã loại các file build/local; `.env.example` chỉ có mẫu. CI tự chạy kiểm thử, audit dependency và build khi push/PR.

## 3. Import vào Vercel

Vercel → Add New Project → Import repo GitHub → Framework **Vite**. Cấu hình đã có trong `vercel.json`:

| Mục | Giá trị |
| --- | --- |
| Node.js | 22.x |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

Thêm Environment Variables cho môi trường Production (và Preview nếu cần):

| Biến | Giá trị |
| --- | --- |
| `SO_LIEU_API_URL` | URL Apps Script HTTPS kết thúc `/exec` |
| `SO_LIEU_SHEET_URL` | Link Sheet; có thể để trống nếu không muốn đưa link vào frontend |

Không đặt password, token hay `SL_AUTH_PEPPER` vào các biến này. Các biến URL được đưa vào `dist/config.js` nên có thể xem từ trình duyệt. Ứng dụng chỉ có đăng nhập thật qua API. Build trên Vercel sẽ thất bại nếu thiếu API hợp lệ. Không còn tùy chọn chế độ mẫu.

Nếu không dùng biến môi trường, bạn vẫn có thể sửa `public/config.js` rồi build; riêng trên Vercel cần cấu hình live đúng như trên. Chỉnh Environment Variables xong phải **Redeploy**. CSP, chống nhúng iframe và các security headers chỉ có hiệu lực sau khi triển khai lên Vercel; runtime config không cache.

## 4. Kiểm tra sau triển khai bằng dữ liệu thử

- Admin và user đăng nhập bằng tài khoản thật; F5 trở về màn đăng nhập theo yêu cầu.
- User chỉ nhận sản phẩm được giao và dữ liệu của mình. Thử sửa role local: UI có thể đổi nhưng request vượt quyền bị từ chối, hiện modal và đăng xuất.
- Chọn ngày/tháng khác, xem trạng thái tải; tổng khớp Sheet.
- Tạo báo cáo và vài đơn sale/chăm/upsale/chia/bùng. Sửa rồi tải lại kiểm tra số liệu.
- Chuyển dư từ cuối tháng trước sang tháng sau đúng, không cộng dư hai lần.
- Admin mở lịch sử sửa, thử Tải thêm nếu nhiều bản ghi.
- Mở cùng một đơn ở hai máy: lần lưu thứ hai của bản cũ phải báo xung đột; tải lại trước khi sửa tiếp.
- Kiểm tra mobile: thanh trên cùng cố định, menu cuộn, bảng cuộn ngang, modal biểu đồ đóng/mở đúng.

Source đã được kiểm thử tự động và build trong môi trường phát triển. Vẫn cần bước kiểm tra tích hợp này vì tài khoản Google/Sheet, deployment Apps Script và Vercel thật thuộc môi trường của bạn.

## Giới hạn vận hành

- Dữ liệu gửi về trình duyệt được giới hạn theo kỳ; server vẫn phải đọc các dòng JSON của Sheet để lọc và tính số dư. Cache chỉ tồn tại trong từng request, không cache quyền qua request.
- Apps Script/Sheets không có transaction nhiều bảng như database. Bản này gom và kiểm tra toàn bộ thay đổi trước khi ghi, dùng ScriptLock và gom các dòng liền nhau; lỗi dịch vụ Google giữa lúc ghi nhiều bảng vẫn có thể cần đối soát. Không tự động thử lại thao tác ghi bằng ID mới khi chưa biết kết quả.
- Cơ chế password/session tự xây vẫn cần chủ Sheet bảo vệ tài khoản Google và dự án Apps Script. Đây không phải chứng nhận kiểm toán bảo mật độc lập.
