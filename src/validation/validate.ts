import { prettifyError } from "zod";

interface SafeParseResult {
  readonly success: boolean;
  readonly error?: unknown;
}

interface SchemaLike {
  safeParse(data: unknown): SafeParseResult;
  partial?(): SchemaLike;
}

interface SchemaHolder {
  readonly schema?: SchemaLike;
}

export interface ValidateSchemaOptions {
  readonly partial?: boolean;
}

export function validateSchema(modelClass: unknown, data: unknown, options?: ValidateSchemaOptions): void {
  const schema = (modelClass as SchemaHolder).schema;
  if (!schema) {
    return;
  }

  const effectiveSchema = options?.partial && schema.partial ? schema.partial() : schema;
  const result = effectiveSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`kosame: schema validation failed:\n${prettifyError(result.error as any)}`);
  }
}
