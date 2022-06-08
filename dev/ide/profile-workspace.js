/**
 * Run node ./dev/ide/capture-ws-top.js to profile cpu and memory usage of the workspace.
 *
 */
//@ts-check

const { execSync } = require("child_process");
const { promises } = require("fs");
const fetch = require("node-fetch");
const path = require("path");

/**
 * @param {number[]} arr
 * @returns {number}
 */
const q90 = (arr) => {
    const sorted = arr.sort((a, b) => a - b);
    const pos = (sorted.length - 1) * 0.9;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

(async () => {
    let wsPodName;
    let creationTimestamp;
    while (!wsPodName) {
        const segments = execSync(
            "kubectl get pod -l component=workspace -o=custom-columns=:metadata.name,:metadata.creationTimestamp",
            {
                encoding: "utf8",
            },
        )
            .trim()
            .split(/\s+/);
        wsPodName = segments[0];
        creationTimestamp = new Date(segments[1]);
        await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(wsPodName);
    console.log(creationTimestamp);

    const query = async (prefix) => {
        const age = ((new Date().getTime() - creationTimestamp.getTime()) / 1000).toFixed(0);
        const response = await fetch.default(
            encodeURI(`http://localhost:9090/api/v1/query?query=${prefix}{pod="${wsPodName}"}[${age}s])/(1024*1024)`),
            {
                method: "GET",
            },
        );
        if (!response.ok) {
            console.error(`${prefix}: ${response.statusText} (${response.status})`);
            return "N/A";
        }
        /**
         * @type {{data: {result: { value: [number, string] }[]}}}
         */
        const body = await response.json();
        return Number(body.data.result[0].value[1]).toFixed(2);
    };

    const perfLogPath = path.resolve(__dirname, "perf.log");
    console.log(perfLogPath);
    const start = new Date().getTime();
    await promises.writeFile(perfLogPath, wsPodName + "\n", { encoding: "utf8" });
    let measurements = 0;
    const cores = [];
    const mems = [];
    let avgCores = 0;
    let maxCores = 0;
    let sumCores = 0;
    let avgMemory = 0;
    let maxMemory = 0;
    let sumMemory = 0;
    while (true) {
        measurements++;

        /**
         * @type {{memory: {used: number, limit: number}, cpu: {used: number, limit: number}} | undefined}
         */
        let top;
        try {
            const content = execSync(`kubectl exec -t ${wsPodName} -- /.supervisor/supervisor top -sj`, {
                encoding: "utf8",
            }).trim();
            const value = JSON.parse(content);
            if ("memory" in value && "cpu" in value) {
                top = value;
            }
        } catch (e) {
            console.error(e);
        }

        if (top) {
            cores.push(top.cpu.used);
            sumCores += top.cpu.used;
            avgCores = sumCores / measurements;
            maxCores = Math.max(maxCores, top.cpu.used);

            const mem = top.memory.used / (1024 * 1024);
            mems.push(mem);
            sumMemory += mem;
            avgMemory = sumMemory / measurements;
            maxMemory = Math.max(maxMemory, mem);

            const [avgMax, maxMax, q90Max, avgUsed, maxUsed, q90user] = (
                await Promise.allSettled([
                    query("avg_over_time(gitpod_jb_backend_memory_max_bytes"),
                    query("max_over_time(gitpod_jb_backend_memory_max_bytes"),
                    query("quantile_over_time(0.9, gitpod_jb_backend_memory_max_bytes"),
                    query("avg_over_time(gitpod_jb_backend_memory_used_bytes"),
                    query("max_over_time(gitpod_jb_backend_memory_used_bytes"),
                    query("quantile_over_time(0.9, gitpod_jb_backend_memory_used_bytes"),
                ])
            ).map((v) => {
                if (v.status === "fulfilled") {
                    return v.value;
                }
                console.error(v.reason);
                return "N/A";
            });

            await promises.appendFile(
                perfLogPath,
                `${((new Date().getTime() - start) / 1000).toFixed(2)}s, cpu(m) ${top.cpu.used.toFixed(
                    2,
                )}/${avgCores.toFixed(2)}/${maxCores.toFixed(2)}/${q90(cores).toFixed(2)}, memory(Mi) ${mem.toFixed(
                    2,
                )}/${avgMemory.toFixed(2)}/${maxMemory.toFixed(2)}/${q90(mems).toFixed(
                    2,
                )}, allocated(M) ${avgMax}/${maxMax}/${q90Max}, used(M) ${avgUsed}/${maxUsed}/${q90user}\n`,
            );
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
})();
