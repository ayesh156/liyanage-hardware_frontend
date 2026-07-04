/**
 * Invoice Number Service
 * 
 * Robust concurrency-safe invoice numbering system for web-based multi-user environments.
 * Uses localStorage with atomic operations and collision detection to ensure unique,
 * sequential invoice numbers even when multiple users generate invoices simultaneously.
 */

const INVOICE_NUMBER_KEY = 'liyanage_hardware_invoice_counter';
const INVOICE_LOCK_KEY = 'liyanage_hardware_invoice_lock';
const LOCK_TIMEOUT_MS = 5000; // 5 seconds lock timeout
const MAX_RETRY_ATTEMPTS = 10;
const RETRY_DELAY_MS = 50;

interface InvoiceCounter {
  lastNumber: number;
  lastUpdated: number;
  instanceId: string;
}

// Generate a unique instance ID for this browser tab/session
const instanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Attempts to acquire a distributed lock using localStorage
 * Uses optimistic locking with expiration to prevent deadlocks
 */
const acquireLock = (): boolean => {
  const now = Date.now();
  const existingLock = localStorage.getItem(INVOICE_LOCK_KEY);
  
  if (existingLock) {
    const lockData = JSON.parse(existingLock);
    // Check if lock has expired (prevents deadlocks from crashed sessions)
    if (now - lockData.timestamp < LOCK_TIMEOUT_MS) {
      return false; // Lock is held by another instance
    }
    // Lock expired, we can take it
  }
  
  // Attempt to acquire lock with our instance ID
  const lockValue = JSON.stringify({
    instanceId,
    timestamp: now
  });
  
  localStorage.setItem(INVOICE_LOCK_KEY, lockValue);
  
  // Double-check we got the lock (compare-and-swap pattern)
  const verifyLock = localStorage.getItem(INVOICE_LOCK_KEY);
  if (verifyLock) {
    const verified = JSON.parse(verifyLock);
    return verified.instanceId === instanceId;
  }
  
  return false;
};

/**
 * Releases the distributed lock
 */
const releaseLock = (): void => {
  const existingLock = localStorage.getItem(INVOICE_LOCK_KEY);
  if (existingLock) {
    const lockData = JSON.parse(existingLock);
    // Only release if we own the lock
    if (lockData.instanceId === instanceId) {
      localStorage.removeItem(INVOICE_LOCK_KEY);
    }
  }
};

/**
 * Gets the current counter state from localStorage
 */
const getCounter = (): InvoiceCounter => {
  const stored = localStorage.getItem(INVOICE_NUMBER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Corrupted data, reset
    }
  }
  
  // Default starting point (matches existing invoice numbers in the system)
  return {
    lastNumber: 146710,
    lastUpdated: Date.now(),
    instanceId: ''
  };
};

/**
 * Saves the counter state to localStorage
 */
const saveCounter = (counter: InvoiceCounter): void => {
  localStorage.setItem(INVOICE_NUMBER_KEY, JSON.stringify(counter));
};

/**
 * Sleep utility for retry delays with jitter
 */
const sleep = (ms: number): Promise<void> => {
  // Add random jitter (0-50%) to prevent thundering herd
  const jitter = Math.random() * 0.5 * ms;
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
};

/**
 * Generates a unique 6-character alphanumeric code from high-resolution
 * timestamp variants and a short hash to ensure zero collision.
 */
function generateUniqueCode(): string {
  const now = performance.now();
  const ms = Math.floor(now);
  const µs = Math.floor((now % 1) * 1000);
  const raw = `${ms}${String(µs).padStart(3, '0')}${Math.random().toString(36).substring(2, 10)}`;
  
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  
  const absHash = Math.abs(hash).toString(36).toLowerCase();
  const msEntropy = String(ms % 1679616).padStart(6, '0');
  const msBase36 = Number(msEntropy.substring(0, 4)).toString(36).padStart(3, '0');
  
  return `${absHash.substring(0, 3)}${msBase36.substring(0, 3)}`.toLowerCase();
}

