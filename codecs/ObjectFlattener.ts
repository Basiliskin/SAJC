import { MISSING } from "../utils/NullableCodecWrapper";

export class ObjectFlattener {
  flatten(record: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this.flattenRecursive(record, "", result);
    return result;
  }

  unflattenWithMissing(flat: Record<string, unknown>): Record<string, unknown> {
    const obj: Record<string, any> = {};
    for (const key in flat) {
      const val = flat[key];
      if (val !== MISSING) {
        obj[key] = val;
      }
    }
    return obj;
  }

  unflatten(flat: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const fullPath of Object.keys(flat)) {
      const value = flat[fullPath];

      // Skip MISSING values entirely
      if (value === MISSING || value === undefined) {
        continue;
      }

      const parts = fullPath.split(".");
      let current: any = result;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = value;
        } else {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
    return result;
  }

  private flattenRecursive(
    obj: Record<string, unknown>,
    parentPath: string,
    result: Record<string, unknown>
  ) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const path = parentPath ? `${parentPath}.${key}` : key;

      if (this.isPlainObject(value)) {
        this.flattenRecursive(value as Record<string, unknown>, path, result);
      } else {
        result[path] = value;
      }
    }
  }

  private isPlainObject(value: unknown): boolean {
    // Treat MISSING as a primitive value, not an object to recurse into
    if (value === MISSING) {
      return false;
    }
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
