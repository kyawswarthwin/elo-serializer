export type ELOTypes =
  | 'int8'
  | 'int16'
  | 'int32'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'float'
  | 'bool'
  | 'binary';

export type ELOInfer<S> = S extends keyof ELOTypeMap
  ? ELOTypeMap[S]
  : S extends readonly [infer E]
    ? E extends keyof ELOTypeMap
      ? ELOTypeMap[E][]
      : E extends ELOSchema
        ? ELOInfer<E>[]
        : never
    : S extends ELOSchema
      ? { [K in keyof S]: ELOInfer<S[K]> }
      : never;

export interface ELOTypeMap {
  int8: number;
  int16: number;
  int32: number;
  uint8: number;
  uint16: number;
  uint32: number;
  float: number;
  bool: boolean;
  binary: ArrayBuffer;
}

export interface ELOSchema {
  [key: string]: ELOTypes | ELOSchema | [ELOTypes | ELOSchema];
}

const ELOSizes: Record<ELOTypes, number> = {
  int8: 1,
  int16: 2,
  int32: 4,
  uint8: 1,
  uint16: 2,
  uint32: 4,
  float: 4,
  bool: 1,
  binary: 0,
};

class ELOBufferReader {
  private view: DataView;
  private pos: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.pos = 0;
  }

  reset(buffer?: ArrayBuffer): void {
    this.pos = 0;
    if (buffer) {
      this.view = new DataView(buffer);
    }
  }

  read<T extends ELOTypes>(type: T): ELOTypeMap[T] {
    const size = ELOSizes[type];
    let value: unknown;

    switch (type) {
      case 'int8':
        value = this.view.getInt8(this.pos);
        break;
      case 'int16':
        value = this.view.getInt16(this.pos, false);
        break;
      case 'int32':
        value = this.view.getInt32(this.pos, false);
        break;
      case 'uint8':
        value = this.view.getUint8(this.pos);
        break;
      case 'uint16':
        value = this.view.getUint16(this.pos, false);
        break;
      case 'uint32':
        value = this.view.getUint32(this.pos, false);
        break;
      case 'float':
        value = this.view.getFloat32(this.pos, false);
        break;
      case 'bool':
        value = this.view.getUint8(this.pos) !== 0;
        break;
      case 'binary':
        const length = this.read('uint16');
        value = this.view.buffer.slice(this.pos, this.pos + length);
        this.pos += length;
        return value as ELOTypeMap[T];
    }

    this.pos += size;
    return value as ELOTypeMap[T];
  }
}

class ELOBufferWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private pos: number;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.pos = 0;
  }

  reset(buffer?: ArrayBuffer): void {
    this.pos = 0;
    if (buffer) {
      this.buffer = buffer;
      this.view = new DataView(buffer);
    } else {
      new Uint8Array(this.buffer).fill(0, this.pos, this.buffer.byteLength);
    }
  }

  write<T extends ELOTypes>(type: T, value: ELOTypeMap[T]): void {
    const size = ELOSizes[type];

    switch (type) {
      case 'int8':
        this.view.setInt8(this.pos, value as number);
        break;
      case 'int16':
        this.view.setInt16(this.pos, value as number, false);
        break;
      case 'int32':
        this.view.setInt32(this.pos, value as number, false);
        break;
      case 'uint8':
        this.view.setUint8(this.pos, value as number);
        break;
      case 'uint16':
        this.view.setUint16(this.pos, value as number, false);
        break;
      case 'uint32':
        this.view.setUint32(this.pos, value as number, false);
        break;
      case 'float':
        this.view.setFloat32(this.pos, value as number, false);
        break;
      case 'bool':
        this.view.setUint8(this.pos, value ? 1 : 0);
        break;
      case 'binary':
        const buffer = value as ArrayBuffer;
        const length = buffer.byteLength;
        this.write('uint16', length);
        new Uint8Array(this.buffer).set(new Uint8Array(buffer), this.pos);
        this.pos += length;
        return;
    }

    this.pos += size;
  }

  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.pos);
  }
}

