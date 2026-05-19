import type { AnyRecord, HsmQueryBinding, HsmQueryType } from "../core/types.js";

type QueryHelperOptions<TContext extends AnyRecord = AnyRecord> = Omit<
  HsmQueryBinding<TContext>,
  "type" | "default"
>;

function binding<TContext extends AnyRecord>(
  type: HsmQueryType,
  defaultValue: unknown,
  options: QueryHelperOptions<TContext> = {}
): HsmQueryBinding<TContext> {
  return {
    ...options,
    type,
    default: defaultValue
  };
}

export const query = Object.freeze({
  string<TContext extends AnyRecord = AnyRecord>(
    defaultValue = "",
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("string", defaultValue, options);
  },

  number<TContext extends AnyRecord = AnyRecord>(
    defaultValue = 0,
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("number", defaultValue, options);
  },

  boolean<TContext extends AnyRecord = AnyRecord>(
    defaultValue = false,
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("boolean", defaultValue, options);
  },

  stringArray<TContext extends AnyRecord = AnyRecord>(
    defaultValue: readonly string[] = [],
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("string[]", [...defaultValue], options);
  },

  numberArray<TContext extends AnyRecord = AnyRecord>(
    defaultValue: readonly number[] = [],
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("number[]", [...defaultValue], options);
  },

  booleanArray<TContext extends AnyRecord = AnyRecord>(
    defaultValue: readonly boolean[] = [],
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("boolean[]", [...defaultValue], options);
  },

  json<TContext extends AnyRecord = AnyRecord>(
    defaultValue: unknown,
    options: QueryHelperOptions<TContext> = {}
  ): HsmQueryBinding<TContext> {
    return binding("json", defaultValue, options);
  }
});
