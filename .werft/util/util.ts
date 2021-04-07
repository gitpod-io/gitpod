export async function sleep(millis: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}