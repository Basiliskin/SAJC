import { UUIDCodec } from "../../codecs/UUIDCodec";
import { TimestampCodec } from "../../codecs/TimestampCodec";
import { FieldType } from "../../schema/FieldType";

describe("Primitive Codecs", () => {
  describe("UUIDCodec", () => {
    let codec: UUIDCodec;

    beforeEach(() => {
      codec = new UUIDCodec();
    });

    it("should support UUID field type", () => {
      expect(codec.supports(FieldType.UUID)).toBe(true);
      expect(codec.supports(FieldType.STRING as any)).toBe(false);
    });

    it("should encode and decode UUIDs correctly", () => {
      const uuids = [
        "550e8400-e29b-41d4-a716-446655440000",
        "123e4567-e89b-12d3-a456-426614174000",
      ];

      const encoded = codec.encode(uuids);
      expect(encoded).toBeInstanceOf(Buffer);
      expect(encoded.length).toBe(32); // 16 bytes per UUID

      const decoded = codec.decode(encoded);
      expect(decoded).toEqual(uuids);
    });

    it("should handle empty arrays", () => {
      const encoded = codec.encode([]);
      expect(encoded.length).toBe(0);
      const decoded = codec.decode(encoded);
      expect(decoded).toEqual([]);
    });
  });

  describe("TimestampCodec", () => {
    let codec: TimestampCodec;

    beforeEach(() => {
      codec = new TimestampCodec();
    });

    it("should support TIMESTAMP field type", () => {
      expect(codec.supports(FieldType.TIMESTAMP)).toBe(true);
    });

    it("should encode and decode timestamps correctly using delta encoding", () => {
      const timestamps = [
        "2025-06-15T14:30:22.123Z",
        "2025-06-15T15:30:22.123Z",
      ];

      const encoded = codec.encode(timestamps);
      expect(encoded).toBeInstanceOf(Buffer);
      // 8 bytes for base + 8 bytes per delta
      expect(encoded.length).toBe(8 + 8 * timestamps.length);

      const decoded = codec.decode(encoded);
      expect(decoded).toEqual(timestamps);
    });

    it("should handle empty arrays", () => {
      const encoded = codec.encode([]);
      expect(encoded.length).toBe(0);
      const decoded = codec.decode(encoded);
      expect(decoded).toEqual([]);
    });
  });
});
