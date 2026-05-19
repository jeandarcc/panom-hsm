'use strict';

var runtime = require('@panomapp/subdomain-policy/runtime');
var vue = require('vue');

// src/errors/HsmErrors.ts
var HsmError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
};
var HsmConfigurationError = class extends HsmError {
  constructor(message) {
    super("HSM_CONFIGURATION_ERROR", message);
  }
};
var HsmDuplicateStateError = class extends HsmError {
  constructor(stateId) {
    super("HSM_DUPLICATE_STATE", `Duplicate state id: ${stateId}`);
  }
};
var HsmMissingStateError = class extends HsmError {
  constructor(stateId) {
    super("HSM_MISSING_STATE", `State does not exist: ${stateId}`);
  }
};
var HsmMissingGuardError = class extends HsmError {
  constructor(guardName, stateId) {
    super(
      "HSM_MISSING_GUARD",
      `Guard "${guardName}" used by state "${stateId}" is not registered.`
    );
  }
};
var HsmGuardRejectedError = class extends HsmError {
  stateId;
  guardName;
  constructor(stateId, guardName) {
    super(
      "HSM_GUARD_REJECTED",
      `Guard "${guardName}" rejected transition into state "${stateId}".`
    );
    this.stateId = stateId;
    this.guardName = guardName;
  }
};
var HsmRouteNotFoundError = class extends HsmError {
  constructor(pathname) {
    super("HSM_ROUTE_NOT_FOUND", `No HSM route matched pathname: ${pathname}`);
  }
};
var HsmRouteBuildError = class extends HsmError {
  constructor(message) {
    super("HSM_ROUTE_BUILD_ERROR", message);
  }
};
var HsmRedirectLoopError = class extends HsmError {
  constructor(from, maxRedirects) {
    super(
      "HSM_REDIRECT_LOOP",
      `Stopped resolving redirects from "${from}" after ${maxRedirects} redirects.`
    );
  }
};
var HsmUnresolvedStateError = class extends HsmError {
  constructor(stateId) {
    super("HSM_UNRESOLVED_STATE", `State "${stateId}" could not be resolved by selection rules.`);
  }
};
var HsmQueryParseError = class extends HsmError {
  constructor(queryKey, message) {
    const prefix = queryKey ? `Invalid query value for "${queryKey}". ` : "Invalid query value. ";
    super("HSM_QUERY_PARSE_ERROR", `${prefix}${message}`);
  }
};

// src/utils/assert.ts
function invariant(condition, message) {
  if (!condition) {
    throw new HsmConfigurationError(message);
  }
}

// src/core/HsmPath.ts
var STATE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;
var HsmPath = class {
  static separator = ".";
  constructor() {
  }
  static validateMachineId(machineId) {
    invariant(machineId.trim().length > 0, "Machine id cannot be empty.");
  }
  static validateStateKey(key) {
    invariant(key.trim().length > 0, "State key cannot be empty.");
    invariant(
      STATE_KEY_RE.test(key),
      `Invalid state key "${key}". Use letters, numbers, _, $ or - and do not start with a number.`
    );
  }
  static join(parentId, key) {
    this.validateStateKey(key);
    return parentId ? `${parentId}${this.separator}${key}` : key;
  }
  static split(stateId) {
    invariant(stateId.trim().length > 0, "State id cannot be empty.");
    const parts = stateId.split(this.separator);
    for (const part of parts) this.validateStateKey(part);
    return parts;
  }
  static isAncestor(ancestorId, stateId) {
    return stateId === ancestorId || stateId.startsWith(`${ancestorId}${this.separator}`);
  }
};

// src/core/StateNode.ts
var StateNode = class {
  childrenByKey = /* @__PURE__ */ new Map();
  key;
  id;
  parent;
  config;
  depth;
  constructor(args) {
    this.key = args.key;
    this.id = args.id;
    this.parent = args.parent;
    this.config = args.config;
    this.depth = args.parent ? args.parent.depth + 1 : 0;
  }
  get path() {
    return this.config.path;
  }
  get url() {
    return this.config.url;
  }
  get initial() {
    return this.config.initial;
  }
  get meta() {
    return this.config.meta ?? {};
  }
  get tags() {
    return this.config.tags ?? [];
  }
  get children() {
    return Array.from(this.childrenByKey.values());
  }
  addChild(child) {
    if (this.childrenByKey.has(child.key)) {
      throw new Error(`Child "${child.key}" already exists under "${this.id}".`);
    }
    this.childrenByKey.set(child.key, child);
  }
  hasChild(key) {
    return this.childrenByKey.has(key);
  }
  child(key) {
    HsmPath.validateStateKey(key);
    const child = this.childrenByKey.get(key);
    if (!child) {
      throw new HsmMissingStateError(HsmPath.join(this.id, key));
    }
    return child;
  }
  ancestors() {
    const result = [];
    let cursor = this.parent;
    while (cursor) {
      result.unshift(cursor);
      cursor = cursor.parent;
    }
    return result;
  }
  activePath() {
    return [...this.ancestors(), this];
  }
  is(stateId) {
    return HsmPath.isAncestor(stateId, this.id);
  }
  toString() {
    return this.id;
  }
};

// src/core/StateTree.ts
var StateTree = class {
  nodesById = /* @__PURE__ */ new Map();
  rootNodes;
  constructor(config) {
    HsmPath.validateMachineId(config.id);
    invariant(Object.keys(config.states).length > 0, "Machine must define at least one root state.");
    this.rootNodes = Object.entries(config.states).map(
      ([key, stateConfig]) => this.buildNode(key, null, stateConfig)
    );
    this.validateInitial(config.initial, this.rootNodes, "machine root");
  }
  get roots() {
    return this.rootNodes;
  }
  get all() {
    return Array.from(this.nodesById.values());
  }
  get(stateId) {
    const node = this.nodesById.get(stateId);
    if (!node) throw new HsmMissingStateError(stateId);
    return node;
  }
  has(stateId) {
    return this.nodesById.has(stateId);
  }
  firstRoot() {
    const first = this.rootNodes[0];
    invariant(first, "Machine must define at least one root state.");
    return first;
  }
  rootByKey(key) {
    const root = this.rootNodes.find((node) => node.key === key);
    if (!root) throw new HsmMissingStateError(key);
    return root;
  }
  expandInitial(node) {
    let cursor = node;
    while (cursor.initial) {
      cursor = cursor.child(cursor.initial);
    }
    return cursor;
  }
  buildNode(key, parent, config) {
    HsmPath.validateStateKey(key);
    const id = HsmPath.join(parent?.id ?? null, key);
    if (this.nodesById.has(id)) {
      throw new HsmDuplicateStateError(id);
    }
    const node = new StateNode({ key, id, parent, config });
    this.nodesById.set(id, node);
    const children = Object.entries(config.states ?? {});
    for (const [childKey, childConfig] of children) {
      const child = this.buildNode(childKey, node, childConfig);
      node.addChild(child);
    }
    this.validateInitial(config.initial, node.children, node.id);
    return node;
  }
  validateInitial(initial, children, owner) {
    if (!initial) return;
    HsmPath.validateStateKey(initial);
    invariant(
      children.some((child) => child.key === initial),
      `Initial state "${initial}" does not exist under ${owner}.`
    );
  }
};

// src/guards/GuardRegistry.ts
var GuardRegistry = class {
  guards = /* @__PURE__ */ new Map();
  constructor(guards = {}) {
    for (const [name, guard] of Object.entries(guards)) {
      this.register(name, guard);
    }
  }
  register(name, guard) {
    this.guards.set(name, guard);
  }
  has(name) {
    return this.guards.has(name);
  }
  get(name, stateId) {
    const guard = this.guards.get(name);
    if (!guard) throw new HsmMissingGuardError(name, stateId);
    return guard;
  }
  async accepts(input, ref) {
    if (!ref) return true;
    const guards = this.normalize(ref, input.stateId);
    for (const guard of guards) {
      const accepted = await guard.run(input);
      if (!accepted) return false;
    }
    return true;
  }
  async assertAll(input, ref) {
    if (!ref) return;
    const guards = this.normalize(ref, input.stateId);
    for (const guard of guards) {
      const accepted = await guard.run(input);
      if (!accepted) {
        throw new HsmGuardRejectedError(input.stateId, guard.name);
      }
    }
  }
  normalize(ref, stateId) {
    const refs = Array.isArray(ref) ? ref : [ref];
    return refs.map((item, index) => {
      if (typeof item === "string") {
        return { name: item, run: this.get(item, stateId) };
      }
      return { name: `inline:${index}`, run: item };
    });
  }
};

// src/actions/ActionRegistry.ts
var ActionRegistry = class {
  actions = /* @__PURE__ */ new Map();
  constructor(actions = {}) {
    for (const [name, action] of Object.entries(actions)) {
      this.register(name, action);
    }
  }
  register(name, action) {
    this.actions.set(name, action);
  }
  has(name) {
    return this.actions.has(name);
  }
  get(name, stateId) {
    const action = this.actions.get(name);
    if (!action) {
      throw new HsmConfigurationError(
        `Action "${name}" used by state "${stateId}" is not registered.`
      );
    }
    return action;
  }
  async runAll(input, ref) {
    if (!ref) return;
    const actions = this.normalize(ref, input.stateId);
    for (const action of actions) {
      await action.run(input);
    }
  }
  normalize(ref, stateId) {
    const refs = Array.isArray(ref) ? ref : [ref];
    return refs.map((item, index) => {
      if (typeof item === "string") {
        return { name: item, run: this.get(item, stateId) };
      }
      return { name: `inline:${index}`, run: item };
    });
  }
};

// src/loaders/LoaderRegistry.ts
var LoaderRegistry = class {
  loaders = /* @__PURE__ */ new Map();
  constructor(loaders = {}) {
    for (const [name, loader] of Object.entries(loaders)) {
      this.register(name, loader);
    }
  }
  register(name, loader) {
    this.loaders.set(name, loader);
  }
  has(name) {
    return this.loaders.has(name);
  }
  get(name, stateId) {
    const loader = this.loaders.get(name);
    if (!loader) {
      throw new HsmConfigurationError(
        `Loader "${name}" used by state "${stateId}" is not registered.`
      );
    }
    return loader;
  }
  normalize(ref, stateId) {
    if (!ref) return [];
    const refs = Array.isArray(ref) ? ref : [ref];
    return refs.map((item, index) => {
      if (typeof item === "string") return { name: item, run: this.get(item, stateId) };
      return { name: `inline:${index}`, run: item };
    });
  }
  async runAll(input, ref) {
    const loaders = this.normalize(ref, input.stateId);
    if (loaders.length === 0) return void 0;
    const results = {};
    for (const loader of loaders) {
      if (input.signal.aborted) throw new DOMException("Transition aborted before loader execution.", "AbortError");
      results[loader.name] = await loader.run(input);
    }
    const names = Object.keys(results);
    if (names.length === 1) return results[names[0]];
    return Object.freeze(results);
  }
};

// src/loaders/LoaderRunner.ts
var LoaderRunner = class {
  constructor(loaders) {
    this.loaders = loaders;
  }
  loaders;
  async run(input) {
    const data = {};
    const existing = input.from?.data;
    if (existing) Object.assign(data, existing);
    const statesToLoad = this.statesWithLoaders(input.to.activePath, input.entering);
    for (const state of statesToLoad) {
      const value = await this.loaders.runAll(
        {
          context: input.to.context,
          state,
          stateId: state.id,
          params: input.to.params,
          meta: state.meta,
          signal: input.signal,
          ...input.event ? { event: input.event } : {},
          ...input.from ? { fromStateId: input.from.stateId } : {},
          toStateId: input.to.node.id
        },
        state.config.loader
      );
      if (value !== void 0) {
        data[state.id] = value;
        input.lifecycle.push(Object.freeze({ phase: "load", stateId: state.id }));
      }
    }
    return Object.freeze(data);
  }
  statesWithLoaders(activePath, entering) {
    const enteringIds = new Set(entering.map((state) => state.id));
    return activePath.filter((state) => state.config.loader && enteringIds.has(state.id));
  }
};

// src/events/EventDispatcher.ts
var EventDispatcher = class {
  constructor(tree, guards) {
    this.tree = tree;
    this.guards = guards;
  }
  tree;
  guards;
  async resolve(from, event, context) {
    const path = from.activePath.map((stateId) => this.tree.get(stateId)).reverse();
    for (const origin of path) {
      const refs = this.eventRefs(origin, event.type);
      for (const ref of refs) {
        const config = this.normalize(ref);
        const target = this.resolveTarget(origin, config.target);
        const input = { event, context, from, state: origin };
        const params = await this.resolveParams(config, input);
        const accepted = await this.guards.accepts(
          {
            context,
            state: target,
            stateId: target.id,
            params,
            meta: target.meta,
            event,
            fromStateId: origin.id,
            toStateId: target.id
          },
          config.guard
        );
        if (!accepted) continue;
        const patch = await this.resolveContextPatch(config, input);
        return Object.freeze({
          target: target.id,
          params: Object.freeze(params),
          ...patch ? { contextPatch: Object.freeze(patch) } : {},
          ...config.actions ? { actions: config.actions } : {},
          originStateId: origin.id
        });
      }
    }
    return null;
  }
  eventRefs(state, type) {
    const ref = state.config.on?.[type];
    if (!ref) return [];
    return Array.isArray(ref) ? ref : [ref];
  }
  normalize(ref) {
    if (typeof ref === "string") return { target: ref };
    return ref;
  }
  resolveTarget(origin, target) {
    if (this.tree.has(target)) return this.tree.get(target);
    return origin.parent?.child(target) ?? origin.child(target);
  }
  async resolveParams(config, input) {
    if (!config.params) return {};
    if (typeof config.params === "function") return config.params(input);
    return { ...config.params };
  }
  async resolveContextPatch(config, input) {
    if (!config.context) return void 0;
    if (typeof config.context === "function") return config.context(input);
    return { ...config.context };
  }
};

// src/utils/merge.ts
function shallowMerge(items) {
  return Object.assign({}, ...items);
}
function unique(items) {
  return Array.from(new Set(items));
}
function deepMerge(base, patch) {
  if (!patch) return { ...base };
  const output = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = output[key];
    output[key] = isMergeable(current) && isMergeable(value) ? deepMerge(current, value) : value;
  }
  return output;
}
function isMergeable(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/resolution/StateResolver.ts
var StateResolver = class {
  constructor(tree, guards) {
    this.tree = tree;
    this.guards = guards;
  }
  tree;
  guards;
  async resolve(stateId, fallbackContext, options = {}, route) {
    const expandInitial = options.expandInitial ?? true;
    const context = options.context ?? fallbackContext;
    const params = options.params ?? {};
    const baseNode = this.tree.get(stateId);
    const node = await this.expandSemanticNode(baseNode, context, params, expandInitial);
    const activePath = node.activePath();
    const meta = this.mergeMeta(activePath);
    const tags = unique(activePath.flatMap((item) => [...item.tags]));
    for (const state of activePath) {
      await this.guards.assertAll(
        {
          context,
          state,
          stateId: state.id,
          params,
          meta: state.meta
        },
        state.config.guard
      );
    }
    return {
      node,
      context,
      params,
      activePath,
      meta,
      tags,
      ...route ? { route } : {}
    };
  }
  async resolveInitial(rootInitial, context, options = {}) {
    const root = rootInitial ? this.tree.rootByKey(rootInitial) : this.tree.firstRoot();
    return this.resolve(root.id, context, { ...options, context });
  }
  async expandSemanticNode(start, context, params, expandInitial) {
    let cursor = start;
    const visited = /* @__PURE__ */ new Set();
    while (true) {
      if (visited.has(cursor.id)) {
        throw new HsmUnresolvedStateError(cursor.id);
      }
      visited.add(cursor.id);
      const selected = await this.selectChild(cursor, context, params);
      if (selected) {
        cursor = selected;
        continue;
      }
      if (expandInitial && cursor.initial) {
        cursor = cursor.child(cursor.initial);
        continue;
      }
      return cursor;
    }
  }
  async selectChild(node, context, params) {
    const rules = node.config.resolve ?? [];
    if (rules.length === 0) return null;
    for (const rule of rules) {
      const target = this.resolveTargetNode(node, rule.target);
      const accepted = await this.guards.accepts(
        {
          context,
          state: target,
          stateId: target.id,
          params,
          meta: target.meta
        },
        rule.guard
      );
      if (accepted) return target;
    }
    throw new HsmUnresolvedStateError(node.id);
  }
  resolveTargetNode(origin, target) {
    if (this.tree.has(target)) return this.tree.get(target);
    return origin.child(target);
  }
  mergeMeta(activePath) {
    return shallowMerge(activePath.map((node) => node.meta));
  }
};

// src/core/SnapshotFactory.ts
var SnapshotFactory = class {
  constructor(machineId) {
    this.machineId = machineId;
  }
  machineId;
  create(resolved, redirect) {
    const stateId = resolved.node.id;
    const activeIds = resolved.activePath.map((node) => node.id);
    const tags = [...resolved.tags];
    const route = resolved.route ? Object.freeze({
      pattern: resolved.route.pattern,
      canonicalPattern: resolved.route.canonicalPattern,
      pathname: resolved.route.pathname,
      canonicalPathname: resolved.route.canonicalPathname,
      query: Object.freeze({ ...resolved.route.query }),
      hash: resolved.route.hash,
      matchedStateId: resolved.route.stateId,
      kind: resolved.route.kind,
      isCanonical: resolved.route.isCanonical
    }) : void 0;
    const urlState = resolved.urlState ? Object.freeze({
      raw: Object.freeze({ ...resolved.urlState.raw }),
      decoded: Object.freeze({ ...resolved.urlState.decoded }),
      unknown: Object.freeze({ ...resolved.urlState.unknown }),
      projected: Object.freeze({ ...resolved.urlState.projected }),
      context: Object.freeze({ ...resolved.urlState.context })
    }) : void 0;
    const data = resolved.data ? this.freezeRecord(resolved.data) : void 0;
    const policy = resolved.policy ? this.freezePolicy(resolved.policy) : void 0;
    const snapshot = {
      machineId: this.machineId,
      stateId,
      value: this.toStateValue(stateId),
      context: Object.freeze({ ...resolved.context }),
      params: Object.freeze({ ...resolved.params }),
      meta: Object.freeze({ ...resolved.meta }),
      tags: Object.freeze(tags),
      activePath: Object.freeze(activeIds),
      ...route ? { route } : {},
      ...urlState ? { urlState } : {},
      ...data ? { data } : {},
      ...policy ? { policy } : {},
      ...redirect ? { redirect } : {},
      is: (candidate) => HsmPath.isAncestor(candidate, stateId),
      hasTag: (tag) => tags.includes(tag),
      can: (permission) => policy?.decisions.permissions[permission]?.allowed ?? false,
      canUse: (capability) => policy?.decisions.capabilities[capability]?.allowed ?? false,
      feature: (feature) => policy?.decisions.features[feature]?.allowed ?? false
    };
    return Object.freeze(snapshot);
  }
  freezeRecord(input) {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = value && typeof value === "object" && !Array.isArray(value) ? Object.freeze({ ...value }) : value;
    }
    return Object.freeze(output);
  }
  freezePolicy(policy) {
    const freezeDecisionMap = (input) => {
      const output = {};
      for (const [key, value] of Object.entries(input)) {
        output[key] = Object.freeze({
          ...value,
          inheritedFrom: Object.freeze([...value.inheritedFrom ?? []]),
          deniedBy: Object.freeze([...value.deniedBy ?? []])
        });
      }
      return Object.freeze(output);
    };
    return Object.freeze({
      permissions: Object.freeze([...policy.permissions]),
      capabilities: Object.freeze([...policy.capabilities]),
      features: Object.freeze([...policy.features]),
      deniedPermissions: Object.freeze([...policy.deniedPermissions]),
      deniedCapabilities: Object.freeze([...policy.deniedCapabilities]),
      deniedFeatures: Object.freeze([...policy.deniedFeatures]),
      ...policy.layout ? { layout: policy.layout } : {},
      decisions: Object.freeze({
        permissions: freezeDecisionMap(policy.decisions.permissions),
        capabilities: freezeDecisionMap(policy.decisions.capabilities),
        features: freezeDecisionMap(policy.decisions.features)
      })
    });
  }
  toStateValue(stateId) {
    const parts = HsmPath.split(stateId);
    let value;
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const part = parts[index];
      if (!part) continue;
      value = value === void 0 ? part : { [part]: value };
    }
    return value ?? stateId;
  }
};

