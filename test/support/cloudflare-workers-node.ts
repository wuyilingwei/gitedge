class NoopSpan {
  readonly isTraced = false;

  setAttribute(): this {
    return this;
  }

  setAttributes(): this {
    return this;
  }

  end(): void {}
}

export const tracing = {
  enterSpan<T>(name: string, callback: (span: NoopSpan) => T): T {
    void name;
    return callback(new NoopSpan());
  },
  startActiveSpan<T>(name: string, callback: (span: NoopSpan) => T): T {
    void name;
    return callback(new NoopSpan());
  },
  startSpan(): NoopSpan {
    return new NoopSpan();
  },
  Span: NoopSpan,
};

export const exports = {};

export class DurableObject {
  protected readonly ctx: DurableObjectState;
  protected readonly env: unknown;

  constructor(ctx: DurableObjectState, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}
