import { Span, Tracer, trace, context, SpanStatusCode } from '@opentelemetry/api';
import { exec } from './shell';

let werft: Werft;

/**
 * For backwards compatibility with existing code we expose a global Werft instance
 */
export function getGlobalWerftInstance() {
    if (!werft) {
        throw new Error("Trying to fetch global Werft instance but it hasn't been instantiated yet")
    }
    return werft
}

/**
 * Class for producing Werft compatible log output and generating traces
 */
export class Werft {
    private tracer: Tracer;
    public rootSpan: Span;
    private sliceSpans: { [slice: string]: Span } = {}
    private currentPhaseSpan: Span;

    constructor(job: string) {
        if (werft) {
            throw new Error("Only one Werft instance should be instantiated per job")
        }
        this.tracer = trace.getTracer("default");
        this.rootSpan = this.tracer.startSpan(`job: ${job}`, { root: true, attributes: { 'werft.job.name': job } });

        // Expose this instance as part of getGlobalWerftInstance
        werft = this;
    }

    public phase(name, desc?: string) {
        // When you start a new phase the previous phase is implicitly closed.
        if (this.currentPhaseSpan) {
            this.endPhase()
        }

        const rootSpanCtx = trace.setSpan(context.active(), this.rootSpan);
        this.currentPhaseSpan = this.tracer.startSpan(`phase: ${name}`, {
            attributes: {
                'werft.phase.name': name,
                'werft.phase.description': desc
            }
        }, rootSpanCtx)

        console.log(`[${name}|PHASE] ${desc || name}`)
    }

    public log(slice, msg) {
        if (!this.sliceSpans[slice]) {
            const parentSpanCtx = trace.setSpan(context.active(), this.currentPhaseSpan);
            const sliceSpan = this.tracer.startSpan(`slice: ${slice}`, undefined, parentSpanCtx)
            this.sliceSpans[slice] = sliceSpan
        }
        console.log(`[${slice}] ${msg}`)
    }

    public logOutput(slice, cmd) {
        cmd.toString().split("\n").forEach((line: string) => this.log(slice, line))
    }

    public fail(slice, err) {
        // Set the status on the span for the slice and also propagate the status to the phase and root span
        // as well so we can query on all phases that had an error regardless of which slice produced the error.
        [this.sliceSpans[slice], this.rootSpan, this.currentPhaseSpan].forEach((span: Span) => {
            if (!span) {
                return
            }
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err
            })
        })

        this.endAllSpans()

        console.log(`[${slice}|FAIL] ${err}`);
        throw err;
    }

    public done(slice: string) {
        const span = this.sliceSpans[slice]
        if (span) {
            span.end()
            delete this.sliceSpans[slice]
        }
        console.log(`[${slice}|DONE]`)
    }

    public result(description: string, channel: string, value: string) {
        exec(`werft log result -d "${description}" -c "${channel}" ${value}`);
    }

    private endPhase() {
        // End all open slices
        Object.entries(this.sliceSpans).forEach((kv) => {
            const [id, span] = kv
            span.end()
            delete this.sliceSpans[id]
        })
        // End the phase
        this.currentPhaseSpan.end()
    }

    public endAllSpans() {
        this.endPhase()
        this.rootSpan.end()
    }
}
