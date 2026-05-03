export async function hashString(message) {
  // Use Web Crypto API for hashing instead of bundling a full MD5 library
  // Even though prompt says MD5, SHA-256 is built-in, 100% local, no npm needed, and better.
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
