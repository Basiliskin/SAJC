import { FieldType } from "../schema/FieldType";
import { BitmapBuilder, FieldProfiler } from "../schema/FieldProfile";
import { ColumnBuilder, HeaderEncoder, FieldSchema } from "../schema/FieldType";
import { IFieldCodec } from "../codecs/IFieldCodec";
import { ObjectFlattener } from "../codecs/ObjectFlattener";
import { NullableCodecWrapper, MISSING } from "../utils/NullableCodecWrapper";
import { CodecRegistry } from "../codecs/CodecRegistry";
import { EnumCodec } from "../codecs/EnumCodec";
import zlib from "node:zlib";

export interface SemanticCompressorOptions {
  version?: number;
}

export interface PreparedData {
  fields: FieldSchema[];
  columnBuffers: Buffer[];
}

export class SemanticCompressor {
  private readonly version: number;

  constructor(
    private readonly registry: CodecRegistry,
    private readonly profiler: FieldProfiler,
    private readonly columnBuilder: ColumnBuilder,
    private readonly headerEncoder: HeaderEncoder,
    private readonly flattener: ObjectFlattener,
    options?: SemanticCompressorOptions
  ) {
    this.version = options?.version ?? 1;

    // Register EnumCodec (FieldType 5) if not already registered
    const enumType = (FieldType as any).ENUM ?? 5;
    if (!this.registry.supports(enumType)) {
      this.registry.register(new EnumCodec(), "ENUM" as any);
    }
  }

  prepareData(records: Record<string, unknown>[]): PreparedData {
    if (!records.length) {
      throw new Error("Cannot compress empty dataset");
    }

    const allKeys = new Set<string>();
    for (const r of records) {
      for (const key of Object.keys(r)) {
        allKeys.add(key);
      }
    }

    const sortedKeys = Array.from(allKeys).sort();

    const flattened = records.map((r) => {
      const flat: Record<string, unknown> = {};
      for (const key of sortedKeys) {
        const value = r[key];
        // Only map undefined (missing keys) to MISSING. Null is a valid value.
        flat[key] = key in r && value !== undefined ? value : MISSING;
      }
      return this.flattener.flatten(flat);
    });

    const allFlattenedKeys = new Set<string>();
    for (const f of flattened) {
      for (const key of Object.keys(f)) {
        allFlattenedKeys.add(key);
      }
    }

    for (const f of flattened) {
      for (const key of allFlattenedKeys) {
        if (!(key in f)) {
          f[key] = MISSING;
        }
      }
    }

    const columns = this.columnBuilder.build(flattened);
    const schema = this.buildSchema(columns);

    const columnBuffers: Buffer[] = [];
    const fields: FieldSchema[] = [];

    for (const fieldName of Object.keys(columns)) {
      const values = columns[fieldName];
      const type = schema[fieldName];
      const codec = this.resolveCodec(type);

      const wrappedCodec = new NullableCodecWrapper(codec, new BitmapBuilder());
      const encoded = wrappedCodec.encode(values);
      const decoded = wrappedCodec.decode(encoded);

      if (JSON.stringify(values) !== JSON.stringify(decoded)) {
        throw new Error(
          `Round-trip integrity check failed for field "${fieldName}" (type: ${type})`
        );
      }

      columnBuffers.push(encoded);
      fields.push({
        name: fieldName,
        type,
        byteLength: encoded.length,
      });
    }

    return { fields, columnBuffers };
  }

  compress(records: Record<string, unknown>[]): Buffer {
    const { fields, columnBuffers } = this.prepareData(records);
    const headerBuffer = this.headerEncoder.encode({
      version: this.version,
      fields,
    });
    return Buffer.concat([headerBuffer, ...columnBuffers]);
  }

