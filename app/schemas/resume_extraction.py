from pydantic import BaseModel, Field


class ExperienceEntry(BaseModel):
    title: str
    company: str
    duration: str | None = None
    highlights: list[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    degree: str
    school: str
    duration: str | None = None
    highlights: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    name: str
    description: str | None = None
    highlights: list[str] = Field(default_factory=list)


class SkillEntry(BaseModel):
    name: str
    level: str | None = None
    highlights: list[str] = Field(default_factory=list)


class ResumeExtraction(BaseModel):
    name: str
    headline: str | None = None
    location: str | None = Field(
        default=None,
        max_length=255,
        description="Candidate city/region/country when stated on the resume.",
    )
    email: str | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
