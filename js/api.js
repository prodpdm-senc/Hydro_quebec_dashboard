class APIClient {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.cache = new Map();
    this.ttl = new Map();
  }

  async fetch(endpoint, options = {}) {
    const { ttl = 10 * 60 * 1000, forceRefresh = false } = options;
    const cacheKey = endpoint;

    // Return cached if fresh and not forcing refresh
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const now = Date.now();
      const expTime = this.ttl.get(cacheKey);
      if (now < expTime) {
        console.log(`[Cache HIT] ${endpoint}`);
        return this.cache.get(cacheKey);
      }
    }

    try {
      console.log(`[Fetch] ${endpoint}`);
      const url = `${this.baseURL}${endpoint}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'Accept': 'application/json',
          ...options.headers
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type') || '';
      let data;

      if (contentType.includes('json')) {
        data = await res.json();
      } else if (contentType.includes('xml') || endpoint.includes('.xml')) {
        data = await res.text();
      } else {
        data = await res.text();
      }

      // Cache for specified TTL
      this.cache.set(cacheKey, data);
      this.ttl.set(cacheKey, Date.now() + ttl);

      return data;
    } catch (error) {
      console.error(`[Fetch ERROR] ${endpoint}:`, error.message);
      throw error;
    }
  }

  // Specific API routes
  async getDemande() {
    return this.fetch('/api/hydro-quebec/demande');
  }

  async getProduction() {
    return this.fetch('/api/hydro-quebec/production');
  }

  async getExchange() {
    return this.fetch('/api/hydro-quebec/exchange');
  }

  async getIESOData() {
    return this.fetch('/api/ieso/realtime');
  }

  async getOntarioData() {
    return this.getIESOData();
  }

  clearCache() {
    this.cache.clear();
    this.ttl.clear();
  }

  cacheStatus() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

window.api = new APIClient();
