import { FieldProfiler } from "../schema/FieldProfile";
import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
import { ColumnBuilder } from "../schema/FieldType";
import { CodecRegistry } from "./CodecRegistry";
import { Varint } from "../utils/Varint";

export class ArrayObjectCodec implements IFieldCodec {
  constructor(
    private readonly profiler: FieldProfiler,
    private readonly registry: CodecRegistry,
    private readonly columnBuilder: ColumnBuilder
  ) {}

  supports(type: FieldType): boolean {
    return type === FieldType.ARRAY;
  }

  encode(values: unknown[]): Buffer {
    const arrays = values as Record<string, unknown>[][];
    const arrayCount = arrays.length;

    const countBuf = Varint.encode(arrayCount);

    const lengthBuffers = arrays.map((arr) => Varint.encode(arr.length));
    const lengthBuffer = Buffer.concat(lengthBuffers);

    const flattenedItems: Record<string, unknown>[] = [];
    for (const arr of arrays) {
      for (const obj of arr) {
        flattenedItems.push(obj);
      }
    }

    if (!flattenedItems.length) {
      return Buffer.concat([countBuf, lengthBuffer]);
    }

    const columns = this.columnBuilder.build(flattenedItems);
    const nestedBuffers: Buffer[] = [];

    for (const fieldName of Object.keys(columns)) {
      const colValues = columns[fieldName];
      const type = this.profiler.detectType(colValues);
      const codec = this.registry.get(type);

      if (!codec) throw new Error(`No codec for nested field ${fieldName}`);

      const encoded = codec.encode(colValues);
      const nameBuf = Buffer.from(fieldName, "utf8");

      const nameLenBuf = Buffer.from([nameBuf.length]);
      const typeBuf = Buffer.from([Number(type)]);
      const payloadLenBuf = Varint.encode(encoded.length);

      nestedBuffers.push(nameLenBuf, nameBuf, typeBuf, payloadLenBuf, encoded);
    }

    const fieldCount = Object.keys(columns).length;
    const fieldCountBuf = Varint.encode(fieldCount);

    return Buffer.concat([
      countBuf,
      lengthBuffer,
      fieldCountBuf,
      ...nestedBuffers,
    ]);
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length === 0) return [];
    let offset = 0;

    const { value: arrayCount, bytesRead: acRead } = Varint.decode(
      buffer,
      offset
    );
    offset += acRead;

    const lengths: number[] = [];
    for (let i = 0; i < arrayCount; i++) {
      const { value: len, bytesRead: lenRead } = Varint.decode(buffer, offset);
      lengths.push(len);
      offset += lenRead;
    }

    if (offset >= buffer.length) {
      return lengths.map(() => []);
    }

    const { value: fieldCount, bytesRead: fcRead } = Varint.decode(
      buffer,
      offset
    );
    offset += fcRead;

    const nestedColumns: Record<string, unknown[]> = {};
    const fieldNames: string[] = [];

    for (let f = 0; f < fieldCount; f++) {
      if (offset >= buffer.length) throw new Error("Truncated name length");
      const nameLen = buffer[offset++];

      if (offset + nameLen > buffer.length) throw new Error("Truncated name");
      const fieldName = buffer.slice(offset, offset + nameLen).toString("utf8");
      offset += nameLen;

      if (offset >= buffer.length) throw new Error("Truncated type");
      const typeNum = buffer[offset++];

      const { value: payloadLen, bytesRead: plRead } = Varint.decode(
        buffer,
        offset
      );
      offset += plRead;

      if (offset + payloadLen > buffer.length) {
        throw new Error(
          `Truncated payload for "${fieldName}": need ${payloadLen}, have ${
            buffer.length - offset
          }`
        );
      }

      const payload = buffer.slice(offset, offset + payloadLen);
      offset += payloadLen;

      const type = Object.values(FieldType)[typeNum] as FieldType;
      const codec = this.registry.get(type);
      if (!codec) throw new Error(`No codec for nested type ${type}`);

      nestedColumns[fieldName] = codec.decode(payload);
      fieldNames.push(fieldName);
    }

    const fieldLengths: Record<string, number> = Object.fromEntries(
      Object.entries(nestedColumns).map(([name, col]) => [name, col.length])
    );

    const maxLen = Math.max(0, ...Object.values(fieldLengths));
    const flatRows: Record<string, unknown>[] = Array.from(
      { length: maxLen },
      () => ({})
    );

    for (const fieldName of fieldNames) {
      const values = nestedColumns[fieldName] as unknown[];
      for (let row = 0; row < fieldLengths[fieldName]; row++) {
        flatRows[row][fieldName] = values[row];
      }
    }

    const result: Record<string, unknown>[][] = [];
    let flatIdx = 0;

    for (const arrLength of lengths) {
      const arr: Record<string, unknown>[] = [];
      for (let j = 0; j < arrLength; j++) {
        if (flatIdx >= flatRows.length) {
          throw new Error("Flat index overflow during array reconstruction");
        }
        arr.push(flatRows[flatIdx++]);
      }
      result.push(arr);
    }

    return result;
  }
}