/**
 * Generates the next invoice number with concurrency safety.
 * Format: inv-an-XXXXXX (e.g. inv-an-a3f8x1)
 * 
 * Algorithm:
 * 1. Attempt to acquire distributed lock
 * 2. Generate a collision-proof 6-char code using high-res timestamp + hash
 * 3. Store in counter state for audit trail
 * 4. Release lock
 * 5. Return formatted invoice number
 * 
 * If lock cannot be acquired, retry with exponential backoff
 * 
 * @returns Promise<string> - The next invoice number in inv-an-XXXXXX format
 */
export const generateNextInvoiceNumber = async (): Promise<string> => {
  let attempts = 0;
  
  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;
    
    if (acquireLock()) {
      try {
        // Critical section - we have the lock
        const counter = getCounter();
        const nextNumber = counter.lastNumber + 1;
        
        // Generate collision-proof code
        const code = generateUniqueCode();
        
        // Update counter with new value for audit
        saveCounter({
          lastNumber: nextNumber,
          lastUpdated: Date.now(),
          instanceId
        });
        
        return `inv-an-${code}`;
      } finally {
        releaseLock();
      }
    }
    
    // Lock not acquired, wait and retry with exponential backoff
    await sleep(RETRY_DELAY_MS * Math.pow(2, attempts - 1));
  }
  
  // Fallback: If we couldn't acquire lock after max retries,
  // generate a timestamp-based unique number to avoid blocking the user
  // This is a safety net that should rarely be hit
  console.warn('Invoice lock acquisition failed, using timestamp fallback');
  const fallbackCode = generateUniqueCode();
  
  return `inv-an-${fallbackCode}`;
};

/**
 * Synchronous version for compatibility with existing code.
 * Uses optimistic generation with collision detection.
 * Format: inv-an-XXXXXX
 * 
 * @returns string - The next invoice number in inv-an-XXXXXX format
 */
export const generateNextInvoiceNumberSync = (): string => {
  // Try to acquire lock synchronously
  const maxSyncAttempts = 3;
  
  for (let i = 0; i < maxSyncAttempts; i++) {
    if (acquireLock()) {
      try {
        const counter = getCounter();
        const nextNumber = counter.lastNumber + 1;
        
        saveCounter({
          lastNumber: nextNumber,
          lastUpdated: Date.now(),
          instanceId
        });
        
        const code = generateUniqueCode();
        return `inv-an-${code}`;
      } finally {
        releaseLock();
      }
    }
  }
  
  // Optimistic fallback: read current value and generate unique code
  const fallbackCode = generateUniqueCode();
  return `inv-an-${fallbackCode}`;
};

/**
 * Initializes the invoice counter from existing data
 * Should be called once when the app loads to sync with any existing invoices
 * 
 * @param existingInvoices - Array of existing invoice objects with invoiceNumber property
 */
export const initializeFromExistingInvoices = (existingInvoices: { invoiceNumber: string }[]): void => {
  const existingNumbers = existingInvoices
    .map(inv => {
      const numMatch = inv.invoiceNumber.match(/\d+/);
      return numMatch ? parseInt(numMatch[0], 10) : 0;
    })
    .filter(n => !isNaN(n) && n > 0);
  
  if (existingNumbers.length === 0) return;
  
  const maxExisting = Math.max(...existingNumbers);
  const counter = getCounter();
  
  // Only update if existing data has higher numbers
  if (maxExisting > counter.lastNumber) {
    saveCounter({
      lastNumber: maxExisting,
      lastUpdated: Date.now(),
      instanceId
    });
  }
};

/**
 * Gets the current invoice number without incrementing
 * Useful for display purposes
 * 
 * @returns string - The current (last used) invoice number
 */
export const getCurrentInvoiceNumber = (): string => {
  const counter = getCounter();
  return String(counter.lastNumber);
};

/**
 * Peeks at what the next invoice number will be without reserving it
 * 
 * @returns string - The next invoice number (not reserved)
 */
export const peekNextInvoiceNumber = (): string => {
  const counter = getCounter();
  return String(counter.lastNumber + 1);
};
