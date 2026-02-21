import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
import { Varint } from "../utils/Varint";

/**
 * Encodes strings using a dictionary approach.
 * Highly effective for columns with low cardinality (many repeated strings).
 */
export class DictionaryStringCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.STRING;
  }

  encode(values: unknown[]): Buffer {
    const strings = values as string[];
    const dictionary = new Map<string, number>();
    const uniqueStrings: string[] = [];

    // 1. Build dictionary
    for (const str of strings) {
      if (!dictionary.has(str)) {
        dictionary.set(str, uniqueStrings.length);
        uniqueStrings.push(str);
      }
    }

    const buffers: Buffer[] = [];

    // 2. Write Dictionary Size
    buffers.push(Varint.encode(uniqueStrings.length));

    // 3. Write Dictionary Strings (length-prefixed)
    for (const str of uniqueStrings) {
      const strBuf = Buffer.from(str, "utf8");
      buffers.push(Varint.encode(strBuf.length));
      buffers.push(strBuf);
    }

    // 4. Write Encoded Values (indices)
    for (const str of strings) {
      const index = dictionary.get(str)!;
      buffers.push(Varint.encode(index));
    }

    return Buffer.concat(buffers);
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length === 0) return [];
    let offset = 0;

    // 1. Read Dictionary Size
    const { value: dictSize, bytesRead: dsRead } = Varint.decode(
      buffer,
      offset
    );
    offset += dsRead;

    // 2. Read Dictionary Strings
    const dictionary: string[] = [];
    for (let i = 0; i < dictSize; i++) {
      const { value: strLen, bytesRead: slRead } = Varint.decode(
        buffer,
        offset
      );
      offset += slRead;

      const str = buffer.slice(offset, offset + strLen).toString("utf8");
      offset += strLen;
      dictionary.push(str);
    }

    // 3. Read Indices and map to strings
    const values: string[] = [];
    while (offset < buffer.length) {
      const { value: index, bytesRead: idxRead } = Varint.decode(
        buffer,
        offset
      );
      offset += idxRead;
      values.push(dictionary[index]);
    }

    return values;
  }
}