// src/routing/UrlTools.ts
var UrlTools = class {
  constructor() {
  }
  static parse(input, baseUrl = "http://hsm.local") {
    const url = new URL(input, baseUrl);
    return {
      pathname: this.normalizePathname(url.pathname),
      query: this.searchParamsToRecord(url.searchParams),
      hash: url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
    };
  }
  static normalizePathname(pathname) {
    const decoded = pathname.trim() || "/";
    const singleSlash = decoded.replace(/\/+/g, "/");
    if (singleSlash === "/") return "/";
    return `/${singleSlash.replace(/^\/+|\/+$/g, "")}`;
  }
  static encodeQuery(query2) {
    if (!query2) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query2)) {
      if (value === void 0 || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, String(item));
        continue;
      }
      params.set(key, String(value));
    }
    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }
  static encodeHash(hash) {
    if (!hash) return "";
    return hash.startsWith("#") ? hash : `#${hash}`;
  }
  static searchParamsToRecord(params) {
    const output = {};
    params.forEach((_value, key) => {
      if (Object.prototype.hasOwnProperty.call(output, key)) return;
      const values = params.getAll(key);
      output[key] = values.length > 1 ? values : values[0] ?? "";
    });
    return output;
  }
};

// src/routing/PathComposer.ts
var PathComposer = class {
  constructor() {
  }
  static join(fragments) {
    const defined = fragments.filter((fragment) => fragment !== void 0);
    if (defined.length === 0) return null;
    const parts = [];
    for (const fragment of defined) {
      const normalized = fragment.trim();
      if (!normalized || normalized === "/") continue;
      parts.push(...normalized.split("/").filter(Boolean));
    }
    return parts.length === 0 ? "/" : UrlTools.normalizePathname(parts.join("/"));
  }
  static appendSearchAndHash(pathname, query2, hash) {
    return `${pathname}${UrlTools.encodeQuery(query2)}${UrlTools.encodeHash(hash)}`;
  }
  static assertRelativeOrAbsolutePath(path) {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) {
      throw new HsmRouteBuildError(`External URL is not a routable HSM path: ${path}`);
    }
  }
};

