
import json
import os
import requests
import instaloader

USERNAME = "rapip__cvmu"
MAX_POSTS = 12

OUTPUT_DIR = "public/instagram"
JSON_FILE = "public/instagram.json"

os.makedirs(OUTPUT_DIR, exist_ok=True)

loader = instaloader.Instaloader(
    quiet=True,
    download_pictures=False,
    download_videos=False,
    download_video_thumbnails=False,
    save_metadata=False
)

def download_image(url, filename):
    if not url:
        return ""

    path = os.path.join(OUTPUT_DIR, filename)

    try:
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=30
        )
        response.raise_for_status()

        with open(path, "wb") as image_file:
            image_file.write(response.content)

        return "/instagram/" + filename

    except Exception as error:
        print("Image download failed:", error)
        return url


print("Fetching Instagram profile:", USERNAME)

profile = instaloader.Profile.from_username(
    loader.context,
    USERNAME
)

posts = []

for post in profile.get_posts():
    if len(posts) >= MAX_POSTS:
        break

    shortcode = post.shortcode
    images = []

    if post.typename == "GraphSidecar":
        for index, node in enumerate(post.get_sidecar_nodes()):
            if node.is_video:
                continue

            image_url = download_image(
                node.display_url,
                f"{shortcode}_{index}.jpg"
            )

            if image_url:
                images.append(image_url)

    else:
        image_url = download_image(
            post.url,
            f"{shortcode}.jpg"
        )

        if image_url:
            images.append(image_url)

    if not images:
        continue

    media_type = (
        "CAROUSEL" if post.typename == "GraphSidecar"
        else "VIDEO" if post.is_video
        else "IMAGE"
    )

    posts.append({
        "id": shortcode,
        "url": f"https://www.instagram.com/p/{shortcode}/",
        "image": images[0],
        "images": images,
        "date": post.date_utc.isoformat(),
        "media_type": media_type,
        "video": post.video_url if post.is_video else "",
        "caption": post.caption or ""
    })

data = {
    "success": True,
    "username": USERNAME,
    "count": len(posts),
    "posts": posts
}

with open(JSON_FILE, "w", encoding="utf-8") as file:
    json.dump(data, file, indent=2, ensure_ascii=False)

print(f"Successfully saved {len(posts)} posts.")
