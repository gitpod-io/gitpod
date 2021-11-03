import { Werft } from './util/werft'
import { wipePreviewEnvironment, listAllPreviewNamespaces } from './util/kubectl';
import * as fs from 'fs';
import { deleteExternalIp } from './util/gcloud';
import * as Tracing from './observability/tracing'
import { SpanStatusCode } from '@opentelemetry/api';

// Will be set once tracing has been initialized
let werft: Werft

async function wipePreviewCluster(pathToKubeConfig: string) {
    const namespace_raw = process.env.NAMESPACE;
    const namespaces: string[] = [];
    if (namespace_raw === "<no value>" || !namespace_raw) {
        werft.log('wipe', "Going to wipe all namespaces");
        listAllPreviewNamespaces(pathToKubeConfig)
            .map(ns => namespaces.push(ns));
    } else {
        werft.log('wipe', `Going to wipe namespace ${namespace_raw}`);
        namespaces.push(namespace_raw);
    }

    for (const namespace of namespaces) {
        await wipePreviewEnvironment(pathToKubeConfig, "gitpod", namespace, { slice: 'wipe' });
    }
}

// if we have "/workspace/k3s-external.yaml" present that means a k3s ws cluster
// exists, therefore, delete corresponding preview deployment from that cluster too
// NOTE: Even for a non k3s ws deployment we will attempt to clean the preview.
// This saves us from writing complex logic of querying meta cluster for registered workspaces
// Since we use the same namespace to deploy in both dev and k3s cluster, this is safe
async function k3sCleanup() {
    if (fs.existsSync("/workspace/k3s-external.yaml")) {
        werft.log("wipe", "found /workspace/k3s-external.yaml, assuming k3s ws cluster deployment exists, will attempt to wipe it")
        await wipePreviewCluster("/workspace/k3s-external.yaml")
        const namespace_raw = process.env.NAMESPACE;

        // Since werft creates static external IP for ws-proxy of k3s using gcloud
        // we delete it here. We retry because the ws-proxy-service which binds to this IP might not be deleted immediately
        /* no await */ deleteExternalIp("wipe", namespace_raw || "not-set");
    } else {
        werft.log("wipe", `file /workspace/k3s-external.yaml does not exist, no cleanup for k3s cluster`)
    }
}

// clean up the dev cluster in gitpod-core-dev
async function devCleanup() {
    await wipePreviewCluster("")
}

// sweeper runs in the dev cluster so we need to delete the k3s cluster first and then delete self contained namespace

Tracing.initialize()
    .then(() => {
        werft = new Werft("wipe-devstaging")
        werft.phase('wipe')
    })
    .then(() => k3sCleanup())
    .then(() => devCleanup())
    .then(() => werft.done('wipe'))
    .then(() => werft.endAllSpans())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err
        })
        werft.endAllSpans()
        console.log('Error', err)
        // Explicitly not using process.exit as we need to flush tracing, see tracing.js
        process.exitCode = 1
    });
