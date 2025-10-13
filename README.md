# elo-serializer

Lightweight, schema-based binary serialization with TypeScript type safety

## Installation

```bash
npm install elo-serializer
```

## Usage

```typescript
import { ELOInfer, eloPack, ELOSchema, eloUnpack } from 'elo-serializer';

const schema = {
  id: 'uint32',
  name: 'binary',
  address: {
    street: 'binary',
    city: 'binary',
    coords: ['float'],
  },
} as const satisfies ELOSchema;

const encoder = new TextEncoder();
const data: ELOInfer<typeof schema> = {
  id: 1,
  name: encoder.encode('Maung Maung').buffer,
  address: {
    street: encoder.encode('123 Sule Pagoda Road').buffer,
    city: encoder.encode('Yangon').buffer,
    coords: [16.8471, 96.1561],
  },
};

const buffer = eloPack(schema, data);
const unpacked = eloUnpack(schema, buffer);

const decoder = new TextDecoder();
console.log({
  id: unpacked.id,
  name: decoder.decode(unpacked.name),
  street: decoder.decode(unpacked.address.street),
  city: decoder.decode(unpacked.address.city),
  coords: unpacked.address.coords,
});
```

## Schema Types

- **Numeric**: `int8`, `int16`, `int32`, `uint8`, `uint16`, `uint32`, `float`
- **Boolean**: `bool`
- **Binary**: `binary` (use with `TextEncoder`/`TextDecoder` for strings)
- **Array**: `[type]`
- **Object**: nested schemas

## License

MIT
