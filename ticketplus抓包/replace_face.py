"""
mitmproxy 脚本：替换 tixplus 顔写真图片

使用方法：
  本地测试: mitmweb -s replace_face.py
  服务器: mitmdump -s replace_face.py --set flow_detail=0

配置：
  1. 将替换用的图片放在 ./fake_face.jpg
  2. 或者设置 FAKE_FACE_URL 环境变量指向在线图片
"""

import os
import json
import base64
from mitmproxy import http, ctx

# 配置
FAKE_FACE_PATH = os.path.join(os.path.dirname(__file__), "fake_face.jpg")
FAKE_FACE_URL = os.environ.get("FAKE_FACE_URL", "")

# 缓存替换图片的 base64
_fake_face_b64 = None

def get_fake_face_b64():
    """获取替换图片的 base64 编码"""
    global _fake_face_b64
    if _fake_face_b64:
        return _fake_face_b64
    
    if os.path.exists(FAKE_FACE_PATH):
        with open(FAKE_FACE_PATH, "rb") as f:
            _fake_face_b64 = base64.b64encode(f.read()).decode("utf-8")
        ctx.log.info(f"[FaceReplace] 已加载本地图片: {FAKE_FACE_PATH}")
        return _fake_face_b64
    
    ctx.log.warn(f"[FaceReplace] 未找到替换图片: {FAKE_FACE_PATH}")
    return None


class FaceReplacer:
    """拦截并替换顔写真"""
    
    def response(self, flow: http.HTTPFlow) -> None:
        # 只处理 emtg 的 face-picture 接口
        if "emtg" not in flow.request.host:
            return
        
        path = flow.request.path
        
        # 方案1: 替换 check 接口返回的 URL
        if "/img/eticket-face-picture/check/" in path:
            self.replace_check_response(flow)
        
        # 方案2: 替换 load 接口返回的图片数据
        elif "/img/eticket-face-picture/load/" in path:
            self.replace_load_response(flow)
        
        # 方案3: 直接替换 S3 图片请求
        elif "tixplus_face_pictures" in path and flow.request.host.endswith("amazonaws.com"):
            self.replace_s3_image(flow)
    
    def replace_check_response(self, flow: http.HTTPFlow):
        """替换 check 接口的返回 URL"""
        try:
            data = json.loads(flow.response.content)
            original_url = data.get("response", {}).get("url", "")
            
            if original_url and FAKE_FACE_URL:
                # 替换为自定义 URL
                data["response"]["url"] = FAKE_FACE_URL
                flow.response.content = json.dumps(data).encode()
                ctx.log.info(f"[FaceReplace] ✅ 替换 check URL: {original_url[:50]}... -> {FAKE_FACE_URL[:50]}...")
            else:
                ctx.log.info(f"[FaceReplace] check 接口原始 URL: {original_url[:80]}...")
        except Exception as e:
            ctx.log.error(f"[FaceReplace] check 替换失败: {e}")
    
    def replace_load_response(self, flow: http.HTTPFlow):
        """替换 load 接口的图片数据 (base64)"""
        try:
            fake_b64 = get_fake_face_b64()
            if not fake_b64:
                return
            
            data = json.loads(flow.response.content)
            
            # 检查响应结构，替换图片数据
            if "response" in data:
                resp = data["response"]
                # 可能的字段名: image, data, picture, face, photo
                for key in ["image", "data", "picture", "face", "photo", "img", "base64"]:
                    if key in resp and isinstance(resp[key], str):
                        original_len = len(resp[key])
                        resp[key] = fake_b64
                        flow.response.content = json.dumps(data).encode()
                        ctx.log.info(f"[FaceReplace] ✅ 替换 load 图片数据 (字段: {key}, 原始: {original_len} -> 新: {len(fake_b64)})")
                        return
            
            # 如果找不到图片字段，打印响应结构供调试
            ctx.log.info(f"[FaceReplace] load 响应字段: {list(data.get('response', {}).keys())}")
        except Exception as e:
            ctx.log.error(f"[FaceReplace] load 替换失败: {e}")
    
    def replace_s3_image(self, flow: http.HTTPFlow):
        """直接替换 S3 返回的图片"""
        try:
            if not os.path.exists(FAKE_FACE_PATH):
                ctx.log.warn(f"[FaceReplace] S3 替换需要本地图片: {FAKE_FACE_PATH}")
                return
            
            with open(FAKE_FACE_PATH, "rb") as f:
                fake_image = f.read()
            
            flow.response.content = fake_image
            flow.response.headers["content-length"] = str(len(fake_image))
            flow.response.headers["content-type"] = "image/jpeg"
            ctx.log.info(f"[FaceReplace] ✅ 替换 S3 图片: {flow.request.path[:60]}...")
        except Exception as e:
            ctx.log.error(f"[FaceReplace] S3 替换失败: {e}")


addons = [FaceReplacer()]
