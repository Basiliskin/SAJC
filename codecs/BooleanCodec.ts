import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
import { Varint } from "../utils/Varint";

/**
 * Encodes boolean values by bit-packing 8 booleans into a single byte.
 * Reduces boolean column storage size by ~87.5%.
 */
export class BooleanCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.BOOLEAN;
  }

  encode(values: unknown[]): Buffer {
    const count = values.length;
    if (count === 0) return Buffer.alloc(0);

    // Write the exact number of booleans so we don't decode padding bits
    const countBuf = Varint.encode(count);

    // Allocate 1 byte for every 8 booleans
    const dataLen = Math.ceil(count / 8);
    const dataBuf = Buffer.alloc(dataLen);

    for (let i = 0; i < count; i++) {
      if (values[i]) {
        // Set the corresponding bit
        dataBuf[Math.floor(i / 8)] |= 1 << i % 8;
      }
    }

    return Buffer.concat([countBuf, dataBuf]);
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length === 0) return [];

    const { value: count, bytesRead } = Varint.decode(buffer, 0);
    const values: boolean[] = [];
    let offset = bytesRead;

    for (let i = 0; i < count; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;

      // Check if the corresponding bit is set
      const val = (buffer[offset + byteIdx] & (1 << bitIdx)) !== 0;
      values.push(val);
    }

    return values;
  }
}
