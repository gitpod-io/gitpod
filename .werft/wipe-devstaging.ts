import { werft } from './util/shell';
import { wipePreviewEnvironment, listAllPreviewNamespaces } from './util/kubectl';


async function wipeDevstaging() {
    const namespace_raw = process.env.NAMESPACE;
    const namespaces: string[] = [];
    if (namespace_raw === "<no value>" || !namespace_raw) {
        werft.log('wipe', "Going to wipe all namespaces");
        listAllPreviewNamespaces()
            .map(ns => namespaces.push(ns));
    } else {
        werft.log('wipe', `Going to wipe namespace ${namespace_raw}`);
        namespaces.push(namespace_raw);
    }

    for (const namespace of namespaces) {
        await wipePreviewEnvironment("gitpod", namespace, { slice: 'wipe' });
    }
    werft.done('wipe');
}

wipeDevstaging()