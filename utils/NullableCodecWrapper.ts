import { IFieldCodec } from "../codecs/IFieldCodec";

export const MISSING = Symbol.for("SAJC_MISSING");

export class NullableCodecWrapper {
  constructor(
    private readonly codec: IFieldCodec,
    private readonly bitmapBuilder: unknown // Kept for constructor signature compatibility
  ) {}

  encode(values: unknown[]): Buffer {
    const length = values.length;
    const nonNulls: unknown[] = [];
    const bitmapLength = Math.ceil(length / 8);
    const bitmap = Buffer.alloc(bitmapLength);

    for (let i = 0; i < length; i++) {
      const val = values[i];
      if (val !== MISSING) {
        nonNulls.push(val);
        bitmap[Math.floor(i / 8)] |= 1 << i % 8;
      }
    }

    const encodedValues = this.codec.encode(nonNulls);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(length, 0);

    return Buffer.concat([header, bitmap, encodedValues]);
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length < 4) {
      throw new Error("Buffer too short to contain length header");
    }

    let ptr = 0;
    const totalLength = buffer.readUInt32LE(ptr);
    ptr += 4;

    if (totalLength === 0) {
      return [];
    }

    const bitmapLength = Math.ceil(totalLength / 8);
    if (buffer.length < ptr + bitmapLength) {
      throw new Error("Buffer too short to contain bitmap");
    }

    const bitmap = buffer.slice(ptr, ptr + bitmapLength);
    ptr += bitmapLength;

    let expectedNonNulls = 0;
    for (let i = 0; i < totalLength; i++) {
      if (bitmap[Math.floor(i / 8)] & (1 << i % 8)) {
        expectedNonNulls++;
      }
    }

    const encodedValuesBuffer = buffer.slice(ptr);
    const decodedNonNulls = this.codec.decode(encodedValuesBuffer) as unknown[];

    if (expectedNonNulls !== decodedNonNulls.length) {
      throw new Error(
        `non-null values mismatch: expected ${expectedNonNulls}, got ${decodedNonNulls.length}`
      );
    }

    const result: unknown[] = new Array(totalLength);
    let nonNullIdx = 0;

    for (let i = 0; i < totalLength; i++) {
      if (bitmap[Math.floor(i / 8)] & (1 << i % 8)) {
        result[i] = decodedNonNulls[nonNullIdx++];
      } else {
        result[i] = MISSING;
      }
    }

    return result;
  }
}
