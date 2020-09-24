import { TypescriptParser } from 'typescript-parser';

(async () => {
    const parser = new TypescriptParser();
    return JSON.stringify(await parser.parseFiles(["src/gitpod-service.ts", "src/protocol.ts", "src/workspace-instance.ts"], ".."));
})().then(console.log).catch(console.error);
