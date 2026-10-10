# -*- coding: utf-8 -*-
'''生成《商业计划书设计纲要》Word 文档。'''
import docx_common as D
import bp_outline_content as C

OUT = "商业计划书设计纲要.docx"


def build():
    doc = D.new_document()

    D.cover(
        doc,
        "挑战杯项目 · 商业计划书撰写指引",
        ["商业计划书", "设计纲要"],
        "框架 · 写作要点 · 图表清单 · 数据来源 · 答辩口径",
        [
            ("配套项目", "居家呼吸声学监测算法与 RK3576 边缘端部署平台"),
            ("文档类型", "商业计划书设计纲要（撰写指引）"),
            ("配套文件", "《商业计划书样板（简略版）》《项目简介》"),
            ("建议篇幅", "正式版 42–46 页，1.2 万–1.8 万字，图表 15–20 张"),
            ("团队人数", "8 人"),
            ("编制日期", "【待填写：年 月 日】"),
        ],
    )

    # ---------------- 一、使用说明 ----------------
    D.H(doc, "一、本纲要怎么用", 1)
    for b in C.USAGE:
        D.bullet(doc, b)

    # ---------------- 二、总体框架 ----------------
    D.H(doc, "二、商业计划书总体框架与页数分配", 1)
    D.para(doc, "下表是建议的完整框架。页数分配反映优先级：市场与技术合计占四分之一，"
                "因为这两部分是评委与投资人判断「能不能成」的主要依据。")
    D.table(doc, C.FRAMEWORK[0], C.FRAMEWORK[1], widths=[1.0, 4.4, 1.8, 8.9])
    D.caption(doc, "表 2-1  商业计划书章节框架与建议页数")
    D.H(doc, "框架设计说明", 2)
    for b in C.FRAMEWORK_NOTES:
        D.bullet(doc, b)

    # ---------------- 三、逐章设计 ----------------
    D.H(doc, "三、逐章设计要点", 1)
    D.para(doc, "每一章都给出五个要素：核心任务、写作要点、图表清单、数据来源、常见陷阱。"
                "其中「常见陷阱」是答辩中真实容易被追问翻车的地方，务必逐条自查。")
    for ch in C.CHAPTERS:
        D.H(doc, "%s  %s（%s）" % (ch["no"], ch["title"], ch["pages"]), 2)
        p = doc.add_paragraph()
        p.paragraph_format.space_after = D.Pt(3)
        p.paragraph_format.left_indent = D.Cm(0.2)
        D.set_run(p.add_run("核心任务："), 10.5, bold=True, color=D.ACCENT)
        D.set_run(p.add_run(ch["goal"]), 10.5)

        D.H(doc, "写作要点", 3)
        for b in ch["points"]:
            D.bullet(doc, b)

        D.H(doc, "图表清单", 3)
        for c in ch["charts"]:
            D.bullet(doc, c)

        D.H(doc, "数据来源与常见陷阱", 3)
        p = doc.add_paragraph()
        p.paragraph_format.space_after = D.Pt(2)
        p.paragraph_format.left_indent = D.Cm(0.75)
        D.set_run(p.add_run("数据来源："), 10.5, bold=True)
        D.set_run(p.add_run(ch["source"]), 10.5)
        p = doc.add_paragraph()
        p.paragraph_format.space_after = D.Pt(6)
        p.paragraph_format.left_indent = D.Cm(0.75)
        D.set_run(p.add_run("常见陷阱："), 10.5, bold=True, color=D.ACCENT)
        D.set_run(p.add_run(ch["trap"]), 10.5)

    # ---------------- 四、附录设计 ----------------
    D.H(doc, "四、附录设计", 1)
    D.para(doc, "附录是商业计划书的证据库。正文放判断，附录放证据——这样正文保持简洁，"
                "而答辩被追问时能立刻翻到出处。")
    D.table(doc, C.APPENDIX_OUTLINE[0], C.APPENDIX_OUTLINE[1], widths=[1.8, 4.0, 8.6])
    D.caption(doc, "表 4-1  附录结构与内容")

    # ---------------- 五、PPT 结构 ----------------
    D.H(doc, "五、配套答辩 / 路演 PPT 结构（24 页）", 1)
    D.para(doc, "商业计划书与 PPT 是同一套论据的两种呈现。建议先定稿商业计划书，"
                "再从中提炼 PPT——这样每一页都有出处，不会出现「PPT 上的数字文档里找不到」的情况。")
    D.table(doc, C.PPT[0], C.PPT[1], widths=[0.9, 3.4, 6.4, 4.3])
    D.caption(doc, "表 5-1  答辩 PPT 逐页结构与配图建议")
    D.H(doc, "PPT 设计要点", 2)
    for b in C.PPT_NOTES:
        D.bullet(doc, b)

    # ---------------- 六、数据备份清单 ----------------
    D.H(doc, "六、论据与数据备份清单", 1)
    D.para(doc, "答辩现场真正决定成败的，是能不能立刻答出「这个数字哪来的」。"
                "下表把全部关键论据、数据、来源与核实状态列在一起，建议打印一份随身带进答辩现场。")
    D.table(doc, C.DATA_BACKUP[0], C.DATA_BACKUP[1], widths=[2.6, 5.6, 4.6, 1.6])
    D.caption(doc, "表 6-1  关键论据与数据来源清单（含核实状态）")

    # ---------------- 七、写作规范 ----------------
    D.H(doc, "七、写作规范", 1)
    for b in C.WRITING_RULES:
        D.bullet(doc, b)

    # ---------------- 八、自检清单 ----------------
    D.H(doc, "八、定稿前自检清单", 1)
    D.para(doc, "以下 12 项全部打勾后再定稿。任何一项答不上来，都可能在答辩现场被放大。")
    for i, b in enumerate(C.SELF_CHECK, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = D.Cm(0.75)
        p.paragraph_format.first_line_indent = D.Cm(-0.75)
        p.paragraph_format.space_after = D.Pt(2)
        p.paragraph_format.line_spacing = 1.35
        D.set_run(p.add_run("□ %2d. " % i), 10.5, color=D.ACCENT2)
        D.set_run(p.add_run(b), 10.5)

    # ---------------- 九、三份文件的关系 ----------------
    D.H(doc, "九、三份文件的分工", 1)
    D.table(doc, C.RELATION[0], C.RELATION[1], widths=[5.3, 5.3, 5.4])
    D.caption(doc, "表 9-1  设计纲要、样板与项目简介的分工")
    D.para(doc, "建议的写作顺序：先读《项目简介》掌握论据 → 按本纲要搭框架 → "
                "参照《样板（简略版）》的写法扩写为正式版 → 按第八节自检清单校对 → "
                "从定稿的商业计划书提炼 PPT。")

    D.add_page_number_footer(doc)
    doc.save(OUT)
    print("saved:", OUT)


if __name__ == "__main__":
    build()
