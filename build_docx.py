# -*- coding: utf-8 -*-
'''构建《居家呼吸声学监测算法与 RK3576 边缘端部署平台》项目简介 Word 文档。

字体统一为宋体（SimSun），中英文均使用宋体，标题加粗。
'''
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

import content as C

FONT = "宋体"
ACCENT = RGBColor(0x1F, 0x4E, 0x79)      # 深蓝：一级标题
ACCENT2 = RGBColor(0x2E, 0x74, 0xB5)     # 中蓝：二/三级标题
DARK = RGBColor(0x00, 0x00, 0x00)
GREY = RGBColor(0x59, 0x59, 0x59)
HEADER_FILL = "1F4E79"                   # 表头底色
ZEBRA_FILL = "EDF3F9"                    # 隔行底色
CALLOUT_FILL = "EEF4FA"                  # 摘要框底色

PAGE_W_CM = 21.0                         # A4 宽
PAGE_H_CM = 29.7                         # A4 高
MARGIN_LR_CM = 2.3                       # 左右页边距 -> 版心 16.4 cm
TABLE_TOTAL_CM = 16.1                    # 所有表格统一按此总宽缩放，确保不溢出


def fit_widths(widths):
    '''按比例把列宽缩放到 TABLE_TOTAL_CM，保证表格不超出可用版心宽度。'''
    total = float(sum(widths))
    if total <= 0:
        return list(widths)
    k = TABLE_TOTAL_CM / total
    return [w * k for w in widths]


# ---------------------------------------------------------------- 底层工具
def set_run(run, size=10.5, bold=False, color=None, italic=False, font=FONT):
    run.font.name = font
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color if color is not None else DARK
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rFonts.set(qn(attr), font)
    return run


def shade(element, fill):
    '''给单元格/段落加底色。'''
    pr = element.get_or_add_tcPr() if element.tag.endswith("}tc") else element.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pr.append(shd)


def cell_shade(cell, fill):
    shade(cell._tc, fill)


def para_box(paragraph, fill):
    shade(paragraph._p, fill)


def cell_margins(table, top=60, bottom=60, left=90, right=90):
    tblPr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for tag, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement("w:" + tag)
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tblPr.append(mar)


def repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    node = OxmlElement("w:tblHeader")
    node.set(qn("w:val"), "true")
    trPr.append(node)


def keep_with_next(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    node = OxmlElement("w:keepNext")
    pPr.append(node)


# ---------------------------------------------------------------- 样式初始化
def init_styles(doc):
    st = doc.styles["Normal"]
    st.font.name = FONT
    st.font.size = Pt(10.5)
    st.font.color.rgb = DARK
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    st.element.rPr.rFonts.set(qn("w:ascii"), FONT)
    st.element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    pf = st.paragraph_format
    pf.line_spacing = 1.4
    pf.space_after = Pt(4)

    for name, size, color, before, after in (
        ("Heading 1", 15, ACCENT, 16, 8),
        ("Heading 2", 12.5, ACCENT2, 12, 5),
        ("Heading 3", 11, ACCENT2, 9, 4),
    ):
        s = doc.styles[name]
        s.font.name = FONT
        s.font.size = Pt(size)
        s.font.bold = True
        s.font.color.rgb = color
        s.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        s.element.rPr.rFonts.set(qn("w:ascii"), FONT)
        s.element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        s.paragraph_format.space_before = Pt(before)
        s.paragraph_format.space_after = Pt(after)
        s.paragraph_format.line_spacing = 1.25
        s.paragraph_format.keep_with_next = True


def add_page_number_footer(doc):
    for section in doc.sections:
        p = section.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("第 ")
        set_run(r, 9, color=GREY)
        fld = OxmlElement("w:fldSimple")
        fld.set(qn("w:instr"), "PAGE")
        inner = OxmlElement("w:r")
        rPr = OxmlElement("w:rPr")
        for tag in ("w:rFonts", "w:sz"):
            node = OxmlElement(tag)
            if tag == "w:rFonts":
                for a in ("w:ascii", "w:hAnsi", "w:eastAsia"):
                    node.set(qn(a), FONT)
            else:
                node.set(qn("w:val"), "18")
            rPr.append(node)
        inner.append(rPr)
        t = OxmlElement("w:t")
        t.text = "1"
        inner.append(t)
        fld.append(inner)
        p._p.append(fld)
        r2 = p.add_run(" 页")
        set_run(r2, 9, color=GREY)


# ---------------------------------------------------------------- 构建块
def H(doc, text, level):
    p = doc.add_paragraph(style="Heading %d" % level)
    set_run(p.add_run(text), {1: 15, 2: 12.5, 3: 11}[level], True,
            {1: ACCENT, 2: ACCENT2, 3: ACCENT2}[level])
    return p


def para(doc, text, indent=True, size=10.5, align=None, after=4, color=None):
    p = doc.add_paragraph()
    if indent:
        p.paragraph_format.first_line_indent = Pt(size * 2)
    p.paragraph_format.space_after = Pt(after)
    if align is not None:
        p.alignment = align
    set_run(p.add_run(text), size, color=color)
    return p


def bullet(doc, text, level=0):
    # 不用 List Bullet 样式：其编号缩进会与自定义缩进叠加，导致文本越出版心。
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.75 + 0.6 * level)
    p.paragraph_format.first_line_indent = Cm(-0.5)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.35
    body = text
    if "：" in text and text.index("：") < 26:
        head, tail = text.split("：", 1)
        set_run(p.add_run("● " if level == 0 else "○ "), 9, color=ACCENT2)
        set_run(p.add_run(head + "："), 10.5, bold=True)
        set_run(p.add_run(tail), 10.5)
    else:
        set_run(p.add_run("● " if level == 0 else "○ "), 9, color=ACCENT2)
        set_run(p.add_run(body), 10.5)
    return p


