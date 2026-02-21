export enum FieldType {
  STRING = 0,
  NUMBER = 1,
  BOOLEAN = 2,
  TIMESTAMP = 3,
  UUID = 4,
  ENUM = 5,
  OBJECT = 6,
  ARRAY = 7,
  ARRAY_PRIMITIVE = 8,
}

export const FieldTypeNames = {
  [FieldType.STRING]: "STRING",
  [FieldType.NUMBER]: "NUMBER",
  [FieldType.BOOLEAN]: "BOOLEAN",
  [FieldType.TIMESTAMP]: "TIMESTAMP",
  [FieldType.UUID]: "UUID",
  [FieldType.ENUM]: "ENUM",
  [FieldType.OBJECT]: "OBJECT",
  [FieldType.ARRAY]: "ARRAY",
  [FieldType.ARRAY_PRIMITIVE]: "ARRAY_PRIMITIVE",
} as const;

export const FieldTypeValues = Object.values(FieldType);
export const NamedFieldTypes: Record<string, FieldType> = Object.fromEntries(
  Object.entries(FieldType).map(([key, value]) => [key, value])
) as Record<string, FieldType>;
export interface FieldSchema {
  name: string;
  type: FieldType;
  byteLength: number;
}

export interface BinaryHeader {
  version: number;
  fields: FieldSchema[];
}

export class HeaderEncoder {
  encode(header: BinaryHeader): Buffer {
    const parts: Buffer[] = [];

    parts.push(Buffer.from("SAJC")); // magic
    parts.push(Buffer.from([header.version]));

    const fieldCount = Buffer.alloc(2);
    fieldCount.writeUInt16LE(header.fields.length);
    parts.push(fieldCount);

    for (const field of header.fields) {
      const nameBuf = Buffer.from(field.name, "utf8");

      parts.push(Buffer.from([nameBuf.length]));
      parts.push(nameBuf);
      parts.push(Buffer.from([Number(field.type)]));

      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(field.byteLength);
      parts.push(lenBuf);
    }

    return Buffer.concat(parts);
  }
}

export class ColumnBuilder {
  build(records: Record<string, unknown>[]) {
    const columns: Record<string, unknown[]> = {};

    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (!columns[key]) columns[key] = [];
        columns[key].push(record[key]);
      }
    }

    return columns;
  }
}
