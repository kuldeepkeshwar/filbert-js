// Template scanner — classify each interpolation slot's position inside the
// CSS template. Used by the interpolate step to decide whether a function
// interpolation can be inverted to a CSS custom property (value position) or
// must be resolved inline (selector / block position, or inside a string).
//
// Runs once per styled component at definition time — not per render.

export interface ScanState {
  quote: number;
  parenDepth: number;
  braceDepth: number;
  inValue: boolean;
}

export interface SlotDescriptor {
  inQuote: boolean;
  inParen: boolean;
  inValue: boolean;
  braceDepth: number;
}

export function scanSlot(state: ScanState): SlotDescriptor {
  return {
    inQuote: state.quote !== 0,
    inParen: state.parenDepth > 0,
    inValue: state.inValue,
    braceDepth: state.braceDepth,
  };
}

// A slot is INVERTIBLE (can be replaced by `var(--x)`) when we're inside a
// declaration value, outside quotes. Parens are fine — `padding: calc(var(--x)
// + 8px)` works.
export function isInvertible(descriptor: SlotDescriptor): boolean {
  return descriptor.inValue && !descriptor.inQuote;
}

// Advance state through a chunk of CSS text, updating quote/paren/brace/inValue.
export function feedChunk(state: ScanState, chunk: string): void {
  const len = chunk.length;
  for (let i = 0; i < len; i++) {
    const c = chunk.charCodeAt(i);
    if (state.quote) {
      if (c === 92 /* \ */ && i + 1 < len) {
        i++;
        continue;
      }
      if (c === state.quote) state.quote = 0;
      continue;
    }
    if (c === 34 || c === 39) {
      state.quote = c;
      continue;
    }
    if (c === 40) state.parenDepth++;
    else if (c === 41) state.parenDepth--;
    else if (c === 123 /* { */) {
      state.braceDepth++;
      state.inValue = false;
    } else if (c === 125 /* } */) {
      state.braceDepth--;
      state.inValue = false;
    } else if (c === 58 /* : */ && state.parenDepth === 0) {
      state.inValue = true;
    } else if (c === 59 /* ; */ && state.parenDepth === 0) {
      state.inValue = false;
    }
  }
}

export function newScanState(): ScanState {
  return { quote: 0, parenDepth: 0, braceDepth: 0, inValue: false };
}

// Convenience: apply feedChunk / scanSlot for a chunk that comes AT a slot
// position. Useful for the interpolate loop.
export function scanNextSlot(state: ScanState, chunk: string): SlotDescriptor {
  feedChunk(state, chunk);
  return scanSlot(state);
}

// Re-export for backwards compatibility. `scanNextSlot` isn't needed anywhere
// today but keeping it as a documented helper.
export { scanSlot as descriptorOf };