def set_table_widths(t, widths_cm):
    '''显式写入 tblGrid / tblW / tblLayout=fixed 与每个单元格宽度。

    python-docx 只设置单元格宽度，会留下与实际列宽不一致的 tblGrid，
    导致 LibreOffice 等渲染器按 tblGrid 把表格拉成等宽并溢出页面。
    '''
    tbl = t._tbl
    tblPr = tbl.tblPr
    for tag in ("w:tblW", "w:tblLayout"):
        el = tblPr.find(qn(tag))
        if el is not None:
            tblPr.remove(el)

    tblW = OxmlElement("w:tblW")
    tblW.set(qn("w:w"), str(int(round(sum(widths_cm) * 567))))
    tblW.set(qn("w:type"), "dxa")
    tblPr.append(tblW)

    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblPr.append(layout)

    grid = tbl.find(qn("w:tblGrid"))
    if grid is not None:
        tbl.remove(grid)
    grid = OxmlElement("w:tblGrid")
    for w in widths_cm:
        gc = OxmlElement("w:gridCol")
        gc.set(qn("w:w"), str(int(round(w * 567))))
        grid.append(gc)
    tbl.insert(list(tbl).index(tblPr) + 1, grid)

    for row in t.rows:
        for i, w in enumerate(widths_cm):
            if i < len(row.cells):
                row.cells[i].width = Cm(w)


def table(doc, headers, rows, widths=None, size=9.5):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    cell_margins(t)

    hdr = t.rows[0]
    for i, h in enumerate(headers):
        c = hdr.cells[i]
        c.text = ""
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.15
        set_run(p.add_run(h), size, True, RGBColor(0xFF, 0xFF, 0xFF))
        cell_shade(c, HEADER_FILL)
    repeat_header(hdr)

    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, val in enumerate(row):
            c = cells[i]
            c.text = ""
            lines = str(val).split("\n")
            for li, line in enumerate(lines):
                p = c.paragraphs[0] if li == 0 else c.add_paragraph()
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.15
                if i > 0 and li == 0 and (line.startswith("√") or line.startswith("×")):
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                set_run(p.add_run(line), size)
            if ri % 2 == 1:
                cell_shade(c, ZEBRA_FILL)

    if widths:
        set_table_widths(t, fit_widths(widths))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def callout(doc, title_text, lines):
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    t.autofit = False
    cell = t.rows[0].cells[0]
    cell.width = Cm(16.0)
    cell.text = ""
    cell_margins(t, top=120, bottom=120, left=160, right=160)
    cell_shade(cell, CALLOUT_FILL)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    set_run(p.add_run(title_text), 11, True, ACCENT)
    for line in lines:
        q = cell.add_paragraph()
        q.paragraph_format.space_after = Pt(2)
        q.paragraph_format.line_spacing = 1.35
        q.paragraph_format.first_line_indent = Pt(21)
        set_run(q.add_run(line), 10.5)
    set_table_widths(t, [TABLE_TOTAL_CM])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(4)
    set_run(p.add_run(text), 9, color=GREY)


