import { FieldProfiler } from "../schema/FieldProfile";
import { FieldType } from "../schema/FieldType";
import { CodecRegistry } from "./CodecRegistry";
import { IFieldCodec } from "./IFieldCodec";
import { Varint } from "../utils/Varint";

export class ArrayPrimitiveCodec implements IFieldCodec {
  constructor(
    private readonly profiler: FieldProfiler,
    private readonly registry: CodecRegistry
  ) {}

  supports(type: FieldType): boolean {
    return type === FieldType.ARRAY_PRIMITIVE;
  }

  encode(values: unknown[]): Buffer {
    const arrays = values as unknown[][];
    const rowCount = arrays.length;

    const countBuf = Varint.encode(rowCount);

    const lengthBuffers = arrays.map((a) => Varint.encode(a.length));
    const lengthBuf = Buffer.concat(lengthBuffers);

    const flattened: unknown[] = [];
    arrays.forEach((arr) => flattened.push(...arr));

    if (flattened.length === 0) {
      return Buffer.concat([countBuf, lengthBuf]);
    }

    let type = this.profiler.detectType(flattened);
    if (
      type !== FieldType.NUMBER &&
      flattened.every((v) => typeof v === "number")
    ) {
      type = FieldType.NUMBER;
    }

    const codec = this.registry.get(type);
    if (!codec) {
      throw new Error(`No codec for primitive array type ${type}`);
    }

    const dataBuffer = codec.encode(flattened);
    const typeBuf = Buffer.from([Number(type)]);
    const dataLenBuf = Varint.encode(dataBuffer.length);

    return Buffer.concat([
      countBuf,
      lengthBuf,
      typeBuf,
      dataLenBuf,
      dataBuffer,
    ]);
  }

  decode(buffer: Buffer): unknown[][] {
    if (buffer.length === 0) return [];
    let offset = 0;

    const { value: rowCount, bytesRead: rcRead } = Varint.decode(
      buffer,
      offset
    );
    offset += rcRead;

    const lengths: number[] = [];
    for (let i = 0; i < rowCount; i++) {
      const { value: len, bytesRead: lenRead } = Varint.decode(buffer, offset);
      lengths.push(len);
      offset += lenRead;
    }

    if (lengths.every((l) => l === 0) || offset >= buffer.length) {
      return lengths.map(() => []);
    }

    const innerTypeNum = buffer[offset++];
    const { value: innerLen, bytesRead: ilRead } = Varint.decode(
      buffer,
      offset
    );
    offset += ilRead;

    if (offset + innerLen > buffer.length) {
      throw new Error(
        `Inner data truncated: expected ${innerLen} bytes, remaining ${
          buffer.length - offset
        }`
      );
    }

    const innerBuffer = buffer.slice(offset, offset + innerLen);
    const innerType = Object.values(FieldType)[innerTypeNum] as FieldType;
    const innerCodec = this.registry.get(innerType);

    if (!innerCodec) {
      throw new Error(`No codec for inner type ${innerType}`);
    }

    const flattenedValues = innerCodec.decode(innerBuffer) as unknown[];
    const result: unknown[][] = [];
    let idx = 0;

    for (const len of lengths) {
      const arr: unknown[] = [];
      for (let j = 0; j < len; j++) {
        if (idx >= flattenedValues.length) {
          throw new Error(
            "Not enough flattened values for array reconstruction"
          );
        }
        arr.push(flattenedValues[idx++]);
      }
      result.push(arr);
    }

    if (idx !== flattenedValues.length) {
      throw new Error("Too many flattened values decoded");
    }

    return result;
  }
}