// src/routing/PathPattern.ts
var PathPattern = class {
  pattern;
  score;
  segments;
  constructor(pattern) {
    this.pattern = UrlTools.normalizePathname(pattern);
    this.segments = this.compile(this.pattern);
    this.score = this.computeScore(this.segments);
  }
  match(pathname) {
    const incoming = this.split(UrlTools.normalizePathname(pathname));
    const params = {};
    let patternIndex = 0;
    let pathIndex = 0;
    while (patternIndex < this.segments.length) {
      const segment = this.segments[patternIndex];
      if (!segment) return null;
      if (segment.kind === "wildcard") {
        const rest = incoming.slice(pathIndex).join("/");
        if (segment.name) params[segment.name] = rest;
        return { params, score: this.score };
      }
      const value = incoming[pathIndex];
      if (value === void 0) return null;
      if (segment.kind === "static" && segment.raw !== value) return null;
      if (segment.kind === "param") {
        if (!segment.name) return null;
        params[segment.name] = decodeURIComponent(value);
      }
      patternIndex += 1;
      pathIndex += 1;
    }
    if (pathIndex !== incoming.length) return null;
    return { params, score: this.score };
  }
  build(params = {}) {
    if (this.segments.length === 0) return "/";
    const parts = this.segments.map((segment) => {
      if (segment.kind === "static") return segment.raw;
      if (segment.kind === "wildcard") {
        if (!segment.name) return "";
        const value2 = params[segment.name];
        if (value2 === void 0 || value2 === null) {
          throw new HsmRouteBuildError(
            `Missing wildcard route param "${segment.name}" for pattern "${this.pattern}".`
          );
        }
        return String(value2).split("/").filter(Boolean).map((part) => encodeURIComponent(part)).join("/");
      }
      if (!segment.name) {
        throw new HsmRouteBuildError(`Invalid param segment in pattern "${this.pattern}".`);
      }
      const value = params[segment.name];
      if (value === void 0 || value === null || value === "") {
        throw new HsmRouteBuildError(
          `Missing route param "${segment.name}" for pattern "${this.pattern}".`
        );
      }
      return encodeURIComponent(String(value));
    });
    return UrlTools.normalizePathname(parts.join("/"));
  }
  compile(pattern) {
    return this.split(pattern).map((raw) => {
      if (raw === "*") return { kind: "wildcard", raw };
      if (raw.startsWith("*")) return { kind: "wildcard", raw, name: raw.slice(1) };
      if (raw.startsWith(":")) {
        const name = raw.slice(1);
        if (!name) throw new HsmRouteBuildError(`Invalid empty route param in "${pattern}".`);
        return { kind: "param", raw, name };
      }
      return { kind: "static", raw };
    });
  }
  computeScore(segments) {
    if (segments.length === 0) return 1;
    return segments.reduce((score, segment) => {
      if (segment.kind === "static") return score + 100;
      if (segment.kind === "param") return score + 30;
      return score + 1;
    }, segments.length);
  }
  split(pathname) {
    const normalized = UrlTools.normalizePathname(pathname);
    if (normalized === "/") return [];
    return normalized.replace(/^\//, "").split("/").filter(Boolean);
  }
};

// src/routing/RouteProjection.ts
var RouteProjection = class {
  constructor() {
  }
  static mode(node) {
    if (node.url?.hide === true) return "hidden";
    return node.url?.mode ?? "visible";
  }
  static canonicalFragment(node) {
    const mode = this.mode(node);
    if (mode === "hidden" || mode === "virtual") return void 0;
    return node.url?.path ?? node.path;
  }
  static aliases(node) {
    return node.url?.aliases ?? [];
  }
  static priority(node) {
    return node.url?.priority ?? 0;
  }
  static redirectsAliases(node) {
    return node.url?.redirectAliases === true;
  }
  static isSelfRoutable(node) {
    const mode = this.mode(node);
    if (mode === "virtual") return false;
    if (node.url?.route === false) return false;
    const hasRouteSource = node.path !== void 0 || node.url?.path !== void 0;
    if (!hasRouteSource) return false;
    if (mode === "hidden" && node.url?.route !== true) return false;
    return true;
  }
  static segment(node) {
    const canonicalFragment = this.canonicalFragment(node);
    const base = {
      stateId: node.id,
      mode: this.mode(node),
      aliases: Object.freeze([...this.aliases(node)]),
      redirectAliases: this.redirectsAliases(node),
      priority: this.priority(node)
    };
    return Object.freeze(
      canonicalFragment === void 0 ? base : { ...base, canonicalFragment }
    );
  }
  static canonicalPattern(node) {
    const fragments = node.activePath().map((item) => this.canonicalFragment(item)).filter((fragment) => fragment !== void 0);
    const pattern = PathComposer.join(fragments);
    if (!pattern) return null;
    PathComposer.assertRelativeOrAbsolutePath(pattern);
    return pattern;
  }
  static projectedPatterns(node) {
    const canonicalPattern = this.canonicalPattern(node);
    if (!canonicalPattern) return [];
    const variants = this.buildVariants(node.activePath());
    const byPattern = /* @__PURE__ */ new Map();
    for (const variant of variants) {
      const pattern = PathComposer.join(variant.fragments);
      if (!pattern) continue;
      PathComposer.assertRelativeOrAbsolutePath(pattern);
      const isAlias = pattern !== canonicalPattern || variant.isAlias;
      const projection = Object.freeze({
        pattern,
        canonicalPattern,
        isAlias,
        redirectToCanonical: isAlias && variant.redirectToCanonical,
        priority: variant.priority
      });
      const previous = byPattern.get(pattern);
      if (!previous || this.preferPattern(projection, previous)) {
        byPattern.set(pattern, projection);
      }
    }
    return Object.freeze([...byPattern.values()]);
  }
  static buildVariants(activePath) {
    let variants = [
      { fragments: [], isAlias: false, redirectToCanonical: false, priority: 0 }
    ];
    for (const node of activePath) {
      const choices = this.fragmentChoices(node);
      const next = [];
      for (const variant of variants) {
        for (const choice of choices) {
          const fragments = choice.fragment === void 0 ? [...variant.fragments] : [...variant.fragments, choice.fragment];
          next.push({
            fragments,
            isAlias: variant.isAlias || choice.isAlias,
            redirectToCanonical: variant.redirectToCanonical || choice.redirectToCanonical,
            priority: variant.priority + choice.priority
          });
        }
      }
      variants = next;
    }
    return variants;
  }
  static fragmentChoices(node) {
    const choices = [];
    const canonicalFragment = this.canonicalFragment(node);
    choices.push({
      ...canonicalFragment !== void 0 ? { fragment: canonicalFragment } : {},
      isAlias: false,
      redirectToCanonical: false,
      priority: this.priority(node)
    });
    for (const alias of this.aliases(node)) {
      if (alias.trim() === "") {
        throw new HsmRouteBuildError(`Empty route alias declared on state "${node.id}".`);
      }
      choices.push({
        fragment: alias,
        isAlias: true,
        redirectToCanonical: this.redirectsAliases(node),
        priority: this.priority(node) - 1
      });
    }
    return Object.freeze(choices);
  }
  static preferPattern(next, previous) {
    if (next.isAlias !== previous.isAlias) return !next.isAlias;
    if (next.redirectToCanonical !== previous.redirectToCanonical) return next.redirectToCanonical;
    return next.priority > previous.priority;
  }
};

// src/routing/RouteTable.ts
var RouteTable = class {
  constructor(tree) {
    this.tree = tree;
    const entries = this.buildEntries();
    this.orderedEntries = Object.freeze(entries.sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      if (right.score !== left.score) return right.score - left.score;
      if (left.isAlias !== right.isAlias) return left.isAlias ? 1 : -1;
      return right.pattern.length - left.pattern.length;
    }));
  }
  tree;
  canonicalByStateId = /* @__PURE__ */ new Map();
  orderedEntries;
  get entries() {
    return this.orderedEntries.map(({ compiled: _compiled, canonicalCompiled: _canonicalCompiled, ...entry }) => entry);
  }
  match(input, baseUrl) {
    const first = this.matchAll(input, baseUrl)[0];
    if (!first) {
      const parsed = UrlTools.parse(input, baseUrl);
      throw new HsmRouteNotFoundError(parsed.pathname);
    }
    return first;
  }
  matchAll(input, baseUrl) {
    const parsed = UrlTools.parse(input, baseUrl);
    const matches = [];
    for (const entry of this.orderedEntries) {
      const result = entry.compiled.match(parsed.pathname);
      if (!result) continue;
      const canonicalPathname = entry.canonicalCompiled.build(result.params);
      matches.push(Object.freeze({
        entry,
        state: entry.state,
        stateId: entry.stateId,
        params: Object.freeze(result.params),
        pathname: parsed.pathname,
        canonicalPathname,
        query: Object.freeze(parsed.query),
        hash: parsed.hash,
        pattern: entry.pattern,
        canonicalPattern: entry.canonicalPattern,
        kind: entry.kind,
        isCanonical: !entry.isAlias && parsed.pathname === canonicalPathname
      }));
    }
    return Object.freeze(matches);
  }
  href(stateId, params = {}, options = {}) {
    const entry = this.routeForState(stateId);
    const pathname = entry.canonicalCompiled.build(params);
    return PathComposer.appendSearchAndHash(pathname, options.query, options.hash);
  }
  routeForState(stateId) {
    let node = this.tree.get(stateId);
    while (node) {
      const entry = this.canonicalByStateId.get(node.id);
      if (entry) return entry;
      node = node.parent;
    }
    throw new HsmMissingStateError(stateId);
  }
  buildEntries() {
    const entries = [];
    const dedupe = /* @__PURE__ */ new Set();
    for (const node of this.tree.all) {
      if (!RouteProjection.isSelfRoutable(node)) continue;
      const projections = RouteProjection.projectedPatterns(node);
      for (const projection of projections) {
        const compiled = new PathPattern(projection.pattern);
        const canonicalCompiled = new PathPattern(projection.canonicalPattern);
        const isAlias = projection.isAlias;
        const entry = {
          state: node,
          stateId: node.id,
          pattern: compiled.pattern,
          canonicalPattern: canonicalCompiled.pattern,
          kind: isAlias ? "alias" : "canonical",
          isAlias,
          redirectToCanonical: projection.redirectToCanonical,
          priority: projection.priority,
          score: compiled.score,
          compiled,
          canonicalCompiled
        };
        const key = `${entry.kind}:${entry.stateId}:${entry.pattern}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        if (!isAlias && !this.canonicalByStateId.has(node.id)) {
          this.canonicalByStateId.set(node.id, entry);
        }
        entries.push(entry);
      }
    }
    return entries;
  }
};

// src/query/ObjectPath.ts
var CONTEXT_PREFIX = "context.";
var PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$-]*(\.[A-Za-z_$][A-Za-z0-9_$-]*)*$/;
var ObjectPath = class _ObjectPath {
  raw;
  parts;
  constructor(raw) {
    const normalized = _ObjectPath.normalize(raw);
    this.raw = normalized;
    this.parts = Object.freeze(normalized.split("."));
  }
  static normalize(raw, fallback) {
    const source = (raw ?? fallback ?? "").trim();
    const withoutContext = source.startsWith(CONTEXT_PREFIX) ? source.slice(CONTEXT_PREFIX.length) : source;
    if (!PATH_RE.test(withoutContext)) {
      throw new HsmConfigurationError(
        `Invalid query source path "${source}". Use a context path like "tab" or "profile.tab".`
      );
    }
    return withoutContext;
  }
  get(input) {
    let cursor = input;
    for (const part of this.parts) {
      if (!_ObjectPath.isRecord(cursor)) return void 0;
      cursor = cursor[part];
    }
    return cursor;
  }
  set(input, value) {
    return this.setAt(input, 0, value);
  }
  setAt(current, index, value) {
    const part = this.parts[index];
    if (!part) return value;
    const base = _ObjectPath.isRecord(current) ? current : {};
    const nextValue = this.setAt(base[part], index + 1, value);
    if (base[part] === nextValue) return base;
    return { ...base, [part]: nextValue };
  }
  static isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
};

// src/query/QueryCodec.ts
var QueryCodec = class {
  constructor() {
  }
  static decode(raw, type) {
    if (raw === void 0) return void 0;
    switch (type) {
      case "string":
        return this.toSingleString(raw);
      case "number":
        return this.toNumber(raw);
      case "boolean":
        return this.toBoolean(raw);
      case "string[]":
        return this.toArray(raw).map((value) => String(value));
      case "number[]":
        return this.toArray(raw).map((value) => this.toNumber(value));
      case "boolean[]":
        return this.toArray(raw).map((value) => this.toBoolean(value));
      case "json":
        return this.toJson(raw);
      default: {
        const exhaustive = type;
        return exhaustive;
      }
    }
  }
  static encode(value, type) {
    if (value === void 0 || value === null) return null;
    switch (type) {
      case "string":
        return String(value);
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new HsmQueryParseError("", `Cannot encode non-finite number value: ${String(value)}`);
        }
        return String(value);
      case "boolean":
        if (typeof value !== "boolean") {
          throw new HsmQueryParseError("", `Cannot encode non-boolean value: ${String(value)}`);
        }
        return value ? "true" : "false";
      case "string[]":
        return this.expectArray(value).map((item) => String(item));
      case "number[]":
        return this.expectArray(value).map((item) => {
          if (typeof item !== "number" || !Number.isFinite(item)) {
            throw new HsmQueryParseError("", `Cannot encode non-finite number value: ${String(item)}`);
          }
          return String(item);
        });
      case "boolean[]":
        return this.expectArray(value).map((item) => {
          if (typeof item !== "boolean") {
            throw new HsmQueryParseError("", `Cannot encode non-boolean value: ${String(item)}`);
          }
          return item ? "true" : "false";
        });
      case "json":
        return JSON.stringify(value);
      default: {
        const exhaustive = type;
        return exhaustive;
      }
    }
  }
  static toSingleString(raw) {
    const values = this.toArray(raw);
    return String(values[0] ?? "");
  }
  static toNumber(raw) {
    const value = this.toSingleString(raw);
    if (value.trim() === "") {
      throw new HsmQueryParseError("", "Cannot decode an empty string as number.");
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new HsmQueryParseError("", `Cannot decode "${value}" as number.`);
    }
    return parsed;
  }
  static toBoolean(raw) {
    const value = this.toSingleString(raw).trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(value)) return true;
    if (["false", "0", "no", "off"].includes(value)) return false;
    throw new HsmQueryParseError("", `Cannot decode "${value}" as boolean.`);
  }
  static toJson(raw) {
    const value = this.toSingleString(raw);
    try {
      return JSON.parse(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
      throw new HsmQueryParseError("", `Cannot decode JSON query value: ${message}`);
    }
  }
  static toArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw === void 0) return [];
    return [raw];
  }
  static expectArray(value) {
    if (!Array.isArray(value)) {
      throw new HsmQueryParseError("", `Cannot encode non-array value: ${String(value)}`);
    }
    return value;
  }
};

// src/query/QueryEquality.ts
var QueryEquality = class _QueryEquality {
  constructor() {
  }
  static same(left, right) {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, index) => _QueryEquality.same(item, right[index]));
    }
    if (_QueryEquality.isPlainRecord(left) && _QueryEquality.isPlainRecord(right)) {
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      if (!_QueryEquality.same(leftKeys, rightKeys)) return false;
      return leftKeys.every((key) => _QueryEquality.same(left[key], right[key]));
    }
    return false;
  }
  static isPlainRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
};

// src/query/QueryBinding.ts
var QueryBinding = class {
  schemaKey;
  queryKey;
  source;
  type;
  expose;
  omitDefault;
  invalid;
  defaultValue;
  config;
  constructor(schemaKey, config) {
    this.schemaKey = schemaKey;
    this.config = config;
    this.queryKey = config.key ?? schemaKey;
    this.source = new ObjectPath(config.source ?? schemaKey);
    this.type = config.type ?? this.inferType(config.default);
    this.expose = config.expose ?? true;
    this.omitDefault = config.omitDefault ?? true;
    this.invalid = config.invalid ?? "default";
    this.defaultValue = config.default;
  }
  readContext(context) {
    const value = this.source.get(context);
    return value === void 0 ? this.defaultValue : value;
  }
  writeContext(context, value) {
    return this.source.set(context, value);
  }
  decode(rawQuery, context) {
    if (!Object.prototype.hasOwnProperty.call(rawQuery, this.queryKey)) {
      if (this.defaultValue === void 0) return { accepted: false };
      return { accepted: true, value: this.defaultValue };
    }
    try {
      const raw = rawQuery[this.queryKey];
      const decoded = this.config.decode ? this.config.decode({ key: this.queryKey, raw, context }) : QueryCodec.decode(raw, this.type);
      const candidate = decoded === void 0 ? this.defaultValue : decoded;
      if (!this.isValid(candidate, context)) {
        throw new HsmQueryParseError(this.queryKey, `Value failed validation: ${String(candidate)}`);
      }
      return { accepted: true, value: candidate };
    } catch (error) {
      if (this.invalid === "throw") {
        if (error instanceof HsmQueryParseError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new HsmQueryParseError(this.queryKey, message);
      }
      if (this.invalid === "ignore") return { accepted: false };
      if (this.defaultValue === void 0) return { accepted: false };
      return { accepted: true, value: this.defaultValue };
    }
  }
  project(context) {
    if (!this.expose) return null;
    const value = this.readContext(context);
    if (value === void 0 || value === null) return { key: this.queryKey, value: null };
    if (this.omitDefault && QueryEquality.same(value, this.defaultValue)) {
      return { key: this.queryKey, value: null };
    }
    const encoded = this.config.encode ? this.config.encode({ key: this.queryKey, value, context }) : QueryCodec.encode(value, this.type);
    if (encoded === void 0 || encoded === null) return { key: this.queryKey, value: null };
    return { key: this.queryKey, value: encoded };
  }
  isValid(value, context) {
    if (!this.config.validate) return true;
    return this.config.validate({ key: this.queryKey, value, context });
  }
  inferType(value) {
    if (Array.isArray(value)) {
      const first = value.find((item) => item !== void 0 && item !== null);
      if (typeof first === "number") return "number[]";
      if (typeof first === "boolean") return "boolean[]";
      return "string[]";
    }
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value !== void 0 && value !== null && typeof value === "object") return "json";
    return "string";
  }
};

// src/query/UrlStateProjector.ts
var UrlStateProjector = class {
  bindings;
  ownedKeys;
  constructor(schema) {
    this.bindings = Object.freeze(this.compile(schema));
    this.ownedKeys = new Set(this.bindings.map((binding2) => binding2.queryKey));
  }
  get enabled() {
    return this.bindings.length > 0;
  }
  hydrate(rawQuery, baseContext) {
    let context = baseContext;
    const decoded = {};
    for (const binding2 of this.bindings) {
      const result = binding2.decode(rawQuery, context);
      if (!result.accepted) continue;
      decoded[binding2.queryKey] = result.value;
      context = binding2.writeContext(context, result.value);
    }
    const projected = this.project(context);
    const unknown = this.unknown(rawQuery);
    return {
      context,
      urlState: Object.freeze({
        raw: Object.freeze({ ...rawQuery }),
        decoded: Object.freeze(decoded),
        unknown: Object.freeze(unknown),
        projected: Object.freeze(projected),
        context: Object.freeze({ ...context })
      })
    };
  }
  project(context, options = {}) {
    const output = options.preserveQuery ? { ...options.preserveQuery } : {};
    for (const key of this.ownedKeys) {
      delete output[key];
    }
    for (const binding2 of this.bindings) {
      const projected = binding2.project(context);
      if (!projected) continue;
      if (projected.value === null) {
        delete output[projected.key];
        continue;
      }
      output[projected.key] = projected.value;
    }
    return output;
  }
  unknown(rawQuery) {
    const output = {};
    for (const [key, value] of Object.entries(rawQuery)) {
      if (!this.ownedKeys.has(key)) output[key] = value;
    }
    return output;
  }
  compile(schema) {
    if (!schema) return [];
    const bindings = Object.entries(schema).map(
      ([schemaKey, binding2]) => new QueryBinding(schemaKey, binding2)
    );
    const seen = /* @__PURE__ */ new Map();
    for (const binding2 of bindings) {
      const owner = seen.get(binding2.queryKey);
      if (owner) {
        throw new HsmConfigurationError(
          `Query key "${binding2.queryKey}" is bound by both "${owner}" and "${binding2.schemaKey}".`
        );
      }
      seen.set(binding2.queryKey, binding2.schemaKey);
    }
    return bindings;
  }
};

// src/transitions/TransitionPlanner.ts
var TransitionPlanner = class {
  constructor(tree) {
    this.tree = tree;
  }
  tree;
  plan(from, to) {
    if (!from) {
      return Object.freeze({
        from,
        to,
        leaving: Object.freeze([]),
        entering: Object.freeze([...to.activePath]),
        common: Object.freeze([])
      });
    }
    const fromPath = from.activePath.map((stateId) => this.tree.get(stateId));
    const toPath = [...to.activePath];
    let commonLength = 0;
    while (commonLength < fromPath.length && commonLength < toPath.length && fromPath[commonLength]?.id === toPath[commonLength]?.id) {
      commonLength += 1;
    }
    const common = fromPath.slice(0, commonLength);
    const leaving = fromPath.slice(commonLength).reverse();
    const entering = toPath.slice(commonLength);
    return Object.freeze({
      from,
      to,
      leaving: Object.freeze(leaving),
      entering: Object.freeze(entering),
      common: Object.freeze(common)
    });
  }
};

// src/transitions/TransitionLifecycle.ts
var TransitionLifecycle = class {
  constructor(guards, actions) {
    this.guards = guards;
    this.actions = actions;
  }
  guards;
  actions;
  async runBefore(input) {
    for (const state of input.plan.leaving) {
      this.assertNotAborted(input.signal);
      await this.guards.assertAll(this.guardInput(state, input.plan.to, input.signal, input.event, input.plan.from), state.config.beforeLeave);
      if (state.config.beforeLeave) input.lifecycle.push(Object.freeze({ phase: "beforeLeave", stateId: state.id }));
    }
    for (const state of input.plan.entering) {
      this.assertNotAborted(input.signal);
      await this.guards.assertAll(this.guardInput(state, input.plan.to, input.signal, input.event, input.plan.from), state.config.beforeEnter);
      if (state.config.beforeEnter) input.lifecycle.push(Object.freeze({ phase: "beforeEnter", stateId: state.id }));
    }
  }
  async runLeave(input) {
    for (const state of input.plan.leaving) {
      this.assertNotAborted(input.signal);
      const actionInput = this.actionInput(state, input.plan.to, input.signal, input.event, input.plan.from, input.data);
      await this.actions.runAll(actionInput, state.config.onLeave);
      await this.actions.runAll(actionInput, state.config.exit);
      if (state.config.onLeave || state.config.exit) {
        input.lifecycle.push(Object.freeze({ phase: "onLeave", stateId: state.id }));
      }
    }
  }
  async runEnter(input) {
    for (const state of input.plan.entering) {
      this.assertNotAborted(input.signal);
      const actionInput = this.actionInput(state, input.plan.to, input.signal, input.event, input.plan.from, input.data);
      await this.actions.runAll(actionInput, state.config.entry);
      await this.actions.runAll(actionInput, state.config.onEnter);
      if (state.config.entry || state.config.onEnter) {
        input.lifecycle.push(Object.freeze({ phase: "onEnter", stateId: state.id }));
      }
    }
  }
  async runAfterEnter(input) {
    for (const state of input.plan.entering) {
      this.assertNotAborted(input.signal);
      const actionInput = this.actionInput(state, input.plan.to, input.signal, input.event, input.plan.from, input.data);
      await this.actions.runAll(actionInput, state.config.afterEnter);
      if (state.config.afterEnter) {
        input.lifecycle.push(Object.freeze({ phase: "afterEnter", stateId: state.id }));
      }
    }
  }
  guardInput(state, to, signal, event, from) {
    return {
      context: to.context,
      state,
      stateId: state.id,
      params: to.params,
      meta: state.meta,
      signal,
      ...event ? { event } : {},
      ...from ? { fromStateId: from.stateId } : {},
      toStateId: to.node.id
    };
  }
  actionInput(state, to, signal, event, from, data) {
    return {
      context: to.context,
      state,
      stateId: state.id,
      params: to.params,
      meta: state.meta,
      signal,
      ...event ? { event } : {},
      ...from ? { fromStateId: from.stateId } : {},
      toStateId: to.node.id,
      ...data ? { data } : {}
    };
  }
  assertNotAborted(signal) {
    if (signal.aborted) {
      throw new DOMException("Transition aborted.", "AbortError");
    }
  }
};

// src/transitions/TransitionAbortController.ts
var TransitionAbortController = class {
  active = null;
  next(externalSignal) {
    this.cancel("Superseded by a newer HSM transition.");
    const controller = new AbortController();
    this.active = controller;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
      }
    }
    return controller;
  }
  clear(controller) {
    if (this.active === controller) this.active = null;
  }
  cancel(reason) {
    if (!this.active || this.active.signal.aborted) return;
    this.active.abort(reason);
  }
};

// src/transitions/TransitionResultFactory.ts
var TransitionResultFactory = class {
  success(args) {
    const result = {
      ok: true,
      cause: args.cause,
      from: args.from,
      to: args.snapshot,
      snapshot: args.snapshot,
      data: Object.freeze({ ...args.data }),
      lifecycle: Object.freeze([...args.lifecycle]),
      ...args.redirect ? { redirect: args.redirect } : {}
    };
    return Object.freeze(result);
  }
  failure(args) {
    const reason = args.reason ?? this.reasonFor(args.error);
    return Object.freeze({
      ok: false,
      cause: args.cause,
      reason,
      from: args.from,
      ...args.targetStateId ? { targetStateId: args.targetStateId } : {},
      error: args.error,
      aborted: reason === "aborted"
    });
  }
  reasonFor(error) {
    if (this.isAbortError(error)) return "aborted";
    if (error instanceof HsmGuardRejectedError) return "guard_failed";
    if (error instanceof HsmRouteNotFoundError) return "route_not_found";
    if (error instanceof HsmUnresolvedStateError) return "unresolved_state";
    return "error";
  }
  isAbortError(error) {
    return error instanceof DOMException && error.name === "AbortError";
  }
};

// src/transitions/TransitionManager.ts
var TransitionManager = class {
  constructor(planner, lifecycle, loaders, snapshots, results) {
    this.planner = planner;
    this.lifecycle = lifecycle;
    this.loaders = loaders;
    this.snapshots = snapshots;
    this.results = results;
  }
  planner;
  lifecycle;
  loaders;
  snapshots;
  results;
  async run(input) {
    const lifecycle = [];
    let stage = "guards";
    try {
      this.assertNotAborted(input.signal);
      const plan = this.planner.plan(input.from, input.resolved);
      if (!input.skipLifecycle) {
        await this.lifecycle.runBefore({
          plan,
          signal: input.signal,
          ...input.event ? { event: input.event } : {},
          lifecycle
        });
      }
      stage = "loaders";
      const data = await this.loaders.run({
        from: input.from,
        to: input.resolved,
        entering: plan.entering,
        signal: input.signal,
        ...input.event ? { event: input.event } : {},
        lifecycle
      });
      const resolvedWithData = Object.freeze({
        ...input.resolved,
        data
      });
      if (!input.skipLifecycle) {
        stage = "leave";
        await this.lifecycle.runLeave({
          plan,
          signal: input.signal,
          ...input.event ? { event: input.event } : {},
          data,
          lifecycle
        });
      }
      stage = "commit";
      const snapshot = this.snapshots.create(resolvedWithData, input.redirect);
      input.commit(snapshot);
      if (!input.skipLifecycle) {
        stage = "enter";
        await this.lifecycle.runEnter({
          plan,
          signal: input.signal,
          ...input.event ? { event: input.event } : {},
          data,
          lifecycle
        });
        stage = "afterEnter";
        await this.lifecycle.runAfterEnter({
          plan,
          signal: input.signal,
          ...input.event ? { event: input.event } : {},
          data,
          lifecycle
        });
      }
      return this.results.success({
        cause: input.cause,
        from: input.from,
        snapshot,
        data,
        lifecycle,
        ...input.redirect ? { redirect: input.redirect } : {}
      });
    } catch (error) {
      const reason = this.reasonForStage(stage, error);
      return this.results.failure({
        cause: input.cause,
        from: input.from,
        targetStateId: input.resolved.node.id,
        error,
        ...reason ? { reason } : {}
      });
    }
  }
  assertNotAborted(signal) {
    if (signal.aborted) {
      throw new DOMException("Transition aborted.", "AbortError");
    }
  }
  reasonForStage(stage, error) {
    if (error instanceof DOMException && error.name === "AbortError") return "aborted";
    if (stage === "loaders") return "loader_failed";
    if (stage === "leave" || stage === "enter" || stage === "afterEnter") return "action_failed";
    return void 0;
  }
};

// src/policy/PolicyInheritance.ts
var POLICY_FIELDS = {
  permission: { allow: "permissions", deny: "denyPermissions" },
  capability: { allow: "capabilities", deny: "denyCapabilities" },
  feature: { allow: "features", deny: "denyFeatures" }
};
var PolicyInheritance = class {
  collect(activePath) {
    const permissions = this.collectKind(activePath, "permission");
    const capabilities = this.collectKind(activePath, "capability");
    const features = this.collectKind(activePath, "feature");
    const layout = this.resolveLayout(activePath);
    return Object.freeze({
      permissions,
      capabilities,
      features,
      ...layout ? { layout } : {}
    });
  }
  collectKind(activePath, kind) {
    const fields = POLICY_FIELDS[kind];
    const allowed = /* @__PURE__ */ new Map();
    const denied = /* @__PURE__ */ new Map();
    for (const state of activePath) {
      for (const key of state.config[fields.allow] ?? []) this.push(allowed, key, state.id);
      for (const key of state.config[fields.deny] ?? []) this.push(denied, key, state.id);
    }
    return Object.freeze({
      allowed: this.freezeMap(allowed),
      denied: this.freezeMap(denied)
    });
  }
  resolveLayout(activePath) {
    let layout;
    for (const state of activePath) {
      const explicit = state.config.layout ?? state.config.meta?.layout;
      if (typeof explicit === "string" && explicit.length > 0) layout = explicit;
    }
    return layout;
  }
  push(map, key, stateId) {
    const current = map.get(key) ?? [];
    current.push(stateId);
    map.set(key, current);
  }
  freezeMap(map) {
    const output = /* @__PURE__ */ new Map();
    for (const [key, value] of map.entries()) output.set(key, Object.freeze([...value]));
    return output;
  }
};

// src/policy/PolicyEvaluator.ts
var PolicyEvaluator = class {
  constructor(guards) {
    this.guards = guards;
  }
  guards;
  async evaluate(input) {
    if (input.deniedBy.length > 0) {
      return this.decision(input, false, "state_denied");
    }
    if (input.inheritedFrom.length === 0) {
      return this.decision(input, false, "not_declared");
    }
    const rule = this.normalizeRule(input.rule);
    if (rule === false) return this.decision(input, false, "rule_denied");
    if (rule === true || !rule?.guard) return this.decision(input, true, "allowed");
    try {
      await this.guards.assertAll(this.guardInput(input), rule.guard);
      return this.decision(input, true, "allowed", this.firstGuardName(rule.guard));
    } catch (error) {
      if (error instanceof HsmMissingGuardError) {
        return this.decision(input, false, "guard_missing", this.firstGuardName(rule.guard), error);
      }
      if (error instanceof HsmGuardRejectedError) {
        return this.decision(input, false, "guard_failed", error.guardName, error);
      }
      return this.decision(input, false, "error", this.firstGuardName(rule.guard), error);
    }
  }
  guardInput(input) {
    return {
      context: input.context,
      state: input.state,
      stateId: input.state.id,
      params: input.params,
      meta: input.state.meta,
      toStateId: input.state.id,
      event: { type: `policy.${input.kind}.${input.key}` }
    };
  }
  normalizeRule(rule) {
    if (rule === void 0) return void 0;
    if (typeof rule === "boolean") return rule;
    if (typeof rule === "string" || typeof rule === "function" || Array.isArray(rule)) {
      return { guard: rule };
    }
    return rule;
  }
  firstGuardName(ref) {
    if (!ref) return void 0;
    const first = Array.isArray(ref) ? ref[0] : ref;
    return typeof first === "string" ? first : "inline:0";
  }
  decision(input, allowed, reason, guard, error) {
    return Object.freeze({
      key: input.key,
      kind: input.kind,
      allowed,
      reason,
      inheritedFrom: Object.freeze([...input.inheritedFrom]),
      deniedBy: Object.freeze([...input.deniedBy]),
      stateId: input.state.id,
      ...guard ? { guard } : {},
      ...error ? { error } : {}
    });
  }
};

// src/policy/PolicyEngine.ts
var KIND_TO_PLURAL = {
  permission: "permissions",
  capability: "capabilities",
  feature: "features"
};
var KIND_TO_DENIED_PLURAL = {
  permission: "deniedPermissions",
  capability: "deniedCapabilities",
  feature: "deniedFeatures"
};
var PolicyEngine = class {
  constructor(tree, guards, definitions = {}) {
    this.tree = tree;
    this.definitions = definitions;
    this.evaluator = new PolicyEvaluator(guards);
  }
  tree;
  definitions;
  inheritance = new PolicyInheritance();
  evaluator;
  async enrich(resolved) {
    const policy = await this.resolve(resolved);
    return Object.freeze({ ...resolved, policy });
  }
  async resolve(resolved) {
    const inherited = this.inheritance.collect(resolved.activePath);
    const permissions = await this.resolveKind("permission", inherited.permissions, resolved);
    const capabilities = await this.resolveKind("capability", inherited.capabilities, resolved);
    const features = await this.resolveKind("feature", inherited.features, resolved);
    const snapshot = {
      permissions: Object.freeze(this.allowedKeys(permissions)),
      capabilities: Object.freeze(this.allowedKeys(capabilities)),
      features: Object.freeze(this.allowedKeys(features)),
      deniedPermissions: Object.freeze(this.deniedKeys(permissions)),
      deniedCapabilities: Object.freeze(this.deniedKeys(capabilities)),
      deniedFeatures: Object.freeze(this.deniedKeys(features)),
      decisions: Object.freeze({
        permissions: Object.freeze(permissions),
        capabilities: Object.freeze(capabilities),
        features: Object.freeze(features)
      }),
      ...inherited.layout ? { layout: inherited.layout } : {}
    };
    return Object.freeze(snapshot);
  }
  async explain(kind, key, target) {
    if (this.isSnapshot(target)) {
      const plural = KIND_TO_PLURAL[kind];
      const cached = target.policy?.decisions[plural][key];
      if (cached) return cached;
      const activePath = target.activePath.map((stateId) => this.tree.get(stateId));
      return this.evaluateOne(kind, key, activePath, target.context, target.params);
    }
    return this.evaluateOne(kind, key, target.activePath, target.context, target.params);
  }
  isAllowed(snapshot, kind, key) {
    if (!snapshot?.policy) return false;
    const plural = KIND_TO_PLURAL[kind];
    return snapshot.policy.decisions[plural][key]?.allowed ?? false;
  }
  list(snapshot, kind) {
    if (!snapshot?.policy) return Object.freeze([]);
    return snapshot.policy[KIND_TO_PLURAL[kind]];
  }
  denied(snapshot, kind) {
    if (!snapshot?.policy) return Object.freeze([]);
    return snapshot.policy[KIND_TO_DENIED_PLURAL[kind]];
  }
  layout(snapshot) {
    return snapshot?.policy?.layout;
  }
  async resolveKind(kind, inherited, resolved) {
    const keys = /* @__PURE__ */ new Set([
      ...inherited.allowed.keys(),
      ...inherited.denied.keys()
    ]);
    const output = {};
    for (const key of [...keys].sort()) {
      output[key] = await this.evaluateOne(kind, key, resolved.activePath, resolved.context, resolved.params, inherited);
    }
    return output;
  }
  async evaluateOne(kind, key, activePath, context, params, inherited) {
    const set = inherited ?? this.inheritance.collect(activePath)[KIND_TO_PLURAL[kind]];
    const state = activePath[activePath.length - 1];
    if (!state) throw new Error("Policy evaluation requires an active state path.");
    const rule = this.ruleFor(kind, key);
    return this.evaluator.evaluate({
      key,
      kind,
      state,
      activePath,
      context,
      params,
      ...rule !== void 0 ? { rule } : {},
      inheritedFrom: set.allowed.get(key) ?? Object.freeze([]),
      deniedBy: set.denied.get(key) ?? Object.freeze([])
    });
  }
  ruleFor(kind, key) {
    if (kind === "permission") return this.definitions.permissions?.[key];
    if (kind === "capability") return this.definitions.capabilities?.[key];
    return this.definitions.features?.[key];
  }
  allowedKeys(bucket) {
    return Object.keys(bucket).filter((key) => bucket[key]?.allowed).sort();
  }
  deniedKeys(bucket) {
    return Object.keys(bucket).filter((key) => !bucket[key]?.allowed).sort();
  }
  isSnapshot(value) {
    return "machineId" in value;
  }
};

// src/core/HsmMachine.ts
var HsmMachine = class {
  id;
  tree;
  guards;
  actions;
  loaders;
  routeTable;
  urlState;
  policy;
  resolver;
  snapshots;
  initialStateKey;
  contextSource;
  transitionAbort = new TransitionAbortController();
  transitions;
  events;
  results = new TransitionResultFactory();
  currentSnapshot = null;
  constructor(config) {
    this.id = config.id;
    this.initialStateKey = config.initial;
    this.contextSource = config.context;
    this.tree = new StateTree(config);
    this.guards = new GuardRegistry(config.guards);
    this.actions = new ActionRegistry(config.actions);
    this.loaders = new LoaderRegistry(config.loaders);
    this.resolver = new StateResolver(this.tree, this.guards);
    this.snapshots = new SnapshotFactory(this.id);
    this.routeTable = new RouteTable(this.tree);
    this.urlState = new UrlStateProjector(config.query);
    this.policy = new PolicyEngine(this.tree, this.guards, config.policies);
    const planner = new TransitionPlanner(this.tree);
    const lifecycle = new TransitionLifecycle(this.guards, this.actions);
    const loaderRunner = new LoaderRunner(this.loaders);
    this.transitions = new TransitionManager(planner, lifecycle, loaderRunner, this.snapshots, this.results);
    this.events = new EventDispatcher(this.tree, this.guards);
  }
  get current() {
    return this.currentSnapshot;
  }
  async start(options = {}) {
    const context = await this.getContext(options.context);
    const resolveOptions = {};
    if (options.params) resolveOptions.params = options.params;
    if (options.expandInitial !== void 0) resolveOptions.expandInitial = options.expandInitial;
    const resolved = await this.resolver.resolveInitial(this.initialStateKey, context, resolveOptions);
    const snapshot = await this.createSnapshot(this.attachProjectedUrlState(resolved, {}, context));
    this.currentSnapshot = snapshot;
    return snapshot;
  }
  async resolve(stateId, options = {}) {
    const context = await this.getContext(options.context);
    const resolved = await this.resolver.resolve(stateId, context, options);
    return this.createSnapshot(this.attachProjectedUrlState(resolved, {}, context));
  }
  async transition(stateId, options = {}) {
    const cause = options.cause ?? "state";
    const controller = this.transitionAbort.next(options.signal);
    try {
      const context = deepMerge(await this.getRuntimeContext(options.context), options.contextPatch);
      const resolveOptions = { context };
      if (options.params !== void 0) Object.assign(resolveOptions, { params: options.params });
      if (options.expandInitial !== void 0) Object.assign(resolveOptions, { expandInitial: options.expandInitial });
      const resolved = await this.resolver.resolve(stateId, context, resolveOptions);
      const result = await this.transitions.run({
        from: this.currentSnapshot,
        resolved: await this.withPolicy(this.attachProjectedUrlState(resolved, {}, context)),
        signal: controller.signal,
        cause,
        ...options.event ? { event: options.event } : {},
        ...options.skipLifecycle !== void 0 ? { skipLifecycle: options.skipLifecycle } : {},
        commit: (snapshot) => {
          this.currentSnapshot = snapshot;
        }
      });
      return this.finishTransitionResult(result, options.strict);
    } catch (error) {
      return this.finishTransitionResult(
        this.results.failure({ cause, from: this.currentSnapshot, targetStateId: stateId, error }),
        options.strict
      );
    } finally {
      this.transitionAbort.clear(controller);
    }
  }
  async resolveUrl(input, options = {}) {
    const followRedirects = options.followRedirects ?? true;
    const maxRedirects = options.maxRedirects ?? 10;
    const baseContext = await this.getContext(options.context);
    let current = input;
    let redirects = 0;
    while (true) {
      const attempt = await this.resolveAcceptedRoute(current, baseContext, options);
      if (attempt.redirect) {
        if (!followRedirects) {
          return this.createSnapshot(
            this.attachUrlState(attempt.resolved, attempt.hydration.urlState),
            attempt.redirect
          );
        }
        redirects += 1;
        if (redirects > maxRedirects) {
          throw new HsmRedirectLoopError(input, maxRedirects);
        }
        current = attempt.redirect.to;
        continue;
      }
      return this.createSnapshot(this.attachUrlState(attempt.resolved, attempt.hydration.urlState));
    }
  }
  async transitionUrl(input, options = {}) {
    const cause = options.cause ?? "url";
    const controller = this.transitionAbort.next(options.signal);
    try {
      const followRedirects = options.followRedirects ?? true;
      const maxRedirects = options.maxRedirects ?? 10;
      const baseContext = deepMerge(await this.getRuntimeContext(options.context), options.contextPatch);
      let current = input;
      let redirects = 0;
      while (true) {
        const attempt = await this.resolveAcceptedRoute(current, baseContext, options);
        if (attempt.redirect && followRedirects) {
          redirects += 1;
          if (redirects > maxRedirects) throw new HsmRedirectLoopError(input, maxRedirects);
          current = attempt.redirect.to;
          continue;
        }
        const result = await this.transitions.run({
          from: this.currentSnapshot,
          resolved: await this.withPolicy(this.attachUrlState(attempt.resolved, attempt.hydration.urlState)),
          signal: controller.signal,
          cause,
          ...options.event ? { event: options.event } : {},
          ...options.skipLifecycle !== void 0 ? { skipLifecycle: options.skipLifecycle } : {},
          ...attempt.redirect ? { redirect: attempt.redirect } : {},
          commit: (snapshot) => {
            this.currentSnapshot = snapshot;
          }
        });
        return this.finishTransitionResult(result, options.strict);
      }
    } catch (error) {
      return this.finishTransitionResult(
        this.results.failure({ cause, from: this.currentSnapshot, error }),
        options.strict
      );
    } finally {
      this.transitionAbort.clear(controller);
    }
  }
  async navigate(input, options = {}) {
    const result = await this.transitionUrl(input, { ...options, strict: true, cause: options.cause ?? "url" });
    if (!result.ok) throw result.error;
    return result.snapshot;
  }
  async send(eventOrType, payloadOrOptions, maybeOptions = {}) {
    const { event, options } = this.normalizeSendArgs(eventOrType, payloadOrOptions, maybeOptions);
    const cause = options.cause ?? "event";
    try {
      if (!this.currentSnapshot) {
        const startOptions = {};
        if (options.context !== void 0) Object.assign(startOptions, { context: options.context });
        if (options.expandInitial !== void 0) Object.assign(startOptions, { expandInitial: options.expandInitial });
        await this.start(startOptions);
      }
      const from = this.currentSnapshot;
      if (!from) throw new Error("HSM failed to initialize before event dispatch.");
      const context = deepMerge(await this.getRuntimeContext(options.context), options.contextPatch);
      const resolvedEvent = await this.events.resolve(from, event, context);
      if (!resolvedEvent) {
        return this.finishTransitionResult(
          this.results.failure({
            cause,
            from,
            error: new Error(`Event "${event.type}" is not handled by active state "${from.stateId}".`),
            reason: "event_not_handled"
          }),
          options.strict
        );
      }
      if (resolvedEvent.actions) {
        const origin = this.tree.get(resolvedEvent.originStateId);
        await this.actions.runAll(
          {
            context,
            state: origin,
            stateId: origin.id,
            params: resolvedEvent.params,
            meta: origin.meta,
            event,
            fromStateId: from.stateId,
            toStateId: resolvedEvent.target
          },
          resolvedEvent.actions
        );
      }
      const transitionOptions = {
        ...options,
        cause,
        event,
        params: resolvedEvent.params,
        context
      };
      if (resolvedEvent.contextPatch !== void 0) {
        Object.assign(transitionOptions, { contextPatch: resolvedEvent.contextPatch });
      }
      return this.transition(resolvedEvent.target, transitionOptions);
    } catch (error) {
      return this.finishTransitionResult(
        this.results.failure({ cause, from: this.currentSnapshot, error }),
        options.strict
      );
    }
  }
  cancelTransition(reason) {
    this.transitionAbort.cancel(reason);
  }
  async can(key, options = {}) {
    if (this.tree.has(key)) return this.canState(key, options);
    const snapshot = await this.policySnapshot(options);
    return this.policy.isAllowed(snapshot, "permission", key);
  }
  async canState(stateId, options = {}) {
    try {
      await this.resolve(stateId, options);
      return true;
    } catch {
      return false;
    }
  }
  async cannot(permission, options = {}) {
    return !await this.can(permission, options);
  }
  async canUse(capability, options = {}) {
    const snapshot = await this.policySnapshot(options);
    return this.policy.isAllowed(snapshot, "capability", capability);
  }
  async feature(feature, options = {}) {
    const snapshot = await this.policySnapshot(options);
    return this.policy.isAllowed(snapshot, "feature", feature);
  }
  async isFeatureEnabled(feature, options = {}) {
    return this.feature(feature, options);
  }
  permissions() {
    return this.policy.list(this.currentSnapshot, "permission");
  }
  capabilities() {
    return this.policy.list(this.currentSnapshot, "capability");
  }
  features() {
    return this.policy.list(this.currentSnapshot, "feature");
  }
  deniedPermissions() {
    return this.policy.denied(this.currentSnapshot, "permission");
  }
  deniedCapabilities() {
    return this.policy.denied(this.currentSnapshot, "capability");
  }
  deniedFeatures() {
    return this.policy.denied(this.currentSnapshot, "feature");
  }
  layout() {
    return this.policy.layout(this.currentSnapshot);
  }
  async explainPermission(permission, options = {}) {
    return this.policy.explain("permission", permission, await this.policySnapshot(options));
  }
  async explainCapability(capability, options = {}) {
    return this.policy.explain("capability", capability, await this.policySnapshot(options));
  }
  async explainFeature(feature, options = {}) {
    return this.policy.explain("feature", feature, await this.policySnapshot(options));
  }
  has(stateId) {
    return this.tree.has(stateId);
  }
  states() {
    return this.tree.all.map((node) => node.id);
  }
  routes() {
    return this.routeTable.entries;
  }
  matchUrl(input, baseUrl) {
    return this.routeTable.match(input, baseUrl);
  }
  matchUrls(input, baseUrl) {
    return this.routeTable.matchAll(input, baseUrl);
  }
  href(stateId, params = {}, options = {}) {
    const query2 = this.buildHrefQuery(options);
    const hrefOptions = {};
    if (query2 !== void 0) Object.assign(hrefOptions, { query: query2 });
    if (options.hash !== void 0) Object.assign(hrefOptions, { hash: options.hash });
    return this.routeTable.href(stateId, params, hrefOptions);
  }
  projectQuery(context, preserveQuery) {
    return preserveQuery ? this.urlState.project(context, { preserveQuery }) : this.urlState.project(context);
  }
  async hydrateQuery(rawQuery, context) {
    const baseContext = await this.getContext(context);
    return this.urlState.hydrate(rawQuery, baseContext);
  }
  syncUrl(input, context, options = {}) {
    const parsed = UrlTools.parse(input, options.baseUrl);
    const preserveQuery = options.preserveUnknownQuery ? this.urlState.unknown(parsed.query) : void 0;
    const projected = preserveQuery ? this.urlState.project(options.context ?? context, { preserveQuery }) : this.urlState.project(options.context ?? context);
    const query2 = this.applyQueryOverride(projected, options.query);
    const hash = options.hash ?? parsed.hash;
    const pathname = options.canonicalizePath ? this.canonicalPathnameFor(input, options.baseUrl) : parsed.pathname;
    return PathComposer.appendSearchAndHash(pathname, query2, hash);
  }
  async createSnapshot(resolved, redirect) {
    return this.snapshots.create(await this.withPolicy(resolved), redirect);
  }
  async withPolicy(resolved) {
    return this.policy.enrich(resolved);
  }
  async policySnapshot(options) {
    if (this.currentSnapshot && !options.context && !options.params && options.expandInitial === void 0) {
      return this.currentSnapshot;
    }
    return this.start(options);
  }
  async resolveAcceptedRoute(input, baseContext, options) {
    const matches = this.routeTable.matchAll(input, options.baseUrl);
    if (matches.length === 0) {
      const parsed2 = UrlTools.parse(input, options.baseUrl);
      throw new HsmRouteNotFoundError(parsed2.pathname);
    }
    let lastRecoverableError;
    for (const match of matches) {
      try {
        const hydration = this.hydrateMatchedQuery(match.query, baseContext, options);
        const resolved = await this.resolveMatchedState(match, hydration.context, options);
        const routeRedirect = await this.resolveRedirect(match, hydration.context);
        const redirect = this.resolveCanonicalRedirect(match, options) ?? routeRedirect;
        return { match, hydration, resolved, redirect };
      } catch (error) {
        if (!this.isRouteSelectionRecoverable(error)) throw error;
        lastRecoverableError = error;
      }
    }
    if (lastRecoverableError) throw lastRecoverableError;
    const parsed = UrlTools.parse(input, options.baseUrl);
    throw new HsmRouteNotFoundError(parsed.pathname);
  }
  async resolveMatchedState(match, context, options) {
    const resolveOptions = { context, params: match.params };
    if (options.expandInitial !== void 0) {
      Object.assign(resolveOptions, { expandInitial: options.expandInitial });
    }
    return this.resolver.resolve(match.stateId, context, resolveOptions, match);
  }
  hydrateMatchedQuery(rawQuery, context, options) {
    if (options.hydrateQuery === false) {
      const preserveQuery = options.preserveUnknownQuery ? rawQuery : void 0;
      const projected2 = preserveQuery ? this.urlState.project(context, { preserveQuery }) : this.urlState.project(context);
      return {
        context,
        urlState: Object.freeze({
          raw: Object.freeze({ ...rawQuery }),
          decoded: Object.freeze({}),
          unknown: Object.freeze(this.urlState.unknown(rawQuery)),
          projected: Object.freeze(projected2),
          context: Object.freeze({ ...context })
        })
      };
    }
    const hydration = this.urlState.hydrate(rawQuery, context);
    if (!options.preserveUnknownQuery) return hydration;
    const projected = this.urlState.project(hydration.context, {
      preserveQuery: hydration.urlState.unknown
    });
    return {
      context: hydration.context,
      urlState: Object.freeze({
        raw: hydration.urlState.raw,
        decoded: hydration.urlState.decoded,
        unknown: hydration.urlState.unknown,
        projected: Object.freeze(projected),
        context: hydration.urlState.context
      })
    };
  }
  buildHrefQuery(options) {
    const includeQueryState = options.includeQueryState ?? Boolean(options.context);
    const projected = includeQueryState && options.context ? options.preserveQuery ? this.urlState.project(options.context, { preserveQuery: options.preserveQuery }) : this.urlState.project(options.context) : options.preserveQuery ? { ...options.preserveQuery } : void 0;
    return this.applyQueryOverride(projected, options.query);
  }
  applyQueryOverride(base, override) {
    if (!base && !override) return void 0;
    const output = base ? { ...base } : {};
    if (!override) return output;
    for (const [key, value] of Object.entries(override)) {
      if (value === void 0 || value === null) {
        delete output[key];
      } else {
        output[key] = value;
      }
    }
    return output;
  }
  attachProjectedUrlState(resolved, rawQuery, context) {
    if (!this.urlState.enabled) return resolved;
    const projected = this.urlState.project(context);
    const urlState = Object.freeze({
      raw: Object.freeze({ ...rawQuery }),
      decoded: Object.freeze({}),
      unknown: Object.freeze({}),
      projected: Object.freeze(projected),
      context: Object.freeze({ ...context })
    });
    return this.attachUrlState(resolved, urlState);
  }
  attachUrlState(resolved, urlState) {
    if (!this.urlState.enabled) return resolved;
    return { ...resolved, urlState };
  }
  resolveCanonicalRedirect(match, options) {
    const shouldCanonicalize = options.canonicalizeAliases === true || match.entry.redirectToCanonical;
    if (!shouldCanonicalize || match.isCanonical) return null;
    return Object.freeze({
      to: PathComposer.appendSearchAndHash(match.canonicalPathname, match.query, match.hash),
      from: match.pathname,
      stateId: match.stateId
    });
  }
  canonicalPathnameFor(input, baseUrl) {
    try {
      return this.routeTable.match(input, baseUrl).canonicalPathname;
    } catch {
      return UrlTools.parse(input, baseUrl).pathname;
    }
  }
  isRouteSelectionRecoverable(error) {
    return error instanceof HsmGuardRejectedError || error instanceof HsmUnresolvedStateError;
  }
  async resolveRedirect(match, context) {
    const redirect = match.state.config.redirect;
    if (!redirect) return null;
    const rawTarget = typeof redirect === "function" ? await redirect({
      context,
      state: match.state,
      stateId: match.stateId,
      params: match.params,
      pathname: match.pathname,
      query: match.query,
      hash: match.hash
    }) : redirect;
    const target = this.normalizeRedirectTarget(rawTarget, match.params);
    return Object.freeze({
      to: target,
      from: match.pathname,
      stateId: match.stateId
    });
  }
  normalizeRedirectTarget(target, params) {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target)) {
      throw new HsmRouteBuildError(`External redirects are not allowed by panom-hsm: ${target}`);
    }
    if (this.tree.has(target)) {
      return this.href(target, params);
    }
    return UrlTools.normalizePathname(target);
  }
  normalizeSendArgs(eventOrType, payloadOrOptions, maybeOptions) {
    if (typeof eventOrType === "string") {
      const looksLikeOptions = this.isTransitionOptions(payloadOrOptions);
      return {
        event: looksLikeOptions ? { type: eventOrType } : { type: eventOrType, payload: payloadOrOptions },
        options: looksLikeOptions ? payloadOrOptions : maybeOptions
      };
    }
    return { event: eventOrType, options: this.isTransitionOptions(payloadOrOptions) ? payloadOrOptions : maybeOptions };
  }
  isTransitionOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = new Set(Object.keys(value));
    return ["context", "contextPatch", "params", "expandInitial", "signal", "strict", "skipLifecycle", "cause"].some((key) => keys.has(key));
  }
  async getRuntimeContext(override) {
    if (override) return override;
    if (this.currentSnapshot) return this.currentSnapshot.context;
    return this.getContext(void 0);
  }
  async getContext(override) {
    if (override) return override;
    if (typeof this.contextSource === "function") {
      return this.contextSource();
    }
    return this.contextSource ?? {};
  }
  finishTransitionResult(result, strict) {
    if (!result.ok && strict) throw result.error;
    return result;
  }
};

// src/core/createHsm.ts
function createHsm(config) {
  return new HsmMachine(config);
}

// src/query/query.ts
function binding(type, defaultValue, options = {}) {
  return {
    ...options,
    type,
    default: defaultValue
  };
}
var query = Object.freeze({
  string(defaultValue = "", options = {}) {
    return binding("string", defaultValue, options);
  },
  number(defaultValue = 0, options = {}) {
    return binding("number", defaultValue, options);
  },
  boolean(defaultValue = false, options = {}) {
    return binding("boolean", defaultValue, options);
  },
  stringArray(defaultValue = [], options = {}) {
    return binding("string[]", [...defaultValue], options);
  },
  numberArray(defaultValue = [], options = {}) {
    return binding("number[]", [...defaultValue], options);
  },
  booleanArray(defaultValue = [], options = {}) {
    return binding("boolean[]", [...defaultValue], options);
  },
  json(defaultValue, options = {}) {
    return binding("json", defaultValue, options);
  }
});

// src/policy/PermissionResolver.ts
var PermissionResolver = class {
  constructor(engine) {
    this.engine = engine;
  }
  engine;
  can(snapshot, permission) {
    return this.engine.isAllowed(snapshot, "permission", permission);
  }
  list(snapshot) {
    return this.engine.list(snapshot, "permission");
  }
  denied(snapshot) {
    return this.engine.denied(snapshot, "permission");
  }
  async explain(snapshot, permission) {
    return this.engine.explain("permission", permission, snapshot);
  }
};

// src/policy/CapabilityResolver.ts
var CapabilityResolver = class {
  constructor(engine) {
    this.engine = engine;
  }
  engine;
  canUse(snapshot, capability) {
    return this.engine.isAllowed(snapshot, "capability", capability);
  }
  list(snapshot) {
    return this.engine.list(snapshot, "capability");
  }
  denied(snapshot) {
    return this.engine.denied(snapshot, "capability");
  }
  async explain(snapshot, capability) {
    return this.engine.explain("capability", capability, snapshot);
  }
};

// src/policy/FeatureResolver.ts
var FeatureResolver = class {
  constructor(engine) {
    this.engine = engine;
  }
  engine;
  enabled(snapshot, feature) {
    return this.engine.isAllowed(snapshot, "feature", feature);
  }
  list(snapshot) {
    return this.engine.list(snapshot, "feature");
  }
  denied(snapshot) {
    return this.engine.denied(snapshot, "feature");
  }
  async explain(snapshot, feature) {
    return this.engine.explain("feature", feature, snapshot);
  }
};

// src/policy/LayoutResolver.ts
var LayoutResolver = class {
  resolve(activePath) {
    let layout;
    for (const state of activePath) {
      const explicit = state.config.layout ?? state.config.meta?.layout;
      if (typeof explicit === "string" && explicit.length > 0) layout = explicit;
    }
    return layout;
  }
};

// src/backend/BackendPolicyEnforcer.ts
var BackendPolicyEnforcer = class {
  checkAll(snapshot, requirements) {
    const permission = this.check(snapshot, "permission", requirements.permissions);
    if (permission) return permission;
    const capability = this.check(snapshot, "capability", requirements.capabilities);
    if (capability) return capability;
    return this.check(snapshot, "feature", requirements.features);
  }
  check(snapshot, kind, required) {
    if (!required) return null;
    const keys = Array.isArray(required) ? required : [required];
    for (const key of keys) {
      const allowed = kind === "permission" ? snapshot.can(key) : kind === "capability" ? snapshot.canUse(key) : snapshot.feature(key);
      if (!allowed) return this.failure(kind, key, snapshot.stateId);
    }
    return null;
  }
  failure(kind, key, stateId) {
    const reason = kind === "permission" ? "permission_denied" : kind === "capability" ? "capability_unavailable" : "feature_disabled";
    return Object.freeze({
      reason,
      status: 403,
      kind,
      key,
      message: `${kind} "${key}" is not allowed for resolved state "${stateId}".`
    });
  }
};

// src/schema/SchemaErrors.ts
var HsmSchemaError = class extends HsmError {
  constructor(code, message) {
    super(code, message);
  }
};
var HsmSchemaFunctionError = class extends HsmSchemaError {
  constructor(path) {
    super(
      "HSM_SCHEMA_FUNCTION_NOT_SERIALIZABLE",
      `HSM schema cannot serialize functions. Replace function at "${path}" with a named registry reference.`
    );
  }
};
var HsmSchemaValidationError = class extends HsmSchemaError {
  constructor(message) {
    super("HSM_SCHEMA_VALIDATION_ERROR", message);
  }
};
var HsmSchemaParseError = class extends HsmSchemaError {
  constructor(message) {
    super("HSM_SCHEMA_PARSE_ERROR", message);
  }
};

// src/schema/SchemaUtils.ts
function optional(target, key, value) {
  if (value !== void 0) {
    Object.assign(target, { [key]: value });
  }
}
function toJsonValue(value, path) {
  if (value === void 0) return void 0;
  if (typeof value === "function") throw new HsmSchemaFunctionError(path);
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new HsmSchemaValidationError(`Non-finite number cannot be serialized at "${path}".`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const json = toJsonValue(item, `${path}[${index}]`);
      return json === void 0 ? null : json;
    });
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      const json = toJsonValue(child, path ? `${path}.${key}` : key);
      if (json !== void 0) output[key] = json;
    }
    return output;
  }
  throw new HsmSchemaValidationError(`Value at "${path}" is not JSON-serializable.`);
}
function normalizeRefList(ref, path) {
  if (ref === void 0 || ref === null) return void 0;
  const refs = Array.isArray(ref) ? ref : [ref];
  const names = refs.map((item, index) => {
    if (typeof item === "function") throw new HsmSchemaFunctionError(`${path}[${index}]`);
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new HsmSchemaValidationError(`Expected named string reference at "${path}[${index}]".`);
    }
    return item;
  });
  return { refs: Object.freeze([...new Set(names)]) };
}
function refsToRuntime(ref) {
  if (!ref || ref.refs.length === 0) return void 0;
  return ref.refs.length === 1 ? ref.refs[0] : [...ref.refs];
}
function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = sortObject(value[key]);
  }
  return output;
}
function checksum(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

// src/schema/SchemaCompiler.ts
var SchemaCompiler = class {
  guardProbes = [];
  actionProbes = [];
  loaderProbes = [];
  compile(config, options = {}) {
    this.guardProbes.length = 0;
    this.actionProbes.length = 0;
    this.loaderProbes.length = 0;
    const tree = new StateTree(config);
    const routeTable = new RouteTable(tree);
    const compiledPolicyDefinitions = config.policies ? this.compilePolicyDefinitions(config.policies) : void 0;
    const roots = {};
    for (const root of tree.roots) {
      roots[root.key] = this.compileState(root.key, root.id, null, config.states[root.key] ?? {});
    }
    const stateIndex = tree.all.map((node) => {
      const stateConfig = node.config;
      const entry = {
        id: node.id,
        key: node.key,
        parentId: node.parent?.id ?? null,
        depth: node.depth,
        tags: Object.freeze([...node.config.tags ?? []]),
        meta: Object.freeze({ ...node.config.meta ?? {} })
      };
      optional(entry, "initial", node.config.initial);
      optional(entry, "policies", this.compilePolicies(stateConfig));
      optional(entry, "backend", this.compileBackend(stateConfig.backend, `states.${node.id}.backend`, node.id));
      return Object.freeze(entry);
    });
    const routeIndex = routeTable.entries.map((entry) => Object.freeze({
      stateId: entry.stateId,
      pattern: entry.pattern,
      canonicalPattern: entry.canonicalPattern,
      kind: entry.kind,
      isAlias: entry.isAlias,
      redirectToCanonical: entry.redirectToCanonical,
      priority: entry.priority,
      score: entry.score
    }));
    const metadata = {
      ...options.generatedAt === false ? {} : { generatedAt: options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString() },
      ...options.source ? { source: options.source } : {},
      ...options.description ? { description: options.description } : {}
    };
    const schemaWithoutChecksum = {
      kind: "panom-hsm.schema",
      schemaVersion: "1.0",
      id: config.id,
      version: options.version ?? config.version ?? "0.0.0",
      states: Object.freeze(roots),
      index: Object.freeze({
        states: Object.freeze(stateIndex),
        routes: Object.freeze(routeIndex),
        guards: Object.freeze(this.unique(this.guardProbes.map((item) => item.guard))),
        actions: Object.freeze(this.unique(this.actionProbes.map((item) => item.action))),
        loaders: Object.freeze(this.unique(this.loaderProbes.map((item) => item.loader))),
        tags: Object.freeze(this.unique(tree.all.flatMap((node) => [...node.tags])))
      }),
      ...config.initial ? { initial: config.initial } : {},
      ...config.query ? { query: this.compileQuery(config.query) } : {},
      ...compiledPolicyDefinitions ? { policies: compiledPolicyDefinitions } : {},
      ...Object.keys(metadata).length > 0 ? { metadata } : {}
    };
    const schema = Object.freeze({
      ...schemaWithoutChecksum,
      metadata: Object.freeze({
        ...schemaWithoutChecksum.metadata ?? {},
        checksum: checksum(schemaWithoutChecksum)
      })
    });
    return schema;
  }
  diagnostics() {
    return Object.freeze({
      guards: Object.freeze([...this.guardProbes]),
      actions: Object.freeze([...this.actionProbes]),
      loaders: Object.freeze([...this.loaderProbes])
    });
  }
  compileState(key, id, parentId, config) {
    const path = parentId ? `states.${id}` : `states.${key}`;
    const output = { key, id };
    optional(output, "path", config.path);
    optional(output, "url", config.url ? Object.freeze({ ...config.url }) : void 0);
    optional(output, "initial", config.initial);
    optional(output, "guard", this.trackGuard(normalizeRefList(config.guard, `${path}.guard`), id, "guard"));
    optional(output, "resolve", this.compileResolve(config.resolve, id, `${path}.resolve`));
    if (typeof config.redirect === "function") {
      normalizeRefList(config.redirect, `${path}.redirect`);
    }
    if (config.redirect !== void 0 && typeof config.redirect !== "string") {
      throw new HsmSchemaValidationError(`Only string redirects can be serialized at "${path}.redirect".`);
    }
    optional(output, "redirect", config.redirect);
    optional(output, "beforeLeave", this.trackGuard(normalizeRefList(config.beforeLeave, `${path}.beforeLeave`), id, "beforeLeave"));
    optional(output, "beforeEnter", this.trackGuard(normalizeRefList(config.beforeEnter, `${path}.beforeEnter`), id, "beforeEnter"));
    optional(output, "entry", this.trackAction(normalizeRefList(config.entry, `${path}.entry`), id, "entry"));
    optional(output, "exit", this.trackAction(normalizeRefList(config.exit, `${path}.exit`), id, "exit"));
    optional(output, "onEnter", this.trackAction(normalizeRefList(config.onEnter, `${path}.onEnter`), id, "onEnter"));
    optional(output, "onLeave", this.trackAction(normalizeRefList(config.onLeave, `${path}.onLeave`), id, "onLeave"));
    optional(output, "afterEnter", this.trackAction(normalizeRefList(config.afterEnter, `${path}.afterEnter`), id, "afterEnter"));
    optional(output, "loader", this.trackLoader(normalizeRefList(config.loader, `${path}.loader`), id));
    optional(output, "on", this.compileEvents(config.on, id, `${path}.on`));
    optional(output, "tags", config.tags ? Object.freeze([...config.tags]) : void 0);
    optional(output, "meta", config.meta ? Object.freeze({ ...config.meta }) : void 0);
    optional(output, "policies", this.compilePolicies(config));
    optional(output, "backend", this.compileBackend(config.backend, `${path}.backend`, id));
    if (config.states) {
      const children = {};
      for (const [childKey, childConfig] of Object.entries(config.states)) {
        const childId = `${id}.${childKey}`;
        children[childKey] = this.compileState(childKey, childId, id, childConfig);
      }
      if (Object.keys(children).length > 0) optional(output, "states", Object.freeze(children));
    }
    return Object.freeze(output);
  }
  compileResolve(rules, stateId, path) {
    if (!rules || rules.length === 0) return void 0;
    return Object.freeze(rules.map((rule, index) => {
      const guard = this.trackGuard(normalizeRefList(rule.guard, `${path}[${index}].guard`), stateId, "resolve");
      return Object.freeze({
        target: rule.target,
        ...guard ? { guard } : {}
      });
    }));
  }
  compileEvents(events, stateId, path) {
    if (!events) return void 0;
    const output = {};
    for (const [eventName, transitionOrTransitions] of Object.entries(events)) {
      const transitions = Array.isArray(transitionOrTransitions) ? transitionOrTransitions : [transitionOrTransitions];
      output[eventName] = Object.freeze(transitions.map((transition, index) => {
        if (typeof transition === "string") {
          return Object.freeze({ target: transition });
        }
        const typed = transition;
        const guard = this.trackGuard(normalizeRefList(typed.guard, `${path}.${eventName}[${index}].guard`), stateId, "resolve");
        const actions = this.trackAction(normalizeRefList(typed.actions, `${path}.${eventName}[${index}].actions`), stateId, "event");
        const params = toJsonValue(typed.params, `${path}.${eventName}[${index}].params`);
        const context = toJsonValue(typed.context, `${path}.${eventName}[${index}].context`);
        const result = { target: typed.target };
        optional(result, "guard", guard);
        optional(result, "actions", actions);
        optional(result, "params", params);
        optional(result, "context", context);
        return Object.freeze(result);
      }));
    }
    return Object.freeze(output);
  }
  compileQuery(query2) {
    const output = {};
    if (!query2) return Object.freeze(output);
    for (const [key, binding2] of Object.entries(query2)) {
      const item = binding2;
      if (item.encode) normalizeRefList(item.encode, `query.${key}.encode`);
      if (item.decode) normalizeRefList(item.decode, `query.${key}.decode`);
      if (item.validate) normalizeRefList(item.validate, `query.${key}.validate`);
      const defaultValue = toJsonValue(item.default, `query.${key}.default`);
      const compiled = {};
      optional(compiled, "source", item.source);
      optional(compiled, "key", item.key);
      optional(compiled, "type", item.type);
      optional(compiled, "default", defaultValue);
      optional(compiled, "expose", item.expose);
      optional(compiled, "omitDefault", item.omitDefault);
      optional(compiled, "invalid", item.invalid);
      output[key] = Object.freeze(compiled);
    }
    return Object.freeze(output);
  }
  compilePolicies(config) {
    const policies = {};
    optional(policies, "permissions", config.permissions ? Object.freeze([...config.permissions]) : void 0);
    optional(policies, "denyPermissions", config.denyPermissions ? Object.freeze([...config.denyPermissions]) : void 0);
    optional(policies, "capabilities", config.capabilities ? Object.freeze([...config.capabilities]) : void 0);
    optional(policies, "denyCapabilities", config.denyCapabilities ? Object.freeze([...config.denyCapabilities]) : void 0);
    optional(policies, "features", config.features ? Object.freeze([...config.features]) : void 0);
    optional(policies, "denyFeatures", config.denyFeatures ? Object.freeze([...config.denyFeatures]) : void 0);
    optional(policies, "layout", config.layout);
    return Object.keys(policies).length > 0 ? Object.freeze(policies) : void 0;
  }
  compilePolicyDefinitions(definitions) {
    const output = {};
    optional(output, "permissions", this.compilePolicyMap(definitions.permissions, "policies.permissions"));
    optional(output, "capabilities", this.compilePolicyMap(definitions.capabilities, "policies.capabilities"));
    optional(output, "features", this.compilePolicyMap(definitions.features, "policies.features"));
    return Object.freeze(output);
  }
  compilePolicyMap(map, path) {
    if (!map) return void 0;
    const output = {};
    for (const [key, definition] of Object.entries(map)) {
      output[key] = this.compilePolicyRule(definition, `${path}.${key}`, key);
    }
    return Object.freeze(output);
  }
  compilePolicyRule(definition, path, policyKey) {
    if (typeof definition === "boolean") return Object.freeze({ enabled: definition });
    if (typeof definition === "string" || typeof definition === "function" || Array.isArray(definition)) {
      const output2 = {};
      optional(output2, "guard", this.trackGuard(normalizeRefList(definition, `${path}.guard`), policyKey, "policy"));
      return Object.freeze(output2);
    }
    const typed = definition;
    const output = {};
    optional(output, "guard", this.trackGuard(normalizeRefList(typed.guard, `${path}.guard`), policyKey, "policy"));
    optional(output, "description", typed.description);
    optional(output, "tags", typed.tags ? Object.freeze([...typed.tags]) : void 0);
    optional(output, "meta", typed.meta ? toJsonValue(typed.meta, `${path}.meta`) : void 0);
    return Object.freeze(output);
  }
  compileBackend(policy, path, stateId) {
    if (!policy) return void 0;
    const output = {};
    optional(output, "routes", policy.routes ? Object.freeze([...policy.routes]) : void 0);
    optional(output, "methods", policy.methods ? Object.freeze(policy.methods.map((method) => method.toUpperCase())) : void 0);
    optional(output, "guards", this.trackGuard(normalizeRefList(policy.guards, `${path}.guards`), stateId, "backend"));
    optional(output, "meta", policy.meta ? toJsonValue(policy.meta, `${path}.meta`) : void 0);
    return Object.keys(output).length > 0 ? Object.freeze(output) : void 0;
  }
  trackGuard(ref, stateId, phase) {
    if (!ref) return void 0;
    for (const guard of ref.refs) this.guardProbes.push(Object.freeze({ stateId, guard, phase }));
    return ref;
  }
  trackAction(ref, stateId, phase) {
    if (!ref) return void 0;
    for (const action of ref.refs) this.actionProbes.push(Object.freeze({ stateId, action, phase }));
    return ref;
  }
  trackLoader(ref, stateId) {
    if (!ref) return void 0;
    for (const loader of ref.refs) this.loaderProbes.push(Object.freeze({ stateId, loader }));
    return ref;
  }
  unique(values) {
    return Object.freeze([...new Set(values)].sort());
  }
};
function compileSchema(config, options = {}) {
  return new SchemaCompiler().compile(config, options);
}
function defineHsm(config) {
  return config;
}

// src/schema/SchemaConfigFactory.ts
var SchemaConfigFactory = class {
  fromSchema(schema, options = {}) {
    const states = {};
    for (const [key, state] of Object.entries(schema.states)) {
      states[key] = this.stateFromSchema(state);
    }
    const config = {
      id: schema.id,
      states
    };
    if (schema.initial !== void 0) Object.assign(config, { initial: schema.initial });
    if (options.context !== void 0) Object.assign(config, { context: options.context });
    if (options.guards !== void 0) Object.assign(config, { guards: options.guards });
    if (options.actions !== void 0) Object.assign(config, { actions: options.actions });
    if (options.loaders !== void 0) Object.assign(config, { loaders: options.loaders });
    if (schema.query !== void 0) Object.assign(config, { query: schema.query });
    if (schema.policies !== void 0) Object.assign(config, { policies: this.policiesFromSchema(schema.policies) });
    return config;
  }
  stateFromSchema(state) {
    const config = {};
    if (state.path !== void 0) Object.assign(config, { path: state.path });
    if (state.url !== void 0) Object.assign(config, { url: state.url });
    if (state.initial !== void 0) Object.assign(config, { initial: state.initial });
    if (state.guard !== void 0) Object.assign(config, { guard: refsToRuntime(state.guard) });
    if (state.resolve !== void 0) {
      Object.assign(config, {
        resolve: state.resolve.map((rule) => ({
          target: rule.target,
          ...rule.guard ? { guard: refsToRuntime(rule.guard) } : {}
        }))
      });
    }
    if (state.redirect !== void 0) Object.assign(config, { redirect: state.redirect });
    if (state.beforeLeave !== void 0) Object.assign(config, { beforeLeave: refsToRuntime(state.beforeLeave) });
    if (state.beforeEnter !== void 0) Object.assign(config, { beforeEnter: refsToRuntime(state.beforeEnter) });
    if (state.entry !== void 0) Object.assign(config, { entry: refsToRuntime(state.entry) });
    if (state.exit !== void 0) Object.assign(config, { exit: refsToRuntime(state.exit) });
    if (state.onEnter !== void 0) Object.assign(config, { onEnter: refsToRuntime(state.onEnter) });
    if (state.onLeave !== void 0) Object.assign(config, { onLeave: refsToRuntime(state.onLeave) });
    if (state.afterEnter !== void 0) Object.assign(config, { afterEnter: refsToRuntime(state.afterEnter) });
    if (state.loader !== void 0) Object.assign(config, { loader: refsToRuntime(state.loader) });
    if (state.on !== void 0) Object.assign(config, { on: this.eventsFromSchema(state.on) });
    if (state.tags !== void 0) Object.assign(config, { tags: [...state.tags] });
    if (state.meta !== void 0) Object.assign(config, { meta: { ...state.meta } });
    if (state.policies?.permissions !== void 0) Object.assign(config, { permissions: [...state.policies.permissions] });
    if (state.policies?.denyPermissions !== void 0) Object.assign(config, { denyPermissions: [...state.policies.denyPermissions] });
    if (state.policies?.capabilities !== void 0) Object.assign(config, { capabilities: [...state.policies.capabilities] });
    if (state.policies?.denyCapabilities !== void 0) Object.assign(config, { denyCapabilities: [...state.policies.denyCapabilities] });
    if (state.policies?.features !== void 0) Object.assign(config, { features: [...state.policies.features] });
    if (state.policies?.denyFeatures !== void 0) Object.assign(config, { denyFeatures: [...state.policies.denyFeatures] });
    if (state.policies?.layout !== void 0) Object.assign(config, { layout: state.policies.layout });
    if (state.backend !== void 0) {
      Object.assign(config, {
        backend: {
          ...state.backend.routes ? { routes: [...state.backend.routes] } : {},
          ...state.backend.methods ? { methods: [...state.backend.methods] } : {},
          ...state.backend.guards ? { guards: refsToRuntime(state.backend.guards) } : {},
          ...state.backend.meta ? { meta: { ...state.backend.meta } } : {}
        }
      });
    }
    if (state.states !== void 0) {
      const children = {};
      for (const [key, child] of Object.entries(state.states)) {
        children[key] = this.stateFromSchema(child);
      }
      Object.assign(config, { states: children });
    }
    return config;
  }
  policiesFromSchema(schema) {
    const output = {};
    if (schema.permissions) Object.assign(output, { permissions: this.policyMapFromSchema(schema.permissions) });
    if (schema.capabilities) Object.assign(output, { capabilities: this.policyMapFromSchema(schema.capabilities) });
    if (schema.features) Object.assign(output, { features: this.policyMapFromSchema(schema.features) });
    return output;
  }
  policyMapFromSchema(map) {
    const output = {};
    for (const [key, rule] of Object.entries(map)) {
      if (rule.enabled !== void 0 && !rule.guard) {
        output[key] = rule.enabled;
        continue;
      }
      const definition = {};
      if (rule.guard) definition.guard = refsToRuntime(rule.guard);
      if (rule.description) definition.description = rule.description;
      if (rule.tags) definition.tags = [...rule.tags];
      if (rule.meta) definition.meta = { ...rule.meta };
      output[key] = definition;
    }
    return output;
  }
  eventsFromSchema(events) {
    const output = {};
    for (const [eventName, transitions] of Object.entries(events)) {
      Object.assign(output, {
        [eventName]: transitions.map((transition) => ({
          target: transition.target,
          ...transition.guard ? { guard: refsToRuntime(transition.guard) } : {},
          ...transition.actions ? { actions: refsToRuntime(transition.actions) } : {},
          ...transition.params !== void 0 ? { params: transition.params } : {},
          ...transition.context !== void 0 ? { context: transition.context } : {}
        }))
      });
    }
    return output;
  }
};

// src/schema/SchemaValidator.ts
var SchemaValidator = class {
  validate(schema) {
    const issues = [];
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return { ok: false, issues: [{ path: "$", message: "Schema must be an object.", severity: "error" }] };
    }
    const candidate = schema;
    this.expect(candidate.kind === "panom-hsm.schema", "$kind", "Expected kind to be panom-hsm.schema.", issues);
    this.expect(candidate.schemaVersion === "1.0", "$.schemaVersion", "Unsupported schemaVersion.", issues);
    this.expect(typeof candidate.id === "string" && candidate.id.length > 0, "$.id", "Schema id is required.", issues);
    this.expect(typeof candidate.version === "string" && candidate.version.length > 0, "$.version", "Schema version is required.", issues);
    this.expect(Boolean(candidate.states) && typeof candidate.states === "object", "$.states", "States object is required.", issues);
    this.expect(Boolean(candidate.index) && typeof candidate.index === "object", "$.index", "Index object is required.", issues);
    if (candidate.states && typeof candidate.states === "object") {
      const seen = /* @__PURE__ */ new Set();
      for (const [key, state] of Object.entries(candidate.states)) {
        this.validateState(state, `$.states.${key}`, null, seen, issues);
      }
    }
    if (candidate.index?.states) {
      const stateIds = /* @__PURE__ */ new Set();
      for (const entry of candidate.index.states) stateIds.add(entry.id);
      if (candidate.index.routes) {
        for (const [index, route] of candidate.index.routes.entries()) {
          this.expect(stateIds.has(route.stateId), `$.index.routes[${index}].stateId`, `Route points to missing state: ${route.stateId}.`, issues);
        }
      }
    }
    return Object.freeze({ ok: !issues.some((issue) => issue.severity === "error"), issues: Object.freeze(issues) });
  }
  assertValid(schema) {
    const result = this.validate(schema);
    if (!result.ok) {
      throw new HsmSchemaValidationError(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    }
  }
  validateState(state, path, parentId, seen, issues) {
    this.expect(Boolean(state) && typeof state === "object", path, "State must be an object.", issues);
    if (!state || typeof state !== "object") return;
    this.expect(typeof state.key === "string" && state.key.length > 0, `${path}.key`, "State key is required.", issues);
    this.expect(typeof state.id === "string" && state.id.length > 0, `${path}.id`, "State id is required.", issues);
    if (seen.has(state.id)) {
      this.issue(`${path}.id`, `Duplicate state id: ${state.id}.`, issues);
    }
    seen.add(state.id);
    if (parentId && !state.id.startsWith(`${parentId}.`)) {
      this.issue(`${path}.id`, `Child id must be nested below parent id ${parentId}.`, issues);
    }
    for (const [field, refs] of Object.entries({
      guard: state.guard,
      beforeLeave: state.beforeLeave,
      beforeEnter: state.beforeEnter,
      entry: state.entry,
      exit: state.exit,
      onEnter: state.onEnter,
      onLeave: state.onLeave,
      afterEnter: state.afterEnter,
      loader: state.loader
    })) {
      if (!refs) continue;
      this.expect(Array.isArray(refs.refs), `${path}.${field}.refs`, "Reference list must contain refs array.", issues);
      for (const [index, ref] of refs.refs.entries()) {
        this.expect(typeof ref === "string" && ref.length > 0, `${path}.${field}.refs[${index}]`, "Reference must be a non-empty string.", issues);
      }
    }
    if (state.states) {
      for (const [childKey, child] of Object.entries(state.states)) {
        this.validateState(child, `${path}.states.${childKey}`, state.id, seen, issues);
      }
    }
  }
  expect(condition, path, message, issues) {
    if (!condition) this.issue(path, message, issues);
  }
  issue(path, message, issues) {
    issues.push(Object.freeze({ path, message, severity: "error" }));
  }
};
function validateSchema(schema) {
  return new SchemaValidator().validate(schema);
}
function assertValidSchema(schema) {
  const validator = new SchemaValidator();
  validator.assertValid(schema);
}

// src/schema/SchemaSerializer.ts
var SchemaSerializer = class {
  validator = new SchemaValidator();
  toJson(schema, space = 2) {
    const validator = this.validator;
    validator.assertValid(schema);
    return `${JSON.stringify(schema, null, space)}
`;
  }
  fromJson(input) {
    try {
      const parsed = JSON.parse(input);
      const validator = this.validator;
      validator.assertValid(parsed);
      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new HsmSchemaParseError(error.message);
      }
      throw error;
    }
  }
  clone(schema) {
    return this.fromJson(this.toJson(schema, 0));
  }
};
function schemaToJson(schema, space = 2) {
  return new SchemaSerializer().toJson(schema, space);
}
function schemaFromJson(input) {
  return new SchemaSerializer().fromJson(input);
}

// src/schema/createHsmFromSchema.ts
function createHsmFromSchema(schema, options = {}) {
  const validator = new SchemaValidator();
  validator.assertValid(schema);
  const config = new SchemaConfigFactory().fromSchema(schema, options);
  return createHsm(config);
}

// src/backend/RequestResolver.ts
var RequestResolver = class {
  normalize(request) {
    const method = (request.method ?? "GET").toUpperCase();
    const url = request.originalUrl ?? request.url ?? this.composePathAndQuery(request.path ?? "/", request.query);
    return Object.freeze({ method, url });
  }
  composePathAndQuery(pathname, query2) {
    return PathComposer.appendSearchAndHash(pathname || "/", query2);
  }
};

// src/backend/HsmBackendRuntime.ts
var HsmBackendRuntime = class {
  schema;
  hsm;
  requestResolver = new RequestResolver();
  policyEnforcer = new BackendPolicyEnforcer();
  stateIndex = /* @__PURE__ */ new Map();
  config;
  constructor(config) {
    const validator = new SchemaValidator();
    validator.assertValid(config.schema);
    this.schema = config.schema;
    this.config = config;
    for (const state of config.schema.index.states) {
      this.stateIndex.set(state.id, state);
    }
    const runtimeOptions = {};
    if (config.guards !== void 0) Object.assign(runtimeOptions, { guards: config.guards });
    if (config.actions !== void 0) Object.assign(runtimeOptions, { actions: config.actions });
    if (config.loaders !== void 0) Object.assign(runtimeOptions, { loaders: config.loaders });
    this.hsm = createHsmFromSchema(config.schema, runtimeOptions);
  }
  async resolveRequest(request, options = {}) {
    const normalized = this.requestResolver.normalize(request);
    try {
      const context = await this.contextFor(request, normalized.url, normalized.method, options.context);
      const resolveOptions = {
        context,
        canonicalizeAliases: true,
        preserveUnknownQuery: true,
        ...this.config.resolveOptions ?? {},
        ...options.resolveOptions ?? {}
      };
      const baseUrl = options.baseUrl ?? this.config.baseUrl;
      if (baseUrl !== void 0) Object.assign(resolveOptions, { baseUrl });
      const snapshot = await this.hsm.resolveUrl(normalized.url, resolveOptions);
      const state = this.stateIndex.get(snapshot.stateId);
      if (!state) {
        throw new Error(`Schema index does not contain resolved state "${snapshot.stateId}".`);
      }
      const methodAllowed = this.isMethodAllowed(snapshot.activePath, normalized.method);
      if (!methodAllowed) {
        return this.fail(request, normalized, "method_not_allowed", 405, new Error(`Method ${normalized.method} is not allowed for ${snapshot.stateId}.`), options.strict);
      }
      const stateAllowed = this.matchesRequiredState(snapshot.stateId, snapshot.activePath, options.requireState);
      if (!stateAllowed) {
        return this.fail(request, normalized, "backend_guard_failed", 403, new Error(`Resolved state ${snapshot.stateId} does not satisfy required state.`), options.strict);
      }
      const tagAllowed = this.matchesRequiredTag([...snapshot.tags], options.requireTag);
      if (!tagAllowed) {
        return this.fail(request, normalized, "backend_guard_failed", 403, new Error(`Resolved state ${snapshot.stateId} does not satisfy required tag.`), options.strict);
      }
      const policyFailure = this.policyEnforcer.checkAll(snapshot, {
        ...options.requirePermission ? { permissions: options.requirePermission } : {},
        ...options.requireCapability ? { capabilities: options.requireCapability } : {},
        ...options.requireFeature ? { features: options.requireFeature } : {}
      });
      if (policyFailure) {
        return this.fail(request, normalized, policyFailure.reason, policyFailure.status, new Error(policyFailure.message), options.strict);
      }
      await this.runBackendGuards(snapshot.activePath, context, snapshot.params, normalized.method);
      const syncOptions = { preserveUnknownQuery: true, canonicalizePath: true };
      const syncBaseUrl = options.baseUrl ?? this.config.baseUrl;
      if (syncBaseUrl !== void 0) Object.assign(syncOptions, { baseUrl: syncBaseUrl });
      const canonicalUrl = this.hsm.syncUrl(normalized.url, snapshot.context, syncOptions);
      return Object.freeze({
        ok: true,
        request,
        method: normalized.method,
        url: normalized.url,
        snapshot,
        state,
        canonicalUrl
      });
    } catch (error) {
      if (error instanceof HsmRouteNotFoundError) {
        return this.fail(request, normalized, "route_not_found", 404, error, options.strict);
      }
      if (error instanceof HsmQueryParseError) {
        return this.fail(request, normalized, "query_invalid", 400, error, options.strict);
      }
      if (error instanceof HsmGuardRejectedError) {
        return this.fail(request, normalized, "guard_failed", 403, error, options.strict);
      }
      return this.fail(request, normalized, "error", 500, error, options.strict);
    }
  }
  async assertRequest(request, options = {}) {
    const result = await this.resolveRequest(request, { ...options, strict: true });
    if (!result.ok) throw result.error;
    return result;
  }
  middleware(options = {}) {
    return async (req, res, next) => {
      const result = await this.resolveRequest(req, options);
      if (result.ok) {
        Object.assign(req, { [options.attachTo ?? "hsm"]: result });
        next();
        return;
      }
      const response = res.status?.(result.status) ?? res;
      const body = options.exposeErrorBody === false ? { error: result.reason } : { error: result.reason, message: result.error instanceof Error ? result.error.message : String(result.error) };
      if (response.json) {
        response.json(body);
        return;
      }
      if (response.send) {
        response.send(body);
        return;
      }
      if (response.end) response.end();
    };
  }
  requireState(state, options = {}) {
    return this.middleware({ ...options, requireState: state });
  }
  requireTag(tag, options = {}) {
    return this.middleware({ ...options, requireTag: tag });
  }
  requirePermission(permission, options = {}) {
    return this.middleware({ ...options, requirePermission: permission });
  }
  requireCapability(capability, options = {}) {
    return this.middleware({ ...options, requireCapability: capability });
  }
  requireFeature(feature, options = {}) {
    return this.middleware({ ...options, requireFeature: feature });
  }
  async assertPermission(request, permission, options = {}) {
    return this.assertRequest(request, { ...options, requirePermission: permission });
  }
  async contextFor(request, url, method, override) {
    if (override) return override;
    const source = this.config.context;
    if (typeof source === "function") {
      return source({ request, url, method, schema: this.schema });
    }
    return source ?? {};
  }
  isMethodAllowed(activePath, method) {
    for (const stateId of [...activePath].reverse()) {
      const methods = this.stateIndex.get(stateId)?.backend?.methods;
      if (methods && methods.length > 0) return methods.includes(method.toUpperCase());
    }
    return true;
  }
  async runBackendGuards(activePath, context, params, method) {
    for (const stateId of activePath) {
      const state = this.stateIndex.get(stateId);
      const guardRef = refsToRuntime(state?.backend?.guards);
      if (!guardRef) continue;
      const node = this.hsm.tree.get(stateId);
      await this.hsm.guards.assertAll({
        context,
        state: node,
        stateId,
        params,
        meta: node.meta,
        event: { type: `backend.${method}` }
      }, guardRef);
    }
  }
  matchesRequiredState(stateId, activePath, required) {
    if (!required) return true;
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.some((item) => stateId === item || activePath.includes(item));
  }
  matchesRequiredTag(tags, required) {
    if (!required) return true;
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.every((tag) => tags.includes(tag));
  }
  fail(request, normalized, reason, status, error, strict) {
    if (strict) throw error;
    return Object.freeze({ ok: false, request, method: normalized.method, url: normalized.url, reason, status, error });
  }
};
function createHsmBackend(config) {
  return new HsmBackendRuntime(config);
}

// src/backend/BackendGuardRegistry.ts
var BackendGuardRegistry = class extends GuardRegistry {
  constructor(guards = {}) {
    super(guards);
  }
};

// src/backend/adapters/express.ts
function hsmExpressMiddleware(runtime, options = {}) {
  return runtime.middleware(options);
}
function requireHsmState(runtime, state, options = {}) {
  return runtime.requireState(state, options);
}
function requireHsmTag(runtime, tag, options = {}) {
  return runtime.requireTag(tag, options);
}
function requireHsmPermission(runtime, permission, options = {}) {
  return runtime.requirePermission(permission, options);
}
function requireHsmCapability(runtime, capability, options = {}) {
  return runtime.requireCapability(capability, options);
}
function requireHsmFeature(runtime, feature, options = {}) {
  return runtime.requireFeature(feature, options);
}

// src/backend/adapters/node.ts
function fromNodeRequest(request) {
  const output = {};
  if (request.method !== void 0) Object.assign(output, { method: request.method });
  if (request.url !== void 0) Object.assign(output, { url: request.url });
  if (request.headers !== void 0) Object.assign(output, { headers: request.headers });
  return output;
}

// src/browser/BrowserHistoryAdapter.ts
function resolveGlobalWindow() {
  const value = globalThis;
  return value.window;
}
function normalizeBaseOrigin(origin) {
  if (!origin) return "http://localhost";
  try {
    return new URL(origin).origin;
  } catch {
    return "http://localhost";
  }
}
function normalizeHash(hash) {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}
function normalizeSearch(search) {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}
function toLocation(url) {
  return Object.freeze({
    origin: url.origin,
    hostname: url.hostname,
    pathname: url.pathname || "/",
    search: url.search,
    hash: url.hash,
    href: url.href,
    fullPath: `${url.pathname || "/"}${url.search}${url.hash}`
  });
}
var BrowserHistoryAdapter = class {
  windowLike;
  baseOrigin;
  memoryLocation;
  constructor(options = {}) {
    this.windowLike = options.window ?? resolveGlobalWindow();
    this.baseOrigin = normalizeBaseOrigin(options.baseOrigin ?? this.windowLike?.location.origin);
    if (this.windowLike) {
      this.memoryLocation = this.readFromWindow();
    } else {
      this.memoryLocation = toLocation(new URL("/", this.baseOrigin));
    }
  }
  current() {
    return this.windowLike ? this.readFromWindow() : this.memoryLocation;
  }
  commit(commit) {
    if (commit.mode === "silent") return this.current();
    const resolved = this.resolve(commit.url);
    if (this.windowLike) {
      if (commit.mode === "replace") {
        this.windowLike.history.replaceState(commit.state ?? null, "", resolved.fullPath);
      } else {
        this.windowLike.history.pushState(commit.state ?? null, "", resolved.fullPath);
      }
      return this.readFromWindow();
    }
    this.memoryLocation = resolved;
    return this.memoryLocation;
  }
  push(url, source = "navigate", state) {
    return this.commit({ mode: "push", source, url, state });
  }
  replace(url, source = "sync", state) {
    return this.commit({ mode: "replace", source, url, state });
  }
  listen(listener) {
    if (!this.windowLike) return () => void 0;
    const handler = (event) => listener(this.current(), event);
    this.windowLike.addEventListener("popstate", handler);
    return () => this.windowLike?.removeEventListener("popstate", handler);
  }
  resolve(input) {
    const base = this.current().href || `${this.baseOrigin}/`;
    const url = input instanceof URL ? input : new URL(input, base);
    return toLocation(url);
  }
  toFullPath(input) {
    return this.resolve(input).fullPath;
  }
  modeOrDefault(mode, fallback) {
    return mode ?? fallback;
  }
  readFromWindow() {
    const location = this.windowLike?.location;
    if (!location) return this.memoryLocation;
    const url = new URL(
      `${location.pathname || "/"}${normalizeSearch(location.search)}${normalizeHash(location.hash)}`,
      location.origin || this.baseOrigin
    );
    return toLocation(url);
  }
};

// src/browser/CanonicalNavigation.ts
var CanonicalNavigation = class {
  constructor(hostPolicy, history) {
    this.hostPolicy = hostPolicy;
    this.history = history;
  }
  hostPolicy;
  history;
  targetFor(snapshot, options = {}) {
    if (!this.hostPolicy) return null;
    const hostname = options.hostname ?? this.history.current().hostname;
    return this.hostPolicy.getCanonicalTarget(hostname, snapshot);
  }
  apply(snapshot, options = {}) {
    const target = this.targetFor(snapshot, options);
    if (!target) return null;
    if (target.type === "internal") {
      this.history.commit({
        mode: options.replace ?? true ? "replace" : "push",
        source: "canonical",
        url: target.to
      });
    }
    return target;
  }
};

// src/browser/RedirectSafety.ts
var DEFAULT_BLOCKED_PREFIXES = Object.freeze([
  "/auth",
  "/logout",
  "/maintenance",
  "/high-traffic",
  "/suspended"
]);
function fail(input, reason) {
  return Object.freeze({ ok: false, input, reason });
}
function success(input, url, target) {
  return Object.freeze({
    ok: true,
    target,
    url,
    normalized: target.to
  });
}
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
function hasEncodedBackslash(value) {
  return /%5c/i.test(value) || /%5C/.test(value);
}
function hasEncodedProtocolRelative(value) {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const decoded = safeDecode(current);
    if (!decoded || decoded === current) break;
    current = decoded;
    const compact = current.trimStart();
    if (compact.startsWith("//") || compact.startsWith("/\\")) return true;
  }
  return false;
}
function isBlockedPath(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
function normalizeOrigin(origin) {
  try {
    return new URL(origin ?? "http://localhost").origin;
  } catch {
    return "http://localhost";
  }
}
function allowedHostnames(options) {
  const allowed = /* @__PURE__ */ new Set([options.rootHostname]);
  for (const hostname of options.allowedHostnames ?? []) allowed.add(hostname);
  if (options.allowDevCurrentHost && options.currentHostname) allowed.add(options.currentHostname);
  return allowed;
}
var RedirectSafety = class {
  constructor(options) {
    this.options = options;
  }
  options;
  validate(raw) {
    if (typeof raw !== "string") return fail("", "empty");
    const input = raw.trim();
    if (!input) return fail(raw, "empty");
    if (input.includes("\\")) return fail(input, "backslash");
    if (hasEncodedBackslash(input)) return fail(input, "encoded_backslash");
    if (input.startsWith("//")) return fail(input, "protocol_relative");
    if (hasEncodedProtocolRelative(input)) return fail(input, "encoded_protocol_relative");
    const currentOrigin = normalizeOrigin(this.options.currentOrigin);
    const blockedPathPrefixes = this.options.blockedPathPrefixes ?? DEFAULT_BLOCKED_PREFIXES;
    let url;
    try {
      url = new URL(input, currentOrigin);
    } catch {
      return fail(input, "invalid_url");
    }
    if (!["http:", "https:"].includes(url.protocol)) return fail(input, "disallowed_protocol");
    if (url.pathname.includes("\\")) return fail(input, "backslash");
    if (isBlockedPath(url.pathname, blockedPathPrefixes)) return fail(input, "blocked_path");
    const hostnames = allowedHostnames(this.options);
    if (url.origin !== currentOrigin && !hostnames.has(url.hostname)) {
      return fail(input, "external_origin");
    }
    const internalPath = `${url.pathname}${url.search}${url.hash}`;
    const target = url.origin === currentOrigin ? { type: "internal", to: internalPath } : { type: "external", to: url.toString() };
    return success(input, url, target);
  }
  assert(raw) {
    const result = this.validate(raw);
    if (!result.ok) {
      throw new Error(`Unsafe redirect target rejected: ${result.reason}`);
    }
    return result;
  }
  isSafe(raw) {
    return this.validate(raw).ok;
  }
};
function createRedirectSafety(options) {
  return new RedirectSafety(options);
}

// src/browser/HostPolicyAdapter.ts
function isRuntime(value) {
  return Boolean(value && typeof value === "object" && "getCanonicalNavigationTarget" in value && "registry" in value);
}
function snapshotFullPath(snapshot) {
  const route = snapshot.route;
  if (!route) return "/";
  const query2 = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query ?? {})) {
    if (value === void 0 || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) query2.append(key, String(item));
    } else {
      query2.set(key, String(value));
    }
  }
  const search = query2.toString();
  const hash = route.hash ? `#${route.hash}` : "";
  return `${route.canonicalPathname || route.pathname}${search ? `?${search}` : ""}${hash}`;
}
function configuredHostnames(runtime) {
  return Object.freeze([
    runtime.rootHostname,
    ...runtime.registry.all().map((policy) => `${policy.subdomain}.${runtime.rootHostname}`)
  ]);
}
var HostPolicyAdapter = class {
  runtime;
  strictRedirectSafety;
  constructor(options) {
    if ("runtime" in options) {
      this.runtime = options.runtime;
      this.strictRedirectSafety = options.strictRedirectSafety ?? true;
    } else {
      this.runtime = isRuntime(options) ? options : runtime.createSubdomainPolicyRuntime(options);
      this.strictRedirectSafety = true;
    }
  }
  get allowedHostnames() {
    return configuredHostnames(this.runtime);
  }
  getPolicyForHostname(hostname) {
    return this.runtime.getPolicyForHostname(hostname);
  }
  getPolicyForState(stateId) {
    return this.runtime.getPolicyForRouteName(stateId);
  }
  isStateHandledBySubdomain(stateId, subdomain) {
    return this.runtime.isRouteHandledBySubdomain(stateId, subdomain);
  }
  getPolicyLandingUrl(subdomain) {
    return this.runtime.getPolicyLandingUrl(subdomain);
  }
  getPolicyLandingUrlForState(stateId) {
    return this.runtime.getPolicyLandingUrlForRoute(stateId);
  }
  buildAbsoluteUrlForState(stateId, path = "/") {
    return this.runtime.buildAbsolutePolicyUrlForRoute(stateId, path);
  }
  getSocketServerOrigin(stateId) {
    return this.runtime.getSocketServerOrigin(stateId);
  }
  getAuthEntryUrl() {
    return this.runtime.getAuthEntryUrl();
  }
  getCanonicalTarget(hostname, snapshot) {
    if (!snapshot.route) return null;
    return this.runtime.getCanonicalNavigationTarget(hostname, {
      name: snapshot.stateId,
      fullPath: snapshotFullPath(snapshot),
      path: snapshot.route.canonicalPathname || snapshot.route.pathname
    });
  }
  rememberPostAuthRedirect(target, currentOrigin, currentHostname) {
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    const result = safety.validate(target);
    if (result.ok || !this.strictRedirectSafety) {
      this.runtime.rememberPostAuthRedirect(result.ok ? result.normalized : target);
    }
    return result;
  }
  peekSafePostAuthRedirect(currentOrigin, currentHostname) {
    const target = this.runtime.peekSafePostAuthRedirect();
    if (!target || !this.strictRedirectSafety) return target;
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    return safety.validate(target.to).ok ? target : null;
  }
  consumeSafePostAuthRedirect(currentOrigin, currentHostname) {
    const target = this.runtime.consumeSafePostAuthRedirect();
    if (!target || !this.strictRedirectSafety) return target;
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    return safety.validate(target.to).ok ? target : null;
  }
  isDebugEnabled() {
    return this.runtime.isSubdomainDebugEnabled();
  }
  debug(event, payload) {
    this.runtime.logSubdomainDebug(event, payload);
  }
  redirectSafety(currentOrigin, currentHostname) {
    const options = {
      rootHostname: this.runtime.rootHostname,
      allowedHostnames: this.allowedHostnames
    };
    if (currentOrigin !== void 0) Object.assign(options, { currentOrigin });
    if (currentHostname !== void 0) Object.assign(options, { currentHostname });
    return new RedirectSafety(options);
  }
};
function createHostPolicyAdapter(options) {
  return new HostPolicyAdapter(options);
}

// src/browser/PopstateListener.ts
var PopstateListener = class {
  constructor(history) {
    this.history = history;
  }
  history;
  unsubscribe = null;
  start(listener) {
    if (this.unsubscribe) return;
    this.unsubscribe = this.history.listen(listener);
  }
  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
  get active() {
    return this.unsubscribe !== null;
  }
};

// src/browser/UrlSyncController.ts
var UrlSyncController = class {
  constructor(history) {
    this.history = history;
  }
  history;
  locked = false;
  get isLocked() {
    return this.locked;
  }
  withLock(fn) {
    const previous = this.locked;
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = previous;
    }
  }
  async withAsyncLock(fn) {
    const previous = this.locked;
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = previous;
    }
  }
  commit(url, options = {}) {
    if (this.locked) return false;
    const mode = options.mode ?? "replace";
    if (mode === "silent") return false;
    const current = this.history.current().fullPath;
    const target = this.history.resolve(url).fullPath;
    if (current === target) return false;
    this.history.commit({
      mode,
      source: options.source ?? "sync",
      url: target,
      state: options.state
    });
    return true;
  }
};