def add_figure(doc, path, cap, width_cm=15.4):
    '''插入插图并附图注；文件不存在时静默跳过，保证构建不中断。'''
    import os
    if not os.path.exists(path):
        return None
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width_cm))
    q = doc.add_paragraph()
    q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    q.paragraph_format.space_after = Pt(8)
    set_run(q.add_run(cap), 9, color=GREY)
    return p


def page_break(doc):
    doc.add_page_break()


# ---------------------------------------------------------------- 页面各区块
def build_cover(doc):
    for _ in range(2):
        p = doc.add_paragraph()
        set_run(p.add_run(""), 12)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(6)
    set_run(p.add_run("中国大学生“挑战杯”系列竞赛"), 12, color=GREY)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run("参赛项目简介"), 16, True, ACCENT)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    set_run(p.add_run("居家呼吸声学监测算法"), 20, True, ACCENT)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(8)
    set_run(p.add_run("与 RK3576 边缘端部署平台"), 20, True, ACCENT)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(4)
    set_run(p.add_run("——让每一次咳嗽都被听见，让呼吸慢病管理有据可依"), 10.5, False, ACCENT2)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(18)
    set_run(p.add_run("面向哮喘 / 慢阻肺 / 儿童喘息的院外长程声学监测与急性加重预警"), 10, color=GREY)

    info = [
        ("项目名称", "居家呼吸声学监测算法与 RK3576 边缘端部署平台"),
        ("项目类别", "科技发明制作 / 信息技术与人工智能"),
        ("团队人数", "8 人"),
        ("所属单位", "【待填写：学校 / 学院】"),
        ("指导教师", "【待填写：姓名 / 职称】"),
        ("团队负责人", "【待填写：姓名 / 联系方式】"),
        ("项目阶段", "原理样机与算法验证阶段（TRL 4–5）"),
        ("文档版本", "V1.0"),
        ("编制日期", "【待填写：年 月 日】"),
    ]
    t = doc.add_table(rows=0, cols=2)
    t.style = "Table Grid"
    t.autofit = False
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell_margins(t, top=70, bottom=70, left=120, right=120)
    for k, v in info:
        cells = t.add_row().cells
        for idx, txt in enumerate((k, v)):
            c = cells[idx]
            c.text = ""
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.3
            if idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                set_run(p.add_run(txt), 10, True, ACCENT)
                cell_shade(c, ZEBRA_FILL)
            else:
                set_run(p.add_run(txt), 10)
    set_table_widths(t, [2.6, 6.0])
    page_break(doc)


