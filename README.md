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
  },
  phones: ['binary'],
} as const satisfies ELOSchema;

const encoder = new TextEncoder();
const data: ELOInfer<typeof schema> = {
  id: 1,
  name: encoder.encode('Maung Maung').buffer,
  address: {
    street: encoder.encode('123 Sule Pagoda Road').buffer,
    city: encoder.encode('Yangon').buffer,
  },
  phones: [encoder.encode('0912345678').buffer, encoder.encode('0998765432').buffer],
};

const buffer = eloPack(schema, data);
const unpacked = eloUnpack(schema, buffer);

const decoder = new TextDecoder();
console.log({
  id: unpacked.id,
  name: decoder.decode(unpacked.name),
  street: decoder.decode(unpacked.address.street),
  city: decoder.decode(unpacked.address.city),
  phones: unpacked.phones.map((p) => decoder.decode(p)),
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