// src/browser/BrowserUrlRuntime.ts
function normalizeHostPolicy(options) {
  if (!options.hostPolicy) return null;
  if (options.hostPolicy instanceof HostPolicyAdapter) return options.hostPolicy;
  return createHostPolicyAdapter(options.hostPolicy);
}
function targetToUrl(target) {
  return target.to;
}
var BrowserUrlRuntime = class {
  hsm;
  history;
  hostPolicy;
  popstate;
  syncController;
  canonical;
  autoCanonicalize;
  preserveUnknownQuery;
  canonicalizeAliases;
  onTransition;
  onCanonicalTarget;
  onError;
  constructor(options) {
    this.hsm = options.hsm;
    this.history = options.history ?? new BrowserHistoryAdapter(options.window ? { window: options.window } : {});
    this.hostPolicy = normalizeHostPolicy(options);
    this.popstate = new PopstateListener(this.history);
    this.syncController = new UrlSyncController(this.history);
    this.canonical = new CanonicalNavigation(this.hostPolicy, this.history);
    this.autoCanonicalize = options.autoCanonicalize ?? true;
    this.preserveUnknownQuery = options.preserveUnknownQuery ?? true;
    this.canonicalizeAliases = options.canonicalizeAliases ?? true;
    this.onTransition = options.onTransition;
    this.onCanonicalTarget = options.onCanonicalTarget;
    this.onError = options.onError;
  }
  get current() {
    return this.hsm.current;
  }
  async start(options = {}) {
    const url = options.url ?? this.history.current().fullPath;
    const result = await this.hsm.transitionUrl(url, {
      ...options,
      cause: "url",
      preserveUnknownQuery: options.preserveUnknownQuery ?? this.preserveUnknownQuery,
      canonicalizeAliases: options.canonicalizeAliases ?? this.canonicalizeAliases,
      strict: false
    });
    this.emitTransition(result);
    if (!result.ok) throw result.error;
    if (options.replace ?? true) {
      this.sync(result.snapshot, { mode: "replace", canonicalizePath: true });
    }
    if (options.listen ?? true) this.listen();
    if (options.canonicalize ?? this.autoCanonicalize) this.applyCanonical(result.snapshot);
    return result.snapshot;
  }
  stop() {
    this.popstate.stop();
  }
  listen() {
    this.popstate.start((location) => {
      void this.syncController.withAsyncLock(async () => {
        try {
          const result = await this.hsm.transitionUrl(location.fullPath, {
            preserveUnknownQuery: this.preserveUnknownQuery,
            canonicalizeAliases: this.canonicalizeAliases,
            cause: "url"
          });
          this.emitTransition(result);
          if (result.ok && this.autoCanonicalize) this.applyCanonical(result.snapshot);
        } catch (error) {
          this.onError?.(error);
        }
      });
    });
  }
  async navigate(stateIdOrUrl, params = {}, options = {}) {
    let input = stateIdOrUrl;
    if (this.hsm.has(stateIdOrUrl)) {
      const hrefOptions = {};
      if (options.context !== void 0) Object.assign(hrefOptions, { context: options.context, includeQueryState: true });
      input = this.hsm.href(stateIdOrUrl, params, hrefOptions);
    }
    const result = await this.hsm.transitionUrl(input, {
      ...options,
      cause: "url",
      preserveUnknownQuery: options.preserveUnknownQuery ?? this.preserveUnknownQuery,
      canonicalizeAliases: options.canonicalizeAliases ?? this.canonicalizeAliases,
      strict: false
    });
    this.emitTransition(result);
    if (result.ok) {
      this.history.commit({
        mode: options.mode ?? "push",
        source: "navigate",
        url: this.snapshotFullPath(result.snapshot),
        state: options.state
      });
      if (options.canonicalize ?? this.autoCanonicalize) this.applyCanonical(result.snapshot);
    }
    return result;
  }
  sync(snapshot = this.requireCurrent(), options = {}) {
    const url = this.snapshotFullPath(snapshot, options.canonicalizePath ?? true);
    return this.syncController.commit(url, {
      mode: options.mode ?? "replace",
      source: "sync",
      state: options.state
    });
  }
  getCanonicalTarget(snapshot = this.requireCurrent()) {
    return this.canonical.targetFor(snapshot);
  }
  applyCanonical(snapshot = this.requireCurrent()) {
    const target = this.canonical.targetFor(snapshot);
    if (!target) return null;
    this.onCanonicalTarget?.(target, snapshot);
    if (target.type === "internal") {
      this.syncController.commit(targetToUrl(target), { mode: "replace", source: "canonical" });
    }
    return target;
  }
  rememberPostAuthRedirect(target) {
    return this.hostPolicy?.rememberPostAuthRedirect(
      target,
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }
  peekSafePostAuthRedirect() {
    return this.hostPolicy?.peekSafePostAuthRedirect(
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }
  consumeSafePostAuthRedirect() {
    return this.hostPolicy?.consumeSafePostAuthRedirect(
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }
  getSocketServerOrigin(stateId) {
    return this.hostPolicy?.getSocketServerOrigin(stateId ?? this.current?.stateId) ?? null;
  }
  getAuthEntryUrl() {
    return this.hostPolicy?.getAuthEntryUrl() ?? null;
  }
  requireCurrent() {
    if (!this.hsm.current) throw new Error("HSM browser runtime has no current snapshot. Call start() first.");
    return this.hsm.current;
  }
  snapshotFullPath(snapshot, canonicalPath = true) {
    if (!snapshot.route) return this.history.current().fullPath;
    const pathname = canonicalPath ? snapshot.route.canonicalPathname || snapshot.route.pathname : snapshot.route.pathname;
    const query2 = snapshot.urlState?.projected ?? snapshot.route.query ?? {};
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query2)) {
      if (value === void 0 || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) search.append(key, String(item));
      } else {
        search.set(key, String(value));
      }
    }
    const serialized = search.toString();
    const hash = snapshot.route.hash ? `#${snapshot.route.hash}` : "";
    return `${pathname}${serialized ? `?${serialized}` : ""}${hash}`;
  }
  emitTransition(result) {
    this.onTransition?.(result);
    if (!result.ok) this.onError?.(result.error);
  }
};
function createHsmBrowserRuntime(options) {
  return new BrowserUrlRuntime(options);
}

