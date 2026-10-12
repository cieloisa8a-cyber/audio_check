from typing import Literal, Optional

from pydantic import BaseModel, Field


Frequency = Literal[250, 500, 1000, 2000, 3000, 4000, 6000, 8000]


class Measurement(BaseModel):
    ear: Literal["left", "right"]
    frequency_hz: Frequency
    level_dbfs: Optional[int] = Field(default=None, ge=-60, le=-20)


class ReportRequest(BaseModel):
    patient_name: Optional[str] = Field(default=None, max_length=100)
    patient_age: Optional[int] = Field(default=None, ge=1, le=120)
    measurements: list[Measurement] = Field(min_length=1, max_length=16)
