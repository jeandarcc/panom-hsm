import { a as AnyRecord, w as HsmMachineConfig, v as HsmMachine, W as HsmResolvedState, V as HsmResolvedRedirect, a0 as HsmSnapshot } from './HsmMachine-CnF_DNIZ.cjs';

declare function createHsm<TContext extends AnyRecord = AnyRecord>(config: HsmMachineConfig<TContext>): HsmMachine<TContext>;

declare class SnapshotFactory<TContext extends AnyRecord = AnyRecord> {
    private readonly machineId;
    constructor(machineId: string);
    create(resolved: HsmResolvedState<TContext>, redirect?: HsmResolvedRedirect): HsmSnapshot<TContext>;
    private freezeRecord;
    private freezePolicy;
    private toStateValue;
}

export { SnapshotFactory as S, createHsm as c };
