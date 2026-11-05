/**
 * SO LIEU - KHOI TAO COT / KEY VA 2 TAI KHOAN
 * 1. Trong cung du an Apps Script dang co Code.gs, bam + > Script.
 * 2. Dat ten KhoiTaoSoLieu, dan toan bo file nay, luu.
 * 3. Chon ham khoiTaoSoLieu > Chay; quay lai tab Sheet xem ket qua.
 * Khong can chay createInitialAdmin() nua neu admin da duoc tao o day.
 * Khong thay Code.gs bang file nay: file nay dung cac ham ma hoa cua Code.gs.
 * Moi bang van chi co 2 cot id, json, dung voi React/API hien tai.
 * Ten cac key trong json duoc ghi chu o o B1, KHONG them cot rieng.
 * Mat khau ngau nhien hien mot lan trong hop thoai, khong ghi vao log/Sheet.
 * Chay lai khong doi mat khau, khong tao trung, khong xoa du lieu.
 */
function khoiTaoSoLieu() {
  if (typeof passwordRecord_ !== 'function' || typeof put_ !== 'function') {
    throw new Error('Can dan backend/Code.gs vao cung du an Apps Script truoc.');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Mo Apps Script tu Sheet: Tien ich mo rong > Apps Script.');
  var ui = SpreadsheetApp.getUi();
  var schemas = slInitSchemas_();
  var lock = LockService.getScriptLock();
  var result = [];
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getScriptProperties();
    var boundId = props.getProperty('SL_SPREADSHEET_ID');
    if (boundId && boundId !== ss.getId()) {
      throw new Error('API da gan voi Sheet khac. Khong tu dong doi lien ket.');
    }
    // Kiem tra TOAN BO tieu de truoc khi ghi de tranh de len du lieu cu.
    Object.keys(schemas).forEach(function(name) {
      var sheet = ss.getSheetByName('SL_' + name);
      if (!sheet) return;
      var header = sheet.getRange(1, 1, 1, 2).getValues()[0];
      var empty = header[0] === '' && header[1] === '';
      if (!empty && !(header[0] === 'id' && header[1] === 'json')) {
        throw new Error('SL_' + name + ': A1:B1 phai trong hoac la id | json. Chua thay doi du lieu.');
      }
    });
    Object.keys(schemas).forEach(function(name) {
      var sheet = ss.getSheetByName('SL_' + name) || ss.insertSheet('SL_' + name);
      sheet.getRange(1, 1, 1, 2).setValues([['id', 'json']])
        .setBackground('#17644e').setFontColor('#ffffff').setFontWeight('bold');
      sheet.getRange(1, 1).setNote('ID duy nhat do backend tu tao. Khong sua tay.');
      sheet.getRange(1, 2).setNote(schemas[name]);
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 260);
      sheet.setColumnWidth(2, 900);
    });
    props.setProperty('SL_SPREADSHEET_ID', ss.getId());
    var accounts = read_('Accounts');
    var specifications = [
      { username: 'admin', ownerName: 'Chu so huu', role: 'admin' },
      { username: 'user', ownerName: 'Nhan vien 01', role: 'user' }
    ];
    // Kiem tra xung dot quyen truoc khi tao bat ky tai khoan nao.
    specifications.forEach(function(spec) {
      var old = accounts.find(function(a) {
        return String(a.username).toLowerCase() === spec.username;
      });
      if (old && old.role !== spec.role) {
        throw new Error('Ten ' + spec.username + ' da ton tai voi quyen khac. Khong doi quyen tai khoan cu.');
      }
    });
    // Ma hoa truoc khi ghi; khong luu mat khau ro vao Sheet hay Script Properties.
    var pending = specifications.map(function(spec) {
      var old = accounts.find(function(a) {
        return String(a.username).toLowerCase() === spec.username;
      });
      if (old) return { existing: true, spec: spec };
      var password = 'SL!' + uuid_().replace(/-/g, '').slice(0, 20);
      return {
        spec: spec,
        password: password,
        record: Object.assign({ id: uuid_(), active: true }, spec, passwordRecord_(password))
      };
    });
    pending.forEach(function(item) {
      if (item.existing) {
        result.push(item.spec.username + ' (' + item.spec.role + '): da co, giu nguyen mat khau va trang thai.');
      } else {
        put_('Accounts', item.record);
        result.push('Dang nhap: ' + item.spec.username + '\nQuyen: ' + item.spec.role + '\nMat khau: ' + item.password);
      }
    });
    SpreadsheetApp.flush();
  } finally {
    // Luon tha lock TRUOC khi mo hop thoai (UI alert tam dung script).
    lock.releaseLock();
  }
  ui.alert('Khoi tao So Lieu hoan tat',
    'Da tao/kiem tra 8 bang, tieu de id | json. Xem ghi chu B1 de biet cac key.\n\n' +
    result.join('\n\n') +
    '\n\nLuu mat khau moi ngay: dong hop thoai se khong xem lai duoc.' +
    '\nUser chua co san pham: dang nhap admin de them san pham va phan phoi.' +
    '\nFrontend: demoMode=false va apiUrl la link /exec.', ui.ButtonSet.OK);
}

function slInitSchemas_() {
  return {
    Accounts: 'id, username, ownerName, role (admin/user), active, salt, iterations, passwordHash. Mat khau duoc bam bang ham trong Code.gs.',
    Products: 'id, name, priceUsd, rate, active, color, updatedAt. Gia VND = priceUsd * rate.',
    Assignments: 'id, accountId, productId, active, updatedAt. accountId va productId tham chieu ID tu cac bang tuong ung.',
    Reports: 'id, accountId, date (YYYY-MM-DD), status (draft/submitted), revision, updatedAt, submittedAt, entries[]. Moi entry: productId, budget, remaining, data, tt, ktt, success, upsale, appointments, late.',
    Orders: 'id, accountId, productId, date (YYYY-MM-DD), customerName, type (sale/care/upsale), isCare (boolean), isSplit (boolean; true = 0.5 don), amountUsd, rate, amountVnd, createdAt, updatedAt.',
    Targets: 'id, accountId, productId, month (YYYY-MM), revenue, care, salary, priceUsd, rate, updatedAt.',
    Sessions: 'id (token da bam), accountId, expires (mili giay). Backend tu quan ly khi dang nhap.',
    Audit: 'id, actorId, action, details, time. Backend tu ghi lich su thao tac.'
  };
}