  compressColumnarBrotli(records: Record<string, unknown>[]): Buffer {
    const { fields, columnBuffers } = this.prepareData(records);

    const compressedColumns: Buffer[] = [];
    const updatedFields: FieldSchema[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const rawBuffer = columnBuffers[i];

      const compressed = zlib.brotliCompressSync(rawBuffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]:
            zlib.constants.BROTLI_MAX_QUALITY,
        },
      });

      compressedColumns.push(compressed);
      updatedFields.push({
        ...field,
        byteLength: compressed.length,
      });
    }

    const headerBuffer = this.headerEncoder.encode({
      version: this.version,
      fields: updatedFields,
    });

    const finalHeader = Buffer.from(headerBuffer);
    finalHeader.write("SJCB", 0, 4, "utf8");

    return Buffer.concat([finalHeader, ...compressedColumns]);
  }

  decompress(buffer: Buffer): Record<string, unknown>[] {
    if (buffer.length < 8) throw new Error("Invalid SAJC buffer");

    const magic = buffer.slice(0, 4).toString("utf8");
    const isColumnarBrotli = magic === "SJCB";

    if (magic !== "SAJC" && !isColumnarBrotli) {
      throw new Error("Invalid SAJC magic");
    }

    let offset = 4;
    const version = buffer[offset++];
    const fieldCount = buffer.readUInt16LE(offset);
    offset += 2;

    const fields: FieldSchema[] = [];
    for (let i = 0; i < fieldCount; i++) {
      const nameLen = buffer[offset++];
      const name = buffer.slice(offset, offset + nameLen).toString("utf8");
      offset += nameLen;
      const typeNum = buffer[offset++];
      const byteLength = buffer.readUInt32LE(offset);
      offset += 4;
      fields.push({
        name,
        type: typeNum as FieldType,
        byteLength,
      });
    }

    if (fields.length === 0) {
      return [];
    }

    const columns: Record<string, unknown[]> = {};
    for (const field of fields) {
      let colBuffer = buffer.slice(offset, offset + field.byteLength);
      offset += field.byteLength;

      if (isColumnarBrotli) {
        colBuffer = Buffer.from(zlib.brotliDecompressSync(colBuffer));
      }

      const codec = this.resolveCodec(field.type);
      const wrapped = new NullableCodecWrapper(codec, new BitmapBuilder());
      columns[field.name] = wrapped.decode(colBuffer);
    }

    const flatRecords: Record<string, unknown>[] = [];
    const rowCount = columns[fields[0].name]?.length ?? 0;

    for (let row = 0; row < rowCount; row++) {
      const record: Record<string, unknown> = {};
      for (const field of fields) {
        const val = columns[field.name][row];
        if (val !== MISSING) {
          record[field.name] = val;
        }
      }
      flatRecords.push(record);
    }

    return flatRecords.map((flat) => this.flattener.unflatten(flat));
  }

  private buildSchema(
    columns: Record<string, unknown[]>
  ): Record<string, FieldType> {
    const schema: Record<string, FieldType> = {};
    for (const fieldName of Object.keys(columns)) {
      const values = columns[fieldName];
      const realValues = values.filter((v) => v !== MISSING);
      const type = this.profiler.detectType(
        realValues.length > 0 ? realValues : values
      );
      schema[fieldName] = type;
    }
    return schema;
  }

  private resolveCodec(type: FieldType): IFieldCodec {
    const codec = this.registry.get(type);
    if (!codec) {
      throw new Error(`No codec for field type: ${type}`);
    }
    return codec;
  }

  getCompressedBuffer(dataset: Record<string, unknown>[]): Buffer {
    return this.compress(dataset);
  }

  getCompressedColumnarBrotliBuffer(
    dataset: Record<string, unknown>[]
  ): Buffer {
    return this.compressColumnarBrotli(dataset);
  }

  decompressBuffer(buffer: Buffer): Record<string, unknown>[] {
    return this.decompress(buffer);
  }

  decompressColumnarBrotliBuffer(buffer: Buffer): Record<string, unknown>[] {
    return this.decompress(buffer);
  }
}