// src/vue/symbols.ts
var hsmVueRuntimeKey = /* @__PURE__ */ Symbol("panom-hsm-vue-runtime");

// src/vue/createHsmVue.ts
function readCurrent(hsm) {
  return hsm.current;
}
function updateSnapshot(hsm, snapshot, ready, error, caught) {
  if (caught !== void 0) {
    error.value = caught;
    return;
  }
  snapshot.value = readCurrent(hsm);
  ready.value = snapshot.value !== null;
  error.value = null;
}
function patchAsyncMethod(hsm, methodName, snapshot, ready, error, onError) {
  const target = hsm;
  const original = target[methodName];
  if (typeof original !== "function") return;
  if (original.__panomHsmVuePatched) return;
  const wrapped = async (...args) => {
    try {
      const result = await original.apply(hsm, args);
      const maybeTransition = result;
      if (maybeTransition && typeof maybeTransition === "object" && "ok" in maybeTransition) {
        if (maybeTransition.ok) {
          snapshot.value = maybeTransition.snapshot;
          ready.value = true;
          error.value = null;
        } else {
          updateSnapshot(hsm, snapshot, ready, error, maybeTransition.error);
          onError?.(maybeTransition.error);
        }
      } else {
        updateSnapshot(hsm, snapshot, ready, error);
      }
      return result;
    } catch (caught) {
      updateSnapshot(hsm, snapshot, ready, error, caught);
      onError?.(caught);
      throw caught;
    }
  };
  Object.defineProperty(wrapped, "__panomHsmVuePatched", { value: true });
  target[methodName] = wrapped;
}
function createHsmVueRuntime(options) {
  const snapshot = vue.shallowRef(options.hsm.current);
  const ready = vue.shallowRef(snapshot.value !== null);
  const error = vue.shallowRef(null);
  const runtime = {
    hsm: options.hsm,
    snapshot,
    ready,
    error,
    refresh() {
      updateSnapshot(options.hsm, snapshot, ready, error);
    }
  };
  if (options.bindTransitions ?? true) {
    patchAsyncMethod(options.hsm, "start", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "transition", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "transitionUrl", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "navigate", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "send", snapshot, ready, error, options.onError);
  }
  return runtime;
}
function createHsmVue(options) {
  const runtime = createHsmVueRuntime(options);
  return {
    runtime,
    install(app) {
      app.provide(hsmVueRuntimeKey, runtime);
      app.config.globalProperties.$hsm = runtime.hsm;
    }
  };
}
function useHsmRuntime() {
  const runtime = vue.inject(hsmVueRuntimeKey, null);
  if (!runtime) {
    throw new Error("panom-hsm Vue runtime was not provided. Install createHsmVue({ hsm }) on the app first.");
  }
  return runtime;
}
function useHsm() {
  return useHsmRuntime().hsm;
}
function useHsmState() {
  const runtime = useHsmRuntime();
  return {
    snapshot: runtime.snapshot,
    ready: runtime.ready,
    error: runtime.error,
    stateId: vue.computed(() => runtime.snapshot.value?.stateId ?? null),
    context: vue.computed(() => runtime.snapshot.value?.context ?? null),
    params: vue.computed(() => runtime.snapshot.value?.params ?? null),
    route: vue.computed(() => runtime.snapshot.value?.route ?? null),
    is: (stateId) => runtime.snapshot.value?.is(stateId) ?? false,
    hasTag: (tag) => runtime.snapshot.value?.hasTag(tag) ?? false,
    refresh: runtime.refresh
  };
}
function useHsmPolicy() {
  const runtime = useHsmRuntime();
  return {
    policy: vue.computed(() => runtime.snapshot.value?.policy ?? null),
    layout: vue.computed(() => runtime.snapshot.value?.policy?.layout),
    permissions: vue.computed(() => runtime.snapshot.value?.policy?.permissions ?? []),
    capabilities: vue.computed(() => runtime.snapshot.value?.policy?.capabilities ?? []),
    features: vue.computed(() => runtime.snapshot.value?.policy?.features ?? []),
    can: (permission) => runtime.snapshot.value?.can(permission) ?? false,
    canUse: (capability) => runtime.snapshot.value?.canUse(capability) ?? false,
    feature: (feature) => runtime.snapshot.value?.feature(feature) ?? false
  };
}
var MachineOutlet = vue.defineComponent({
  name: "MachineOutlet",
  props: {
    components: {
      type: Object,
      default: () => ({})
    },
    fallback: {
      type: [Object, Function, String],
      default: null
    }
  },
  setup(props, { slots }) {
    const state = useHsmState();
    const selected = vue.computed(() => {
      const snapshot = state.snapshot.value;
      if (!snapshot) return null;
      return props.components[snapshot.stateId] ?? null;
    });
    return () => {
      const snapshot = state.snapshot.value;
      if (!snapshot) return null;
      const slotProps = { snapshot, stateId: snapshot.stateId };
      if (slots.default) return slots.default(slotProps);
      const component = selected.value ?? props.fallback;
      return component ? vue.h(component, { snapshot, stateId: snapshot.stateId }) : null;
    };
  }
});

