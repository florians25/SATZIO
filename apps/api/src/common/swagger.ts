import { applyDecorators } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

/** Dokumentiert einen Zod-validierten Request-Body in Swagger/OpenAPI. */
export function ApiZodBody(schema: ZodType, description?: string) {
  let jsonSchema: Record<string, unknown>;
  try {
    jsonSchema = z.toJSONSchema(schema, { target: 'openapi-3.0', unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
    delete jsonSchema.$schema;
  } catch {
    jsonSchema = { type: 'object' };
  }
  return applyDecorators(ApiBody({ schema: jsonSchema as never, description }));
}
