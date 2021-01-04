/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as assert from 'assert';
import { suite, test } from "mocha-typescript"

import URI from '@theia/core/lib/common/uri';
import { parseLocalhost } from './gitpod-parse-localhost';

@suite
export class GitpodParseLocalhostTest {

    protected assertParseLocalhost({ uri, expected }: {
        uri: string
        expected: {
            address: string
            port: number
        } | undefined
    }): void {
        const localhost = parseLocalhost(new URI(uri));
        const address = localhost && localhost.address;
        assert.strictEqual(address, expected && expected.address);
        const port = localhost && localhost.port;
        assert.strictEqual(port, expected && expected.port);
    }

    @test()
    parseLocalhost_http(): void {
        this.assertParseLocalhost({
            uri: 'http://localhost/test',
            expected: {
                address: 'localhost',
                port: 80
            }
        });
    }

    @test()
    parseLocalhost_https(): void {
        this.assertParseLocalhost({
            uri: 'https://localhost/test',
            expected: {
                address: 'localhost',
                port: 443
            }
        });
    }

    @test()
    parseLocalhost_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://localhost:8080/test',
            expected: {
                address: 'localhost',
                port: 8080
            }
        });
    }

    @test()
    parseLocalhost_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://localhost:8080/test',
            expected: {
                address: 'localhost',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_loopback_http(): void {
        this.assertParseLocalhost({
            uri: 'http://127.0.0.1/test',
            expected: {
                address: '127.0.0.1',
                port: 80
            }
        });
    }

    @test()
    parseIPV4_loopback_https(): void {
        this.assertParseLocalhost({
            uri: 'https://127.0.0.1/test',
            expected: {
                address: '127.0.0.1',
                port: 443
            }
        });
    }

    @test()
    parseIPV4_loopback_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://127.0.0.1:8080/test',
            expected: {
                address: '127.0.0.1',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_loopback_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://127.0.0.1:8080/test',
            expected: {
                address: '127.0.0.1',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_loopback_permutation_http(): void {
        this.assertParseLocalhost({
            uri: 'http://127.255.255.254/test',
            expected: {
                address: '127.255.255.254',
                port: 80
            }
        });
    }

    @test()
    parseIPV4_loopback_permutation_https(): void {
        this.assertParseLocalhost({
            uri: 'https://127.255.255.254/test',
            expected: {
                address: '127.255.255.254',
                port: 443
            }
        });
    }

    @test()
    parseIPV4_loopback_permutation_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://127.255.255.254:8080/test',
            expected: {
                address: '127.255.255.254',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_loopback_permutation_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://127.255.255.254:8080/test',
            expected: {
                address: '127.255.255.254',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_all_http(): void {
        this.assertParseLocalhost({
            uri: 'http://0.0.0.0/test',
            expected: {
                address: '0.0.0.0',
                port: 80
            }
        });
    }

    @test()
    parseIPV4_all_https(): void {
        this.assertParseLocalhost({
            uri: 'https://0.0.0.0/test',
            expected: {
                address: '0.0.0.0',
                port: 443
            }
        });
    }

    @test()
    parseIPV4_all_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://0.0.0.0:8080/test',
            expected: {
                address: '0.0.0.0',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_all_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://0.0.0.0:8080/test',
            expected: {
                address: '0.0.0.0',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_all_permutation_http(): void {
        this.assertParseLocalhost({
            uri: 'http://000.000.000.000/test',
            expected: {
                address: '000.000.000.000',
                port: 80
            }
        });
    }

    @test()
    parseIPV4_all_permutation_https(): void {
        this.assertParseLocalhost({
            uri: 'https://000.000.000.000/test',
            expected: {
                address: '000.000.000.000',
                port: 443
            }
        });
    }

    @test()
    parseIPV4_all_permutation_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://000.000.000.000:8080/test',
            expected: {
                address: '000.000.000.000',
                port: 8080
            }
        });
    }

    @test()
    parseIPV4_all_permutation_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://000.000.000.000:8080/test',
            expected: {
                address: '000.000.000.000',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_loopback_http(): void {
        this.assertParseLocalhost({
            uri: 'http://[::1]/test',
            expected: {
                address: '::1',
                port: 80
            }
        });
    }

    @test()
    parseIPV6_loopback_https(): void {
        this.assertParseLocalhost({
            uri: 'https://[::1]/test',
            expected: {
                address: '::1',
                port: 443
            }
        });
    }

    @test()
    parseIPV6_loopback_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://[::1]:8080/test',
            expected: {
                address: '::1',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_loopback_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://[::1]:8080/test',
            expected: {
                address: '::1',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_loopback_permutation_http(): void {
        this.assertParseLocalhost({
            uri: 'http://[0000:0000:0000:0000:0000:0000:0000:0001]/test',
            expected: {
                address: '0000:0000:0000:0000:0000:0000:0000:0001',
                port: 80
            }
        });
    }

    @test()
    parseIPV6_loopback_permutation_https(): void {
        this.assertParseLocalhost({
            uri: 'https://[0000:0000:0000:0000:0000:0000:0000:0001]/test',
            expected: {
                address: '0000:0000:0000:0000:0000:0000:0000:0001',
                port: 443
            }
        });
    }

    @test()
    parseIPV6_loopback_permutation_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://[0000:0000:0000:0000:0000:0000:0000:0001]:8080/test',
            expected: {
                address: '0000:0000:0000:0000:0000:0000:0000:0001',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_loopback_permutation_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://[0000:0000:0000:0000:0000:0000:0000:0001]:8080/test',
            expected: {
                address: '0000:0000:0000:0000:0000:0000:0000:0001',
                port: 8080
            }
        });
    }



    @test()
    parseIPV6_all_http(): void {
        this.assertParseLocalhost({
            uri: 'http://[::]/test',
            expected: {
                address: '::',
                port: 80
            }
        });
    }

    @test()
    parseIPV5_all_https(): void {
        this.assertParseLocalhost({
            uri: 'https://[::]/test',
            expected: {
                address: '::',
                port: 443
            }
        });
    }

    @test()
    parseIPV6_all_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://[::]:8080/test',
            expected: {
                address: '::',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_all_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://[::]:8080/test',
            expected: {
                address: '::',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_all_permutation_http(): void {
        this.assertParseLocalhost({
            uri: 'http://[0:0:0:0:0:0:0:0]/test',
            expected: {
                address: '0:0:0:0:0:0:0:0',
                port: 80
            }
        });
    }

    @test()
    parseIPV6_all_permutation_https(): void {
        this.assertParseLocalhost({
            uri: 'https://[0:0:0:0:0:0:0:0]/test',
            expected: {
                address: '0:0:0:0:0:0:0:0',
                port: 443
            }
        });
    }

    @test()
    parseIPV6_all_permutation_http_port(): void {
        this.assertParseLocalhost({
            uri: 'http://[0:0:0:0:0:0:0:0]:8080/test',
            expected: {
                address: '0:0:0:0:0:0:0:0',
                port: 8080
            }
        });
    }

    @test()
    parseIPV6_all_permutation_https_port(): void {
        this.assertParseLocalhost({
            uri: 'https://[0:0:0:0:0:0:0:0]:8080/test',
            expected: {
                address: '0:0:0:0:0:0:0:0',
                port: 8080
            }
        });
    }

    @test()
    parseServerName(): void {
        this.assertParseLocalhost({
            uri: 'https://gitpod.io/test',
            expected: undefined
        });
    }

    @test()
    parseIPV4(): void {
        this.assertParseLocalhost({
            uri: 'https://192.168.0.1/test',
            expected: undefined
        });
    }

    @test()
    parseIPV6(): void {
        this.assertParseLocalhost({
            uri: 'https://[0001::1]/test',
            expected: undefined
        });
    }

}