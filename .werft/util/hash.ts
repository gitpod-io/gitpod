import { createHmac } from 'crypto';

// referred from: https://security.stackexchange.com/questions/218044/how-to-generate-short-fixed-length-cryptographic-hashes/218045
// I have kept the secret as constant 'gitpod' as we do not intend to generate any cryptic string.
export function getXDigitsCode(message, digitCount): string {
    if (digitCount < 1 || digitCount > 64) {
        throw new Error("digitCount should be between 1 and 64(inclusive)")
    }
    const hash = createHmac('sha256', Buffer.from('gitpod', 'hex'))
        .update(message)
        .digest('hex');
    const firstXHexCharacters = hash.slice(0, digitCount);
    const int = parseInt(firstXHexCharacters, 16) % 10000;
    let code = int.toString();
    code =
        Array(digitCount - code.length)
            .fill(0)
            .join('') + code;
    return code;
};
