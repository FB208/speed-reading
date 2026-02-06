import re
import os
from typing import List
from docx import Document
from sqlalchemy.orm import Session
from app.models import models


class BookProcessor:
    """书籍处理器：提取正文并分段（保留格式）"""

    def __init__(self, db: Session):
        self.db = db

    async def process_book(self, book_id: int, file_path: str):
        """处理书籍文件"""
        # 读取文件内容（保留HTML格式）
        content = self._read_file(file_path)

        # 不再清理内容
        cleaned_content = content

        # 分段（保留HTML标签）
        paragraphs = self._split_into_paragraphs(cleaned_content)

        # 保存段落到数据库
        for i, paragraph_content in enumerate(paragraphs, 1):
            # 计算纯文本字数（去除HTML标签）
            plain_text = self._strip_html_tags(paragraph_content)
            word_count = len(plain_text)

            paragraph = models.Paragraph(
                book_id=book_id,
                sequence=i,
                content=paragraph_content,
                word_count=word_count,
            )
            self.db.add(paragraph)

        # 更新书籍段落数
        book = self.db.query(models.Book).filter(models.Book.id == book_id).first()
        book.total_paragraphs = len(paragraphs)

        self.db.commit()

    def _strip_html_tags(self, html_content: str) -> str:
        """去除HTML标签，只保留纯文本"""
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html_content, "html.parser")
            return soup.get_text()
        except:
            # 如果BeautifulSoup不可用，使用简单的正则
            clean = re.sub(r"<[^>]+>", "", html_content)
            return clean

    def _read_file(self, file_path: str) -> str:
        """读取文件内容"""
        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext == ".txt":
            # 尝试多种编码
            encodings = ["utf-8", "gbk", "gb2312", "utf-16"]
            for encoding in encodings:
                try:
                    with open(file_path, "r", encoding=encoding) as f:
                        content = f.read()
                        # 将markdown格式转换为HTML
                        return self._convert_markdown_to_html(content)
                except UnicodeDecodeError:
                    continue
            raise Exception("无法识别文件编码")

        elif file_ext == ".docx":
            return self._read_docx_with_format(file_path)

        elif file_ext == ".epub":
            return self._read_epub_with_format(file_path)

        elif file_ext == ".mobi":
            return self._read_mobi_with_format(file_path)

        elif file_ext == ".pdf":
            return self._read_pdf(file_path)

        else:
            raise Exception(f"不支持的文件格式: {file_ext}")

    def _convert_markdown_to_html(self, content: str) -> str:
        """将Markdown格式转换为HTML"""
        # 转换标题
        content = re.sub(
            r"^#{1,6}\s+(.+)$",
            lambda m: f"<h{len(m.group(0)) - len(m.group(1)) - 1}>{m.group(1)}</h{len(m.group(0)) - len(m.group(1)) - 1}>",
            content,
            flags=re.MULTILINE,
        )

        # 转换加粗 **text** 或 __text__
        content = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", content)
        content = re.sub(r"__(.+?)__", r"<strong>\1</strong>", content)

        # 转换斜体 *text* 或 _text_
        content = re.sub(r"\*(.+?)\*", r"<em>\1</em>", content)
        content = re.sub(r"_(.+?)_", r"<em>\1</em>", content)

        # 转换段落（将空行分隔的文本包装为<p>标签）
        paragraphs = content.split("\n\n")
        result = []
        for para in paragraphs:
            para = para.strip()
            if para and not para.startswith("<"):
                para = f"<p>{para}</p>"
            result.append(para)

        return "\n\n".join(result)

    def _read_docx_with_format(self, file_path: str) -> str:
        """读取Word文档并保留格式"""
        try:
            doc = Document(file_path)
            html_parts = []

            for para in doc.paragraphs:
                if not para.text.strip():
                    continue

                # 检测标题样式
                style_name = para.style.name.lower()
                text = para.text

                # 应用格式
                formatted_text = text
                for run in para.runs:
                    run_text = run.text
                    if run.bold:
                        run_text = f"<strong>{run_text}</strong>"
                    if run.italic:
                        run_text = f"<em>{run_text}</em>"
                    # 替换原文中的这段文本
                    formatted_text = formatted_text.replace(run.text, run_text)

                # 根据样式添加标签
                if "heading 1" in style_name or "标题 1" in style_name:
                    html_parts.append(f"<h1>{formatted_text}</h1>")
                elif "heading 2" in style_name or "标题 2" in style_name:
                    html_parts.append(f"<h2>{formatted_text}</h2>")
                elif "heading 3" in style_name or "标题 3" in style_name:
                    html_parts.append(f"<h3>{formatted_text}</h3>")
                elif "heading" in style_name or "标题" in style_name:
                    html_parts.append(f"<h3>{formatted_text}</h3>")
                else:
                    html_parts.append(f"<p>{formatted_text}</p>")

            return "\n".join(html_parts)
        except Exception as e:
            # 如果失败，返回纯文本
            doc = Document(file_path)
            return "\n".join(
                [f"<p>{p.text}</p>" for p in doc.paragraphs if p.text.strip()]
            )

    def _read_epub_with_format(self, file_path: str) -> str:
        """读取EPUB文件并保留HTML格式"""
        try:
            import ebooklib
            from ebooklib import epub
            from bs4 import BeautifulSoup

            book = epub.read_epub(file_path)
            html_parts = []

            # 遍历所有文档项
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    # 保留原始HTML内容
                    content = item.get_content().decode("utf-8", errors="ignore")
                    soup = BeautifulSoup(content, "html.parser")

                    # 移除script和style标签
                    for script in soup(["script", "style"]):
                        script.decompose()

                    # 获取body内容，如果没有body则获取整个内容
                    body = soup.find("body")
                    if body:
                        html_parts.append(str(body))
                    else:
                        html_parts.append(str(soup))

            return "\n".join(html_parts)
        except Exception as e:
            raise Exception(f"读取EPUB文件失败: {str(e)}")

    def _read_mobi_with_format(self, file_path: str) -> str:
        """读取MOBI文件并保留HTML格式"""
        try:
            import mobi
            from bs4 import BeautifulSoup

            # 使用mobi库提取内容
            tempdir, filepath = mobi.extract(file_path)

            # 读取提取的HTML文件
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # 清理临时文件
            import shutil

            shutil.rmtree(tempdir, ignore_errors=True)

            # 解析并清理HTML
            soup = BeautifulSoup(content, "html.parser")

            # 移除script和style标签
            for script in soup(["script", "style"]):
                script.decompose()

            return str(soup)
        except Exception as e:
            raise Exception(f"读取MOBI文件失败: {str(e)}")

    def _read_pdf(self, file_path: str) -> str:
        """读取PDF文件（PDF不支持富文本格式）"""
        try:
            from PyPDF2 import PdfReader

            reader = PdfReader(file_path)
            html_parts = []

            for page in reader.pages:
                text = page.extract_text()
                if text:
                    # 将PDF文本包装为HTML段落
                    paragraphs = text.split("\n\n")
                    for para in paragraphs:
                        if para.strip():
                            html_parts.append(f"<p>{para.strip()}</p>")

            return "\n".join(html_parts)
        except Exception as e:
            raise Exception(f"读取PDF文件失败: {str(e)}")

    def _clean_content(self, content: str) -> str:
        """清理内容：保留全部内容，不进行自动清理"""
        return content

    def _split_into_paragraphs(self, content: str) -> List[str]:
        """
        将内容分段（保留HTML格式）
        规则：按自然段拆分，如果纯文本不足1000字则合并下一个自然段
        """
        # 对于HTML内容，按<p>, <div>, <h1>-<h6>等标签分割
        if "<" in content and ">" in content:
            return self._split_html_paragraphs(content)
        else:
            # 纯文本分段
            return self._split_text_paragraphs(content)

    def _split_html_paragraphs(self, content: str) -> List[str]:
        """分割HTML段落（保留标签）"""
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(content, "html.parser")

            # 获取所有顶级元素
            elements = []
            for elem in soup.find_all(
                ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"]
            ):
                if elem.parent.name in [
                    "body",
                    "html",
                    "[document]",
                ] or elem.parent.name not in ["p", "div"]:
                    elements.append(str(elem))

            if not elements:
                # 如果没有找到合适的元素，返回整个内容
                return [content]

            # 合并段落（根据纯文本字数）
            result = []
            current_paragraph = ""
            current_text_length = 0

            for elem_str in elements:
                elem_soup = BeautifulSoup(elem_str, "html.parser")
                text_length = len(elem_soup.get_text())

                if not current_paragraph:
                    current_paragraph = elem_str
                    current_text_length = text_length
                else:
                    # 如果当前段落不足1000字，合并
                    if current_text_length < 1000:
                        current_paragraph += "\n" + elem_str
                        current_text_length += text_length
                    else:
                        # 当前段落已足够长，保存并开始新段落
                        result.append(current_paragraph)
                        current_paragraph = elem_str
                        current_text_length = text_length

            # 处理最后一个段落
            if current_paragraph:
                result.append(current_paragraph)

            return result if result else [content]
        except Exception as e:
            # 如果解析失败，返回整个内容
            return [content]

    def _split_text_paragraphs(self, content: str) -> List[str]:
        """分割纯文本段落"""
        # 先按自然段分割
        raw_paragraphs = [p.strip() for p in content.split("\n") if p.strip()]

        result = []
        current_paragraph = ""

        for raw_para in raw_paragraphs:
            # 如果当前段落为空，直接添加
            if not current_paragraph:
                current_paragraph = raw_para
            else:
                # 如果当前段落不足1000字，合并
                if len(current_paragraph) < 1000:
                    current_paragraph += "\n" + raw_para
                else:
                    # 当前段落已足够长，保存并开始新段落
                    result.append(current_paragraph)
                    current_paragraph = raw_para

        # 处理最后一个段落
        if current_paragraph:
            result.append(current_paragraph)

        return result
