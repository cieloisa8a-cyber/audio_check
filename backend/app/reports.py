from io import BytesIO
from typing import Optional
import unicodedata

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

from .schemas import Measurement, ReportRequest


FREQUENCIES = (250, 500, 1000, 2000, 3000, 4000, 6000, 8000)


def dbfs_to_dbhl(dbfs: Optional[float]) -> Optional[float]:
    if dbfs is None:
        return None
    return round((dbfs + 60) * 2.5)


def get_level_dbhl(item: Measurement) -> Optional[float]:
    if getattr(item, "level_dbhl", None) is not None:
        return float(item.level_dbhl)
    if getattr(item, "level_dbfs", None) is not None:
        return float(dbfs_to_dbhl(item.level_dbfs))
    return None


def build_report(payload: ReportRequest) -> bytes:
    output = BytesIO()
    page_width, page_height = landscape(letter)
    pdf = canvas.Canvas(output, pagesize=(page_width, page_height))
    pdf.setTitle("Audio Check | Resumen auditivo")

    # Encabezado institucional
    pdf.setFillColor(colors.HexColor("#142b2a"))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(48, page_height - 50, "Resumen auditivo")
    pdf.setFillColor(colors.HexColor("#526260"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(48, page_height - 66, "Umbral auditivo estimado · dB HL (Compensación RETSPL relativa)")

    patient_items = []
    if payload.patient_name:
        clean_name = unicodedata.normalize("NFC", payload.patient_name.strip()).encode("latin-1", "replace").decode("latin-1")
        if clean_name:
            patient_items.append(f"Paciente: {clean_name}")
    if payload.patient_age:
        patient_items.append(f"Edad: {payload.patient_age} años")
    if patient_items:
        pdf.setFillColor(colors.HexColor("#142b2a"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(48, page_height - 82, "   ·   ".join(patient_items))

    # Dimensiones del audiograma clínico
    left, right = 140, page_width - 42
    bottom, top = 175, page_height - 110
    graph_width, graph_height = right - left, top - bottom

    # Eje X equidistante
    column_width = graph_width / (len(FREQUENCIES) - 1)

    def x_position(frequency: int) -> float:
        return left + FREQUENCIES.index(frequency) * column_width

    # Eje Y clínico estándar (0 dB HL arriba, 100 dB HL abajo)
    def y_position(level: float) -> float:
        return bottom + ((100.0 - level) / 100.0) * graph_height

    # Rejilla horizontal (0 a 100 dB HL en pasos de 20 dB)
    pdf.setStrokeColor(colors.HexColor("#d5dfdb"))
    pdf.setLineWidth(0.6)
    for level in range(0, 101, 20):
        y = y_position(level)
        pdf.line(left, y, right, y)
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(left - 10, y - 3, str(level))

    # Rejilla vertical por frecuencia
    for frequency in FREQUENCIES:
        x = x_position(frequency)
        pdf.setStrokeColor(colors.HexColor("#e8eeeb"))
        pdf.line(x, bottom, x, top)
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 9)
        pdf.drawCentredString(x, bottom - 14, str(frequency))

    # Rótulo de eje X
    pdf.setFillColor(colors.HexColor("#142b2a"))
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString((left + right) / 2, bottom - 26, "Frecuencia (Hz)")

    # Rótulo de eje Y (dB HL)
    pdf.saveState()
    pdf.translate(88, (bottom + top) / 2)
    pdf.rotate(90)
    pdf.drawCentredString(0, 0, "Nivel de audición (dB HL)")
    pdf.restoreState()

    # Trazo de series (Oído izquierdo y Oído derecho)
    series = (("left", colors.HexColor("#dc684c"), "Oído izquierdo"),
              ("right", colors.HexColor("#237e72"), "Oído derecho"))
    lookup = {(item.ear, item.frequency_hz): get_level_dbhl(item) for item in payload.measurements}
    no_response_lookup = {
        (item.ear, item.frequency_hz): bool(getattr(item, "no_response", False) or (item.level_dbhl is None and item.level_dbfs is None))
        for item in payload.measurements
    }

    for ear, color, label in series:
        points = [
            (x_position(frequency), y_position(lookup[(ear, frequency)]))
            for frequency in FREQUENCIES
            if (ear, frequency) in lookup and lookup[(ear, frequency)] is not None
        ]
        pdf.setStrokeColor(color)
        pdf.setFillColor(color)
        pdf.setLineWidth(1.6)
        for first, second in zip(points, points[1:]):
            pdf.line(first[0], first[1], second[0], second[1])
        for x, y in points:
            pdf.circle(x, y, 4, stroke=1, fill=1)

        # Indicador clínico de No Respuesta (NR): flecha descendente en el límite máximo de 80 dB HL
        for frequency in FREQUENCIES:
            if no_response_lookup.get((ear, frequency)):
                nx = x_position(frequency) + (-4 if ear == "left" else 4)
                ny = y_position(80.0)
                pdf.setStrokeColor(color)
                pdf.setFillColor(color)
                p = pdf.beginPath()
                p.moveTo(nx - 4, ny + 6)
                p.lineTo(nx + 4, ny + 6)
                p.lineTo(nx, ny - 2)
                p.close()
                pdf.drawPath(p, fill=1, stroke=0)

        legend_x = right - 145 if ear == "left" else right - 55
        pdf.setFillColor(color)
        pdf.circle(legend_x, page_height - 70, 3, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 8)
        pdf.drawString(legend_x + 8, page_height - 73, label)

    # Tabla clínica estandarizada de valores en dB HL
    table_top = bottom - 38
    table_row_h = 15
    table_left = 48
    table_right = right
    data_col_w = (table_right - left) / len(FREQUENCIES)
    table_bottom = table_top - 3 * table_row_h

    def col_center(index: int) -> float:
        return left + (index + 0.5) * data_col_w

    # Fondo de encabezado de tabla
    pdf.setFillColor(colors.HexColor("#f0f4f2"))
    pdf.rect(table_left, table_top - table_row_h, table_right - table_left, table_row_h, fill=1, stroke=0)

    # Encabezado: Frecuencias
    pdf.setFillColor(colors.HexColor("#142b2a"))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(table_left + 8, table_top - 11, "Frecuencia")
    for i, f in enumerate(FREQUENCIES):
        pdf.drawCentredString(col_center(i), table_top - 11, f"{f} Hz")

    # Fila Oído Izquierdo
    pdf.setFillColor(colors.HexColor("#dc684c"))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(table_left + 8, table_top - table_row_h - 11, "Oído Izq (dB HL)")
    pdf.setFont("Helvetica", 8)
    for i, f in enumerate(FREQUENCIES):
        val = lookup.get(("left", f))
        nr = no_response_lookup.get(("left", f), False)
        txt = "NR" if nr else (f"{int(round(val))}" if val is not None else "—")
        pdf.drawCentredString(col_center(i), table_top - table_row_h - 11, txt)

    # Fila Oído Derecho
    pdf.setFillColor(colors.HexColor("#237e72"))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(table_left + 8, table_top - table_row_h * 2 - 11, "Oído Der (dB HL)")
    pdf.setFont("Helvetica", 8)
    for i, f in enumerate(FREQUENCIES):
        val = lookup.get(("right", f))
        nr = no_response_lookup.get(("right", f), False)
        txt = "NR" if nr else (f"{int(round(val))}" if val is not None else "—")
        pdf.drawCentredString(col_center(i), table_top - table_row_h * 2 - 11, txt)

    # Líneas de contorno y cuadrícula de la tabla
    pdf.setStrokeColor(colors.HexColor("#d5dfdb"))
    pdf.setLineWidth(0.5)
    for row_i in range(4):
        y_line = table_top - row_i * table_row_h
        pdf.line(table_left, y_line, table_right, y_line)

    pdf.line(table_left, table_top, table_left, table_bottom)
    pdf.line(left, table_top, left, table_bottom)
    for i in range(1, len(FREQUENCIES)):
        x_div = left + i * data_col_w
        pdf.line(x_div, table_top, x_div, table_bottom)
    pdf.line(table_right, table_top, table_right, table_bottom)

    # Notas aclaratorias y pie institucional
    obs = payload.observations or payload.observaciones
    if obs:
        clean_obs = unicodedata.normalize("NFC", obs.strip()).encode("latin-1", "replace").decode("latin-1")
        pdf.setFillColor(colors.HexColor("#b45309"))
        pdf.setFont("Helvetica-Bold", 7.0)
        if len(clean_obs) > 120:
            split_idx = clean_obs.rfind(" ", 0, 120)
            if split_idx == -1:
                split_idx = 120
            pdf.drawString(table_left, 78, clean_obs[:split_idx])
            pdf.drawString(table_left, 68, clean_obs[split_idx:].strip())
            y_text = 57
        else:
            pdf.drawString(table_left, 76, clean_obs)
            y_text = 64
        pdf.setFillColor(colors.HexColor("#8a5140"))
        pdf.setFont("Helvetica-Bold", 7.5)
        pdf.drawString(table_left, y_text, "Nota técnica: Resultados en escala dB HL aproximada (ref. ANSI S3.6) sobre ganancia digital controlada.")
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 6.8)
        pdf.drawString(table_left, y_text - 10, "Debido al uso de hardware no calibrado en acoplador, existe incertidumbre instrumental (σ ≈ ±7-10 dB; Masalski et al., 2014).")
        pdf.drawString(table_left, y_text - 19, "Herramienta de tamizaje educativo; no sustituye audiometría diagnóstica.")
    else:
        pdf.setFillColor(colors.HexColor("#8a5140"))
        pdf.setFont("Helvetica-Bold", 7.8)
        pdf.drawString(table_left, 66, "Nota técnica: Resultados en escala dB HL aproximada (ref. ANSI S3.6) sobre ganancia digital controlada.")
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 7.2)
        pdf.drawString(table_left, 54, "Debido al uso de hardware no calibrado en acoplador, existe incertidumbre instrumental (σ ≈ ±7-10 dB; Masalski et al., 2014).")
        pdf.drawString(table_left, 43, "Herramienta de tamizaje educativo; no sustituye audiometría diagnóstica.")

    pdf.setFillColor(colors.HexColor("#8a0303"))
    pdf.setFont("Helvetica-Bold", 9.5)
    pdf.drawCentredString(page_width / 2, 29, "Esta gráfica es referencial y no sustituye un diagnóstico audiológico profesional.")

    pdf.setFillColor(colors.HexColor("#87938c"))
    pdf.setFont("Helvetica", 7.2)
    pdf.drawCentredString(page_width / 2, 16, "Desarrollado por Cielo Isabel Ochoa y Juan José Guerrero · Ing. de Sonido, Univ. de San Buenaventura Medellín · Psicoacústica 2026-2")

    pdf.showPage()
    pdf.save()
    return output.getvalue()
