import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";

export class StringCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.STRING;
  }

  encode(values: unknown[]): Buffer {
    const strings = values.map((v) => String(v)); // coerce safely
    const parts: Buffer[] = [];

    strings.forEach((str) => {
      const buf = Buffer.from(str, "utf8");
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(buf.length, 0);
      parts.push(lenBuf, buf);
    });

    return Buffer.concat(parts);
  }

  decode(buffer: Buffer): unknown[] {
    const result: string[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) {
        throw new Error("Truncated string length prefix");
      }
      const len = buffer.readUInt32LE(offset);
      offset += 4;

      if (offset + len > buffer.length) {
        throw new Error("Truncated string data");
      }

      const str = buffer.slice(offset, offset + len).toString("utf8");
      result.push(str);
      offset += len;
    }

    return result;
  }
}
