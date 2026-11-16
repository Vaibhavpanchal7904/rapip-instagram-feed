
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
         * FETCH INSTAGRAM PUBLIC PROFILE
         */

        const apiUrl =
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

        console.log(
            "Instagram request:",
            apiUrl
        );

        const response = await fetch(
            apiUrl,
            {
                method: "GET",
                headers: headers,
                redirect: "follow"
            }
        );

        const text = await response.text();

        console.log(
            "Instagram HTTP:",
            response.status
        );

        console.log(
            "Response length:",
            text.length
        );

        /*
         * HANDLE HTTP ERRORS
         */

        
if (!response.ok) {

    const status = response.status;

    const retryAfter =
        response.headers.get("Retry-After") || "900";

    console.error(
        "Instagram HTTP Error:",
        status
    );

    if (status === 429) {

        return {
            statusCode: 429,

            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
                "Retry-After": retryAfter
            },

            body: JSON.stringify({
                success: false,
                status: 429,

                message:
                    "Instagram rate limit reached. Please try again later.",

                retryAfter: Number(retryAfter) || 900
            })
        };
    }

    return {
        statusCode: 502,

        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
        },

        body: JSON.stringify({
            success: false,
            status: status,
            message: "Instagram feed request failed."
        })
    };
}

        /*
         * PARSE JSON
         */

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
                        text.substring(0, 300)
                })
            };
        }

        /*
         * EXTRACT USER DATA
         */

        const user =
            data?.data?.user ||
            data?.user ||
            null;

        if (!user) {

            return {
                statusCode: 502,

                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },

                body: JSON.stringify({
                    success: false,

                    message:
                        "Instagram profile data not found."
                })
            };
        }

        /*
         * EXTRACT TIMELINE
         */

        const timeline =
            user.edge_owner_to_timeline_media ||
            user.edge_felix_video_timeline ||
            {};

        const edges =
            Array.isArray(timeline.edges)
                ? timeline.edges
                : [];

        console.log(
            "Instagram timeline items:",
            edges.length
        );

        /*
         * CONVERT PROFILE RESPONSE
         * INTO ORIGINAL ITEM STRUCTURE
         */

        const items = edges
            .map(edge => edge?.node)
            .filter(Boolean)
            .map(node => {

                const carouselMedia =
                    Array.isArray(
                        node.edge_sidecar_to_children?.edges
                    )
                        ? node.edge_sidecar_to_children.edges
                            .map(child => child?.node)
                            .filter(Boolean)
                            .map(child => ({
                                image_versions2: {
                                    candidates: [
                                        {
                                            url:
                                                child.display_url ||
                                                child.thumbnail_src ||
                                                ""
                                        }
                                    ]
                                }
                            }))
                        : [];

                return {

                    pk:
                        node.id ||
                        node.pk ||
                        node.shortcode,

                    code:
                        node.shortcode ||
                        node.code,

                    media_code:
                        node.shortcode ||
                        node.code,

                    image_versions2: {
                        candidates: [
                            {
                                url:
                                    node.display_url ||
                                    node.thumbnail_src ||
                                    ""
                            }
                        ]
                    },

                    carousel_media:
                        carouselMedia,

                    taken_at:
                        node.taken_at_timestamp ||
                        node.taken_at ||
                        null,

                    media_type:
                        node.edge_sidecar_to_children
                            ? 8
                            : node.is_video
                                ? 2
                                : 1

                };

            });

        console.log(
            "Items received:",
            items.length
        );

        /*
         * CONVERT INSTAGRAM ITEMS
         */

        for (const item of items) {

            if (
                allPosts.length >= MAX_POSTS
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
             * AVOID DUPLICATE POSTS
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
             * NORMAL IMAGE
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
             * CAROUSEL IMAGE
             */

            if (
                !image &&
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

            if (!image) {
                continue;
            }

            /*
             * DATE FORMATTING
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
             * MEDIA TYPE
             */

            let mediaType = "IMAGE";

            if (item.media_type === 2) {

                mediaType = "VIDEO";

            }

            if (item.media_type === 8) {

                mediaType = "CAROUSEL";

            }

            /*
             * INSTAGRAM POST URL
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
         * PAGINATION INFORMATION
         */

        const pageInfo =
            timeline.page_info || {};

        maxId =
            pageInfo.end_cursor ||
            null;

        console.log(
            "Has next page:",
            Boolean(pageInfo.has_next_page)
        );

        /*
         * RETURN MAXIMUM 12 POSTS
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
                    "public, max-age=900"

            },

            body: JSON.stringify({

                success:
                    allPosts.length > 0,

                username:
                    username,

                count:
                    allPosts.length,

                posts:
                    allPosts,

                pagination: {

                    has_next_page:
                        Boolean(pageInfo.has_next_page),

                    end_cursor:
                        maxId

                }

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
