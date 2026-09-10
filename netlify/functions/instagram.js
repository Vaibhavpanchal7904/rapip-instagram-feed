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


    const MAX_POSTS = 12;

    let allPosts = [];

    let maxId = null;


    try {

        /*
         * Fetch multiple pages until we have 12 posts
         */

        for (let page = 0; page < 5; page++) {

            let apiUrl =
                `https://www.instagram.com/api/v1/feed/user/${username}/username/?count=12`;


            if (maxId) {

                apiUrl +=
                    `&max_id=${encodeURIComponent(maxId)}`;

            }


            console.log(
                "Instagram request:",
                apiUrl
            );


            const response = await fetch(
                apiUrl,
                {
                    method: "GET",
                    headers: headers
                }
            );


            const text =
                await response.text();


            console.log(
                "Instagram HTTP:",
                response.status
            );


            console.log(
                "Response length:",
                text.length
            );


            if (!response.ok) {

                return {

                    statusCode: 502,

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Access-Control-Allow-Origin":
                            "*"
                    },

                    body: JSON.stringify({

                        success: false,

                        status:
                            response.status,

                        message:
                            "Instagram feed request failed.",

                        response:
                            text.substring(0, 500)

                    })

                };

            }


            let data;


            try {

                data =
                    JSON.parse(text);

            }
            catch (error) {

                return {

                    statusCode: 502,

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Access-Control-Allow-Origin":
                            "*"
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


            const items =
                Array.isArray(data.items)
                    ? data.items
                    : [];


            console.log(
                "Items received:",
                items.length
            );


            /*
             * Convert Instagram items
             */

            for (const item of items) {

                if (
                    allPosts.length >=
                    MAX_POSTS
                ) {

                    break;

                }


                const shortcode =
                    item.code ||
                    item.media_code ||
                    item.pk;


                if (!shortcode) {
                    continue;
                }


                /*
                 * Avoid duplicate posts
                 */

                const alreadyExists =
                    allPosts.some(
                        post =>
                            post.id ===
                            String(
                                item.pk ||
                                shortcode
                            )
                    );


                if (alreadyExists) {
                    continue;
                }


                let image = "";


                /*
                 * Normal image
                 */

                if (
                    item.image_versions2 &&
                    Array.isArray(
                        item.image_versions2.candidates
                    ) &&
                    item.image_versions2.candidates.length > 0
                ) {

                    image =
                        item.image_versions2
                            .candidates[0]
                            .url || "";

                }


                /*
                 * Carousel image
                 */

                if (
                    !image &&
                    Array.isArray(
                        item.carousel_media
                    ) &&
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


                if (!image) {
                    continue;
                }


                /*
                 * Date
                 */

                let date = "";


                if (item.taken_at) {

                    const timestamp =
                        Number(item.taken_at) *
                        1000;


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
                 * Media type
                 */

                let mediaType =
                    "IMAGE";


                if (item.media_type === 2) {

                    mediaType =
                        "VIDEO";

                }


                if (item.media_type === 8) {

                    mediaType =
                        "CAROUSEL";

                }


                /*
                 * Instagram URL
                 */

                const postUrl =
                    `https://www.instagram.com/p/${item.code || shortcode}/`;


                allPosts.push({

                    id:
                        String(
                            item.pk ||
                            shortcode
                        ),

                    url:
                        postUrl,

                    image:
                        image,

                    date:
                        date,

                    media_type:
                        mediaType

                });

            }


            /*
             * Already have 12
             */

            if (
                allPosts.length >=
                MAX_POSTS
            ) {

                break;

            }


            /*
             * Get next page cursor
             */

            maxId =
                data.next_max_id ||
                data.next_page_max_id ||
                null;


            /*
             * No next page
             */

            if (!maxId) {

                console.log(
                    "No more Instagram pages."
                );

                break;

            }

        }


        /*
         * Return maximum 12 posts
         */

        allPosts =
            allPosts.slice(
                0,
                MAX_POSTS
            );


        return {

            statusCode: 200,

            headers: {

                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*",

                "Cache-Control":
                    "public, max-age=1800"

            },

            body: JSON.stringify({

                success:
                    allPosts.length > 0,

                username:
                    username,

                count:
                    allPosts.length,

                posts:
                    allPosts

            })

        };

    }
    catch (error) {

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

                success: false,

                message:
                    "Function error",

                error:
                    error.message

            })

        };

    }

};