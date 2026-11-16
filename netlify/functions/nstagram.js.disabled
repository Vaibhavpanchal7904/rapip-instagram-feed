
exports.handler = async function () {

    const { getStore } = await import("@netlify/blobs");

    const username = "rapip__cvmu";
    const MAX_POSTS = 12;

    const CACHE_DURATION = 30 * 60 * 1000;
    const RETRY_COOLDOWN = 15 * 60 * 1000;

    const CACHE_KEY = `instagram-${username}`;
    const STATE_KEY = `instagram-state-${username}`;

    const store = getStore("rapipi-instagram-cache");

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300"
    };

    const send = (statusCode, body) => ({
        statusCode,
        headers,
        body: JSON.stringify(body)
    });

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
        console.error("Cache read error:", error.message);
    }

    const now = Date.now();

    const cachedPosts = Array.isArray(cachedData?.posts)
        ? cachedData.posts
        : [];

    const hasCache = cachedPosts.length > 0;

    const cacheAge = cachedData?.updatedAt
        ? now - cachedData.updatedAt
        : Infinity;

    const cacheIsFresh =
        hasCache && cacheAge < CACHE_DURATION;

    // 1. Serve fresh cache
    if (cacheIsFresh) {
        return send(200, {
            success: true,
            username,
            count: cachedPosts.length,
            posts: cachedPosts,
            cached: true,
            stale: false,
            lastUpdated: cachedData.updatedAt
        });
    }

    // 2. Check refresh cooldown
    const lastAttempt =
        Number(refreshState?.lastAttempt || 0);

    if (now - lastAttempt < RETRY_COOLDOWN) {

        if (hasCache) {
            return send(200, {
                success: true,
                username,
                count: cachedPosts.length,
                posts: cachedPosts,
                cached: true,
                stale: true,
                lastUpdated: cachedData.updatedAt,
                message: "Showing previously saved posts."
            });
        }

        return send(503, {
            success: false,
            username,
            count: 0,
            posts: [],
            message: "Instagram refresh is on cooldown.",
            retryAfter: Math.ceil(
                (RETRY_COOLDOWN - (now - lastAttempt)) / 1000
            )
        });
    }

    // 3. Record refresh attempt
    try {
        await store.setJSON(STATE_KEY, {
            lastAttempt: now
        });
    } catch (error) {
        console.error("Cooldown storage error:", error.message);
    }

    try {

        // 4. Request Instagram profile
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

        console.log("Instagram HTTP:", response.status);

        if (!response.ok) {
            throw new Error(
                `Instagram returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        // 5. Extract profile
        const user =
            data?.data?.user ||
            data?.user ||
            null;

        if (!user) {
            throw new Error("Instagram profile not found.");
        }

        // 6. Extract timeline
        const timeline =
            user.edge_owner_to_timeline_media ||
            user.edge_felix_video_timeline ||
            {};

        const edges = Array.isArray(timeline.edges)
            ? timeline.edges
            : [];

        console.log("Timeline items:", edges.length);

        const allPosts = [];
        const seenPosts = new Set();

        // 7. Process posts
        for (const edge of edges) {

            if (allPosts.length >= MAX_POSTS) break;

            const item = edge?.node;

            if (!item) continue;

            const shortcode =
                item.shortcode || item.code;

            if (!shortcode || seenPosts.has(shortcode)) {
                continue;
            }

            seenPosts.add(shortcode);

            let image =
                item.display_url ||
                item.thumbnail_src ||
                "";

            let mediaType = item.is_video
                ? "VIDEO"
                : "IMAGE";

            // Carousel support
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

            if (!image) continue;

            // Date formatting
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

            allPosts.push({
                id: String(item.id || shortcode),

                url:
                    `https://www.instagram.com/p/${shortcode}/`,

                image,
                date,
                media_type: mediaType
            });
        }

        console.log("Posts extracted:", allPosts.length);

        if (allPosts.length === 0) {
            throw new Error("No usable Instagram posts found.");
        }

        // 8. Save persistent cache
        const newCache = {
            username,
            posts: allPosts.slice(0, MAX_POSTS),
            updatedAt: Date.now()
        };

        await store.setJSON(CACHE_KEY, newCache);

        console.log("Instagram cache updated successfully.");

        // 9. Return fresh posts
        return send(200, {
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

        // 10. Serve previous posts on failure
        if (hasCache) {

            console.log("Serving stale Instagram cache.");

            return send(200, {
                success: true,
                username,
                count: cachedPosts.length,
                posts: cachedPosts,
                cached: true,
                stale: true,
                lastUpdated: cachedData.updatedAt,
                message:
                    "Instagram temporarily unavailable. Showing saved posts."
            });
        }

        // 11. No previous cache available
        const isRateLimited =
            error.message.includes("429");

        return send(
            isRateLimited ? 429 : 502,
            {
                success: false,
                username,
                count: 0,
                posts: [],
                cached: false,
                message: "Instagram posts could not be loaded.",
                error: error.message
            }
        );
    }
};