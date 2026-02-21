import { FieldType } from "../schema/FieldType";
import { IFieldCodec } from "./IFieldCodec";
export class UUIDCodec implements IFieldCodec {
  supports(type: FieldType): boolean {
    return type === FieldType.UUID;
  }

  encode(values: unknown[]): Buffer {
    const buffers = values.map((v) =>
      Buffer.from((v as string).replace(/-/g, ""), "hex")
    );
    return Buffer.concat(buffers);
  }

  decode(buffer: Buffer): unknown[] {
    const uuids: string[] = [];
    for (let i = 0; i < buffer.length; i += 16) {
      const hex = buffer.slice(i, i + 16).toString("hex");
      uuids.push(
        `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
          12,
          16
        )}-${hex.slice(16, 20)}-${hex.slice(20)}`
      );
    }
    return uuids;
  }
}