// src/devtools/DebugEventBus.ts
var DebugEventBus = class {
  listeners = /* @__PURE__ */ new Set();
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(type, payload) {
    const event = Object.freeze({ type, timestamp: Date.now(), payload });
    for (const listener of this.listeners) listener(event);
    return event;
  }
  clear() {
    this.listeners.clear();
  }
};

// src/devtools/DevtoolsTimeline.ts
var DevtoolsTimeline = class {
  limit;
  eventsInternal = [];
  constructor(options = {}) {
    this.limit = options.limit ?? 500;
  }
  record(event) {
    this.eventsInternal.push(event);
    while (this.eventsInternal.length > this.limit) this.eventsInternal.shift();
    return event;
  }
  events() {
    return Object.freeze([...this.eventsInternal]);
  }
  latest() {
    return this.eventsInternal[this.eventsInternal.length - 1];
  }
  clear() {
    this.eventsInternal.length = 0;
  }
};

// src/devtools/SnapshotInspector.ts
var SnapshotInspector = class {
  inspect(snapshot) {
    const route = snapshot.route ? {
      pathname: snapshot.route.pathname,
      canonicalPathname: snapshot.route.canonicalPathname,
      pattern: snapshot.route.pattern,
      isCanonical: snapshot.route.isCanonical
    } : void 0;
    const policy = snapshot.policy ? {
      ...snapshot.policy.layout ? { layout: snapshot.policy.layout } : {},
      permissions: snapshot.policy.permissions,
      capabilities: snapshot.policy.capabilities,
      features: snapshot.policy.features,
      deniedPermissions: snapshot.policy.deniedPermissions,
      deniedCapabilities: snapshot.policy.deniedCapabilities,
      deniedFeatures: snapshot.policy.deniedFeatures
    } : void 0;
    return Object.freeze({
      stateId: snapshot.stateId,
      activePath: snapshot.activePath,
      params: snapshot.params,
      tags: snapshot.tags,
      ...route ? { route } : {},
      ...policy ? { policy } : {}
    });
  }
};

