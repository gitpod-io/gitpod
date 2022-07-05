import { exec } from "./shell";
import { sleep } from "./util";
import { getGlobalWerftInstance } from "./werft";
import { DNS, Record, Zone } from "@google-cloud/dns";
import { GCLOUD_SERVICE_ACCOUNT_PATH } from "../jobs/build/const";

export async function deleteExternalIp(phase: string, name: string, region = "europe-west1") {
    const werft = getGlobalWerftInstance();

    const ip = getExternalIp(name);
    werft.log(phase, `address describe returned: ${ip}`);
    if (ip.indexOf("ERROR:") != -1 || ip == "") {
        werft.log(phase, `no external static IP with matching name ${name} found`);
        return;
    }

    werft.log(phase, `found external static IP with matching name ${name}, will delete it`);
    const cmd = `gcloud compute addresses delete ${name} --region ${region} --quiet`;
    let attempt = 0;
    for (attempt = 0; attempt < 10; attempt++) {
        let result = exec(cmd);
        if (result.code === 0 && result.stdout.indexOf("Error") == -1) {
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

function getExternalIp(name: string, region = "europe-west1") {
    return exec(`gcloud compute addresses describe ${name} --region ${region}| grep 'address:' | cut -c 10-`, {
        silent: true,
    }).trim();
}

export async function createDNSRecord(options: {
    domain: string;
    projectId: string;
    dnsZone: string;
    IP: string;
    slice: string;
}): Promise<void> {
    const werft = getGlobalWerftInstance();

    const dnsClient = new DNS({
        projectId: options.projectId,
        keyFilename: GCLOUD_SERVICE_ACCOUNT_PATH,
    });
    const zone = dnsClient.zone(options.dnsZone);

    if (!(await matchesExistingRecord(zone, options.domain, options.IP))) {
        await createOrReplaceRecord(zone, options.domain, options.IP, options.slice);
    } else {
        werft.log(options.slice, `DNS Record already exists for domain ${options.domain}`);
    }
}

export async function deleteDNSRecord(
    recordType: string,
    domain: string,
    projectId: string,
    dnsZone: string,
    slicdeID: string,
): Promise<void> {
    const werft = getGlobalWerftInstance();

    const dnsClient = new DNS({
        projectId: projectId,
        keyFilename: GCLOUD_SERVICE_ACCOUNT_PATH,
    });
    const zone = dnsClient.zone(dnsZone);
    const [records] = await zone.getRecords({ name: `${domain}.`, type: recordType });

    werft.log(slicdeID, `Found ${records.length} for ${domain}`);

    await Promise.all(
        records.map((record) => {
            werft.log(slicdeID, `Deleting ${record.metadata.name}`);
            return record.delete();
        }),
    );
}

// matchesExistingRecord will return true only if the existing record matches the same name and IP.
// If IP doesn't match, then the record needs to be replaced in a following step.
async function matchesExistingRecord(zone: Zone, domain: string, IP: string): Promise<boolean> {
    const [records] = await zone.getRecords({ name: `${domain}.` });

    if (records.length == 0) {
        return false;
    }

    let matches = false;
    records.every((record) => {
        if (record.metadata.name == `${domain}.` && record.data == IP) {
            matches = true;
            return false; // Works as a 'break'
        }
        return true;
    });
    return matches;
}

async function createOrReplaceRecord(zone: Zone, domain: string, IP: string, slice: string): Promise<void> {
    const werft = getGlobalWerftInstance();
    const record = new Record(zone, "a", {
        name: `${domain}.`,
        ttl: 300,
        data: IP,
    });

    const [records] = await zone.getRecords({ name: `${domain}.` });
    await Promise.all(
        records.map((record) => {
            werft.log(slice, `Deleting old record for ${record.metadata.name} due to IP mismatch.`);
            return record.delete();
        }),
    );

    werft.log(slice, `Creating DNS record: ${JSON.stringify(record)}`); // delete before submiting PR
    await zone.addRecords(record);
}