class ELOPackage {
  private static bufferReader = new ELOBufferReader(new ArrayBuffer(0));
  private static bufferWriter = new ELOBufferWriter(new ArrayBuffer(102400));

  static unpack<S extends ELOSchema>(
    schema: S,
    buffer: ArrayBuffer,
    reader?: ELOBufferReader,
  ): ELOInfer<S> {
    const r = reader ?? this.bufferReader;

    if (!reader) {
      const length = buffer.byteLength;
      const view = new DataView(buffer);
      let checksum = 0;

      for (let i = 0; i < length - 1; i++) {
        const byte = view.getUint8(i);
        view.setUint8(i, (byte - length - i) & 0xff);
        checksum += view.getUint8(i);
      }

      if ((checksum & 0xff) !== view.getUint8(length - 1)) {
        throw new Error('Invalid package!');
      }

      this.bufferReader.reset(buffer);
    }

    const result: Record<string, unknown> = {};

    for (const key in schema) {
      const type = schema[key];

      if (typeof type === 'string') {
        result[key] = r.read(type);
      } else if (Array.isArray(type)) {
        const count = r.read('uint16');
        const elementType = type[0];

        if (!count || !elementType) {
          continue;
        }

        if (typeof elementType === 'object') {
          const array: unknown[] = [];
          for (let i = 0; i < count; i++) {
            array.push(this.unpack(elementType, buffer, r));
          }
          result[key] = array;
        } else {
          const array: unknown[] = [];
          for (let i = 0; i < count; i++) {
            array.push(r.read(elementType));
          }
          result[key] = array;
        }
      } else if (typeof type === 'object') {
        result[key] = this.unpack(type, buffer, r);
      }
    }

    return result as ELOInfer<S>;
  }

  static pack<S extends ELOSchema>(
    schema: S,
    data: ELOInfer<S>,
    writer?: ELOBufferWriter,
  ): ArrayBuffer {
    const s = { ...schema, __checkSum: 'uint8' } as ELOSchema;
    const d = { ...data, __checkSum: 0 } as ELOInfer<ELOSchema>;
    const w = writer ?? this.bufferWriter;

    if (!writer) {
      this.bufferWriter.reset();
    }

    for (const key in s) {
      const type = s[key];

      if (typeof type === 'string') {
        w.write(type, d[key] as ELOTypeMap[ELOTypes]);
      } else if (Array.isArray(type)) {
        const array = d[key] as (ELOTypeMap[ELOTypes] | ELOInfer<ELOSchema>)[];
        w.write('uint16', array.length);
        const elementType = type[0];

        if (!elementType) {
          continue;
        }

        if (typeof elementType === 'object') {
          for (const item of array as ELOInfer<ELOSchema>[]) {
            this.pack(elementType, item, w);
          }
        } else {
          for (const item of array as ELOTypeMap[ELOTypes][]) {
            w.write(elementType, item);
          }
        }
      } else if (typeof type === 'object') {
        this.pack(type, d[key] as ELOInfer<ELOSchema>, w);
      }
    }

    const buffer = w.getBuffer();

    if (!writer) {
      const length = buffer.byteLength;
      const view = new DataView(buffer);
      let checksum = 0;

      for (let i = 0; i < length - 1; i++) {
        const byte = view.getUint8(i);
        checksum += byte;
        view.setUint8(i, (byte + length + i) & 0xff);
      }

      view.setUint8(length - 1, checksum & 0xff);
    }

    return buffer;
  }
}

export function eloPack<S extends ELOSchema>(
  schema: S,
  data: ELOInfer<S>,
): ArrayBuffer {
  return ELOPackage.pack(schema, data);
}

export function eloUnpack<S extends ELOSchema>(
  schema: S,
  buffer: ArrayBuffer,
): ELOInfer<S> {
  return ELOPackage.unpack(schema, buffer);
}
