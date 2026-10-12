from io import BytesIO
import unicodedata

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

from .schemas import ReportRequest


FREQUENCIES = (125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000)


def build_report(payload: ReportRequest) -> bytes:
    output = BytesIO()
    page_width, page_height = landscape(letter)
    pdf = canvas.Canvas(output, pagesize=(page_width, page_height))
    pdf.setTitle("Audio Check | Resumen auditivo")

    pdf.setFillColor(colors.HexColor("#142b2a"))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(48, page_height - 52, "Resumen auditivo")
    pdf.setFillColor(colors.HexColor("#526260"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(48, page_height - 68, "Registro exploratorio · niveles digitales relativos (dBFS)")

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
        pdf.drawString(48, page_height - 84, "   ·   ".join(patient_items))

    left, right = 96, page_width - 42
    bottom, top = 112, page_height - 118
    graph_width, graph_height = right - left, top - bottom

    # Eje X equidistante: 11 columnas (incluye inter-octavas) repartidas
    # uniformemente entre left (96 pt) y right (750 pt) en hoja carta horizontal.
    column_width = graph_width / (len(FREQUENCIES) - 1)

    def x_position(frequency: int) -> float:
        return left + FREQUENCIES.index(frequency) * column_width

    def y_position(level: int) -> float:
        return bottom + ((level + 100) / 100) * graph_height

    pdf.setStrokeColor(colors.HexColor("#d5dfdb"))
    pdf.setLineWidth(0.6)
    for level in range(0, -101, -20):
        y = y_position(level)
        pdf.line(left, y, right, y)
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(left - 10, y - 3, str(level))

    for frequency in FREQUENCIES:
        x = x_position(frequency)
        pdf.setStrokeColor(colors.HexColor("#e8eeeb"))
        pdf.line(x, bottom, x, top)
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 9)
        pdf.drawCentredString(x, bottom - 17, str(frequency))

    pdf.setFillColor(colors.HexColor("#142b2a"))
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString((left + right) / 2, bottom - 36, "Frecuencia (Hz)")
    pdf.saveState()
    pdf.translate(34, (bottom + top) / 2)
    pdf.rotate(90)
    pdf.drawCentredString(0, 0, "Nivel relativo indicado (dBFS, no calibrado)")
    pdf.restoreState()

    series = (("left", colors.HexColor("#dc684c"), "Oído izquierdo"),
              ("right", colors.HexColor("#237e72"), "Oído derecho"))
    lookup = {(item.ear, item.frequency_hz): item.level_dbfs for item in payload.measurements}
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

        legend_x = right - 145 if ear == "left" else right - 55
        pdf.setFillColor(color)
        pdf.circle(legend_x, page_height - 73, 3, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#526260"))
        pdf.setFont("Helvetica", 8)
        pdf.drawString(legend_x + 8, page_height - 76, label)

    pdf.setFillColor(colors.HexColor("#8a5140"))
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(left, 70, "No es una audiometría clínica. No representa dB SPL ni dB HL.")
    pdf.setFillColor(colors.HexColor("#526260"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(left, 56, "Los resultados se expresan en escala digital (dBFS). Al carecer de calibración con sonómetro, no equivalen a niveles clínicos estándar (dB HL).")

    pdf.setFillColor(colors.HexColor("#8a0303"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(page_width / 2, 36, "Esta gráfica es referencial y no sustituye un diagnóstico audiológico profesional.")

    pdf.setFillColor(colors.HexColor("#87938c"))
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(page_width / 2, 20, "Desarrollado por Cielo Isabel Ochoa y Juan José Guerrero · Ing. de Sonido, Univ. de San Buenaventura Medellín · Psicoacústica 2026-2")
    pdf.showPage()
    pdf.save()
    return output.getvalue()
