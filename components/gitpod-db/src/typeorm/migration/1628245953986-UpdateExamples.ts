/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import {MigrationInterface, QueryRunner} from "typeorm";

 export class UpdateExamples1628245953986 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<any> {
         let priority = 90;
         const newEntries = [
             { url: 'https://github.com/gitpod-io/template-c', description: 'A C template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-cpp', description: 'A C++ template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-clojure', description: 'A Clojure template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-coq', description: 'A Coq template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-datasette', description: 'A Datasette template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-docker-compose', description: 'A Docker Compose template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-dotnet-core-cli-csharp', description: 'A CLI starter for .NET written in C#.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-golang-cli', description: 'A CLI template, written in Go.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-clion', description: 'The Jetbrains CLion IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-datagrip', description: 'The Jetbrains DataGrip IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-goland', description: 'The Jetbrains GoLand IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-intellij-idea', description: 'The Jetbrains IntelliJ IDEA IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-phpstorm', description: 'The Jetbrains PhpStorm IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-pycharm', description: 'The Jetbrains PyCharm IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-rider', description: 'The Jetbrains Rider IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-rubymine', description: 'The Jetbrains RubyMine IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-jetbrains-webstorm', description: 'The Jetbrains WebStorm IDE.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-grain', description: 'A Grain template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-haskell', description: 'A Haskell template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-hy', description: 'A Hy template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/spring-petclinic', description: 'A Spring app written in Java.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-julia', description: 'A Julia template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-nextjs', description: 'A Nextjs template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-nix', description: 'A nix template for incredibly reproducible development environments.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-perl', description: 'A Perl template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-php-drupal-ddev', description: 'A Drupal app template, scaffolded by DDEV.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-php-laravel-mysql', description: 'A Laravel app template, with MySQL.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-python-django', description: 'A Django app template. ', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-python-flask', description: 'A Flasker app template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-ruby-on-rails', description: 'A Ruby on Rails app template, with Postgres. ', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-rust-cli', description: 'A CLI template, written in Rust.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-scala', description: 'A Scala template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-sveltejs', description: 'A Svelte.js app writtten in JavaScript.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-sveltekit', description: 'A SvelteKit app template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-tlaplus', description: 'A TLA+ template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-typescript-node', description: 'A Node.js app, written in TypeScript.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-typescript-react', description: 'A create-react-app template, written in TypeScript.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-wordpress', description: 'A wordpress development environment template.', priority: priority-- },
             { url: 'https://github.com/gitpod-io/template-x11-vnc', description: 'A X11 template with VNC for graphical development environments.', priority: priority-- },

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