// src/devtools/TransitionTrace.ts
var TransitionTrace = class {
  startedAt = 0;
  fromStateId = null;
  start(from) {
    this.startedAt = performanceNow();
    this.fromStateId = from?.stateId ?? null;
  }
  finish(result) {
    const durationMs = Math.max(0, performanceNow() - this.startedAt);
    if (result.ok) {
      return Object.freeze({
        fromStateId: this.fromStateId,
        toStateId: result.snapshot.stateId,
        ok: true,
        cause: result.cause,
        durationMs,
        snapshot: result.snapshot
      });
    }
    return Object.freeze({
      fromStateId: result.from?.stateId ?? this.fromStateId,
      toStateId: result.targetStateId ?? null,
      ok: false,
      cause: result.cause,
      durationMs,
      error: result.error
    });
  }
};
function performanceNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

// src/devtools/createHsmDevtools.ts
function createHsmDevtools(hsm, options = {}) {
  const bus = new DebugEventBus();
  const timeline = new DevtoolsTimeline(options.timelineLimit === void 0 ? {} : { limit: options.timelineLimit });
  const inspector = new SnapshotInspector();
  bus.on((event) => {
    timeline.record(event);
    options.logger?.(event);
  });
  const devtools = {
    bus,
    timeline,
    inspector,
    on: (listener) => bus.on(listener),
    events: () => timeline.events(),
    inspect: (snapshot = hsm.current) => snapshot ? inspector.inspect(snapshot) : null,
    clear() {
      timeline.clear();
    }
  };
  if (options.patchMachine ?? true) patchMachine(hsm, bus);
  return devtools;
}
var attachHsmDevtools = createHsmDevtools;
function patchMachine(hsm, bus) {
  patchTransitionMethod(hsm, "transition", bus);
  patchTransitionMethod(hsm, "transitionUrl", bus);
  patchTransitionMethod(hsm, "send", bus);
  const target = hsm;
  const start = target.start;
  if (typeof start === "function" && !start.__panomHsmDevtoolsPatched) {
    const wrapped = async (...args) => {
      bus.emit("transition:start", { method: "start", fromStateId: hsm.current?.stateId ?? null });
      try {
        const snapshot = await start.apply(hsm, args);
        bus.emit("snapshot", { snapshot });
        bus.emit("transition:success", { method: "start", toStateId: snapshot.stateId, snapshot });
        return snapshot;
      } catch (error) {
        bus.emit("error", { method: "start", error });
        throw error;
      }
    };
    Object.defineProperty(wrapped, "__panomHsmDevtoolsPatched", { value: true });
    target.start = wrapped;
  }
}
function patchTransitionMethod(hsm, methodName, bus) {
  const target = hsm;
  const original = target[methodName];
  if (typeof original !== "function") return;
  if (original.__panomHsmDevtoolsPatched) return;
  const wrapped = async (...args) => {
    const trace = new TransitionTrace();
    trace.start(hsm.current);
    bus.emit("transition:start", { method: methodName, fromStateId: hsm.current?.stateId ?? null, args });
    try {
      const result = await original.apply(hsm, args);
      const entry = trace.finish(result);
      if (result.ok) {
        bus.emit("snapshot", { snapshot: result.snapshot });
        bus.emit("transition:success", { method: methodName, trace: entry });
      } else {
        bus.emit("transition:failure", { method: methodName, trace: entry });
      }
      return result;
    } catch (error) {
      bus.emit("error", { method: methodName, error });
      throw error;
    }
  };
  Object.defineProperty(wrapped, "__panomHsmDevtoolsPatched", { value: true });
  target[methodName] = wrapped;
}

