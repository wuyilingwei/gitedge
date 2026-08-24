// Keep the proven upstream Git protocol Worker as the transport implementation.
// This wrapper gives the internal service its own deployable entrypoint without
// copying or forking protocol, pack, DO, R2, D1, or Queue logic.
export { default } from "../../../src/worker/index";
export { RepoDurableObject } from "../../../src/worker/index";
