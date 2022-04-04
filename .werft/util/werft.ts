import { Span, Tracer, trace, context, SpanStatusCode, SpanAttributes } from '@opentelemetry/api';
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
    public currentPhase: string;
    public currentPhaseSpan: Span;
    private globalSpanAttributes: SpanAttributes = {}

    public phases: { [name: string]: { "slices": { [name: string]: { "closed": boolean } } } } = {}

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

        // Check if the phase does already exist
        if (this.phases[name]) {
            throw new Error(`The phase "${name}" does already exist!`)
        }

        // This is a workaround to prevent phases being opened without any slice
        this.phases[name] = { "slices": { } }
        this.currentPhase = name;

        const rootSpanCtx = trace.setSpan(context.active(), this.rootSpan);
        this.currentPhaseSpan = this.tracer.startSpan(`phase: ${name}`, {
            attributes: {
                'werft.phase.name': name,
                'werft.phase.description': desc
            }
        }, rootSpanCtx)
        this.currentPhaseSpan.setAttributes(this.globalSpanAttributes)

        console.log(`[${name}|PHASE] ${desc || name}`)
    }

    private sliceBelongsToCurrentPhase(slice) {
        for (const [name, phase] of Object.entries(this.phases)) {
            if(phase.slices[slice] && (name != this.currentPhase))
                throw new Error(`The slice ${slice} does not belong to the phase ${name}`);
        }
    }

    public log(slice, msg) {
        this.sliceBelongsToCurrentPhase(slice);
        if (!this.sliceSpans[slice]) {
            const parentSpanCtx = trace.setSpan(context.active(), this.currentPhaseSpan);
            const sliceSpan = this.tracer.startSpan(`slice: ${slice}`, undefined, parentSpanCtx)
            sliceSpan.setAttributes(this.globalSpanAttributes)
            this.sliceSpans[slice] = sliceSpan
        }
        // Create a new slice in the current phase when it does not already exist
        // This is the case if werft.done("PHASE") is directly invoked without any prior log
        if (!this.phases[this.currentPhase].slices[slice])
            this.phases[this.currentPhase].slices[slice] = { "closed": false };
        // Check if the slice has already been closed
        if (this.phases[this.currentPhase].slices[slice].closed)
            throw new Error(`The slice "${slice}" has already been closed!`);

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
        // Create a new slice entry that is already closed if no prior entry exists
        if (!this.phases[this.currentPhase].slices[slice]) {
            this.phases[this.currentPhase].slices[slice] = { "closed": true };
        } else if (this.phases[this.currentPhase].slices[slice].closed) {
            throw new Error(`The slice "${slice}" has already been closed!`);
        } else {
            this.phases[this.currentPhase].slices[slice].closed = true;
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
        // Check if all slices are closed
        let check = true;
        for (const [name, slice] of Object.entries(this.phases[this.currentPhase].slices)) {
            if(!slice.closed) {
                console.log(`The slice "${name}" has not been closed!`);
                check = false;
            }
        }
        if (!check) {
            throw new Error(`Not all slices inside the phase "${this.currentPhase}" have been closed!`)
        }
        // End the phase
        this.currentPhaseSpan.end()
    }

    public endAllSpans() {
        const traceID = this.rootSpan.spanContext().traceId
        const nowUnix =  Math.round(new Date().getTime() / 1000);
        // At the moment we're just looking for traces in a 30 minutes timerange with the specific traceID
        // A smarter approach would be to get a start timestamp from tracing.Initialize()
        exec(`werft log result -d "Honeycomb trace" -c github-check-honeycomb-trace url "https://ui.honeycomb.io/gitpod/datasets/werft/trace?trace_id=${traceID}&trace_start_ts=${nowUnix - 1800}&trace_end_ts=${nowUnix + 5}"`);
        this.endPhase()
        this.rootSpan.end()
    }

    /**
     * This allows you to set attributes on all open and future Werft spans.
     * Any spans in phases that have already been closed won't get the attributes.
     */
    public addAttributes(attributes: SpanAttributes): void {

        // Add the attributes to the root span.
        this.rootSpan.setAttributes(attributes)

        // Set the attribute on all spans for the current phase.
        this.currentPhaseSpan.setAttributes(attributes)
        Object.entries(this.sliceSpans).forEach((kv) => {
            const [_, span] = kv
            span.setAttributes(attributes)
        })

        this.globalSpanAttributes = {...this.globalSpanAttributes, ...attributes}
    }
}
