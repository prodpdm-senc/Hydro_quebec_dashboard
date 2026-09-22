class StorageUtils {
  static setWithTTL(key, value, ttlMs = 3600000) {
    try {
      const data = {
        value,
        exp: Date.now() + ttlMs
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Storage write failed:', e);
    }
  }

  static getIfFresh(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const { value, exp } = JSON.parse(item);
      if (Date.now() > exp) {
        localStorage.removeItem(key);
        return null;
      }
      return value;
    } catch (e) {
      console.error('Storage read failed:', e);
      return null;
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage remove failed:', e);
    }
  }

  static clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Storage clear failed:', e);
    }
  }

  static getAll() {
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const item = localStorage.getItem(key);
        try {
          result[key] = JSON.parse(item);
        } catch {
          result[key] = item;
        }
      }
    } catch (e) {
      console.error('Storage getAll failed:', e);
    }
    return result;
  }
}
