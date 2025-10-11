interface StorageItem<T> {
  value: T;
  expiry: number;
}

const ANALYTICS_STORAGE_PREFIX = "analytics_";

const DEFAULT_TTL = {
  VISITOR: 30 * 24 * 60 * 60 * 1000,
} as const;

export class AnalyticsStorage {
  private static isClient = typeof window !== "undefined";

  static setItem<T>(
    key: string,
    value: T,
    ttlMs: number = DEFAULT_TTL.VISITOR
  ): boolean {
    if (!this.isClient) return false;

    try {
      const item: StorageItem<T> = {
        value,
        expiry: Date.now() + ttlMs,
      };
      localStorage.setItem(
        `${ANALYTICS_STORAGE_PREFIX}${key}`,
        JSON.stringify(item)
      );
      return true;
    } catch (error) {
      console.warn("[Analytics] Failed to set localStorage item:", error);
      return false;
    }
  }

  static getItem<T>(key: string): T | null {
    if (!this.isClient) return null;

    try {
      const itemStr = localStorage.getItem(`${ANALYTICS_STORAGE_PREFIX}${key}`);
      if (!itemStr) return null;

      const item: StorageItem<T> = JSON.parse(itemStr);

      if (Date.now() > item.expiry) {
        localStorage.removeItem(`${ANALYTICS_STORAGE_PREFIX}${key}`);
        return null;
      }

      return item.value;
    } catch (error) {
      console.warn("[Analytics] Failed to get localStorage item:", error);
      return null;
    }
  }

  static removeItem(key: string): void {
    if (!this.isClient) return;

    try {
      localStorage.removeItem(`${ANALYTICS_STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.warn("[Analytics] Failed to remove localStorage item:", error);
    }
  }

  static setVisitor(visitorId: string): boolean {
    return this.setItem(
      `visitor_${visitorId}`,
      Date.now(),
      DEFAULT_TTL.VISITOR
    );
  }

  static hasVisitor(visitorId: string): boolean {
    return this.getItem<number>(`visitor_${visitorId}`) !== null;
  }

  static cleanupOldSessionEntries(): number {
    if (!this.isClient) return 0;

    let cleanedCount = 0;
    const obsoletePrefixes = [
      `${ANALYTICS_STORAGE_PREFIX}session_start_`,
      `${ANALYTICS_STORAGE_PREFIX}session_active_`,
    ];

    try {
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        for (const prefix of obsoletePrefixes) {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
            cleanedCount++;
            break;
          }
        }
      }
    } catch (error) {
      console.warn("[Analytics] Failed to cleanup old session entries:", error);
    }

    return cleanedCount;
  }

  static cleanupExpiredItems(): number {
    if (!this.isClient) return 0;

    let cleanedCount = 0;

    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      for (const key of keys) {
        if (!key.startsWith(ANALYTICS_STORAGE_PREFIX)) continue;

        try {
          const itemStr = localStorage.getItem(key);
          if (!itemStr) continue;

          const item = JSON.parse(itemStr);
          if (item.expiry && now > item.expiry) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        } catch {
          localStorage.removeItem(key);
          cleanedCount++;
        }
      }
    } catch (error) {
      console.warn("[Analytics] Failed to cleanup expired items:", error);
    }

    return cleanedCount;
  }

  static migrateOldFormat(): number {
    if (!this.isClient) return 0;

    let migratedCount = 0;
    const oldPrefixes = [
      "analytics_visitor_",
      "analytics_session_start_",
      "analytics_session_active_",
    ];

    try {
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        for (const prefix of oldPrefixes) {
          if (key.startsWith(prefix)) {
            const value = localStorage.getItem(key);
            if (value && !value.includes('"expiry":')) {
              localStorage.removeItem(key);
              migratedCount++;

              const keyParts = key.replace(prefix, "").split("_");
              if (prefix === "analytics_visitor_" && keyParts.length > 0) {
                const timestamp = parseInt(value);
                if (
                  !isNaN(timestamp) &&
                  Date.now() - timestamp < DEFAULT_TTL.VISITOR
                ) {
                  this.setVisitor(keyParts.join("_"));
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn("[Analytics] Failed to migrate old format:", error);
    }

    return migratedCount;
  }

  static getStorageSize(): { count: number; sizeBytes: number } {
    if (!this.isClient) return { count: 0, sizeBytes: 0 };

    let count = 0;
    let sizeBytes = 0;

    try {
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        if (key.startsWith(ANALYTICS_STORAGE_PREFIX)) {
          count++;
          const value = localStorage.getItem(key) || "";
          sizeBytes += key.length + value.length;
        }
      }
    } catch (error) {
      console.warn("[Analytics] Failed to calculate storage size:", error);
    }

    return { count, sizeBytes };
  }
}

export class AnalyticsSessionStorage {
  private static isClient = typeof window !== "undefined";

  static setItem<T>(key: string, value: T): boolean {
    if (!this.isClient) return false;

    try {
      sessionStorage.setItem(
        `${ANALYTICS_STORAGE_PREFIX}${key}`,
        JSON.stringify(value)
      );
      return true;
    } catch (error) {
      console.warn("[Analytics] Failed to set sessionStorage item:", error);
      return false;
    }
  }

  static getItem<T>(key: string): T | null {
    if (!this.isClient) return null;

    try {
      const itemStr = sessionStorage.getItem(
        `${ANALYTICS_STORAGE_PREFIX}${key}`
      );
      if (!itemStr) return null;

      return JSON.parse(itemStr);
    } catch (error) {
      console.warn("[Analytics] Failed to get sessionStorage item:", error);
      return null;
    }
  }

  static removeItem(key: string): void {
    if (!this.isClient) return;

    try {
      sessionStorage.removeItem(`${ANALYTICS_STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.warn("[Analytics] Failed to remove sessionStorage item:", error);
    }
  }
}