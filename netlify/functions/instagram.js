exports.handler = async function () {

    const username = "rapip__cvmu";

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/140.0.0.0 Safari/537.36",

        "X-IG-App-ID": "936619743392459",

        "Accept": "*/*",

        "Accept-Language": "en-US,en;q=0.9",

        "Referer":
            `https://www.instagram.com/${username}/`,

        "X-Requested-With": "XMLHttpRequest"
    };


    try {

        /*
        |--------------------------------------------------------------------------
        | Instagram internal feed endpoint
        |--------------------------------------------------------------------------
        */

        const apiUrl =
            `https://www.instagram.com/api/v1/feed/user/${username}/username/?count=6`;


        const response = await fetch(apiUrl, {
            method: "GET",
            headers: headers
        });


        const text = await response.text();


        console.log("Instagram HTTP:", response.status);
        console.log("Instagram response length:", text.length);


        if (!response.ok) {

            return {
                statusCode: 502,

                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },

                body: JSON.stringify({

                    success: false,

                    status: response.status,

                    message:
                        "Instagram feed request failed.",

                    response:
                        text.substring(0, 500)

                })
            };

        }


        let data;


        try {

            data = JSON.parse(text);

        } catch (error) {

            return {
                statusCode: 502,

                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },

                body: JSON.stringify({

                    success: false,

                    message:
                        "Instagram did not return JSON.",

                    response:
                        text.substring(0, 500)

                })
            };

        }


        /*
        |--------------------------------------------------------------------------
        | Instagram items
        |--------------------------------------------------------------------------
        */

        const items = Array.isArray(data.items)
            ? data.items
            : [];


        /*
        |--------------------------------------------------------------------------
        | Convert Instagram items
        |--------------------------------------------------------------------------
        */

        const posts = [];


        for (const item of items) {

            if (posts.length >= 3) {
                break;
            }


            /*
            | Post shortcode
            */

            const shortcode =
                item.code ||
                item.media_code ||
                item.pk;


            if (!shortcode) {
                continue;
            }


            /*
            | Image
            */

            let image = "";


            if (
                item.image_versions2 &&
                Array.isArray(
                    item.image_versions2.candidates
                ) &&
                item.image_versions2.candidates.length > 0
            ) {

                /*
                 * First candidate is generally
                 * the largest/primary image.
                 */

                image =
                    item.image_versions2
                        .candidates[0]
                        .url || "";

            }


            /*
            | Carousel
            */

            if (
                !image &&
                item.carousel_media &&
                Array.isArray(item.carousel_media) &&
                item.carousel_media.length > 0
            ) {

                const first =
                    item.carousel_media[0];


                if (
                    first.image_versions2 &&
                    Array.isArray(
                        first.image_versions2.candidates
                    ) &&
                    first.image_versions2.candidates.length
                ) {

                    image =
                        first.image_versions2
                            .candidates[0]
                            .url || "";

                }

            }


            /*
            | Caption
            */

            let caption =
                "Rita A. Patel Institute of Physiotherapy";


            if (
                item.caption &&
                typeof item.caption.text === "string"
            ) {

                caption =
                    item.caption.text;

            }


            /*
            | Date
            */

            let date = "";


            if (item.taken_at) {

                const timestamp =
                    Number(item.taken_at) * 1000;


                const d =
                    new Date(timestamp);


                date =
                    d.toLocaleDateString(
                        "en-IN",
                        {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        }
                    );

            }


            /*
            | Media type
            */

            let mediaType =
                "IMAGE";


            if (item.media_type === 2) {
                mediaType = "VIDEO";
            }

            if (item.media_type === 8) {
                mediaType = "CAROUSEL";
            }


            /*
            | Post URL
            */

            const postUrl =
                `https://www.instagram.com/p/${item.code || shortcode}/`;


            posts.push({

                id:
                    String(
                        item.pk ||
                        shortcode
                    ),

                url:
                    postUrl,

                image:
                    image,

                caption:
                    caption,

                date:
                    date,

                media_type:
                    mediaType

            });

        }


        /*
        |--------------------------------------------------------------------------
        | Final response
        |--------------------------------------------------------------------------
        */

        return {

            statusCode: 200,

            headers: {

                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*",

                /*
                 * Browser can cache for 30 minutes.
                 */

                "Cache-Control":
                    "public, max-age=1800"

            },

            body: JSON.stringify({

                success:
                    posts.length > 0,

                username:
                    username,

                count:
                    posts.length,

                posts:
                    posts

            })

        };


    } catch (error) {

        console.error(
            "Instagram error:",
            error
        );


        return {

            statusCode: 500,

            headers: {

                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*"

            },

            body: JSON.stringify({

                success:
                    false,

                message:
                    "Function error",

                error:
                    error.message

            })

        };

    }

};