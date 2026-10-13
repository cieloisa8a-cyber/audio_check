from io import BytesIO
import unicodedata

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

from .schemas import ReportRequest


FREQUENCIES = (250, 500, 1000, 2000, 3000, 4000, 6000, 8000)


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
    pdf.drawString(48, page_height - 68, "Registro de umbrales · decibelios de audición (dB HL)")

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
    pdf.setFillColor(colors.HexColor("#526260"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(48, page_height - 100, f"Perfil acústico: {payload.calibration_profile.name}")
    pdf.drawString(48, page_height - 112, f"Plataforma/salida: {payload.calibration_profile.platform} · {payload.calibration_profile.output_chain}")

    left, right = 96, page_width - 42
    bottom, top = 112, page_height - 118
    graph_width, graph_height = right - left, top - bottom

    # Eje X equidistante: columnas repartidas uniformemente entre left (96 pt) y right (750 pt)
    column_width = graph_width / (len(FREQUENCIES) - 1)

    def x_position(frequency: int) -> float:
        return left + FREQUENCIES.index(frequency) * column_width

    def y_position(level: float) -> float:
        return bottom + ((120 - level) / 130) * graph_height

    pdf.setStrokeColor(colors.HexColor("#d5dfdb"))
    pdf.setLineWidth(0.6)
    for level in (-10, 0, 20, 40, 60, 80, 100, 120):
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
    pdf.drawCentredString(0, 0, "Umbral auditivo indicado (dB HL)")
    pdf.restoreState()

    series = (("left", colors.HexColor("#dc684c"), "Oído izquierdo"),
              ("right", colors.HexColor("#237e72"), "Oído derecho"))
    lookup = {(item.ear, item.frequency_hz): item.level_dbhl for item in payload.measurements}
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
    pdf.drawString(left, 70, "Registro exploratorio; no sustituye una audiometría clínica ni un diagnóstico.")
    pdf.setFillColor(colors.HexColor("#526260"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(left, 56, "dB HL calculados con el perfil acústico indicado; su validez depende de la calibración de esa cadena de salida.")

    pdf.setFillColor(colors.HexColor("#8a0303"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(page_width / 2, 36, "Esta gráfica es referencial y no sustituye un diagnóstico audiológico profesional.")

    pdf.setFillColor(colors.HexColor("#87938c"))
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(page_width / 2, 20, "Desarrollado por Cielo Isabel Ochoa y Juan José Guerrero · Ing. de Sonido, Univ. de San Buenaventura Medellín · Psicoacústica 2026-2")
    pdf.showPage()
    pdf.save()
    return output.getvalue()
