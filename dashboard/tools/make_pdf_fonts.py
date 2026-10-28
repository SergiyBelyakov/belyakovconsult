"""Шрифти для PDF-звіту дашборду: статичні TrueType-підмножини Montserrat і Inter.

jsPDF вбудовує лише TrueType (glyf), тому:
- Montserrat-Variable.ttf → статичні накреслення 600 і 700 (fontTools instancer);
- Inter *.otf (CFF) → TrueType з квадратичними кривими (cu2qu).
Підмножина: латиниця з діакритикою (PT), кирилиця (UA), цифри й типографські знаки.

Запуск з кореня репозиторію: python dashboard/tools/make_pdf_fonts.py
"""
from __future__ import annotations

from pathlib import Path

from fontTools.cu2qu.ufo import DEFAULT_MAX_ERR
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont, newTable
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "fonts"
OUT = ROOT / "dashboard" / "public" / "pdf-fonts"

UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x400, 0x460)) + [0x490, 0x491]
    + list(range(0x2009, 0x2028)) + [0x202F, 0x2030, 0x2039, 0x203A, 0x20AC, 0x20B4, 0x2116, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193,
                                     0x2197, 0x2198, 0x2212, 0x2264, 0x2265, 0x2248, 0x00D7, 0x2022, 0x2026, 0x25CF]
)


def subset(font: TTFont, path: Path) -> None:
    opts = Options()
    opts.layout_features = ["kern", "liga", "tnum", "lnum"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG", "GSUB", "GPOS", "STAT", "MVAR", "HVAR", "fvar", "gvar", "avar"]
    s = Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(font)
    font.save(path)
    print(f"{path.name}: {path.stat().st_size // 1024} КБ")


def otf_to_ttf(font: TTFont) -> TTFont:
    """CFF → glyf (за зразком fontTools snippets/otf2ttf.py)."""
    order = font.getGlyphOrder()
    gs = font.getGlyphSet()
    glyf = newTable("glyf")
    glyf.glyphOrder = order
    glyf.glyphs = {}
    for name in order:
        pen = TTGlyphPen(gs)
        gs[name].draw(Cu2QuPen(pen, DEFAULT_MAX_ERR, reverse_direction=True))
        glyf[name] = pen.glyph()
    font["glyf"] = glyf
    font["loca"] = newTable("loca")
    font["maxp"] = newTable("maxp")
    font["maxp"].tableVersion = 0x00010000
    for attr in ("maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs",
                 "maxStackElements", "maxSizeOfInstructions", "maxComponentElements"):
        setattr(font["maxp"], attr, 0)
    font["maxp"].maxZones = 1
    font["post"].formatType = 2.0
    font["post"].extraNames = []
    font["post"].mapping = {}
    font["post"].glyphOrder = order
    del font["CFF "]
    if "VORG" in font:
        del font["VORG"]
    font.sfntVersion = "\000\001\000\000"
    font.recalcBBoxes = True
    font["head"].glyphDataFormat = 0
    return font


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for weight, name in ((600, "Montserrat-SemiBold"), (700, "Montserrat-Bold")):
        f = TTFont(SRC / "Montserrat-Variable.ttf")
        f = instancer.instantiateVariableFont(f, {"wght": weight}, updateFontNames=False)
        subset(f, OUT / f"{name}.ttf")
    for src, name in (("Inter-Regular.otf", "Inter-Regular"), ("Inter-SemiBold.otf", "Inter-SemiBold")):
        f = otf_to_ttf(TTFont(SRC / src))
        subset(f, OUT / f"{name}.ttf")


if __name__ == "__main__":
    main()
