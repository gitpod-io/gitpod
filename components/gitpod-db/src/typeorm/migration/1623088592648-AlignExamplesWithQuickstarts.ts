import {MigrationInterface, QueryRunner} from "typeorm";

export class AlignExamplesWithQuickstarts1623088592648 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const newEntries = [
            { url: 'https://github.com/gitpod-io/example-typescript-node', description: 'A project template for Node.js or TypeScript applications', priority: 90 },
            { url: 'https://github.com/gitpod-io/example-golang-cli', description: 'A project template for Go applications', priority: 80 },
            { url: 'https://github.com/gitpod-io/example-rust-cli', description: 'A project template for Rust applications', priority: 70 },
            { url: 'https://github.com/gitpod-io/spring-petclinic', description: 'A project template for Java applications', priority: 60 },
            { url: 'https://github.com/gitpod-io/sveltejs-template', description: 'A project template for Svelte applications', priority: 50 },
        ]
        // delete old entries
        await queryRunner.query("DELETE FROM d_b_repository_white_list");
        const insert = `INSERT IGNORE INTO d_b_repository_white_list (url, description, priority) VALUES ${newEntries.map(e=>'(?, ?, ?)').join(', ')}`;
        const values: any[] = [];
        for (const e of newEntries) {
            values.push(e.url, e.description, e.priority);
        }
        await queryRunner.query(insert, values);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}