def build_usage(doc):
    H(doc, "文档使用说明：如何从本文档写出商业计划书与 PPT", 1)
    para(doc, "本文档是项目的“总纲式”材料：它同时承载技术方案、临床依据、市场判断、商业模式与合规路径五条主线。"
              "读者读完本文档即可独立完成一份完整的商业计划书与一套答辩 PPT，无需再补充背景调研。建议按下面的映射关系使用。")
    H(doc, "一、商业计划书章节映射", 2)
    table(doc,
          ["商业计划书章节", "本文档对应章节", "可直接改写的内容"],
          [["项目概述 / 执行摘要", "第一章、第二章", "痛点—方案—价值主张，核心指标表可直接作摘要数据来源"],
           ["行业与市场分析", "第七章 7.1", "流行病学数据、市场规模、政策环境"],
           ["产品与技术", "第四章、第五章", "四层架构、算法链路、RK3576 部署与量化指标、创新点"],
           ["竞争分析", "第七章 7.2、7.3", "竞品对比表与差异化护城河三条论述"],
           ["商业模式", "第八章 8.1–8.3", "四条收入线、定价、成本与获客渠道"],
           ["财务预测", "第八章 8.4", "三年预测表与关键假设，替换为实际测算即可"],
           ["实施计划与里程碑", "第九章", "三阶段路线图与里程碑表"],
           ["风险与应对", "第十章", "技术/临床/合规/商业四类风险及预案"],
           ["团队介绍", "附录 C", "按 8 人分工填写（硬件、算法、嵌入式、软件、临床、市场）"]],
          widths=[3.6, 3.6, 8.8])
    H(doc, "二、PPT 页面映射（建议 16–20 页）", 2)
    table(doc,
          ["PPT 页", "页面主题", "取用本文档内容"],
          [["P1", "封面：项目名 + 一句话定位", "封面页 + 第一章价值主张"],
           ["P2", "问题：呼吸慢病院外管理是盲区", "2.1、2.2"],
           ["P3", "现有监测手段的四个痛点", "2.3"],
           ["P4", "解决方案总览（一图讲清）", "3.2 总体架构"],
           ["P5", "产品形态与使用场景", "4.1 系统组成 + 4.4 应用界面"],
           ["P6", "硬件与边缘端方案", "4.2、4.3"],
           ["P7", "算法技术链路", "5.1–5.3"],
           ["P8", "RK3576 部署与性能指标", "5.4、5.5 指标表与资源预算"],
           ["P9", "核心创新点四条", "第六章"],
           ["P10", "临床证据与验证方案", "2.1、6.2、第九章"],
           ["P11", "合规路径", "6.3"],
           ["P12", "市场空间与政策利好", "7.1"],
           ["P13", "竞品对比矩阵", "7.2 对比表"],
           ["P14", "差异化与护城河", "7.3"],
           ["P15", "商业模式与收入结构", "8.1–8.3"],
           ["P16", "三年财务预测", "8.4"],
           ["P17", "里程碑与执行计划", "第九章"],
           ["P18", "风险与应对", "第十章"],
           ["P19", "团队与分工", "附录 C"],
           ["P20", "结尾：愿景 + 联系方式", "第一章愿景，附录 C"]],
          widths=[1.6, 5.4, 9.0])
    H(doc, "三、答辩高频问题准备清单", 2)
    bullets = [
        "凭什么证明声学指标可信：用第二章的临床证据与第六章的验证方案回答，核心是与金标准的一致性研究设计，而不是单点准确率。",
        "为什么要 RK3576 而不是直接上云：用 5.4 的算力/功耗/延时/隐私四维对比回答，强调离线可用与合规成本。",
        "手机麦克风一致性差怎么办：用 4.2、5.2 的设备校准与归一化方案，以及多机型一致性测试计划回答。",
        "医疗器械注册要多久、要多少钱：用 6.3 的分类判断与注册路径，给出二类器械的时间与费用区间及降级方案。",
        "数据从哪来、模型会不会过拟合：用 5.3 的数据来源组合（公开集 + 合作医院 + 自采 + 仿真增强）与跨中心留出集回答。",
        "商业模式能否成立：用第八章四条收入线的客单价与转化假设回答，强调药企临床试验终点监测是现金流起点。",
        "与 Hyfe、ResApp 等国外产品的差距：用 7.2、7.3 回答，落在国产化、边缘隐私、成本与中文场景适配上。",
        "团队 8 人如何覆盖软硬件与临床：用附录 C 的分工表与外部合作资源回答。",
    ]
    for b in bullets:
        bullet(doc, b)
    page_break(doc)


