# -*- coding: utf-8 -*-
'''生成项目总体架构图（四层：采集层 / 边缘层 / 云端层 / 应用层）。

输出 architecture.png，供 Word 文档与答辩 PPT 使用。
每层高度按"行数 × 行高 + 内边距"计算，避免文字溢出方框。
'''
import math
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

W, H = 2100, 1240
BG = (255, 255, 255)
DARK = (0x1F, 0x2A, 0x37)
ACCENT = (0x1F, 0x4E, 0x79)
ACCENT2 = (0x2E, 0x74, 0xB5)
LAYER_BG = [(0xEC, 0xF3, 0xFA), (0xE3, 0xEF, 0xFA),
            (0xEA, 0xF4, 0xEC), (0xFB, 0xEF, 0xE2)]
BOX_BG = (255, 255, 255)
BOX_EDGE = (0xB6, 0xC7, 0xD9)
GREY = (0x55, 0x5F, 0x6B)

FONT_BOLD = r"C:\Windows\Fonts\simhei.ttf"
FONT_REG = r"C:\Windows\Fonts\simsun.ttc"

LINE_H = 38          # 副标题行高
HEAD_H = 48          # 标题行高
BOX_PAD = 30         # 方框上下内边距
LAYER_HEAD = 66      # 层标题占高
LAYER_PAD = 20


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


F_TITLE = font(46, True)
F_LAYER = font(33, True)
F_HEAD = font(27, True)
F_SUB = font(22)
F_NOTE = font(22)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)


def box_height(n_sub):
    return BOX_PAD * 2 + HEAD_H + n_sub * LINE_H


def box(x0, y0, x1, y1, head, subs):
    d.rounded_rectangle([x0, y0, x1, y1], radius=14, fill=BOX_BG,
                        outline=BOX_EDGE, width=2)
    n = 1 + len(subs)
    total = HEAD_H + len(subs) * LINE_H
    cy = y0 + (y1 - y0 - total) / 2
    bb = d.textbbox((0, 0), head, font=F_HEAD)
    d.text((x0 + (x1 - x0 - (bb[2] - bb[0])) / 2 - bb[0], cy), head, font=F_HEAD, fill=DARK)
    cy += HEAD_H
    for s in subs:
        bb = d.textbbox((0, 0), s, font=F_SUB)
        d.text((x0 + (x1 - x0 - (bb[2] - bb[0])) / 2 - bb[0], cy), s, font=F_SUB, fill=GREY)
        cy += LINE_H


def arrow(x, y0, y1, color=ACCENT2, lw=5):
    d.line([x, y0, x, y1], fill=color, width=lw)
    ang = math.atan2(y1 - y0, 0)
    L, sp = 15, math.radians(26)
    d.polygon([(x, y1),
               (x - L * math.cos(ang - sp), y1 - L * math.sin(ang - sp)),
               (x - L * math.cos(ang + sp), y1 - L * math.sin(ang + sp))], fill=color)


