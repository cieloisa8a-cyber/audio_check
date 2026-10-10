from io import BytesIO
from math import log10

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

from .schemas import ReportRequest


FREQUENCIES = (250, 500, 1000, 2000, 4000, 8000)


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
    pdf.drawString(48, page_height - 70, "Registro exploratorio · niveles digitales relativos (dBFS)")

    left, right = 96, page_width - 42
    bottom, top = 112, page_height - 118
    graph_width, graph_height = right - left, top - bottom

    def x_position(frequency: int) -> float:
        return left + (log10(frequency) - log10(FREQUENCIES[0])) / (
            log10(FREQUENCIES[-1]) - log10(FREQUENCIES[0])
        ) * graph_width

    def y_position(level: int) -> float:
        return bottom + ((-20 - level) / 40) * graph_height

    pdf.setStrokeColor(colors.HexColor("#d5dfdb"))
    pdf.setLineWidth(0.6)
    for level in (-20, -30, -40, -50, -60):
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

    series = (("left", colors.HexColor("#dc684c"), "Oido izquierdo"),
              ("right", colors.HexColor("#237e72"), "Oido derecho"))
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
    pdf.drawString(left, 69, "No es una audiometria clinica. No representa dB SPL ni dB HL.")
    pdf.setFillColor(colors.HexColor("#526260"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(left, 54, "La salida depende del dispositivo y los audifonos. No uses este resultado para diagnostico.")
    pdf.showPage()
    pdf.save()
    return output.getvalue()
