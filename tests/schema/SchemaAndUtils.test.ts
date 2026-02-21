import { FieldProfiler } from "../../schema/FieldProfile";
import { ColumnBuilder, HeaderEncoder } from "../../schema/FieldType";
import { ObjectFlattener } from "../../codecs/ObjectFlattener";

describe("Schema & Utils", () => {
  describe("ObjectFlattener", () => {
    it("should instantiate and expose flatten/unflatten methods", () => {
      const flattener = new ObjectFlattener();
      expect(flattener).toBeDefined();
      expect(typeof flattener.flatten).toBe("function");
      expect(typeof flattener.unflatten).toBe("function");
    });
  });

  describe("ColumnBuilder", () => {
    it("should instantiate and expose build method for columnar pivoting", () => {
      const builder = new ColumnBuilder();
      expect(builder).toBeDefined();
      expect(typeof builder.build).toBe("function");
    });
  });

  describe("FieldProfiler", () => {
    it("should instantiate and expose detectType method for schema inference", () => {
      const profiler = new FieldProfiler();
      expect(profiler).toBeDefined();
      expect(typeof profiler.detectType).toBe("function");
    });
  });

  describe("HeaderEncoder", () => {
    it("should instantiate and expose encode method for schema metadata", () => {
      const encoder = new HeaderEncoder();
      expect(encoder).toBeDefined();
      expect(typeof encoder.encode).toBe("function");
    });
  });
});
