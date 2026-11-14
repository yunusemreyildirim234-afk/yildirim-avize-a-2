export const Prisma = { join: (parts) => ({ join: parts }), sql: (strings, ...values) => ({ sql: strings.join("?"), values }) };