def build_front_matter(doc):
    H(doc, "第一章 项目概述与执行摘要", 1)
    H(doc, "1.1 一句话定位", 2)
    para(doc, "本项目以手机（及低成本拾音配件）作为居家呼吸声采集前端，以国产瑞芯微 RK3576 芯片构成边缘计算节点，"
              "在家庭真实噪声环境下完成咳嗽、喘息等异常呼吸声事件的实时识别与统计，"
              "将以往只能靠患者主观回忆描述的“咳了多少次、夜里咳得厉害不厉害”，"
              "转化为可量化、可回溯、可预警的客观声学指标，"
              "为哮喘、慢阻肺（COPD）与儿童喘息的长期管理与急性加重预警提供数据底座。")
    H(doc, "1.2 执行摘要", 2)
    callout(doc, "项目摘要", [
        "痛点：我国呼吸慢病患者基数巨大，但院外时段几乎处于“监测真空”。患者靠回忆描述症状，医生拿不到连续客观数据，"
        "急性加重往往在就诊时才被发现，错过最佳干预窗口。",
        "方案：构建“手机采集 + RK3576 边缘推理 + 云端管理 + 三端应用”的四层系统，"
        "输出咳嗽频次、夜间咳嗽指数、喘息检出、呼吸率四类核心指标与个体化基线预警。",
        "技术：前端采用轻量声学事件检测网络实现低功耗常听，后端采用多任务网络完成事件分类与指标回归；"
        "经 RKNN-Toolkit2 量化部署到 RK3576 的 6 TOPS NPU，实现音频不出户、推理在本地。",
        "价值：对患者是“看得见的病情曲线”，对医生是“院外随访的连续证据”，"
        "对药企是“可替代人工日记的临床试验终点工具”，对基层医疗是“低成本的筛查与分层抓手”。",
        "路径：先以健康管理工具形态验证技术与用户留存，同步积累标注数据；"
        "在数据与验证充分后，按第二类医疗器械申报咳嗽/呼吸音监测软件，进入院内收费与药企合作场景。",
    ])
    H(doc, "1.3 项目核心指标一览", 2)
    table(doc, C.CORE_METRICS[0], C.CORE_METRICS[1], widths=[3.2, 4.6, 8.2])
    caption(doc, "注：表中性能指标为项目设计目标（验收口径），实测数据在样机测试报告中给出；市场数据来源见附录 B。")
    H(doc, "1.4 项目愿景", 2)
    para(doc, "让呼吸慢病的院外管理从“凭感觉”走向“凭数据”：三年内成为国内居家呼吸声学监测的算法与边缘部署方案供应商，"
              "五年内推动声学指标进入呼吸慢病随访与药物临床试验的标准评价体系。")

    H(doc, "第二章 项目背景与需求分析", 1)
    H(doc, "2.1 临床背景：呼吸慢病的院外管理困境", 2)
    para(doc, "哮喘与慢阻肺是我国最主要的慢性呼吸系统疾病，具有患病人数多、病程长、需终身管理的特点，"
              "而疾病控制水平长期不理想。其临床特征决定了这类疾病极度依赖“院外、长期、连续”的观察："
              "咳嗽与喘息是病情波动最敏感的早期信号，夜间症状加重常先于肺功能下降与急性加重出现。")
    for b in C.CLINICAL_BG:
        bullet(doc, b)
    H(doc, "2.2 现有监测手段的局限", 2)
    table(doc, C.LIMITS[0], C.LIMITS[1], widths=[2.8, 6.4, 6.8])
    para(doc, "综合来看，现有手段共同的缺口是：无法在家庭环境中、以可接受的成本、连续地获得客观的咳嗽与呼吸声学数据。"
              "这正是本项目的切入点。")
    H(doc, "2.3 用户需求分层", 2)
    table(doc, C.USERS[0], C.USERS[1], widths=[2.8, 5.0, 8.2])
    H(doc, "2.4 为什么是声学：技术可行性依据", 2)
    for b in C.WHY_ACOUSTIC:
        bullet(doc, b)
    H(doc, "2.5 需求验证情况", 2)
    for b in C.DEMAND_EVIDENCE:
        bullet(doc, b)
    page_break(doc)


def build_solution(doc):
    H(doc, "第三章 总体方案与系统架构", 1)
    H(doc, "3.1 设计原则", 2)
    for b in C.PRINCIPLES:
        bullet(doc, b)
    H(doc, "3.2 系统总体架构（四层）", 2)
    para(doc, "系统采用“端—边—云—用”四层架构，各层职责清晰、接口标准化，便于分期实现与独立迭代：")
    table(doc, C.ARCH[0], C.ARCH[1], widths=[2.2, 4.2, 9.6])
    add_figure(doc, "architecture.png",
               "图 3-1  居家呼吸声学监测系统总体架构（可直接用于商业计划书与答辩 PPT）")
    para(doc, "数据流闭环：手机采集 → 边缘端实时推理与本地缓存 → 指标与事件摘要上云 → 云端趋势分析与模型迭代 → 医生端与患者端呈现 → "
              "复诊反馈与用药调整 → 新的标注数据回流训练集。该闭环既是产品价值闭环，也是算法持续改进的数据闭环。")
    H(doc, "3.3 关键设计取舍", 2)
    table(doc, C.TRADEOFFS[0], C.TRADEOFFS[1], widths=[3.0, 6.0, 7.0])
    H(doc, "3.4 技术路线图", 2)
    table(doc, C.TECH_ROADMAP[0], C.TECH_ROADMAP[1], widths=[2.4, 4.0, 3.4, 3.0, 3.2])
    page_break(doc)


