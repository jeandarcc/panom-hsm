export class TransitionAbortController {
  private active: AbortController | null = null;

  public next(externalSignal?: AbortSignal): AbortController {
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

  public clear(controller: AbortController): void {
    if (this.active === controller) this.active = null;
  }

  public cancel(reason?: unknown): void {
    if (!this.active || this.active.signal.aborted) return;
    this.active.abort(reason);
  }
}
