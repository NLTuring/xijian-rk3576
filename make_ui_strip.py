# -*- coding: utf-8 -*-
'''把四张静态概念图横向拼接为一条 UI 概念总览图，便于嵌入文档。

输入：设计方案/concepts/01-bedtime.png 等四张 780x1688 竖版图
输出：ui_concept_strip.png
'''
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

SRC = [
    ("设计方案/concepts/01-bedtime.png", "睡前准备"),
    ("设计方案/concepts/02-morning.png", "晨间概览"),
    ("设计方案/concepts/03-event.png", "事件回听"),
    ("设计方案/concepts/04-report.png", "复诊报告"),
]

THUMB_W = 460                       # 每屏缩放宽
GAP = 46
PAD_X, PAD_TOP, PAD_BOTTOM = 40, 108, 40
LABEL_H = 56

FONT_BOLD = r"C:\Windows\Fonts\simhei.ttf"
FONT_REG = r"C:\Windows\Fonts\simsun.ttc"
F_TITLE = ImageFont.truetype(FONT_BOLD, 40)
F_SUB = ImageFont.truetype(FONT_REG, 24)
F_LABEL = ImageFont.truetype(FONT_BOLD, 30)

ims = []
for path, label in SRC:
    im = Image.open(path).convert("RGB")
    h = int(im.size[1] * THUMB_W / float(im.size[0]))
    ims.append((im.resize((THUMB_W, h), Image.LANCZOS), label))

thumb_h = ims[0][0].size[1]
W = PAD_X * 2 + THUMB_W * len(ims) + GAP * (len(ims) - 1)
H = PAD_TOP + thumb_h + LABEL_H + PAD_BOTTOM

canvas = Image.new("RGB", (W, H), (255, 255, 255))
d = ImageDraw.Draw(canvas)

d.text((PAD_X, 26), "息间 · 患者 APP 静态概念图（示例数据）", font=F_TITLE, fill=(0x1F, 0x4E, 0x79))
d.text((PAD_X, 72), "黑白灰视觉 · 玻璃液晶质感仅用于主按钮与浮动导航 · 四屏对应四个关键场景",
       font=F_SUB, fill=(0x55, 0x5F, 0x6B))

x = PAD_X
for im, label in ims:
    canvas.paste(im, (x, PAD_TOP))
    d.rectangle([x, PAD_TOP, x + THUMB_W - 1, PAD_TOP + thumb_h - 1],
                outline=(0xD8, 0xD8, 0xD8), width=2)
    bb = d.textbbox((0, 0), label, font=F_LABEL)
    d.text((x + (THUMB_W - (bb[2] - bb[0])) / 2, PAD_TOP + thumb_h + 12),
           label, font=F_LABEL, fill=(0x15, 0x15, 0x15))
    x += THUMB_W + GAP

canvas.save("ui_concept_strip.png")
print("saved ui_concept_strip.png", canvas.size, "单屏高", thumb_h)
