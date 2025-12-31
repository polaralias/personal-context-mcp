import { Prisma } from '@prisma/client';

export function toInputJsonObject(obj: Record<string, unknown>): Prisma.InputJsonObject {
  // JSON.stringify will convert dates to ISO strings and strip undefined values.
  // We add a replacer to handle BigInts safely.
  const jsonString = JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });

  return JSON.parse(jsonString) as Prisma.InputJsonObject;
}
