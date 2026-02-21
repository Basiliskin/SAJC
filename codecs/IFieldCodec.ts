import { FieldType } from "../schema/FieldType";

export interface IFieldCodec {
  supports(type: FieldType): boolean;
  encode(values: unknown[]): Buffer;
  decode(buffer: Buffer): unknown[];
}

export class DictionaryStringCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.STRING || type === FieldType.ENUM;
  }

  encode(values: unknown[]): Buffer {
    const strings = values as string[];
    const unique = Array.from(new Set(strings));

    if (unique.length > 256) {
      return this.encodeRaw(strings);
    }

    const dictMap = new Map<string, number>();
    unique.forEach((v, i) => dictMap.set(v, i));

    const dictBuffers: Buffer[] = [];
    const dictSize = Buffer.alloc(2);
    dictSize.writeUInt16LE(unique.length, 0);
    dictBuffers.push(dictSize);

    for (const entry of unique) {
      const buf = Buffer.from(entry, "utf8");
      dictBuffers.push(Buffer.from([buf.length]));
      dictBuffers.push(buf);
    }

    const indexStream = Buffer.alloc(strings.length);
    strings.forEach((v, i) => {
      indexStream[i] = dictMap.get(v)!;
    });

    return Buffer.concat([...dictBuffers, indexStream]);
  }

  private encodeRaw(strings: string[]): Buffer {
    const parts: Buffer[] = [];
    for (const s of strings) {
      const buf = Buffer.from(s, "utf8");
      parts.push(Buffer.from([buf.length]));
      parts.push(buf);
    }
    return Buffer.concat(parts);
  }

  decode(buffer: Buffer): unknown[] {
    let offset = 0;

    // Check if it's raw mode (no dictionary header)
    if (buffer.length === 0) return [];

    const dictSize = buffer.readUInt16LE(offset);
    offset += 2;

    if (dictSize === 0 && buffer.length > 2) {
      // raw mode fallback detection (simplified: assume raw if dictSize looks invalid or we choose conservative path)
      return this.decodeRaw(buffer);
    }

    const dictionary: string[] = [];
    for (let i = 0; i < dictSize; i++) {
      const len = buffer[offset];
      offset += 1;
      const strBuf = buffer.slice(offset, offset + len);
      dictionary.push(strBuf.toString("utf8"));
      offset += len;
    }

    const indices = buffer.slice(offset);
    const result: string[] = [];
    for (const idx of indices) {
      result.push(dictionary[idx]);
    }

    return result;
  }

  private decodeRaw(buffer: Buffer): string[] {
    const result: string[] = [];
    let offset = 0;
    while (offset < buffer.length) {
      const len = buffer[offset];
      offset += 1;
      const strBuf = buffer.slice(offset, offset + len);
      result.push(strBuf.toString("utf8"));
      offset += len;
    }
    return result;
  }
}
