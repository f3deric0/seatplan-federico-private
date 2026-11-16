// Reads the parts of Mapbox Vector Tile 2.x used by the discovery basemap.
// https://mapbox.github.io/vector-tile-spec/
class Reader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get more() { return this.offset < this.bytes.length; }

  private byte() {
    if (!this.more) throw new Error("Truncated map tile");
    return this.bytes[this.offset++];
  }

  uint32() {
    let result = 0;
    for (let shift = 0; shift < 32; shift += 7) {
      const byte = this.byte();
      if (shift === 28 && byte > 15) throw new Error("Invalid map tile integer");
      result += (byte & 127) * 2 ** shift;
      if (byte < 128) return result;
    }
    throw new Error("Invalid map tile integer");
  }

  private advance(length: number) {
    this.offset += length;
    if (this.offset > this.bytes.length) throw new Error("Truncated map tile");
  }

  fieldBytes() {
    const length = this.uint32();
    const start = this.offset;
    this.advance(length);
    return this.bytes.subarray(start, this.offset);
  }

  skip(wire: number) {
    if (wire === 0) {
      // An ignored field can contain a 64-bit ID.
      for (let count = 0; count < 10; count++) {
        if (this.byte() < 128) return;
      }
      throw new Error("Invalid map tile integer");
    }
    if (wire === 1) this.advance(8);
    else if (wire === 2) this.fieldBytes();
    else if (wire === 5) this.advance(4);
    else throw new Error("Unsupported map tile field");
  }

  *fields() {
    while (this.more) {
      const key = this.uint32();
      yield { field: key >>> 3, wire: key & 7 };
    }
  }
}

type Feature = { kind: number; category?: string; geometry: Uint8Array };
type Layer = { extent: number; features: Feature[] };
const decoder = new TextDecoder();

function readStringValue(bytes: Uint8Array) {
  const value = new Reader(bytes);
  for (const { field, wire } of value.fields()) {
    if (field === 1 && wire === 2) return decoder.decode(value.fieldBytes());
    value.skip(wire);
  }
  return undefined;
}

function readFeature(bytes: Uint8Array, classKey: number, values: (string | undefined)[]): Feature | undefined {
  const feature = new Reader(bytes);
  let kind = 0;
  let geometry: Uint8Array | undefined;
  let category: string | undefined;
  for (const { field, wire } of feature.fields()) {
    if (field === 2 && wire === 2) {
      const tags = new Reader(feature.fieldBytes());
      while (tags.more) {
        const key = tags.uint32();
        const index = tags.uint32();
        if (key === classKey) category = values[index];
      }
    } else if (field === 3 && wire === 0) kind = feature.uint32();
    else if (field === 4 && wire === 2) geometry = feature.fieldBytes();
    else feature.skip(wire);
  }
  if (geometry && (kind === 2 || kind === 3)) return { kind, category, geometry };
  return undefined;
}

export function readMapLayers(bytes: Uint8Array, wanted: ReadonlySet<string>) {
  const tile = new Reader(bytes);
  const layers = new Map<string, Layer>();
  for (const { field, wire } of tile.fields()) {
    if (field !== 3 || wire !== 2) {
      tile.skip(wire);
      continue;
    }
    const layer = new Reader(tile.fieldBytes());
    const features: Uint8Array[] = [];
    const keys: string[] = [];
    const values: (string | undefined)[] = [];
    let name = "";
    let extent = 4096;
    for (const entry of layer.fields()) {
      if (entry.field === 1 && entry.wire === 2) {
        name = decoder.decode(layer.fieldBytes());
        if (!wanted.has(name)) break;
      } else if (entry.field === 2 && entry.wire === 2) features.push(layer.fieldBytes());
      else if (entry.field === 3 && entry.wire === 2) keys.push(decoder.decode(layer.fieldBytes()));
      else if (entry.field === 4 && entry.wire === 2) values.push(readStringValue(layer.fieldBytes()));
      else if (entry.field === 5 && entry.wire === 0) extent = layer.uint32();
      else layer.skip(entry.wire);
    }
    if (!wanted.has(name) || extent === 0) continue;
    const classKey = keys.indexOf("class");
    layers.set(name, {
      extent,
      features: features.flatMap(bytes => readFeature(bytes, classKey, values) ?? []),
    });
  }
  return layers;
}

export function traceGeometry(
  path: Pick<CanvasRenderingContext2D, "moveTo" | "lineTo" | "closePath">,
  bytes: Uint8Array,
  scale: number,
) {
  const geometry = new Reader(bytes);
  let x = 0;
  let y = 0;
  const delta = () => {
    const value = geometry.uint32();
    return (value >>> 1) ^ -(value & 1);
  };
  while (geometry.more) {
    const command = geometry.uint32();
    const kind = command & 7;
    const count = command >>> 3;
    if (kind === 7 && count === 1) {
      path.closePath();
      continue;
    }
    if (kind !== 1 && kind !== 2) throw new Error("Invalid map geometry command");
    for (let point = 0; point < count; point++) {
      x += delta();
      y += delta();
      if (kind === 1) path.moveTo(x * scale, y * scale);
      else path.lineTo(x * scale, y * scale);
    }
  }
}