def build_hardware(doc):
    H(doc, "第四章 系统实现方案", 1)
    H(doc, "4.1 硬件设计：手机端与边缘端", 2)
    H(doc, "4.1.1 采集前端（手机 / 拾音配件）", 3)
    for b in C.FRONTEND_HW:
        bullet(doc, b)
    H(doc, "4.1.2 边缘计算节点（RK3576）", 3)
    para(doc, "边缘节点是系统的算力与隐私核心，承担音频前端处理、AI 推理、本地存储与断网续传。"
              "选型 RK3576 的关键理由在于：它同时具备可用的 NPU 算力、丰富的音频接口、"
              "较低的整体功耗以及国产供应链的可获得性。")
    table(doc, C.RK3576[0], C.RK3576[1], widths=[3.4, 12.6])
    H(doc, "4.1.3 硬件成本预算（单台边缘节点）", 3)
    table(doc, C.BOM[0], C.BOM[1], widths=[3.6, 4.2, 2.6, 5.6])
    caption(doc, "注：为小批量试产阶段的估算价，量产 5000 台以上时结构件与线材成本可显著下降；实际以采购询价为准。")
    H(doc, "4.1.4 麦克风阵列与声学结构", 3)
    for b in C.MIC_ARRAY:
        bullet(doc, b)
    H(doc, "4.2 手机端 APP 方案", 2)
    table(doc, C.APP[0], C.APP[1], widths=[2.8, 6.4, 6.8])
    H(doc, "4.3 云端管理平台", 2)
    table(doc, C.CLOUD[0], C.CLOUD[1], widths=[3.2, 6.0, 6.8])
    H(doc, "4.4 应用界面与交互设计", 2)
    table(doc, C.UI[0], C.UI[1], widths=[2.4, 6.6, 7.0])
    H(doc, "4.5 安全与隐私设计", 2)
    for b in C.PRIVACY:
        bullet(doc, b)
    page_break(doc)


def build_algorithm(doc):
    H(doc, "第五章 算法方案", 1)
    H(doc, "5.1 算法总体链路", 2)
    para(doc, "算法采用“两级检测 + 多任务输出”的分层架构，核心思想是让高算力模型只在真正有事件发生时启动，"
              "从而在精度与功耗之间取得平衡。")
    table(doc, C.PIPELINE[0], C.PIPELINE[1], widths=[1.4, 3.0, 6.2, 5.4])
    H(doc, "5.2 声学前端处理", 2)
    for b in C.FRONTEND_ALGO:
        bullet(doc, b)
    H(doc, "5.3 模型设计与训练策略", 2)
    H(doc, "5.3.1 模型结构", 3)
    table(doc, C.MODELS[0], C.MODELS[1], widths=[3.2, 6.0, 6.8])
    H(doc, "5.3.2 训练策略", 3)
    for b in C.TRAINING:
        bullet(doc, b)
    H(doc, "5.3.3 数据来源与标注规范", 3)
    table(doc, C.DATASETS[0], C.DATASETS[1], widths=[3.4, 3.0, 4.2, 5.4])
    H(doc, "5.4 RK3576 边缘端部署方案", 2)
    para(doc, "部署主链路为：PyTorch 训练 → ONNX 导出 → RKNN-Toolkit2 量化转换 → RKNN Runtime 推理。"
              "其中量化是精度的最大风险点，也是本项目重点攻关环节。")
    for b in C.DEPLOY:
        bullet(doc, b)
    H(doc, "5.5 性能指标与资源预算", 2)
    table(doc, C.PERF[0], C.PERF[1], widths=[3.4, 3.0, 3.4, 6.2])
    caption(doc, "注：以上为设计目标值。NPU 利用率与功耗需在样机上以实测为准（见 5.6 验证方法）。")
    H(doc, "5.6 验证方法与评估口径", 2)
    for b in C.VALIDATION_METHOD:
        bullet(doc, b)
    page_break(doc)


def build_innovation(doc):
    H(doc, "第六章 项目创新点与知识产权", 1)
    H(doc, "6.1 技术创新点", 2)
    for i, (title, body) in enumerate(C.INNOVATIONS, 1):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(7)
        p.paragraph_format.space_after = Pt(2)
        set_run(p.add_run("创新点 %d  %s" % (i, title)), 11, True, ACCENT2)
        keep_with_next(p)
        para(doc, body)
    H(doc, "6.2 应用与模式创新", 2)
    for b in C.APP_INNOVATION:
        bullet(doc, b)
    H(doc, "6.3 知识产权规划", 2)
    table(doc, C.IP[0], C.IP[1], widths=[2.4, 5.2, 3.4, 5.0])
    caption(doc, "注：知识产权清单为规划目标，用于说明技术壁垒的构建路径，非已授权成果。")
    page_break(doc)


