/**
 * AuthService - Dịch vụ Xác thực & Đăng nhập Google (Google Sign-In / GIS)
 * Quản lý phiên làm việc của Giám thị / Ban Thi đua / Giáo viên
 */

class AuthService {
  constructor() {
    this.clientId = localStorage.getItem('google_client_id') || '';
    this.currentUser = this.loadUser();
    this.listeners = [];
  }

  loadUser() {
    try {
      const saved = localStorage.getItem('school_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  saveUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('school_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('school_auth_user');
    }
    this.notifyListeners();
  }

  getClientId() {
    return localStorage.getItem('google_client_id') || '';
  }

  setClientId(id) {
    this.clientId = (id || '').trim();
    localStorage.setItem('google_client_id', this.clientId);
    this.initGoogleClient();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.currentUser);
      } catch (err) {
        console.error('Lỗi listener auth:', err);
      }
    });
  }

  /**
   * Khởi tạo Google Identity Services nếu có Client ID
   */
  initGoogleClient() {
    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.id) {
      return;
    }

    const clientId = this.getClientId();
    if (!clientId) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.handleGoogleCredential(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Render button nếu phần tử tồn tại
      const btnContainer = document.getElementById('g-id-signin-btn');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'medium',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left'
        });
      }
    } catch (e) {
      console.warn('Không thể khởi tạo Google GIS:', e);
    }
  }

  /**
   * Giải mã JWT token trả về từ Google Sign-In
   */
  handleGoogleCredential(response) {
    try {
      const jwtToken = response.credential;
      const base64Url = jwtToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const profile = JSON.parse(jsonPayload);

      const user = {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
        role: 'Ban Giám Thị',
        authProvider: 'google',
        loginTime: new Date().toISOString()
      };

      this.saveUser(user);
    } catch (err) {
      console.error('Lỗi giải mã token Google:', err);
      alert('Đăng nhập Google thất bại: ' + err.message);
    }
  }

  /**
   * Đăng nhập nhanh với tài khoản Giám thị mẫu (Demo Account)
   * Giúp giáo viên & giám thị sử dụng ngay lập tức mà không cần tạo Client ID
   */
  loginDemo(role = 'Ban Giám Thị', name = 'Thầy Nguyễn Bảo Ninh', email = 'giamthi@thptlehongphong.edu.vn') {
    const user = {
      id: 'demo_' + Date.now(),
      name: name,
      email: email,
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1d4ed8&color=fff&rounded=true&bold=true`,
      role: role,
      authProvider: 'demo',
      loginTime: new Date().toISOString()
    };
    this.saveUser(user);
    return user;
  }

  /**
   * Đăng xuất
   */
  logout() {
    this.saveUser(null);
    if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (e) { }
    }
  }
}

// Khởi tạo global authService
window.authService = new AuthService();
