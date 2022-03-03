import * as shell from 'shelljs';
import { exec } from '../../util/shell';
import { Werft } from '../../util/werft';
import { GCLOUD_SERVICE_ACCOUNT_PATH } from './const';

export async function prepare(werft: Werft) {
    werft.phase('prepare');

    const werftImg = shell.exec('cat .werft/build.yaml | grep dev-environment').trim().split(': ')[1];
    const devImg = shell.exec('yq r .gitpod.yml image').trim();
    if (werftImg !== devImg) {
        werft.fail('prep', `Werft job image (${werftImg}) and Gitpod dev image (${devImg}) do not match`);
    }

    try {
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        exec('gcloud auth configure-docker --quiet');
        exec('gcloud auth configure-docker europe-docker.pkg.dev --quiet');
        exec('gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev');
        werft.done('prep');
    } catch (err) {
        werft.fail('prep', err);
    }
}
