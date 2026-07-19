from __future__ import annotations

import logging
import re
from html import unescape
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("grampulse.snapinsta")

SAVEINSTA_HOME = "https://saveinsta.to/en/highlights"
SAVEINSTA_VERIFY = "https://saveinsta.to/api/userverify"
SAVEINSTA_SEARCH = "https://saveinsta.to/api/ajaxSearch"

SNAPINSTA_HOME = "https://snapinsta.app/"
SNAPINSTA_ACTION = "https://snapinsta.app/action2.php"

_TOKEN_SCRIPT = re.compile(r'<script[^>]*>var\s+k_url_search="[^"]+"(.*?)</script>', re.S)
_OBFUSCATE_PATTERN = re.compile(r'\("(\w+)",\d+,"(\w+)",(\d+),(\d+),\d+\)')
_HREF_PATTERN = re.compile(r'href=\\"([^\\"]+)\\"')
_MP4_PATTERN = re.compile(r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*', re.IGNORECASE)

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def is_instagram_url(url: str) -> bool:
    host = urlparse(url.strip()).netloc.lower()
    return host.endswith("instagram.com") or host.endswith("instagr.am")


def normalize_instagram_url(url: str) -> str:
    clean = url.strip()
    clean = re.sub(r"(?i)instagram\.com/reels/", "instagram.com/reel/", clean)
    if "?" in clean:
        clean = clean.split("?", 1)[0]
    if not clean.endswith("/"):
        clean += "/"
    return clean


def _convert_base(value: str, base: int, to_base: int) -> str:
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/"
    from_digits, to_digits = alphabet[:base], alphabet[:to_base]
    number = sum(
        from_digits.index(char) * base**index
        for index, char in enumerate(reversed(value))
        if from_digits.index(char) != -1
    )
    if number == 0:
        return "0"
    converted = ""
    while number:
        converted = to_digits[number % to_base] + converted
        number //= to_base
    return converted


def _deobfuscate_html(encoded: str, separator: str, radix: int, offset: int) -> str:
    decoded = ""
    index = 0
    length = len(encoded)
    while index < length:
        chunk = ""
        while index < length and encoded[index] != separator[radix]:
            chunk += encoded[index]
            index += 1
        chunk = "".join(str(separator.index(char)) for char in chunk)
        decoded += chr(int(_convert_base(chunk, radix, 10)) - offset)
        index += 1
    return decoded


def _extract_js_var(name: str, source: str) -> str | None:
    match = re.search(rf"{re.escape(name)}\s*=\s*\"([^\"]+)\"", source)
    return match.group(1) if match else None


def _parse_saveinsta_html(html: str) -> str:
    html = unescape(html)
    patterns = [
        re.compile(r'href="(https?://[^"]+)"[^>]*\bvideo=""', re.IGNORECASE),
        re.compile(r'\bvideo=""\s+href="(https?://[^"]+)"', re.IGNORECASE),
        re.compile(r'href="(https?://[^"]+)"[^>]*>\s*Download Video', re.IGNORECASE | re.DOTALL),
        re.compile(r'href="(https?://[^"]+)"[^>]*>\s*Télécharger', re.IGNORECASE | re.DOTALL),
    ]
    for pattern in patterns:
        match = pattern.search(html)
        if match:
            return match.group(1)

    for match in re.finditer(r'<option[^>]+value="(https?://[^"]+)"', html, re.IGNORECASE):
        value = match.group(1)
        if any(token in value.lower() for token in (".mp4", "snapcdn", "cdninstagram", "fbcdn")):
            return value

    for match in re.finditer(r'href="(https?://[^"]+)"', html, re.IGNORECASE):
        link = match.group(1)
        if any(token in link.lower() for token in ("snapcdn.app", "cdninstagram", "fbcdn.net")):
            if "photo?" not in link.lower():
                return link

    mp4_match = _MP4_PATTERN.search(html)
    if mp4_match:
        return mp4_match.group(0)

    raise RuntimeError("SnapInsta n'a pas trouvé de lien vidéo pour ce reel.")


def _resolve_via_saveinsta(client: httpx.Client, insta_url: str) -> str:
    response = client.get(SAVEINSTA_HOME, headers={**_DEFAULT_HEADERS, "Referer": "https://www.google.com/"})
    response.raise_for_status()

    script_match = _TOKEN_SCRIPT.search(response.text)
    if not script_match:
        raise RuntimeError("SnapInsta indisponible (tokens introuvables).")

    block = script_match.group(1)
    k_exp = _extract_js_var("k_exp", block)
    k_token = _extract_js_var("k_token", block)
    if not k_exp or not k_token:
        raise RuntimeError("SnapInsta indisponible (tokens incomplets).")

    verify = client.post(
        SAVEINSTA_VERIFY,
        data={"url": insta_url},
        headers={
            **_DEFAULT_HEADERS,
            "Origin": "https://saveinsta.to",
            "Referer": "https://saveinsta.to/en/video",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    verify.raise_for_status()
    cftoken = verify.json().get("token")
    if not cftoken:
        raise RuntimeError("SnapInsta n'a pas pu valider ce lien Instagram.")

    search = client.post(
        SAVEINSTA_SEARCH,
        data={
            "k_exp": k_exp,
            "k_token": k_token,
            "q": insta_url,
            "t": "media",
            "lang": "en",
            "v": "v2",
            "cftoken": cftoken,
        },
        headers={
            **_DEFAULT_HEADERS,
            "Origin": "https://saveinsta.to",
            "Referer": SAVEINSTA_HOME,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    search.raise_for_status()
    payload = search.json()
    if payload.get("status") != "ok" or not payload.get("data"):
        message = payload.get("msg") or payload.get("message") or "réponse vide"
        raise RuntimeError(f"SnapInsta : {message}")

    return _parse_saveinsta_html(payload["data"])


def _resolve_via_snapinsta_app(client: httpx.Client, insta_url: str) -> str:
    response = client.get(SNAPINSTA_HOME)
    response.raise_for_status()
    match = re.search(r'name="token" value="(.*?)"', response.text)
    if not match:
        raise RuntimeError("SnapInsta.app indisponible.")

    token = match.group(1)
    payload_response = client.post(
        SNAPINSTA_ACTION,
        headers={"Referer": SNAPINSTA_HOME},
        data={"url": insta_url, "token": token},
    )
    payload_response.raise_for_status()
    payload = payload_response.text

    obfuscated = _OBFUSCATE_PATTERN.search(payload)
    if not obfuscated:
        raise RuntimeError("SnapInsta.app n'a pas renvoyé de lien téléchargeable.")

    encoded, separator, offset, radix = obfuscated.groups()
    html_source = _deobfuscate_html(encoded, separator, int(radix), int(offset))

    for pattern in (_HREF_PATTERN, re.compile(r'href="([^"]+)"')):
        for href_match in pattern.finditer(html_source):
            link = href_match.group(1).replace("\\/", "/")
            if "snapinsta" in link.lower() or link.lower().endswith(".mp4"):
                return link

    mp4_match = _MP4_PATTERN.search(html_source)
    if mp4_match:
        return mp4_match.group(0)

    raise RuntimeError("SnapInsta.app : lien introuvable.")


def resolve_instagram_video_url(insta_url: str, *, timeout: float = 60) -> str:
    normalized = normalize_instagram_url(insta_url)
    errors: list[str] = []

    with httpx.Client(
        headers=_DEFAULT_HEADERS,
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        for resolver in (_resolve_via_saveinsta, _resolve_via_snapinsta_app):
            try:
                download_url = resolver(client, normalized)
                logger.info("SnapInsta resolved %s via %s", normalized[:80], resolver.__name__)
                return download_url
            except Exception as exc:
                logger.warning("%s failed: %s", resolver.__name__, exc)
                errors.append(str(exc))

    detail = errors[0] if errors else "service indisponible"
    raise RuntimeError(f"Impossible de télécharger via SnapInsta — {detail}")


def download_instagram_video(insta_url: str, destination, *, timeout: float = 180) -> None:
    normalized = normalize_instagram_url(insta_url)
    download_url = resolve_instagram_video_url(normalized, timeout=min(timeout, 60))
    with httpx.Client(
        headers=_DEFAULT_HEADERS,
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        with client.stream("GET", download_url) as response:
            response.raise_for_status()
            with open(destination, "wb") as handle:
                for chunk in response.iter_bytes():
                    handle.write(chunk)
