/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import {MigrationInterface, QueryRunner} from "typeorm";

 export class UpdateStarters1623068132817 implements MigrationInterface {

     public async up(queryRunner: QueryRunner): Promise<any> {
         const newEntries = [
             { url: 'https://github.com/gitpod-io/example-typescript-node', description: 'A Node.js app written in TypeScript.', priority: 90 },
             { url: 'https://github.com/gitpod-io/example-python-django', description: 'A Django app written in Python. ', priority: 70 },
             { url: 'https://github.com/gitpod-io/example-golang-cli', description: 'A CLI starter written in Go.', priority: 40 },
             { url: 'https://github.com/gitpod-io/example-rust-cli', description: 'A CLI starter written in Rust.', priority: 30 },
             { url: 'https://github.com/gitpod-io/spring-petclinic', description: 'A Spring app written in Java.', priority: 20 },
             { url: 'https://github.com/gitpod-io/sveltejs-template', description: 'A Svelte.js app writtten in JavaScript', priority: 10 },
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
