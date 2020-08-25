async function sleep(millis) {
    return Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

module.exports = {
    sleep
}