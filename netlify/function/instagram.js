exports.handler = async function () {

    const username = "rapip__cvmu";

    const profileUrl = `https://www.instagram.com/${username}/`;

    try {

        const response = await fetch(profileUrl, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) " +
                    "Chrome/140.0.0.0 Safari/537.36",

                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                "Accept-Language":
                    "en-US,en;q=0.9",

                "Cache-Control":
                    "no-cache"
            }
        });

        const html = await response.text();

        if (!response.ok) {

            return {
                statusCode: 502,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "Instagram request failed",
                    status: response.status
                })
            };

        }


        /*
        ----------------------------------------------------
        Extract Instagram post / reel URLs
        ----------------------------------------------------
        */

        const regex =
            /https:\/\/www\.instagram\.com\/(p|reel)\/([^/?"]+)/g;

        const found = [];

        let match;

        while ((match = regex.exec(html)) !== null) {

            const type = match[1];
            const code = match[2];

            const url =
                `https://www.instagram.com/${type}/${code}/`;

            if (!found.some(post => post.url === url)) {

                found.push({
                    url: url,
                    shortcode: code,
                    type: type
                });

            }

            if (found.length >= 3) {
                break;
            }
        }


        /*
        ----------------------------------------------------
        No posts found
        ----------------------------------------------------
        */

        if (found.length === 0) {

            return {
                statusCode: 200,

                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=1800"
                },

                body: JSON.stringify({
                    success: false,
                    posts: [],
                    message:
                        "Instagram did not expose public post data."
                })
            };

        }


        /*
        ----------------------------------------------------
        Return posts
        ----------------------------------------------------
        */

        return {

            statusCode: 200,

            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=1800"
            },

            body: JSON.stringify({

                success: true,

                username: username,

                posts: found

            })

        };


    } catch (error) {

        return {

            statusCode: 500,

            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },

            body: JSON.stringify({

                success: false,

                error: error.message

            })

        };

    }

};