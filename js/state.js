class DashboardStore {
  constructor() {
    this.state = {
      demande: null,
      production: null,
      nuclear: null,
      exchange: null,
      ontario: null,
      history: null,
      lastUpdate: null,
      theme: StorageUtils.getIfFresh('theme') || 'light',
      loading: {},
      errors: {}
    };
    this.listeners = [];
    this.pendingRequests = new Map();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  setState(key, value) {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.notify();
    }
  }

  getState(key) {
    return key ? this.state[key] : this.state;
  }

  updateState(updates) {
    let changed = false;
    Object.entries(updates).forEach(([key, value]) => {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changed = true;
      }
    });
    if (changed) this.notify();
  }

  setLoading(key, isLoading) {
    this.state.loading[key] = isLoading;
    this.notify();
  }

  setError(key, error) {
    this.state.errors[key] = error;
    this.notify();
  }

  clearError(key) {
    delete this.state.errors[key];
    this.notify();
  }

  notify() {
    this.listeners.forEach(cb => cb(this.state));
  }

  // Request deduplication
  getPendingRequest(key) {
    return this.pendingRequests.get(key);
  }

  setPendingRequest(key, promise) {
    this.pendingRequests.set(key, promise);
    return promise.finally(() => {
      this.pendingRequests.delete(key);
    });
  }
}

window.store = new DashboardStore();