# ---------------- 内容定义 ----------------
LAYERS = [
    ("采集层", [
        ("手机 APP（主）", ["后台常听 / 录音双模式", "降噪 · 增益归一化 · 设备校准"]),
        ("USB / 蓝牙拾音配件", ["床头放置，双麦克风可选", "声学结构与防尘防风设计"]),
        ("质量控制", ["噪声底 · 削波 · 断流检测", "无效时段打标并剔除"]),
    ]),
    ("边缘层 · RK3576（6 TOPS NPU）", [
        ("音频前端", ["16 kHz 采样", "对数梅尔谱特征"]),
        ("声学事件检测", ["轻量 CNN 常听门控", "高召回优先，低功耗"]),
        ("事件分类与指标", ["咳嗽 / 喘息 / 说话 / 噪声", "呼吸率 · 咳嗽频次"]),
        ("本地存储", ["加密缓存", "断网续传"]),
        ("NPU 推理", ["RKNN INT8 量化", "端到端 ≤ 300 ms"]),
        ("个体化基线与预警", ["偏离度判定", "家属端告警"]),
    ]),
    ("云端层", [
        ("指标与设备管理", ["设备注册 · 固件版本", "模型灰度与回滚"]),
        ("数据仓库与分析", ["趋势聚合 · 基线建模", "报告生成"]),
        ("模型训练平台", ["标注管理 · 实验追踪", "ONNX → RKNN 流水线"]),
        ("开放与对接", ["HL7 / FHIR 接口", "HIS / EMR 对接"]),
        ("安全与合规", ["TLS 传输 · 静态加密", "权限审计 · 授权可撤回"]),
    ]),
    ("应用层", [
        ("患者端 APP / 小程序", ["趋势看板 · 事件时间轴", "异常预警 · 随访报告"]),
        ("医生端工作站", ["患者队列 · 事件回放", "误报标注回流", "报告导出"]),
        ("家属端", ["关键告警推送", "简要状态查看"]),
        ("基层与机构端", ["筛查分层工具", "区域慢病看板"]),
    ]),
]

# ---------------- 计算各层几何 ----------------
LX, RX = 50, W - 50
INNER_L, INNER_R = LX + 28, RX - 28
y = 150
geometry = []
for title, boxes in LAYERS:
    max_sub = max(len(b[1]) for b in boxes)
    bh = box_height(max_sub)
    layer_h = LAYER_HEAD + bh + LAYER_PAD
    geometry.append((y, y + layer_h, bh))
    y += layer_h + 26
TOTAL_BOTTOM = y - 26 + 96            # 减去最后一层后的间隙，再加上说明条高度
CANVAS_H = TOTAL_BOTTOM + 24

img = Image.new("RGB", (W, CANVAS_H), BG)
d = ImageDraw.Draw(img)

# ---------------- 绘制 ----------------
d.text((LX, 28), "居家呼吸声学监测系统总体架构", font=F_TITLE, fill=ACCENT)
d.text((LX, 92),
       "手机采集 → RK3576 边缘推理（原始音频不出户） → 云端趋势分析 → 三端应用闭环",
       font=F_SUB, fill=GREY)

for idx, ((title, boxes), (ly0, ly1, bh)) in enumerate(zip(LAYERS, geometry)):
    d.rounded_rectangle([LX, ly0, RX, ly1], radius=18,
                        fill=LAYER_BG[idx], outline=BOX_EDGE, width=2)
    d.text((LX + 24, ly0 + 14), title, font=F_LAYER, fill=ACCENT)
    n = len(boxes)
    gap = 22
    avail = (INNER_R - INNER_L) - gap * (n - 1)
    bw = avail / n
    by0 = ly0 + LAYER_HEAD
    for i, (head, subs) in enumerate(boxes):
        bx0 = INNER_L + i * (bw + gap)
        box(bx0, by0, bx0 + bw, by0 + bh, head, subs)

# 层间箭头
for i in range(len(geometry) - 1):
    y_from = geometry[i][1]
    y_to = geometry[i + 1][0]
    for x in (W * 0.25, W * 0.5, W * 0.75):
        arrow(x, y_from + 2, y_to - 2)

# 数据闭环说明
d.rounded_rectangle([LX, TOTAL_BOTTOM - 76, RX, TOTAL_BOTTOM - 8], radius=16,
                    fill=(0xF5, 0xF7, 0xFA), outline=BOX_EDGE, width=2)
note = "数据闭环：临床使用 → 医生标注误报 → 模型迭代 → 版本化发布（锁定版本、可回滚）→ 临床再使用"
bb = d.textbbox((0, 0), note, font=F_NOTE)
d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], TOTAL_BOTTOM - 64), note,
       font=F_NOTE, fill=ACCENT)

img.save("architecture.png")
print("saved architecture.png", img.size, "内容底部", TOTAL_BOTTOM)
