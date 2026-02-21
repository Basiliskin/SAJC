import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";

export class EnumCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.ENUM;
  }

  encode(values: unknown[]): Buffer {
    const count = values.length;
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32LE(count, 0);

    if (count === 0) {
      return prefix;
    }

    const unique = Array.from(new Set(values));
    const uniqueCount = unique.length;

    const dictMap = new Map<unknown, number>();
    unique.forEach((v, i) => dictMap.set(v, i));

    const dictParts: Buffer[] = [Buffer.from([uniqueCount])];
    for (const u of unique) {
      if (u === null) {
        // Use 255 as a special length marker for null values
        dictParts.push(Buffer.from([255]));
      } else {
        const b = Buffer.from(String(u), "utf8");
        if (b.length >= 255) {
          throw new Error("Enum string too long (max 254 bytes)");
        }
        dictParts.push(Buffer.from([b.length]), b);
      }
    }

    if (uniqueCount > 16) {
      const indexBuf = Buffer.alloc(count);
      values.forEach((v, i) => (indexBuf[i] = dictMap.get(v)!));
      return Buffer.concat([prefix, ...dictParts, indexBuf]);
    }

    const packed = Buffer.alloc(Math.ceil(count / 2));
    for (let i = 0; i < count; i++) {
      const val = dictMap.get(values[i])!;
      if (i % 2 === 0) {
        packed[Math.floor(i / 2)] = val << 4;
      } else {
        packed[Math.floor(i / 2)] |= val;
      }
    }

    return Buffer.concat([prefix, ...dictParts, packed]);
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length < 4) {
      throw new Error("Enum buffer too short for count prefix");
    }

    let offset = 0;
    const count = buffer.readUInt32LE(offset);
    offset += 4;

    if (count === 0) return [];

    if (buffer.length < offset + 1) {
      throw new Error("Truncated unique count");
    }

    const uniqueCount = buffer[offset];
    offset += 1;

    const dictionary: (string | null)[] = [];
    for (let i = 0; i < uniqueCount; i++) {
      if (offset + 1 > buffer.length)
        throw new Error("Truncated dict entry length");
      const len = buffer[offset];
      offset += 1;

      if (len === 255) {
        dictionary.push(null);
      } else {
        if (offset + len > buffer.length)
          throw new Error("Truncated dict entry");
        const str = buffer.slice(offset, offset + len).toString("utf8");
        dictionary.push(str);
        offset += len;
      }
    }

    const result: (string | null)[] = new Array(count).fill(null);

    if (uniqueCount > 16) {
      const indexBuf = buffer.slice(offset);
      if (indexBuf.length < count) {
        throw new Error(
          `Enum decode underflow: got ${indexBuf.length} indices, expected ${count}`
        );
      }
      for (let i = 0; i < count; i++) {
        const val = indexBuf[i];
        if (val >= uniqueCount) {
          throw new Error(`Invalid dictionary index: ${val}`);
        }
        result[i] = dictionary[val];
      }
    } else {
      const packed = buffer.slice(offset);
      let idx = 0;
      for (let i = 0; i < packed.length * 2 && idx < count; i++) {
        const byte = packed[Math.floor(i / 2)];
        const val = i % 2 === 0 ? byte >> 4 : byte & 0x0f;
        if (val >= uniqueCount) {
          break;
        }
        result[idx++] = dictionary[val];
      }

      if (idx < count) {
        throw new Error(
          `Enum decode underflow: got ${idx} values, expected ${count}`
        );
      }
    }

    return result;
  }
}
