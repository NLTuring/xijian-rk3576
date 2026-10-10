# -*- coding: utf-8 -*-
'''生成市场规模示意图：家用医疗器械市场规模（柱）与线上占比（线）。'''
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

W, H = 1700, 980
BG = (255, 255, 255)
ACCENT = (0x1F, 0x4E, 0x79)
BAR = (0x2E, 0x74, 0xB5)
BAR2 = (0xA8, 0xC6, 0xE4)
LINE = (0xC0, 0x50, 0x4D)
DARK = (0x1F, 0x2A, 0x37)
GREY = (0x55, 0x5F, 0x6B)
GRID = (0xDD, 0xE3, 0xEA)

FONT_BOLD = r"C:\Windows\Fonts\simhei.ttf"
FONT_REG = r"C:\Windows\Fonts\simsun.ttc"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


F_TITLE = font(40, True)
F_SUB = font(22)
F_AXIS = font(22)
F_VAL = font(24, True)
F_NOTE = font(20)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

d.text((60, 30), "中国家用医疗器械市场规模与线上占比", font=F_TITLE, fill=ACCENT)
d.text((60, 84), "单位：亿元（柱）与百分比（折线）　数据来源：行业研究机构公开报告",
       font=F_SUB, fill=GREY)

# 数据
years = ["2019", "2024", "2030E"]
size = [1224, 1982, 3200]          # 亿元（2030 为推算值）
online = [25.0, 44.3, 67.1]        # 百分比

# 绘图区（右侧留足空间，避免推算柱贴近边缘）
L, R, T, B = 150, W - 300, 170, H - 190
d.line([L, B, R, B], fill=GREY, width=3)
d.line([L, T, L, B], fill=GREY, width=3)

# 水平网格
MAXV = 3600
for i in range(5):
    y = B - (B - T) * i / 4.0
    d.line([L, y, R, y], fill=GRID, width=2)
    d.text((L - 100, y - 14), str(int(MAXV * i / 4)), font=F_AXIS, fill=GREY)
d.text((30, T - 52), "亿元", font=F_AXIS, fill=GREY)

n = len(years)
slot = (R - L) / float(n)
bw = slot * 0.42
for i, (yr, v, on) in enumerate(zip(years, size, online)):
    cx = L + slot * (i + 0.5)
    x0, x1 = cx - bw / 2, cx + bw / 2
    y0 = B - (B - T) * (v / float(MAXV))
    d.rectangle([x0, y0, x1, B], fill=BAR if i < 2 else BAR2,
                outline=ACCENT if i < 2 else BAR, width=2)
    txt = str(v)
    bb = d.textbbox((0, 0), txt, font=F_VAL)
    d.text((cx - (bb[2] - bb[0]) / 2, y0 - 38), txt, font=F_VAL, fill=DARK)
    bb = d.textbbox((0, 0), yr, font=F_AXIS)
    d.text((cx - (bb[2] - bb[0]) / 2, B + 14), yr, font=F_AXIS, fill=GREY)

# 折线（线上占比，映射到绘图区 0-100%）
pts = []
for i, on in enumerate(online):
    cx = L + slot * (i + 0.5)
    y = B - (B - T) * (on / 100.0)
    pts.append((cx, y))
d.line(pts, fill=LINE, width=5, joint="curve")
for (cx, y), on in zip(pts, online):
    d.ellipse([cx - 9, y - 9, cx + 9, y + 9], fill=LINE)
    txt = "%.1f%%" % on
    bb = d.textbbox((0, 0), txt, font=F_VAL)
    d.text((cx - (bb[2] - bb[0]) / 2, y - 44), txt, font=F_VAL, fill=LINE)

# 图例
lx, ly = L + 20, T + 10
d.rectangle([lx, ly, lx + 34, ly + 20], fill=BAR)
d.text((lx + 46, ly - 2), "已实现（2019 / 2024）", font=F_AXIS, fill=GREY)
d.rectangle([lx, ly + 40, lx + 34, ly + 60], fill=BAR2, outline=BAR, width=2)
d.text((lx + 46, ly + 38), "推算（2030）", font=F_AXIS, fill=GREY)
d.line([lx, ly + 92, lx + 34, ly + 92], fill=LINE, width=5)
d.ellipse([lx + 12, ly + 83, lx + 28, ly + 99], fill=LINE)
d.text((lx + 46, ly + 80), "线上销售占比（%）", font=F_AXIS, fill=GREY)

d.text((60, H - 76),
       "要点：家用医疗器械市场规模七年增长约 62%，线上占比由 25% 升至 44.3%（预计 2030 年达 67.1%）——"
       "提示居家类产品可通过线上渠道直接触达家庭用户。",
       font=F_NOTE, fill=ACCENT)
d.text((60, H - 42),
       "注：2030 年为行业预测值，正式文档中请标注为该机构预测口径并核对原文。",
       font=F_NOTE, fill=GREY)

img.save("market_size.png")
print("saved market_size.png", img.size)
