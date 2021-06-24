import * as fs from 'fs';
import { werft, exec } from './util/shell';

const context = JSON.parse(fs.readFileSync('context.json').toString());
const config = context.Annotations || {};

let username = config.username;
if (username === "<no value>") {
    username = "";
}
werft.log('prep', `using username: ${username}`);
werft.log('prep', `using namespace: ${config.namespace}`);
werft.done('prep');

try {
    exec(`/entrypoint.sh -kubeconfig=/config/kubeconfig -namespace=${config.namespace} -username=${username} 2>&1`, { slice: 'int-tests' });
    werft.done('int-tests');
} catch (err)  {
    werft.fail('int-tests', err);
}