import { werft, exec } from './shell';
import { sleep } from './util';

export async function deleteExternalIp(name: string, namespace: string) {
    werft.log("wipe", `address describe returned: ${name}`)
    werft.log("wipe", `found external static IP with matching name ${namespace}, will delete it`)

    const cmd = `gcloud compute addresses delete ${namespace} --region europe-west1 --quiet`
    let attempt = 0;
    for (attempt = 0; attempt < 10; attempt++) {
        let result = exec(cmd);
        if (result.code === 0 && result.stdout.indexOf("Error") == -1) {
            werft.log("wipe", `external ip with name ${namespace} and ip ${name} deleted`);
            break;
        } else {
            werft.log("wipe", `external ip with name ${namespace} and ip ${name} could not be deleted, will reattempt`)
        }
        await sleep(5000)
    }
    if (attempt == 10) {
        werft.log("wipe", `could not delete the external ip with name ${namespace} and ip ${name}`)
    }
}