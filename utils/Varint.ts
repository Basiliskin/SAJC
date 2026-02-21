/**
 * Utility class for LEB128 Variable-Length Integer encoding and decoding.
 * Used to compress integers (like array lengths and time deltas) to save space.
 */
export class Varint {
  /**
   * Encodes an unsigned 32-bit integer into a LEB128 Buffer.
   */
  static encode(value: number): Buffer {
    if (value < 0) {
      throw new Error("Varint.encode only supports unsigned integers");
    }

    const bytes: number[] = [];
    let val = value;

    do {
      let byte = val & 0x7f;
      val >>>= 7;
      if (val !== 0) {
        byte |= 0x80;
      }
      bytes.push(byte);
    } while (val !== 0);

    return Buffer.from(bytes);
  }

  /**
   * Decodes an unsigned 32-bit integer from a LEB128 Buffer.
   * Returns the decoded value and the number of bytes read.
   */
  static decode(
    buffer: Buffer,
    offset: number = 0
  ): { value: number; bytesRead: number } {
    let value = 0;
    let shift = 0;
    let bytesRead = 0;

    while (true) {
      if (offset + bytesRead >= buffer.length) {
        throw new Error("Varint decode out of bounds");
      }

      const byte = buffer[offset + bytesRead];
      bytesRead++;

      value |= (byte & 0x7f) << shift;

      if ((byte & 0x80) === 0) {
        break;
      }

      shift += 7;
      if (shift > 35) {
        throw new Error("Varint too long for 32-bit integer");
      }
    }

    return { value: value >>> 0, bytesRead }; // Ensure unsigned
  }

  /**
   * Encodes a signed BigInt into a LEB128 Buffer using ZigZag encoding.
   * ZigZag encoding maps signed integers to unsigned integers so that
   * numbers with a small absolute value have a small varint encoded value.
   */
  static encodeBigInt(value: bigint): Buffer {
    const bytes: number[] = [];
    // ZigZag encoding: (n << 1) ^ (n >> 63)
    let zigzag = (value << 1n) ^ (value >> 63n);

    do {
      let byte = Number(zigzag & 0x7fn);
      zigzag >>= 7n;
      if (zigzag !== 0n) {
        byte |= 0x80;
      }
      bytes.push(byte);
    } while (zigzag !== 0n);

    return Buffer.from(bytes);
  }

  /**
   * Decodes a signed BigInt from a LEB128 Buffer using ZigZag decoding.
   */
  static decodeBigInt(
    buffer: Buffer,
    offset: number = 0
  ): { value: bigint; bytesRead: number } {
    let zigzag = 0n;
    let shift = 0n;
    let bytesRead = 0;

    while (true) {
      if (offset + bytesRead >= buffer.length) {
        throw new Error("Varint decode out of bounds");
      }

      const byte = BigInt(buffer[offset + bytesRead]);
      bytesRead++;

      zigzag |= (byte & 0x7fn) << shift;

      if ((byte & 0x80n) === 0n) {
        break;
      }

      shift += 7n;
    }

    // ZigZag decoding: (n >>> 1) ^ -(n & 1)
    const value = (zigzag >> 1n) ^ -(zigzag & 1n);
    return { value, bytesRead };
  }
}
