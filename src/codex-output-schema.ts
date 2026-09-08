// Codex structured output requires every object property to be required. Keep
// the domain schema unchanged: optional output properties use null on the wire.
type Schema = Record<string, unknown>;
export function strictCodexSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strictCodexSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Schema;
  const schema = Object.fromEntries(Object.entries(source).map(([key, item]) => [key, strictCodexSchema(item)]));
  if (source.type === "object" && source.properties) {
    const required = new Set(source.required as string[] ?? []);
    schema.properties = Object.fromEntries(Object.entries(source.properties as Schema).map(([key, item]) =>
      [key, required.has(key) ? strictCodexSchema(item) : { anyOf: [strictCodexSchema(item), { type: "null" }] }]));
    schema.required = Object.keys(source.properties as Schema);
    schema.additionalProperties = false;
  }
  return schema;
}

function matches(schema: Schema, value: unknown): boolean {
  if ("const" in schema && schema.const !== value) return false;
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) return false;
  if (schema.type === "null") return value === null;
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.entries(schema.properties as Schema ?? {}).every(([key, item]) => !item || typeof item !== "object" ||
      !("const" in item) || (value as Schema)[key] === (item as Schema).const);
  }
  if (!schema.type) return true;
  if (schema.type === "array") return Array.isArray(value);
  return typeof value === schema.type || schema.type === "integer" && typeof value === "number";
}
function acceptsNull(schema: Schema): boolean {
  return schema.type === "null" || Array.isArray(schema.type) && schema.type.includes("null") ||
    Array.isArray(schema.anyOf) && schema.anyOf.some((entry) => acceptsNull(entry as Schema));
}
export function restoreCodexOptionals(value: unknown, schema: Schema): unknown {
  if (Array.isArray(schema.anyOf)) {
    const branch = (schema.anyOf as Schema[]).find((entry) => matches(entry, value));
    if (branch) return restoreCodexOptionals(value, branch);
  }
  if (Array.isArray(value) && schema.items) return value.map((item) => restoreCodexOptionals(item, schema.items as Schema));
  if (value && typeof value === "object" && !Array.isArray(value) && schema.properties) {
    const required = new Set(schema.required as string[] ?? []), properties = schema.properties as Record<string, Schema>;
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      const property = properties[key];
      if (property && item === null && !required.has(key) && !acceptsNull(property)) return [];
      return [[key, property ? restoreCodexOptionals(item, property) : item]];
    }));
  }
  return value;
}
