import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
import { Varint } from "../utils/Varint";

/**
 * Adaptively encodes numbers.
 * 1. Integer Mode: If all numbers are integers, uses ZigZag Varints.
 * 2. Decimal Mode: If all numbers fit a fixed decimal scale (e.g. prices), uses Scaled Integers.
 * 3. Float Mode: Fallback to standard Float64.
 */
export class NumberCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.NUMBER;
  }

  encode(values: unknown[]): Buffer {
    const nums = values as number[];
    if (nums.length === 0) return Buffer.alloc(0);

    // 1. Check for Integers
    const isAllIntegers = nums.every(
      (n) => typeof n === "number" && Number.isInteger(n)
    );

    if (isAllIntegers) {
      const buffers: Buffer[] = [Buffer.from([0x01])]; // 0x01 = Integer Mode
      for (const n of nums) {
        buffers.push(Varint.encodeBigInt(BigInt(n)));
      }
      return Buffer.concat(buffers);
    }

    // 2. Check for Fixed-Point Decimals (Smart Decimal Encoding)
    // Try scales from 1 to 6 (e.g. 12.34 -> 1234 with scale 2)
    let bestScale = -1;
    for (let scale = 1; scale <= 6; scale++) {
      const multiplier = Math.pow(10, scale);
      const isFixedPoint = nums.every((n) => {
        const scaled = n * multiplier;
        // Check if scaled value is effectively an integer (tolerance for float math)
        return Math.abs(scaled - Math.round(scaled)) < 1e-9;
      });

      if (isFixedPoint) {
        bestScale = scale;
        break; // Found the smallest working scale
      }
    }

    if (bestScale !== -1) {
      const buffers: Buffer[] = [Buffer.from([0x02])]; // 0x02 = Decimal Mode
      buffers.push(Buffer.from([bestScale])); // Store scale (1 byte)

      const multiplier = Math.pow(10, bestScale);
      for (const n of nums) {
        const scaled = Math.round(n * multiplier);
        buffers.push(Varint.encodeBigInt(BigInt(scaled)));
      }
      return Buffer.concat(buffers);
    }

    // 3. Fallback to Float64
    const buffer = Buffer.alloc(1 + nums.length * 8);
    buffer[0] = 0x00; // 0x00 = Float Mode

    for (let i = 0; i < nums.length; i++) {
      buffer.writeDoubleLE(nums[i], 1 + i * 8);
    }

    return buffer;
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length === 0) return [];

    const mode = buffer[0];
    const values: number[] = [];
    let offset = 1;

    if (mode === 0x01) {
      // Integer Mode
      while (offset < buffer.length) {
        const { value, bytesRead } = Varint.decodeBigInt(buffer, offset);
        values.push(Number(value));
        offset += bytesRead;
      }
    } else if (mode === 0x02) {
      // Decimal Mode
      const scale = buffer[offset++];
      const divisor = Math.pow(10, scale);

      while (offset < buffer.length) {
        const { value, bytesRead } = Varint.decodeBigInt(buffer, offset);
        values.push(Number(value) / divisor);
        offset += bytesRead;
      }
    } else {
      // Float Mode
      for (; offset < buffer.length; offset += 8) {
        values.push(buffer.readDoubleLE(offset));
      }
    }

    return values;
  }
}
