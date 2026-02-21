import { FieldType } from "./FieldType";

export class FieldProfiler {
  detectType(values: unknown[]): FieldType {
    const nonNullValues = values.filter((v) => v !== null && v !== undefined);

    if (nonNullValues.length === 0) {
      return FieldType.STRING; // or introduce NULL type later
    }

    if (this.isUUID(nonNullValues)) return FieldType.UUID;
    if (this.isTimestamp(nonNullValues)) return FieldType.TIMESTAMP;
    if (this.isEnum(nonNullValues)) return FieldType.ENUM;
    if (this.isBoolean(nonNullValues)) return FieldType.BOOLEAN;
    if (this.isNumber(nonNullValues)) return FieldType.NUMBER;

    if (this.isArrayOfObjects(values)) return FieldType.ARRAY; // keep full values here (arrays can contain null)
    if (this.isArrayOfPrimitives(values)) return FieldType.ARRAY_PRIMITIVE;

    return FieldType.STRING;
  }

  private isUUID(values: unknown[]): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return values.every((v) => typeof v === "string" && uuidRegex.test(v));
  }

  private isTimestamp(values: unknown[]): boolean {
    return values.every((v) => typeof v === "string" && !isNaN(Date.parse(v)));
  }

  private isEnum(values: unknown[]): boolean {
    if (!values.every((v) => typeof v === "string")) return false;
    const unique = new Set(values);
    return unique.size <= 8; // MVP threshold
  }

  private isBoolean(values: unknown[]): boolean {
    return values.every((v) => typeof v === "boolean");
  }

  private isNumber(values: unknown[]): boolean {
    return values.every((v) => typeof v === "number");
  }

  private isArrayOfObjects(values: unknown[]): boolean {
    return values.every(
      (v) =>
        Array.isArray(v) &&
        v.every(
          (item) =>
            typeof item === "object" && item !== null && !Array.isArray(item)
        )
    );
  }
  private isArrayOfPrimitives(values: unknown[]): boolean {
    return values.every(
      (v) =>
        Array.isArray(v) &&
        v.every((item) => typeof item !== "object" || item === null)
    );
  }
}

export class BitmapBuilder {
  build(values: unknown[]): {
    bitmap: Buffer;
    nonNullValues: unknown[];
  } {
    const byteLength = Math.ceil(values.length / 8);
    const bitmap = Buffer.alloc(byteLength);
    const nonNullValues: unknown[] = [];

    values.forEach((v, i) => {
      if (v !== null && v !== undefined) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;

        bitmap[byteIndex] |= 1 << bitIndex;
        nonNullValues.push(v);
      }
    });

    return { bitmap, nonNullValues };
  }
}
