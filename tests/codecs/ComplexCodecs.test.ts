import { CodecRegistry } from "../../codecs/CodecRegistry";
import { ArrayObjectCodec } from "../../codecs/ArrayObjectCodec";
import { ArrayPrimitiveCodec } from "../../codecs/ArrayPrimitiveCodec";
import { FieldType, ColumnBuilder } from "../../schema/FieldType";
import { FieldProfiler } from "../../schema/FieldProfile";
import { IFieldCodec } from "../../codecs/IFieldCodec";

describe("Complex Codecs & Registry", () => {
  describe("CodecRegistry", () => {
    let registry: CodecRegistry;
    let mockCodec: IFieldCodec;

    beforeEach(() => {
      registry = new CodecRegistry();
      mockCodec = {
        supports: jest.fn().mockReturnValue(true),
        encode: jest.fn(),
        decode: jest.fn(),
      };
    });

    it("should throw error when getting unregistered codec", () => {
      expect(() => registry.get(FieldType.STRING as any)).toThrow(
        /No codec registered/
      );
    });
  });

  describe("ArrayPrimitiveCodec", () => {
    let codec: ArrayPrimitiveCodec;
    let mockProfiler: jest.Mocked<FieldProfiler>;
    let mockRegistry: jest.Mocked<CodecRegistry>;
    let mockInnerCodec: IFieldCodec;

    beforeEach(() => {
      mockProfiler = {
        detectType: jest.fn(),
      } as unknown as jest.Mocked<FieldProfiler>;
      mockRegistry = {
        get: jest.fn(),
      } as unknown as jest.Mocked<CodecRegistry>;

      mockInnerCodec = {
        supports: jest.fn().mockReturnValue(true),
        encode: jest.fn().mockReturnValue(Buffer.from([1, 2, 3])),
        decode: jest.fn().mockReturnValue([10, 20, 30]),
      };

      mockRegistry.get.mockReturnValue(mockInnerCodec);
      codec = new ArrayPrimitiveCodec(mockProfiler, mockRegistry);
    });

    it("should support ARRAY_PRIMITIVE field type", () => {
      expect(codec.supports(FieldType.ARRAY_PRIMITIVE)).toBe(true);
    });

    it("should encode and decode primitive arrays", () => {
      const data = [[10, 20], [30]];
      mockProfiler.detectType.mockReturnValue(FieldType.NUMBER);

      const encoded = codec.encode(data);
      expect(encoded).toBeInstanceOf(Buffer);

      const decoded = codec.decode(encoded);
      expect(decoded).toEqual([[10, 20], [30]]);
    });

    it("should handle empty arrays", () => {
      const encoded = codec.encode([]);
      expect(encoded).toBeInstanceOf(Buffer);
      const decoded = codec.decode(encoded);
      expect(decoded).toEqual([]);
    });
  });

  describe("ArrayObjectCodec", () => {
    let codec: ArrayObjectCodec;
    let mockProfiler: jest.Mocked<FieldProfiler>;
    let mockRegistry: jest.Mocked<CodecRegistry>;
    let mockColumnBuilder: jest.Mocked<ColumnBuilder>;

    beforeEach(() => {
      mockProfiler = {
        detectType: jest.fn(),
      } as unknown as jest.Mocked<FieldProfiler>;
      mockRegistry = {
        get: jest.fn(),
      } as unknown as jest.Mocked<CodecRegistry>;
      mockColumnBuilder = {
        build: jest.fn(),
      } as unknown as jest.Mocked<ColumnBuilder>;

      codec = new ArrayObjectCodec(
        mockProfiler,
        mockRegistry,
        mockColumnBuilder
      );
    });

    it("should support ARRAY field type", () => {
      expect(codec.supports(FieldType.ARRAY)).toBe(true);
    });

    it("should handle empty arrays", () => {
      const encoded = codec.encode([]);
      expect(encoded).toBeInstanceOf(Buffer);
      const decoded = codec.decode(encoded);
      expect(decoded).toEqual([]);
    });
  });
});
