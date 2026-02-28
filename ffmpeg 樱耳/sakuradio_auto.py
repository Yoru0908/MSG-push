#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
桜耳通信 自动化投稿脚本
- 每周二/五 19:05 JST 检测新期
- 下载音频（Brightcove，无需 cookies）
- 下载封面图
- ffmpeg 合成 MP4
- biliup 上传至 B 站
"""

import os
import re
import sys
import json
import time
import shutil
import hashlib
import logging
import argparse
import subprocess
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

# ─── 配置 ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / "sakuradio_state.json"
COOKIES_FILE = BASE_DIR / "cookies.txt"
OUTPUT_DIR = BASE_DIR / "output"
COVER_DIR = BASE_DIR / "radio_cover"
AUDIO_DIR = BASE_DIR / "radio_audio"
VIDEO_DIR = BASE_DIR / "radio_video"

ACCOUNT_ID = "4504957038001"
BC_BASE = f"https://players.brightcove.net/{ACCOUNT_ID}/default_default/index.html"

BILI_TITLE_FMT = "【桜坂46】桜耳通信 第{ep}回"
BILI_DESCRIPTION_FMT = (
    "桜耳通信 第{ep}回\n"
    "{summary}\n\n"
    "【桜坂46公式サイト】https://sakurazaka46.com\n"
    "※ファンによる非公式アーカイブです"
)
BILI_TAGS = "櫻坂46,桜耳通信,さくみ耳,ラジオ,アーカイブ"
BILI_TID = 31   # 音乐 → 翻唱 (31), or 综艺 (71), radio → 音乐综艺 → 粉丝创作 (175) 
BILI_COPYRIGHT = 2  # 转载

JST = timezone(timedelta(hours=9))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_DIR / "sakuradio_auto.log", encoding="utf-8"),
    ]
)
log = logging.getLogger(__name__)

# ─── 状态管理 ─────────────────────────────────────────────────────────
def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"last_ep": 0, "processed": {}}

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

# ─── 爬取新期 ─────────────────────────────────────────────────────────────
SAKURA_LOGIN = "srzwyuu@gmail.com"
SAKURA_PASS = "xjj20000908"
_session = None

def get_authed_session():
    """返回已登录的 requests.Session"""
    global _session
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/145.0.7632.108 Mobile/15E148 Safari/604.1"
    })
    try:
        # 1. GET 首页获取 webckid
        r = session.get("https://sakurazaka46.com/s/s46/", timeout=15)
        ckid = re.search(r'my_webckid["\s:=]+["\']?([a-f0-9]{32,})', r.text)
        webckid = ckid.group(1) if ckid else ""

        # 2. POST 登录
        session.post(
            "https://sakurazaka46.com/s/s46/login",
            data=(
                f"my_prevtyp=S&my_prevdom=sakurazaka46.com"
                f"&my_prevurl=%2Fs%2Fs46%2F&my_prevmet=GET"
                f"&my_webckid={webckid}&my_prevprm=&mode=LOGIN&ima=0000"
                f"&idpwLgid={SAKURA_LOGIN.replace('@', '%40')}"
                f"&idpwLgpw={SAKURA_PASS}"
            ),
            headers={"Content-Type": "application/x-www-form-urlencoded",
                     "Origin": "https://sakurazaka46.com",
                     "Referer": "https://sakurazaka46.com/s/s46/login"},
            allow_redirects=True, timeout=15
        )
        b81 = session.cookies.get("B81AC560F83BFC8C", "")
        if b81:
            log.info(f"登录成功 B81: {b81[:16]}...")
            _session = session
            return session
        else:
            log.error("登录失败：未获取到 session cookie")
            return None
    except Exception as e:
        log.error(f"登录异常: {e}")
        return None

def fetch_radio_list(count=20):
    """从官网抓取最新期数列表，返回 [{ep, diary_id, detail_url, image_url}, ...]"""
    session = get_authed_session()
    if not session:
        return None
    try:
        # GET radio 列表页
        r = session.get("https://sakurazaka46.com/s/s46/diary/radio?ima=0000", timeout=20)
        if len(r.text) < 10000:
            log.warning(f"radio 页面过短 ({len(r.text)} bytes)，可能未登录")
            return None

        entries = []
        # HTML 结构: <li class="sakumimi-list-item sakumimi_item" data-player-id="68091" ...>
        # 先提取所有 <li> 开标签的位置和 data-player-id
        for m in re.finditer(r'data-player-id="(\d+)"', r.text):
            diary_id = m.group(1)
            # 取 <li 开始到下一个 </li> 的内容
            li_start = r.text.rfind('<li', 0, m.start())
            li_end = r.text.find('</li>', m.end())
            if li_start < 0 or li_end < 0:
                continue
            block = r.text[li_start:li_end + 5]
            # 只处理 sakumimi-list-item
            if 'sakumimi-list-item' not in block:
                continue
            ep_m = re.search(r'<span>#(\d{3,4})</span>', block)
            img_m = re.search(r'<img[^>]+src="(/images/[^"]+)"', block, re.I)
            if ep_m:
                image_url = ("https://sakurazaka46.com" + img_m.group(1)) if img_m else None
                entries.append({
                    "ep": int(ep_m.group(1)),
                    "diary_id": diary_id,
                    "detail_url": f"https://sakurazaka46.com/s/s46/diary/detail/{diary_id}?ima=0000",
                    "image_url": image_url,
                })
            if len(entries) >= count:
                break

        log.info(f"获取到 {len(entries)} 条 radio 列表，最新: EP{entries[0]['ep'] if entries else '?'}")
        return entries
    except Exception as e:
        log.error(f"爬取失败: {e}")
        return None

def get_video_id(detail_url):
    """从 detail 页面提取 Brightcove video_id"""
    session = get_authed_session()
    try:
        r = session.get(detail_url, timeout=15) if session else requests.get(detail_url, timeout=15)
        m = re.search(r'data-video-?id="(\d{10,})"', r.text, re.I)
        if not m:
            # fallback: look for brightcove player script
            m = re.search(r'videoId["\s:=]+["\']?(\d{10,})', r.text)
        if m:
            return m.group(1)
        log.warning(f"未找到 video_id: {detail_url}")
        return None
    except Exception as e:
        log.error(f"获取 video_id 失败: {e}")
        return None

# ─── 下载 ─────────────────────────────────────────────────────────────
def download_audio(video_id, ep, output_dir):
    """通过 Brightcove URL 下载音频（无需 cookies）"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 检查是否已下载
    existing = list(output_dir.glob(f"EP{ep:03d}.*"))
    if existing:
        log.info(f"EP{ep:03d} 音频已存在: {existing[0].name}")
        return str(existing[0])

    bc_url = f"{BC_BASE}?videoId={video_id}"
    output_path = str(output_dir / f"EP{ep:03d}.%(ext)s")

    cmd = [
        "yt-dlp",
        "-f", "bestaudio",
        "-o", output_path,
        "--no-warnings",
        "--quiet",
        bc_url
    ]
    log.info(f"下载音频 EP{ep:03d} (video_id={video_id})")
    result = subprocess.run(cmd, capture_output=True, timeout=180)

    # 找到生成的文件
    for ext in [".m4a", ".mp4", ".aac", ".webm"]:
        f = output_dir / f"EP{ep:03d}{ext}"
        if f.exists() and f.stat().st_size > 100_000:
            log.info(f"音频下载完成: {f.name} ({f.stat().st_size/1024/1024:.1f}MB)")
            return str(f)

    log.error(f"音频下载失败: {result.stderr.decode()[:200]}")
    return None

