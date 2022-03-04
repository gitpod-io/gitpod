import { Metadata, credentials } from "@grpc/grpc-js";
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector-grpc";

/**
 * Initialize tracing and wait for it to be ready.
 *
 * Registers a beforeExit event handler to gracefully flush traces upon exit.
 */
export async function initialize() {

    const metadata = new Metadata()
    metadata.set('x-honeycomb-team', process.env.HONEYCOMB_API_KEY);
    metadata.set('x-honeycomb-dataset', process.env.HONEYCOMB_DATASET);
    const traceExporter = new CollectorTraceExporter({
        url: 'grpc://api.honeycomb.io:443/',
        credentials: credentials.createSsl(),
        metadata
    });

    const sdk = new NodeSDK({
        resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: 'werft',
        }),
        traceExporter,
        instrumentations: [getNodeAutoInstrumentations()]
    });

    console.log('Initializing tracing')
    try {
        await sdk.start()
    } catch (err) {
        console.log('Error initializing tracing', err)
        process.exit(1)
    }

    process.on('beforeExit', (code) => {
        console.log(`About to exit with code ${code}. Shutting down tracing.`)
        sdk.shutdown()
            .then(() => console.log('Tracing terminated'))
            .catch((error) => console.log('Error terminating tracing', error))
    })
}
