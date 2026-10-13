from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field, root_validator


Frequency = Literal[250, 500, 1000, 2000, 3000, 4000, 6000, 8000]


class Measurement(BaseModel):
    ear: Literal["left", "right"]
    frequency_hz: Frequency
    level_dbfs: Optional[int] = Field(..., ge=-60, le=-20)
    level_dbhl: Optional[float] = Field(..., ge=-10, le=120)


class CalibrationProfile(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    platform: Literal["web", "ios", "android"]
    output_chain: str = Field(min_length=1, max_length=120)
    reference_dbfs: Literal[-20]
    db_hl_at_reference_dbfs: Dict[int, float]

    @root_validator(skip_on_failure=True)
    def validate_frequency_references(cls, values):
        references = values.get("db_hl_at_reference_dbfs", {})
        if set(references) != set(Frequency.__args__):
            raise ValueError("El perfil debe incluir una referencia dB HL para cada frecuencia.")
        if any(not 30 <= level <= 120 for level in references.values()):
            raise ValueError("Las referencias dB HL deben estar entre 30 y 120.")
        return values


class ReportRequest(BaseModel):
    patient_name: Optional[str] = Field(default=None, max_length=100)
    patient_age: Optional[int] = Field(default=None, ge=1, le=120)
    measurements: list[Measurement] = Field(min_length=1, max_length=16)
    calibration_profile: CalibrationProfile

    @root_validator(skip_on_failure=True)
    def validate_calibrated_measurements(cls, values):
        profile = values["calibration_profile"]
        for measurement in values["measurements"]:
            if (measurement.level_dbfs is None) != (measurement.level_dbhl is None):
                raise ValueError("Cada resultado debe incluir dB HL y su nivel de estímulo, o ambos deben ser nulos.")
            if measurement.level_dbfs is not None:
                expected_dbhl = (
                    measurement.level_dbfs
                    - profile.reference_dbfs
                    + profile.db_hl_at_reference_dbfs[measurement.frequency_hz]
                )
                if abs(measurement.level_dbhl - expected_dbhl) > 0.01:
                    raise ValueError("El nivel dB HL no coincide con el perfil acústico aprobado.")
        return values
