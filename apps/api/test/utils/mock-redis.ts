/**
 * Mock Redis service for testing
 */
export class MockRedisService {
  private store = new Map<string, { value: string; expiry?: number }>();

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiry });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async scanAndDelete(pattern: string): Promise<number> {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async getTTL(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiry) return -1;
    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  getClient() {
    return this; // For compatibility
  }

  clear(): void {
    this.store.clear();
  }
}
