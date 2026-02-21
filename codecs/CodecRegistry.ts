import {
  FieldType,
  FieldTypeNames,
  NamedFieldTypes,
} from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";

export class CodecRegistry {
  private readonly codecs = new Map<FieldType, IFieldCodec>();

  /**
   * Register a codec for one primary type.
   * If a codec supports multiple types, register it multiple times (or extend later).
   */
  register(codec: IFieldCodec, primaryType: keyof typeof FieldTypeNames): void {
    const type = NamedFieldTypes[primaryType];
    if (this.codecs.has(type)) {
      console.warn(`Overwriting codec for type ${type}`);
    }
    this.codecs.set(type, codec);
  }

  /**
   * Get the codec responsible for a given field type.
   * Throws if no codec is registered.
   */
  get(type: FieldType): IFieldCodec {
    const codec =
      this.codecs.get(type) ?? this.codecs.get(NamedFieldTypes[type]);
    if (!codec) {
      throw new Error(`No codec registered for field type: ${type}`);
    }
    return codec;
  }

  /**
   * Optional: check if a type is supported (used in tests or validation)
   */
  supports(type: FieldType): boolean {
    return this.codecs.has(type);
  }

  /**
   * Get all registered types (useful for debugging or schema validation)
   */
  getSupportedTypes(): FieldType[] {
    return Array.from(this.codecs.keys());
  }
}
