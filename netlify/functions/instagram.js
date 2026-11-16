
const { getStore } = await import("@netlify/blobs");

exports.handler = async function () {
    const username = "rapip__cvmu";

    const MAX_POSTS = 12;

    const CACHE_DURATION = 30 * 60 * 1000;
    const RETRY_COOLDOWN = 15 * 60 * 1000;

    const CACHE_KEY = `instagram-${username}`;
    const STATE_KEY = `instagram-state-${username}`;

    const store = getStore("rapipi-instagram-cache");

    const responseHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300"
    };

    const sendResponse = (statusCode, body) => ({
        statusCode,
        headers: responseHeaders,
        body: JSON.stringify(body)
    });

    /*
     * READ PERSISTENT CACHE
     */

    let cachedData = null;
    let refreshState = null;

    try {
        cachedData = await store.get(CACHE_KEY, {
            type: "json",
            consistency: "strong"
        });

        refreshState = await store.get(STATE_KEY, {
            type: "json",
            consistency: "strong"
        });

    } catch (error) {
        console.error("Instagram cache read error:", error.message);
    }

    const now = Date.now();

    const cachedPosts =
        Array.isArray(cachedData?.posts)
            ? cachedData.posts
            : [];

    const hasCache = cachedPosts.length > 0;

    const cacheAge =
        cachedData?.updatedAt
            ? now - cachedData.updatedAt
            : Infinity;

    const cacheIsFresh =
        hasCache && cacheAge < CACHE_DURATION;

    /*
     * RETURN FRESH CACHE
     */

    if (cacheIsFresh) {

        console.log("Instagram: Serving fresh cached posts.");

        return sendResponse(200, {
            success: true,
            username,
            count: cachedPosts.length,
            posts: cachedPosts,
            cached: true,
            stale: false,
            lastUpdated: cachedData.updatedAt
        });
    }

    /*
     * CHECK RETRY COOLDOWN
     */

    const lastAttempt =
        Number(refreshState?.lastAttempt || 0);

    const cooldownActive =
        now - lastAttempt < RETRY_COOLDOWN;

    if (cooldownActive) {

        if (hasCache) {

            console.log(
                "Instagram: Returning stale cache during cooldown."
            );

            return sendResponse(200, {
                success: true,
                username,
                count: cachedPosts.length,
                posts: cachedPosts,
                cached: true,
                stale: true,
                lastUpdated: cachedData.updatedAt,
                message: "Showing previously cached Instagram posts."
            });
        }

        const retryAfter = Math.ceil(
            (RETRY_COOLDOWN - (now - lastAttempt)) / 1000
        );

        return sendResponse(503, {
            success: false,
            username,
            count: 0,
            posts: [],
            cached: false,
            message: "Instagram refresh is temporarily on cooldown.",
            retryAfter
        });
    }

    /*
     * RECORD REFRESH ATTEMPT
     *
     * This reduces repeated upstream requests.
     */

    try {

        await store.setJSON(STATE_KEY, {
            lastAttempt: now
        });

    } catch (error) {

        console.error(
            "Instagram refresh state error:",
            error.message
        );
    }

    /*
     * FETCH INSTAGRAM PROFILE
     */

    try {

        const apiUrl =
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

        const response = await fetch(apiUrl, {
            method: "GET",

            headers: {
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
            },

            redirect: "follow",
            signal: AbortSignal.timeout(12000)
        });

        console.log(
            "Instagram HTTP:",
            response.status
        );

        if (!response.ok) {

            console.error(
                "Instagram upstream error:",
                response.status
            );

            throw new Error(
                `Instagram returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        /*
         * EXTRACT PROFILE
         */

        const user =
            data?.data?.user ||
            data?.user ||
            null;

        if (!user) {
            throw new Error("Instagram profile data not found.");
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

        const allPosts = [];

        /*
         * PROCESS POSTS
         */

        for (const edge of edges) {

            if (allPosts.length >= MAX_POSTS) {
                break;
            }

            const item = edge?.node;

            if (!item) {
                continue;
            }

            const shortcode =
                item.shortcode ||
                item.code;

            if (!shortcode) {
                continue;
            }

            let image =
                item.display_url ||
                item.thumbnail_src ||
                "";

            let mediaType = "IMAGE";

            /*
             * VIDEO
             */

            if (item.is_video) {
                mediaType = "VIDEO";
            }

            /*
             * CAROUSEL
             */

            const carouselEdges =
                item.edge_sidecar_to_children?.edges;

            if (
                Array.isArray(carouselEdges) &&
                carouselEdges.length > 0
            ) {

                mediaType = "CAROUSEL";

                const firstImage = carouselEdges
                    .map(child => child?.node)
                    .find(node =>
                        node?.display_url ||
                        node?.thumbnail_src
                    );

                if (firstImage) {

                    image =
                        firstImage.display_url ||
                        firstImage.thumbnail_src ||
                        image;
                }
            }

            if (!image) {
                continue;
            }

            /*
             * DATE
             */

            let date = "";

            const timestamp =
                item.taken_at_timestamp ||
                item.taken_at;

            if (timestamp) {

                date = new Date(
                    Number(timestamp) * 1000
                ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
            }

            /*
             * ADD POST
             */

            allPosts.push({

                id: String(
                    item.id ||
                    shortcode
                ),

                url:
                    `https://www.instagram.com/p/${shortcode}/`,

                image,

                date,

                media_type: mediaType

            });
        }

        /*
         * VALIDATE POSTS
         */

        if (allPosts.length === 0) {

            throw new Error(
                "Instagram returned no usable posts."
            );
        }

        /*
         * SAVE NEW POSTS TO NETLIFY BLOBS
         */

        const newCache = {
            username,
            posts: allPosts.slice(0, MAX_POSTS),
            updatedAt: Date.now()
        };

        await store.setJSON(CACHE_KEY, newCache);

        console.log(
            "Instagram cache successfully updated:",
            newCache.posts.length
        );

        /*
         * RETURN FRESH POSTS
         */

        return sendResponse(200, {
            success: true,
            username,
            count: newCache.posts.length,
            posts: newCache.posts,
            cached: false,
            stale: false,
            lastUpdated: newCache.updatedAt
        });

    } catch (error) {

        console.error(
            "Instagram refresh failed:",
            error.message
        );

        /*
         * FALLBACK TO OLD POSTS
         */

        if (hasCache) {

            console.log(
                "Instagram: Serving previous cached posts."
            );

            return sendResponse(200, {
                success: true,
                username,
                count: cachedPosts.length,
                posts: cachedPosts,
                cached: true,
                stale: true,
                lastUpdated: cachedData.updatedAt,
                message:
                    "Instagram is temporarily unavailable. Showing previously saved posts."
            });
        }

        /*
         * NO CACHE AVAILABLE
         */

        const isRateLimited =
            error.message.includes("429");

        return sendResponse(
            isRateLimited ? 429 : 502,
            {
                success: false,
                username,
                count: 0,
                posts: [],
                cached: false,
                message:
                    "Instagram posts could not be loaded.",
                error: error.message
            }
        );
    }
};
