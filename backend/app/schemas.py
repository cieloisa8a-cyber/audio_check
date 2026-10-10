from typing import Literal, Optional

from pydantic import BaseModel, Field


Frequency = Literal[250, 500, 1000, 2000, 4000, 8000]


class Measurement(BaseModel):
    ear: Literal["left", "right"]
    frequency_hz: Frequency
    level_dbfs: Optional[int] = Field(default=None, ge=-60, le=-20)


class ReportRequest(BaseModel):
    measurements: list[Measurement] = Field(min_length=1, max_length=12)
