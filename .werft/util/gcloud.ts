import { exec } from './shell';
import { sleep } from './util';
import { getGlobalWerftInstance } from './werft';

export async function deleteExternalIp(phase: string, name: string, region = 'europe-west1') {
    const werft = getGlobalWerftInstance();

    const ip = getExternalIp(name);
    werft.log(phase, `address describe returned: ${ip}`);
    if (ip.indexOf('ERROR:') != -1 || ip == '') {
        werft.log(phase, `no external static IP with matching name ${name} found`);
        return;
    }

    werft.log(phase, `found external static IP with matching name ${name}, will delete it`);
    const cmd = `gcloud compute addresses delete ${name} --region ${region} --quiet`;
    let attempt = 0;
    for (attempt = 0; attempt < 10; attempt++) {
        let result = exec(cmd);
        if (result.code === 0 && result.stdout.indexOf('Error') == -1) {
            werft.log(phase, `external ip with name ${name} and ip ${ip} deleted`);
            break;
        } else {
            werft.log(phase, `external ip with name ${name} and ip ${ip} could not be deleted, will reattempt`);
        }
        await sleep(5000);
    }
    if (attempt == 10) {
        werft.log(phase, `could not delete the external ip with name ${name} and ip ${ip}`);
    }
}

function getExternalIp(name: string, region = 'europe-west1') {
    return exec(`gcloud compute addresses describe ${name} --region ${region}| grep 'address:' | cut -c 10-`, {
        silent: true,
    }).trim();
}
