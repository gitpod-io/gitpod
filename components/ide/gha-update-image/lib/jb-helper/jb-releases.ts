import { z } from "zod";
import axios from "axios";

export const productReleaseZod = z.record(
    z.string(),
    z.array(
        z.object({
            date: z.string(),
            type: z.string(),
            downloads: z.object({
                linux: z
                    .object({
                        link: z.string(),
                    })
                    .optional(),
            }),
            notesLink: z.string().nullish(),
            whatsnew: z.string().nullish(),
            majorVersion: z.string(), // 2024.2
            build: z.string(), // 242.20224.159
            version: z.string(), // 2024.2.1
        }),
    ),
);

export type ReleaseItem = z.infer<typeof productReleaseZod>[string][number];

export const releaseItemStr = (release: ReleaseItem) => {
    return `${release.version}(${release.type},${release.build})`;
};

export async function fetchProductReleases(info: { productCode: string; productType: string }) {
    const { productCode, productType } = info;
    // https://data.services.jetbrains.com/products/releases?code=GW&type=eap,rc,release&platform=linux
    const url = `https://data.services.jetbrains.com/products/releases?code=${productCode}&type=${productType}&platform=linux`;
    console.log(`Fetching product releases on ${url}`);
    const response = await axios.get(url);
    const data = productReleaseZod.parse(response.data);
    if (!data[productCode] || data[productCode].length <= 0) {
        throw new Error(`No data found for ${productCode} in ${url}`);
    }
    return data[productCode];
}
