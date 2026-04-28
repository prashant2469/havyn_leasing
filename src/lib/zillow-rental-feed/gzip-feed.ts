import { gzipSync, type ZlibOptions } from "node:zlib";

/** Optional `.gz` payload for large feeds or SFTP drop scripts (per feed guide). */
export function gzipUtf8String(xml: string, zlibOptions?: ZlibOptions): Buffer {
  return gzipSync(Buffer.from(xml, "utf8"), zlibOptions);
}
