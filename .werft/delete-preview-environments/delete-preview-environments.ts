import { Werft } from '../util/werft';
import * as fs from 'fs';
import * as Tracing from '../observability/tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { wipePreviewEnvironmentAndNamespace, helmInstallName } from '../util/kubectl';

// Will be set once tracing has been initialized
let werft: Werft;

const context = JSON.parse(fs.readFileSync('context.json').toString());

Tracing.initialize()
    .then(() => {
        werft = new Werft('delete-preview-environment');
    })
    .then(() => deletePreviewEnvironment())
    .then(() => werft.endAllSpans())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err,
        });
        werft.endAllSpans();
    });

async function deletePreviewEnvironment() {
    werft.phase('preparing deletion');
    const version = parseVersion();
    const namespace = `staging-${version.split('.')[0]}`;
    werft.log('preparing deletion', `Proceeding to delete the ${namespace} namespace`);
    werft.done('preparing deletion');

    werft.phase('delete-preview');
    try {
        await wipePreviewEnvironmentAndNamespace(helmInstallName, namespace, { slice: 'delete-preview' });
    } catch (err) {
        werft.fail('delete-preview', err);
    }
    werft.done('delete-prewview');
}

export function parseVersion() {
    let version = context.Name;
    const PREFIX_TO_STRIP = 'gitpod-delete-preview-environment-';
    if (version.substr(0, PREFIX_TO_STRIP.length) === PREFIX_TO_STRIP) {
        version = version.substr(PREFIX_TO_STRIP.length);
    }
    return version;
}
