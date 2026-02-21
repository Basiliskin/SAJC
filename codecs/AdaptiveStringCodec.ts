import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
import { Varint } from "../utils/Varint";

/**
 * Adaptively encodes strings based on column cardinality and data patterns.
 * Modes:
 * 0x00: Raw Mode - Length-prefixed strings (High cardinality, unique values).
 * 0x01: Dictionary Mode - Dictionary + Indices (Low cardinality, random order).
 * 0x02: RLE Dictionary Mode - Dictionary + Run-Length Encoded Indices (Low cardinality, sorted/grouped data).
 *
 * Null values are supported using a length + 1 encoding strategy:
 * - 0 represents null
 * - length + 1 represents a string of that length
 */
export class AdaptiveStringCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.STRING;
  }

  encode(values: unknown[]): Buffer {
    const strings = values as (string | null)[];
    if (strings.length === 0) return Buffer.alloc(0);

    const dictionary = new Map<string | null, number>();
    const uniqueStrings: (string | null)[] = [];

    // 1. Build dictionary
    for (const str of strings) {
      if (!dictionary.has(str)) {
        dictionary.set(str, uniqueStrings.length);
        uniqueStrings.push(str);
      }
    }

    // Heuristic: If unique strings make up less than 70% of the total, dictionary is worth it.
    const isDictionaryBetter = uniqueStrings.length < strings.length * 0.7;

    if (!isDictionaryBetter) {
      // Mode 0x00: Raw Mode
      const buffers: Buffer[] = [Buffer.from([0x00])];
      for (const str of strings) {
        if (str === null) {
          buffers.push(Varint.encode(0));
        } else {
          const strBuf = Buffer.from(str, "utf8");
          buffers.push(Varint.encode(strBuf.length + 1));
          buffers.push(strBuf);
        }
      }
      return Buffer.concat(buffers);
    }

    // Prepare Dictionary Header (used for both 0x01 and 0x02)
    const dictHeaderBuffers: Buffer[] = [];
    dictHeaderBuffers.push(Varint.encode(uniqueStrings.length));
    for (const str of uniqueStrings) {
      if (str === null) {
        dictHeaderBuffers.push(Varint.encode(0));
      } else {
        const strBuf = Buffer.from(str, "utf8");
        dictHeaderBuffers.push(Varint.encode(strBuf.length + 1));
        dictHeaderBuffers.push(strBuf);
      }
    }
    const dictHeader = Buffer.concat(dictHeaderBuffers);

    // Calculate size for Mode 0x01: Standard Indices
    const indices: number[] = strings.map((s) => dictionary.get(s)!);
    const standardIndicesBuffers: Buffer[] = [];
    let standardSize = 0;
    for (const idx of indices) {
      const buf = Varint.encode(idx);
      standardIndicesBuffers.push(buf);
      standardSize += buf.length;
    }

    // Calculate size for Mode 0x02: RLE Indices
    const rleBuffers: Buffer[] = [];
    let rleSize = 0;
    if (indices.length > 0) {
      let currentIdx = indices[0];
      let currentRun = 1;

      for (let i = 1; i < indices.length; i++) {
        if (indices[i] === currentIdx) {
          currentRun++;
        } else {
          const idxBuf = Varint.encode(currentIdx);
          const runBuf = Varint.encode(currentRun);
          rleBuffers.push(idxBuf, runBuf);
          rleSize += idxBuf.length + runBuf.length;

          currentIdx = indices[i];
          currentRun = 1;
        }
      }
      // Push last run
      const idxBuf = Varint.encode(currentIdx);
      const runBuf = Varint.encode(currentRun);
      rleBuffers.push(idxBuf, runBuf);
      rleSize += idxBuf.length + runBuf.length;
    }

    // Select best Dictionary Mode
    if (rleSize < standardSize) {
      // Mode 0x02: RLE Dictionary
      return Buffer.concat([Buffer.from([0x02]), dictHeader, ...rleBuffers]);
    } else {
      // Mode 0x01: Standard Dictionary
      return Buffer.concat([
        Buffer.from([0x01]),
        dictHeader,
        ...standardIndicesBuffers,
      ]);
    }
  }

  decode(buffer: Buffer): unknown[] {
    if (buffer.length === 0) return [];

    const mode = buffer[0];
    let offset = 1;
    const values: (string | null)[] = [];

    if (mode === 0x00) {
      // Raw Mode
      while (offset < buffer.length) {
        const { value: lenPlusOne, bytesRead: slRead } = Varint.decode(
          buffer,
          offset
        );
        offset += slRead;

        if (lenPlusOne === 0) {
          values.push(null);
        } else {
          const strLen = lenPlusOne - 1;
          const str = buffer.slice(offset, offset + strLen).toString("utf8");
          offset += strLen;
          values.push(str);
        }
      }
    } else if (mode === 0x01 || mode === 0x02) {
      // Dictionary Modes
      const { value: dictSize, bytesRead: dsRead } = Varint.decode(
        buffer,
        offset
      );
      offset += dsRead;

      const dictionary: (string | null)[] = [];
      for (let i = 0; i < dictSize; i++) {
        const { value: lenPlusOne, bytesRead: slRead } = Varint.decode(
          buffer,
          offset
        );
        offset += slRead;

        if (lenPlusOne === 0) {
          dictionary.push(null);
        } else {
          const strLen = lenPlusOne - 1;
          const str = buffer.slice(offset, offset + strLen).toString("utf8");
          offset += strLen;
          dictionary.push(str);
        }
      }

      if (mode === 0x01) {
        // Standard Indices
        while (offset < buffer.length) {
          const { value: index, bytesRead: idxRead } = Varint.decode(
            buffer,
            offset
          );
          offset += idxRead;
          values.push(dictionary[index]);
        }
      } else {
        // RLE Indices
        while (offset < buffer.length) {
          const { value: index, bytesRead: idxRead } = Varint.decode(
            buffer,
            offset
          );
          offset += idxRead;

          const { value: runLen, bytesRead: runRead } = Varint.decode(
            buffer,
            offset
          );
          offset += runRead;

          const str = dictionary[index];
          for (let k = 0; k < runLen; k++) {
            values.push(str);
          }
        }
      }
    } else {
      throw new Error(`Unknown AdaptiveStringCodec mode: ${mode}`);
    }

    return values;
  }
}
