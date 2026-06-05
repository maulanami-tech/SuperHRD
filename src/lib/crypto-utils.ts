import { timingSafeEqual as nodeTimingSafeEqual } from "crypto";

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    nodeTimingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }

  return nodeTimingSafeEqual(bufA, bufB);
}