exports.ActionRegistry = ActionRegistry;
exports.BackendGuardRegistry = BackendGuardRegistry;
exports.BackendPolicyEnforcer = BackendPolicyEnforcer;
exports.BrowserHistoryAdapter = BrowserHistoryAdapter;
exports.BrowserUrlRuntime = BrowserUrlRuntime;
exports.CanonicalNavigation = CanonicalNavigation;
exports.CapabilityResolver = CapabilityResolver;
exports.DebugEventBus = DebugEventBus;
exports.DevtoolsTimeline = DevtoolsTimeline;
exports.EventDispatcher = EventDispatcher;
exports.FeatureResolver = FeatureResolver;
exports.GuardRegistry = GuardRegistry;
exports.HostPolicyAdapter = HostPolicyAdapter;
exports.HsmBackendRuntime = HsmBackendRuntime;
exports.HsmConfigurationError = HsmConfigurationError;
exports.HsmDuplicateStateError = HsmDuplicateStateError;
exports.HsmError = HsmError;
exports.HsmGuardRejectedError = HsmGuardRejectedError;
exports.HsmMachine = HsmMachine;
exports.HsmMissingGuardError = HsmMissingGuardError;
exports.HsmMissingStateError = HsmMissingStateError;
exports.HsmQueryParseError = HsmQueryParseError;
exports.HsmRedirectLoopError = HsmRedirectLoopError;
exports.HsmRouteBuildError = HsmRouteBuildError;
exports.HsmRouteNotFoundError = HsmRouteNotFoundError;
exports.HsmSchemaError = HsmSchemaError;
exports.HsmSchemaFunctionError = HsmSchemaFunctionError;
exports.HsmSchemaParseError = HsmSchemaParseError;
exports.HsmSchemaValidationError = HsmSchemaValidationError;
exports.HsmUnresolvedStateError = HsmUnresolvedStateError;
exports.LayoutResolver = LayoutResolver;
exports.LoaderRegistry = LoaderRegistry;
exports.LoaderRunner = LoaderRunner;
exports.MachineOutlet = MachineOutlet;
exports.ObjectPath = ObjectPath;
exports.PathComposer = PathComposer;
exports.PathPattern = PathPattern;
exports.PermissionResolver = PermissionResolver;
exports.PolicyEngine = PolicyEngine;
exports.PolicyEvaluator = PolicyEvaluator;
exports.PolicyInheritance = PolicyInheritance;
exports.PopstateListener = PopstateListener;
exports.QueryBinding = QueryBinding;
exports.QueryCodec = QueryCodec;
exports.RedirectSafety = RedirectSafety;
exports.RequestResolver = RequestResolver;
exports.RouteProjection = RouteProjection;
exports.RouteTable = RouteTable;
exports.SchemaCompiler = SchemaCompiler;
exports.SchemaConfigFactory = SchemaConfigFactory;
exports.SchemaSerializer = SchemaSerializer;
exports.SchemaValidator = SchemaValidator;
exports.SnapshotInspector = SnapshotInspector;
exports.StateNode = StateNode;
exports.StateResolver = StateResolver;
exports.StateTree = StateTree;
exports.TransitionAbortController = TransitionAbortController;
exports.TransitionLifecycle = TransitionLifecycle;
exports.TransitionManager = TransitionManager;
exports.TransitionPlanner = TransitionPlanner;
exports.TransitionResultFactory = TransitionResultFactory;
exports.TransitionTrace = TransitionTrace;
exports.UrlStateProjector = UrlStateProjector;
exports.UrlSyncController = UrlSyncController;
exports.UrlTools = UrlTools;
exports.assertValidSchema = assertValidSchema;
exports.attachHsmDevtools = attachHsmDevtools;
exports.compileSchema = compileSchema;
exports.createHostPolicyAdapter = createHostPolicyAdapter;
exports.createHsm = createHsm;
exports.createHsmBackend = createHsmBackend;
exports.createHsmBrowserRuntime = createHsmBrowserRuntime;
exports.createHsmDevtools = createHsmDevtools;
exports.createHsmFromSchema = createHsmFromSchema;
exports.createHsmVue = createHsmVue;
exports.createHsmVueRuntime = createHsmVueRuntime;
exports.createRedirectSafety = createRedirectSafety;
exports.defineHsm = defineHsm;
exports.fromNodeRequest = fromNodeRequest;
exports.hsmExpressMiddleware = hsmExpressMiddleware;
exports.query = query;
exports.requireHsmCapability = requireHsmCapability;
exports.requireHsmFeature = requireHsmFeature;
exports.requireHsmPermission = requireHsmPermission;
exports.requireHsmState = requireHsmState;
exports.requireHsmTag = requireHsmTag;
exports.schemaFromJson = schemaFromJson;
exports.schemaToJson = schemaToJson;
exports.useHsm = useHsm;
exports.useHsmPolicy = useHsmPolicy;
exports.useHsmRuntime = useHsmRuntime;
exports.useHsmState = useHsmState;
exports.validateSchema = validateSchema;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map