def build_clinical(doc):
    H(doc, "第七章 临床价值与验证方案", 1)
    H(doc, "7.1 临床证据基础", 2)
    para(doc, "声学指标用于呼吸疾病评价并非全新概念，其有效性已被一系列研究支持。这些研究构成本项目的科学依据，"
              "也说明该方向具备可验证的临床终点。")
    table(doc, C.EVIDENCE[0], C.EVIDENCE[1], widths=[1.0, 4.6, 3.2, 3.2, 4.0])
    caption(doc, "注：表中数据为文献报道值，用于说明方向可行性；具体来源见附录 B，引用时请核对原文。")
    H(doc, "7.2 临床价值主张", 2)
    table(doc, C.CLINICAL_VALUE[0], C.CLINICAL_VALUE[1], widths=[3.0, 6.2, 6.8])
    H(doc, "7.3 临床验证方案设计", 2)
    table(doc, C.TRIAL[0], C.TRIAL[1], widths=[2.8, 6.2, 7.0])
    H(doc, "7.4 合规路径与注册规划", 2)
    para(doc, "合规是医疗类项目最容易被评委追问、也最容易翻车的环节。本项目采取“先健康管理、后医疗器械”的分步策略，"
              "在每一步严格守住宣称边界，避免因越界宣传导致注册障碍。")
    table(doc, C.COMPLIANCE[0], C.COMPLIANCE[1], widths=[2.6, 5.4, 8.0])
    H(doc, "7.5 数据合规与伦理", 2)
    for b in C.DATA_COMPLIANCE:
        bullet(doc, b)
    page_break(doc)


def build_market(doc):
    H(doc, "第八章 市场分析与竞争格局", 1)
    H(doc, "8.1 市场空间", 2)
    H(doc, "8.1.1 流行病学基数", 3)
    table(doc, C.EPI[0], C.EPI[1], widths=[4.0, 3.4, 8.6])
    caption(doc, "注：流行病学数据请以最新权威文献与官方统计为准，引用前请核对原文口径（见附录 B）。")
    H(doc, "8.1.2 市场规模测算（自下而上）", 3)
    para(doc, "采用自下而上的方法，从可获得的目标客户数量与客单价出发推算可服务市场，避免直接引用口径不清的行业报告数字。")
    table(doc, C.MARKET[0], C.MARKET[1], widths=[3.2, 3.0, 3.0, 3.4, 3.4])
    H(doc, "8.1.3 政策与产业环境", 3)
    for b in C.POLICY:
        bullet(doc, b)
    H(doc, "8.2 竞争格局与竞品对比", 2)
    table(doc, C.COMPETITORS[0], C.COMPETITORS[1], widths=[2.4, 1.3, 2.4, 3.0, 2.2, 2.0, 2.7])
    caption(doc, "注：竞品信息来自公开资料整理，价格与认证状态可能随时间变化，正式使用前请重新核实。")
    H(doc, "8.3 差异化定位与竞争壁垒", 2)
    for i, (title, body) in enumerate(C.MOAT, 1):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(2)
        set_run(p.add_run("壁垒 %d  %s" % (i, title)), 11, True, ACCENT2)
        keep_with_next(p)
        para(doc, body)
    H(doc, "8.4 SWOT 分析", 2)
    table(doc, C.SWOT[0], C.SWOT[1], widths=[4.0, 6.0, 6.0])
    page_break(doc)


def build_business(doc):
    H(doc, "第九章 商业模式与实施计划", 1)
    H(doc, "9.1 商业模式总览", 2)
    para(doc, "项目采取“硬件建立入口、订阅产生复购、服务放大客单价”的三级商业结构，"
              "并用药企临床试验服务作为早期现金流来源，降低 C 端教育成本带来的资金压力。")
    table(doc, C.REVENUE[0], C.REVENUE[1], widths=[2.4, 3.0, 4.2, 3.2, 3.2])
    H(doc, "9.2 定价策略", 2)
    table(doc, C.PRICING[0], C.PRICING[1], widths=[3.4, 3.4, 9.2])
    H(doc, "9.3 单台成本与毛利结构", 2)
    table(doc, C.UNIT_ECON[0], C.UNIT_ECON[1], widths=[4.2, 3.2, 3.2, 5.4])
    caption(doc, "注：为试产阶段的估算模型，用于说明毛利结构；软件与云服务成本按三年摊销估算。")
    H(doc, "9.4 获客渠道与运营", 2)
    table(doc, C.CHANNELS[0], C.CHANNELS[1], widths=[3.0, 5.4, 3.4, 4.2])
    H(doc, "9.5 三年财务预测", 2)
    table(doc, C.FINANCE[0], C.FINANCE[1], widths=[3.6, 2.8, 2.8, 2.8, 4.0])
    caption(doc, "注：以上为基于假设的示意性预测，非承诺性财务数据。关键假设：第二年完成二类器械注册并进入院内渠道，"
                 "药企服务收入按项目制确认，用户续费率 60%。")
    H(doc, "9.6 里程碑计划", 2)
    table(doc, C.MILESTONES[0], C.MILESTONES[1], widths=[2.2, 4.4, 3.2, 3.0, 3.2])
    H(doc, "9.7 团队分工（8 人）", 2)
    table(doc, C.TEAM[0], C.TEAM[1], widths=[2.2, 4.6, 3.4, 5.8])
    page_break(doc)


