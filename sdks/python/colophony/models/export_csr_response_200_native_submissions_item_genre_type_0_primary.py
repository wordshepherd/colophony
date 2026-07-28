from enum import Enum


class ExportCsrResponse200NativeSubmissionsItemGenreType0Primary(str, Enum):
    AUDIO = "audio"
    COMICS = "comics"
    CREATIVE_NONFICTION = "creative_nonfiction"
    DRAMA = "drama"
    FICTION = "fiction"
    NONFICTION = "nonfiction"
    OTHER = "other"
    POETRY = "poetry"
    TRANSLATION = "translation"
    VISUAL_ART = "visual_art"

    def __str__(self) -> str:
        return str(self.value)
