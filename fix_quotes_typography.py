# -*- coding: utf-8 -*-
'''排版优化：把字符串内部两两成对的 「…」 还原为中文引号 “…”（U+201C/U+201D）。

安全前提：
  * “ ” 是全角字符，出现在字符串内部绝不会影响 Python 语法；
  * 只对**成对**（个数为偶数）的 「」 做替换，奇数个则整体保持原样，
    因此不会产生半对引号。

做法：以 ASCII 双引号界定字符串，逐个字符串字面量处理。
'''
import io
import sys

OPEN = "\u300c"
CLOSE = "\u300d"
LQ = "\u201c"
RQ = "\u201d"
QUOTE = '"'


def convert_string_body(body):
    '''把一段字符串内容里成对的 「」 换成 “”。'''
    if body.count(OPEN) == body.count(CLOSE) and body.count(OPEN) > 0:
        out = []
        depth = 0
        for ch in body:
            if ch == OPEN:
                out.append(LQ if depth == 0 else OPEN)
                depth += 1
            elif ch == CLOSE:
                depth -= 1
                out.append(RQ if depth == 0 else CLOSE)
            else:
                out.append(ch)
        return "".join(out)
    return body


def convert(text):
    out = []
    buf = []
    in_str = False
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == QUOTE:
            if in_str:
                out.append(convert_string_body("".join(buf)))
                buf = []
                in_str = False
            else:
                in_str = True
            out.append(ch)
            i += 1
            continue
        if in_str:
            buf.append(ch)
        else:
            out.append(ch)
        i += 1
    if buf:
        out.append("".join(buf))
    return "".join(out)


def main():
    for fname in sys.argv[1:]:
        text = io.open(fname, encoding="utf-8").read()
        new = convert(text)
        io.open(fname, "w", encoding="utf-8", newline="\n").write(new)
        print("%-16s “ %d | ” %d | 剩余「 %d 」 %d"
              % (fname, new.count(LQ), new.count(RQ),
                 new.count(OPEN), new.count(CLOSE)))


if __name__ == "__main__":
    main()
