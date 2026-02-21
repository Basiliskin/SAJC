import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
import { Varint } from "../utils/Varint";

export class TimestampCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.TIMESTAMP;
  }

  encode(values: unknown[]): Buffer {
    const timestamps = values.map((v) => new Date(v as string).getTime());
    if (timestamps.length === 0) return Buffer.alloc(0);

    const base = BigInt(timestamps[0]);
    const deltas = timestamps.map((t) => BigInt(t) - base);

    const buffers: Buffer[] = [];

    // Write the 8-byte base timestamp
    const baseBuf = Buffer.alloc(8);
    baseBuf.writeBigInt64LE(base, 0);
    buffers.push(baseBuf);

    // Write deltas as ZigZag Varints
    for (const delta of deltas) {
      buffers.push(Varint.encodeBigInt(delta));
    }

    return Buffer.concat(buffers);
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length < 8) return [];

    const base = Number(buffer.readBigInt64LE(0));
    const values: number[] = [];
    let offset = 8;

    while (offset < buffer.length) {
      const { value: delta, bytesRead } = Varint.decodeBigInt(buffer, offset);
      values.push(base + Number(delta));
      offset += bytesRead;
    }

    return values.map((v) => new Date(v).toISOString());
  }
}
