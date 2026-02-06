import os
import re
import zipfile
from typing import Optional, Tuple
from datetime import datetime


class CoverExtractor:
    """封面提取器：从书籍文件中提取封面图片"""

    def __init__(self, upload_dir: str = "uploads/covers"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    def extract_cover(
        self,
        file_path: str,
        manual_cover: Optional[bytes] = None,
        manual_filename: Optional[str] = None,
    ) -> Optional[str]:
        """
        提取或保存封面图片

        Args:
            file_path: 书籍文件路径
            manual_cover: 用户手动上传的封面图片数据
            manual_filename: 手动上传的文件名

        Returns:
            封面图片的相对路径，如果没有封面则返回 None
        """
        # 如果有手动上传的封面，优先使用
        if manual_cover:
            return self._save_manual_cover(manual_cover, manual_filename)

        # 否则尝试从文件中自动提取
        file_ext = os.path.splitext(file_path)[1].lower()

        try:
            if file_ext == ".epub":
                return self._extract_epub_cover(file_path)
            elif file_ext == ".mobi":
                return self._extract_mobi_cover(file_path)
            else:
                # txt, docx, pdf 等格式不支持自动提取封面
                return None
        except Exception as e:
            print(f"提取封面失败: {str(e)}")
            return None

    def _save_manual_cover(self, cover_data: bytes, filename: Optional[str]) -> str:
        """保存用户手动上传的封面"""
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if filename:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
                ext = ".jpg"
        else:
            ext = ".jpg"

        cover_filename = f"cover_{timestamp}{ext}"
        cover_path = os.path.join(self.upload_dir, cover_filename)

        # 保存文件
        with open(cover_path, "wb") as f:
            f.write(cover_data)

        return f"covers/{cover_filename}"

    def _extract_epub_cover(self, file_path: str) -> Optional[str]:
        """从 EPUB 文件中提取封面"""
        try:
            import ebooklib
            from ebooklib import epub
            from bs4 import BeautifulSoup

            book = epub.read_epub(file_path)

            # 方法1：查找 manifest 中声明的封面
            cover_item = None
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_IMAGE:
                    item_id = item.get_id()
                    # 检查是否是封面（通常 ID 包含 cover）
                    if "cover" in item_id.lower():
                        cover_item = item
                        break

            # 方法2：在 OPF 文件中查找封面元数据
            if not cover_item:
                # 获取 OPF 内容
                for item in book.get_items():
                    if item.get_type() == ebooklib.ITEM_UNKNOWN:
                        content = item.get_content().decode("utf-8", errors="ignore")
                        if 'name="cover"' in content or "name='cover'" in content:
                            # 解析出封面图片的 ID
                            match = re.search(
                                r'<meta[^>]*name=["\']cover["\'][^>]*content=["\']([^"\']+)["\']',
                                content,
                            )
                            if match:
                                cover_id = match.group(1)
                                # 查找对应 ID 的图片
                                for img_item in book.get_items():
                                    if img_item.get_id() == cover_id:
                                        cover_item = img_item
                                        break
                            break

            # 方法3：查找第一个图片作为封面
            if not cover_item:
                for item in book.get_items():
                    if item.get_type() == ebooklib.ITEM_IMAGE:
                        cover_item = item
                        break

            if cover_item:
                # 保存封面图片
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                ext = ".jpg"  # 默认扩展名
                content = cover_item.get_content()

                # 根据图片内容判断实际格式
                if content[:8] == b"\x89PNG\r\n\x1a\n":
                    ext = ".png"
                elif content[:2] == b"\xff\xd8":
                    ext = ".jpg"
                elif content[:4] == b"GIF8":
                    ext = ".gif"
                elif content[:4] == b"RIFF":
                    ext = ".webp"

                cover_filename = f"cover_{timestamp}{ext}"
                cover_path = os.path.join(self.upload_dir, cover_filename)

                with open(cover_path, "wb") as f:
                    f.write(content)

                return f"covers/{cover_filename}"

            return None

        except Exception as e:
            print(f"提取 EPUB 封面失败: {str(e)}")
            return None

    def _extract_mobi_cover(self, file_path: str) -> Optional[str]:
        """从 MOBI 文件中提取封面"""
        try:
            import mobi
            import shutil

            # 提取 MOBI 内容
            tempdir, filepath = mobi.extract(file_path)

            try:
                # 在提取的目录中查找封面图片
                cover_path = None

                # 方法1：查找名为 cover 的图片文件
                for root, dirs, files in os.walk(tempdir):
                    for file in files:
                        if "cover" in file.lower():
                            ext = os.path.splitext(file)[1].lower()
                            if ext in [".jpg", ".jpeg", ".png", ".gif"]:
                                cover_path = os.path.join(root, file)
                                break
                    if cover_path:
                        break

                # 方法2：查找第一个图片文件作为封面
                if not cover_path:
                    for root, dirs, files in os.walk(tempdir):
                        for file in files:
                            ext = os.path.splitext(file)[1].lower()
                            if ext in [".jpg", ".jpeg", ".png", ".gif"]:
                                cover_path = os.path.join(root, file)
                                break
                        if cover_path:
                            break

                if cover_path and os.path.exists(cover_path):
                    # 复制到封面目录
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    ext = os.path.splitext(cover_path)[1].lower()
                    cover_filename = f"cover_{timestamp}{ext}"
                    dest_path = os.path.join(self.upload_dir, cover_filename)

                    shutil.copy2(cover_path, dest_path)

                    return f"covers/{cover_filename}"

                return None

            finally:
                # 清理临时目录
                shutil.rmtree(tempdir, ignore_errors=True)

        except Exception as e:
            print(f"提取 MOBI 封面失败: {str(e)}")
            return None

    def delete_cover(self, cover_path: str):
        """删除封面图片"""
        if not cover_path:
            return

        full_path = os.path.join(self.upload_dir.replace("/covers", ""), cover_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception as e:
                print(f"删除封面失败: {str(e)}")