def download_cover(image_url, ep, output_dir):
    """下载封面图"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    existing = list(output_dir.glob(f"EP{ep:03d}.*"))
    if existing:
        log.info(f"EP{ep:03d} 封面已存在")
        return str(existing[0])

    if not image_url:
        log.warning(f"EP{ep:03d} 无封面 URL")
        return None

    # 确保使用高分辨率
    image_url = re.sub(r'/\d+_\d+_\d+$', '/800_800_102400', image_url)

    ext = ".jpg"
    output_path = str(output_dir / f"EP{ep:03d}{ext}")
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(image_url, headers=headers, timeout=30)
        Path(output_path).write_bytes(r.content)
        log.info(f"封面下载完成: EP{ep:03d}{ext}")
        return output_path
    except Exception as e:
        log.error(f"封面下载失败: {e}")
        return None

# ─── FFmpeg 合成 ─────────────────────────────────────────────────────
def merge_to_video(image_path, audio_path, output_path):
    """图片 loop + 音频 → MP4"""
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-framerate", "1",
        "-i", image_path,
        "-i", audio_path,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=800:800",
        "-shortest",
        "-loglevel", "error",
        output_path
    ]
    log.info(f"合成视频: {Path(output_path).name}")
    result = subprocess.run(cmd, capture_output=True, timeout=300)
    if result.returncode == 0 and Path(output_path).exists() and Path(output_path).stat().st_size > 1_000_000:
        size_mb = Path(output_path).stat().st_size / 1024 / 1024
        log.info(f"合成完成: {Path(output_path).name} ({size_mb:.1f}MB)")
        return True
    log.error(f"合成失败: {result.stderr.decode()[:200]}")
    return False

# ─── biliup 上传 ─────────────────────────────────────────────────────
def upload_to_bilibili(video_path, ep, summary=""):
    """使用 biliup 上传视频"""
    title = BILI_TITLE_FMT.format(ep=ep)
    desc = BILI_DESCRIPTION_FMT.format(ep=ep, summary=summary)

    cmd = [
        sys.executable, "-m", "biliup", "upload",
        "--title", title,
        "--desc", desc,
        "--tag", BILI_TAGS,
        "--tid", str(BILI_TID),
        "--copyright", str(BILI_COPYRIGHT),
        "--source", f"https://sakurazaka46.com/s/s46/diary/radio",
        video_path
    ]
    log.info(f"上传到 B 站: {title}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, cwd=str(BASE_DIR))

    if result.returncode == 0:
        log.info(f"上传成功: EP{ep}")
        # 提取 BV 号
        bv = re.search(r'(BV\w+)', result.stdout + result.stderr)
        return bv.group(1) if bv else "success"
    else:
        log.error(f"上传失败: {result.stderr[:500]}")
        return None

# ─── 主流程 ─────────────────────────────────────────────────────────
def process_episode(ep_info, state):
    """处理单个新期：下载+合成+上传"""
    ep = ep_info["ep"]
    ep_key = str(ep)

    if state["processed"].get(ep_key, {}).get("uploaded"):
        log.info(f"EP{ep} 已处理，跳过")
        return False

    log.info(f"=== 处理 EP{ep} ===")

    # 1. 获取 video_id（如果没有）
    video_id = ep_info.get("video_id")
    if not video_id:
        video_id = get_video_id(ep_info["detail_url"])
    if not video_id:
        log.error(f"EP{ep} 无法获取 video_id")
        return False

    # 2. 下载音频
    audio_path = download_audio(video_id, ep, AUDIO_DIR)
    if not audio_path:
        return False

    # 3. 下载封面
    cover_path = download_cover(ep_info.get("image_url"), ep, COVER_DIR)
    if not cover_path:
        # 使用默认封面占位
        log.warning(f"EP{ep} 使用空白封面")
        cover_path = None

    # 4. 合成视频
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    video_path = str(VIDEO_DIR / f"EP{ep:03d}.mp4")

    if Path(video_path).exists() and Path(video_path).stat().st_size > 1_000_000:
        log.info(f"EP{ep:03d} 视频已存在，跳过合成")
    elif cover_path:
        ok = merge_to_video(cover_path, audio_path, video_path)
        if not ok:
            return False
    else:
        log.error(f"EP{ep} 无封面，无法合成")
        return False

    # 5. 上传
    bv = upload_to_bilibili(video_path, ep)
    if bv:
        state["processed"][ep_key] = {
            "uploaded": True,
            "bv": bv,
            "uploaded_at": datetime.now(JST).isoformat(),
        }
        if ep > state.get("last_ep", 0):
            state["last_ep"] = ep
        save_state(state)
        log.info(f"EP{ep} 完成！BV: {bv}")
        return True

    return False

def check_and_process():
    """检查新期并处理"""
    log.info(f"开始检查新期... 当前时间: {datetime.now(JST).strftime('%Y-%m-%d %H:%M JST')}")
    state = load_state()

    entries = fetch_radio_list(count=5)
    if not entries:
        log.warning("无法获取列表（cookies 可能已过期）")
        return

    new_eps = [e for e in entries if e["ep"] > state.get("last_ep", 0)
               and not state["processed"].get(str(e["ep"]), {}).get("uploaded")]

    if not new_eps:
        log.info(f"没有新期（最新: EP{entries[0]['ep'] if entries else '?'}，已处理至: EP{state.get('last_ep', 0)}）")
        return

    log.info(f"发现 {len(new_eps)} 个新期: {[e['ep'] for e in new_eps]}")
    for ep_info in sorted(new_eps, key=lambda x: x["ep"]):
        process_episode(ep_info, state)

def run_once(ep_number):
    """手动处理指定期数"""
    log.info(f"手动处理 EP{ep_number}")
    state = load_state()

    # 从 radio_mapping.json 查找
    mapping_file = BASE_DIR / "radio_mapping.json"
    video_id = None
    image_url = None
    detail_url = None

    if mapping_file.exists():
        mapping = json.loads(mapping_file.read_text())
        if str(ep_number) in mapping:
            data = mapping[str(ep_number)]
            video_id = data.get("video_id")
            image_url = data.get("image", [None])[0] if data.get("image") else None
            detail_url = data.get("detail_url")

    ep_info = {
        "ep": ep_number,
        "video_id": video_id,
        "image_url": image_url,
        "detail_url": detail_url or "",
    }
    process_episode(ep_info, state)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="桜耳通信 自动投稿")
    parser.add_argument("--check", action="store_true", help="检查并处理新期")
    parser.add_argument("--ep", type=int, help="手动处理指定期数")
    parser.add_argument("--test", action="store_true", help="测试环境（不上传）")
    args = parser.parse_args()

    if args.test:
        log.info("=== 测试模式 ===")
        session = get_authed_session()
        log.info(f"登录: {'成功' if session else '失败'}")
        entries = fetch_radio_list(count=3)
        if entries:
            log.info(f"最新3期: {[e['ep'] for e in entries]}")
            log.info(f"  EP{entries[0]['ep']}: diary_id={entries[0]['diary_id']}, image={entries[0]['image_url']}")
            vid = get_video_id(entries[0]['detail_url'])
            log.info(f"  EP{entries[0]['ep']} Brightcove video_id: {vid}")
        sys.exit(0)

    if args.ep:
        run_once(args.ep)
    else:
        check_and_process()
