import { createHmac, createHash } from 'crypto';

// referred from: https://security.stackexchange.com/questions/218044/how-to-generate-short-fixed-length-cryptographic-hashes/218045
// and https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm_options
export function getXDigitsHashCode(message: string, digitCount: number): string {
    if (digitCount < 1 || digitCount > 64) {
        throw new Error("digitCount should be between 1 and 64(inclusive)")
    }
    const hash = createHash('sha256').update(message).digest('hex')
    const firstXHexCharacters = hash.slice(0, digitCount);
    // In order to reduce collision we want to use all available characters, we do it by taking a mod
    const int = parseInt(firstXHexCharacters, 16) % (10 ** digitCount);
    let code = int.toString();
    // If the number of chars is less than digitCount then we will prepend '0'
    code =
        Array(digitCount - code.length)
            .fill(0)
            .join('') + code;
    return code;
};