def build_risk(doc):
    H(doc, "第十章 风险分析与应对", 1)
    para(doc, "本项目的主要风险来自技术实现、临床验证、合规审批与商业落地四个方面。下表给出风险等级、影响与具体应对措施，"
              "其中合规与临床风险是决定项目能否从“作品”走向“产品”的关键。")
    table(doc, C.RISKS[0], C.RISKS[1], widths=[1.8, 4.4, 1.4, 3.2, 5.2])
    H(doc, "10.1 关键假设与敏感性", 2)
    for b in C.SENSITIVITY:
        bullet(doc, b)
    page_break(doc)


def build_appendix(doc):
    H(doc, "附录 A 术语表", 1)
    table(doc, ["术语 / 缩写", "全称", "含义说明"], C.GLOSSARY, widths=[3.0, 4.4, 8.6])
    H(doc, "附录 B 数据与资料来源说明", 1)
    para(doc, "本文档中的数据分三类，引用与答辩时应区分对待，避免把设计目标当作实测结果、把二手引用当作原始来源：")
    table(doc, ["数据类别", "本文档中的位置", "性质与使用建议"],
          [["平台与器件规格", "4.1.2 RK3576 参数", "来自芯片原厂公开规格页，属客观事实，可直接引用；"
                                                      "引用链接：www.rock-chips.com 产品页"],
           ["文献报道性能指标", "7.1 临床证据基础、2.4", "为文献报道值，用于论证方向可行性；正式使用请在附录登记文献出处"
                                                            "（作者、期刊、年份、DOI）并核对原文口径"],
           ["流行病学与市场规模", "8.1、7.1", "请以最新权威文献与国家统计口径为准，本文档数值仅作量级参考"],
           ["设计目标与预测值", "1.3、5.5、9.5", "为项目设计目标与假设性预测，非实测结果、非承诺性财务数据"]],
          widths=[3.2, 4.0, 8.8])
    H(doc, "附录 B-1 建议核实的原始来源", 1)
    for b in C.SOURCES:
        bullet(doc, b)
    H(doc, "附录 C 团队构成与分工", 1)
    table(doc, C.TEAM_FULL[0], C.TEAM_FULL[1], widths=[2.0, 3.0, 5.6, 5.4])
    H(doc, "附录 D 待补充信息清单（交付前必填）", 1)
    for b in C.TODO_LIST:
        bullet(doc, b)
    H(doc, "附录 E 与指导教师的沟通要点", 1)
    for b in C.ADVISOR:
        bullet(doc, b)


def main():
    doc = Document()
    init_styles(doc)

    sec = doc.sections[0]
    sec.page_width = Cm(PAGE_W_CM)         # A4，避免默认 Letter 导致版心偏窄
    sec.page_height = Cm(PAGE_H_CM)
    sec.top_margin = Cm(2.4)
    sec.bottom_margin = Cm(2.2)
    sec.left_margin = Cm(MARGIN_LR_CM)
    sec.right_margin = Cm(MARGIN_LR_CM)

    build_cover(doc)
    build_usage(doc)
    build_front_matter(doc)
    build_solution(doc)
    build_hardware(doc)
    build_algorithm(doc)
    build_innovation(doc)
    build_clinical(doc)
    build_market(doc)
    build_business(doc)
    build_risk(doc)
    build_appendix(doc)

    add_page_number_footer(doc)
    out = "居家呼吸声学监测算法与RK3576边缘端部署平台-项目简介.docx"
    doc.save(out)
    print("saved:", out)


if __name__ == "__main__":
    main()
